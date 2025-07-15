const db = require('../models/db');

exports.getAllAlerts = async (req, res) => {
  const query = `
    SELECT * FROM alerts where user_status = 'unread' and type = 'hourly'
    ORDER BY created_at DESC
  `;

  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    return res.status(200).json(results);
  });
};

exports.getAlertsByDevice = async (req, res) => {
  const { device_id } = req.params;

  const query = `
    SELECT * FROM alerts
    WHERE device_id = ?
    ORDER BY created_at DESC
  `;

  db.query(query, [device_id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    return res.status(200).json(results);
  });
};


exports.markAlertAsRead = async (req, res) => {
  const { alert_id } = req.params;

  try {
    const [result] = await db.promise().query(
      'UPDATE alerts SET user_status = ? WHERE id = ?',
      ['read', alert_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    res.status(200).json({ message: 'Alert marked as read' });
  } catch (err) {
    console.error('Error marking alert as read:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getAllAlertsadmin = async (req, res) => {
  const query = `
    SELECT a.*, d.company_id
    FROM alerts a
    JOIN devices d ON a.device_id = d.device_id
    WHERE a.admin_status = 'unread'
    ORDER BY a.created_at DESC
  `;

  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    return res.status(200).json(results);
  });
};


exports.markAlertAsReadadmin = async (req, res) => {
  const { alert_id } = req.params;

  try {
    const [result] = await db.promise().query(
      'UPDATE alerts SET admin_status = ? WHERE id = ?',
      ['read', alert_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    res.status(200).json({ message: 'Alert marked as read' });
  } catch (err) {
    console.error('Error marking alert as read:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};