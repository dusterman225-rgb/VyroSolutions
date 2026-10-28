/* One list of every page, who sees it, and a plain-words description. Used by the home screen, the bottom bar and the menu sheet. */
(function () {
  var GROUPS = [['service', 'Service'], ['floor', 'Floor'], ['screens', 'Customer screens'], ['stock', 'Kitchen and stock'], ['people', 'People'], ['money', 'Money'], ['settings', 'Settings']];
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }

  function items(ctx) {
    var R = window.vroles, role = ctx.role, staff = R.isStaff(ctx), cook = role === 'cook', server = role === 'server', host = role === 'host', emp = role === 'employee', kiosk = role === 'kiosk';
    var svc = (ctx.biz && ctx.biz.service) || 'restaurant', tables = svc !== 'quick', quick = svc !== 'restaurant', ol = R.isOwnerLevel(ctx), front = staff || server || emp, ns = !kiosk;
    function I(id, label, short, href, group, desc, ok, help) { return { id: id, label: label, short: short, href: href, group: group, desc: desc, ok: !!ok, help: help || '' }; }
    return [
      I('pos', 'Point of sale', 'Sell', 'pos.html', 'service', 'Tap a table to take its order, send it to the kitchen and take payment.', tables && front, 'Tap a red (occupied) table to open its order. Pick a category, tap items, then Send to kitchen. Tap Take payment when they are done.'),
      I('quick', 'Quick order', 'Quick', 'quick.html', 'service', 'Fast take-out ordering. Tap items, take payment, done.', quick && front, 'Tap a category, tap items, then Cash, Card, Other or Pay with Vyro. The order goes straight to the kitchen.'),
      I('kitchen', 'Kitchen screen', 'Kitchen', 'kitchen.html', 'service', 'For cooks: orders to make, one at a time. Move each one along.', staff || cook || server || emp, 'Tap an order to move it from New to Preparing to Ready. The server is told when it is Ready. This is for cooks. To look up an old order, use Order history.'),
      I('orders', 'Order history', 'Orders', 'orders.html', 'service', 'Find any order from today, print a receipt, or cancel one.', front || cook || host, 'Find an order, print its receipt, or (managers) cancel it. To make orders, cooks use the Kitchen screen.'),
      I('board', 'Pickup board', 'Board', 'board.html', 'screens', 'A big screen for customers showing which order numbers are ready.', kiosk, 'This is a customer screen. Leave it open on a TV or tablet at the counter.'),
      I('kiosk', 'Customer kiosk', 'Kiosk', 'kiosk.html', 'screens', 'The ordering screen customers use themselves.', kiosk, 'Open this on the kiosk tablet. Customers order and pay with the Vyro app or at the counter.'),
      I('tables', 'Tables and seating', 'Tables', 'tables.html', 'floor', 'Seat guests, mark tables clean, filter by open, reserved or dirty.', tables && (staff || host || server), 'Tap a table. Green is open, blue reserved, red taken, orange needs cleaning.'),
      I('reservations', 'Reservations', 'Booked', 'reservations.html', 'floor', 'Bookings for any day. Seat a party at a table.', tables && (staff || host || server), 'Pick a day, add a booking, tap Seat when they arrive.'),
      I('schedule', 'Schedule', 'Schedule', 'schedule.html', 'people', 'Who works when. Ask to swap a shift or offer to cover one.', ns, 'Slide sideways to see the week. Tap Request swap on your shift, or Offer to cover on a swap request from someone with your title. Managers approve or reject.'),
      I('notifications', 'Notifications', 'Alerts', 'notifications.html', 'people', 'Swap requests and answers.', ns, 'Tap an alert to open the schedule. Tap Dismiss when you have seen it.'),
      I('qr', 'Table QR codes', 'QR', 'qrcodes.html', 'floor', 'Print a code for each table so guests can order from their phone.', staff && tables, 'Print and stick one on each table.'),
      I('soldout', 'Sold out list', 'Sold out', 'soldout.html', 'stock', 'Mark items sold out so nobody can sell them.', ns && !server && !host, 'Tap an item to mark it sold out. Tap again to bring it back.'),
      I('supply', 'Ingredient supply', 'Supply', 'supply.html', 'stock', 'How much of each ingredient you have. Low ones are flagged.', staff || cook, 'Update the count after deliveries. Set a low level so it warns you.'),
      I('ingredients', "What's in each dish", 'Dishes', 'ingredients.html', 'stock', 'Look up the ingredients in a dish (names only, never amounts).', staff || cook, 'Look up what is in an item, for guests who ask.'),
      I('waste', 'Waste log', 'Waste', 'waste.html', 'stock', 'Record spoiled or wasted food.', staff || cook || emp, 'Enter what was wasted and why. Tick the box to take it off supply.'),
      I('shopping', 'Shopping list', 'Shop', 'shopping.html', 'stock', 'What to reorder, grouped by vendor. Text or email it.', staff || cook || emp, 'Everything low on supply, ready to text to your vendor.'),
      I('timeclock', 'Time clock', 'Clock', 'timeclock.html', 'people', 'Clock in and out. See your hours.', ns, 'Tap Clock in when you start and Clock out when you finish.'),
      I('tips', 'Tips', 'Tips', 'tips.html', 'people', 'Tips by person and by day.', staff || server || emp, 'Pick the dates. Download a spreadsheet if you need one.'),
      I('team', 'Team', 'Team', 'team.html', 'people', 'Add people, change titles and roles, remove people.', R.can(ctx, 'team'), 'Add a person with their email. If they already have a Vyro login, they get an invitation to accept.'),
      I('records', 'Employee records', 'Records', 'records.html', 'people', 'One employee\'s hours and orders.', R.can(ctx, 'timekeeping'), 'Pick a name and a start date.'),
      I('close', 'End of day close', 'Close', 'close.html', 'money', 'Sales, cash count and best sellers for a day.', staff, 'Pick the day, count the drawer, tap Save. Download the day as a spreadsheet.'),
      I('finances', 'Sales reports', 'Reports', 'finances.html', 'money', 'Sales over time.', ol, 'Pick a period to see the totals.'),
      I('paysettings', 'Pay with Vyro setup', 'Vyro pay', 'paysettings.html', 'money', 'Where crypto payments are sent, and which coins you accept.', ol, 'Paste your wallet address, tick the coins, Save. Check the address twice.'),
      I('settings', 'Settings', 'Settings', 'settings.html', 'settings', 'All your business setup in one place.', ol, 'Everything you set up once: service type, menu, team, payments, colours.'),
      I('menu', 'Menu and recipes', 'Menu', 'menu.html', 'settings', 'Items, prices, categories, ingredients and extras. Tax and discount limits.', R.can(ctx, 'menu'), 'Add an item, set the price, add its ingredients. Set prices for extras.'),
      I('theme', 'Brand colours', 'Colours', 'theme.html', 'settings', 'Make the app match your restaurant\'s colours.', R.can(ctx, 'colors'), 'Pick a preset or choose your own colours, then Save.'),
      I('service', 'Service type', 'Service', 'service.html', 'settings', 'Restaurant, fast food, or both. This sets which screens your team sees.', ol, 'Pick one. You can change it any time.'),
      I('signinlink', 'Staff sign-in link', 'Sign-in', 'signinlink.html', 'settings', 'A sign-in link with your restaurant\'s name and colours to give your team.', ol, 'Copy the link and send it to your team, or print the QR code. Change the link name any time.'),
      I('worklocation', 'Work location', 'Location', 'worklocation.html', 'settings', 'Require employees to be at work to use the app.', ol, 'Stand in the restaurant, tap Use my current location, set the radius, Save.'),
      I('locations', 'Locations', 'Places', 'locations.html', 'settings', 'Add another restaurant. See all of them together.', role === 'owner', 'Add a location, then Open it to set it up.'),
      I('profile', 'Business profile', 'Profile', 'profile.html', 'settings', 'Name, address, phone and email on receipts.', ol, 'This is what prints at the top of receipts.')
    ].filter(function (x) { return x.ok; });
  }

  function primary(ctx, list) {
    var role = ctx.role, ids;
    if (role === 'kiosk') ids = ['kiosk', 'board'];
    else if (role === 'cook') ids = ['kitchen', 'soldout', 'supply'];
    else if (role === 'host') ids = ['tables', 'reservations', 'schedule', 'timeclock'];
    else if ((role === 'server' || role === 'employee') && ((ctx.biz && ctx.biz.service) || 'restaurant') === 'quick') ids = ['quick', 'orders', 'kitchen', 'schedule'];
    else if (role === 'server' || role === 'employee') ids = ['pos', 'quick', 'orders', 'kitchen'];
    else if (((ctx.biz && ctx.biz.service) || 'restaurant') === 'quick') ids = ['quick', 'orders', 'kitchen', 'soldout'];
    else ids = ['pos', 'quick', 'orders', 'kitchen', 'tables'];
    var out = []; ids.forEach(function (id) { var f = list.filter(function (x) { return x.id === id; })[0]; if (f && out.length < 4) out.push(f); });
    return out;
  }

  // Draws the grouped, searchable list of every page into box.
  function renderAll(box, ctx, opts) {
    opts = opts || {}; var list = items(ctx); box.textContent = '';
    var inp = el('input'); inp.type = 'search'; inp.placeholder = 'Find a page...'; inp.style.cssText = 'width:100%;margin:8px 0'; box.appendChild(inp);
    var holder = el('div'); box.appendChild(holder);
    function row(x) { var a = el('a', 'vnav-row'); a.href = x.href; a.appendChild(el('b', '', x.label)); a.appendChild(el('small', '', x.desc)); return a; }
    function draw() {
      var q = inp.value.trim().toLowerCase(); holder.textContent = '';
      if (q) { var hits = list.filter(function (x) { return (x.label + ' ' + x.desc).toLowerCase().indexOf(q) >= 0; }); hits.forEach(function (x) { holder.appendChild(row(x)); }); if (!hits.length) holder.appendChild(el('div', 'note', 'Nothing matches "' + inp.value + '".')); return; }
      GROUPS.forEach(function (g) {
        var l = list.filter(function (x) { return x.group === g[0]; }); if (!l.length) return;
        var d = el('details', 'sec'); d.appendChild(el('summary', '', g[1] + ' (' + l.length + ')')); var inn = el('div', 'in'); l.forEach(function (x) { inn.appendChild(row(x)); }); d.appendChild(inn); holder.appendChild(d);
      });
    }
    inp.addEventListener('input', draw); draw();
  }

  var css = '.vnav{position:fixed;left:0;right:0;bottom:0;z-index:900;display:flex;background:#0A1A2B;border-top:2px solid #4B9CD3;padding-bottom:env(safe-area-inset-bottom)}' +
    '.vnav a,.vnav button{flex:1;min-height:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;background:none;border:0;color:#6FB6EA;font:inherit;font-size:.78rem;font-weight:600;text-decoration:none;cursor:pointer}' +
    '.vnav .on{background:#4B9CD3;color:#05070A;font-weight:800}.vnav i{font-style:normal;font-size:1.25rem;line-height:1}' +
    'body{padding-bottom:84px}.vnav-help{position:fixed;right:12px;bottom:70px;z-index:900;width:38px;height:38px;border-radius:50%;border:1px solid var(--line,#444);background:var(--panel,#0C1117);color:var(--blue,#4B9CD3);font-weight:800;cursor:pointer}' +
    '.vnav-row{display:block;padding:12px 4px;border-bottom:1px solid var(--line,rgba(201,209,217,.14));text-decoration:none;color:inherit}.vnav-row b{display:block}.vnav-row small{display:block;opacity:.75;margin-top:2px}' +
    '.vclock{position:fixed;top:0;left:0;right:0;z-index:950;display:flex;align-items:center;justify-content:space-between;gap:10px;background:#c62828;color:#fff;padding:6px 12px;font-weight:700;font-size:.9rem}.vclock button{background:#fff;color:#c62828;border:0;border-radius:999px;padding:8px 16px;font:inherit;font-weight:800;cursor:pointer;min-height:36px}body.hasclock{padding-top:50px}.vnav-badge{position:absolute;top:4px;margin-left:14px;background:#e53935;color:#fff;border-radius:999px;font-size:.65rem;min-width:16px;padding:1px 4px;text-align:center}.vnav button{position:relative}.vtoast{background:#4B9CD3;color:#05070A;padding:14px 16px;border-radius:12px;font-weight:700;box-shadow:0 6px 20px rgba(0,0,0,.4);cursor:pointer}#vyro-toasts{position:fixed;left:10px;right:10px;top:56px;z-index:960;display:flex;flex-direction:column;gap:6px}'+
    '.vnav-sheet{max-height:80vh;overflow:auto}@media print{.vnav,.vnav-help{display:none !important}body{padding-bottom:0}}';


  // ---- time clock helpers (shared by every page) ----
  function ckey(ctx) { return 'vyroClock:' + ctx.bizId + ':' + ctx.user.uid; }
  function setClock(ctx, s) { try { sessionStorage.setItem(ckey(ctx), s ? JSON.stringify({ id: s.id, startMs: s.startMs }) : 'none'); } catch (e) {} drawClock(ctx); }
  async function clockGet(ctx) {
    var c = null; try { c = sessionStorage.getItem(ckey(ctx)); } catch (e) {}
    if (c === 'none') return null; if (c) { try { return JSON.parse(c); } catch (e) {} }
    try {
      var s = await ctx.bizRef.collection('shifts').where('uid', '==', ctx.user.uid).where('endMs', '==', 0).limit(1).get();
      var d = s.docs[0]; var r = d ? { id: d.id, startMs: d.data().startMs } : null; setClock(ctx, r); return r;
    } catch (e) { return null; }
  }
  async function clockIn(ctx) {
    var ms = Date.now(), ref = await ctx.bizRef.collection('shifts').add({ uid: ctx.user.uid, name: vyro.who(ctx), startMs: ms, endMs: 0, date: vutil.todayStr(), createdAt: vyro.stamp() });
    setClock(ctx, { id: ref.id, startMs: ms }); return true;
  }
  async function clockOut(ctx) {
    var c = await clockGet(ctx); if (!c) { setClock(ctx, null); return false; }
    try { await ctx.bizRef.collection('shifts').doc(c.id).update({ endMs: Date.now(), updatedAt: vyro.stamp() }); } catch (e) { setClock(ctx, null); throw e; }
    setClock(ctx, null); return true;
  }
  var clockTick = null;
  async function drawClock(ctx) {
    var old = document.getElementById('vclock'); var c = null; try { var raw = sessionStorage.getItem(ckey(ctx)); c = raw && raw !== 'none' ? JSON.parse(raw) : null; } catch (e) {}
    if (clockTick) { clearInterval(clockTick); clockTick = null; }
    if (!c) { if (old) old.remove(); document.body.classList.remove('hasclock'); return; }
    if (!old) {
      old = el('div', 'vclock'); old.id = 'vclock'; var t = el('span'); t.id = 'vclockT'; var b = el('button', '', 'Clock out'); b.type = 'button';
      b.addEventListener('click', async function () { if (!confirm('Clock out now?')) return; b.disabled = true; try { await clockOut(ctx); } catch (e) { alert('Could not clock out: ' + vyro.friendly(e)); } b.disabled = false; });
      old.appendChild(t); old.appendChild(b); document.body.appendChild(old);
    }
    document.body.classList.add('hasclock');
    function f() { var s = Math.floor((Date.now() - c.startMs) / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); document.getElementById('vclockT').textContent = 'Clocked in · ' + h + 'h ' + String(m).padStart(2, '0') + 'm'; }
    f(); clockTick = setInterval(f, 30000);
  }

  // ---- notifications: swap requests and answers. Managers get the shared "mgmt" ones too. ----
  function toast(text) {
    var box = document.getElementById('vyro-toasts'); if (!box) { box = el('div'); box.id = 'vyro-toasts'; document.body.appendChild(box); }
    var t = el('div', 'vtoast', text + ' (tap to open)'); t.addEventListener('click', function () { location.href = 'notifications.html'; }); box.appendChild(t); setTimeout(function () { t.remove(); }, 12000);
    try { if (navigator.vibrate) navigator.vibrate([150, 80, 150]); } catch (e) {}
  }
  var counts = {};
  function watchNotes(ctx) {
    var tos = [ctx.user.uid]; if (window.vroles && vroles.isStaff(ctx)) tos.push('mgmt');
    tos.forEach(function (to) {
      var first = true;
      try {
        ctx.bizRef.collection('notifications').where('to', '==', to).where('done', '==', false).limit(30).onSnapshot(function (s) {
          counts[to] = s.size;
          if (!first) s.docChanges().forEach(function (c) { if (c.type === 'added' && c.doc.data().byUid !== ctx.user.uid) toast(c.doc.data().text || 'New notification'); });
          first = false;
          var n = 0; Object.keys(counts).forEach(function (k) { n += counts[k]; }); window.vnav.unread = n;
          var mb = document.getElementById('vnavMore'); if (mb) { var bd = mb.querySelector('.vnav-badge'); if (bd) bd.remove(); if (n) mb.appendChild(el('span', 'vnav-badge', String(n))); }
          try { document.dispatchEvent(new CustomEvent('vyro-notif', { detail: { n: n } })); } catch (e) {}
        }, function () {});
      } catch (e) {}
    });
  }

  var bg = null, box = null;
  function sheet(build) { if (!bg) { bg = el('div', 'modal-bg'); box = el('div', 'modal vnav-sheet'); bg.appendChild(box); document.body.appendChild(bg); bg.addEventListener('click', function (e) { if (e.target === bg) bg.classList.remove('open'); }); } box.textContent = ''; build(box); bg.classList.add('open'); }

  function mount(ctx) {
    if (document.getElementById('vnavBar') || !window.vroles) return;
    var st = el('style'); st.textContent = css; document.head.appendChild(st);
    var list = items(ctx), pri = primary(ctx, list), here = (location.pathname.split('/').pop() || 'index.html');
    var bar = el('nav', 'vnav'); bar.id = 'vnavBar'; bar.setAttribute('aria-label', 'Main');
    function tab(label, icon, href) { var a = el('a', here === href || (here === '' && href === 'index.html') ? 'on' : ''); a.href = href; a.appendChild(el('i', '', icon)); a.appendChild(el('span', '', label)); return a; }
    bar.appendChild(tab('Home', '⌂', 'index.html'));
    var icons = { pos: '▦', quick: '⚡', kitchen: '☕', orders: '☰', tables: '▦', soldout: '⊘', supply: '▤', reservations: '☎', schedule: '◷' };
    pri.slice(0, 2).forEach(function (x) { bar.appendChild(tab(x.short, icons[x.id] || '●', x.href)); });
    var more = el('button'); more.id = 'vnavMore'; more.type = 'button'; more.appendChild(el('i', '', '☰')); more.appendChild(el('span', '', 'More')); more.addEventListener('click', function () { sheet(function (b) { b.appendChild(el('h2', '', 'All pages')); renderAll(b, ctx); var c = el('button', 'btn ghost', 'Close'); c.type = 'button'; c.addEventListener('click', function () { bg.classList.remove('open'); }); b.appendChild(c); }); });
    bar.appendChild(more); document.body.appendChild(bar);
    watchNotes(ctx); clockGet(ctx).then(function () { drawClock(ctx); });
    var cur = list.filter(function (x) { return x.href === here; })[0];
    if (cur && cur.help) {
      var q = el('button', 'vnav-help', '?'); q.type = 'button'; q.setAttribute('aria-label', 'Help for this page');
      q.addEventListener('click', function () { sheet(function (b) { b.appendChild(el('h2', '', cur.label)); b.appendChild(el('div', 'note', cur.desc)); b.appendChild(el('div', '', cur.help)); var c = el('button', 'btn', 'Got it'); c.type = 'button'; c.addEventListener('click', function () { bg.classList.remove('open'); }); b.appendChild(c); }); });
      document.body.appendChild(q);
    }
  }
  window.vnav = { unread: 0, clockGet: clockGet, clockIn: clockIn, clockOut: clockOut, setClock: setClock, items: items, primary: primary, renderAll: renderAll, mount: mount, GROUPS: GROUPS };
})();
