// require('dotenv').config();
// const cron = require('node-cron');
// const db = require('./models/db');
// const moment = require('moment');
// const axios = require('axios');
// const nodemailer = require('nodemailer');

// // Email config
// const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: process.env.EMAIL_USER,   // your Gmail
//     pass: process.env.EMAIL_PASS    // your Gmail app password
//   }
// });

// // Retry DB query function
// function retryQuery(query, values = [], retries = 3, delay = 2000) {
//   return new Promise((resolve, reject) => {
//     const attempt = (remaining) => {
//       db.query(query, values, (err, result) => {
//         if (err) {
//           if (remaining <= 1) return reject(err);
//           setTimeout(() => attempt(remaining - 1), delay);
//         } else {
//           resolve(result);
//         }
//       });
//     };
//     attempt(retries);
//   });
// }

// async function computeHourlyAggregation() {
//   const currentTime = moment().startOf('hour');
//   const targetHour = moment(currentTime).subtract(1, 'hour');
//   const targetHourStr = targetHour.format('YYYY-MM-DD HH:00:00');

//   const fromCurrent = moment(targetHour).add(1, 'minute').format('YYYY-MM-DD HH:mm:ss');
//   const toCurrent = moment(targetHour).add(1, 'hour').format('YYYY-MM-DD HH:mm:ss');

//   const fromPrevious = moment(fromCurrent).subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss');
//   const toPrevious = moment(toCurrent).subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss');

//   console.log(`\n⏰ Running aggregation for hour: ${targetHourStr}`);

//   // 1. Fetch PF ranges
//   let pfRanges = {};
//   try {
//     const response = await axios.get('http://31.97.9.220:3000/api/admin/devices/pf-ranges');
//     for (const device of response.data.devices) {
//       pfRanges[device.device_id] = {
//         min: parseFloat(device.min_pf),
//         max: parseFloat(device.max_pf)
//       };
//     }
//   } catch (err) {
//     console.error('❌ PF range fetch failed:', err.message);
//     return;
//   }

//   // 2. Get all device IDs
//   let devices = [];
//   try {
//     devices = await retryQuery('SELECT DISTINCT device_id FROM device_data');
//   } catch (err) {
//     console.error('❌ Device fetch failed:', err.message);
//     return;
//   }

//   for (const { device_id } of devices) {
//     try {
//       const dataQuery = `
//         SELECT * FROM device_data 
//         WHERE device_id = ? AND timestamp_utc BETWEEN ? AND ? 
//         ORDER BY timestamp_utc ASC
//       `;

//       const currentRows = await retryQuery(dataQuery, [device_id, fromCurrent, toCurrent]);
//       if (currentRows.length === 0) continue;

//       const lastCurrent = currentRows[currentRows.length - 1];
//       const current_power_factor = parseFloat(lastCurrent.power_factor?.toFixed(3)) || 0;
//       const current_kvar = parseFloat(lastCurrent.kvar?.toFixed(1)) || 0;

//       const prevRows = await retryQuery(dataQuery, [device_id, fromPrevious, toPrevious]);
//       const lastPrev = prevRows.length > 0 ? prevRows[prevRows.length - 1] : {};

//       const kwh_diff = parseFloat(((lastCurrent.kwh || 0) - (lastPrev.kwh || 0)).toFixed(1));
//       const kvah_diff = parseFloat(((lastCurrent.kvah || 0) - (lastPrev.kvah || 0)).toFixed(1));
//       const kvarh_lag_diff = parseFloat(((lastCurrent.kvarhlag || 0) - (lastPrev.kvarhlag || 0)).toFixed(1));
//       const kvarh_lead_diff = parseFloat(((lastCurrent.kvarhlead || 0) - (lastPrev.kvarhlead || 0)).toFixed(1));

//       const calculated_pf = kvah_diff !== 0 ? parseFloat((kwh_diff / kvah_diff).toFixed(3)) : 0;

//       const insertValues = [
//         device_id,
//         targetHourStr,
//         targetHourStr,
//         current_power_factor,
//         current_kvar,
//         lastPrev.kwh || 0, lastCurrent.kwh || 0, kwh_diff,
//         lastPrev.kvah || 0, lastCurrent.kvah || 0, kvah_diff,
//         lastPrev.kvarhlag || 0, lastCurrent.kvarhlag || 0, kvarh_lag_diff,
//         lastPrev.kvarhlead || 0, lastCurrent.kvarhlead || 0, kvarh_lead_diff,
//         calculated_pf
//       ];

