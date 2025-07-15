const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyAdmin } = require('../middlewares/adminAuthMiddleware');
const { getAdminDashboard, getAllCompaniesWithCount, getAllDevicesWithCompany, getDevicesByCompanyId, getCompaniesWithDeviceCount, setDevicePFRange, getPFRangeByDeviceId, getAllPFRanges } = require('../controllers/adminController');
const { verifyAdminOrCompany } = require('../middlewares/adminOrCompanyMiddleware');
const { getHourlyDataByDate } = require('../controllers/getHourlyDataByDate');

// Register and Login
router.post('/register', adminController.registerAdmin);
router.post('/login', adminController.loginAdmin);

// Example protected route
router.get('/dashboard', verifyAdmin, getAdminDashboard);
router.get('/companies', verifyAdmin, getAllCompaniesWithCount);
router.get('/devices', verifyAdmin, getAllDevicesWithCompany);
router.get('/devices/company/:company_id', verifyAdminOrCompany, getDevicesByCompanyId);
router.get('/companies/devices', verifyAdmin, getCompaniesWithDeviceCount);
router.patch('/devices/:device_id/set-pf-range', verifyAdmin, setDevicePFRange);
router.get('/devices/:device_id/pf-range', verifyAdmin, getPFRangeByDeviceId);
router.get('/devices/pf-ranges', getAllPFRanges);
router.get('/device/hourly-data',verifyAdmin, getHourlyDataByDate);




module.exports = router;
