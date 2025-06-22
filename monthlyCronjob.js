// const cron = require('node-cron');
// const db = require('./models/db');
// const moment = require('moment');

// // Get all device IDs
// async function getAllDeviceIds() {
//   return new Promise((resolve, reject) => {
//     db.query('SELECT DISTINCT device_id FROM device_data_daily_summary', (err, results) => {
//       if (err) return reject(err);
//       resolve(results.map(row => row.device_id));
//     });
//   });
// }

// async function computeMonthlyAggregation() {
//   const previousMonth = moment().subtract(1, 'month');
//   const monthStr = previousMonth.format('YYYY-MM');
//   const start = previousMonth.startOf('month').format('YYYY-MM-DD');
//   const end = previousMonth.endOf('month').format('YYYY-MM-DD');

//   console.log(`📆 Monthly aggregation for: ${monthStr}`);
//   console.log(`📅 Date range: ${start} → ${end}`);

//   try {
//     const deviceIds = await getAllDeviceIds();

//     for (const device_id of deviceIds) {
//       const query = `
//         SELECT AVG(avg_kwh) AS avg_kwh,
//                AVG(avg_kvah) AS avg_kvah,
//                AVG(avg_power_factor) AS avg_power_factor
//         FROM device_data_daily_summary
//         WHERE device_id = ? AND date BETWEEN ? AND ?
//       `;

//       db.query(query, [device_id, start, end], (err, results) => {
//         if (err) {
//           console.error(`[ERROR] Monthly aggregation failed for ${device_id}`, err);
//           return;
//         }

//         const row = results[0];
//         if (!row || row.avg_kwh === null) {
//           console.warn(`[WARN] No data for device ${device_id} in ${monthStr}`);
//           return;
//         }

//         const insertQuery = `
//           INSERT INTO device_data_monthly_summary
//           (device_id, month, avg_kwh, avg_kvah, avg_power_factor)
//           VALUES (?, ?, ?, ?, ?)
//         `;

//         db.query(insertQuery, [
//           device_id,
//           monthStr,
//           parseFloat(row.avg_kwh.toFixed(2)),
//           parseFloat(row.avg_kvah.toFixed(2)),
//           parseFloat(row.avg_power_factor.toFixed(3))
//         ], (err) => {
//           if (err) console.error(`[ERROR] Inserting monthly data failed for ${device_id}`, err);
//           else console.log(`✅ Monthly summary stored for ${device_id}`);
//         });
//       });
//     }
//   } catch (err) {
//     console.error('[FATAL] Monthly aggregation failed:', err.message);
//   }
// }

// // Schedule: Every 1st of the month at 12:15 AM
// cron.schedule('15 0 1 * *', () => {
//   console.log('⏰ Running monthly aggregation...');
//   computeMonthlyAggregation();
// });

// // if (require.main === module) {
// //   console.log('\n⚡ Manual test run of monthly summary aggregation');
// //   computeMonthlyAggregation();
// // }


// File: cronjobs/monthlySummaryJob.js

require('dotenv').config();
const cron = require('node-cron');
const db = require('./models/db');
const moment = require('moment-timezone');

// Get all device IDs
async function getAllDeviceIds() {
  return new Promise((resolve, reject) => {
    db.query('SELECT DISTINCT device_id FROM device_data_daily_summary', (err, results) => {
      if (err) return reject(err);
      resolve(results.map(row => row.device_id));
    });
  });
}

async function computeMonthlyAggregation() {
  const istNow = moment().tz('Asia/Kolkata');
  const previousMonth = istNow.clone().subtract(1, 'month');
  const monthStr = previousMonth.format('YYYY-MM');
  const start = previousMonth.startOf('month').format('YYYY-MM-DD');
  const end = previousMonth.endOf('month').format('YYYY-MM-DD');

  console.log(`📆 Monthly aggregation for: ${monthStr}`);
  console.log(`📅 Date range: ${start} → ${end}`);

  try {
    const deviceIds = await getAllDeviceIds();

    for (const device_id of deviceIds) {
      const query = `
        SELECT AVG(avg_kwh) AS avg_kwh,
               AVG(avg_kvah) AS avg_kvah,
               AVG(avg_power_factor) AS avg_power_factor
        FROM device_data_daily_summary
        WHERE device_id = ? AND date BETWEEN ? AND ?
      `;

      const [results] = await new Promise((resolve, reject) => {
        db.query(query, [device_id, start, end], (err, results) => {
          if (err) return reject(err);
          resolve([results]);
        });
      });

      const row = results[0];
      if (!row || row.avg_kwh === null) {
        console.warn(`[WARN] No data for device ${device_id} in ${monthStr}`);
        continue;
      }

      const insertQuery = `
        INSERT INTO device_data_monthly_summary
        (device_id, month, avg_kwh, avg_kvah, avg_power_factor, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
      `;

      await new Promise((resolve, reject) => {
        db.query(insertQuery, [
          device_id,
          monthStr,
          parseFloat(row.avg_kwh.toFixed(2)),
          parseFloat(row.avg_kvah.toFixed(2)),
          parseFloat(row.avg_power_factor.toFixed(3))
        ], (err) => {
          if (err) {
            console.error(`[ERROR] Inserting monthly data failed for ${device_id}`, err);
            return reject(err);
          }
          console.log(`✅ Monthly summary stored for ${device_id}`);
          resolve();
        });
      });
    }
  } catch (err) {
    console.error('[FATAL] Monthly aggregation failed:', err.message);
  }
}

// ✅ Cron runs at 18:45 UTC = 12:15 AM IST on 1st day of the month
cron.schedule('45 18 1 * *', () => {
  console.log('\n⏰ Cron triggered for monthly summary aggregation...');
  computeMonthlyAggregation();
});

module.exports = { computeMonthlyAggregation };
