// routes/superadminRoutes.js
const express = require('express');
const router = express.Router();
const { registerSuperadmin, loginSuperadmin, getSuperadminDetails } = require('../controllers/superadminController');
const { verifySuperadmin } = require('../middlewares/authMiddleware');
const deviceCommandsController = require('../controllers/deviceCommandsController');
const {assignDevicesToCompany} = require('../controllers/assignDevicesToCompanyController');
const {getUnassignedActiveDevices} = require('../controllers/getUnassignedActiveDevicesController');
const {unassignDevicesFromCompany} = require('../controllers/unassignDevicesFromCompanyController');


router.post('/register', registerSuperadmin);
router.post('/login', loginSuperadmin);
router.get('/dashboard', verifySuperadmin, getSuperadminDetails);
router.post('/devices/:device_id/send-commands',verifySuperadmin, deviceCommandsController.sendBatchedCommands);
router.post('/companies/:company_id/assign-devices',verifySuperadmin, assignDevicesToCompany);
router.get('/devices/unassigned', verifySuperadmin, getUnassignedActiveDevices);
router.post('/companies/:company_id/unassign-devices', verifySuperadmin, unassignDevicesFromCompany);





module.exports = router;
