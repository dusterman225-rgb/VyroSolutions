// Customer side of Vyqil appointments.
//   portal.html : a customer signs in, sees appointments and invoices, and asks for a time.
//   book.html   : anyone with a business's booking link asks for a time (spam-checked), then follows the answer on a status page.
(function () {
  var MODE = document.body.getAttribute('data-mode'), B = window.VQBook, root = document.getElementById('root');
  firebase.initializeApp(window.VYRO_FIREBASE_CONFIG);
  var db = firebase.firestore(), auth = firebase.auth ? firebase.auth() : null, FV = firebase.firestore.FieldValue;
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  function money(c) { c = Math.round(+c || 0); return '$' + Math.floor(c / 100).toLocaleString('en-US') + '.' + ('0' + (c % 100)).slice(-2); }
  var qs = new URLSearchParams(location.search), PUSH = String(window.VYQIL_PUSH_URL || 'https://vyqil-push.dusterman225.workers.dev').replace(/\/$/, '');
  function friendly(e) { var m = { 'auth/invalid-credential': 'That email and password do not match.', 'auth/wrong-password': 'That email and password do not match.', 'auth/user-not-found': 'That email and password do not match.', 'auth/too-many-requests': 'Too many tries. Wait a few minutes and try again.', 'permission-denied': 'That was not allowed. Please sign in again.', unavailable: 'No connection. Try again.' }; return m[e && (e.code || '')] || (e && e.message) || 'Something went wrong. Try again.'; }
  function shell(title, sub) {
    root.textContent = ''; var w = el('div', 'wrap'); var lg = el('img', 'auth logo wide'); lg.src = 'images/logo.png'; lg.alt = ''; lg.style.cssText = 'display:block;margin:0 auto 10px;width:min(70vw,260px);height:auto;mix-blend-mode:screen'; w.appendChild(lg);
    var h = el('h1', '', title); h.style.cssText = 'font-size:1.15rem;text-align:center;letter-spacing:.08em;text-transform:uppercase;color:#fff;margin:6px 0'; w.appendChild(h); if (sub) { var s = el('p', 'hint', sub); s.style.textAlign = 'center'; w.appendChild(s); } root.appendChild(w); return w;
  }
  function field(parent, label, input, note) { parent.appendChild(el('label', 'f', label)); parent.appendChild(input); if (note) parent.appendChild(el('div', 'note', note)); return input; }
  function api(path, body, tok) { var h = { 'Content-Type': 'application/json' }; if (tok) h.Authorization = 'Bearer ' + tok; return fetch(PUSH + path, { method: 'POST', headers: h, body: JSON.stringify(body) }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j._status = r.status; return j; }); }); }
  function notify(kind, id) { if (!auth || !auth.currentUser) return; auth.currentUser.getIdToken().then(function (t) { return api('/community', { kind: kind, requestId: id }, t); }).catch(function () { /* alerts are optional */ }); }
  function tzOf(pg) { return (pg && pg.tz) || 'America/Los_Angeles'; }
  function status(r, pg) {
    var tz = tzOf(pg), c = el('div', 'card'); c.appendChild(el('b', '', r.typeName || 'Appointment')); c.lastChild.style.color = '#fff';
    c.appendChild(el('div', 'hint', B.fmtRange(tz, r.start, r.end)));
    if (r.reason) c.appendChild(el('div', '', r.reason)).style.margin = '6px 0';
    var label = { pending: ['Waiting for a reply', 'warn'], accepted: ['Confirmed', 'ok'], declined: ['Declined', 'bad'], countered: ['New time suggested', 'warn'], canceled: ['Canceled', 'bad'] }[r.status] || [r.status, ''];
    c.appendChild(el('span', 'pill ' + label[1], label[0])); c.lastChild.style.marginLeft = '0';
    if (r.note) c.appendChild(el('div', 'note', 'Message from the business: ' + r.note));
    return c;
  }
  // Pick a type, a day and a time. Calls onPick({type, s, e}) whenever a time is chosen.
  function picker(parent, pg, onPick) {
    var types = pg.types || [], now = Date.now(), tz = tzOf(pg), sel = el('select'), days = el('div', 'subs'), times = el('div'), picked = null;
    types.forEach(function (t, i) { var o = el('option', '', t.name + ' (' + (t.min >= 60 ? (t.min / 60) + (t.min === 60 ? ' hour' : ' hours') : t.min + ' min') + ')'); o.value = String(i); sel.appendChild(o); });
    if (types.length > 1) field(parent, 'What kind of appointment', sel); else if (types[0]) parent.appendChild(el('div', 'hint', types[0].name));
    parent.appendChild(el('label', 'f', 'Pick a day on the calendar')); parent.appendChild(days); parent.appendChild(el('label', 'f', 'Pick a time')); parent.appendChild(times);
    function drawDays() {
      var type = types[+sel.value || 0]; days.textContent = ''; times.textContent = ''; onPick(null); if (!type) return;
      var list = B.slots(pg, type, now), by = {}, order = []; list.forEach(function (x) { var k = B.ymd(tz, x.s); if (!by[k]) { by[k] = []; order.push(k); } by[k].push(x); });
      if (!order.length) { times.appendChild(el('div', 'empty', 'No open times right now. Please check back later.')); return; }
      var MN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      var f = order[0].split('-'), vy = +f[0], vm = +f[1], last = order[order.length - 1].split('-'), maxIdx = (+last[0]) * 12 + (+last[1]), minIdx = vy * 12 + vm, chosen = null;
      var cal = el('div', 'card'); cal.style.cssText = 'padding:10px;margin:0 0 8px'; days.appendChild(cal);
      function draw() {
        cal.textContent = '';
        var head = el('div'); head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:8px';
        var pv = el('button', 'btn ghost', '‹'), nx = el('button', 'btn ghost', '›'); pv.type = nx.type = 'button'; pv.style.cssText = nx.style.cssText = 'width:44px;padding:6px 0';
        pv.disabled = vy * 12 + vm <= minIdx; nx.disabled = vy * 12 + vm >= maxIdx;
        pv.onclick = function () { vm--; if (vm < 1) { vm = 12; vy--; } draw(); }; nx.onclick = function () { vm++; if (vm > 12) { vm = 1; vy++; } draw(); };
        var tt = el('b', '', MN[vm - 1] + ' ' + vy); tt.style.color = '#fff'; head.appendChild(pv); head.appendChild(tt); head.appendChild(nx); cal.appendChild(head);
        var g = el('div'); g.style.cssText = 'display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center'; cal.appendChild(g);
        ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(function (d) { var h = el('div', 'hint', d); h.style.margin = '0'; g.appendChild(h); });
        var first = new Date(Date.UTC(vy, vm - 1, 1)).getUTCDay(), dim = new Date(Date.UTC(vy, vm, 0)).getUTCDate();
        for (var i = 0; i < first; i++) g.appendChild(el('div'));
        for (var d = 1; d <= dim; d++) (function (d) {
          var k = vy + '-' + ('0' + vm).slice(-2) + '-' + ('0' + d).slice(-2), open = !!by[k], b = el('button', open ? 'btn ghost' : '', String(d)); b.type = 'button';
          b.style.cssText = 'padding:9px 0;min-width:0;border-radius:8px;' + (open ? 'font-weight:700;' : 'background:none;border:0;color:#5b6570;opacity:.55;');
          if (k === chosen) { b.className = 'btn'; b.style.cssText = 'padding:9px 0;min-width:0;border-radius:8px;font-weight:700'; }
          if (open) b.onclick = function () { chosen = k; draw(); drawTimes(type, by[k]); }; else b.disabled = true;
          g.appendChild(b);
        })(d);
        cal.appendChild(el('div', 'hint', 'Days in bold have open times.')).style.marginTop = '8px';
      }
      draw();
    }
    function drawTimes(type, list) {
      times.textContent = ''; onPick(null); var g = el('div', 'qa'); g.style.gridTemplateColumns = 'repeat(2,1fr)';
      list.forEach(function (x) { var b = el('button', 'btn ghost', B.fmtTime(tz, x.s) + ' to ' + B.fmtTime(tz, x.e)); b.type = 'button'; b.onclick = function () { Array.prototype.forEach.call(g.children, function (y) { y.className = 'btn ghost'; }); b.className = 'btn'; onPick({ type: type, s: x.s, e: x.e }); }; g.appendChild(b); }); times.appendChild(g);
    }
    sel.onchange = drawDays; drawDays();
  }

  // ---------------- the customer portal ----------------
  function portal() {
    var box = shell('Customer portal', 'See your appointments and invoices, and ask for a time.');
    var inner = el('div'); box.appendChild(inner);
    function signin() {
      inner.textContent = ''; var c = el('div', 'card'); inner.appendChild(c);
      var em = el('input'); em.type = 'email'; em.autocomplete = 'email'; em.value = qs.get('e') || ''; var pw = el('input'); pw.type = 'password'; pw.autocomplete = 'current-password';
      field(c, 'Email', em); field(c, 'Password', pw); var err = el('div', 'note err'); var go = el('button', 'btn wide', 'Sign in'); go.type = 'button'; var fg = el('button', 'link', 'Forgot your password?'); fg.type = 'button'; c.appendChild(go); c.appendChild(fg); c.appendChild(err);
      go.onclick = function () { err.textContent = ''; go.disabled = true; auth.signInWithEmailAndPassword(em.value.trim(), pw.value).catch(function (e) { err.textContent = friendly(e) + (/do not match/.test(friendly(e)) ? ' First time here? Tap "Forgot your password?" to set your password.' : ''); }).then(function () { go.disabled = false; }); };
      pw.addEventListener('keydown', function (e) { if (e.key === 'Enter') go.click(); });
      fg.onclick = function () { if (!em.value.trim()) { err.textContent = 'Type your email first.'; return; } auth.sendPasswordResetEmail(em.value.trim(), { url: location.origin + location.pathname }).catch(function () { return auth.sendPasswordResetEmail(em.value.trim()); }).then(function () { err.className = 'note'; err.textContent = 'Check your email for a link to set a new password.'; }, function (e) { err.textContent = friendly(e); }); };
    }
    function pushBtn(parent) {
      if (!(window.Notification && 'serviceWorker' in navigator && 'PushManager' in window)) return;
      var b = el('button', 'btn ghost wide', 'Get alerts on this phone'); b.type = 'button'; parent.appendChild(b); var m = el('div', 'note'); parent.appendChild(m);
      function key(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; var r = atob(s), o = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) o[i] = r.charCodeAt(i); return o; }
      b.onclick = function () {
        m.textContent = 'Setting up...';
        Notification.requestPermission().then(function (p) { if (p !== 'granted') throw new Error('Alerts are blocked. Allow notifications for this site in your phone settings.'); return navigator.serviceWorker.register('sw.js').then(function () { return navigator.serviceWorker.ready; }); })
          .then(function (r) { return fetch(PUSH + '/vapid').then(function (x) { return x.json(); }).then(function (v) { if (!v.key) throw new Error('Alerts are not set up yet.'); return r.pushManager.getSubscription().then(function (o) { return o || r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(v.key) }); }); }); })
          .then(function (sub) { return auth.currentUser.getIdToken().then(function (t) { return api('/join', { sub: sub.toJSON(), as: 'customer' }, t); }); })
          .then(function (j) { m.textContent = j.ok ? 'Alerts are on for this phone.' : (j.detail || 'Could not turn on alerts.'); }).catch(function (e) { m.textContent = e.message || 'Could not turn on alerts.'; });
      };
    }
    function draw(u) {
      inner.textContent = ''; inner.appendChild(el('div', 'hint', 'Signed in as ' + u.email));
      if (!u.emailVerified) { inner.appendChild(el('div', 'note err', 'Please open the link in the email we sent you to set your password. Then sign in again.')); }
      else {
        var email = String(u.email).toLowerCase(), list = el('div'); inner.appendChild(list); var reqsAll = [], pages = {};
        function paint(portals) {
          list.textContent = '';
          if (!portals.length) { list.appendChild(el('div', 'card', 'No customer portal is set up for this email yet. Ask the business to invite you.')); return; }
          portals.forEach(function (p) { list.appendChild(drawBiz(p, pages[p.bizId], reqsAll.filter(function (r) { return r.bizId === p.bizId; }), u)); });
        }
        var portals = []; db.collection('custPortals').where('custEmail', '==', email).get().then(function (sn) {
          portals = sn.docs.map(function (d) { var o = d.data(); o.id = d.id; return o; });
          return Promise.all(portals.map(function (p) { return db.collection('bookingPages').doc(p.bizId).get().then(function (d) { pages[p.bizId] = d.exists ? d.data() : null; }); }));
        }).then(function () { paint(portals); db.collection('apptRequests').where('email', '==', email).onSnapshot(function (sn) { reqsAll = sn.docs.map(function (d) { var o = d.data(); o.id = d.id; return o; }); if (!document.querySelector('.portal-form-open')) paint(portals); }, function () { /* list is optional */ }); }, function (e) { inner.appendChild(el('div', 'note err', friendly(e))); });
        pushBtn(inner);
      }
      var out = el('button', 'link', 'Sign out'); out.type = 'button'; out.onclick = function () { auth.signOut(); }; inner.appendChild(out);
    }
    function drawBiz(p, pg, mine, u) {
      var c = el('div', 'card'); var h = el('b', '', p.bizName || 'Your business'); h.style.color = '#fff'; h.style.fontSize = '1.05rem'; c.appendChild(h); if (p.bizPhone) { var a = el('a', '', p.bizPhone); a.href = 'tel:' + p.bizPhone.replace(/[^\d+]/g, ''); a.style.display = 'block'; c.appendChild(a); }
      var tz = tzOf(pg), now = Date.now();
      var open = pg && pg.enabled !== false && (pg.types || []).length;
      if (open) { var rb = el('button', 'btn wide', 'Request appointment'); rb.type = 'button'; c.appendChild(rb); var fm = el('div'); c.appendChild(fm); rb.onclick = function () { rb.style.display = 'none'; requestForm(fm, p, pg, u); }; }
      var live = mine.filter(function (r) { return r.status === 'pending' || r.status === 'countered' || (r.status === 'accepted' && r.end >= now); }).sort(function (a, b) { return a.start - b.start; });
      var past = mine.filter(function (r) { return live.indexOf(r) < 0; }).sort(function (a, b) { return b.start - a.start; }).slice(0, 5);
      var hh = el('h2', '', 'Your appointments'); c.appendChild(hh); if (!live.length) c.appendChild(el('div', 'hint', 'None coming up.'));
      live.forEach(function (r) {
        var s = status(r, pg); s.style.margin = '8px 0'; var row = el('div', 'btns');
        if (r.status === 'countered' && r.counter) {
          s.appendChild(el('div', '', 'Suggested time: ' + B.fmtRange(tz, r.counter.s, r.counter.e))).style.margin = '6px 0';
          var y = el('button', 'btn sm', 'Accept this time'); y.type = 'button'; y.onclick = function () { y.disabled = true; db.collection('apptRequests').doc(r.id).update({ status: 'accepted', start: r.counter.s, end: r.counter.e, updatedAt: FV.serverTimestamp() }).then(function () { notify('aupd', r.id); }, function (e) { alert(friendly(e)); y.disabled = false; }); }; row.appendChild(y);
        }
        var cn = el('button', 'btn sm ghost', r.status === 'accepted' ? 'Cancel appointment' : 'Cancel request'); cn.type = 'button'; cn.onclick = function () { if (!confirm('Cancel this?')) return; db.collection('apptRequests').doc(r.id).update({ status: 'canceled', updatedAt: FV.serverTimestamp() }).then(function () { notify('aupd', r.id); }, function (e) { alert(friendly(e)); }); }; row.appendChild(cn); s.appendChild(row); c.appendChild(s);
      });
      past.forEach(function (r) { var rr = el('div', 'row'), m = el('div', 'm'); m.appendChild(el('b', '', r.typeName)); m.appendChild(el('span', '', B.fmtRange(tz, r.start, r.end))); rr.appendChild(m); rr.appendChild(el('span', 'pill ' + (r.status === 'accepted' ? 'ok' : 'bad'), r.status === 'accepted' ? 'Done' : r.status)); c.appendChild(rr); });
      if ((p.invoices || []).length) { c.appendChild(el('h2', '', 'Invoices')); p.invoices.forEach(function (n) { var rr = el('div', 'row'), m = el('div', 'm'); m.appendChild(el('b', '', (n.n ? '#' + n.n + ' · ' : '') + (n.t || 'Invoice'))); m.appendChild(el('span', '', n.d ? 'Due ' + n.d : '')); rr.appendChild(m); rr.appendChild(el('span', 'amt', money(n.a))); rr.appendChild(el('span', 'pill ' + (n.s === 'Paid' ? 'ok' : 'warn'), n.s || '')); c.appendChild(rr); }); }
      return c;
    }
    function requestForm(parent, p, pg, u) {
      parent.className = 'portal-form-open'; parent.textContent = ''; var pick = null; var f = el('div'); parent.appendChild(f);
      picker(f, pg, function (x) { pick = x; });
      var why = el('textarea'); why.maxLength = 300; why.placeholder = 'A few words about what you need'; field(f, 'Reason for the appointment', why);
      var ph = el('input'); ph.type = 'tel'; ph.maxLength = 30; field(f, 'Your phone (optional)', ph);
      var err = el('div', 'note err'); f.appendChild(err); var row = el('div', 'btns'), go = el('button', 'btn', 'Send request'), no = el('button', 'btn ghost', 'Cancel'); go.type = no.type = 'button'; row.appendChild(go); row.appendChild(no); f.appendChild(row);
      no.onclick = function () { parent.className = ''; parent.textContent = ''; parent.parentNode.querySelector('.btn.wide').style.display = ''; };
      go.onclick = function () {
        if (!pick) { err.textContent = 'Choose a day and a time.'; return; } if (!why.value.trim()) { err.textContent = 'Add a few words about the reason.'; return; }
        go.disabled = true; err.textContent = '';
        db.collection('apptRequests').add({ bizId: p.bizId, portalId: p.id, email: String(u.email).toLowerCase(), name: String(p.custName || u.email).slice(0, 80), phone: ph.value.trim().slice(0, 30), typeId: pick.type.id, typeName: pick.type.name, start: pick.s, end: pick.e, reason: why.value.trim().slice(0, 300), status: 'pending', source: 'portal', uid: u.uid, createdAt: FV.serverTimestamp() })
          .then(function (ref) { notify('areq', ref.id); parent.className = ''; parent.textContent = ''; parent.appendChild(el('div', 'note', 'Sent. You will get an alert and see the answer here.')); }, function (e) { go.disabled = false; err.textContent = friendly(e); });
      };
    }
    auth.onAuthStateChanged(function (u) { if (!u) signin(); else draw(u); });
  }

  // ---------------- public booking page and status page ----------------
  function book() {
    var rid = qs.get('r'), bizId = qs.get('b');
    if (rid) return statusPage(rid);
    var box = shell('Request an appointment');
    if (!/^[A-Za-z0-9]{8,40}$/.test(bizId || '')) { box.appendChild(el('div', 'card', 'This booking link is not valid.')); return; }
    db.collection('bookingPages').doc(bizId).get().then(function (d) {
      var pg = d.exists ? d.data() : null;
      if (!pg || pg.enabled === false || !(pg.types || []).length) { box.appendChild(el('div', 'card', 'This business is not taking appointment requests here right now.')); return; }
      box.querySelector('h1').textContent = pg.bizName || 'Request an appointment';
      if (pg.who !== 'anyone') { var c0 = el('div', 'card'); c0.appendChild(el('div', '', 'This business takes appointment requests from its customers only.')); var a = el('a', '', 'Customer sign in'); a.href = 'portal.html'; a.style.display = 'block'; a.style.marginTop = '8px'; c0.appendChild(a); box.appendChild(c0); return; }
      var cfg = window.VQ_BOOKING || {}, c = el('div', 'card'); box.appendChild(c); var pick = null, token = '';
      c.appendChild(el('div', 'hint', 'Pick a time that works for you. ' + (pg.bizName || 'The business') + ' will accept it or suggest another. Nothing is booked until they accept.'));
      picker(c, pg, function (x) { pick = x; });
      var nm = el('input'); nm.maxLength = 80; field(c, 'Your name', nm); var ph = el('input'); ph.type = 'tel'; ph.maxLength = 30; field(c, 'Your phone', ph, 'How the business reaches you about this request.'); var em = el('input'); em.type = 'email'; em.maxLength = 120; field(c, 'Your email (optional)', em);
      var why = el('textarea'); why.maxLength = 300; why.placeholder = 'A few words about what you need'; field(c, 'Reason for the appointment', why);
      var ts = el('div'); ts.style.margin = '12px 0'; c.appendChild(ts);
      if (cfg.turnstileKey) { var s = el('script'); s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.onload = function () { try { window.turnstile.render(ts, { sitekey: cfg.turnstileKey, theme: 'dark', callback: function (t) { token = t; } }); } catch (e) { /* shown below */ } }; document.head.appendChild(s); }
      else token = 'none';
      var err = el('div', 'note err'); c.appendChild(err); var go = el('button', 'btn wide', 'Send request'); go.type = 'button'; c.appendChild(go);
      go.onclick = function () {
        if (!pick) { err.textContent = 'Choose a day and a time.'; return; } if (!nm.value.trim() || !ph.value.trim()) { err.textContent = 'Add your name and phone.'; return; } if (!why.value.trim()) { err.textContent = 'Add a few words about the reason.'; return; } if (!token) { err.textContent = 'Please complete the spam check.'; return; }
        go.disabled = true; err.textContent = 'Sending...';
        api('/book', { bizId: bizId, typeId: pick.type.id, start: pick.s, end: pick.e, name: nm.value.trim(), phone: ph.value.trim(), email: em.value.trim(), reason: why.value.trim(), token: token }).then(function (j) {
          if (j.ok && j.id) { location.href = 'book.html?r=' + encodeURIComponent(j.id); return; }
          go.disabled = false; err.textContent = j.detail || (j.error === 'taken' ? 'That time was just taken. Please pick another.' : 'Could not send. Please try again.'); try { window.turnstile.reset(); token = ''; } catch (e) { /* ignore */ }
        }, function () { go.disabled = false; err.textContent = 'No connection. Try again.'; });
      };
    }, function () { box.appendChild(el('div', 'card', 'Could not load this page. Try again.')); });
  }
  function statusPage(rid) {
    var box = shell('Your appointment request'); var inner = el('div'); box.appendChild(inner);
    box.appendChild(el('p', 'hint', 'Keep this page. Come back to it to see the answer.')).style.textAlign = 'center';
    db.collection('apptRequests').doc(rid).onSnapshot(function (d) {
      inner.textContent = ''; if (!d.exists) { inner.appendChild(el('div', 'card', 'We could not find this request.')); return; }
      var r = d.data(); db.collection('bookingPages').doc(r.bizId).get().then(function (g) {
        var pg = g.exists ? g.data() : null; inner.textContent = ''; var h = el('h2', '', pg ? pg.bizName : 'Business'); inner.appendChild(h); var c = status(r, pg); inner.appendChild(c);
        if (pg && pg.bizPhone) { var a = el('a', 'btn ghost wide', 'Call ' + pg.bizPhone); a.href = 'tel:' + pg.bizPhone.replace(/[^\d+]/g, ''); inner.appendChild(a); }
        var row = el('div', 'btns');
        if (r.status === 'countered' && r.counter) { c.appendChild(el('div', '', 'Suggested time: ' + B.fmtRange(tzOf(pg), r.counter.s, r.counter.e))).style.margin = '6px 0'; var y = el('button', 'btn sm', 'Accept this time'); y.type = 'button'; y.onclick = function () { y.disabled = true; db.collection('apptRequests').doc(rid).update({ status: 'accepted', start: r.counter.s, end: r.counter.e, updatedAt: FV.serverTimestamp() }).catch(function (e) { alert(friendly(e)); y.disabled = false; }); }; row.appendChild(y); }
        if (r.status === 'pending' || r.status === 'countered' || r.status === 'accepted') { var cn = el('button', 'btn sm ghost', 'Cancel'); cn.type = 'button'; cn.onclick = function () { if (confirm('Cancel this?')) db.collection('apptRequests').doc(rid).update({ status: 'canceled', updatedAt: FV.serverTimestamp() }).catch(function (e) { alert(friendly(e)); }); }; row.appendChild(cn); }
        c.appendChild(row);
      });
    }, function () { inner.appendChild(el('div', 'card', 'We could not load this request.')); });
  }
  if (MODE === 'portal') portal(); else book();
})();
