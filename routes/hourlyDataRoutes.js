const express = require('express');
const router = express.Router();
const hourlyDataController = require('../controllers/hourlyDataController');
const { verifyAdminOrCompany } = require('../middlewares/adminOrCompanyMiddleware');

router.get(
  '/device/:device_id/date/:date/hour/:hour',
  verifyAdminOrCompany,
  hourlyDataController.getHourlyData
);

router.get(
  '/device/:device_id/date/:date',
  verifyAdminOrCompany,
  hourlyDataController.getDailySummary
);

module.exports = router;
