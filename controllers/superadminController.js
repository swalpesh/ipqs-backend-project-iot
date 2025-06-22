// controllers/superadminController.js
const db = require('../models/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { createSuperadmin, findSuperadminByEmail } = require('../models/superadminModel');
require('dotenv').config();

exports.registerSuperadmin = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const existingUser = await findSuperadminByEmail(email);
        if (existingUser) return res.status(400).json({ message: 'Email already registered' });

        await createSuperadmin(name, email, password);
        res.status(201).json({ message: 'Superadmin registered successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.loginSuperadmin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const superadmin = await findSuperadminByEmail(email);
        if (!superadmin) return res.status(404).json({ message: 'Superadmin not found' });

        const isPasswordValid = await bcrypt.compare(password, superadmin.password);
        if (!isPasswordValid) return res.status(401).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ id: superadmin.id }, process.env.JWT_SECRET, { expiresIn: '2h' });
        res.status(200).json({ message: 'Login successful', token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getSuperadminDetails = (req, res) => {
    const superadminId = req.superadminId;

    const query = 'SELECT id, name, email, created_at FROM superadmins WHERE id = ?';
    db.query(query, [superadminId], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Server error' });
        }
        if (!results[0]) return res.status(404).json({ message: 'Superadmin not found' });

        res.status(200).json({
            message: 'Superadmin Dashboard',
            superadmin: results[0]
        });
    });
};