//       const insertQuery = `
//         INSERT INTO device_data_hourly (
//           device_id, hour, timestamp_utc, running_power_factor, running_kvar_total,
//           kwh_prev, kwh_now, kwh_diff,
//           kvah_prev, kvah_now, kvah_diff,
//           kvarh_lag_prev, kvarh_lag_now, kvarh_lag_diff,
//           kvarh_lead_prev, kvarh_lead_now, kvarh_lead_diff,
//           calculated_pf, created_at
//         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
//       `;
//       await retryQuery(insertQuery, insertValues);
//       console.log(`✅ Stored hourly data for ${device_id}`);

//       // 3. Check PF range and trigger alerts
//       const pfLimit = pfRanges[device_id];
//       if (pfLimit && (calculated_pf < pfLimit.min || calculated_pf > pfLimit.max)) {
//         const alertInsert = insertQuery.replace('device_data_hourly', 'alerts');
//         await retryQuery(alertInsert, insertValues);
//         console.warn(`🚨 Alert stored for ${device_id} - PF out of range`);

//         // 4. Fetch company ID and email
//         const [{ company_id }] = await retryQuery('SELECT company_id FROM devices WHERE device_id = ?', [device_id]);
//         const [{ company_email }] = await retryQuery('SELECT company_email FROM companies WHERE company_id = ?', [company_id]);

//         // 5. Email to company
//         await transporter.sendMail({
//           from: process.env.EMAIL_USER,
//           to: company_email,
//           subject: 'IPQS Alert - Power Factor Issue',
//           text: `Welcome to IPQS Private Limited.\nThere is an alert for your device power factor issue (${device_id}). Please note.\n\n- IPQS Team`
//         });

//         // 6. Email to admin
//         await transporter.sendMail({
//           from: process.env.EMAIL_USER,
//           to: process.env.ADMIN_EMAIL,
//           subject: 'IPQS Alert - Device Issue Triggered',
//           text: `Welcome to IPQS Private Limited.\nThere is an alert for device (${device_id}) with power factor outside allowed range. Contact IPQS.\n\n- IPQS Team`
//         });
//       }
//     } catch (err) {
//       console.error(`[ERROR] Device ${device_id} failed: ${err.message}`);
//     }
//   }
// }

// // Schedule every hour
// cron.schedule('0 * * * *', () => {
//   console.log('\n🕒 Hourly cron triggered');
//   computeHourlyAggregation();
// });

// // if (require.main === module) {
// //   console.log('\n⚡ Manual test run of hourly aggregation');
// //   computeHourlyAggregation();
// // }

// module.exports = { computeHourlyAggregation };

// version 2 


// require('dotenv').config();
// const cron = require('node-cron');
// const db = require('./models/db');
// const moment = require('moment-timezone'); // use moment-timezone
// const axios = require('axios');
// const nodemailer = require('nodemailer');

// // Email config
// const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS
//   }
// });

// // Retry wrapper
// function retryQuery(query, values = [], retries = 3, delay = 2000) {
//   return new Promise((resolve, reject) => {
//     const attempt = (remaining) => {
//       db.query(query, values, (err, result) => {
//         if (err) {
//           if (remaining <= 1) return reject(err);
//           setTimeout(() => attempt(remaining - 1), delay);
//         } else {
//           resolve(result);
//         }
//       });
//     };
//     attempt(retries);
//   });
// }

// async function computeHourlyAggregation() {
//   // Use IST time throughout
//   const currentTime = moment().tz('Asia/Kolkata').startOf('hour');
//   const targetHour = moment(currentTime).subtract(1, 'hour');
//   const targetHourStr = targetHour.format('YYYY-MM-DD HH:00:00');

//   const fromCurrent = moment(targetHour).add(1, 'minute').format('YYYY-MM-DD HH:mm:ss');
//   const toCurrent = moment(targetHour).add(1, 'hour').format('YYYY-MM-DD HH:mm:ss');

//   const fromPrevious = moment(fromCurrent).subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss');
//   const toPrevious = moment(toCurrent).subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss');

//   console.log(`\n⏰ Running aggregation for hour (IST): ${targetHourStr}`);

