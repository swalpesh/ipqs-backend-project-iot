const db = require('../models/db');
const moment = require('moment');

exports.getYearlyMonthlySummary = async (req, res) => {
  const { device_id } = req.params;
  const currentYear = moment().year();

  // Start and end of year
  const start = `${currentYear}-01`;
  const end = moment().format('YYYY-MM');

  const query = `
    SELECT month, avg_kwh, avg_kvah, avg_power_factor
    FROM device_data_monthly_summary
    WHERE device_id = ? AND month BETWEEN ? AND ?
  `;

  db.query(query, [device_id, start, end], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    const resultMap = {};
    results.forEach(row => {
      resultMap[row.month] = {
        month: row.month,
        kwh: row.avg_kwh ? parseFloat(parseFloat(row.avg_kwh).toFixed(2)) : 0,
        kvah: row.avg_kvah ? parseFloat(parseFloat(row.avg_kvah).toFixed(2)) : 0,
        power_factor: row.avg_power_factor ? parseFloat(parseFloat(row.avg_power_factor).toFixed(2)) : 0,
        // power_factor: parseFloat(row.avg_power_factor?.toFixed(3)) || 0
      };
    });

    const months = [];
    for (let m = 1; m <= moment().month() + 1; m++) {
      const monthStr = `${currentYear}-${String(m).padStart(2, '0')}`;
      months.push(
        resultMap[monthStr] || {
          month: monthStr,
          kwh: 0,
          kvah: 0,
          power_factor: 0
        }
      );
    }

    return res.status(200).json(months);
  });
};
