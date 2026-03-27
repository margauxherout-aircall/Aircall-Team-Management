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
    const text = await res.text();
    const err = new Error(`Aircall API error ${res.status}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }
  return res.json();
}

// GET /api/aircall/teams — returns teams filtered by user permissions
router.get('/teams', async (req, res) => {
  try {
    const data = await aircallFetch('/teams');
    const teams = data.teams.sort((a, b) => a.name.localeCompare(b.name));
    const filtered = filterTeams(req.session.user, teams);
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

// GET /api/aircall/users — paginated, returns all users
router.get('/users', async (req, res) => {
  try {
    let allUsers = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const data = await aircallFetch(`/users?per_page=50&page=${page}`);
      allUsers = allUsers.concat(data.users);
      hasMore = data.meta.next_page_link !== null;
      page++;
    }
    res.json({ users: allUsers });
  } catch (e) {
    res.status(e.status || 502).json({ error: 'Could not load users.' });
  }
});

// GET /api/aircall/teams/:id — returns team detail if user has access
router.get('/teams/:id', async (req, res) => {
  try {
    const data = await aircallFetch('/teams');
    const allTeams = data.teams;
    const permitted = filterTeams(req.session.user, allTeams);
    if (!permitted.some(t => String(t.id) === req.params.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const team = await aircallFetch(`/teams/${req.params.id}`);
    const editable = canEdit(req.session.user, req.params.id);
    const managed = managedUserIds(req.session.user); // 'all' or [id,...]
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

// POST /api/aircall/resolve-user — finds Aircall user ID by email (used at login)
router.post('/resolve-user', async (req, res) => {
  const { email } = req.body;
  try {
    let page = 1, hasMore = true;
    while (hasMore) {
      const data = await aircallFetch(`/users?per_page=50&page=${page}`);
      const match = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (match) return res.json({ aircallUserId: match.id });
      hasMore = data.meta.next_page_link !== null;
      page++;
    }
    res.json({ aircallUserId: null });
  } catch (e) {
    res.json({ aircallUserId: null });
  }
});

module.exports = router;
