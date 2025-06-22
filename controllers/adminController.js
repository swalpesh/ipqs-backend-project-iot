const db = require('../models/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// REGISTER ADMIN
exports.registerAdmin = async (req, res) => {
    try {
        const { admin_id, admin_name, admin_email, admin_username, admin_password } = req.body;

        const hashedPassword = await bcrypt.hash(admin_password, 10);

        const query = `
            INSERT INTO admins (admin_id, admin_name, admin_email, admin_username, admin_password)
            VALUES (?, ?, ?, ?, ?)
        `;

        const values = [admin_id, admin_name, admin_email, admin_username, hashedPassword];

        db.query(query, values, (err, result) => {
            if (err) {
                console.error('Admin registration error:', err);
                return res.status(500).json({ message: 'Error registering admin' });
            }

            return res.status(201).json({ message: 'Admin registered successfully' });
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// LOGIN ADMIN
exports.loginAdmin = async (req, res) => {
    try {
        const { username, password } = req.body;

        const [admin] = await new Promise((resolve, reject) => {
            const query = 'SELECT * FROM admins WHERE admin_username = ?';
            db.query(query, [username], (err, results) => {
                if (err) reject(err);
                resolve(results);
            });
        });

        if (!admin) return res.status(404).json({ message: 'Admin not found' });

        const isMatch = await bcrypt.compare(password, admin.admin_password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid password' });

        const token = jwt.sign(
            { admin_id: admin.admin_id, role: 'admin' },
            process.env.JWT_SECRET
        );

        res.status(200).json({
            message: 'Login successful',
            token,
            role: 'admin'
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getAdminDashboard = async (req, res) => {
  try {
    const adminId = req.adminId;

    // Fetch admin info from database
    const [admin] = await new Promise((resolve, reject) => {
      db.query('SELECT admin_id, admin_name, admin_email FROM admins WHERE admin_id = ?', [adminId], (err, results) => {
        if (err) reject(err);
        resolve(results);
      });
    });

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    res.status(200).json({
      message: 'Admin dashboard data',
      role: 'admin',
      admin
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// get list of companies 

exports.getAllCompaniesWithCount = async (req, res) => {
  try {
    const companies = await new Promise((resolve, reject) => {
      db.query('SELECT * FROM companies', (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    const count = companies.length;

    res.status(200).json({
      message: 'List of all companies',
      total_companies: count,
      companies,
    });
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// get list of all devicces with the company assigned and its count 

exports.getAllDevicesWithCompany = async (req, res) => {
  try {
    const query = `
      SELECT 
        d.device_id,
        d.device_name,
        d.topic_name,
        d.status,
        d.created_at,
        c.company_id,
        c.company_name
      FROM devices d
      INNER JOIN companies c ON d.company_id = c.company_id
      WHERE d.company_id IS NOT NULL
    `;

    const devices = await new Promise((resolve, reject) => {
      db.query(query, (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    const total_devices = devices.length;

    res.status(200).json({
      message: 'Devices assigned to companies',
      total_devices,
      devices
    });
  } catch (error) {
    console.error('Error fetching assigned devices:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


// show devices by companyid 

exports.getDevicesByCompanyId = async (req, res) => {
  try {
    const { company_id } = req.params;

    const query = `
      SELECT 
        d.device_id,
        d.device_name,
        d.topic_name,
        d.status,
        d.created_at,
        c.company_id,
        c.company_name
      FROM devices d
      LEFT JOIN companies c ON d.company_id = c.company_id
      WHERE d.company_id = ?
    `;

    const devices = await new Promise((resolve, reject) => {
      db.query(query, [company_id], (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    const total_devices = devices.length;

    res.status(200).json({
      message: `Devices for company ID: ${company_id}`,
      total_devices,
      devices
    });
  } catch (error) {
    console.error('Error fetching devices by company ID:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


exports.getCompaniesWithDeviceCount = async (req, res) => {
  try {
    const query = `
      SELECT 
        c.company_id,
        c.company_name,
        c.company_email,
        c.company_phone,
        c.company_status,
        COUNT(d.device_id) AS device_count
      FROM companies c
      LEFT JOIN devices d ON c.company_id = d.company_id
      GROUP BY c.company_id
      ORDER BY c.company_name ASC
    `;

    const companies = await new Promise((resolve, reject) => {
      db.query(query, (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    res.status(200).json({
      message: 'Companies with installed device counts',
      total_companies: companies.length,
      companies
    });
  } catch (error) {
    console.error('Error fetching companies with device count:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.setDevicePFRange = (req, res) => {
  const { device_id } = req.params;
  const { min_pf = 0.999, max_pf = 1.000 } = req.body;

  const query = `
    UPDATE devices
    SET min_pf = ?, max_pf = ?
    WHERE device_id = ?
  `;

  db.query(query, [min_pf, max_pf, device_id], (err, result) => {
    if (err) {
      console.error('Error updating PF range:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Device not found' });
    }

    res.status(200).json({ message: 'Power factor range updated successfully' });
  });
};

exports.getAllPFRanges = (req, res) => {
  const query = `
    SELECT device_id, min_pf, max_pf 
    FROM devices
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching all PF ranges:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    res.status(200).json({ devices: results });
  });
};

exports.getPFRangeByDeviceId = (req, res) => {
  const { device_id } = req.params;

  const query = `
    SELECT device_id, min_pf, max_pf 
    FROM devices 
    WHERE device_id = ?
  `;

  db.query(query, [device_id], (err, results) => {
    if (err) {
      console.error('Error fetching PF range:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'Device not found' });
    }

    res.status(200).json(results[0]);
  });
};
