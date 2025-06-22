// routes/deviceRoutes.js
const express = require('express');
const router = express.Router();
const {
    createDevice,
    getAllDevices,
    getDeviceById,
    updateDevice,
    deleteDevice,
    getActiveDevices
} = require('../controllers/deviceController');
const { verifySuperadmin } = require('../middlewares/authMiddleware');

// CRUD routes for devices
router.post('/', verifySuperadmin, createDevice);
router.get('/', verifySuperadmin, getAllDevices);
router.get('/:device_id', verifySuperadmin, getDeviceById);
router.put('/:device_id', verifySuperadmin, updateDevice);
router.delete('/:device_id', verifySuperadmin, deleteDevice);
router.get('/status/active', verifySuperadmin, getActiveDevices);

module.exports = router;
