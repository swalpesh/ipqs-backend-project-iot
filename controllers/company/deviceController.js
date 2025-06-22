const db = require('../../models/db');

exports.getCompanyDevices = async (req, res) => {
  try {
    const companyId = req.companyId;

    const query = `
      SELECT * FROM devices 
      WHERE company_id = ?`;

    db.query(query, [companyId], (err, results) => {
      if (err) {
        console.error('Error fetching devices:', err);
        return res.status(500).json({ message: 'Server error' });
      }

      res.status(200).json({
        total_devices: results.length,
        devices: results
      });
    });
  } catch (error) {
    console.error('Get company devices error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

