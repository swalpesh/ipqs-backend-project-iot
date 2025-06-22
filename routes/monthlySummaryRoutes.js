const express = require('express');
const router = express.Router();
const monthlySummaryController = require('../controllers/monthlySummaryController');
const { verifyAdminOrCompany } = require('../middlewares/adminOrCompanyMiddleware');

router.get('/monthly/device/:device_id', verifyAdminOrCompany, monthlySummaryController.getYearlyMonthlySummary);

module.exports = router;
