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

  const myTopic = 'ipqs/data'; 

  client.subscribe(myTopic, (err) => {
    if (err) {
      console.error(`❌ Subscription to ${myTopic} failed:`, err.message);
    } else {
      console.log(`📡 Subscribed to: ${myTopic}`);
    }
  });
});

client.on('message', async (topic, message) => {
  try {
    const parsed = JSON.parse(message.toString());
    const { type, device_id, msg_id, timestamp, status, network_status, data, config } = parsed;

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
            device_id, config.apn, config.gprs_user, config.gprs_pass,
            config.mqtt_host, config.mqtt_port, config.mqtt_user, config.mqtt_pass,
            config.pub_topic, config.sub_topic, config.ack_topic,
            config.interval_sec, config.firmware_version
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
    const now = Date.now();
    const lastInsert = lastInsertTimestamps[device_id] || 0;
    
    // Set to 5 seconds for testing purposes
    const interval = 5 * 1000; 

    if (now - lastInsert >= interval) {
      // ✅ FIX: Update timer immediately so it doesn't spam if it skips
      lastInsertTimestamps[device_id] = now; 

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
                voltage, current, kw, kva, kwh, kvarhlag,
                kvarhlead, kvah, kvar, power_factor,
                voltage_r, voltage_y, voltage_b,
                current_r, current_y, current_b,
                kw_r, kw_y, kw_b,
                kvar_r, kvar_y, kvar_b,
                kva_r, kva_y, kva_b,
                pf_r, pf_y, pf_b,
                device_status, network_status, created_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `;
            const values = [
              device_id, topic, msg_id, timestamp_utc, ts_unix,
              parseFloat(data['Voltage']) || 0, parseFloat(data['Current']) || 0,
              parseFloat(data['KW']) || 0, parseFloat(data['kVA']) || 0, currentKwh,
              parseFloat(data['Kvarhlag']) || 0, parseFloat(data['Kvarhlead']) || 0,
              parseFloat(data['kvah']) || 0, parseFloat(data['kvar']) || 0, powerFactor,
              
              parseFloat(data['Voltage_R']) || 0, parseFloat(data['Voltage_Y']) || 0, parseFloat(data['Voltage_B']) || 0,
              parseFloat(data['Current_R']) || 0, parseFloat(data['Current_Y']) || 0, parseFloat(data['Current_B']) || 0,
              parseFloat(data['KW_R']) || 0, parseFloat(data['KW_Y']) || 0, parseFloat(data['KW_B']) || 0,
              parseFloat(data['KVAR_R']) || 0, parseFloat(data['KVAR_Y']) || 0, parseFloat(data['KVAR_B']) || 0,
              parseFloat(data['KVA_R']) || 0, parseFloat(data['KVA_Y']) || 0, parseFloat(data['KVA_B']) || 0,
              parseFloat(data['PF_R']) || 0, parseFloat(data['PF_Y']) || 0, parseFloat(data['PF_B']) || 0,
              
              status || null, network_status || null
            ];

            db.query(insertQuery, values, (err) => {
              if (err) {
                console.error('❌ DB Insert Error:', err.message);
              } else {
                console.log(`✅ Inserted data for ${device_id} with KWh: ${currentKwh}`);
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
      status: status || 'Unknown',
      network_status: network_status || 'Unknown',
      voltage: parseFloat(data['Voltage']) || 0,
      current: parseFloat(data['Current']) || 0,
      kw: parseFloat(data['KW']) || 0,
      kva: parseFloat(data['kVA']) || 0,
      kwh: parseFloat(data['Kwh']) || 0,
      kvarhlag: parseFloat(data['Kvarhlag']) || 0,
      kvarhlead: parseFloat(data['Kvarhlead']) || 0,
      kvah: parseFloat(data['kvah']) || 0,
      kvar: parseFloat(data['kvar']) || 0,
      power_factor: powerFactor,
      
      voltage_r: parseFloat(data['Voltage_R']) || 0,
      voltage_y: parseFloat(data['Voltage_Y']) || 0,
      voltage_b: parseFloat(data['Voltage_B']) || 0,
      current_r: parseFloat(data['Current_R']) || 0,
      current_y: parseFloat(data['Current_Y']) || 0,
      current_b: parseFloat(data['Current_B']) || 0,
      kw_r: parseFloat(data['KW_R']) || 0,
      kw_y: parseFloat(data['KW_Y']) || 0,
      kw_b: parseFloat(data['KW_B']) || 0,
      kvar_r: parseFloat(data['KVAR_R']) || 0,
      kvar_y: parseFloat(data['KVAR_Y']) || 0,
      kvar_b: parseFloat(data['KVAR_B']) || 0,
      kva_r: parseFloat(data['KVA_R']) || 0,
      kva_y: parseFloat(data['KVA_Y']) || 0,
      kva_b: parseFloat(data['KVA_B']) || 0,
      pf_r: parseFloat(data['PF_R']) || 0,
      pf_y: parseFloat(data['PF_Y']) || 0,
      pf_b: parseFloat(data['PF_B']) || 0
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