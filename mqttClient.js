const mqtt = require('mqtt');
const db = require('./models/db');
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: '*' },
});

const mqttOptions = {
  port: parseInt(process.env.MQTT_PORT) || 1883,
};

const client = mqtt.connect(process.env.MQTT_BROKER_URL, mqttOptions);
let ackCounter = 0;
const lastInsertTimestamps = {};

server.listen(process.env.SOCKET_PORT || 4000, () => {
  console.log(`🚀 Socket.IO server running on port ${process.env.SOCKET_PORT || 4000}`);
});

io.on('connection', (socket) => {
  console.log('🟢 Web client connected via Socket.IO');
});

function parseCustomTimestamp(ts) {
  if (!ts || typeof ts !== 'string' || ts.length !== 14) return null;
  const year = ts.slice(0, 4);
  const month = ts.slice(4, 6);
  const day = ts.slice(6, 8);
  const hour = ts.slice(8, 10);
  const minute = ts.slice(10, 12);
  const second = ts.slice(12, 14);
  const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
  const date = new Date(isoString);
  return isNaN(date.getTime()) ? null : date;
}

client.on('connect', () => {
  console.log('✅ Connected to MQTT broker');

  client.subscribe('#', (err) => {
    if (err) console.error('❌ Subscription to # failed:', err.message);
    else console.log('📡 Subscribed to: #');
  });
});

