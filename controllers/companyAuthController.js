// controllers/companyAuthController.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getCompanyByUsername } = require('../models/companyModel');
require('dotenv').config();

exports.loginCompany = async (req, res) => {
    try {
        const { username, password } = req.body;

        const company = await getCompanyByUsername(username);
        if (!company) return res.status(404).json({ message: 'Company not found' });

        if (company.company_status !== 'active') {
            return res.status(403).json({ message: 'Company is not active' });
        }

        const isMatch = await bcrypt.compare(password, company.company_password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid password' });

        const token = jwt.sign(
            { company_id: company.company_id, role: 'company' },
            process.env.JWT_SECRET
        );

        res.status(200).json({
            message: 'Login successful',
            token,
            role: 'company'
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};
