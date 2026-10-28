// Restaurant roles and the permissions an owner can give each supervisor.
// owner: everything. supervisor: everything except what the owner switches off for that person.
// cook, server, host and team member: only their own tools.
(function () {
  var ROLES = { owner: 'Owner', gm: 'General manager', supervisor: 'Supervisor', cook: 'Cook', server: 'Server', host: 'Host', employee: 'Team member' };
  var PERMS = [
    ['menu', 'Edit the menu and recipes'],
    ['void', 'Void orders'],
    ['supply', 'Manage ingredient supply'],
    ['reservations', 'Manage reservations and tables'],
    ['timekeeping', "See and fix everyone's time clock"],
    ['colors', 'Change brand colours and tax'],
    ['team', 'Add and remove team members']
  ];
  var PRESETS = {
    'General manager': { menu: true, void: true, supply: true, reservations: true, timekeeping: true, colors: true, team: true },
    'Manager': { menu: true, void: true, supply: true, reservations: true, timekeeping: true, colors: false, team: false },
    'Assistant manager': { menu: false, void: false, supply: true, reservations: true, timekeeping: false, colors: false, team: false }
  };
  function can(ctx, p) {
    if (ctx.role === 'owner' || ctx.role === 'gm') return true;
    if (ctx.role !== 'supervisor') return false;
    var perms = (ctx.me && ctx.me.perms) || {};
    return perms[p] !== false;      // a supervisor with nothing set keeps every permission, same as the database rules
  }
  function isStaff(ctx) { return ctx.role === 'owner' || ctx.role === 'gm' || ctx.role === 'supervisor'; }
  function isOwnerLevel(ctx) { return ctx.role === 'owner' || ctx.role === 'gm'; }
  function label(r) { return ROLES[r] || 'Team member'; }
  window.vroles = { ROLES: ROLES, PERMS: PERMS, PRESETS: PRESETS, can: can, isStaff: isStaff, isOwnerLevel: isOwnerLevel, label: label };
})();
