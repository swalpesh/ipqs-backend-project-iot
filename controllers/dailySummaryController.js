const db = require('../models/db');
const moment = require('moment');

exports.getYesterdaySummary = async (req, res) => {
  const { device_id } = req.params;
  const yesterday = moment().subtract(1, 'day').format('YYYY-MM-DD');

  const query = `
    SELECT * FROM device_data_daily_summary 
    WHERE device_id = ? AND date = ?
  `;

  db.query(query, [device_id, yesterday], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'No data found for yesterday' });
    return res.status(200).json(results[0]);
  });
};

// Your weekly summary function remains the same
exports.getWeeklySummary = async (req, res) => {
  const { device_id } = req.params;

  const today = moment();
  const startOfWeek = moment().startOf('isoWeek'); // Monday
  const endOfRange = today.endOf('day');

  const query = `
    SELECT weekday, date, avg_kwh, avg_kvah, avg_power_factor
    FROM device_data_daily_summary
    WHERE device_id = ? AND date BETWEEN ? AND ?
    ORDER BY date ASC
  `;

  db.query(query, [device_id, startOfWeek.format('YYYY-MM-DD'), endOfRange.format('YYYY-MM-DD')], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'No data found for current week' });

    const formatted = results.map(row => ({
      day: row.weekday,
      date: row.date,
      kwh: parseFloat(row.avg_kwh?.toFixed(2)) || 0,
      kvah: parseFloat(row.avg_kvah?.toFixed(2)) || 0,
      power_factor: parseFloat(row.avg_power_factor?.toFixed(3)) || 0
    }));

    return res.status(200).json(formatted);
  });
};
