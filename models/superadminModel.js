// models/superadminModel.js
const db = require('./db');
const bcrypt = require('bcryptjs');

const createSuperadmin = async (name, email, password) => {
    const hashedPassword = await bcrypt.hash(password, 10);
    return new Promise((resolve, reject) => {
        const query = 'INSERT INTO superadmins (name, email, password) VALUES (?, ?, ?)';
        db.query(query, [name, email, hashedPassword], (err, result) => {
            if (err) reject(err);
            resolve(result);
        });
    });
};

const findSuperadminByEmail = (email) => {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM superadmins WHERE email = ?';
        db.query(query, [email], (err, results) => {
            if (err) reject(err);
            resolve(results[0]);
        });
    });
};

module.exports = {
    createSuperadmin,
    findSuperadminByEmail
};
