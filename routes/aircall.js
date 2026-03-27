const express = require('express');
const { requireLogin, requireSetup } = require('../middleware/auth');
const { filterTeams, canEdit, managedUserIds } = require('../middleware/permissions');
const { getConfig } = require('../lib/data');

const router = express.Router();
router.use(requireSetup, requireLogin);

const BASE = 'https://api.aircall.io/v1';

function getAuth() {
  const config = getConfig();
  return Buffer.from(`${config.apiId}:${config.apiToken}`).toString('base64');
}

async function aircallFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${getAuth()}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = new Error(`Aircall API error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Fetch all teams across all pages
async function fetchAllTeams() {
  let all = [];
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const data = await aircallFetch(`/teams?per_page=50&page=${page}`);
    all = all.concat(data.teams || []);
    hasMore = !!(data.meta && data.meta.next_page_link);
    page++;
  }
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

// Fetch all users across all pages
async function fetchAllUsers() {
  let all = [];
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const data = await aircallFetch(`/users?per_page=50&page=${page}`);
    all = all.concat(data.users || []);
    hasMore = !!(data.meta && data.meta.next_page_link);
    page++;
  }
  return all;
}

// GET /api/aircall/teams
router.get('/teams', async (req, res) => {
  try {
    const all = await fetchAllTeams();
    const filtered = filterTeams(req.session.user, all);
    res.json({ teams: filtered });
  } catch (e) {
    res.status(e.status || 502).json({ error: 'Could not load teams. Please try again.' });
  }
});

// GET /api/aircall/availabilities
router.get('/availabilities', async (req, res) => {
  try {
    const data = await aircallFetch('/users/availabilities');
    res.json(data);
  } catch (e) {
    res.status(e.status || 502).json({ error: 'Could not load availability data.' });
  }
});

// GET /api/aircall/users
router.get('/users', async (req, res) => {
  try {
    const users = await fetchAllUsers();
    res.json({ users });
  } catch (e) {
    res.status(e.status || 502).json({ error: 'Could not load users.' });
  }
});

// GET /api/aircall/teams/:id
router.get('/teams/:id', async (req, res) => {
  try {
    const user = req.session.user;
    // Admin: skip permission check, fetch team directly
    let permitted = true;
    if (user.role !== 'admin') {
      const all = await fetchAllTeams();
      const allowedTeams = filterTeams(user, all);
      permitted = allowedTeams.some(t => String(t.id) === req.params.id);
    }
    if (!permitted) return res.status(403).json({ error: 'Access denied' });

    const team = await aircallFetch(`/teams/${req.params.id}`);
    const editable = canEdit(user, req.params.id);
    const managed = managedUserIds(user);
    res.json({ ...team, editable, managedUsers: managed });
  } catch (e) {
    res.status(e.status || 502).json({ error: 'Could not load team.' });
  }
});

// POST /api/aircall/teams/:teamId/users/:userId
router.post('/teams/:teamId/users/:userId', async (req, res) => {
  if (!canEdit(req.session.user, req.params.teamId)) return res.status(403).json({ error: 'Access denied' });
  const managed = managedUserIds(req.session.user);
  if (managed !== 'all' && !managed.includes(req.params.userId)) return res.status(403).json({ error: 'Access denied' });
  try {
    await aircallFetch(`/teams/${req.params.teamId}/users/${req.params.userId}`, { method: 'POST' });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 502).json({ error: 'Could not add user to team.' });
  }
});

// DELETE /api/aircall/teams/:teamId/users/:userId
router.delete('/teams/:teamId/users/:userId', async (req, res) => {
  if (!canEdit(req.session.user, req.params.teamId)) return res.status(403).json({ error: 'Access denied' });
  const managed = managedUserIds(req.session.user);
  if (managed !== 'all' && !managed.includes(req.params.userId)) return res.status(403).json({ error: 'Access denied' });
  try {
    await aircallFetch(`/teams/${req.params.teamId}/users/${req.params.userId}`, { method: 'DELETE' });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 502).json({ error: 'Could not remove user from team.' });
  }
});

// POST /api/aircall/resolve-user
router.post('/resolve-user', async (req, res) => {
  const { email } = req.body;
  try {
    let page = 1, hasMore = true;
    while (hasMore) {
      const data = await aircallFetch(`/users?per_page=50&page=${page}`);
      const match = (data.users || []).find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (match) return res.json({ aircallUserId: match.id });
      hasMore = !!(data.meta && data.meta.next_page_link);
      page++;
    }
    res.json({ aircallUserId: null });
  } catch {
    res.json({ aircallUserId: null });
  }
});

module.exports = router;
