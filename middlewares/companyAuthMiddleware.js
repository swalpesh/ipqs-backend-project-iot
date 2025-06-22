// middlewares/companyAuthMiddleware.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

exports.verifyCompany = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Access token missing or malformed' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || decoded.role !== 'company') {
      return res.status(403).json({ message: 'Unauthorized: Only company role allowed' });
    }

    req.companyId = decoded.company_id;
    next();

  } catch (err) {
    console.error('🔒 Auth Error:', err.message);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
