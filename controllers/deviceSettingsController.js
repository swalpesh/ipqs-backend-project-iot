const db = require('../models/db');

exports.storeDeviceSettings = (req, res) => {
  const {
    device_id,
    apn,
    gprs_user,
    gprs_pass,
    mqtt_host,
    mqtt_port,
    mqtt_user,
    mqtt_pass,
    pub_topic,
    sub_topic,
    ack_topic,
    interval_sec,
    firmware_version
  } = req.body;

  if (!device_id) {
    return res.status(400).json({ error: 'device_id is required' });
  }

  const deleteQuery = 'DELETE FROM device_settings WHERE device_id = ?';
  db.query(deleteQuery, [device_id], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete previous settings' });
    }

    const insertQuery = `
      INSERT INTO device_settings (
        device_id, apn, gprs_user, gprs_pass, mqtt_host, mqtt_port,
        mqtt_user, mqtt_pass, pub_topic, sub_topic, ack_topic,
        interval_sec, firmware_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      device_id,
      apn, gprs_user, gprs_pass, mqtt_host, mqtt_port,
      mqtt_user, mqtt_pass, pub_topic, sub_topic, ack_topic,
      interval_sec, firmware_version
    ];

    db.query(insertQuery, values, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to insert device settings' });
      }
      return res.status(200).json({ message: 'Device settings stored successfully' });
    });
  });
};

exports.getDeviceSettings = (req, res) => {
  const { device_id } = req.params;

  const query = 'SELECT * FROM device_settings WHERE device_id = ?';
  db.query(query, [device_id], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch settings' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'No settings found for this device' });
    }
    return res.status(200).json(results[0]);
  });
};
