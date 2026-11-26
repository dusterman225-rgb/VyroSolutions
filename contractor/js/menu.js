// The Menu (top right) on every signed-in page. The dashboard has its own copy of the same menu.
(function () {
  if (window.__vyroMenu || document.getElementById('menuBtn')) return;
  window.__vyroMenu = true;
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  function loadBeta(fn) { if (window.vqBeta) return fn(); var sc = document.createElement('script'); sc.src = 'js/cbeta.js'; sc.onload = fn; document.head.appendChild(sc); }
  window.vmenu = { mount: function (ctx) {
    var role = ctx.role, money = role === 'owner' || role === 'supervisor';
    var host = document.querySelector('.brand') || document.querySelector('.wrap');
    if (!host) return;
    var wrap = el('div', 'vmenu-wrap');
    var btn = el('button', 'menu-btn', 'Menu ▾'); btn.type = 'button'; btn.setAttribute('aria-expanded', 'false');
    var menu = el('div', 'menu'); menu.style.right = '0';
    var head = el('div', 'mh'); head.appendChild(el('b', '', ctx.biz.name || 'Menu'));
    head.appendChild(el('small', '', role + ' · ' + (ctx.user.email || ''))); menu.appendChild(head);
    function group(title, items) {
      var list = items.filter(Boolean); if (!list.length) return;
      var d = el('details'); d.appendChild(el('summary', 'mg', title));
      list.forEach(function (i) { var a = el('a', 'mi', i[0]); a.href = i[1]; d.appendChild(a); });
      menu.appendChild(d);
    }
    menu.appendChild(Object.assign(el('a', 'mi', 'Dashboard'), { href: 'app.html' }));
    group('Work', [['Leads', 'leads.html'], ['Estimates', 'estimates.html'], ['Active jobs', 'jobs.html']]);
    group('Community', [['Nearby requests and Vyqil members', 'community.html'], ['Need A Vyqil Member', 'community.html#need'], ['My community listing', 'community.html#listing']]);
    group('Customers', [['Customers', 'customers.html'], money && ['Contracts', 'documents.html'], ['Messages', 'messages.html']]);
    group('Money', money ? [['Invoices', 'invoices.html'], ['Expenses and bills', 'expenses.html'], ['Recurring bills', 'recurring.html'], role === 'owner' && ['Finances', 'finances.html'], role === 'owner' && ['Pay with Vyqil', 'paysettings.html']] : []);
    group('Tools', [['Time and mileage', 'timelog.html'], money && ['Subcontractors', 'subs.html'], ['Vyqil Assistant (AI)', 'ai.html'], ['Scan a document', 'ai.html#scan'], ['Quick help', 'assistant.html'], (role === 'owner' || role === 'gm') && ['Data and activity', 'data.html']]);
    group('Beta', [['Send feedback', '#feedback'], ['Subscription', '#subscription'], ['About the Beta', '#about']]);
    group('Business', [['Business profile', 'profile.html'], ['Team', 'team.html'], role === 'owner' && ['Sign-in link', 'signinlink.html']]);
    try { menu.addEventListener('click', function (e) { var h = e.target && e.target.getAttribute && e.target.getAttribute('href'); if (h === '#feedback' || h === '#about' || h === '#subscription') { e.preventDefault(); set(false); if (h === '#subscription') { if (window.VQSub) VQSub.open(); return; } loadBeta(function () { h === '#feedback' ? vqBeta.feedback() : vqBeta.about(); }); } }); } catch (e) { /* ignore */ }
    loadBeta(function () { vqBeta.mount(ctx); });
    var al = el('button', 'mi', 'Phone alerts'); al.type = 'button'; al.addEventListener('click', function () { set(false); vutil.pushPanel('team', ctx); }); menu.appendChild(al);
    menu.appendChild(Object.assign(el('a', 'mi', 'Switch business'), { href: '/dashboard.html' }));
    var out = el('button', 'mi out', 'Sign out'); out.type = 'button';
    out.addEventListener('click', async function () { try { await vyro.signOut(); } catch (e) { /* ignore */ } location.href = vyro.loginUrl(); });
    menu.appendChild(out);
    var lo = el('button', 'logout-sm', 'Log out'); lo.type = 'button';
    lo.addEventListener('click', function () { out.click(); });
    wrap.appendChild(lo); wrap.appendChild(btn); wrap.appendChild(menu);
    var css = document.createElement('style');
    css.textContent = '.vmenu-wrap{position:absolute;top:0;right:0;z-index:30;display:flex;align-items:center;gap:8px}.logout-sm{background:none;border:1px solid var(--line,#27405c);color:inherit;border-radius:999px;padding:6px 12px;font-size:13px;min-height:34px;cursor:pointer;opacity:.85}.brand{position:relative}.wrap>.brand,.brand{padding-right:0}.vmenu-wrap .menu-btn{padding:8px 12px;font-size:.72rem}';
    document.head.appendChild(css);
    host.style.position = 'relative'; host.appendChild(wrap);
    function set(o) { menu.classList.toggle('open', o); btn.setAttribute('aria-expanded', o ? 'true' : 'false'); }
    btn.addEventListener('click', function (e) { e.stopPropagation(); set(!menu.classList.contains('open')); });
    document.addEventListener('click', function (e) { if (!menu.contains(e.target)) set(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
    if (money) {
      try { vyro.db.collection('portals').where('bizId', '==', ctx.bizId).get().then(function (s) { var n = 0; s.forEach(function (d) { n += d.data().unreadCount || 0; }); if (n) { var m = menu.querySelector('a[href="messages.html"]'); if (m) m.textContent = 'Messages (' + n + ' new)'; btn.textContent = 'Settings ▾ •'; } }).catch(function () { /* optional */ }); } catch (e) { /* optional */ }
    }
  } };
})();
