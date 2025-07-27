// models/db.js
const mysql = require('mysql2');
require('dotenv').config();

let db;

function handleDisconnect() {
  db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  db.connect((err) => {
    if (err) {
      console.error('Error connecting to DB:', err.message);
      setTimeout(handleDisconnect, 2000); // Retry after 2 seconds
    } else {
      console.log('Database connected successfully');
    }
  });

  db.on('error', (err) => {
    console.error('DB connection error:', err.message);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.log('Reconnecting to the database...');
      handleDisconnect(); // Reconnect
    } else {
      throw err; // Unknown error, crash the app
    }
  });
}

// Initialize on startup
handleDisconnect();

module.exports = db;
