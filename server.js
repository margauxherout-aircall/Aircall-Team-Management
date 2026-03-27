require('dotenv').config({ quiet: true });
const express = require('express');
const session = require('express-session');
const path = require('path');
const { isConfigured } = require('./lib/data');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-in-production';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
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
