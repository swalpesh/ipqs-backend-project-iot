const jwt = require('jsonwebtoken');
require('dotenv').config();

exports.verifyAdminOrCompany = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role === 'admin') {
      req.adminId = decoded.admin_id;
      return next();
    }

    if (decoded.role === 'company') {
      req.companyId = decoded.company_id;
      return next();
    }

    return res.status(403).json({ message: 'Access denied. Invalid role.' });

  } catch (err) {
    console.error('🔒 Token verification failed:', err.message);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
