const express = require('express');
const router = express.Router();
const fileUpload = require('express-fileupload');

const { 
  registerSuperadmin,
  loginSuperadmin,
  getSuperadminDetails 
} = require('../controllers/superadminController');

const deviceCommandsController = require('../controllers/deviceCommandsController');
const { verifySuperadmin } = require('../middlewares/authMiddleware');
const { assignDevicesToCompany } = require('../controllers/assignDevicesToCompanyController');
const { getUnassignedActiveDevices } = require('../controllers/getUnassignedActiveDevicesController');
const { unassignDevicesFromCompany } = require('../controllers/unassignDevicesFromCompanyController');
const { getDevicesByCompanyId } = require('../controllers/adminController');
const { uploadFirmwareFile, getFirmwareFiles } = require('../controllers/otaController');
const { broadcastFirmware } = require('../controllers/broadcastFirmwareController');
const deviceSettingsController = require('../controllers/deviceSettingsController');
const companyController = require('../controllers/companyController');


// Enable file upload middleware for routes that need it
router.use(fileUpload());

// Superadmin auth & dashboard
router.post('/register', registerSuperadmin);
router.post('/login', loginSuperadmin);
router.get('/dashboard', verifySuperadmin, getSuperadminDetails);

// Device command publishing
router.post('/devices/:device_id/send-commands', verifySuperadmin, deviceCommandsController.sendBatchedCommands);

// Device assignment
router.post('/companies/:company_id/assign-devices', verifySuperadmin, assignDevicesToCompany);
router.get('/devices/unassigned', verifySuperadmin, getUnassignedActiveDevices);
router.post('/companies/:company_id/unassign-devices', verifySuperadmin, unassignDevicesFromCompany);
router.get('/devices/sadmin/company/:company_id', verifySuperadmin, getDevicesByCompanyId);
router.patch('/companies/:company_id/update-notification-status', verifySuperadmin, companyController.updateNotificationStatus);

// ✅ OTA Firmware upload
router.post('/upload-firmware', verifySuperadmin, uploadFirmwareFile);
router.get('/firmware-files', verifySuperadmin, getFirmwareFiles);
router.post('/broadcast-firmware', verifySuperadmin, broadcastFirmware);
router.post('/devices/settings', verifySuperadmin, deviceSettingsController.storeDeviceSettings);
router.get('/devices/settings/:device_id', verifySuperadmin, deviceSettingsController.getDeviceSettings);




module.exports = router;
