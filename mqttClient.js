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
const lastInsertTimestamps = {}; // Per-device timestamp tracker

server.listen(process.env.SOCKET_PORT || 4000, () => {
  console.log(`🚀 Socket.IO server running on port ${process.env.SOCKET_PORT || 4000}`);
});

io.on('connection', (socket) => {
  console.log('🟢 Web client connected via Socket.IO');
});

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
    const { type, device_id, msg_id, timestamp, data } = parsed;

    if (type === 'cmd_ack') return;
    if (type !== 'measurement' || !device_id || !data) return;

    const timestamp_utc = timestamp || null;
    const ts_unix = data.TS || null;

    // 🔍 Validate device against topic and active status
    const [device] = await new Promise((resolve, reject) => {
      const query = 'SELECT * FROM devices WHERE device_id = ? AND topic_name = ? AND status = "active"';
      db.query(query, [device_id, topic], (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    if (!device) {
      console.warn(`⚠️ Device ${device_id} not found, topic mismatch, or inactive`);
      return;
    }

    // 🧠 Prevent duplicate inserts within 5 minutes
    const now = Date.now();
    const lastInsert = lastInsertTimestamps[device_id] || 0;
    const interval = 5 * 60 * 1000; // 5 min

    if (now - lastInsert >= interval) {
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
        parseFloat(data['Kwh']) || 0,
        parseFloat(data['Kvarhlag']) || 0,
        parseFloat(data['Kvarhlead']) || 0,
        parseFloat(data['kvah']) || 0,
        parseFloat(data['kvar']) || 0,
        parseFloat(data['powerfactor']) || 0
      ];

      db.query(insertQuery, values, (err) => {
        if (err) {
          console.error('❌ DB Insert Error:', err.message);
        } else {
          lastInsertTimestamps[device_id] = now;
        }
      });
    }

    // 🌐 Emit live data to frontend via socket
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
      power_factor: parseFloat(data['powerfactor']) || 0,
    };
    io.emit(`device-data-${device_id}`, livePayload);

    // 📨 Send ACK
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
