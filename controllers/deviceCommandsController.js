const mqtt = require('mqtt');
const db = require('../models/db');
require('dotenv').config();

const mqttClient = mqtt.connect(process.env.MQTT_BROKER_URL, {
  port: parseInt(process.env.MQTT_PORT),
});

exports.sendBatchedCommands = async (req, res) => {
  const { device_id } = req.params;
  const {
    request_id,
    command,
    value,
    version,
    operations
  } = req.body;

  if (!request_id) {
    return res.status(400).json({ error: 'request_id is required' });
  }

  try {
    // Validate device
    const [device] = await new Promise((resolve, reject) => {
      db.query('SELECT * FROM devices WHERE device_id = ?', [device_id], (err, results) => {
        if (err) reject(err);
        resolve(results);
      });
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    let topic = 'ipqs/cmd';
    let payload = { request_id };

    // 🔁 Handle batch operations
    if (operations && Array.isArray(operations)) {
      if (operations.length === 0) {
        return res.status(400).json({ error: 'operations[] must not be empty' });
      }
      payload.device_id = device_id;
      payload.operations = operations;
    }

    // ✅ Handle single commands
    else if (command) {
      payload.command = command;
      payload.device_id = device_id;

      switch (command) {
        case 'modify_interval':
          if (typeof value !== 'number') {
            return res.status(400).json({ error: 'modify_interval requires numeric value' });
          }
          payload.value = value;
          break;

        case 'modify_topics':
          if (!value || !value.pub || !value.sub || !value.ack) {
            return res.status(400).json({ error: 'modify_topics requires pub, sub, and ack' });
          }
          payload.value = value;
          // ✅ Only this updates database
          await new Promise((resolve, reject) => {
            db.query(
              'UPDATE devices SET topic_name = ?, sub_topic = ?, ack_topic = ? WHERE device_id = ?',
              [value.pub, value.sub, value.ack, device_id],
              (err) => (err ? reject(err) : resolve())
            );
          });
          break;

        case 'modify_apn':
          if (typeof value !== 'string') {
            return res.status(400).json({ error: 'modify_apn requires a string value' });
          }
          payload.value = value;
          break;

        case 'modify_mqtt':
          if (!value || !value.host || !value.port || !value.username || !value.password) {
            return res.status(400).json({ error: 'modify_mqtt requires host, port, username, password' });
          }
          payload.value = value;
          break;

        case 'factory_reset':
          payload.value = null;
          topic = 'ipqs/universal';
          break;

        case 'firmware_update':
          if (!version || !value) {
            return res.status(400).json({ error: 'firmware_update requires version and value' });
          }
          payload.version = version;
          payload.value = value;
          topic = 'ipqs/universal';
          break;

        case 'get_settings':
          payload.operations = [{ command: 'get_settings' }];
          break;

        default:
          return res.status(400).json({ error: `Unsupported command: ${command}` });
      }
    } else {
      return res.status(400).json({ error: 'Either operations[] or a single command must be provided' });
    }

    // ✅ Publish to MQTT
    mqttClient.publish(topic, JSON.stringify(payload), () => {
      console.log(`📤 Command published to ${topic}`);
      console.log('📦 Payload:', JSON.stringify(payload, null, 2));
    });

    return res.status(200).json({
      message: 'Command(s) published successfully',
      topic,
      payload
    });

  } catch (err) {
    console.error('❌ Error sending command:', err.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