//   // Step 1: Fetch PF ranges
//   let pfRanges = {};
//   try {
//     const response = await axios.get('http://31.97.9.220:3000/api/admin/devices/pf-ranges');
//     for (const device of response.data.devices) {
//       pfRanges[device.device_id] = {
//         min: parseFloat(device.min_pf),
//         max: parseFloat(device.max_pf)
//       };
//     }
//   } catch (err) {
//     console.error('❌ PF range fetch failed:', err.message);
//     return;
//   }

//   // Step 2: Get all device IDs
//   let devices = [];
//   try {
//     devices = await retryQuery('SELECT DISTINCT device_id FROM device_data');
//   } catch (err) {
//     console.error('❌ Device fetch failed:', err.message);
//     return;
//   }

//   for (const { device_id } of devices) {
//     try {
//       const dataQuery = `
//         SELECT * FROM device_data 
//         WHERE device_id = ? AND timestamp_utc BETWEEN ? AND ? 
//         ORDER BY timestamp_utc ASC
//       `;

//       const currentRows = await retryQuery(dataQuery, [device_id, fromCurrent, toCurrent]);
//       if (currentRows.length === 0) continue;

//       const lastCurrent = currentRows[currentRows.length - 1];
//       const current_power_factor = parseFloat(lastCurrent.power_factor?.toFixed(3)) || 0;
//       const current_kvar = parseFloat(lastCurrent.kvar?.toFixed(1)) || 0;

//       const prevRows = await retryQuery(dataQuery, [device_id, fromPrevious, toPrevious]);
//       const lastPrev = prevRows.length > 0 ? prevRows[prevRows.length - 1] : {};

//       const kwh_diff = parseFloat(((lastCurrent.kwh || 0) - (lastPrev.kwh || 0)).toFixed(1));
//       const kvah_diff = parseFloat(((lastCurrent.kvah || 0) - (lastPrev.kvah || 0)).toFixed(1));
//       const kvarh_lag_diff = parseFloat(((lastCurrent.kvarhlag || 0) - (lastPrev.kvarhlag || 0)).toFixed(1));
//       const kvarh_lead_diff = parseFloat(((lastCurrent.kvarhlead || 0) - (lastPrev.kvarhlead || 0)).toFixed(1));

//       const calculated_pf = kvah_diff !== 0 ? parseFloat((kwh_diff / kvah_diff).toFixed(3)) : 0;

//       const insertValues = [
//         device_id,
//         targetHourStr,
//         targetHourStr,
//         current_power_factor,
//         current_kvar,
//         lastPrev.kwh || 0, lastCurrent.kwh || 0, kwh_diff,
//         lastPrev.kvah || 0, lastCurrent.kvah || 0, kvah_diff,
//         lastPrev.kvarhlag || 0, lastCurrent.kvarhlag || 0, kvarh_lag_diff,
//         lastPrev.kvarhlead || 0, lastCurrent.kvarhlead || 0, kvarh_lead_diff,
//         calculated_pf
//       ];

//       const insertQuery = `
//         INSERT INTO device_data_hourly (
//           device_id, hour, timestamp_utc, running_power_factor, running_kvar_total,
//           kwh_prev, kwh_now, kwh_diff,
//           kvah_prev, kvah_now, kvah_diff,
//           kvarh_lag_prev, kvarh_lag_now, kvarh_lag_diff,
//           kvarh_lead_prev, kvarh_lead_now, kvarh_lead_diff,
//           calculated_pf, created_at
//         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
//       `;

//       await retryQuery(insertQuery, insertValues);
//       console.log(`✅ Stored hourly data for ${device_id}`);

//       // Step 3: PF alert handling
//       const pfLimit = pfRanges[device_id];
//       if (pfLimit && (calculated_pf < pfLimit.min || calculated_pf > pfLimit.max)) {
//         const alertInsert = insertQuery.replace('device_data_hourly', 'alerts');
//         await retryQuery(alertInsert, insertValues);
//         console.warn(`🚨 Alert stored for ${device_id} - PF out of range`);

//         // Step 4: Get email
//         const [{ company_id }] = await retryQuery('SELECT company_id FROM devices WHERE device_id = ?', [device_id]);
//         const [{ company_email }] = await retryQuery('SELECT company_email FROM companies WHERE company_id = ?', [company_id]);

