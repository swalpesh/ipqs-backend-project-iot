// routes/companyDashboardRoutes.js
const express = require('express');
const router = express.Router();
const { getDashboard } = require('../controllers/companyDashboardController');
const { verifyCompany } = require('../middlewares/companyAuthMiddleware');
const {getCompanyDevices} = require('../controllers/company/deviceController');


router.get('/dashboard', verifyCompany, getDashboard);
router.get('/devices', verifyCompany, getCompanyDevices);

module.exports = router;
