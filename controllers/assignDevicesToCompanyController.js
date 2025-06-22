const db = require('../models/db');

// Assign unassigned devices directly to a company
exports.assignDevicesToCompany = async (req, res) => {
  const { company_id } = req.params;
  const { device_ids } = req.body;

  if (!company_id || !Array.isArray(device_ids) || device_ids.length === 0) {
    return res.status(400).json({ error: 'company_id and device_ids[] are required' });
  }

  try {
    // Validate company exists
    const [company] = await new Promise((resolve, reject) => {
      db.query('SELECT * FROM companies WHERE company_id = ?', [company_id], (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const assigned = [];
    const alreadyAssigned = [];

    for (const device_id of device_ids) {
      // Check if the device is unassigned
      const [device] = await new Promise((resolve, reject) => {
        db.query('SELECT company_id FROM devices WHERE device_id = ?', [device_id], (err, results) => {
          if (err) return reject(err);
          resolve(results);
        });
      });

      if (!device) {
        alreadyAssigned.push({ device_id, reason: 'Device not found' });
        continue;
      }

      if (device.company_id) {
        alreadyAssigned.push({ device_id, reason: `Already assigned to company ${device.company_id}` });
        continue;
      }

      // Assign the device to this company
      await new Promise((resolve, reject) => {
        db.query(
          'UPDATE devices SET company_id = ?, collection_id = NULL WHERE device_id = ?',
          [company_id, device_id],
          (err) => {
            if (err) return reject(err);
            resolve();
          }
        );
      });

      assigned.push(device_id);
    }

    return res.status(200).json({
      message: 'Device assignment completed',
      company_id,
      assigned_devices: assigned,
      skipped_devices: alreadyAssigned
    });

  } catch (err) {
    console.error('❌ Error during assignment:', err.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
