const mqtt = require('mqtt');
require('dotenv').config();

const mqttClient = mqtt.connect(process.env.MQTT_BROKER_URL, {
  port: parseInt(process.env.MQTT_PORT)
});

exports.broadcastFirmware = (req, res) => {
  const { topic, payload } = req.body;

  // ✅ Validate
  if (!topic || !payload || payload.command !== 'firmware_update') {
    return res.status(400).json({ error: 'Invalid topic or payload format' });
  }

  const { request_id, command, version, value } = payload;

  if (!request_id || !version || !value) {
    return res.status(400).json({ error: 'Missing required fields in payload' });
  }

  // 📨 Construct MQTT message
  const mqttPayload = {
    request_id,
    command,
    version,
    value
    // Note: Do NOT include device_id for broadcast
  };

  mqttClient.publish(topic, JSON.stringify(mqttPayload), () => {
    console.log(`📢 Firmware broadcast sent to topic: ${topic}`);
    console.log('📦 Payload:', JSON.stringify(mqttPayload, null, 2));

    return res.status(200).json({
      message: 'Firmware broadcasted successfully',
      topic,
      payload: mqttPayload
    });
  });
};
