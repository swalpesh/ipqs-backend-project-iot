const twilio = require('twilio');
require('dotenv').config();

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function sendSMSAlert(toPhoneNumber, message) {
  try {
    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: toPhoneNumber,
    });

    console.log(`📩 SMS sent successfully to ${toPhoneNumber}: SID=${result.sid}`);
    return result.sid;
  } catch (err) {
    console.error(`❌ Failed to send SMS: ${err.message}`);
    throw err;
  }
}

module.exports = sendSMSAlert;
