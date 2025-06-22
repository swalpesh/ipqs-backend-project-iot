const db = require('../models/db');

// Unassign devices from a company
exports.unassignDevicesFromCompany = async (req, res) => {
  const { company_id } = req.params;
  const { device_ids } = req.body;

  if (!company_id || !Array.isArray(device_ids) || device_ids.length === 0) {
    return res.status(400).json({ error: 'company_id and device_ids[] are required' });
  }

  try {
    const unassigned = [];
    const skipped = [];

    for (const device_id of device_ids) {
      // Only unassign if currently assigned to this company
      const [device] = await new Promise((resolve, reject) => {
        db.query(
          'SELECT company_id FROM devices WHERE device_id = ?',
          [device_id],
          (err, results) => {
            if (err) return reject(err);
            resolve(results);
          }
        );
      });

      if (!device) {
        skipped.push({ device_id, reason: 'Device not found' });
        continue;
      }

      if (device.company_id !== company_id) {
        skipped.push({ device_id, reason: `Assigned to another company (${device.company_id})` });
        continue;
      }

      // Perform unassignment
      await new Promise((resolve, reject) => {
        db.query(
          'UPDATE devices SET company_id = NULL, collection_id = NULL WHERE device_id = ?',
          [device_id],
          (err) => {
            if (err) return reject(err);
            resolve();
          }
        );
      });

      unassigned.push(device_id);
    }

    return res.status(200).json({
      message: 'Unassignment completed',
      company_id,
      unassigned_devices: unassigned,
      skipped_devices: skipped
    });

  } catch (err) {
    console.error('❌ Error unassigning devices:', err.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
