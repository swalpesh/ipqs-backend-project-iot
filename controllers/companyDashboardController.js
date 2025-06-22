// controllers/companyDashboardController.js
const { getCompanyById } = require('../models/companyModel');

exports.getDashboard = async (req, res) => {
    try {
        const company = await getCompanyById(req.companyId);
        if (!company) return res.status(404).json({ message: 'Company not found' });

        res.status(200).json({
            message: `Welcome to ${company.company_name} dashboard`,
            company
        });
    } catch (err) {
        console.error('Dashboard error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};
