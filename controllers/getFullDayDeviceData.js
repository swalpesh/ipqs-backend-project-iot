const db = require('../models/db');
const moment = require('moment-timezone');

exports.getFullDayDeviceData = async (req, res) => {
  const { device_id, date } = req.query;

  if (!device_id || !date) {
    return res.status(400).json({ error: 'device_id and date are required (format: YYYY-MM-DD)' });
  }

  const query = `
    SELECT * FROM device_data_hourly
    WHERE device_id = ?
    AND DATE(timestamp_utc) = ?
    ORDER BY timestamp_utc ASC
  `;

  db.query(query, [device_id, date], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    // Only return selected fields + IST timestamps
    const filteredData = results.map(row => ({
      id: row.id,
      device_id: row.device_id,
      running_power_factor: row.running_power_factor,
      running_kvar_total: row.running_kvar_total,
      kwh_prev: row.kwh_prev,
      kwh_now: row.kwh_now,
      kwh_diff: row.kwh_diff,
      kvah_prev: row.kvah_prev,
      kvah_now: row.kvah_now,
      kvah_diff: row.kvah_diff,
      kvarh_lag_prev: row.kvarh_lag_prev,
      kvarh_lag_now: row.kvarh_lag_now,
      kvarh_lag_diff: row.kvarh_lag_diff,
      kvarh_lead_prev: row.kvarh_lead_prev,
      kvarh_lead_now: row.kvarh_lead_now,
      kvarh_lead_diff: row.kvarh_lead_diff,
      calculated_pf: row.calculated_pf,
      timestamp_ist: moment.utc(row.timestamp_utc).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss'),
      created_at_ist: moment.utc(row.created_at).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss'),
      hour_ist: moment.utc(row.hour).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss'),
    }));

    return res.status(200).json({ data: filteredData });
  });
};
