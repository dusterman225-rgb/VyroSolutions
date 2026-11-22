// VyqilBusiness engine: one small, phone-first app builder used by VyqilRealtor, VyqilLandlord, VyqilSalon, VyqilServices,
// VyqilAuto, VyqilPhoto and VyqilLessons. Each app is a settings file (window.VQ_APP) describing its records, fields,
// checklists and reminders. Records live in businesses/{id}/records, so one business never sees another's data.
(function () {
  'use strict';
  var C = window.VQ_APP, Q = window.Q = { S: { recs: [], biz: null, user: null, tab: 'today', filter: {}, q: '' }, extras: [], onStart: [], banners: [], tabsExtra: [], views: {}, eventSources: [], menuTop: [] };
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
  // Sign out must always work: turning off phone alerts is tried for at most 2 seconds, then the account is signed out and the page reloads.
  function signOutNow() {
    var p = Promise.resolve();
    try { if (Q.push && Q.push.on()) p = Promise.race([Q.push.disable().catch(function () { /* ignore */ }), new Promise(function (r) { setTimeout(r, 2000); })]); } catch (x) { /* ignore */ }
    p.then(function () { return auth.signOut(); }).catch(function () { /* still reload */ }).then(function () { setTimeout(function () { location.reload(); }, 300); });
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
  function recs() { return db.collection('businesses').doc(S.biz.id).collection(S.biz.col || 'records'); }
  Q.db = db; Q.recs = recs; Q.FV = FV; Q.modal = modal; Q.toast = toast; Q.ask = ask; Q.friendly = friendly;

  // ---- The email must be confirmed before the app opens. Accounts made before 18 Nov 2026 are exempt so nobody is locked out. ----
  function vqGate(u, done) {
    var made = u && u.metadata && u.metadata.creationTime ? Date.parse(u.metadata.creationTime) : 0;
    if (!u || u.emailVerified || u.isAnonymous || !u.email || (made && made < Date.parse('2026-11-18T00:00:00Z'))) { done(u); return; }
    if (document.getElementById('vqVerify')) return;
    var o = document.createElement('div'); o.id = 'vqVerify'; o.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#05070a;color:#eef3f8;overflow:auto;font-family:system-ui,Arial,sans-serif';
    var w = document.createElement('div'); w.style.cssText = 'max-width:440px;margin:0 auto;padding:48px 20px;text-align:center'; o.appendChild(w);
    function mk(t, x, s) { var n = document.createElement(t); if (x) n.textContent = x; if (s) n.style.cssText = s; return n; }
    w.appendChild(mk('h1', 'Confirm your email', 'font-size:1.5rem;margin:0 0 10px'));
    w.appendChild(mk('p', 'We sent a link to ' + u.email + '. Open it, then come back here and tap the button below. Check your spam folder if you cannot find it.', 'color:#9fb0c4;line-height:1.5'));
    var msg = mk('div', '', 'min-height:22px;margin:14px 0;color:#9fd6fb;font-size:.9rem');
    var bs = 'display:block;width:100%;box-sizing:border-box;min-height:46px;margin:10px 0;border-radius:12px;font:600 16px system-ui,Arial,sans-serif;cursor:pointer;';
    var ok = mk('button', 'I have confirmed my email', bs + 'background:#4B9CD3;color:#04121f;border:0'), again = mk('button', 'Send the email again', bs + 'background:none;color:#eef3f8;border:1px solid #27405c'), out = mk('button', 'Sign out', bs + 'background:none;color:#9fb0c4;border:0');
    ok.type = again.type = out.type = 'button'; w.appendChild(msg); w.appendChild(ok); w.appendChild(again); w.appendChild(out); document.body.appendChild(o);
    var finished = false;
    function check(quiet) {
      return u.reload().then(function () {
        var cu = auth.currentUser || u;
        if (cu.emailVerified) { if (finished) return; finished = true; document.removeEventListener('visibilitychange', onVis); o.remove(); done(cu); }
        else if (!quiet) { msg.style.color = '#ffb4b4'; msg.textContent = 'Not confirmed yet. Open the link in the email first.'; }
      }, function () { if (!quiet) { msg.style.color = '#ffb4b4'; msg.textContent = 'Could not check. Try again.'; } });
    }
    function onVis() { if (!document.hidden) check(true); }
    document.addEventListener('visibilitychange', onVis);
    ok.onclick = function () { msg.style.color = '#9fd6fb'; msg.textContent = 'Checking...'; check(false); };
    again.onclick = function () { again.disabled = true; u.sendEmailVerification().then(function () { msg.style.color = '#9fd6fb'; msg.textContent = 'Sent. It can take a minute to arrive.'; }, function (e) { msg.style.color = '#ffb4b4'; msg.textContent = e && e.code === 'auth/too-many-requests' ? 'Too many tries. Wait a few minutes.' : 'Could not send. Try again.'; }).then(function () { setTimeout(function () { again.disabled = false; }, 30000); }); };
    out.onclick = function () { finished = true; document.removeEventListener('visibilitychange', onVis); o.remove(); try { auth.signOut(); } catch (x) { /* ignore */ } };
  }
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
          if (mode === 'up') { S.pendingName = biz.value.trim().slice(0, 80); var nc = await auth.createUserWithEmailAndPassword(e, p); try { await nc.user.sendEmailVerification(); } catch (x) { /* the next screen has a Send again button */ } }
          else await auth.signInWithEmailAndPassword(e, p);
        } catch (err) { msg.textContent = friendly(err); go.disabled = false; }
      };
      if (mode === 'in') { var fg = el('button', 'btn ghost sm', 'Forgot your password?'); fg.type = 'button'; fg.style.marginTop = '10px'; fg.onclick = async function () { var e = em.value.trim(); if (!e) { msg.textContent = 'Type your email first.'; return; } try { await auth.sendPasswordResetEmail(e); msg.className = 'note'; msg.textContent = 'If that email has an account, a reset link is on its way.'; } catch (x) { msg.className = 'note err'; msg.textContent = friendly(x); } }; f.appendChild(fg); }
    }
    paint(); root.appendChild(w);
  }

  // ---------- find or create this app's business ----------
  // Pay with Vyqil: an app that sets VQ_APP.pay gets the shared payment module. It loads after sign-in so the page stays quick.
  var payLoaded = false;
  function loadPay() {
    if (payLoaded || !C.pay) return; payLoaded = true;
    function add(src, next, optional) { var sc = document.createElement('script'); sc.src = src; sc.onload = next; sc.onerror = function () { if (optional) next(); else console.error('Could not load ' + src); }; document.head.appendChild(sc); }
    add('/shared/chain-config.js', function () { add('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js', function () { add('/vertical/pay.js', function () { render(); }); }, true); }, true);
  }
  Q.payMenu = function () { return C.pay ? [{ l: 'Pay with Vyqil setup', run: function () { if (Q.pay) Q.pay.setup(); else toast('Pay with Vyqil is still loading. Try again in a moment.'); } }] : []; };
  async function boot(user) {
    S.user = user; root.textContent = ''; root.appendChild(el('div', 'empty', 'Loading...'));
    try {
      var ud = await db.collection('users').doc(user.uid).get(), ids = ((ud.exists && ud.data().bizIds) || []).slice(), active = ud.exists ? ud.data().bizId : '', found = null;
      if (active && ids.indexOf(active) > 0) { ids.splice(ids.indexOf(active), 1); ids.unshift(active); }
      // The business the owner picked on the dashboard comes first. A business can run several apps; the first app keeps the original records, later apps get their own.
      for (var i = 0; i < ids.length && !found; i++) {
        var b = await db.collection('businesses').doc(ids[i]).get(), bd = b.exists ? b.data() : null;
        if (!bd || bd.status === 'closed') continue;
        var has = bd.apps && C.id in bd.apps ? !!bd.apps[C.id] : bd.product === C.id;
        if (has) { var m = await db.collection('businesses').doc(ids[i]).collection('members').doc(user.uid).get(); if (m.exists) found = { id: ids[i], name: bd.name, role: m.data().role, col: bd.product === C.id ? 'records' : 'records_' + C.id, profile: bd.profile || {}, phone: (bd.profile && bd.profile.phone) || bd.phone || '' }; }
      }
      if (!found) { var inv = await pendingInvites(user); found = inv.length ? await inviteScreen(inv, user) : await createBiz(user); }
      if (!found) return;
      S.biz = found; startApp(); loadPay();
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
        await batch.commit(); try { sessionStorage.setItem('vq_new_biz', ref.id); } catch (e) { /* optional */ } location.replace('/dashboard.html'); return new Promise(function () { /* leaving the page */ });
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
  function kinds() { return Object.keys(C.kinds).filter(function (k) { return !C.kinds[k].hidden; }); }
  // A calendar item the owner types in by hand (shown on the home calendar, with a reminder). Every app gets it.
  if (!C.kinds.mydate) C.kinds.mydate = { label: 'Calendar item', plural: 'Calendar items', icon: '\uD83D\uDCC5', hidden: true, fields: [{ k: 'title', l: 'What is it', t: 'text', req: 1, h: 'Call the plumber, meet the inspector' }, { k: 'date', l: 'Date', t: 'date', req: 1, cal: 1, alert: { hour: 8 }, lbl: 'My date', timeField: 'time' }, { k: 'time', l: 'Time (optional)', t: 'time' }, { k: 'notes', l: 'Notes', t: 'area' }], title: function (r) { return r.title || 'Calendar item'; }, sub: function (r) { return r.notes || ''; } };
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

  // Shared helpers for the business apps' full builds (reports, letters, profile, texting).
  Q.tools = (function () {
    var MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    function cents(s) { var t = String(s == null ? '' : s).replace(/[$,\s]/g, ''); if (t === '' || !/^\d*\.?\d{0,2}$/.test(t) || t === '.') return null; return Math.round(parseFloat(t) * 100); }
    function ymOf(d) { return String(d || '').slice(0, 7); }
    function monthLabel(ym) { var p = ym.split('-'); return MON[+p[1] - 1] + ' ' + p[0]; }
    function addMonths(ds, n) { var p = ds.split('-'), d = new Date(+p[0], +p[1] - 1 + n, 1), last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(+p[2], last)); return ymd(d); }
    function add(kind, data) { data.kind = kind; data.by = ((Q.S.user && Q.S.user.email) || '').split('@')[0].slice(0, 30); data.createdAt = FV.serverTimestamp(); data.updatedAt = FV.serverTimestamp(); return recs().add(data); }
    function upd(id, data) { data.updatedAt = FV.serverTimestamp(); return recs().doc(id).update(data); }
    function prof() { return (Q.S.biz && Q.S.biz.profile) || {}; }
    function letterhead() { var p = prof(), b = Q.S.biz || {}; return [b.name || '', p.address || '', [p.phone, p.email].filter(Boolean).join('  ·  ')].filter(Boolean).join('\n'); }
    function copyText(text, t) { if (navigator.share) { navigator.share({ title: t, text: text }).catch(function () { /* cancelled */ }); return; } try { navigator.clipboard.writeText(text).then(function () { toast('Copied.'); }, function () { toast('Press and hold the text to copy it.'); }); } catch (e) { toast('Press and hold the text to copy it.'); } }
    function smsUrl(phone, text) { return 'sms:' + String(phone || '').replace(/[^\d+]/g, '') + '?&body=' + encodeURIComponent(text || ''); }
    function showText(t, text, phone) {
      modal(function (s, close) {
        s.appendChild(el('h3', '', t)); var ta = el('textarea'); ta.value = text; ta.rows = 11; ta.maxLength = 20000; s.appendChild(ta);
        var b = el('div', 'btns'), c = el('button', 'btn', navigator.share ? 'Share' : 'Copy'), pr = el('button', 'btn ghost', 'Print'), x = el('button', 'btn ghost', 'Close'); c.type = pr.type = x.type = 'button';
        c.onclick = function () { copyText(ta.value, t); }; x.onclick = close;
        pr.onclick = function () { var w = window.open('', '_blank'); if (!w) { toast('Allow pop-ups to print.'); return; } var d = w.document; d.title = t; var pre = d.createElement('pre'); pre.style.cssText = 'font:14px/1.5 Arial,sans-serif;white-space:pre-wrap;margin:24px'; pre.textContent = ta.value; d.body.appendChild(pre); w.focus(); setTimeout(function () { w.print(); }, 300); };
        if (phone) { var sm = el('button', 'btn', 'Text it'); sm.type = 'button'; sm.onclick = function () { location.href = smsUrl(phone, ta.value); }; b.appendChild(sm); }
        b.appendChild(c); b.appendChild(pr); b.appendChild(x); s.appendChild(b);
      });
    }
    function profileModal(why) {
      modal(function (s, close) {
        var p = prof(); s.appendChild(el('h3', '', 'Business profile')); s.appendChild(el('p', 'hint', why || 'This appears at the top of invoices, quotes and letters you share.'));
        var F = {}; [['phone', 'Phone', 'tel', 30], ['email', 'Email', 'email', 80], ['address', 'Mailing address', 'text', 160], ['website', 'Website', 'text', 100], ['payInfo', 'How customers pay you', 'text', 200]].forEach(function (x) { s.appendChild(el('label', 'f', x[1])); var i = el('input'); i.type = x[2]; i.maxLength = x[3]; i.value = p[x[0]] || ''; if (x[0] === 'payInfo') i.placeholder = 'Zelle to 555-0100, or check by mail'; s.appendChild(i); F[x[0]] = i; });
        var m = el('div', 'note err'); s.appendChild(m); var b = el('div', 'btns'), go = el('button', 'btn', 'Save'), x = el('button', 'btn ghost', 'Cancel'); go.type = x.type = 'button'; b.appendChild(go); b.appendChild(x); s.appendChild(b); x.onclick = close;
        go.onclick = function () { var o = {}; Object.keys(F).forEach(function (k) { o[k] = F[k].value.trim(); }); go.disabled = true; db.collection('businesses').doc(Q.S.biz.id).update({ profile: o }).then(function () { Q.S.biz.profile = o; Q.S.biz.phone = o.phone || ''; close(); toast('Saved.'); render(); }, function (e) { m.textContent = friendly(e); go.disabled = false; }); };
      });
    }
    function profileCard(v, why) { v.appendChild(el('h2', '', 'Business profile')); var c = el('div', 'card'); v.appendChild(c); var p = prof(); c.appendChild(el('div', 'hint', [p.phone, p.email, p.address].filter(Boolean).join(' · ') || 'Add your phone, address and how customers pay you. It appears on invoices, quotes and letters.')); var b = el('button', 'btn ghost', 'Edit business profile'); b.type = 'button'; b.style.cssText = 'display:block;width:100%;margin-top:8px'; b.onclick = function () { profileModal(why); }; c.appendChild(b); }
    function csv(rows) { return rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n'); }
    function download(name, text) { var a = el('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
    function bar(v, max, color) { var d = el('div'); d.style.cssText = 'height:8px;border-radius:4px;background:' + color + ';width:' + Math.max(2, max ? Math.round(v / max * 100) : 0) + '%;margin:2px 0'; return d; }
    function hubGroup(v, h, rows) { v.appendChild(el('h2', '', h)); var c = el('div', 'card'); rows.forEach(function (x) { var r = el('div', 'row tap'), m = el('div', 'm'); m.appendChild(el('b', '', x[0])); if (x[1]) m.appendChild(el('span', '', x[1])); r.appendChild(m); if (x[3]) r.appendChild(el('span', 'pill bad', String(x[3]))); r.onclick = x[2]; c.appendChild(r); }); v.appendChild(c); }
    function open(id) { return function () { S.tab = id; S.q = ''; render(); window.scrollTo(0, 0); }; }
    return { cents: cents, ymOf: ymOf, monthLabel: monthLabel, addMonths: addMonths, add: add, upd: upd, prof: prof, letterhead: letterhead, copyText: copyText, smsUrl: smsUrl, showText: showText, profileModal: profileModal, profileCard: profileCard, csv: csv, download: download, bar: bar, hubGroup: hubGroup, open: open };
  })();

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
    Q.eventSources.forEach(function (fn) { try { fn(from, to).forEach(function (e) { e.over = false; out.push(e); }); } catch (x) { /* optional */ } });
    out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time || '') < (b.time || '') ? -1 : 1; });
    return out;
  }
  Q.events = events;

  // ---------- UI shell ----------
  function startApp() {
    recs().onSnapshot(function (snap) {
      S.recs = snap.docs.map(function (d) { var o = d.data(); o.id = d.id; return o; }); S.loaded = true; render(); if (Q.push) Q.push.soon();
    }, function (e) { root.textContent = ''; root.appendChild(el('p', 'err', friendly(e))); });
    shell();
    Q.onStart.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
  }
  // Five tabs fit on a phone: Today, Leads (when the app has the community), the main lists, More.
  function shownKinds() { return (C.tabKinds || kinds().slice(0, 3)).slice(0, 3 - Q.tabsExtra.length); }
  var tabsDef = function () {
    var t = [{ id: 'today', l: 'Today', i: '◎' }]; Q.tabsExtra.forEach(function (x) { t.push(x); });
    shownKinds().forEach(function (k) { t.push({ id: k, l: K(k).plural, i: K(k).icon || '■' }); });
    t.push({ id: 'more', l: 'More', i: '☰' }); return t;
  };
  function menuGroups() {
    if (C.menu) return typeof C.menu === 'function' ? C.menu() : C.menu;
    var work = []; if (!Q.communityMenu) Q.tabsExtra.forEach(function (x) { work.push({ l: x.l, tab: x.id }); }); kinds().forEach(function (k) { work.push({ l: K(k).plural, tab: k }); });
    var g = [{ h: 'Work', items: work }]; if (Q.communityMenu) g.push({ h: 'Community', items: Q.communityMenu() }); if (Q.views.reports || C.pay) g.push({ h: 'Money', items: (Q.views.reports ? [{ l: 'Reports', tab: 'reports' }] : []).concat(Q.payMenu()) }); return g;
  }
  // ---------- close (permanently delete) the business ----------
  var CLOSE_COLLS = ['records', 'records_landlord', 'records_realtor', 'records_services', 'records_salon', 'records_auto', 'records_photo', 'records_lessons', 'menu', 'tables', 'supply', 'reservations', 'orders', 'customers', 'leads', 'jobs', 'estimates', 'invoices', 'expenses', 'recurring', 'templates', 'settings', 'documents', 'contracts', 'events', 'notifications', 'schedule', 'products', 'vendors', 'purchases', 'shifts', 'audit', 'network'];
  async function wipeQ(q) { for (var g = 0; g < 200; g++) { var sn = await q.limit(400).get(); if (sn.empty) return; var b = db.batch(); sn.forEach(function (d) { b.delete(d.ref); }); await b.commit(); if (sn.size < 400) return; } }
  async function deleteBusiness() {
    var id = S.biz.id, ref = db.collection('businesses').doc(id), left = [];
    async function tryDo(label, fn) { try { await fn(); } catch (e) { left.push(label); } }
    function delWhere(coll, field) { return wipeQ(db.collection(coll).where(field, '==', id)); }
    await tryDo('community requests', async function () { var sn = await db.collection('communityLeads').where('fromBiz', '==', id).get(); for (var i = 0; i < sn.docs.length; i++) { var offs = await sn.docs[i].ref.collection('offers').get(); for (var k = 0; k < offs.docs.length; k++) { await wipeQ(offs.docs[k].ref.collection('msgs')); await offs.docs[k].ref.delete(); } await sn.docs[i].ref.delete(); } });
    await tryDo('community replies', async function () { var sn = await db.collectionGroup('offers').where('bizId', '==', id).get(); for (var i = 0; i < sn.docs.length; i++) { await wipeQ(sn.docs[i].ref.collection('msgs')); await sn.docs[i].ref.delete(); } });
    await tryDo('listing', function () { return db.collection('directory').doc(id).delete(); });
    await tryDo('tenant portals', function () { return delWhere('tenantPortals', 'bizId'); });
    await tryDo('tenant requests', function () { return delWhere('tenantRequests', 'bizId'); });
    await tryDo('tenant messages', function () { return delWhere('tenantMsgs', 'bizId'); });
    await tryDo('customer portals', function () { return delWhere('custPortals', 'bizId'); });
    await tryDo('appointment requests', function () { return delWhere('apptRequests', 'bizId'); });
    await tryDo('appointment page', function () { return db.collection('bookingPages').doc(id).delete(); });
    await tryDo('shared estimates', function () { return delWhere('publicEstimates', 'bizId'); });
    await tryDo('public page', function () { return delWhere('publicBrands', 'bizId'); });
    await tryDo('invitations', function () { return delWhere('invites', 'bizId'); });
    for (var ci = 0; ci < CLOSE_COLLS.length; ci++) { var nm = CLOSE_COLLS[ci]; await tryDo(nm, wipeQ.bind(null, ref.collection(nm))); }
    await tryDo('team', async function () { var sn = await ref.collection('members').get(); for (var j = 0; j < sn.docs.length; j++) if (sn.docs[j].id !== S.user.uid) await sn.docs[j].ref.delete(); });
    await ref.delete();
    await tryDo('your membership', function () { return ref.collection('members').doc(S.user.uid).delete(); });
    try { var ur = db.collection('users').doc(S.user.uid), ud = await ur.get(), patch = { bizIds: FV.arrayRemove(id) }; if (ud.exists && ud.data().bizId === id) patch.bizId = FV.delete(); await ur.set(patch, { merge: true }); } catch (e) { left.push('your account link'); }
    return left;
  }
  function closeBusinessFlow() {
    modal(function (sh, close) {
      sh.appendChild(el('h3', '', 'Close this business'));
      sh.appendChild(el('p', 'hint', 'This permanently deletes ' + S.biz.name + ': all its records, its Vyqil Community listing and requests, and every tenant and customer portal. Your team loses access. It cannot be undone.'));
      sh.appendChild(el('label', 'f', 'Type the business name to confirm'));
      var i = el('input'); i.placeholder = S.biz.name; i.autocomplete = 'off'; sh.appendChild(i);
      var msg = el('div', 'note'); sh.appendChild(msg); var b = el('div', 'btns'), go = el('button', 'btn danger', 'Close business forever'), no = el('button', 'btn ghost', 'Cancel'); go.type = no.type = 'button'; go.disabled = true; b.appendChild(go); b.appendChild(no); sh.appendChild(b);
      i.oninput = function () { go.disabled = i.value.trim() !== String(S.biz.name).trim(); };
      no.onclick = close;
      go.onclick = async function () {
        if (i.value.trim() !== String(S.biz.name).trim()) return; go.disabled = no.disabled = true; msg.textContent = 'Deleting... please keep this page open.';
        try { var left = await deleteBusiness(); msg.textContent = left.length ? 'Closed. A few items could not be removed (' + left.join(', ') + ').' : 'Closed.'; setTimeout(function () { location.replace('/dashboard.html'); }, left.length ? 2500 : 600); }
        catch (e) { msg.className = 'note err'; msg.textContent = friendly(e); go.disabled = no.disabled = false; }
      };
    });
  }

  function openTab(id) { return function () { S.tab = id; S.q = ''; S.calSel = null; render(); window.scrollTo(0, 0); }; }
  function buildMenu(menu, setOpen) {
    menu.textContent = ''; var head = el('div', 'mh'); head.appendChild(el('b', '', S.biz.name)); head.appendChild(el('small', '', C.name)); head.appendChild(el('small', '', roleLabel(S.biz.role) + ' · ' + (S.user.email || ''))); menu.appendChild(head);
    function item(parent, label, fn, cls) { var a = el('button', 'mi' + (cls ? ' ' + cls : ''), label); a.type = 'button'; a.onclick = function () { setOpen(false); fn(); }; parent.appendChild(a); return a; }
    item(menu, 'Dashboard', openTab('today'));
    Q.menuTop.forEach(function (x) { var a2 = item(menu, x.l, x.run || openTab(x.tab)); if (x.badge) { var n = x.badge(); if (n) a2.appendChild(el('span', 'badge', String(n))); } });
    menuGroups().forEach(function (g) { var items = (g.items || []).filter(function (x) { return !x.show || x.show(); }); if (!items.length) return; var d = el('details'); d.appendChild(el('summary', 'mg', g.h)); items.forEach(function (x) { var a = item(d, x.l, x.run || openTab(x.tab)); if (x.badge) { var n = x.badge(); if (n) a.appendChild(el('span', 'badge', String(n))); } }); menu.appendChild(d); });
    item(menu, 'More tools and settings', openTab('more')); item(menu, 'Phone alerts', function () { Q.push.panel(); });
    var sw = el('a', 'mi', 'Switch business'); sw.href = '/dashboard.html'; menu.appendChild(sw);
    if (S.biz.role === 'owner') item(menu, 'Close business', closeBusinessFlow, 'out');
    item(menu, 'Sign out', function () { signOutNow(); }, 'out');
  }
  function shell() {
    root.textContent = ''; var wrap = el('div', 'wrap'), top = el('div', 'topbar'), lg = el('img', 'mark'); lg.src = C.logo || '/icons/icon-192.png'; lg.alt = 'Go to dashboard'; lg.style.cursor = 'pointer'; lg.setAttribute('role', 'link'); lg.tabIndex = 0; lg.onclick = function () { openTab('today')(); window.scrollTo(0, 0); }; lg.onkeydown = function (e) { if (e.key === 'Enter') lg.onclick(); }; top.appendChild(lg);
    var mw = el('div', 'mwrap'), btn = el('button', 'menu-btn', 'Menu ▾'); btn.type = 'button'; btn.setAttribute('aria-expanded', 'false'); var menu = el('div', 'menu'); mw.appendChild(btn); mw.appendChild(menu);
    var rw = el('div', 'toprt'), lo = el('button', 'logout-sm', 'Log out'); lo.type = 'button'; lo.onclick = function () { signOutNow(); }; rw.appendChild(lo); rw.appendChild(mw); top.appendChild(rw); wrap.appendChild(top);
    function setOpen(o) { if (o) buildMenu(menu, setOpen); menu.classList.toggle('open', o); btn.setAttribute('aria-expanded', o ? 'true' : 'false'); }
    btn.onclick = function (e) { e.stopPropagation(); setOpen(!menu.classList.contains('open')); }; document.addEventListener('click', function (e) { if (!menu.contains(e.target)) setOpen(false); }); document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
    wrap.appendChild(el('div', 'bizname', S.biz.name)); var main = el('main'); main.id = 'view'; wrap.appendChild(main); root.appendChild(wrap);
  }
  // Back button: every new page is a history step, so the phone's back button and the Back link return to the page you came from.
  var navTab = null, navN = 0, fromPop = false;
  function trackNav() {
    try {
      if (navTab === null) history.replaceState({ vq: S.tab, n: 0 }, '');
      else if (S.tab !== navTab && !fromPop) history.pushState({ vq: S.tab, n: ++navN }, '');
    } catch (e) { /* history is optional */ }
    navTab = S.tab; fromPop = false;
  }
  window.addEventListener('popstate', function (e) {
    var pk = document.querySelector('.vq-pick'); if (pk) { pk.remove(); try { history.pushState({ vq: S.tab, n: ++navN }, ''); } catch (x) { /* ignore */ } return; }
    var ms = document.querySelectorAll('.modal');
    if (ms.length) { ms[ms.length - 1].remove(); try { history.pushState({ vq: S.tab, n: ++navN }, ''); } catch (x) { /* ignore */ } return; }
    var st = e.state; if (!st || !st.vq) return; navN = st.n || 0; fromPop = true; S.tab = st.vq; S.q = ''; S.calSel = null; render(); window.scrollTo(0, 0);
  });
  function goBack() { if (navN > 0) { try { history.back(); return; } catch (e) { /* fall through */ } } openTab('today')(); }
  function render() {
    var v = $('view'); if (!v) return; v.textContent = ''; trackNav();
    if (S.tab !== 'today') {
      var back = el('button', 'link', '‹ Back'); back.type = 'button'; back.style.cssText = 'margin:0 0 4px;text-align:left;width:auto'; back.onclick = goBack; v.appendChild(back);
    }
    if (S.tab === 'today') todayView(v); else if (S.tab === 'more') moreView(v); else if (Q.views[S.tab]) Q.views[S.tab](v); else listView(v, S.tab);
    if (S.tab !== 'today') { var b2 = el('button', 'link', 'Back to dashboard'); b2.type = 'button'; b2.onclick = openTab('today'); v.appendChild(b2); }
  }

  Q.render = render;
  function quickAdd() {
    modal(function (s, close) {
      s.appendChild(el('h3', '', 'Add')); var ks = kinds();
      ks.forEach(function (k) { var b = el('button', 'btn ghost', '+ ' + K(k).label); b.type = 'button'; b.style.cssText = 'display:block;width:100%;margin:6px 0'; b.onclick = function () { close(); openForm(k); }; s.appendChild(b); });
    });
  }

  // ---------- Today ----------
  // The button on every past-due notice names what is past due: "View rent", "View bill", "View invoice", "View repair"...
  function overdueNoun(label, rec, forced) {
    if (forced) return forced; var l = String(label || ''), kd = rec && K(rec.kind), kl = kd ? String(kd.label || '').toLowerCase() : '';
    if (/balance/i.test(l)) return 'balance'; if (/gallery/i.test(l)) return 'gallery'; if (/follow/i.test(l)) return 'follow-up'; if (/commission/i.test(l)) return 'commission'; if (/closing/i.test(l)) return 'closing'; if (/open house/i.test(l)) return 'open house'; if (/showing/i.test(l)) return 'showing'; if (/shoot/i.test(l)) return 'shoot'; if (/visit/i.test(l)) return 'visit'; if (/listing/i.test(l)) return 'listing'; if (/loan|inspection period/i.test(l)) return 'deal date';
    if (/rent/i.test(l)) return 'rent'; if (/bill/i.test(l) || /bill|expense/.test(kl)) return 'bill'; if (/invoice/i.test(l)) return 'invoice';
    if (/repair/.test(kl)) return 'repair'; if (/lease/i.test(l)) return 'lease'; if (/insur/i.test(l)) return 'insurance'; if (/inspect/i.test(l)) return 'inspection';
    return kl || 'item';
  }
  function evRow(e, big) {
    var r = el('div', 'row tap'), m = el('div', 'm'), b = el('b', '', e.label + ': ' + (e.title || title(e.rec)));
    m.appendChild(b); var sp = el('span', '', fmtDate(e.date) + (e.time ? ' · ' + fmtTime(e.time) : '') + ' · ' + rel(e.date)); m.appendChild(sp); r.appendChild(m);
    if (e.over) { var oc = dotColor(e.label); r.style.borderLeft = '4px solid ' + oc; b.style.color = oc; }
    if (e.act) { var a = el('button', 'btn sm', e.act.label); a.type = 'button'; a.onclick = function (ev) { ev.stopPropagation(); e.act.run(); }; r.appendChild(a); }
    if (e.over && e.rec && e.rec.id) { var vb = el('button', 'btn sm', 'View ' + overdueNoun(e.label, e.rec, e.noun)); vb.type = 'button'; vb.style.marginLeft = '6px'; vb.onclick = function (ev) { ev.stopPropagation(); openForm(e.rec.kind, e.rec); }; r.appendChild(vb); }
    r.onclick = function () { if (e.rec && e.rec.id) openForm(e.rec.kind, e.rec); }; return r;
  }
  // First-run checklist. Steps come from C.starter, or a sensible default. Done is worked out from the data; a few steps are ticked by hand.
  function starterKey(n) { return 'vq_' + n + '_' + (S.biz ? S.biz.id : ''); }
  function lsGet(k, d) { try { var x = JSON.parse(localStorage.getItem(k)); return x == null ? d : x; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* optional */ } }
  function starterSteps() {
    if (C.starter) return typeof C.starter === 'function' ? C.starter() : C.starter;
    var ks = kinds().slice(0, 3), st = ks.map(function (k, i) { return { id: 'k' + k, t: (i ? 'Add a ' : 'Add your first ') + K(k).label.toLowerCase(), kind: k, form: k }; });
    st.push({ id: 'alerts', t: 'Turn on phone alerts', h: 'Get reminders even when the app is closed.', manual: true, run: function () { Q.push.panel(); } });
    if (Q.community && Q.community.listing) st.push({ id: 'comm', t: 'Set up Vyqil Community', h: 'Be found by nearby Vyqil businesses, and find them.', manual: true, run: function () { Q.community.listing(); } });
    return st;
  }
  function starterCard(v) {
    if (lsGet(starterKey('starter_off'), false)) return; var steps = starterSteps(), manual = lsGet(starterKey('starter_ck'), {});
    function isDone(x) { try { if (x.done) return !!x.done(S.recs); if (x.kind) return byKind(x.kind).length > 0; } catch (e) { return false; } return !!manual[x.id]; }
    var done = steps.filter(isDone).length; if (!steps.length) return;
    var c = el('div', 'card starter'); var h = el('div', 'sh'); h.appendChild(el('h3', '', 'Get started')); h.appendChild(el('small', '', done + ' of ' + steps.length + ' done')); c.appendChild(h);
    var bar = el('div', 'bar'); var fill = el('i'); fill.style.width = Math.round(done / steps.length * 100) + '%'; bar.appendChild(fill); c.appendChild(bar);
    var next = null; steps.forEach(function (x) {
      var d = isDone(x); if (!d && !next) next = x; var r = el('div', 'ck' + (d ? ' done' : '') + (x === next ? ' next' : '')); r.appendChild(el('span', 'tick', d ? '✓' : String(steps.indexOf(x) + 1)));
      var m = el('div', 'm'); m.appendChild(el('b', '', x.t)); if (x.h && !d) m.appendChild(el('span', '', x.h)); r.appendChild(m);
      var go = function () { if (x.manual) { manual[x.id] = true; lsSet(starterKey('starter_ck'), manual); } if (x.run) x.run(); else if (x.form) openForm(x.form, null, x.preset); else if (x.tab) openTab(x.tab)(); if (x.manual) setTimeout(render, 400); };
      if (!d) { var b = el('button', x === next ? 'btn sm' : 'btn ghost sm', x === next ? 'Start' : 'Open'); b.type = 'button'; b.onclick = go; r.appendChild(b); }
      c.appendChild(r);
    });
    var hide = el('button', 'link', done === steps.length ? 'All set. Hide this checklist' : 'Hide this checklist'); hide.type = 'button'; hide.onclick = function () { lsSet(starterKey('starter_off'), true); render(); }; c.appendChild(hide); v.appendChild(c);
  }
  Q.starterShow = function () { lsSet(starterKey('starter_off'), false); S.tab = 'today'; render(); };

  // Month calendar on the home screen, with a colored dot for each kind of dated item.
  var DOT = ['#4B9CD3', '#e0b04c', '#44c7a8', '#e5736f', '#a07af0', '#e08fc0', '#7fe3b0', '#f0a05a'], dotMap = {};
  // Colours by meaning: money due is amber, repairs red, leases purple, and so on. An app can add its own in C.calColors = [{ m: /regex/i, c: '#hex' }].
  var CALCOL = [{ m: /rent|payment/i, c: '#f0c36d' }, { m: /invoice|bill|due|fee/i, c: '#f0a05a' }, { m: /repair|visit|fix|service/i, c: '#ff8a8a' }, { m: /lease|renew|insurance|licen[sc]e|expire/i, c: '#b48cff' }, { m: /inspect|showing|viewing|appointment|meeting/i, c: '#4B9CD3' }, { m: /move|start|begin|open/i, c: '#7fe3b0' }, { m: /follow|call|lead/i, c: '#4fd6d0' }, { m: /my date/i, c: '#ff7ad9' }];
  function dotColor(label) {
    var list = (C.calColors || []).concat(CALCOL); for (var i = 0; i < list.length; i++) if (list[i].m.test(String(label))) return list[i].c;
    if (!dotMap[label]) dotMap[label] = DOT[Object.keys(dotMap).length % DOT.length]; return dotMap[label];
  }
  function dayGlow(cols) { var sh = []; if (cols[0]) sh.push('0 0 0 2px ' + cols[0], '0 0 10px 2px ' + cols[0] + '99'); if (cols[1]) sh.push('inset 0 0 0 2px ' + cols[1], 'inset 0 0 8px ' + cols[1] + '99'); return sh.join(','); }
  function calendarCard(v) {
    var t = today(), now = parse(t); if (!S.cal) S.cal = { y: now.getFullYear(), m: now.getMonth() };
    var y = S.cal.y, m = S.cal.m, first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate(), from = ymd(first), to = ymd(new Date(y, m, days)), evs = events(from, to).filter(function (e) { return e.date >= from && e.date <= to; });
    var by = {}; evs.forEach(function (e) { (by[e.date] = by[e.date] || []).push(e); });
    var c = el('div', 'card'), hd = el('div', 'cal-head'), pv = el('button', 'cal-nav', '‹'), nx = el('button', 'cal-nav', '›'), tt = el('button', 'cal-title', ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m] + ' ' + y);
    pv.type = nx.type = tt.type = 'button'; pv.setAttribute('aria-label', 'Previous month'); nx.setAttribute('aria-label', 'Next month');
    pv.onclick = function () { S.cal = { y: m ? y : y - 1, m: m ? m - 1 : 11 }; S.calSel = null; render(); }; nx.onclick = function () { S.cal = { y: m < 11 ? y : y + 1, m: m < 11 ? m + 1 : 0 }; S.calSel = null; render(); }; tt.onclick = function () { S.cal = { y: now.getFullYear(), m: now.getMonth() }; S.calSel = t; render(); };
    hd.appendChild(pv); hd.appendChild(tt); hd.appendChild(nx); c.appendChild(hd);
    var g = el('div', 'cal-grid'); ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(function (d) { g.appendChild(el('div', 'cal-dow', d)); });
    for (var i = 0; i < first.getDay(); i++) g.appendChild(el('div', 'cal-cell blank'));
    var sel = S.calSel || (parse(t).getMonth() === m && parse(t).getFullYear() === y ? t : null), legend = {};
    for (var d = 1; d <= days; d++) {
      (function (d) {
        var ds = ymd(new Date(y, m, d)), b = el('button', 'cal-cell' + (ds === t ? ' today' : '') + (ds === sel ? ' sel' : '')); b.type = 'button'; b.appendChild(el('span', 'cal-num', String(d)));
        var dots = el('span', 'cal-dots'), cols = []; (by[ds] || []).forEach(function (e) { var cc = dotColor(e.label); if (cols.indexOf(cc) < 0) cols.push(cc); legend[e.label] = cc; }); cols.slice(0, 4).forEach(function (cc) { var i = el('i'); i.style.background = cc; dots.appendChild(i); }); b.appendChild(dots); if (cols.length) b.style.boxShadow = dayGlow(cols);
        b.onclick = function () { S.calSel = ds; render(); }; g.appendChild(b);
      })(d);
    }
    c.appendChild(g); var lg = el('div', 'cal-legend'); Object.keys(legend).forEach(function (k) { var sp = el('span'), i = el('i'); i.style.background = legend[k]; sp.appendChild(i); sp.appendChild(document.createTextNode(k)); lg.appendChild(sp); }); if (lg.firstChild) c.appendChild(lg);
    var addB = el('button', 'btn ghost sm', '+ Add to my calendar'); addB.type = 'button'; addB.style.margin = '10px 0 0'; addB.onclick = function () { openForm('mydate', null, { date: sel || t }); }; c.appendChild(addB);
    if (sel) { var list = by[sel] || []; c.appendChild(el('h3', 'cal-day', fmtDate(sel) + (sel === t ? ' (today)' : ''))); if (!list.length) c.appendChild(el('div', 'hint', 'Nothing on this day.')); list.forEach(function (e) { c.appendChild(evRow(e)); }); }
    v.appendChild(c);
  }
  function todayView(v) {
    var t = today(), evs = events(addDays(t, -365), addDays(t, 14));
    Q.banners.forEach(function (fn) { try { fn(v); } catch (x) { console.error(x); } });
    starterCard(v);
    var q = C.quick || kinds().slice(0, 3).map(function (k) { return { l: 'New ' + K(k).label.toLowerCase(), form: k }; }), qa = el('div', 'qa');
    q.slice(0, 3).forEach(function (x) { var b = el('button', 'btn', x.l); b.type = 'button'; b.onclick = function () { if (x.run) x.run(); else if (x.tab) openTab(x.tab)(); else openForm(x.form); }; qa.appendChild(b); }); v.appendChild(qa);
    // Colour notice cards above the calendar: what is past due, and what is due in the next 3 days.
    (function () {
      var soon = addDays(t, 3), groups = {}, order = [];
      evs.forEach(function (e) { var kind = e.over ? 'late' : (e.date <= soon ? 'soon' : ''); if (!kind) return; var key = kind + '|' + e.label; if (!groups[key]) { groups[key] = { kind: kind, label: e.label, list: [] }; order.push(key); } groups[key].list.push(e); });
      order.sort(function (a, b) { return groups[a].kind === groups[b].kind ? 0 : groups[a].kind === 'late' ? -1 : 1; });
      if (!order.length) return;
      var strip = el('div', 'hscroll'); v.appendChild(strip);
      order.forEach(function (key) {
        var g = groups[key], first = g.list[0], n = g.list.length, late = g.kind === 'late', col = late ? '#ff5a5a' : dotColor(g.label);
        var card = el('button', 'tile ntile'); card.type = 'button'; card.style.setProperty('--c', col);
        card.style.cssText += ';text-align:left;color:inherit;cursor:pointer;font:inherit;border:2px solid ' + col + ';box-shadow:0 0 0 1px ' + col + '33,0 0 ' + (late ? 20 : 12) + 'px ' + col + (late ? '88' : '55');
        card.appendChild(el('div', 'k', g.label)); card.appendChild(el('div', 'n', n + (late ? ' past due' : ' due soon')));
        var who = first.title || (first.rec ? title(first.rec) : ''); card.appendChild(el('div', 'd', (late ? 'Oldest ' : 'Next ') + fmtDate(first.date) + (who ? ' · ' + who : '')));
        card.onclick = function () { var d = parse(first.date); S.cal = { y: d.getFullYear(), m: d.getMonth() }; S.calSel = first.date; render(); };
        strip.appendChild(card);
      });
    })();
    calendarCard(v);
    if (C.stats) { var st = el('div', 'stat'); C.stats.forEach(function (s) { var d = el('div'); d.appendChild(el('b', '', s.fn(S.recs, t))); d.appendChild(el('span', '', s.l)); st.appendChild(d); }); v.appendChild(st); }
    var over = evs.filter(function (e) { return e.over; });
    function sec(h, list, cls) {
      if (!list.length) return; var hh = el('h2', '', h); v.appendChild(hh); var c = el('div', 'card' + (cls || '')); list.slice(0, 30).forEach(function (e) { c.appendChild(evRow(e)); }); v.appendChild(c);
    }
    sec('Overdue', over, ' glow');
    if (C.watch) C.watch.forEach(function (w) {
      var list = []; try { list = w.fn(S.recs, t) || []; } catch (x) { list = []; }
      if (!list.length) return; v.appendChild(el('h2', '', w.l)); var c = el('div', 'card');
      var late = /overdue|late|past due|expired|unpaid/i.test(w.l);
      list.slice(0, 15).forEach(function (r) { var row = el('div', 'row tap'), m = el('div', 'm'); m.appendChild(el('b', '', title(r))); if (w.sub) m.appendChild(el('span', '', w.sub(r, S.recs, t))); row.appendChild(m); row.onclick = function () { openForm(r.kind, r); };
        if (late) { var wb = el('button', 'btn sm', 'View ' + overdueNoun(w.l, r, w.noun)); wb.type = 'button'; wb.style.marginLeft = '6px'; wb.onclick = function (ev) { ev.stopPropagation(); openForm(r.kind, r); }; row.appendChild(wb); }
        c.appendChild(row); }); v.appendChild(c);
    });
  }

  // ---------- lists ----------
  // ---------- portal invites (tenants / customers) ----------
  function PI() { return C.portalInvite || Q.portalInvite || null; }
  function piTodo() { var p = PI(); if (!p) return []; return byKind(p.kind).filter(function (r) { return !r.portalId && !(p.skip && p.skip(r)); }); }
  // Someone who already has a Vyqil account is NOT sent a password email. The business gets this clear notice to send the portal link itself.
  function existingModal(r, p) {
    var link = p.linkOf(r), em = String((p.emailOf ? p.emailOf(r) : r.email) || '').trim(), ph = r.phone || '';
    Q.modal(function (s, close) {
      s.appendChild(el('h3', '', (r.name || 'This ' + p.noun) + ' already has a Vyqil account'));
      s.appendChild(el('p', '', 'No email was sent. A set-your-password email goes only to people who are new to Vyqil. Because ' + (r.name || 'they') + ' already has an account, please send them this portal link yourself and they sign in with the password they already use. If they have never set a password, they can tap "Forgot your password?" on the sign-in page.'));
      var box = el('div', 'card'); box.style.wordBreak = 'break-all'; box.textContent = link; s.appendChild(box);
      var b = el('div', 'btns');
      var a1 = el('a', 'btn', 'Email the link'); a1.href = mailLink(r, p); b.appendChild(a1);
      if (ph) { var a2 = el('a', 'btn', 'Text the link'); a2.href = 'sms:' + String(ph).replace(/[^\d+]/g, '') + '?&body=' + encodeURIComponent('Your ' + ((S.biz && S.biz.name) || '') + ' ' + p.noun + ' portal: ' + link); b.appendChild(a2); }
      var cp = el('button', 'btn ghost', 'Copy link'); cp.type = 'button'; cp.onclick = function () { try { navigator.clipboard.writeText(link); Q.toast('Link copied.'); } catch (x) { window.prompt('Copy this link', link); } }; b.appendChild(cp);
      var ok = el('button', 'btn ghost', 'Done'); ok.type = 'button'; ok.onclick = close; b.appendChild(ok); s.appendChild(b);
    });
    if (p.afterQuiet) p.afterQuiet(r);
  }
  function inviteOne(r) {
    var p = PI(); if (!p) return;
    Q.ask('Create a ' + p.noun + ' portal for ' + ((p.emailOf ? p.emailOf(r) : r.email) || 'this ' + p.noun) + '? New members get an email to set a password; if they already have a Vyqil login you get their portal link to send instead.', 'Invite', function () {
      Q.toast('Inviting...'); return p.quiet(r).then(function (x) {
        if (x.skip) { Q.toast('Add ' + (r.name || 'the ' + p.noun) + '\'s email first, then try again.'); return; }
        if (x.error) { Q.toast(x.error); return; }
        if (x.existing && p.linkOf) { existingModal(r, p); return; }
        Q.toast(x.mailError ? 'Login ready, but the email could not be sent (' + x.mailError + '). Send them the link.' : 'Invitation emailed. They will get an email to set their password (check Spam).'); if (p.after) p.after(r);
      });
    });
  }
  // For people who already have a Vyqil login: an email you send yourself with their portal link (no password reset).
  function mailLink(r, p) { var em = String((p.emailOf ? p.emailOf(r) : r.email) || '').trim(), biz = (S.biz && S.biz.name) || 'us'; return 'mailto:' + encodeURIComponent(em) + '?subject=' + encodeURIComponent('Your ' + biz + ' portal') + '&body=' + encodeURIComponent('Hi ' + String(r.name || '').split(/\s+/)[0] + ',\n\nYour ' + p.noun + ' portal is ready. Sign in with your Vyqil email and password here:\n' + p.linkOf(r) + '\n\nThank you,\n' + biz); }
  function inviteAll() {
    var p = PI(); if (!p) return; var todo = piTodo(), ok = todo.filter(function (r) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String((PI().emailOf ? PI().emailOf(r) : r.email) || '').trim()); }), noMail = todo.length - ok.length;
    if (!todo.length) { Q.toast('Everyone already has a portal.'); return; }
    if (!ok.length) { Q.toast('None of your ' + p.noun + 's have an email on file. Add emails first.'); return; }
    Q.ask('Create portals and invite ' + ok.length + ' ' + p.noun + (ok.length === 1 ? '' : 's') + ' who do not have one yet? New members are emailed a link to set a password. Anyone who already has a Vyqil login is given their portal link to send instead.' + (noMail ? ' ' + noMail + ' without an email will be skipped.' : ''), 'Invite all', async function () {
      var done = 0, failed = 0, noMailSent = 0, last = '', rows = [];
      for (var i = 0; i < ok.length; i++) {
        Q.toast('Inviting ' + (i + 1) + ' of ' + ok.length + '...'); var nm = ok[i].name || (p.emailOf ? p.emailOf(ok[i]) : ok[i].email) || '';
        try { var x = await p.quiet(ok[i]); if (x.ok) { done++; if (x.mailError) { noMailSent++; last = x.mailError; rows.push({ n: nm, bad: true, t: 'Portal made, email NOT sent: ' + x.mailError }); } else rows.push(x.existing ? { n: nm, t: 'ALREADY HAS A VYQIL ACCOUNT. No email was sent. Send them their portal link yourself:', href: p.linkOf ? mailLink(ok[i], p) : '', copy: p.linkOf ? p.linkOf(ok[i]) : '' } : { n: nm, t: 'Invite emailed' }); } else { failed++; last = x.error || ''; rows.push({ n: nm, bad: true, t: 'Failed: ' + (x.error || 'unknown') }); } }
        catch (e) { failed++; last = Q.friendly ? Q.friendly(e) : ''; rows.push({ n: nm, bad: true, t: 'Failed: ' + last }); }
        if (i < ok.length - 1) await new Promise(function (r) { setTimeout(r, 1500); });
      }
      Q.toast('Invited ' + done + (noMailSent ? ', but ' + noMailSent + ' emails could not be sent' : '') + (failed ? ', ' + failed + ' failed' : '') + '.');
      Q.modal(function (sh, close) {
        sh.appendChild(el('h3', '', 'Invite results'));
        sh.appendChild(el('p', 'hint', 'An email that says "emailed" was accepted by the email service. It is sent by Firebase (a noreply address) and often lands in Spam or Junk, so ask them to check there.'));
        var box = el('div', 'card'); sh.appendChild(box);
        rows.forEach(function (r) { var d = el('div', 'row'), m = el('div', 'm'); m.appendChild(el('b', '', r.n)); var sp = el('span', '', r.t); if (r.bad) sp.style.color = '#ff8a8a'; m.appendChild(sp); d.appendChild(m); if (r.href) { var lk = el('a', 'btn sm', 'Email the link'); lk.href = r.href; lk.style.margin = '6px 6px 0 0'; lk.style.display = 'inline-block'; m.appendChild(lk); var cp = el('button', 'btn ghost sm', 'Copy link'); cp.type = 'button'; cp.style.marginTop = '6px'; cp.onclick = function () { try { navigator.clipboard.writeText(r.copy); Q.toast('Link copied.'); } catch (x) { window.prompt('Copy this link', r.copy); } }; m.appendChild(cp); } box.appendChild(d); });
        if (noMail) sh.appendChild(el('p', 'hint', noMail + ' skipped because there is no email on file.'));
        var ob = el('button', 'btn', 'OK'); ob.type = 'button'; ob.onclick = close; sh.appendChild(ob);
      });
      render();
    });
  }
  Q.portalExisting = function (r) { var p = PI(); if (p && p.linkOf) existingModal(r, p); }; Q.portalInviteAll = inviteAll; Q.portalPending = function () { return piTodo().filter(function (r) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String((PI().emailOf ? PI().emailOf(r) : r.email) || '').trim()); }).length; };
  function portalBar(v, k) {
    var p = PI(); if (!p || p.kind !== k) return; var n = Q.portalPending(); if (!n) return;
    var b = el('button', 'btn wide ghost', 'Invite all ' + n + ' ' + p.noun + (n === 1 ? '' : 's') + ' to portal'); b.type = 'button'; b.onclick = inviteAll; v.appendChild(b);
  }

  function listView(v, k) {
    var kd = K(k), all = byKind(k), q = (S.q || '').toLowerCase(), flt = S.filter[k] || '';
    var h = el('h2', '', kd.plural); h.appendChild(el('small', '', all.length + ' total')); v.appendChild(h);
    if (kd.addMenu && kd.addMenu.length) {
      // One "Add" dropdown (unit, tenant, repair request...) instead of a single New button.
      var am = el('select', 'btn wide vq-add'); am.setAttribute('aria-label', 'Add'); var a0 = el('option', '', 'Add...'); a0.value = ''; am.appendChild(a0);
      kd.addMenu.forEach(function (ak) { if (!K(ak)) return; var ao = el('option', '', K(ak).label); ao.value = ak; am.appendChild(ao); });
      am.onchange = function () { var pick = am.value; am.value = ''; if (pick) openForm(pick); }; v.appendChild(am);
    } else { var nb = el('button', 'btn wide', 'New ' + kd.label.toLowerCase()); nb.type = 'button'; nb.onclick = function () { openForm(k); }; v.appendChild(nb); }
    portalBar(v, k);
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
        var PIx = PI(); if (PIx && PIx.kind === k && !r.portalId && !(PIx.skip && PIx.skip(r))) { var il = el('button', 'lnk', 'Invite to portal'); il.type = 'button'; il.onclick = function (ev) { ev.stopPropagation(); inviteOne(r); }; m.appendChild(il); }
        if (kd.amount) { var a = kd.amount(r, S.recs); if (a != null && a !== '') row.appendChild(el('span', 'amt', typeof a === 'number' ? money(a) : a)); }
        if (kd.stage && r[kd.stage]) { var sv = String(r[kd.stage]), p = el('span', 'pill' + (isClosed(r) ? ' ok' : ''), sv); if (sv.length > 12) { p.style.cssText = 'margin:4px 0 0;display:inline-block;max-width:100%'; m.appendChild(p); } else row.appendChild(p); }
        row.onclick = function () { openForm(k, r); }; body.appendChild(row);
      });
    }
    listBody();
  }

  // ---------- add / edit ----------
  function checklistFor(r) {
    var kd = K(r.kind); if (!kd.checklist) return null; var tk = typeof kd.checklist.tpl === 'function' ? kd.checklist.tpl(r) : kd.checklist.tpl, tpl = C.checklists[tk];
    var base = r[kd.checklist.base]; if (!isDate(base)) return { error: 'Set the ' + (fieldOf(r.kind, kd.checklist.base).l || 'date').toLowerCase() + ' first, then add the checklist.' };
    return { items: tpl.map(function (x) { var b = x.from && isDate(r[x.from]) ? r[x.from] : base; return { t: x.t, due: addDays(b, x.off || 0), done: false }; }) };
  }
  function openForm(k, rec, preset) {
    var kd = K(k), isNew = !rec, r = rec ? JSON.parse(JSON.stringify(rec)) : Object.assign({}, preset || {});
    modal(function (s, close) {
      s.appendChild(el('h3', '', (isNew ? 'New ' : '') + kd.label));
      var inputs = {}, dropEl = null, dropName = '';
      kd.fields.forEach(function (f, fi) {
        // Fields that share a "drop" name sit together in a drop-down. It opens by itself on a new record or when something inside is filled in.
        var host = s;
        if (f.drop && (!f.dropIf || f.dropIf(r))) {
          if (dropName !== f.drop) { var grp = kd.fields.filter(function (g) { return g.drop === f.drop; }); dropName = f.drop; dropEl = el('details', 'vq-drop'); dropEl.appendChild(el('summary', '', f.drop)); dropEl.inner = el('div', 'in'); dropEl.appendChild(dropEl.inner); dropEl.open = (isNew && grp.some(function (g) { return g.dropOpenNew; })) || grp.some(function (g) { return r[g.k] != null && r[g.k] !== '' && r[g.k] !== false && g.t !== 'check' || (g.t === 'check' && r[g.k]); }) && !grp.some(function (g) { return g.dropClosed; }); s.appendChild(dropEl); }
          host = dropEl.inner;
        } else { dropName = ''; dropEl = null; }
        if (f.t === 'calc') { var lab = el('label', 'f', f.l), v = el('div', 'amt', showVal(f, null, r)); v.id = 'calc_' + f.k; host.appendChild(lab); host.appendChild(v); inputs[f.k] = { calc: true }; return; }
        var i;
        if (f.t === 'check') { var w = el('div', 'chk'); i = el('input'); i.type = 'checkbox'; i.id = 'f_' + f.k; i.checked = !!r[f.k]; var l2 = el('label', '', f.l); l2.htmlFor = i.id; w.appendChild(i); w.appendChild(l2); host.appendChild(w); inputs[f.k] = { el: i, t: f.t }; return; }
        host.appendChild(Object.assign(el('label', 'f', f.l + (f.req ? ' *' : '')), { htmlFor: 'f_' + f.k }));
        if (f.t === 'select') { i = el('select'); var blank = el('option', '', f.req ? 'Choose...' : '(none)'); blank.value = ''; i.appendChild(blank); f.o.forEach(function (o) { var op = el('option', '', o); op.value = o; i.appendChild(op); }); i.value = r[f.k] == null ? ((typeof f.d === 'function' ? f.d(r) : f.d) || (f.req ? f.o[0] : '')) : r[f.k]; }
        else if (f.t === 'link') { i = el('select'); var b2 = el('option', '', '(none)'); b2.value = ''; i.appendChild(b2); byKind(f.to).sort(function (a, b) { return title(a).toLowerCase() < title(b).toLowerCase() ? -1 : 1; }).forEach(function (x) { var op = el('option', '', title(x)); op.value = x.id; i.appendChild(op); }); i.value = r[f.k] || ''; }
        else if (f.t === 'area') { i = el('textarea'); i.value = r[f.k] || ''; i.maxLength = 1500; }
        else { i = el('input'); i.type = f.t === 'money' ? 'text' : f.t === 'number' ? 'number' : f.t === 'tel' ? 'tel' : f.t === 'email' ? 'email' : f.t === 'date' ? 'date' : f.t === 'time' ? 'time' : 'text'; if (f.t === 'money') i.inputMode = 'decimal'; if (f.t === 'number') { i.inputMode = 'decimal'; i.step = 'any'; } i.maxLength = 200; i.value = f.t === 'money' ? dollars(r[f.k]) : (r[f.k] == null ? (f.d != null ? (typeof f.d === 'function' ? f.d(r) : f.d) : '') : r[f.k]); }
        i.id = 'f_' + f.k; if (f.h) i.placeholder = f.h; host.appendChild(i); inputs[f.k] = { el: i, t: f.t };
        if (f.hint) host.appendChild(el('div', 'note', f.hint));
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
      if (!isNew && kd.actions) { var grpEls = {}; kd.actions.forEach(function (a) { if (a.show && !a.show(rec)) return; var ab = el('button', 'btn ghost', a.l); ab.type = 'button'; ab.style.cssText = 'display:block;width:100%;margin:8px 0'; ab.onclick = function () { close(); a.run(rec); }; var hostA = s;
        if (a.group) { if (!grpEls[a.group]) { var gd = el('details', 'vq-drop'); gd.appendChild(el('summary', '', a.group)); gd.inner = el('div', 'in'); gd.appendChild(gd.inner); grpEls[a.group] = gd; s.appendChild(gd); } hostA = grpEls[a.group].inner; }
        hostA.appendChild(ab); if (a.note) hostA.appendChild(el('div', 'note', a.note)); }); }
      var afterSave = null;
      if (isNew && kd.actions) kd.actions.forEach(function (a) { if (!a.saveFirst) return; var sb = el('button', 'btn ghost', a.saveFirst === true ? 'Save and ' + a.l.charAt(0).toLowerCase() + a.l.slice(1) : a.saveFirst); sb.type = 'button'; sb.style.cssText = 'display:block;width:100%;margin:8px 0'; sb.onclick = function () { afterSave = a; save.click(); }; s.appendChild(sb); if (a.note) s.appendChild(el('div', 'note', a.note)); });
      if (!isNew && rec.by) s.appendChild(el('div', 'note', 'Last edited by ' + rec.by));
      var btns = el('div', 'btns'), save = el('button', 'btn', 'Save'), cancel = el('button', 'btn ghost', 'Cancel'); save.type = cancel.type = 'button'; btns.appendChild(save); btns.appendChild(cancel);
      if (!isNew && isAdmin()) { var del = el('button', 'btn danger', 'Delete'); del.type = 'button'; btns.appendChild(del); del.onclick = function () { ask('Delete this ' + kd.label.toLowerCase() + '? This cannot be undone.', 'Delete', async function () { var copy = JSON.parse(JSON.stringify(rec)); try { await recs().doc(rec.id).delete(); var pix = PI(); if (pix && pix.coll && pix.kind === rec.kind && rec.portalId) { try { await db.collection(pix.coll).doc(rec.portalId).delete(); delete copy.portalId; } catch (e0) { /* portal stays */ } } close(); toast('Deleted.', 'Undo', function () { var id = copy.id; delete copy.id; recs().doc(id).set(copy); }); } catch (e) { toast(friendly(e)); } }); }; }
      cancel.onclick = close; s.appendChild(btns);
      save.onclick = async function () {
        var c = collect(); if (c.bad) { msg.textContent = c.bad; afterSave = null; return; } msg.textContent = '';
        var data = Object.assign({}, c.o); if (kd.checklist) data.cl = cl || []; data.kind = k; data.by = (S.user.email || '').split('@')[0].slice(0, 30); data.updatedAt = FV.serverTimestamp(); if (isNew) data.createdAt = FV.serverTimestamp();
        Object.keys(data).forEach(function (key) { if (data[key] === undefined) delete data[key]; });
        save.disabled = true;
        try { var nref = null; if (isNew) { nref = await recs().add(data); } else { await recs().doc(rec.id).update(data); } close(); toast('Saved.'); if (kd.onSaved) { var nr2 = Object.assign({}, rec || {}, data, { id: isNew ? nref.id : rec.id }), prev2 = rec; setTimeout(function () { try { kd.onSaved(nr2, prev2); } catch (x2) { console.error(x2); } }, 120); } if (afterSave && nref) { var act = afterSave, nr = Object.assign({}, data, { id: nref.id }); setTimeout(function () { act.run(nr); }, 60); } }
        catch (e) { msg.textContent = friendly(e); save.disabled = false; afterSave = null; }
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
    var rest = kinds().filter(function (k) { return shownKinds().indexOf(k) < 0; });
    if (C.hub) { try { C.hub(v); } catch (e) { console.error(e); } } else if (rest.length) { v.appendChild(el('h2', '', 'More lists')); var c = el('div', 'card'); rest.forEach(function (k) { var row = el('div', 'row tap'), m = el('div', 'm'); m.appendChild(el('b', '', K(k).plural)); m.appendChild(el('span', '', byKind(k).length + ' total')); row.appendChild(m); row.onclick = function () { S.tab = k; render(); }; c.appendChild(row); }); v.appendChild(c); }
    Q.extras.forEach(function (fn) { try { fn(v); } catch (e) { console.error(e); } });
    v.appendChild(el('h2', '', 'Your business'));
    var card = el('div', 'card'); card.appendChild(el('div', 'hint', 'Signed in as ' + (S.user.email || '') + ' (' + roleLabel(S.biz.role) + ')')); v.appendChild(card);
    function btn(label, fn, ghost) { var b = el('button', 'btn' + (ghost === false ? '' : ' ghost'), label); b.type = 'button'; b.style.cssText = 'display:block;width:100%;margin:8px 0'; b.onclick = fn; card.appendChild(b); }
    btn('Phone alerts', function () { Q.push.panel(); });
    if (isAdmin()) btn('Team', teamModal);
    if (isAdmin()) btn('Rename business', function () { modal(function (s, close) { s.appendChild(el('h3', '', 'Business name')); var i = el('input'); i.value = S.biz.name; i.maxLength = 80; s.appendChild(i); var b = el('div', 'btns'), sv = el('button', 'btn', 'Save'); sv.type = 'button'; b.appendChild(sv); s.appendChild(b); sv.onclick = async function () { if (!i.value.trim()) return; try { await db.collection('businesses').doc(S.biz.id).update({ name: i.value.trim().slice(0, 80) }); S.biz.name = i.value.trim(); close(); shell(); render(); } catch (e) { toast(friendly(e)); } }; }); });
    if (isAdmin()) kinds().forEach(function (k) { btn('Download ' + K(k).plural.toLowerCase() + ' (CSV)', function () { download(C.id + '-' + k + '.csv', toCsv(k), 'text/csv'); }); });
    if (isAdmin()) btn('Download everything (backup)', function () { download(C.id + '-backup-' + today() + '.json', JSON.stringify(S.recs.map(function (r) { var o = Object.assign({}, r); delete o.createdAt; delete o.updatedAt; return o; }), null, 1), 'application/json'); });
    btn('Sign out', function () { signOutNow(); });
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

  // ---------- required fields get a glowing blue ring ----------
  // Any label that ends in "*" marks the box right after it (input, select or textarea), so every form in every app gets the same look.
  function markReq(root) {
    try {
      Array.prototype.forEach.call((root.querySelectorAll ? root.querySelectorAll('label.f, label.field') : []), function (lb) {
        var t = (lb.textContent || '').trim(); if (!/\*\s*$/.test(t) && !(lb.classList.contains('field') && lb.querySelector(':required'))) return;
        var box = lb.classList.contains('field') ? lb.querySelector('input,select,textarea') : lb.nextElementSibling;
        while (box && box.tagName === 'DIV' && box.firstElementChild && !/^(INPUT|SELECT|TEXTAREA)$/.test(box.tagName)) box = box.querySelector('input,select,textarea') || null;
        if (box && /^(INPUT|SELECT|TEXTAREA)$/.test(box.tagName)) box.classList.add('req');
      });
    } catch (e) { /* cosmetic only */ }
  }
  try { new MutationObserver(function (m) { m.forEach(function (x) { Array.prototype.forEach.call(x.addedNodes, function (n) { if (n.nodeType === 1) markReq(n.parentNode || n); }); }); }).observe(document.body || document.documentElement, { childList: true, subtree: true }); } catch (e) { /* optional */ }
  // The glow shows only while the box is empty (same as Estimates in Contractor).
  function paintReq() { Array.prototype.forEach.call(document.querySelectorAll('.req'), function (e) { var vis = e.offsetParent !== null && !e.disabled; e.classList.toggle('vneed', vis && !String(e.value == null ? '' : e.value).trim()); }); }
  ['input', 'change', 'keyup'].forEach(function (ev) { document.addEventListener(ev, function () { setTimeout(paintReq, 0); }, true); }); setInterval(paintReq, 700);

  // ---------- go ----------
  document.title = C.name;
  auth.onAuthStateChanged(function (u) { if (!u) { S.biz = null; S.recs = []; authView(); } else vqGate(u, boot); });
  if ('serviceWorker' in navigator) { /* registered when alerts are turned on */ }
})();