//         // Step 5: Send email
//         await transporter.sendMail({
//           from: process.env.EMAIL_USER,
//           to: company_email,
//           subject: 'IPQS Alert - Power Factor Issue',
//           text: `Welcome to IPQS Private Limited.\nThere is an alert for your device power factor issue (${device_id}). Please note.\n\n- IPQS Team`
//         });

//         await transporter.sendMail({
//           from: process.env.EMAIL_USER,
//           to: process.env.ADMIN_EMAIL,
//           subject: 'IPQS Alert - Device Issue Triggered',
//           text: `Welcome to IPQS Private Limited.\nThere is an alert for device (${device_id}) with power factor outside allowed range. Contact IPQS.\n\n- IPQS Team`
//         });
//       }

//     } catch (err) {
//       console.error(`[ERROR] Device ${device_id} failed: ${err.message}`);
//     }
//   }
// }

// // Schedule every hour
// cron.schedule('0 * * * *', () => {
//   console.log('\n🕒 Hourly cron triggered');
//   computeHourlyAggregation();
// });

// module.exports = { computeHourlyAggregation };


// version 3 
require('dotenv').config();
const cron = require('node-cron');
const db = require('./models/db');
const moment = require('moment-timezone');
const axios = require('axios');
const nodemailer = require('nodemailer');

// Email Config
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// MSG91 Config
const msg91AuthKey = process.env.MSG91_AUTH_KEY;
const senderId = process.env.SENDER_ID || "IPQSAL";
const adminPhoneNumber = process.env.ADMIN_PHONE_NUMBER;

// Retry DB Query with Retry Logic
function retryQuery(query, values = [], retries = 3, delay = 2000) {
  return new Promise((resolve, reject) => {
    const attempt = (remaining) => {
      db.query(query, values, (err, result) => {
        if (err) {
          if (remaining <= 1) return reject(err);
          setTimeout(() => attempt(remaining - 1), delay);
        } else {
          resolve(result);
        }
      });
    };
    attempt(retries);
  });
}

// MSG91 SMS Sender
async function sendSMS(toPhoneNumber, message) {
  const payload = {
    sender: senderId,
    route: "4",
    country: "91",
    sms: [{ message, to: [toPhoneNumber] }]
  };

  try {
    await axios.post('https://control.msg91.com/api/v2/sendsms', payload, {
      headers: {
        authkey: msg91AuthKey,
        'Content-Type': 'application/json'
      }
    });
    console.log(`📩 SMS sent to ${toPhoneNumber}`);
  } catch (error) {
    console.error(`❌ Failed to send SMS to ${toPhoneNumber}:`, error.message);
  }
}

