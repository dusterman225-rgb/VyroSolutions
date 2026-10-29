// Retail roles and the permissions an owner can give each supervisor.
// owner: everything. gm: everything at this one store. supervisor: everything except what the owner switches off for that person.
// employee (cashier / team member): checkout, look up products and stock, schedule, time clock.
(function () {
  var ROLES = { owner: 'Owner', gm: 'General manager', supervisor: 'Supervisor', employee: 'Cashier / team member' };
  var PERMS = [
    ['menu', 'Add and edit products and prices'],
    ['void', 'Cancel sales'],
    ['refund', 'Issue refunds and returns'],
    ['supply', 'Manage inventory, vendors and purchase orders'],
    ['timekeeping', "See and fix everyone's time clock"],
    ['colors', 'Change brand colours and tax'],
    ['team', 'Add and remove team members']
  ];
  var PRESETS = {
    'General manager': { menu: true, void: true, refund: true, supply: true, timekeeping: true, colors: true, team: true },
    'Manager': { menu: true, void: true, refund: true, supply: true, timekeeping: true, colors: false, team: false },
    'Assistant manager': { menu: false, void: false, refund: false, supply: true, timekeeping: false, colors: false, team: false }
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
