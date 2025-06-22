// routes/companyRoutes.js
const express = require('express');
const router = express.Router();
const { createCompany,getAllCompanies,
    getCompanyById,
    updateCompany,
    deleteCompany,
    changeCompanyStatus } = require('../controllers/companyController');
const { verifySuperadmin } = require('../middlewares/authMiddleware');



router.post('/', verifySuperadmin, createCompany);
router.get('/', verifySuperadmin, getAllCompanies);
router.get('/:company_id', verifySuperadmin, getCompanyById);
router.put('/:company_id', verifySuperadmin, updateCompany);
router.patch('/:company_id/status', verifySuperadmin, changeCompanyStatus);
router.delete('/:company_id', verifySuperadmin, deleteCompany);



module.exports = router;