async function computeHourlyAggregation() {
  const currentTime = moment().tz('Asia/Kolkata').startOf('hour');
  const targetHour = moment(currentTime).subtract(1, 'hour');
  const targetHourStr = targetHour.format('YYYY-MM-DD HH:00:00');

  const fromCurrent = moment(targetHour).add(1, 'minute').format('YYYY-MM-DD HH:mm:ss');
  const toCurrent = moment(targetHour).add(1, 'hour').format('YYYY-MM-DD HH:mm:ss');
  const fromPrevious = moment(fromCurrent).subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss');
  const toPrevious = moment(toCurrent).subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss');

  console.log(`\n⏰ Running aggregation for hour (IST): ${targetHourStr}`);

  // Fetch PF ranges
  let pfRanges = {};
  try {
    const response = await axios.get('https://ipqsoms.com/api/admin/devices/pf-ranges');
    for (const device of response.data.devices) {
      pfRanges[device.device_id] = {
        min: parseFloat(device.min_pf),
        max: parseFloat(device.max_pf)
      };
    }
  } catch (err) {
    console.error('❌ PF range fetch failed:', err.message);
    return;
  }

  // Fetch all devices
  let devices = [];
  try {
    devices = await retryQuery('SELECT DISTINCT device_id FROM device_data');
  } catch (err) {
    console.error('❌ Device fetch failed:', err.message);
    return;
  }

  for (const { device_id } of devices) {
    try {
      const dataQuery = `
        SELECT * FROM device_data 
        WHERE device_id = ? AND timestamp_utc BETWEEN ? AND ? 
        ORDER BY timestamp_utc ASC
      `;

      const currentRows = await retryQuery(dataQuery, [device_id, fromCurrent, toCurrent]);
      if (currentRows.length === 0) continue;

      const lastCurrent = currentRows[currentRows.length - 1];
      const current_power_factor = parseFloat(lastCurrent.power_factor?.toFixed(3)) || 0;
      const current_kvar = parseFloat(lastCurrent.kvar?.toFixed(1)) || 0;

      const prevRows = await retryQuery(dataQuery, [device_id, fromPrevious, toPrevious]);
      const lastPrev = prevRows.length > 0 ? prevRows[prevRows.length - 1] : {};

      const kwh_diff = parseFloat(((lastCurrent.kwh || 0) - (lastPrev.kwh || 0)).toFixed(1));
      const kvah_diff = parseFloat(((lastCurrent.kvah || 0) - (lastPrev.kvah || 0)).toFixed(1));
      const kvarh_lag_diff = parseFloat(((lastCurrent.kvarhlag || 0) - (lastPrev.kvarhlag || 0)).toFixed(1));
      const kvarh_lead_diff = parseFloat(((lastCurrent.kvarhlead || 0) - (lastPrev.kvarhlead || 0)).toFixed(1));
      const calculated_pf = kvah_diff !== 0 ? parseFloat((kwh_diff / kvah_diff).toFixed(3)) : 0;

      const insertValues = [
        device_id,
        targetHourStr,
        targetHourStr,
        current_power_factor,
        current_kvar,
        lastPrev.kwh || 0, lastCurrent.kwh || 0, kwh_diff,
        lastPrev.kvah || 0, lastCurrent.kvah || 0, kvah_diff,
        lastPrev.kvarhlag || 0, lastCurrent.kvarhlag || 0, kvarh_lag_diff,
        lastPrev.kvarhlead || 0, lastCurrent.kvarhlead || 0, kvarh_lead_diff,
        calculated_pf
      ];

      const insertQuery = `
        INSERT INTO device_data_hourly (
          device_id, hour, timestamp_utc, running_power_factor, running_kvar_total,
          kwh_prev, kwh_now, kwh_diff,
          kvah_prev, kvah_now, kvah_diff,
          kvarh_lag_prev, kvarh_lag_now, kvarh_lag_diff,
          kvarh_lead_prev, kvarh_lead_now, kvarh_lead_diff,
          calculated_pf, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `;
      await retryQuery(insertQuery, insertValues);
      console.log(`✅ Stored hourly data for ${device_id}`);

      const pfLimit = pfRanges[device_id];
      if (pfLimit && (calculated_pf < pfLimit.min || calculated_pf > pfLimit.max)) {
        // Insert Alert with type = 'hourly'
        const alertInsertQuery = `
          INSERT INTO alerts (
            device_id, hour, timestamp_utc, running_power_factor, running_kvar_total,
            kwh_prev, kwh_now, kwh_diff,
            kvah_prev, kvah_now, kvah_diff,
            kvarh_lag_prev, kvarh_lag_now, kvarh_lag_diff,
            kvarh_lead_prev, kvarh_lead_now, kvarh_lead_diff,
            calculated_pf, created_at, type
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'hourly')
        `;
        await retryQuery(alertInsertQuery, insertValues);
        console.warn(`🚨 Alert stored for ${device_id} - PF out of range`);

        const [{ company_id }] = await retryQuery('SELECT company_id FROM devices WHERE device_id = ?', [device_id]);
        const [{ company_name, company_email, company_phone }] = await retryQuery(
          'SELECT company_name, company_email, company_phone FROM companies WHERE company_id = ?',
          [company_id]
        );

        const alertMsg = `Alert: [${company_name}] Device ${device_id} PF (${calculated_pf}) is outside range.\n- IPQS TEAM`;

        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: company_email,
          subject: 'IPQS Alert - Power Factor Issue',
          text: alertMsg
        });
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: process.env.ADMIN_EMAIL,
          subject: 'IPQS Alert - Device Issue Triggered',
          text: alertMsg
        });

        if (company_phone && company_phone.startsWith('+91')) {
          await sendSMS(company_phone.replace('+91', ''), alertMsg);
        }

        if (adminPhoneNumber && adminPhoneNumber.startsWith('+91')) {
          await sendSMS(adminPhoneNumber.replace('+91', ''), alertMsg);
        }
      }

    } catch (err) {
      console.error(`[ERROR] Device ${device_id} failed: ${err.message}`);
    }
  }
}

