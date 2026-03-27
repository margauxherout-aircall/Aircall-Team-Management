const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { requireAdmin } = require('../middleware/auth');
const { getConfig, saveConfig, getUsers, upsertUser, deleteUser } = require('../lib/data');

const router = express.Router();
router.use(requireAdmin);

// GET /api/admin/config
router.get('/config', (req, res) => {
  const config = getConfig() || {};
  // Never return the raw token to the client
  res.json({
    apiId: config.apiId || '',
    apiTokenSet: !!config.apiToken,
    defaultLang: config.defaultLang || 'en',
  });
});

// POST /api/admin/config/test — test connection (admin only, for edit flow)
router.post('/config/test', async (req, res) => {
  const { apiId, apiToken } = req.body;
  if (!apiId || !apiToken) return res.status(400).json({ error: 'API ID and Token required' });
  try {
    const auth = Buffer.from(`${apiId}:${apiToken}`).toString('base64');
    const response = await fetch('https://api.aircall.io/v1/company', {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!response.ok) return res.status(401).json({ error: 'Invalid credentials' });
    const data = await response.json();
    res.json({ ok: true, name: data.company?.name || 'Connected' });
  } catch {
    res.status(502).json({ error: 'Could not reach Aircall. Check your connection.' });
  }
});

// POST /api/admin/config
router.post('/config', (req, res) => {
  const { apiId, apiToken, defaultLang } = req.body;
  if (!apiId) return res.status(400).json({ error: 'API ID required' });
  const existing = getConfig() || {};
  const newToken = (apiToken && apiToken !== '__keep__') ? apiToken : existing.apiToken;
  if (!newToken) return res.status(400).json({ error: 'API Token required' });
  saveConfig({ ...existing, apiId, apiToken: newToken, defaultLang: defaultLang || existing.defaultLang || 'en' });
  res.json({ ok: true });
});


// GET /api/admin/users
router.get('/users', (req, res) => {
  const users = getUsers().map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    level: u.level,
    scope: u.scope,
    scopeTeams: u.scopeTeams || [],
    managedUsers: u.managedUsers ?? 'all',
    lang: u.lang || 'en',
  }));
  res.json(users);
});

// POST /api/admin/users — create
router.post('/users', async (req, res) => {
  const { name, email, password, role, level, scope, scopeTeams, managedUsers, lang } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password required' });

  const existing = getUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'A user with this email already exists' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: crypto.randomUUID(),
    name,
    email: email.toLowerCase(),
    passwordHash,
    role: role || 'user',
    level: level || 'view',
    scope: scope || 'all',
    scopeTeams: scopeTeams || [],
    managedUsers: managedUsers ?? 'all',
    lang: lang || 'en',
  };
  upsertUser(user);
  res.json({ ok: true, id: user.id });
});

// PUT /api/admin/users/:id — update
router.put('/users/:id', async (req, res) => {
  const users = getUsers();
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { name, email, password, role, level, scope, scopeTeams, managedUsers, lang } = req.body;
  if (name) user.name = name;
  if (email) user.email = email.toLowerCase();
  if (password) user.passwordHash = await bcrypt.hash(password, 10);
  if (role) user.role = role;
  if (level) user.level = level;
  if (scope) user.scope = scope;
  if (scopeTeams !== undefined) user.scopeTeams = scopeTeams;
  if (managedUsers !== undefined) user.managedUsers = managedUsers;
  if (lang) user.lang = lang;

  upsertUser(user);
  res.json({ ok: true });
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', (req, res) => {
  // Prevent deleting yourself
  if (req.params.id === req.session.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
  deleteUser(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
