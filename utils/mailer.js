const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});



exports.sendAlertEmail = async (to, subject, text) => {
  const mailOptions = {
    from: `"IPQS Private Limited" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent to ${to}`);
  } catch (err) {
    console.error('❌ Email sending failed:', err.message);
  }
};
