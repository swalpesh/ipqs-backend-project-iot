const db = require('../models/db');

// Get all active devices not assigned to any company
exports.getUnassignedActiveDevices = async (req, res) => {
  try {
    const devices = await new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM devices
        WHERE status = 'active' AND (company_id IS NULL OR company_id = '')
      `;
      db.query(query, (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    return res.status(200).json({
      message: 'Unassigned active devices retrieved successfully',
      devices
    });

  } catch (err) {
    console.error('❌ Error fetching unassigned active devices:', err.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
