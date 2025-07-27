// controllers/companyController.js
const db = require('../models/db');
const { createCompany, getCompanyById,
    getAllCompanies,
    updateCompany,
    deleteCompany,
    changeCompanyStatus } = require('../models/companyModel');

exports.createCompany = async (req, res) => {
    try {
        const superadminId = req.superadminId;
        const company = req.body;

        // Generate company_id
        company.company_id = company.company_name.replace(/\s+/g, '');

        // Set created_at and subscription_end
        const createdAt = new Date();
        const subscriptionEnd = new Date(createdAt);
        subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1);

        company.created_at = createdAt;
        company.subscription_end = subscriptionEnd;
        company.company_status = 'active'; // default status

        await createCompany(company, superadminId);
        res.status(201).json({
            message: 'Company created successfully',
            company_id: company.company_id
        });
    } catch (error) {
        console.error('Create company error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};


exports.getAllCompanies = async (req, res) => {
    try {
        const companies = await getAllCompanies();
        res.status(200).json({ companies });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getCompanyById = async (req, res) => {
    try {
        const { company_id } = req.params;
        const company = await getCompanyById(company_id);
        if (!company) return res.status(404).json({ message: 'Company not found' });
        res.status(200).json({ company });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.updateCompany = async (req, res) => {
    try {
        const { company_id } = req.params;
        const updateData = req.body;
        const result = await updateCompany(company_id, updateData);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Company not found' });
        res.status(200).json({ message: 'Company updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.deleteCompany = async (req, res) => {
  try {
    const { company_id } = req.params;

    // Step 1: Check if any devices are assigned to this company
    const [assignedDevices] = await new Promise((resolve, reject) => {
      const checkQuery = 'SELECT COUNT(*) AS count FROM devices WHERE company_id = ?';
      db.query(checkQuery, [company_id], (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    if (assignedDevices.count > 0) {
      return res.status(400).json({
        message: `Cannot delete company. ${assignedDevices.count} device(s) are still assigned to it.`
      });
    }

    // Step 2: Delete the company
    const result = await new Promise((resolve, reject) => {
      const deleteQuery = 'DELETE FROM companies WHERE company_id = ?';
      db.query(deleteQuery, [company_id], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Company not found' });
    }

    return res.status(200).json({ message: 'Company deleted successfully' });

  } catch (error) {
    console.error('❌ Delete company error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};


exports.changeCompanyStatus = async (req, res) => {
    try {
        const { company_id } = req.params;
        const { status } = req.body;

        if (!['active', 'closed'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status value' });
        }

        // Fetch current company data
        const company = await getCompanyById(company_id);
        if (!company) return res.status(404).json({ message: 'Company not found' });

        const now = new Date();
        const createdAt = new Date(company.created_at);
        const subscriptionEnd = new Date(company.subscription_end);

        // Auto-close if subscription expired
        if (status === 'active') {
            if (now > subscriptionEnd) {
                // Check if same year
                if (now.getFullYear() !== createdAt.getFullYear()) {
                    // New cycle
                    const newCreatedAt = now;
                    const newSubscriptionEnd = new Date(now);
                    newSubscriptionEnd.setFullYear(now.getFullYear() + 1);

                    const updateQuery = `
                        UPDATE companies 
                        SET company_status = ?, created_at = ?, subscription_end = ? 
                        WHERE company_id = ?
                    `;
                    await db.promise().query(updateQuery, ['active', newCreatedAt, newSubscriptionEnd, company_id]);

                    return res.status(200).json({
                        message: 'Company re-activated and new subscription started for 1 year.'
                    });
                }
            }
        }

        // Just change status without altering dates
        const result = await changeCompanyStatus(company_id, status);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Company not found' });

        return res.status(200).json({ message: `Company status updated to ${status}` });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};


// notifications controller

exports.updateNotificationStatus = (req, res) => {
  const { company_id } = req.params;
  const { sms_status, email_status } = req.body;

  // Validate input
  const validEnum = ['true', 'false'];
  if (
    (sms_status && !validEnum.includes(sms_status)) ||
    (email_status && !validEnum.includes(email_status))
  ) {
    return res.status(400).json({ message: 'Invalid status value. Only "true" or "false" allowed.' });
  }

  // Build dynamic SET clause
  const updates = [];
  const values = [];

  if (sms_status) {
    updates.push('sms_status = ?');
    values.push(sms_status);
  }

  if (email_status) {
    updates.push('email_status = ?');
    values.push(email_status);
  }

  if (updates.length === 0) {
    return res.status(400).json({ message: 'Nothing to update.' });
  }

  values.push(company_id);

  const query = `UPDATE companies SET ${updates.join(', ')} WHERE company_id = ?`;

  db.query(query, values, (err, result) => {
    if (err) {
      console.error('❌ Error updating notification status:', err.message);
      return res.status(500).json({ message: 'Database error' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Company not found' });
    }

    res.status(200).json({ message: 'Notification settings updated successfully.' });
  });
};
