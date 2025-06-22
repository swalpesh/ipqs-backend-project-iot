// middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

exports.verifySuperadmin = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(403).json({ message: 'No token provided, authorization denied' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.superadminId = decoded.id;
        next();
    } catch (error) {
        console.error(error);
        res.status(401).json({ message: 'Invalid or expired token' });
    }
};
