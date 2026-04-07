const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * requireAuth — protects Express routes that need a valid JWT.
 * Reads token from: Cookie  →  Authorization Bearer header
 */
const requireAuth = (req, res, next) => {
  const token =
    req.cookies?.auth_token ||
    req.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (!token) return res.status(401).json({ error: 'Unauthorized: no token' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    return res.status(401).json({ error: msg });
  }
};

/**
 * requireRole — role-based guard.
 * Usage: router.get('/admin-only', requireAuth, requireRole('admin','super_admin'), handler)
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  next();
};

module.exports = { requireAuth, requireRole };
