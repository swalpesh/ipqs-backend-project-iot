// controllers/deviceController.js
const db = require('../models/db');
const {
    createDevice,
    getAllDevices,
    getDeviceById,
    updateDevice,
    deleteDevice,
    getActiveDevices,
    isDeviceAssignedToCollection
} = require('../models/deviceModel');

exports.createDevice = async (req, res) => {
    try {
        const { device_id, device_name, topic_name, status } = req.body;
        const created_by = req.superadminId;

        const existingDevice = await getDeviceById(device_id, created_by);
        if (existingDevice) return res.status(400).json({ message: 'Device ID already exists' });

        await createDevice(device_id, device_name, topic_name, status, created_by);
        res.status(201).json({ message: 'Device created successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getAllDevices = async (req, res) => {
    try {
        const superadminId = req.superadminId;
        const devices = await getAllDevices(superadminId);
        res.status(200).json({ devices });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getDeviceById = async (req, res) => {
    try {
        const superadminId = req.superadminId;
        const device = await getDeviceById(req.params.device_id, superadminId);
        if (!device) return res.status(404).json({ message: 'Device not found' });

        res.status(200).json({ device });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.updateDevice = async (req, res) => {
    try {
        const { device_name, topic_name, status } = req.body;
        const superadminId = req.superadminId;
        const device_id = req.params.device_id;

        const result = await updateDevice(device_id, device_name, topic_name, status, superadminId);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Device not found or unauthorized' });

        res.status(200).json({ message: 'Device updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.deleteDevice = async (req, res) => {
  try {
    const superadminId = req.superadminId;
    const device_id = req.params.device_id;

    // Step 1: Check if the device is assigned to any company
    const [device] = await new Promise((resolve, reject) => {
      const checkQuery = 'SELECT company_id FROM devices WHERE device_id = ?';
      db.query(checkQuery, [device_id], (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    if (device.company_id) {
      return res.status(400).json({ message: `Cannot delete device. It is assigned to company ${device.company_id}.` });
    }

    // Step 2: Proceed to delete
    const result = await new Promise((resolve, reject) => {
      const deleteQuery = 'DELETE FROM devices WHERE device_id = ? AND created_by = ?';
      db.query(deleteQuery, [device_id, superadminId], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Device not found or unauthorized' });
    }

    return res.status(200).json({ message: 'Device deleted successfully' });

  } catch (error) {
    console.error('❌ Delete device error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};


exports.getActiveDevices = async (req, res) => {
    try {
        const superadminId = req.superadminId;
        const activeDevices = await getActiveDevices(superadminId);
        res.status(200).json({ activeDevices });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
