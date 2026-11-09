// VyqilSplit: share costs with friends, roommates and trips. Works in cents so nothing drifts by a penny.
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  function pad(n) { return ('0' + n).slice(-2); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function money(c) { c = Math.round(+c || 0); var neg = c < 0; c = Math.abs(c); return (neg ? '-' : '') + '$' + Math.floor(c / 100).toLocaleString('en-US') + '.' + pad(c % 100); }
  function toCents(s) { var t = String(s == null ? '' : s).replace(/[$,\s]/g, ''); if (!/^\d*\.?\d{0,2}$/.test(t) || t === '' || t === '.') return NaN; return Math.round(parseFloat(t) * 100); }
  function fmtDate(s) { var p = String(s || '').split('-'); if (p.length !== 3) return ''; var M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; return M[+p[1] - 1] + ' ' + (+p[2]); }
  function toast(m) { var t = el('div', 'toast', m); document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3000); }
  function modal(build) { var m = el('div', 'modal'), sh = el('div', 'sheet'); m.appendChild(sh); function close() { if (m.parentNode) m.remove(); } m.addEventListener('click', function (e) { if (e.target === m) close(); }); build(sh, close); document.body.appendChild(m); return close; }
  function download(name, text, type) { var a = el('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function friendly(e) { var m = { 'auth/email-already-in-use': 'That email already has an account. Sign in instead.', 'auth/invalid-email': 'That email address does not look right.', 'auth/weak-password': 'Choose a stronger password (at least 10 characters).', 'auth/invalid-credential': 'Email or password is incorrect.', 'auth/wrong-password': 'Email or password is incorrect.', 'auth/user-not-found': 'Email or password is incorrect.', 'auth/too-many-requests': 'Too many tries. Wait a few minutes and try again.', 'auth/network-request-failed': 'No connection. Check your internet and try again.', 'permission-denied': 'Permission denied. The latest Firestore rules may not be published yet, or you are not in this group.' }; return m[e && e.code] || 'Something went wrong. Please try again.'; }
  function rid() { var a = new Uint8Array(5); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }

  firebase.initializeApp(window.VYRO_FIREBASE_CONFIG);
  var auth = firebase.auth(), db = firebase.firestore(), FV = firebase.firestore.FieldValue, root = $('app');
  try { db.enablePersistence({ synchronizeTabs: true }).catch(function () { /* optional */ }); } catch (e) { /* optional */ }
  var S = { user: null, groups: [], g: null, exp: [], set: [], tab: 'bal', unsub: [] }, JOIN = (/[?&]join=([A-Za-z0-9]{10,40})/.exec(location.search) || [])[1] || '';

  // ---------- the maths ----------
  // Splits an amount (cents) over people. mode: equal | exact | percent | shares. Returns {personId: cents} that always adds up exactly.
  function divide(total, mode, ids, vals) {
    var out = {}, i, rem;
    if (!ids.length) return out;
    if (mode === 'exact') { ids.forEach(function (p) { out[p] = Math.round(vals[p] || 0); }); return out; }
    var w = {}, sum = 0; ids.forEach(function (p) { w[p] = mode === 'equal' ? 1 : (+vals[p] || 0); sum += w[p]; });
    if (sum <= 0) { ids.forEach(function (p) { w[p] = 1; }); sum = ids.length; }
    var used = 0, frac = [];
    ids.forEach(function (p) { var x = total * w[p] / sum, f = Math.floor(x); out[p] = f; used += f; frac.push({ p: p, r: x - f }); });
    rem = total - used; frac.sort(function (a, b) { return b.r - a.r; });
    for (i = 0; i < rem; i++) out[frac[i % frac.length].p] += 1;
    return out;
  }
  function balances() {
    var b = {}; (S.g.people || []).forEach(function (p) { b[p.id] = 0; });
    S.exp.forEach(function (e) { if (b[e.paidBy] != null) b[e.paidBy] += e.amount; Object.keys(e.shares || {}).forEach(function (p) { if (b[p] != null) b[p] -= e.shares[p]; }); });
    S.set.forEach(function (s) { if (b[s.from] != null) b[s.from] += s.amount; if (b[s.to] != null) b[s.to] -= s.amount; });
    return b;
  }
  // Fewest payments that settle everyone (greedy: biggest debtor pays biggest creditor).
  function plan(b) {
    var cr = [], de = [], out = [];
    Object.keys(b).forEach(function (p) { if (b[p] > 0) cr.push({ p: p, a: b[p] }); else if (b[p] < 0) de.push({ p: p, a: -b[p] }); });
    while (cr.length && de.length) {
      cr.sort(function (x, y) { return y.a - x.a; }); de.sort(function (x, y) { return y.a - x.a; });
      var c = cr[0], d = de[0], m = Math.min(c.a, d.a); out.push({ from: d.p, to: c.p, amount: m }); c.a -= m; d.a -= m;
      if (c.a === 0) cr.shift(); if (d.a === 0) de.shift();
    }
    return out;
  }
  window.VS = { divide: divide, plan: plan };
  function nm(id) { var p = (S.g.people || []).filter(function (x) { return x.id === id; })[0]; return p ? p.name : '(removed)'; }
  function me() { var p = (S.g.people || []).filter(function (x) { return x.uid === S.user.uid; })[0]; return p ? p.id : ''; }

  // ---------- sign in ----------
  function authView() {
    root.textContent = ''; var w = el('div', 'auth'), lg = el('img', 'logo'); lg.src = 'images/logo.svg'; lg.alt = 'VyqilSplit'; w.appendChild(lg);
    w.appendChild(el('h1', '', 'VyqilSplit')); w.appendChild(el('p', 'sub', 'Split costs with friends, roommates and trips. See who owes who.'));
    var mode = /signup/.test(location.search) || JOIN ? 'up' : 'in', f = el('div'); w.appendChild(f);
    function paint() {
      f.textContent = ''; var seg = el('div', 'subs'), a = el('button', mode === 'in' ? 'on' : '', 'Sign in'), b = el('button', mode === 'up' ? 'on' : '', 'Create account'); a.type = b.type = 'button';
      a.onclick = function () { mode = 'in'; paint(); }; b.onclick = function () { mode = 'up'; paint(); }; seg.appendChild(a); seg.appendChild(b); f.appendChild(seg);
      function field(l, type, ac) { f.appendChild(el('label', 'f', l)); var i = el('input'); i.type = type; i.autocomplete = ac; f.appendChild(i); return i; }
      var em = field('Email', 'email', 'email'), pw = field('Password' + (mode === 'up' ? ' (at least 10 characters)' : ''), 'password', mode === 'up' ? 'new-password' : 'current-password'), msg = el('div', 'note err'); f.appendChild(msg);
      var bt = el('div', 'btns'), go = el('button', 'btn', mode === 'up' ? 'Create account' : 'Sign in'); go.type = 'button'; bt.appendChild(go); f.appendChild(bt);
      go.onclick = async function () { msg.textContent = ''; var e = em.value.trim().toLowerCase(), p = pw.value; if (!e || !p) { msg.textContent = 'Enter your email and password.'; return; } if (mode === 'up' && p.length < 10) { msg.textContent = 'Choose a password of at least 10 characters.'; return; } go.disabled = true; try { if (mode === 'up') await auth.createUserWithEmailAndPassword(e, p); else await auth.signInWithEmailAndPassword(e, p); } catch (x) { msg.textContent = friendly(x); go.disabled = false; } };
    }
    paint(); root.appendChild(w);
  }

  // ---------- groups ----------
  function listen() {
    S.unsub.forEach(function (u) { u(); }); S.unsub = [];
    S.unsub.push(db.collection('splitGroups').where('members', 'array-contains', S.user.uid).onSnapshot(function (snap) {
      S.groups = snap.docs.map(function (d) { var o = d.data(); o.id = d.id; return o; }).sort(function (a, b) { return a.name < b.name ? -1 : 1; });
      if (S.g) { var cur = S.groups.filter(function (x) { return x.id === S.g.id; })[0]; if (cur) S.g = cur; else { S.g = null; } }
      render();
    }, function (e) { root.textContent = ''; root.appendChild(el('p', 'err', friendly(e))); }));
  }
  function openGroup(g) {
    S.unsub.slice(1).forEach(function (u) { u(); }); S.unsub = S.unsub.slice(0, 1); S.g = g; S.exp = []; S.set = []; S.tab = 'bal';
    var ref = db.collection('splitGroups').doc(g.id);
    S.unsub.push(ref.collection('expenses').onSnapshot(function (s) { S.exp = s.docs.map(function (d) { var o = d.data(); o.id = d.id; return o; }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }); render(); }));
    S.unsub.push(ref.collection('settlements').onSnapshot(function (s) { S.set = s.docs.map(function (d) { var o = d.data(); o.id = d.id; return o; }); render(); }));
    render();
  }
  function newGroup() {
    modal(function (s, close) {
      s.appendChild(el('h3', '', 'New group')); s.appendChild(el('label', 'f', 'Group name')); var n = el('input'); n.placeholder = 'Lake trip, Apartment, Dinner club'; n.maxLength = 60; s.appendChild(n);
      s.appendChild(el('label', 'f', 'Your name in this group')); var y = el('input'); y.maxLength = 30; y.value = (S.user.displayName || (S.user.email || '').split('@')[0] || '').slice(0, 30); s.appendChild(y);
      s.appendChild(el('label', 'f', 'Other people (one per line, you can add more later)')); var o = el('textarea'); o.maxLength = 600; s.appendChild(o);
      var msg = el('div', 'note err'); s.appendChild(msg); var b = el('div', 'btns'), go = el('button', 'btn', 'Create'), cn = el('button', 'btn ghost', 'Cancel'); go.type = cn.type = 'button'; b.appendChild(go); b.appendChild(cn); s.appendChild(b); cn.onclick = close;
      go.onclick = async function () {
        if (!n.value.trim() || !y.value.trim()) { msg.textContent = 'Enter a group name and your name.'; return; }
        var people = [{ id: 'p' + rid(), name: y.value.trim(), uid: S.user.uid }]; o.value.split('\n').map(function (x) { return x.trim().slice(0, 30); }).filter(Boolean).slice(0, 19).forEach(function (x) { people.push({ id: 'p' + rid(), name: x, uid: '' }); });
        go.disabled = true; try { var ref = await db.collection('splitGroups').add({ name: n.value.trim(), members: [S.user.uid], people: people, currency: 'USD', createdBy: S.user.uid, createdAt: FV.serverTimestamp() }); close(); toast('Group created.'); } catch (e) { msg.textContent = friendly(e); go.disabled = false; }
      };
    });
  }
  function inviteLink(g) { return location.origin + location.pathname.replace(/[^/]*$/, '') + 'index.html?join=' + g.id; }
  function invite() {
    modal(function (s, close) {
      s.appendChild(el('h3', '', 'Invite people')); s.appendChild(el('p', 'hint', 'Anyone with this link can join the group, so only send it to the people you want. They will need a free account.'));
      var i = el('input'); i.readOnly = true; i.value = inviteLink(S.g); i.onclick = function () { i.select(); }; s.appendChild(i);
      var b = el('div', 'btns'), cp = el('button', 'btn', 'Copy link'), sh = el('button', 'btn ghost', 'Share'), x = el('button', 'btn ghost', 'Close'); cp.type = sh.type = x.type = 'button'; b.appendChild(cp); if (navigator.share) b.appendChild(sh); b.appendChild(x); s.appendChild(b); x.onclick = close;
      cp.onclick = function () { (navigator.clipboard ? navigator.clipboard.writeText(i.value) : Promise.reject()).then(function () { toast('Link copied.'); }, function () { i.select(); toast('Press and hold to copy.'); }); };
      sh.onclick = function () { navigator.share({ title: 'Join ' + S.g.name + ' on VyqilSplit', url: i.value }).catch(function () { /* cancelled */ }); };
    });
  }
  async function doJoin(gid) {
    try { await db.collection('splitGroups').doc(gid).update({ members: FV.arrayUnion(S.user.uid) }); history.replaceState(null, '', location.pathname); JOIN = ''; toast('You joined the group.'); var d = await db.collection('splitGroups').doc(gid).get(); var g = d.data(); g.id = gid; if (!(g.people || []).some(function (p) { return p.uid === S.user.uid; })) claim(g); }
    catch (e) { JOIN = ''; history.replaceState(null, '', location.pathname); toast('Could not join. The link may be wrong or out of date.'); }
  }
  // "Which one are you?" after joining.
  function claim(g) {
    modal(function (s, close) {
      s.appendChild(el('h3', '', 'Which one are you?')); var free = (g.people || []).filter(function (p) { return !p.uid; });
      free.forEach(function (p) { var b = el('button', 'btn ghost', p.name); b.type = 'button'; b.style.cssText = 'display:block;width:100%;margin:6px 0'; b.onclick = async function () { var people = g.people.map(function (x) { return x.id === p.id ? { id: x.id, name: x.name, uid: S.user.uid } : x; }); try { await db.collection('splitGroups').doc(g.id).update({ people: people }); close(); } catch (e) { toast(friendly(e)); } }; s.appendChild(b); });
      s.appendChild(el('label', 'f', 'Or add yourself as new')); var i = el('input'); i.maxLength = 30; i.value = (S.user.email || '').split('@')[0].slice(0, 30); s.appendChild(i); var b2 = el('button', 'btn', 'Add me'); b2.type = 'button'; b2.onclick = async function () { if (!i.value.trim()) return; var people = (g.people || []).concat([{ id: 'p' + rid(), name: i.value.trim(), uid: S.user.uid }]); try { await db.collection('splitGroups').doc(g.id).update({ people: people }); close(); } catch (e) { toast(friendly(e)); } }; s.appendChild(b2);
    });
  }

  // ---------- views ----------
  function render() {
    root.textContent = ''; if (!S.g) return homeView();
    var top = el('div', 'top'), bk = el('button', 'ibtn', '←'); bk.type = 'button'; bk.setAttribute('aria-label', 'All groups'); bk.onclick = function () { S.unsub.slice(1).forEach(function (u) { u(); }); S.unsub = S.unsub.slice(0, 1); S.g = null; render(); }; top.appendChild(bk);
    var t = el('div', 't'); t.appendChild(el('b', '', S.g.name)); t.appendChild(el('span', '', (S.g.people || []).length + ' people')); top.appendChild(t);
    var iv = el('button', 'ibtn', '👥'); iv.type = 'button'; iv.setAttribute('aria-label', 'Invite'); iv.onclick = invite; top.appendChild(iv); root.appendChild(top);
    var v = el('main'); root.appendChild(v);
    var nav = el('div', 'tabs'); [['bal', 'Balances', '⚖'], ['exp', 'Expenses', '🧾'], ['ppl', 'People', '👥']].forEach(function (x) { var b = el('button', S.tab === x[0] ? 'on' : ''); b.type = 'button'; b.appendChild(el('i', '', x[2])); b.appendChild(document.createTextNode(x[1])); b.onclick = function () { S.tab = x[0]; render(); }; nav.appendChild(b); }); root.appendChild(nav);
    var fab = el('button', 'fab', '+ Expense'); fab.type = 'button'; fab.onclick = function () { expenseForm(); }; if (S.tab !== 'ppl') root.appendChild(fab);
    if (S.tab === 'bal') balView(v); else if (S.tab === 'exp') expView(v); else pplView(v);
  }
  function homeView() {
    var top = el('div', 'top'), lg = el('img'); lg.src = 'images/logo.svg'; lg.alt = ''; top.appendChild(lg); var t = el('div', 't'); t.appendChild(el('b', '', 'VyqilSplit')); t.appendChild(el('span', '', S.user.email || '')); top.appendChild(t);
    var out = el('button', 'ibtn', '⏻'); out.type = 'button'; out.setAttribute('aria-label', 'Sign out'); out.onclick = function () { auth.signOut(); }; top.appendChild(out); root.appendChild(top);
    var v = el('main'); root.appendChild(v); v.appendChild(el('h2', '', 'Your groups'));
    var c = el('div', 'card'); v.appendChild(c);
    if (!S.groups.length) c.appendChild(el('div', 'empty', 'No groups yet. Make one for a trip, your apartment or a night out.'));
    S.groups.forEach(function (g) { var r = el('div', 'row tap'), m = el('div', 'm'); m.appendChild(el('b', '', g.name)); m.appendChild(el('span', '', (g.people || []).length + ' people')); r.appendChild(m); r.onclick = function () { openGroup(g); }; c.appendChild(r); });
    var b = el('div', 'btns'), nb = el('button', 'btn', '+ New group'); nb.type = 'button'; nb.onclick = newGroup; b.appendChild(nb); v.appendChild(b);
    v.appendChild(el('div', 'note', 'Everyone in a group sees its expenses and balances. VyqilSplit keeps score; it does not move money.'));
  }
  function balView(v) {
    var b = balances(), mine = me(), tot = 0; S.exp.forEach(function (e) { tot += e.amount; });
    var st = el('div', 'stat'); [['Total spent', money(tot)], [mine ? 'Your balance' : 'Balance', mine ? money(b[mine] || 0) : '-']].forEach(function (x) { var d = el('div'); d.appendChild(el('b', '', x[1])); d.appendChild(el('span', '', x[0])); st.appendChild(d); }); v.appendChild(st);
    v.appendChild(el('h2', '', 'Who is owed')); var c = el('div', 'card'); v.appendChild(c);
    (S.g.people || []).forEach(function (p) { var x = b[p.id] || 0, r = el('div', 'row'), m = el('div', 'm'); m.appendChild(el('b', '', p.name + (p.uid === S.user.uid ? ' (you)' : ''))); m.appendChild(el('span', '', x > 0 ? 'is owed' : x < 0 ? 'owes' : 'settled up')); r.appendChild(m); r.appendChild(el('span', 'amt', money(Math.abs(x)))); if (x > 0) r.lastChild.style.color = 'var(--green,#3ddc97)'; if (x < 0) r.lastChild.style.color = 'var(--red)'; c.appendChild(r); });
    var pl = plan(b); v.appendChild(el('h2', '', 'Settle up')); var c2 = el('div', 'card'); v.appendChild(c2);
    if (!pl.length) c2.appendChild(el('div', 'empty', 'Everyone is even.'));
    pl.forEach(function (x) { var r = el('div', 'row'), m = el('div', 'm'); m.appendChild(el('b', '', nm(x.from) + ' pays ' + nm(x.to))); r.appendChild(m); r.appendChild(el('span', 'amt', money(x.amount))); var bt = el('button', 'btn sm', 'Mark paid'); bt.type = 'button'; bt.onclick = function () { db.collection('splitGroups').doc(S.g.id).collection('settlements').add({ from: x.from, to: x.to, amount: x.amount, date: today(), by: S.user.uid, createdAt: FV.serverTimestamp() }).then(function () { toast('Recorded.'); }, function (e) { toast(friendly(e)); }); }; r.appendChild(bt); c2.appendChild(r); });
    if (pl.length) c2.appendChild(el('div', 'hint', 'These are the fewest payments that make everyone even. Pay outside the app, then tap Mark paid.'));
    if (S.set.length) { v.appendChild(el('h2', '', 'Payments recorded')); var c3 = el('div', 'card'); v.appendChild(c3); S.set.slice().sort(function (a, b2) { return a.date < b2.date ? 1 : -1; }).forEach(function (x) { var r = el('div', 'row'), m = el('div', 'm'); m.appendChild(el('b', '', nm(x.from) + ' paid ' + nm(x.to))); m.appendChild(el('span', '', fmtDate(x.date))); r.appendChild(m); r.appendChild(el('span', 'amt', money(x.amount))); var d = el('button', 'btn ghost sm', 'Undo'); d.type = 'button'; d.onclick = function () { db.collection('splitGroups').doc(S.g.id).collection('settlements').doc(x.id).delete(); }; r.appendChild(d); c3.appendChild(r); }); }
  }
  function expView(v) {
    var h = el('h2', '', 'Expenses'); h.appendChild(el('small', '', S.exp.length + ' total')); v.appendChild(h); var c = el('div', 'card'); v.appendChild(c);
    if (!S.exp.length) c.appendChild(el('div', 'empty', 'No expenses yet. Tap + Expense.'));
    S.exp.forEach(function (e) { var r = el('div', 'row tap'), m = el('div', 'm'); m.appendChild(el('b', '', e.desc)); m.appendChild(el('span', '', nm(e.paidBy) + ' paid · ' + fmtDate(e.date) + ' · ' + Object.keys(e.shares || {}).length + ' sharing')); r.appendChild(m); r.appendChild(el('span', 'amt', money(e.amount))); r.onclick = function () { expenseForm(e); }; c.appendChild(r); });
    var b = el('div', 'btns'), cs = el('button', 'btn ghost', 'Download CSV'); cs.type = 'button'; cs.onclick = function () { var rows = [['Date', 'Description', 'Paid by', 'Amount']].concat(S.exp.map(function (e) { return [e.date, e.desc, nm(e.paidBy), (e.amount / 100).toFixed(2)]; })); download('split-' + S.g.name.replace(/[^\w]+/g, '-') + '.csv', rows.map(function (r) { return r.map(function (x) { var s = String(x); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n'), 'text/csv'); }; b.appendChild(cs); v.appendChild(b);
  }
  function pplView(v) {
    v.appendChild(el('h2', '', 'People')); var c = el('div', 'card'); v.appendChild(c);
    (S.g.people || []).forEach(function (p) { var r = el('div', 'row tap'), m = el('div', 'm'); m.appendChild(el('b', '', p.name + (p.uid === S.user.uid ? ' (you)' : ''))); m.appendChild(el('span', '', p.uid ? 'Has the app' : 'Not joined yet')); r.appendChild(m); r.onclick = function () { renamePerson(p); }; c.appendChild(r); });
    var b = el('div', 'btns'), ab = el('button', 'btn', '+ Add person'), iv = el('button', 'btn ghost', 'Invite link'); ab.type = iv.type = 'button'; ab.onclick = function () { modal(function (s, close) { s.appendChild(el('h3', '', 'Add person')); var i = el('input'); i.maxLength = 30; s.appendChild(i); var bb = el('div', 'btns'), go = el('button', 'btn', 'Add'); go.type = 'button'; bb.appendChild(go); s.appendChild(bb); go.onclick = async function () { if (!i.value.trim() || (S.g.people || []).length >= 20) return; try { await db.collection('splitGroups').doc(S.g.id).update({ people: (S.g.people || []).concat([{ id: 'p' + rid(), name: i.value.trim(), uid: '' }]) }); close(); } catch (e) { toast(friendly(e)); } }; }); }; iv.onclick = invite; b.appendChild(ab); b.appendChild(iv); v.appendChild(b);
    var mine = (S.g.people || []).some(function (p) { return p.uid === S.user.uid; }); if (!mine) { var cl = el('button', 'btn ghost', 'Which one are you?'); cl.type = 'button'; cl.style.marginTop = '10px'; cl.onclick = function () { claim(S.g); }; v.appendChild(cl); }
    if (S.g.createdBy === S.user.uid) { var lv = el('button', 'btn danger', 'Delete this group'); lv.type = 'button'; lv.style.marginTop = '18px'; lv.onclick = function () { modal(function (s, close) { s.appendChild(el('p', '', 'Delete "' + S.g.name + '" for everyone? All its expenses are lost. Download the CSV first if you need a record.')); var bb = el('div', 'btns'), y = el('button', 'btn danger', 'Delete'), n = el('button', 'btn ghost', 'Cancel'); y.type = n.type = 'button'; bb.appendChild(y); bb.appendChild(n); s.appendChild(bb); n.onclick = close; y.onclick = async function () { try { var ref = db.collection('splitGroups').doc(S.g.id); var ex = await ref.collection('expenses').get(), se = await ref.collection('settlements').get(); var ops = ex.docs.concat(se.docs); for (var i = 0; i < ops.length; i++) await ops[i].ref.delete(); await ref.delete(); close(); S.g = null; render(); } catch (e) { toast(friendly(e)); } }; }); }; v.appendChild(lv); }
  }
  function renamePerson(p) { modal(function (s, close) { s.appendChild(el('h3', '', 'Edit name')); var i = el('input'); i.value = p.name; i.maxLength = 30; s.appendChild(i); var bb = el('div', 'btns'), go = el('button', 'btn', 'Save'); go.type = 'button'; bb.appendChild(go); s.appendChild(bb); go.onclick = async function () { if (!i.value.trim()) return; try { await db.collection('splitGroups').doc(S.g.id).update({ people: S.g.people.map(function (x) { return x.id === p.id ? { id: x.id, name: i.value.trim(), uid: x.uid } : x; }) }); close(); } catch (e) { toast(friendly(e)); } }; }); }

  // ---------- add / edit an expense ----------
  function expenseForm(e) {
    var isNew = !e, ppl = S.g.people || [];
    modal(function (s, close) {
      s.appendChild(el('h3', '', isNew ? 'New expense' : 'Expense'));
      s.appendChild(el('label', 'f', 'What was it for')); var d = el('input'); d.maxLength = 100; d.value = e ? e.desc : ''; s.appendChild(d);
      s.appendChild(el('label', 'f', 'Amount')); var a = el('input'); a.inputMode = 'decimal'; a.value = e ? (e.amount / 100).toFixed(2) : ''; s.appendChild(a);
      s.appendChild(el('label', 'f', 'Paid by')); var pb = el('select'); ppl.forEach(function (p) { var o = el('option', '', p.name); o.value = p.id; pb.appendChild(o); }); pb.value = e ? e.paidBy : (me() || ppl[0].id); s.appendChild(pb);
      s.appendChild(el('label', 'f', 'Date')); var dt = el('input'); dt.type = 'date'; dt.value = e ? e.date : today(); s.appendChild(dt);
      s.appendChild(el('label', 'f', 'How to split')); var md = el('select'); [['equal', 'Equally'], ['exact', 'Exact amounts'], ['percent', 'Percentages'], ['shares', 'Shares']].forEach(function (x) { var o = el('option', '', x[1]); o.value = x[0]; md.appendChild(o); }); md.value = e && e.mode ? e.mode : 'equal'; s.appendChild(md);
      var box = el('div'), rows = {}; s.appendChild(box);
      function draw() {
        box.textContent = ''; rows = {};
        ppl.forEach(function (p) {
          var r = el('div', 'ck'), cb = el('input'); cb.type = 'checkbox'; cb.checked = e ? (e.shares && e.shares[p.id] != null) : true; var m = el('div', 'm'); m.appendChild(el('b', '', p.name)); r.appendChild(cb); r.appendChild(m);
          var inp = null; if (md.value !== 'equal') { inp = el('input'); inp.inputMode = 'decimal'; inp.style.cssText = 'width:90px;min-height:38px'; inp.placeholder = md.value === 'exact' ? '0.00' : md.value === 'percent' ? '%' : '1'; if (e && e.vals && e.vals[p.id] != null && e.mode === md.value) inp.value = md.value === 'exact' ? (e.vals[p.id] / 100).toFixed(2) : e.vals[p.id]; else if (md.value === 'shares') inp.value = '1'; r.appendChild(inp); }
          box.appendChild(r); rows[p.id] = { cb: cb, inp: inp };
        });
        box.appendChild(el('div', 'note', md.value === 'exact' ? 'The amounts must add up to the total.' : md.value === 'percent' ? 'Percentages must add up to 100.' : md.value === 'shares' ? 'A person with 2 shares pays twice as much as one with 1.' : 'The cost is divided evenly between the people ticked. Any odd cents are shared out fairly.'));
      }
      md.onchange = draw; draw();
      var msg = el('div', 'note err'); s.appendChild(msg);
      var bt = el('div', 'btns'), sv = el('button', 'btn', 'Save'), cn = el('button', 'btn ghost', 'Cancel'); sv.type = cn.type = 'button'; bt.appendChild(sv); bt.appendChild(cn);
      if (!isNew) { var dl = el('button', 'btn danger', 'Delete'); dl.type = 'button'; bt.appendChild(dl); dl.onclick = async function () { try { await db.collection('splitGroups').doc(S.g.id).collection('expenses').doc(e.id).delete(); close(); toast('Deleted.'); } catch (x) { msg.textContent = friendly(x); } }; }
      s.appendChild(bt); cn.onclick = close;
      sv.onclick = async function () {
        var amt = toCents(a.value); if (!d.value.trim()) { msg.textContent = 'Enter what it was for.'; return; } if (isNaN(amt) || amt <= 0 || amt > 100000000) { msg.textContent = 'Enter an amount like 42.50.'; return; }
        var ids = ppl.filter(function (p) { return rows[p.id].cb.checked; }).map(function (p) { return p.id; }); if (!ids.length) { msg.textContent = 'Tick at least one person.'; return; }
        var vals = {}, mode = md.value; ids.forEach(function (p) { var v = rows[p].inp ? rows[p].inp.value : ''; vals[p] = mode === 'exact' ? toCents(v === '' ? '0' : v) : parseFloat(v); if (mode !== 'equal' && (isNaN(vals[p]) || vals[p] < 0)) vals[p] = NaN; });
        if (mode !== 'equal') { for (var i = 0; i < ids.length; i++) if (isNaN(vals[ids[i]])) { msg.textContent = 'Check the numbers next to each name.'; return; } }
        var sum = 0; ids.forEach(function (p) { sum += vals[p] || 0; });
        if (mode === 'exact' && sum !== amt) { msg.textContent = 'The amounts add up to ' + money(sum) + ' but the total is ' + money(amt) + '.'; return; }
        if (mode === 'percent' && Math.abs(sum - 100) > 0.01) { msg.textContent = 'The percentages add up to ' + sum + ', not 100.'; return; }
        if (mode === 'shares' && sum <= 0) { msg.textContent = 'Enter at least one share.'; return; }
        var shares = divide(amt, mode, ids, vals), data = { desc: d.value.trim(), amount: amt, paidBy: pb.value, date: dt.value || today(), mode: mode, shares: shares, vals: mode === 'equal' ? {} : vals, updatedBy: S.user.uid };
        sv.disabled = true; var ref = db.collection('splitGroups').doc(S.g.id).collection('expenses');
        try { if (isNew) { data.createdAt = FV.serverTimestamp(); await ref.add(data); } else await ref.doc(e.id).update(data); close(); toast('Saved.'); } catch (x) { msg.textContent = friendly(x); sv.disabled = false; }
      };
    });
  }

  auth.onAuthStateChanged(function (u) {
    S.user = u; if (!u) { S.unsub.forEach(function (x) { x(); }); S.unsub = []; S.g = null; authView(); return; }
    root.textContent = ''; root.appendChild(el('div', 'empty', 'Loading...')); listen(); if (JOIN) doJoin(JOIN);
  });
})();