// Uncomment to schedule hourly
// cron.schedule('0 * * * *', () => {
//   console.log('\n🕒 Hourly cron triggered');
//   computeHourlyAggregation();
// });

// Manual run
if (require.main === module) {
  console.log('\n⚡ Manual test run of hourly aggregation');
  computeHourlyAggregation();
}

module.exports = { computeHourlyAggregation };

// version 4 

// require('dotenv').config();
// const cron = require('node-cron');
// const db = require('./models/db');
// const moment = require('moment-timezone');
// const axios = require('axios');
// const nodemailer = require('nodemailer');

// // Email Config
// const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS
//   }
// });

// // MSG91 Config
// const msg91AuthKey = process.env.MSG91_AUTH_KEY;
// const senderId = process.env.SENDER_ID || "IPQSAL";
// const adminPhoneNumber = process.env.ADMIN_PHONE_NUMBER;

// // Retry wrapper with logs
// function retryQuery(query, values = [], retries = 3, delay = 2000) {
//   return new Promise((resolve, reject) => {
//     const attempt = (remaining) => {
//       console.log(`\n🔁 Executing query (attempts left: ${remaining}):`, query);
//       db.query(query, values, (err, result) => {
//         if (err) {
//           console.error('⛔ Query error:', err);
//           if (remaining <= 1) return reject(err);
//           setTimeout(() => attempt(remaining - 1), delay);
//         } else {
//           resolve(result);
//         }
//       });
//     };
//     attempt(retries);
//   });
// }

// // MSG91 SMS Function
// async function sendSMS(toPhoneNumber, message) {
//   const cleanedPhone = toPhoneNumber.replace('+91', '');
//   const payload = {
//     sender: senderId,
//     route: "4",
//     country: "91",
//     sms: [
//       {
//         message: message,
//         to: [cleanedPhone]
//       }
//     ]
//   };

//   try {
//     const response = await axios.post('https://control.msg91.com/api/v2/sendsms', payload, {
//       headers: {
//         authkey: msg91AuthKey,
//         'Content-Type': 'application/json'
//       }
//     });
//     console.log(`📩 SMS sent to ${toPhoneNumber}`);
//   } catch (error) {
//     console.error(`❌ Failed to send SMS to ${toPhoneNumber}:`, error.message);
//   }
// }

// async function computeHourlyAggregation() {
//   const currentTime = moment().tz('Asia/Kolkata').startOf('hour');
//   const targetHour = moment(currentTime).subtract(1, 'hour');
//   const targetHourStr = targetHour.format('YYYY-MM-DD HH:00:00');

//   const fromCurrent = moment(targetHour).add(1, 'minute').format('YYYY-MM-DD HH:mm:ss');
//   const toCurrent = moment(targetHour).add(1, 'hour').format('YYYY-MM-DD HH:mm:ss');
//   const fromPrevious = moment(fromCurrent).subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss');
//   const toPrevious = moment(toCurrent).subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss');

//   console.log(`\n⏰ Running aggregation for hour (IST): ${targetHourStr}`);

//   let pfRanges = {};
//   try {
//     const response = await axios.get('https://ipqsoms.com/api/admin/devices/pf-ranges');
//     for (const device of response.data.devices) {
//       pfRanges[device.device_id] = {
//         min: parseFloat(device.min_pf),
//         max: parseFloat(device.max_pf)
//       };
//     }
//     console.log('✅ PF ranges fetched successfully');
//   } catch (err) {
//     console.error('❌ PF range fetch failed:', err.message);
//     return;
//   }

//   let devices = [];
//   try {
//     console.log('📥 Fetching device list...');
//     devices = await retryQuery('SELECT DISTINCT device_id FROM device_data');
//     console.log('📦 Device list fetched:', devices.length);
//   } catch (err) {
//     console.error('❌ Device fetch failed:', err.message);
//     return;
//   }

//   for (const { device_id } of devices) {
//     try {
//       const dataQuery = `
//         SELECT * FROM device_data 
//         WHERE device_id = ? AND timestamp_utc BETWEEN ? AND ? 
//         ORDER BY timestamp_utc ASC
//       `;

//       const currentRows = await retryQuery(dataQuery, [device_id, fromCurrent, toCurrent]);
//       if (currentRows.length === 0) continue;

