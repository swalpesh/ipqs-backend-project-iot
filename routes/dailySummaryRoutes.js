const express = require('express');
const router = express.Router();
const summaryController = require('../controllers/dailySummaryController');
const { verifyAdminOrCompany } = require('../middlewares/adminOrCompanyMiddleware');

// Yesterday summary route
router.get('/daily/device/:device_id', verifyAdminOrCompany, summaryController.getYesterdaySummary);

// ✅ Weekly summary route (new)
router.get('/daily/device/:device_id/weekly-summary', verifyAdminOrCompany, summaryController.getWeeklySummary);

module.exports = router;