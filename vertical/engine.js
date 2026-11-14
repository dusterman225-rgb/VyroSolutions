// VyqilBusiness engine: one small, phone-first app builder used by VyqilRealtor, VyqilLandlord, VyqilSalon, VyqilServices,
// VyqilAuto, VyqilPhoto and VyqilLessons. Each app is a settings file (window.VQ_APP) describing its records, fields,
// checklists and reminders. Records live in businesses/{id}/records, so one business never sees another's data.
(function () {
  'use strict';
  var C = window.VQ_APP, Q = window.Q = { S: { recs: [], biz: null, user: null, tab: 'today', filter: {}, q: '' }, extras: [], onStart: [] };
  var S = Q.S;

  // ---------- small helpers ----------
  function $(id) { return document.getElementById(id); }
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  function pad(n) { return ('0' + n).slice(-2); }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function today() { return ymd(new Date()); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return ymd(d); }
  function diff(a, b) { return Math.round((parse(a) - parse(b)) / 86400000); }
  function isDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function fmtDate(s) { if (!isDate(s)) return ''; var d = parse(s); return DOW[d.getDay()] + ' ' + MON[d.getMonth()] + ' ' + d.getDate() + (d.getFullYear() !== new Date().getFullYear() ? ', ' + d.getFullYear() : ''); }
  function fmtTime(t) { var m = /^(\d{1,2}):(\d{2})/.exec(t || ''); if (!m) return ''; var h = +m[1]; return ((h + 11) % 12 + 1) + ':' + m[2] + (h < 12 ? ' AM' : ' PM'); }
  function rel(s) { var n = diff(s, today()); return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n === -1 ? 'yesterday' : n > 0 ? 'in ' + n + ' days' : -n + ' days ago'; }
  function money(c) { c = Math.round(+c || 0); var neg = c < 0; c = Math.abs(c); return (neg ? '-' : '') + '$' + Math.floor(c / 100).toLocaleString('en-US') + '.' + pad(c % 100); }
  function toCents(s) { var t = String(s == null ? '' : s).replace(/[$,\s]/g, ''); if (t === '') return null; if (!/^-?\d*\.?\d{0,2}$/.test(t) || t === '-' || t === '.') return NaN; return Math.round(parseFloat(t) * 100); }
  function dollars(c) { return c == null ? '' : (c / 100).toFixed(2); }
  function id12() { var a = new Uint8Array(6); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }
  Q.u = { $: $, el: el, ymd: ymd, parse: parse, today: today, addDays: addDays, diff: diff, fmtDate: fmtDate, fmtTime: fmtTime, rel: rel, money: money, isDate: isDate };

  function toast(msg, label, fn) {
    var t = el('div', 'toast'); t.appendChild(document.createTextNode(msg + ' '));
    if (label) { var b = el('button', '', label); b.type = 'button'; b.onclick = function () { t.remove(); fn(); }; t.appendChild(b); }
    document.body.appendChild(t); setTimeout(function () { if (t.parentNode) t.remove(); }, label ? 7000 : 3200);
  }
  function modal(build) {
    var m = el('div', 'modal'), sh = el('div', 'sheet'); m.appendChild(sh);
    function close() { if (m.parentNode) m.remove(); }
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
    build(sh, close); document.body.appendChild(m); return close;
  }
  function ask(msg, yes, fn) { modal(function (s, close) { s.appendChild(el('p', '', msg)); var b = el('div', 'btns'), y = el('button', 'btn danger', yes), n = el('button', 'btn ghost', 'Cancel'); y.type = n.type = 'button'; y.onclick = function () { close(); fn(); }; n.onclick = close; b.appendChild(y); b.appendChild(n); s.appendChild(b); }); }
  function download(name, text, type) { var a = el('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function friendly(e) {
    var m = { 'auth/email-already-in-use': 'That email already has an account. Sign in instead.', 'auth/invalid-email': 'That email address does not look right.', 'auth/weak-password': 'Choose a stronger password (at least 10 characters).', 'auth/invalid-credential': 'Email or password is incorrect.', 'auth/wrong-password': 'Email or password is incorrect.', 'auth/user-not-found': 'Email or password is incorrect.', 'auth/too-many-requests': 'Too many tries. Wait a few minutes and try again.', 'auth/network-request-failed': 'No connection. Check your internet and try again.', 'permission-denied': 'Permission denied. The latest Firestore rules may not be published yet.' };
    return m[e && e.code] || 'Something went wrong. Please try again.';
  }

  // ---------- Firebase ----------
  firebase.initializeApp(window.VYRO_FIREBASE_CONFIG);
  var auth = firebase.auth(), db = firebase.firestore(), FV = firebase.firestore.FieldValue;
  try { db.enablePersistence({ synchronizeTabs: true }).catch(function () { /* optional */ }); } catch (e) { /* optional */ }
  function recs() { return db.collection('businesses').doc(S.biz.id).collection('records'); }
  Q.db = db; Q.recs = recs; Q.FV = FV; Q.modal = modal; Q.toast = toast; Q.ask = ask; Q.friendly = friendly;

  // ---------- sign in / create account ----------
  var root = $('app');
  function authView() {
    root.textContent = ''; var w = el('div', 'auth');
    var logo = el('img', 'logo' + (C.logoWide ? ' wide' : '')); logo.src = C.logoWide || C.logo || '/icons/icon-192.png'; logo.alt = C.name; w.appendChild(logo);
    if (!C.logoWide) w.appendChild(el('h1', '', C.name)); w.appendChild(el('p', 'sub', C.who + '. ' + (C.tag || '')));
    var mode = /signup/.test(location.search) ? 'up' : 'in';
    var f = el('div'); w.appendChild(f);
    function paint() {
      f.textContent = '';
      var seg = el('div', 'subs'), a = el('button', mode === 'in' ? 'on' : '', 'Sign in'), b = el('button', mode === 'up' ? 'on' : '', 'Create account'); a.type = b.type = 'button';
      a.onclick = function () { mode = 'in'; paint(); }; b.onclick = function () { mode = 'up'; paint(); }; seg.appendChild(a); seg.appendChild(b); f.appendChild(seg);
      function field(l, type, ph, ac) { var lab = el('label', 'f', l), i = el('input'); i.type = type; i.placeholder = ph || ''; i.autocomplete = ac || 'off'; f.appendChild(lab); f.appendChild(i); return i; }
      var biz = mode === 'up' ? field('Business name (leave blank if a team invited you)', 'text', 'Your business name', 'organization') : null;
      var em = field('Email', 'email', 'you@example.com', 'email'), pw = field('Password' + (mode === 'up' ? ' (at least 10 characters)' : ''), 'password', '', mode === 'up' ? 'new-password' : 'current-password');
      var msg = el('div', 'note err'); f.appendChild(msg);
      var btns = el('div', 'btns'), go = el('button', 'btn', mode === 'up' ? 'Create account' : 'Sign in'); go.type = 'button'; btns.appendChild(go); f.appendChild(btns);
      go.onclick = async function () {
        msg.textContent = ''; var e = em.value.trim().toLowerCase(), p = pw.value;
        if (!e || !p) { msg.textContent = 'Enter your email and password.'; return; }
        if (mode === 'up') { if (p.length < 10) { msg.textContent = 'Choose a password of at least 10 characters.'; return; } }
        go.disabled = true;
        try {
          if (mode === 'up') { S.pendingName = biz.value.trim().slice(0, 80); await auth.createUserWithEmailAndPassword(e, p); }
          else await auth.signInWithEmailAndPassword(e, p);
        } catch (err) { msg.textContent = friendly(err); go.disabled = false; }
      };
      if (mode === 'in') { var fg = el('button', 'btn ghost sm', 'Forgot your password?'); fg.type = 'button'; fg.style.marginTop = '10px'; fg.onclick = async function () { var e = em.value.trim(); if (!e) { msg.textContent = 'Type your email first.'; return; } try { await auth.sendPasswordResetEmail(e); msg.className = 'note'; msg.textContent = 'If that email has an account, a reset link is on its way.'; } catch (x) { msg.className = 'note err'; msg.textContent = friendly(x); } }; f.appendChild(fg); }
    }
    paint(); root.appendChild(w);
  }

  // ---------- find or create this app's business ----------
  async function boot(user) {
    S.user = user; root.textContent = ''; root.appendChild(el('div', 'empty', 'Loading...'));
    try {
      var ud = await db.collection('users').doc(user.uid).get(), ids = (ud.exists && ud.data().bizIds) || [], found = null;
      for (var i = 0; i < ids.length && !found; i++) {
        var b = await db.collection('businesses').doc(ids[i]).get();
        if (b.exists && b.data().product === C.id) { var m = await db.collection('businesses').doc(ids[i]).collection('members').doc(user.uid).get(); if (m.exists) found = { id: ids[i], name: b.data().name, role: m.data().role }; }
      }
      if (!found) { var inv = await pendingInvites(user); found = inv.length ? await inviteScreen(inv, user) : await createBiz(user); }
      if (!found) return;
      S.biz = found; startApp();
    } catch (e) { root.textContent = ''; var w = el('div', 'auth'); w.appendChild(el('p', 'err', friendly(e))); var o = el('button', 'btn ghost', 'Sign out'); o.onclick = function () { auth.signOut(); }; w.appendChild(o); root.appendChild(w); }
  }
  async function pendingInvites(user) {
    var out = []; try { var q = await db.collection('invites').where('email', '==', (user.email || '').toLowerCase()).get(); q.forEach(function (d) { var x = d.data(); x.id = d.id; if (x.product === C.id) out.push(x); }); } catch (e) { /* none */ }
    return out;
  }
  function roleLabel(r) { return r === 'owner' ? 'Owner' : r === 'gm' ? 'Manager' : 'Staff'; }
  function inviteScreen(list, user) {
    return new Promise(function (resolve) {
      root.textContent = ''; var w = el('div', 'auth'); w.appendChild(el('h1', '', 'You have been invited')); w.appendChild(el('p', 'sub', C.name));
      var msg = el('div', 'note err');
      list.forEach(function (inv) {
        var c = el('div', 'card'); c.appendChild(el('div', 'hint', (inv.bizName || 'A business') + ' invited you to join as ' + roleLabel(inv.role) + '.'));
        var b = el('div', 'btns'), a = el('button', 'btn', 'Accept'), d = el('button', 'btn ghost', 'Decline'); a.type = d.type = 'button'; b.appendChild(a); b.appendChild(d); c.appendChild(b); w.appendChild(c);
        a.onclick = async function () { a.disabled = true; try {
          var md = { role: inv.role, email: (user.email || '').toLowerCase(), name: inv.name || '', addedBy: inv.addedBy, inviteId: inv.id, createdAt: FV.serverTimestamp() };
          await db.collection('businesses').doc(inv.bizId).collection('members').doc(user.uid).set(md);
          await db.collection('users').doc(user.uid).set({ email: (user.email || '').toLowerCase(), bizId: inv.bizId, bizIds: FV.arrayUnion(inv.bizId) }, { merge: true });
          try { await db.collection('invites').doc(inv.id).delete(); } catch (e) { /* ignore */ }
          resolve({ id: inv.bizId, name: inv.bizName || '', role: inv.role });
        } catch (e) { msg.textContent = friendly(e); a.disabled = false; } };
        d.onclick = async function () { try { await db.collection('invites').doc(inv.id).delete(); } catch (e) { /* ignore */ } c.remove(); if (!w.querySelector('.card')) createBiz(user).then(resolve); };
      });
      w.appendChild(msg); var own = el('button', 'btn ghost sm', 'Start my own business instead'); own.type = 'button'; own.style.marginTop = '12px'; own.onclick = function () { createBiz(user).then(resolve); }; w.appendChild(own);
      var out = el('button', 'btn ghost sm', 'Sign out'); out.type = 'button'; out.style.cssText = 'margin:12px 0 0 8px'; out.onclick = function () { auth.signOut(); resolve(null); }; w.appendChild(out);
      root.appendChild(w);
    });
  }
  function isAdmin() { return S.biz && (S.biz.role === 'owner' || S.biz.role === 'gm'); }
  function createBiz(user) {
    return new Promise(function (resolve, reject) {
      async function make(name) {
        var ref = db.collection('businesses').doc(), batch = db.batch();
        batch.set(ref, { name: name, ownerUid: user.uid, product: C.id, createdAt: FV.serverTimestamp() });
        batch.set(ref.collection('members').doc(user.uid), { role: 'owner', email: (user.email || '').toLowerCase(), createdAt: FV.serverTimestamp() });
        batch.set(db.collection('users').doc(user.uid), { email: (user.email || '').toLowerCase(), bizId: ref.id, bizIds: FV.arrayUnion(ref.id) }, { merge: true });
        await batch.commit(); return { id: ref.id, name: name, role: 'owner' };
      }
      if (S.pendingName) { var n = S.pendingName; S.pendingName = ''; make(n).then(resolve, reject); return; }
      root.textContent = ''; var w = el('div', 'auth'); w.appendChild(el('h1', '', 'Set up ' + C.name)); w.appendChild(el('p', 'sub', 'What is your business called?'));
      var i = el('input'); i.placeholder = 'Business name'; i.maxLength = 80; w.appendChild(i);
      var msg = el('div', 'note err'); w.appendChild(msg); var b = el('div', 'btns'), go = el('button', 'btn', 'Continue'), out = el('button', 'btn ghost', 'Sign out'); go.type = out.type = 'button'; b.appendChild(go); b.appendChild(out); w.appendChild(b);
      out.onclick = function () { auth.signOut(); resolve(null); };
      go.onclick = function () { if (!i.value.trim()) { msg.textContent = 'Enter a name.'; return; } go.disabled = true; make(i.value.trim()).then(resolve, function (e) { msg.textContent = friendly(e); go.disabled = false; }); };
      root.appendChild(w);
    });
  }

  // ---------- data model helpers ----------
  function kinds() { return Object.keys(C.kinds); }
  function K(k) { return C.kinds[k]; }
  function byKind(k) { return S.recs.filter(function (r) { return r.kind === k; }); }
  function get(id) { for (var i = 0; i < S.recs.length; i++) if (S.recs[i].id === id) return S.recs[i]; return null; }
  function fieldOf(k, key) { var f = K(k).fields; for (var i = 0; i < f.length; i++) if (f[i].k === key) return f[i]; return null; }
  function title(r) { if (!r) return '(removed)'; var kd = K(r.kind); if (kd.title) return kd.title(r); return String(r[kd.fields[0].k] || '(untitled)'); }
  function stageOf(r) { var kd = K(r.kind); return kd.stage ? r[kd.stage] : ''; }
  function isClosed(r) { var kd = K(r.kind); return !!(kd.closed && kd.closed(r)); }
  function showVal(f, v, r) {
    if (f.t === 'money') return v == null || v === '' ? '' : money(v);
    if (f.t === 'date') return fmtDate(v); if (f.t === 'time') return fmtTime(v); if (f.t === 'check') return v ? 'Yes' : 'No';
    if (f.t === 'link') return v ? title(get(v)) : ''; if (f.t === 'calc') return f.fmt === 'money' ? money(f.f(r, S.recs)) : String(f.f(r, S.recs));
    return v == null ? '' : String(v);
  }
  Q.get = get; Q.byKind = byKind; Q.title = title;

  // ---------- reminders: every dated thing across all records ----------
  // Each event: { date, time?, label, rec, kind, over (bool), alert:{hour|before,eve}, act:{label,run} }
  function events(from, to) {
    var out = [], t = today();
    S.recs.forEach(function (r) {
      var kd = K(r.kind); if (!kd || isClosed(r)) return;
      kd.fields.forEach(function (f) {
        if (f.t !== 'date' || !(f.cal || f.alert) || !isDate(r[f.k])) return;
        if (f.onlyIf && !f.onlyIf(r)) return; if (f.doneIf && f.doneIf(r)) return;
        var d = r[f.k];
        if (f.yearly) { var y = new Date().getFullYear(), o = parse(d); var c = ymd(new Date(y, o.getMonth(), o.getDate())); if (c < from) c = ymd(new Date(y + 1, o.getMonth(), o.getDate())); d = c; }
        if (d > to && !(d < t)) return; if (d < from && !(d < t && !f.yearly && !f.once)) { if (!(d < t && !f.yearly)) return; }
        out.push({ date: d, time: f.timeField ? r[f.timeField] : '', label: f.lbl || f.l, rec: r, kind: r.kind, over: d < t, alert: f.alert, timeField: f.timeField });
      });
      (r.cl || []).forEach(function (it, i) {
        if (it.done || !isDate(it.due)) return; if (it.due > to && it.due >= t) return;
        out.push({ date: it.due, label: it.t, rec: r, kind: r.kind, over: it.due < t, alert: { hour: 8 }, cl: i, key: 'cl' + i });
      });
    });
    if (C.events) { try { C.events(S.recs, from, to).forEach(function (e) { e.over = e.date < t; out.push(e); }); } catch (x) { /* optional */ } }
    out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time || '') < (b.time || '') ? -1 : 1; });
    return out;
  }
  Q.events = events;

  // ---------- UI shell ----------
  function startApp() {
    db.collection('businesses').doc(S.biz.id).collection('records').onSnapshot(function (snap) {
      S.recs = snap.docs.map(function (d) { var o = d.data(); o.id = d.id; return o; }); S.loaded = true; render(); if (Q.push) Q.push.soon();
    }, function (e) { root.textContent = ''; root.appendChild(el('p', 'err', friendly(e))); });
    shell();
    Q.onStart.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
  }
  var tabsDef = function () {
    var t = [{ id: 'today', l: 'Today', i: '◎' }]; (C.tabKinds || kinds().slice(0, 3)).forEach(function (k) { t.push({ id: k, l: K(k).plural, i: K(k).icon || '■' }); });
    t.push({ id: 'more', l: 'More', i: '☰' }); return t;
  };
  function shell() {
    root.textContent = '';
    var top = el('div', 'top'), lg = el('img'); lg.src = C.logo || '/icons/icon-192.png'; lg.alt = ''; top.appendChild(lg);
    var t = el('div', 't'); t.appendChild(el('b', '', S.biz.name)); t.appendChild(el('span', '', C.name + ' · first version')); top.appendChild(t);
    var bell = el('button', 'ibtn', '🔔'); bell.type = 'button'; bell.setAttribute('aria-label', 'Phone alerts'); bell.onclick = function () { Q.push.panel(); }; top.appendChild(bell);
    root.appendChild(top); root.appendChild(el('main')); root.firstChild.nextSibling.id = 'view';
    var nav = el('div', 'tabs'); tabsDef().forEach(function (x) { var b = el('button'); b.type = 'button'; b.dataset.t = x.id; b.appendChild(el('i', '', x.i)); b.appendChild(document.createTextNode(x.l)); b.onclick = function () { S.tab = x.id; S.q = ''; render(); window.scrollTo(0, 0); }; nav.appendChild(b); }); root.appendChild(nav);
    var fab = el('button', 'fab', '+ New'); fab.id = 'fab'; fab.type = 'button'; fab.onclick = function () { var k = S.tab === 'today' || S.tab === 'more' ? (C.tabKinds || kinds())[0] : S.tab; if (S.tab === 'today') { quickAdd(); return; } openForm(k); }; root.appendChild(fab);
  }
  function render() {
    var v = $('view'); if (!v) return; v.textContent = '';
    Array.prototype.forEach.call(document.querySelectorAll('.tabs button'), function (b) { b.classList.toggle('on', b.dataset.t === S.tab); });
    var fab = $('fab'); if (fab) fab.style.display = S.tab === 'more' ? 'none' : '';
    if (S.tab === 'today') todayView(v); else if (S.tab === 'more') moreView(v); else listView(v, S.tab);
  }

  Q.render = render;
  function quickAdd() {
    modal(function (s, close) {
      s.appendChild(el('h3', '', 'Add')); var ks = kinds();
      ks.forEach(function (k) { var b = el('button', 'btn ghost', '+ ' + K(k).label); b.type = 'button'; b.style.cssText = 'display:block;width:100%;margin:6px 0'; b.onclick = function () { close(); openForm(k); }; s.appendChild(b); });
    });
  }

  // ---------- Today ----------
  function evRow(e, big) {
    var r = el('div', 'row tap'), m = el('div', 'm'), b = el('b', '', e.label + ': ' + (e.title || title(e.rec)));
    m.appendChild(b); var sp = el('span', '', fmtDate(e.date) + (e.time ? ' · ' + fmtTime(e.time) : '') + ' · ' + rel(e.date)); m.appendChild(sp); r.appendChild(m);
    if (e.over) r.appendChild(el('span', 'pill bad', 'Overdue'));
    if (e.act) { var a = el('button', 'btn sm', e.act.label); a.type = 'button'; a.onclick = function (ev) { ev.stopPropagation(); e.act.run(); }; r.appendChild(a); }
    r.onclick = function () { if (e.rec && e.rec.id) openForm(e.rec.kind, e.rec); }; return r;
  }
  function todayView(v) {
    var t = today(), evs = events(addDays(t, -365), addDays(t, 14));
    if (C.stats) { var st = el('div', 'stat'); C.stats.forEach(function (s) { var d = el('div'); d.appendChild(el('b', '', s.fn(S.recs, t))); d.appendChild(el('span', '', s.l)); st.appendChild(d); }); v.appendChild(st); }
    var over = evs.filter(function (e) { return e.over; }), td = evs.filter(function (e) { return e.date === t; }), wk = evs.filter(function (e) { return e.date > t && e.date <= addDays(t, 7); }), later = evs.filter(function (e) { return e.date > addDays(t, 7); });
    function sec(h, list, cls) {
      if (!list.length) return; var hh = el('h2', '', h); v.appendChild(hh); var c = el('div', 'card' + (cls || '')); list.slice(0, 30).forEach(function (e) { c.appendChild(evRow(e)); }); v.appendChild(c);
    }
    sec('Overdue', over, ' glow'); sec('Today', td); sec('Next 7 days', wk); sec('Later (next 2 weeks)', later);
    if (C.watch) C.watch.forEach(function (w) {
      var list = []; try { list = w.fn(S.recs, t) || []; } catch (x) { list = []; }
      if (!list.length) return; v.appendChild(el('h2', '', w.l)); var c = el('div', 'card');
      list.slice(0, 15).forEach(function (r) { var row = el('div', 'row tap'), m = el('div', 'm'); m.appendChild(el('b', '', title(r))); if (w.sub) m.appendChild(el('span', '', w.sub(r, S.recs, t))); row.appendChild(m); row.onclick = function () { openForm(r.kind, r); }; c.appendChild(row); }); v.appendChild(c);
    });
    if (!evs.length && !(C.watch && C.watch.length && v.querySelectorAll('.card').length)) {
      var e = el('div', 'card'); e.appendChild(el('div', 'empty', 'Nothing due. Add your first ' + K(kinds()[0]).label.toLowerCase() + ' with the + New button, and dated items show up here.')); v.appendChild(e);
    }
  }

  // ---------- lists ----------
  function listView(v, k) {
    var kd = K(k), all = byKind(k), q = (S.q || '').toLowerCase(), flt = S.filter[k] || '';
    var h = el('h2', '', kd.plural); h.appendChild(el('small', '', all.length + ' total')); v.appendChild(h);
    var s = el('input', 'search'); s.type = 'search'; s.placeholder = 'Search ' + kd.plural.toLowerCase(); s.value = S.q || ''; s.oninput = function () { S.q = s.value; var pos = s.selectionStart; listBody(); }; v.appendChild(s);
    if (kd.stage && fieldOf(k, kd.stage) && fieldOf(k, kd.stage).o) {
      var chips = el('div', 'subs'); [''].concat(fieldOf(k, kd.stage).o).forEach(function (o) { var b = el('button', flt === o ? 'on' : '', o || 'All'); b.type = 'button'; b.onclick = function () { S.filter[k] = o; render(); }; chips.appendChild(b); }); v.appendChild(chips);
    }
    var body = el('div', 'card'); v.appendChild(body);
    function listBody() {
      body.textContent = ''; var qq = (S.q || '').toLowerCase();
      var list = all.filter(function (r) { if (flt && r[kd.stage] !== flt) return false; if (!qq) return true; return JSON.stringify(r).toLowerCase().indexOf(qq) > -1 || title(r).toLowerCase().indexOf(qq) > -1; });
      if (kd.sort) list.sort(kd.sort); else list.sort(function (a, b) { return title(a).toLowerCase() < title(b).toLowerCase() ? -1 : 1; });
      if (!list.length) { body.appendChild(el('div', 'empty', all.length ? 'Nothing matches.' : 'No ' + kd.plural.toLowerCase() + ' yet. Tap + New to add one.')); return; }
      list.forEach(function (r) {
        var row = el('div', 'row tap'), m = el('div', 'm'); m.appendChild(el('b', '', title(r)));
        var sub = kd.sub ? kd.sub(r, S.recs) : (kd.show || []).map(function (key) { var f = fieldOf(k, key); return f ? showVal(f, r[key], r) : ''; }).filter(Boolean).join(' · ');
        if (sub) m.appendChild(el('span', '', sub)); row.appendChild(m);
        if (kd.amount) { var a = kd.amount(r, S.recs); if (a != null && a !== '') row.appendChild(el('span', 'amt', typeof a === 'number' ? money(a) : a)); }
        if (kd.stage && r[kd.stage]) { var p = el('span', 'pill' + (isClosed(r) ? ' ok' : ''), r[kd.stage]); row.appendChild(p); }
        row.onclick = function () { openForm(k, r); }; body.appendChild(row);
      });
    }
    listBody();
  }

  // ---------- add / edit ----------
  function checklistFor(r) {
    var kd = K(r.kind); if (!kd.checklist) return null; var tpl = C.checklists[kd.checklist.tpl];
    var base = r[kd.checklist.base]; if (!isDate(base)) return { error: 'Set the ' + (fieldOf(r.kind, kd.checklist.base).l || 'date').toLowerCase() + ' first, then add the checklist.' };
    return { items: tpl.map(function (x) { var b = x.from && isDate(r[x.from]) ? r[x.from] : base; return { t: x.t, due: addDays(b, x.off || 0), done: false }; }) };
  }
  function openForm(k, rec, preset) {
    var kd = K(k), isNew = !rec, r = rec ? JSON.parse(JSON.stringify(rec)) : Object.assign({}, preset || {});
    modal(function (s, close) {
      s.appendChild(el('h3', '', (isNew ? 'New ' : '') + kd.label));
      var inputs = {};
      kd.fields.forEach(function (f) {
        if (f.t === 'calc') { var lab = el('label', 'f', f.l), v = el('div', 'amt', showVal(f, null, r)); v.id = 'calc_' + f.k; s.appendChild(lab); s.appendChild(v); inputs[f.k] = { calc: true }; return; }
        var i;
        if (f.t === 'check') { var w = el('div', 'chk'); i = el('input'); i.type = 'checkbox'; i.id = 'f_' + f.k; i.checked = !!r[f.k]; var l2 = el('label', '', f.l); l2.htmlFor = i.id; w.appendChild(i); w.appendChild(l2); s.appendChild(w); inputs[f.k] = { el: i, t: f.t }; return; }
        s.appendChild(Object.assign(el('label', 'f', f.l + (f.req ? ' *' : '')), { htmlFor: 'f_' + f.k }));
        if (f.t === 'select') { i = el('select'); var blank = el('option', '', f.req ? 'Choose...' : '(none)'); blank.value = ''; i.appendChild(blank); f.o.forEach(function (o) { var op = el('option', '', o); op.value = o; i.appendChild(op); }); i.value = r[f.k] == null ? (f.d || (f.req ? f.o[0] : '')) : r[f.k]; }
        else if (f.t === 'link') { i = el('select'); var b2 = el('option', '', '(none)'); b2.value = ''; i.appendChild(b2); byKind(f.to).sort(function (a, b) { return title(a).toLowerCase() < title(b).toLowerCase() ? -1 : 1; }).forEach(function (x) { var op = el('option', '', title(x)); op.value = x.id; i.appendChild(op); }); i.value = r[f.k] || ''; }
        else if (f.t === 'area') { i = el('textarea'); i.value = r[f.k] || ''; i.maxLength = 1500; }
        else { i = el('input'); i.type = f.t === 'money' ? 'text' : f.t === 'number' ? 'number' : f.t === 'tel' ? 'tel' : f.t === 'email' ? 'email' : f.t === 'date' ? 'date' : f.t === 'time' ? 'time' : 'text'; if (f.t === 'money') i.inputMode = 'decimal'; if (f.t === 'number') { i.inputMode = 'decimal'; i.step = 'any'; } i.maxLength = 200; i.value = f.t === 'money' ? dollars(r[f.k]) : (r[f.k] == null ? (f.d != null ? f.d : '') : r[f.k]); }
        i.id = 'f_' + f.k; if (f.h) i.placeholder = f.h; s.appendChild(i); inputs[f.k] = { el: i, t: f.t };
        if (f.hint) s.appendChild(el('div', 'note', f.hint));
      });
      var msg = el('div', 'note err'); s.appendChild(msg);
      function collect() {
        var o = {}, bad = '';
        kd.fields.forEach(function (f) {
          var ip = inputs[f.k]; if (!ip || ip.calc) return; var v;
          if (f.t === 'check') v = ip.el.checked; else v = ip.el.value.trim();
          if (f.t === 'money') { v = toCents(v); if (v !== null && isNaN(v)) { bad = f.l + ' must be an amount like 125.50.'; v = null; } }
          else if (f.t === 'number') { v = v === '' ? null : parseFloat(v); if (v !== null && !isFinite(v)) { bad = f.l + ' must be a number.'; v = null; } }
          if (f.req && (v === '' || v === null)) bad = bad || (f.l + ' is required.');
          o[f.k] = v === undefined ? null : v;
        });
        return { o: o, bad: bad };
      }
      s.addEventListener('input', function () { var c = collect(); var tmp = Object.assign({}, r, c.o); kd.fields.forEach(function (f) { if (f.t === 'calc') { var n = $('calc_' + f.k); if (n) n.textContent = showVal(f, null, tmp); } }); });
      // checklist
      var cl = r.cl || null;
      if (kd.checklist) {
        s.appendChild(el('div', 'sec', 'Checklist')); var box = el('div'); s.appendChild(box);
        var drawCl = function () {
          box.textContent = '';
          if (!cl || !cl.length) { var ab = el('button', 'btn ghost sm', 'Add the ' + kd.checklist.name + ' checklist'); ab.type = 'button'; ab.onclick = function () { var c = collect(); var res = checklistFor(Object.assign({ kind: k }, r, c.o)); if (res.error) { msg.textContent = res.error; return; } msg.textContent = ''; cl = res.items; drawCl(); }; box.appendChild(ab); box.appendChild(el('div', 'note', 'Dates are worked out from the ' + (fieldOf(k, kd.checklist.base).l || 'date').toLowerCase() + '. You can change any date after.')); return; }
          cl.forEach(function (it, idx) {
            var row = el('div', 'ck' + (it.done ? ' done' : '')), ch = el('input'); ch.type = 'checkbox'; ch.checked = !!it.done; ch.onchange = function () { it.done = ch.checked; drawCl(); };
            var m = el('div', 'm'); m.appendChild(el('b', '', it.t)); var d = el('input'); d.type = 'date'; d.value = it.due || ''; d.style.cssText = 'margin-top:4px;min-height:34px;padding:4px 8px;font-size:14px'; d.onchange = function () { it.due = d.value; }; m.appendChild(d);
            var del = el('button', 'btn ghost sm', 'Remove'); del.type = 'button'; del.onclick = function () { cl.splice(idx, 1); drawCl(); }; row.appendChild(ch); row.appendChild(m); row.appendChild(del); box.appendChild(row);
          });
          var addr = el('div', 'btns'), ti = el('input'); ti.placeholder = 'Add a step'; ti.maxLength = 80; var ab2 = el('button', 'btn sm', 'Add'); ab2.type = 'button'; ab2.onclick = function () { if (!ti.value.trim() || cl.length >= 40) return; cl.push({ t: ti.value.trim(), due: '', done: false }); drawCl(); }; addr.appendChild(ti); addr.appendChild(ab2); box.appendChild(addr);
        }; drawCl();
      }
      // related records
      if (!isNew) kinds().forEach(function (ok) {
        var lf = K(ok).fields.filter(function (f) { return f.t === 'link' && f.to === k; })[0]; if (!lf) return;
        var rel2 = byKind(ok).filter(function (x) { return x[lf.k] === rec.id; }); s.appendChild(el('div', 'sec', K(ok).plural));
        rel2.forEach(function (x) { var rw = el('div', 'row tap'), m = el('div', 'm'); m.appendChild(el('b', '', title(x))); var sub = K(ok).sub ? K(ok).sub(x, S.recs) : ''; if (sub) m.appendChild(el('span', '', sub)); rw.appendChild(m); rw.onclick = function () { close(); openForm(ok, x); }; s.appendChild(rw); });
        var pr = {}; pr[lf.k] = rec.id; var nb = el('button', 'btn ghost sm', '+ Add ' + K(ok).label.toLowerCase()); nb.type = 'button'; nb.style.marginTop = '6px'; nb.onclick = function () { close(); openForm(ok, null, pr); }; s.appendChild(nb);
      });
      if (!isNew && kd.actions) kd.actions.forEach(function (a) { if (a.show && !a.show(rec)) return; var ab = el('button', 'btn ghost', a.l); ab.type = 'button'; ab.style.cssText = 'display:block;width:100%;margin:8px 0'; ab.onclick = function () { close(); a.run(rec); }; s.appendChild(ab); });
      if (!isNew && rec.by) s.appendChild(el('div', 'note', 'Last edited by ' + rec.by));
      var btns = el('div', 'btns'), save = el('button', 'btn', 'Save'), cancel = el('button', 'btn ghost', 'Cancel'); save.type = cancel.type = 'button'; btns.appendChild(save); btns.appendChild(cancel);
      if (!isNew && isAdmin()) { var del = el('button', 'btn danger', 'Delete'); del.type = 'button'; btns.appendChild(del); del.onclick = function () { ask('Delete this ' + kd.label.toLowerCase() + '? This cannot be undone.', 'Delete', async function () { var copy = JSON.parse(JSON.stringify(rec)); try { await recs().doc(rec.id).delete(); close(); toast('Deleted.', 'Undo', function () { var id = copy.id; delete copy.id; recs().doc(id).set(copy); }); } catch (e) { toast(friendly(e)); } }); }; }
      cancel.onclick = close; s.appendChild(btns);
      save.onclick = async function () {
        var c = collect(); if (c.bad) { msg.textContent = c.bad; return; } msg.textContent = '';
        var data = Object.assign({}, c.o); if (kd.checklist) data.cl = cl || []; data.kind = k; data.by = (S.user.email || '').split('@')[0].slice(0, 30); data.updatedAt = FV.serverTimestamp(); if (isNew) data.createdAt = FV.serverTimestamp();
        Object.keys(data).forEach(function (key) { if (data[key] === undefined) delete data[key]; });
        save.disabled = true;
        try { if (isNew) { await recs().add(data); } else { await recs().doc(rec.id).update(data); } close(); toast('Saved.'); }
        catch (e) { msg.textContent = friendly(e); save.disabled = false; }
      };
    });
  }
  Q.openForm = openForm;

  // ---------- More ----------
  function toCsv(k) {
    var kd = K(k), rows = [kd.fields.filter(function (f) { return f.t !== 'calc'; }).map(function (f) { return f.l; })];
    byKind(k).forEach(function (r) { rows.push(kd.fields.filter(function (f) { return f.t !== 'calc'; }).map(function (f) { var v = r[f.k]; if (f.t === 'money' && v != null) v = (v / 100).toFixed(2); if (f.t === 'link') v = v ? title(get(v)) : ''; if (f.t === 'check') v = v ? 'Yes' : 'No'; return v == null ? '' : v; })); });
    return rows.map(function (r) { return r.map(function (c) { var s = String(c); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
  }
  function moreView(v) {
    var rest = kinds().filter(function (k) { return (C.tabKinds || kinds().slice(0, 3)).indexOf(k) < 0; });
    if (rest.length) { v.appendChild(el('h2', '', 'More lists')); var c = el('div', 'card'); rest.forEach(function (k) { var row = el('div', 'row tap'), m = el('div', 'm'); m.appendChild(el('b', '', K(k).plural)); m.appendChild(el('span', '', byKind(k).length + ' total')); row.appendChild(m); row.onclick = function () { S.tab = k; render(); }; c.appendChild(row); }); v.appendChild(c); }
    Q.extras.forEach(function (fn) { try { fn(v); } catch (e) { console.error(e); } });
    v.appendChild(el('h2', '', 'Your business'));
    var card = el('div', 'card'); card.appendChild(el('div', 'hint', 'Signed in as ' + (S.user.email || '') + ' (' + roleLabel(S.biz.role) + ')')); v.appendChild(card);
    function btn(label, fn, ghost) { var b = el('button', 'btn' + (ghost === false ? '' : ' ghost'), label); b.type = 'button'; b.style.cssText = 'display:block;width:100%;margin:8px 0'; b.onclick = fn; card.appendChild(b); }
    btn('Phone alerts', function () { Q.push.panel(); });
    if (isAdmin()) btn('Team', teamModal);
    if (isAdmin()) btn('Rename business', function () { modal(function (s, close) { s.appendChild(el('h3', '', 'Business name')); var i = el('input'); i.value = S.biz.name; i.maxLength = 80; s.appendChild(i); var b = el('div', 'btns'), sv = el('button', 'btn', 'Save'); sv.type = 'button'; b.appendChild(sv); s.appendChild(b); sv.onclick = async function () { if (!i.value.trim()) return; try { await db.collection('businesses').doc(S.biz.id).update({ name: i.value.trim().slice(0, 80) }); S.biz.name = i.value.trim(); close(); shell(); render(); } catch (e) { toast(friendly(e)); } }; }); });
    if (isAdmin()) kinds().forEach(function (k) { btn('Download ' + K(k).plural.toLowerCase() + ' (CSV)', function () { download(C.id + '-' + k + '.csv', toCsv(k), 'text/csv'); }); });
    if (isAdmin()) btn('Download everything (backup)', function () { download(C.id + '-backup-' + today() + '.json', JSON.stringify(S.recs.map(function (r) { var o = Object.assign({}, r); delete o.createdAt; delete o.updatedAt; return o; }), null, 1), 'application/json'); });
    btn('Sign out', function () { var p = Q.push && Q.push.on() ? Q.push.disable().catch(function () { /* ignore */ }) : Promise.resolve(); p.then(function () { return auth.signOut(); }); });
    var n = el('div', 'note'); n.textContent = 'This is a first version. It keeps your records and reminders for you and your team; it does not send emails, take payments or have a customer portal yet.'; v.appendChild(n);
  }

  // ---------- team ----------
  function teamModal() {
    modal(function (s, close) {
      s.appendChild(el('h3', '', 'Your team')); var box = el('div'); s.appendChild(box); var isOwner = S.biz.role === 'owner'; var lastNote = '';
      async function draw() {
        box.textContent = 'Loading...';
        try {
          var ms = await db.collection('businesses').doc(S.biz.id).collection('members').get(), iv = await db.collection('invites').where('bizId', '==', S.biz.id).get(), h = el('div');
          h.appendChild(el('div', 'sec', 'People with access')); var c = el('div', 'card'); h.appendChild(c);
          ms.forEach(function (d) { var m = d.data(), r = el('div', 'row'), t = el('div', 'm'); t.appendChild(el('b', '', (m.name || (m.email || '').split('@')[0] || 'Member') + (d.id === S.user.uid ? ' (you)' : ''))); t.appendChild(el('span', '', (m.email || '') + ' \u00b7 ' + roleLabel(m.role))); r.appendChild(t);
            if (d.id !== S.user.uid && m.role !== 'owner' && (isOwner || m.role !== 'gm')) {
              if (isOwner) { var sw = el('button', 'btn ghost sm', m.role === 'gm' ? 'Make staff' : 'Make manager'); sw.type = 'button'; sw.onclick = async function () { try { await db.collection('businesses').doc(S.biz.id).collection('members').doc(d.id).update({ role: m.role === 'gm' ? 'employee' : 'gm' }); draw(); } catch (e) { toast(friendly(e)); } }; r.appendChild(sw); }
              var rm = el('button', 'btn ghost sm', 'Remove'); rm.type = 'button'; rm.onclick = function () { ask('Remove ' + (m.name || m.email) + ' from the team? They lose access right away.', 'Remove', async function () { try { await db.collection('businesses').doc(S.biz.id).collection('members').doc(d.id).delete(); draw(); } catch (e) { toast(friendly(e)); } }); }; r.appendChild(rm); }
            c.appendChild(r); });
          var pend = []; iv.forEach(function (d) { var x = d.data(); x.id = d.id; pend.push(x); });
          if (pend.length) { h.appendChild(el('div', 'sec', 'Waiting to accept')); var c2 = el('div', 'card'); h.appendChild(c2); pend.forEach(function (x) { var r = el('div', 'row'), t = el('div', 'm'); t.appendChild(el('b', '', x.email)); t.appendChild(el('span', '', roleLabel(x.role))); r.appendChild(t); var cx = el('button', 'btn ghost sm', 'Cancel'); cx.type = 'button'; cx.onclick = async function () { try { await db.collection('invites').doc(x.id).delete(); draw(); } catch (e) { toast(friendly(e)); } }; r.appendChild(cx); c2.appendChild(r); }); }
          h.appendChild(el('div', 'sec', 'Invite someone')); var em = el('input'); em.type = 'email'; em.placeholder = 'their email address'; em.autocomplete = 'off'; h.appendChild(em);
          var role = el('select'); [['employee', 'Staff: can add and edit records']].concat(isOwner ? [['gm', 'Manager: also manages the team and can delete']] : []).forEach(function (x) { var o = el('option', '', x[1]); o.value = x[0]; role.appendChild(o); }); role.style.marginTop = '8px'; h.appendChild(role);
          var msg = el('div', 'note'); msg.textContent = lastNote; h.appendChild(msg); var b = el('div', 'btns'), go = el('button', 'btn', 'Send invite'); go.type = 'button'; b.appendChild(go); h.appendChild(b);
          go.onclick = async function () {
            var e = em.value.trim().toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { msg.className = 'note err'; msg.textContent = 'Enter a valid email address.'; return; } go.disabled = true;
            try { await db.collection('invites').doc(e + '__' + S.biz.id).set({ email: e, bizId: S.biz.id, bizName: S.biz.name, product: C.id, role: role.value, name: '', addedBy: S.user.uid, createdAt: FV.serverTimestamp() });
              var link = location.origin + location.pathname.replace(/[^/]*$/, '') + 'index.html?signup=1';
              lastNote = 'Invite saved. Tell them to open ' + link + ', create an account with exactly ' + e + ', and tap Accept. If they already have an account, they just sign in.'; draw(); } catch (x) { msg.className = 'note err'; msg.textContent = friendly(x); go.disabled = false; }
          };
          box.textContent = ''; box.appendChild(h);
        } catch (e) { box.textContent = friendly(e); }
      }
      draw(); var b0 = el('div', 'btns'), x = el('button', 'btn ghost', 'Close'); x.type = 'button'; x.onclick = close; b0.appendChild(x); s.appendChild(b0);
    });
  }

  // ---------- phone alerts (same alerts service as the other Vyqil apps) ----------
  (function () {
    var URL_ = function () { return String(window.VYQIL_PUSH_URL || 'https://vyqil-push.dusterman225.workers.dev').replace(/\/$/, ''); }, FLAG = 'vq_push_' + C.id, last = '', timer = null;
    function flag() { try { return localStorage.getItem(FLAG) === '1'; } catch (e) { return false; } }
    function setFlag(v) { try { if (v) localStorage.setItem(FLAG, '1'); else localStorage.removeItem(FLAG); } catch (e) { /* ignore */ } }
    function supported() { return !!(window.Notification && 'serviceWorker' in navigator && 'PushManager' in window); }
    function iosNeedsInstall() { var ios = /iPhone|iPad|iPod/.test(navigator.userAgent), st = window.navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches); return ios && !st; }
    function reg() { return navigator.serviceWorker.register('sw.js').then(function () { return navigator.serviceWorker.ready; }); }
    function current() { return reg().then(function (r) { return r.pushManager.getSubscription(); }); }
    function key(b) { var s = b.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; var r = atob(s), o = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) o[i] = r.charCodeAt(i); return o; }
    function api(path, body) { var u = auth.currentUser; if (!u) return Promise.reject(new Error('Please sign in again.')); return u.getIdToken().then(function (tok) { return fetch(URL_() + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify(body || {}) }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.detail || j.error || ('error ' + r.status)); return j; }); }); }); }
    function build() {
      var t = today(), to = addDays(t, 14), now = Date.now() + 20000, out = [];
      function add(id, at, ti, bd) { if (at > now) out.push({ id: id, at: at, title: String(ti).slice(0, 80), body: String(bd || '').slice(0, 160) }); }
      function when(d, h, m) { var p = d.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], h, m || 0).getTime(); }
      events(t, to).forEach(function (e) {
        if (!e.alert || e.over) return; var a = e.alert, id = (e.rec.id || 'x') + '|' + (e.key || e.label) + '|' + e.date, nm = e.title || title(e.rec);
        if (a.before && e.time) { var m = /^(\d+):(\d+)/.exec(e.time); if (m) add(id + '|b', when(e.date, +m[1], +m[2]) - a.before * 60000, e.label + ': ' + nm, 'At ' + fmtTime(e.time)); }
        else add(id + '|m', when(e.date, a.hour == null ? 8 : a.hour), e.label + ' today', nm);
        if (a.eve) add(id + '|e', when(addDays(e.date, -1), 17), e.label + ' tomorrow', nm);
      });
      return out.slice(0, 200);
    }
    function sync(force) {
      if (!flag() || !supported() || Notification.permission !== 'granted' || !S.loaded) return Promise.resolve(false);
      return current().then(function (sub) { if (!sub) { setFlag(false); return false; } var items = build(), sig = JSON.stringify(items); if (!force && sig === last) return true; return api('/sync', { sub: sub.toJSON(), items: items }).then(function () { last = sig; return true; }); }).catch(function () { return false; });
    }
    function enable() {
      if (!supported()) return Promise.reject(new Error('This browser cannot receive alerts while closed.'));
      if (iosNeedsInstall()) return Promise.reject(new Error('On iPhone, first add this app to your Home Screen (Share, then Add to Home Screen), open it from there, and turn alerts on again.'));
      return Notification.requestPermission().then(function (p) { if (p !== 'granted') throw new Error('Alerts are blocked. Allow notifications for this site in your browser or phone settings, then try again.'); return reg(); })
        .then(function (r) { return fetch(URL_() + '/vapid').then(function (x) { return x.json(); }).then(function (v) { if (!v.key) throw new Error('The alerts service is not set up yet.'); return r.pushManager.getSubscription().then(function (old) { return old || r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(v.key) }); }); }); })
        .then(function (sub) { return api('/join', { sub: sub.toJSON(), as: 'team', bizId: S.biz.id }).then(function () { setFlag(true); last = ''; return sync(true); }); })
        .catch(function (e) { if (/Failed to fetch|NetworkError|Load failed/i.test(e && e.message)) throw new Error('Could not reach the alerts service. It may not be set up yet.'); throw e; });
    }
    function disable() { return current().then(function (sub) { setFlag(false); last = ''; if (!sub) return; return api('/off', { endpoint: sub.endpoint }).catch(function () { /* ignore */ }).then(function () { return sub.unsubscribe(); }); }); }
    function panel() {
      var on = flag() && window.Notification && Notification.permission === 'granted';
      modal(function (s, close) {
        s.appendChild(el('h3', '', 'Phone alerts'));
        if (!supported()) { s.appendChild(el('p', 'hint', 'This browser cannot receive alerts while it is closed. Try Chrome on Android, or on iPhone open this page in Safari and add it to your Home Screen.')); var c0 = el('button', 'btn ghost', 'Close'); c0.onclick = close; s.appendChild(c0); return; }
        s.appendChild(el('p', '', on ? 'On for this phone.' : 'Off.')).style.fontWeight = '700';
        s.appendChild(el('p', 'hint', 'Get a notification for the dates in this app (' + (C.alertText || 'follow-ups, deadlines and appointments') + '), even when the app is closed. Short titles and times for the next 14 days are held by the Vyqil alerts service until they are delivered. You also get an alert when a nearby business posts a request for you, when someone replies to yours, and when you are chosen.'));
        if (iosNeedsInstall()) s.appendChild(el('p', 'hint', 'iPhone: open this page in Safari, tap Share, then Add to Home Screen. Open it from your Home Screen and turn alerts on there.'));
        var msg = el('p', 'hint'); s.appendChild(msg); var b = el('div', 'btns'); s.appendChild(b);
        function mk(l, ghost, fn) { var x = el('button', 'btn' + (ghost ? ' ghost' : ''), l); x.type = 'button'; x.onclick = fn; b.appendChild(x); return x; }
        if (on) { mk('Send a test alert', false, function () { msg.textContent = 'Sending...'; current().then(function (sub) { return api('/test', { sub: sub.toJSON() }); }).then(function (r) { msg.textContent = r.ok ? 'Sent. It should arrive in a few seconds.' : 'The phone service refused it (' + r.status + ').'; }).catch(function (e) { msg.textContent = e.message; }); }); mk('Turn off', true, function () { disable().then(close).catch(function () { msg.textContent = 'Could not turn off. Try again.'; }); }); }
        else mk('Turn on alerts', false, function () { msg.textContent = 'Setting up...'; enable().then(function () { close(); toast('Alerts are on.'); }).catch(function (e) { msg.textContent = e.message || 'Could not turn on alerts.'; }); });
        mk('Close', true, close);
      });
    }
    Q.push = { panel: panel, on: flag, disable: disable, soon: function () { clearTimeout(timer); timer = setTimeout(function () { sync(false); }, 4000); } };
  })();

  // ---------- go ----------
  document.title = C.name;
  auth.onAuthStateChanged(function (u) { if (!u) { S.biz = null; S.recs = []; authView(); } else boot(u); });
  if ('serviceWorker' in navigator) { /* registered when alerts are turned on */ }
})();
