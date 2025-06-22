// // File: cronjobs/dailySummaryJob.js

// const cron = require('node-cron');
// const db = require('./models/db');
// const moment = require('moment');

// // Retry wrapper
// function retryQuery(query, values = [], retries = 3, delay = 2000) {
//   return new Promise((resolve, reject) => {
//     const attempt = (remaining) => {
//       db.query(query, values, (err, result) => {
//         if (err) {
//           if (remaining <= 1) return reject(err);
//           return setTimeout(() => attempt(remaining - 1), delay);
//         }
//         resolve(result);
//       });
//     };
//     attempt(retries);
//   });
// }

// async function computeDailySummary() {
//   const startOfDay = moment().subtract(1, 'day').startOf('day').format('YYYY-MM-DD HH:mm:ss');
//   const endOfDay = moment().subtract(1, 'day').endOf('day').format('YYYY-MM-DD HH:mm:ss');
//   const dayLabel = moment(startOfDay).format('dddd');

//   console.log(`\n📅 Starting daily summary aggregation for: ${dayLabel}`);

//   try {
//     const devices = await retryQuery('SELECT DISTINCT device_id FROM device_data');

//     for (const { device_id } of devices) {
//       const query = `
//         SELECT kwh, kvah, power_factor FROM device_data
//         WHERE device_id = ? AND timestamp_utc BETWEEN ? AND ?
//       `;

//       const rows = await retryQuery(query, [device_id, startOfDay, endOfDay]);

//       if (rows.length === 0) {
//         console.warn(`[WARN] No data for ${device_id} on ${dayLabel}`);
//         continue;
//       }

//       const avg_kwh = parseFloat((rows.reduce((sum, r) => sum + (r.kwh || 0), 0) / rows.length).toFixed(2));
//       const avg_kvah = parseFloat((rows.reduce((sum, r) => sum + (r.kvah || 0), 0) / rows.length).toFixed(2));
//       const avg_pf = parseFloat((rows.reduce((sum, r) => sum + (r.power_factor || 0), 0) / rows.length).toFixed(3));

//       const insertQuery = `
//         INSERT INTO device_data_daily_summary (device_id, date, weekday, avg_kwh, avg_kvah, avg_power_factor, created_at)
//         VALUES (?, ?, ?, ?, ?, ?, NOW())
//       `;

//       await retryQuery(insertQuery, [device_id, startOfDay.split(' ')[0], dayLabel, avg_kwh, avg_kvah, avg_pf]);
//       console.log(`✅ Stored daily summary for ${device_id} on ${dayLabel}`);
//     }
//   } catch (err) {
//     console.error('[FATAL] Daily aggregation failed:', err.message);
//   }
// }

// // Run at 00:10 every day
// cron.schedule('10 0 * * *', () => {
//   console.log('\n⏰ Running daily summary aggregation...');
//   computeDailySummary();
// });

// // if (require.main === module) {
// //   console.log('\n⚡ Manual test run of daily summary aggregation');
// //   computeDailySummary();
// // }

// module.exports = { computeDailySummary };


// File: cronjobs/dailySummaryJob.js

require('dotenv').config();
const cron = require('node-cron');
const db = require('./models/db');
const moment = require('moment-timezone');

// Retry wrapper
function retryQuery(query, values = [], retries = 3, delay = 2000) {
  return new Promise((resolve, reject) => {
    const attempt = (remaining) => {
      db.query(query, values, (err, result) => {
        if (err) {
          if (remaining <= 1) return reject(err);
          return setTimeout(() => attempt(remaining - 1), delay);
        }
        resolve(result);
      });
    };
    attempt(retries);
  });
}

async function computeDailySummary() {
  // Use IST time zone explicitly
  const istNow = moment().tz('Asia/Kolkata');
  const startOfDay = istNow.clone().subtract(1, 'day').startOf('day').format('YYYY-MM-DD HH:mm:ss');
  const endOfDay = istNow.clone().subtract(1, 'day').endOf('day').format('YYYY-MM-DD HH:mm:ss');
  const dayLabel = moment(startOfDay).tz('Asia/Kolkata').format('dddd');

  console.log(`\n📅 Starting daily summary aggregation for: ${dayLabel} (${startOfDay} → ${endOfDay})`);

  try {
    const devices = await retryQuery('SELECT DISTINCT device_id FROM device_data');

    for (const { device_id } of devices) {
      const query = `
        SELECT kwh, kvah, power_factor FROM device_data
        WHERE device_id = ? AND timestamp_utc BETWEEN ? AND ?
      `;

      const rows = await retryQuery(query, [device_id, startOfDay, endOfDay]);

      if (rows.length === 0) {
        console.warn(`[WARN] No data found for ${device_id} on ${dayLabel}`);
        continue;
      }

      const avg_kwh = parseFloat((rows.reduce((sum, r) => sum + (r.kwh || 0), 0) / rows.length).toFixed(2));
      const avg_kvah = parseFloat((rows.reduce((sum, r) => sum + (r.kvah || 0), 0) / rows.length).toFixed(2));
      const avg_pf = parseFloat((rows.reduce((sum, r) => sum + (r.power_factor || 0), 0) / rows.length).toFixed(3));

      const insertQuery = `
        INSERT INTO device_data_daily_summary 
        (device_id, date, weekday, avg_kwh, avg_kvah, avg_power_factor, created_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
      `;

      await retryQuery(insertQuery, [
        device_id,
        startOfDay.split(' ')[0], // YYYY-MM-DD
        dayLabel,
        avg_kwh,
        avg_kvah,
        avg_pf
      ]);

      console.log(`✅ Stored daily summary for ${device_id} on ${dayLabel}`);
    }
  } catch (err) {
    console.error('[FATAL] Daily aggregation failed:', err.message);
  }
}

// Run at 12:10 AM IST daily
cron.schedule('40 18 * * *', () => {
  // Why 18:40 UTC? Because IST = UTC + 5:30
  console.log('\n⏰ Cron triggered for daily summary at 12:10 AM IST');
  computeDailySummary();
});

module.exports = { computeDailySummary };
