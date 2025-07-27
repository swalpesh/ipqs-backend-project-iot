// controllers/companyProfileController.js
const db = require('../models/db');

exports.getCompanyProfile = async (req, res) => {
  const { company_id } = req.params;

  if (!company_id) {
    return res.status(400).json({ error: 'company_id is required' });
  }

  const query = `
    SELECT 
      company_id,
      company_name,
      company_email,
      company_phone,
      company_address,
      company_city,
      company_state,
      company_country,
      company_status,
      created_at
    FROM companies 
    WHERE company_id = ?
  `;

  db.query(query, [company_id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    if (results.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    return res.status(200).json({ company: results[0] });
  });
};
