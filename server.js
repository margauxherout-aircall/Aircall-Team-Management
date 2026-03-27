require('dotenv').config({ quiet: true });
const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const path = require('path');
const { isConfigured } = require('./lib/data');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-in-production';
const DATA_DIR = process.env.DATA_PATH || path.join(__dirname, 'data');

app.set('trust proxy', 1); // Railway terminates SSL at the proxy
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  store: new FileStore({ path: path.join(DATA_DIR, 'sessions'), retries: 1, logFn: () => {} }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
  },
}));

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/aircall', require('./routes/aircall'));

// Setup-only route: save API config (no auth required, only works before first user exists)
app.post('/api/setup/config', (req, res) => {
  const { getUsers, saveConfig, getConfig } = require('./lib/data');
  if (getUsers().length > 0) return res.status(400).json({ error: 'Setup already complete' });
  const { apiId, apiToken, defaultLang } = req.body;
  if (!apiId || !apiToken) return res.status(400).json({ error: 'API ID and Token required' });
  const existing = getConfig() || {};
  saveConfig({ ...existing, apiId, apiToken, defaultLang: defaultLang || 'en' });
  res.json({ ok: true });
});

// Setup-only route: test Aircall connection (no auth required — used from setup page)
app.post('/api/setup/test', async (req, res) => {
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

// Setup-only route: create the first admin user (no auth required, only works once)
app.post('/api/setup/admin', async (req, res) => {
  const { isConfigured, getUsers, upsertUser } = require('./lib/data');
  const bcrypt = require('bcrypt');
  const crypto = require('crypto');
  if (!isConfigured()) return res.status(400).json({ error: 'Configure API credentials first' });
  if (getUsers().length > 0) return res.status(400).json({ error: 'Setup already complete' });
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
  const passwordHash = await bcrypt.hash(password, 10);
  upsertUser({ id: crypto.randomUUID(), name, email: email.toLowerCase(), passwordHash, role: 'admin', level: 'edit', scope: 'all', scopeTeams: [], lang: 'en' });
  res.json({ ok: true });
});

// Page routing — must come before static middleware so redirects take precedence over index.html
app.get('/', (req, res) => {
  if (!isConfigured()) return res.redirect('/setup');
  if (!req.session.user) return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/setup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'setup.html'));
});

app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/admin', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  if (req.session.user.role !== 'admin') return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/translations', express.static(path.join(__dirname, 'translations')));

// Fallback
app.get('*', (req, res) => res.redirect('/'));

app.listen(PORT, () => {
  console.log(`Aircall Team Management running on http://localhost:${PORT}`);
});
