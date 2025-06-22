const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
// const { verifyAdminOrCompany } = require('../middlewares/adminOrCompanyMiddleware');
const { verifyCompany } = require('../middlewares/companyAuthMiddleware');
const { verifyAdmin } = require('../middlewares/adminAuthMiddleware');


router.get('/alerts', verifyCompany, alertController.getAllAlerts);
router.get('/adminalerts', verifyAdmin, alertController.getAllAlertsadmin);
// router.get('/alerts/device/:device_id', verifyAdminOrCompany, alertController.getAlertsByDevice);

module.exports = router;
