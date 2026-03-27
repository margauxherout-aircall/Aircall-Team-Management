const express = require('express');
const bcrypt = require('bcrypt');
const { findUser, getConfig } = require('../lib/data');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = findUser(email);
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return res.status(401).json({ error: 'Invalid email or password' });

  req.session.user = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    level: user.level,
    scope: user.scope,
    scopeTeams: user.scopeTeams || [],
    managedUsers: user.managedUsers ?? 'all',
    aircallUserId: user.aircallUserId || null,
    lang: user.lang || getConfig()?.defaultLang || 'en',
  };

  res.json({ ok: true, role: user.role });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  res.json(req.session.user);
});

module.exports = router;
