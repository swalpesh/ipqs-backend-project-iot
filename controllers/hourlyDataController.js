const db = require('../models/db');

exports.getHourlyData = async (req, res) => {
  const { device_id, date, hour } = req.params;

  const targetDate = `${date} ${hour.padStart(2, '0')}:00:00`;

  try {
    const query = `
      SELECT * FROM device_data_hourly
      WHERE device_id = ? AND timestamp_utc = ?
    `;
    db.query(query, [device_id, targetDate], (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.length === 0) return res.status(404).json({ message: 'No hourly data found' });
      return res.status(200).json(results[0]);
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.getDailySummary = async (req, res) => {
  const { device_id, date } = req.params;

  try {
    const query = `
      SELECT * FROM device_data_hourly
      WHERE device_id = ? AND DATE(timestamp_utc) = ?
      ORDER BY timestamp_utc ASC
    `;
    db.query(query, [device_id, date], (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      return res.status(200).json(results);
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
