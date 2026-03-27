function requireLogin(req, res, next) {
  if (req.session && req.session.user) return next();
  res.redirect('/login');
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') return next();
  res.status(403).json({ error: 'Forbidden' });
}

function requireSetup(req, res, next) {
  const { isConfigured } = require('../lib/data');
  if (!isConfigured()) return res.redirect('/setup');
  next();
}

module.exports = { requireLogin, requireAdmin, requireSetup };
