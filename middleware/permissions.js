// Attaches permission helpers to req after login
// req.session.user = { id, email, role, level, scope, scopeTeams, aircallUserId }
//
// level:      'view' | 'edit'
// scope:      'all' | 'own' | 'specific'
// scopeTeams: [teamId, ...] — only used when scope === 'specific'

function filterTeams(user, allTeams) {
  if (user.role === 'admin') return allTeams;
  if (user.scope === 'all') return allTeams;
  if (user.scope === 'specific') {
    const allowed = new Set(user.scopeTeams || []);
    return allTeams.filter(t => allowed.has(String(t.id)));
  }
  if (user.scope === 'own') {
    // aircallUserId resolved at login via email match
    return allTeams.filter(t =>
      t.users && t.users.some(u => String(u.id) === String(user.aircallUserId))
    );
  }
  return [];
}

function canEdit(user, teamId) {
  if (user.role === 'admin') return true;
  if (user.level !== 'edit') return false;
  if (user.scope === 'all') return true;
  if (user.scope === 'specific') return (user.scopeTeams || []).includes(String(teamId));
  if (user.scope === 'own') return true; // further checked by filterTeams at list level
  return false;
}

module.exports = { filterTeams, canEdit };