//       const lastCurrent = currentRows[currentRows.length - 1];
//       const current_power_factor = parseFloat(lastCurrent.power_factor?.toFixed(3)) || 0;
//       const current_kvar = parseFloat(lastCurrent.kvar?.toFixed(1)) || 0;

//       const prevRows = await retryQuery(dataQuery, [device_id, fromPrevious, toPrevious]);
//       const lastPrev = prevRows.length > 0 ? prevRows[prevRows.length - 1] : {};

//       const kwh_diff = parseFloat(((lastCurrent.kwh || 0) - (lastPrev.kwh || 0)).toFixed(1));
//       const kvah_diff = parseFloat(((lastCurrent.kvah || 0) - (lastPrev.kvah || 0)).toFixed(1));
//       const kvarh_lag_diff = parseFloat(((lastCurrent.kvarhlag || 0) - (lastPrev.kvarhlag || 0)).toFixed(1));
//       const kvarh_lead_diff = parseFloat(((lastCurrent.kvarhlead || 0) - (lastPrev.kvarhlead || 0)).toFixed(1));
//       const calculated_pf = kvah_diff !== 0 ? parseFloat((kwh_diff / kvah_diff).toFixed(3)) : 0;

//       const insertValues = [
//         device_id,
//         targetHourStr,
//         targetHourStr,
//         current_power_factor,
//         current_kvar,
//         lastPrev.kwh || 0, lastCurrent.kwh || 0, kwh_diff,
//         lastPrev.kvah || 0, lastCurrent.kvah || 0, kvah_diff,
//         lastPrev.kvarhlag || 0, lastCurrent.kvarhlag || 0, kvarh_lag_diff,
//         lastPrev.kvarhlead || 0, lastCurrent.kvarhlead || 0, kvarh_lead_diff,
//         calculated_pf
//       ];

//       const insertQuery = `
//         INSERT INTO device_data_hourly (
//           device_id, hour, timestamp_utc, running_power_factor, running_kvar_total,
//           kwh_prev, kwh_now, kwh_diff,
//           kvah_prev, kvah_now, kvah_diff,
//           kvarh_lag_prev, kvarh_lag_now, kvarh_lag_diff,
//           kvarh_lead_prev, kvarh_lead_now, kvarh_lead_diff,
//           calculated_pf, created_at
//         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
//       `;
//       await retryQuery(insertQuery, insertValues);
//       console.log(`✅ Stored hourly data for ${device_id}`);

//       const pfLimit = pfRanges[device_id];
//       if (pfLimit && (calculated_pf < pfLimit.min || calculated_pf > pfLimit.max)) {
//         const alertInsert = insertQuery.replace('device_data_hourly', 'alerts');
//         await retryQuery(alertInsert, insertValues);
//         console.warn(`🚨 Alert stored for ${device_id} - PF out of range`);

//         const [{ company_id }] = await retryQuery('SELECT company_id FROM devices WHERE device_id = ?', [device_id]);
//         const [{ company_name, company_email, company_phone }] = await retryQuery(
//           'SELECT company_name, company_email, company_phone FROM companies WHERE company_id = ?',
//           [company_id]
//         );

//         const alertMsg = `Alert: [${company_name}] Device ${device_id} PF (${calculated_pf}) is outside range.\n- IPQS TEAM`;

//         await transporter.sendMail({
//           from: process.env.EMAIL_USER,
//           to: company_email,
//           subject: 'IPQS Alert - Power Factor Issue',
//           text: alertMsg
//         });
//         await transporter.sendMail({
//           from: process.env.EMAIL_USER,
//           to: process.env.ADMIN_EMAIL,
//           subject: 'IPQS Alert - Device Issue Triggered',
//           text: alertMsg
//         });

//         if (company_phone) {
//           await sendSMS(company_phone, alertMsg);
//         }
//         if (adminPhoneNumber) {
//           await sendSMS(adminPhoneNumber, alertMsg);
//         }
//       }

//     } catch (err) {
//       console.error(`[ERROR] Device ${device_id} failed: ${err.message}`);
//     }
//   }
// }

// if (require.main === module) {
//   console.log('\n⚡ Manual test run of hourly aggregation');
//   computeHourlyAggregation();
// }

// module.exports = { computeHourlyAggregation };
