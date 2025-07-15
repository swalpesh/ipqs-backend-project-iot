// controllers/getHourlyDataByDate.js
const db = require('../models/db');

exports.getHourlyDataByDate = async (req, res) => {
  const { device_id, date } = req.query;

  if (!device_id || !date) {
    return res.status(400).json({ error: 'device_id and date are required (format: YYYY-MM-DD)' });
  }

  const query = `
    SELECT * FROM device_data_hourly 
    WHERE device_id = ? AND DATE(timestamp_utc) = ?
    ORDER BY hour ASC
  `;

  db.query(query, [device_id, date], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    return res.status(200).json({ data: results });
  });
};
