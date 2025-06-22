const express = require('express');
const router = express.Router();
const { markAlertAsRead } = require('../controllers/alertController');
const { markAlertAsReadadmin } = require('../controllers/alertController');
const { verifyCompany } = require('../middlewares/companyAuthMiddleware');
const { verifyAdmin } = require('../middlewares/adminAuthMiddleware');


router.put('/mark-read/:alert_id',verifyCompany, markAlertAsRead);
router.put('/mark-read-admin/:alert_id',verifyAdmin, markAlertAsReadadmin);

module.exports = router;
