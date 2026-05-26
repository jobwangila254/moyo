const jwt = require('jsonwebtoken');
const { prisma } = require('../prisma');

exports.authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, phone: true, name: true, tier: true, phoneVerified: true, countyId: true },
    });

    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found.' });
    }

    req.user = user;
    req.userId = user.id;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, error: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired.' });
    }
    next(error);
  }
};

exports.requireTier = (...tiers) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }
    if (!tiers.includes(req.user.tier)) {
      return res.status(403).json({
        success: false,
        error: `This feature requires ${tiers.join(' or ')} tier. Please upgrade your account.`,
      });
    }
    next();
  };
};

exports.requireVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }
  if (!req.user.phoneVerified) {
    return res.status(403).json({
      success: false,
      error: 'Please verify your phone number to access this feature.',
    });
  }
  next();
};
