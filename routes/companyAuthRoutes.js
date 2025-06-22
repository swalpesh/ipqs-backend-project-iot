// routes/companyAuthRoutes.js
const express = require('express');
const router = express.Router();
const { loginCompany } = require('../controllers/companyAuthController');

router.post('/login', loginCompany);

module.exports = router;
