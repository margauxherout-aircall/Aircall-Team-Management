// Permission helpers
//
// req.session.user fields:
//   role:         'admin' | 'manager' | 'user'
//   level:        'view' | 'edit'
//   scope:        'all' | 'own' | 'specific'
//   scopeTeams:   [teamId, ...]  — used when scope === 'specific'
//   managedUsers: 'all' | [aircallUserId, ...]  — managers only
//   aircallUserId: number | null  — matched by email at login

function filterTeams(user, allTeams) {
  if (user.role === 'admin') return allTeams;
  if (user.scope === 'all') return allTeams;
  if (user.scope === 'specific') {
    const allowed = new Set((user.scopeTeams || []).map(String));
    return allTeams.filter(t => allowed.has(String(t.id)));
  }
  if (user.scope === 'own') {
    return allTeams.filter(t =>
      t.users && t.users.some(u => String(u.id) === String(user.aircallUserId))
    );
  }
  return [];
}

function canEdit(user, teamId) {
  if (user.role === 'admin') return true;
  if (user.role === 'manager') return canAccessTeam(user, teamId);
  if (user.level !== 'edit') return false;
  return canAccessTeam(user, teamId);
}

function canAccessTeam(user, teamId) {
  if (user.scope === 'all') return true;
  if (user.scope === 'specific') return (user.scopeTeams || []).map(String).includes(String(teamId));
  if (user.scope === 'own') return true; // verified at list level via filterTeams
  return false;
}

// Returns which Aircall user IDs this user can add/remove from a team.
// 'all' means no restriction. Array means only those IDs are toggleable.
function managedUserIds(user) {
  if (user.role === 'admin') return 'all';
  if (user.role === 'manager') {
    return user.managedUsers === 'all' ? 'all' : (user.managedUsers || []).map(String);
  }
  return 'all'; // regular users with edit: can toggle anyone (team-scoped)
}

module.exports = { filterTeams, canEdit, managedUserIds };
