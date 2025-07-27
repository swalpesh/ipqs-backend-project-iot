const db = require('./db');
const bcrypt = require('bcryptjs');

const createCompany = async (company, superadminId) => {
    const hashedPassword = await bcrypt.hash(company.company_password, 10);
    const query = `
        INSERT INTO companies (
            company_id, company_name, company_address, company_email, company_phone,
            company_city, company_state, company_country, company_username, company_password,
            company_status, created_by, role, created_at, subscription_end
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
        company.company_id,
        company.company_name,
        company.company_address,
        company.company_email,
        company.company_phone,
        company.company_city,
        company.company_state,
        company.company_country,
        company.company_username,
        hashedPassword,
        company.company_status,
        superadminId,
        'company', // fixed value
        company.created_at,
        company.subscription_end
    ];
    return new Promise((resolve, reject) => {
        db.query(query, values, (err, result) => {
            if (err) reject(err);
            resolve(result);
        });
    });
};

const getCompanyById = (company_id) => {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM companies WHERE company_id = ?';
        db.query(query, [company_id], (err, results) => {
            if (err) reject(err);
            resolve(results[0]);
        });
    });
};

const getAllCompanies = () => {
    return new Promise((resolve, reject) => {
        db.query('SELECT * FROM companies', (err, results) => {
            if (err) reject(err);
            resolve(results);
        });
    });
};

const updateCompany = (company_id, updateData) => {
    const {
        company_name, company_address, company_email,
        company_phone, company_city, company_state,
        company_country, company_username
    } = updateData;

    return new Promise((resolve, reject) => {
        const query = `
            UPDATE companies SET
                company_name = ?, company_address = ?, company_email = ?, company_phone = ?,
                company_city = ?, company_state = ?, company_country = ?, company_username = ?
            WHERE company_id = ?
        `;
        const values = [
            company_name, company_address, company_email, company_phone,
            company_city, company_state, company_country, company_username,
            company_id
        ];
        db.query(query, values, (err, result) => {
            if (err) reject(err);
            resolve(result);
        });
    });
};

const deleteCompany = (company_id) => {
    return new Promise((resolve, reject) => {
        db.query('DELETE FROM companies WHERE company_id = ?', [company_id], (err, result) => {
            if (err) reject(err);
            resolve(result);
        });
    });
};

const changeCompanyStatus = (company_id, status) => {
    return new Promise((resolve, reject) => {
        db.query('UPDATE companies SET company_status = ? WHERE company_id = ?', [status, company_id], (err, result) => {
            if (err) reject(err);
            resolve(result);
        });
    });
};

// Company login
const getCompanyByUsername = (username) => {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM companies WHERE company_username = ?';
        db.query(query, [username], (err, results) => {
            if (err) reject(err);
            resolve(results[0]);
        });
    });
};

module.exports = {
    createCompany,
    getCompanyById,
    getAllCompanies,
    updateCompany,
    deleteCompany,
    changeCompanyStatus,
    getCompanyByUsername
};