client.on('message', async (topic, message) => {
  try {
    const parsed = JSON.parse(message.toString());
    const { type, device_id, msg_id, timestamp, data, config } = parsed;

    if (type === 'settings' && device_id && config) {
      try {
        await new Promise((resolve, reject) => {
          db.query('DELETE FROM device_settings WHERE device_id = ?', [device_id], (err) => {
            if (err) return reject(err);
            resolve();
          });
        });

        await new Promise((resolve, reject) => {
          const insertQuery = `
            INSERT INTO device_settings (
              device_id, apn, gprs_user, gprs_pass,
              mqtt_host, mqtt_port, mqtt_user, mqtt_pass,
              pub_topic, sub_topic, ack_topic,
              interval_sec, firmware_version, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
          `;
          const values = [
            device_id,
            config.apn,
            config.gprs_user,
            config.gprs_pass,
            config.mqtt_host,
            config.mqtt_port,
            config.mqtt_user,
            config.mqtt_pass,
            config.pub_topic,
            config.sub_topic,
            config.ack_topic,
            config.interval_sec,
            config.firmware_version
          ];
          db.query(insertQuery, values, (err) => {
            if (err) return reject(err);
            io.emit(`device-settings-${device_id}`, config);
            resolve();
          });
        });
      } catch (err) {
        console.error(`❌ Failed to store settings for ${device_id}:`, err.message);
      }
      return;
    }

    if (type === 'cmd_ack' || type !== 'measurement' || !device_id || !data) return;

    const timestamp_utc = timestamp || null;
    const ts_unix = data.TS || null;

    const [device] = await new Promise((resolve, reject) => {
      const query = 'SELECT * FROM devices WHERE device_id = ? AND topic_name = ? AND status = "active"';
      db.query(query, [device_id, topic], (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    if (!device) return;

    const powerFactor = parseFloat(data['powerfactor']) || 0;
    const min_pf = parseFloat(device.min_pf);
    const max_pf = parseFloat(device.max_pf);
    const lead_min_pf = parseFloat(device.lead_min_pf);
    const lead_max_pf = parseFloat(device.lead_max_pf);

    const isLagOutOfRange = !isNaN(min_pf) && !isNaN(max_pf) && (powerFactor < min_pf || powerFactor > max_pf);
    const isLeadOutOfRange = !isNaN(lead_min_pf) && !isNaN(lead_max_pf) && (powerFactor < lead_min_pf || powerFactor > lead_max_pf);

    if (isLagOutOfRange && isLeadOutOfRange) {
      const hourDate = parseCustomTimestamp(timestamp_utc);
      if (hourDate) {
        hourDate.setMinutes(0, 0, 0);

        const alertQuery = `
          INSERT INTO alerts (
            device_id, hour, timestamp_utc, kwh_now, kvah_now,
            kvarh_lag_now, kvarh_lead_now, calculated_pf, type, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'live', NOW())
        `;
        const alertValues = [
          device_id,
          hourDate,
          timestamp_utc,
          parseFloat(data['Kwh']) || 0,
          parseFloat(data['kvah']) || 0,
          parseFloat(data['Kvarhlag']) || 0,
          parseFloat(data['Kvarhlead']) || 0,
          powerFactor
        ];

        db.query(alertQuery, alertValues, (err) => {
          if (err) {
            console.error(`❌ LIVE Alert insert error for ${device_id}:`, err.message);
          }
        });
      } else {
        console.warn(`⚠️ Invalid timestamp format for alert (device ${device_id}): ${timestamp_utc}`);
      }
    }

    const now = Date.now();
    const lastInsert = lastInsertTimestamps[device_id] || 0;
    const interval = 5 * 60 * 1000;

    if (now - lastInsert >= interval) {
      const currentKwh = parseFloat(data['Kwh']) || 0;

      db.query(
        'SELECT kwh FROM device_data WHERE device_id = ? ORDER BY created_at DESC LIMIT 1',
        [device_id],
        (err, results) => {
          if (err) {
            console.error(`❌ Failed to fetch last KWH for ${device_id}:`, err.message);
            return;
          }

          const lastKwh = results[0]?.kwh || 0;

          if (currentKwh > lastKwh) {
            const insertQuery = `
              INSERT INTO device_data (
                device_id, topic_name, msg_id, timestamp_utc, ts_unix,
                voltage, current, kw, kwh, kvarhlag,
                kvarhlead, kvah, kvar, power_factor, created_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `;
            const values = [
              device_id,
              topic,
              msg_id,
              timestamp_utc,
              ts_unix,
              parseFloat(data['Voltage']) || 0,
              parseFloat(data['Current']) || 0,
              parseFloat(data['KW']) || 0,
              currentKwh,
              parseFloat(data['Kvarhlag']) || 0,
              parseFloat(data['Kvarhlead']) || 0,
              parseFloat(data['kvah']) || 0,
              parseFloat(data['kvar']) || 0,
              powerFactor
            ];

            db.query(insertQuery, values, (err) => {
              if (err) {
                console.error('❌ DB Insert Error:', err.message);
              } else {
                console.log(`✅ Inserted 5-min data for ${device_id} with KWh: ${currentKwh}`);
                lastInsertTimestamps[device_id] = now;
              }
            });
          } else {
            console.log(`⏭️ Skipped insertion for ${device_id} — KWh ${currentKwh} <= last KWh ${lastKwh}`);
          }
        }
      );
    }

    const livePayload = {
      device_id,
      voltage: parseFloat(data['Voltage']) || 230,
      current: parseFloat(data['Current']) || 12,
      kw: parseFloat(data['KW']) || 0,
      kwh: parseFloat(data['Kwh']) || 0,
      kvarhlag: parseFloat(data['Kvarhlag']) || 0,
      kvarhlead: parseFloat(data['Kvarhlead']) || 0,
      kvah: parseFloat(data['kvah']) || 0,
      kvar: parseFloat(data['kvar']) || 0,
      power_factor: powerFactor,
    };
    io.emit(`device-data-${device_id}`, livePayload);

    ackCounter++;
    if (ackCounter % 7 === 0 || ackCounter % 8 === 0) return;

    const ackPayload = JSON.stringify({
      type: 'ack',
      device_id,
      msg_id,
      status: 'received'
    });

    client.publish('ipqs/ack', ackPayload);
  } catch (err) {
    console.error('❌ Exception while processing message:', err.message);
  }
});

client.on('error', (err) => {
  console.error('❌ MQTT Connection Error:', err.message);
});

module.exports = { server, client };
