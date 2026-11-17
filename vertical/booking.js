// Appointments for the business apps: availability, requests from customers, accepting or suggesting another time,
// the customer portal login, and keeping the public availability up to date. Loaded after the engine.
(function () {
  var C = window.VQ_APP, B = window.VQBook;
  if (!C || !B) return;
  var page = null, reqs = [], started = false, lastHash = '', pendingSync = null;
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], LENS = [[30, '30 minutes'], [45, '45 minutes'], [60, '1 hour'], [90, '1.5 hours'], [120, '2 hours'], [180, '3 hours'], [240, '4 hours'], [480, 'All day (8 hours)']];
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  function S() { return Q.S; }
  function bid() { return S().biz && S().biz.id; }
  function tzOf() { return (page && page.tz) || (function () { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return 'America/Los_Angeles'; } })(); }
  function base() { return location.origin + location.pathname.replace(/[^\/]*$/, ''); }
  function pushUrl() { return String(window.VYQIL_PUSH_URL || 'https://vyqil-push.dusterman225.workers.dev').replace(/\/$/, ''); }
  function prof() { return (S().biz && S().biz.profile) || {}; }
  function bizPhone() { return String(prof().phone || (S().biz && S().biz.phone) || '').slice(0, 30); }
  function pendingN() { return reqs.filter(function (r) { return r.status === 'pending'; }).length; }
  function refresh() { var t = S().tab; if ((t === 'appts' || t === 'today') && Q.render && !document.querySelector('.modal')) Q.render(); }
  function first(n) { return String(n || 'there').split(/\s+/)[0]; }
  function notifyApi(body) {
    try { var u = firebase.auth().currentUser; if (!u) return; u.getIdToken().then(function (t) { return fetch(pushUrl() + '/community', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(body) }); }).catch(function () { /* alerts are optional */ }); } catch (e) { /* optional */ }
  }

  // ---------- keep the public availability current ----------
  function ymdLocal(ms) { var d = new Date(ms); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function computeBusy(pg) {
    var now = Date.now(), tz = (pg && pg.tz) || tzOf(), out = [], horizon = Math.min(90, +(pg && pg.horizonDays) || 30);
    reqs.forEach(function (r) { if (r.status === 'accepted' && r.end > now - 86400000) out.push({ s: r.start, e: r.end }); });
    ((pg && pg.blocks) || []).forEach(function (b) { if (b.e > now - 86400000) out.push({ s: b.s, e: b.e }); });
    // the business's own timed jobs, visits and appointments take an hour each
    try {
      Q.events(ymdLocal(now), ymdLocal(now + horizon * 86400000)).forEach(function (e) {
        if (!e.time || !e.rec || !e.rec.id) return; var p = e.date.split('-'), m = B.mins(e.time); if (m == null) return;
        var s = B.zoned(tz, +p[0], +p[1], +p[2], m); out.push({ s: s, e: s + 3600000 });
      });
    } catch (x) { /* optional */ }
    out.sort(function (a, b) { return a.s - b.s; }); return out.slice(0, 400);
  }
  function syncNow() {
    if (!page || !bid()) return;
    var busy = computeBusy(page), h = JSON.stringify([busy, S().biz.name, bizPhone(), page.tz]);
    if (h === lastHash) return; lastHash = h;
    Q.db.collection('bookingPages').doc(bid()).update({ busy: busy, bizName: String(S().biz.name || '').slice(0, 80), bizPhone: bizPhone(), updatedAt: Q.FV.serverTimestamp() }).catch(function () { lastHash = ''; });
  }
  function soonSync() { clearTimeout(pendingSync); pendingSync = setTimeout(syncNow, 2500); }

  // ---------- customer portal logins ----------
  var P = C.portal || null;
  function randomPassword() { var a = new Uint8Array(24); crypto.getRandomValues(a); var s = ''; for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s).replace(/[^A-Za-z0-9]/g, 'x') + 'Aa1!'; }
  function portalBase() { return base() + 'portal.html'; }
  async function makeLogin(email) {
    var app = firebase.initializeApp(window.VYRO_FIREBASE_CONFIG, 'cust-' + Date.now()), res = { existing: false, error: '' };
    try {
      var a = app.auth(); await a.setPersistence(firebase.auth.Auth.Persistence.NONE);
      try { await a.createUserWithEmailAndPassword(email, randomPassword()); } catch (e) { if (!e || e.code !== 'auth/email-already-in-use') throw e; res.existing = true; }
      if (!res.existing) { try { await a.sendPasswordResetEmail(email, { url: portalBase() }); } catch (e2) { await a.sendPasswordResetEmail(email); } }
      try { await a.signOut(); } catch (x) { /* ignore */ }
    } catch (e) { res.error = Q.friendly(e); }
    try { await app.delete(); } catch (x) { /* ignore */ }
    return res;
  }
  function emailOf(r) { return String(r[(P && P.email) || 'email'] || '').trim().toLowerCase(); }
  function nameOf(r) { return String(r[(P && P.name) || 'name'] || '').slice(0, 80); }
  function portalDoc(r) {
    var inv = []; try { inv = P.invoices ? P.invoices(r, S().recs).slice(0, 8) : []; } catch (e) { inv = []; }
    return { bizId: bid(), recId: r.id, custEmail: emailOf(r), custName: nameOf(r), bizName: String(S().biz.name || '').slice(0, 80), bizPhone: bizPhone(), invoices: inv, updatedAt: Q.FV.serverTimestamp() };
  }
  function portalLink(r) {
    var url = portalBase() + '?e=' + encodeURIComponent(emailOf(r));
    Q.tools.showText('Customer portal link', 'Hi ' + first(nameOf(r)) + ',\n\nYou can see your appointments and invoices and request a new appointment in your customer portal:\n' + url + '\n\nSign in with your email and password. If you have not set a password yet, use the email we sent, or tap "Forgot your password?" on that page.\n\nThank you,\n' + S().biz.name, r.phone);
  }
  function invite(r) {
    var email = emailOf(r); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { Q.toast('Add ' + (nameOf(r) || 'the customer') + '\'s email first, then try again.'); return; }
    Q.ask('Create a customer portal login for ' + email + ' and email them a link to set a password?', 'Invite', async function () {
      Q.toast('Inviting...'); var res = await makeLogin(email); if (res.error) { Q.toast(res.error); return; }
      var ref = Q.db.collection('custPortals').doc();
      try { await ref.set(portalDoc(r)); await Q.recs().doc(r.id).update({ portalId: ref.id, updatedAt: Q.FV.serverTimestamp() }); } catch (e) { Q.toast(Q.friendly(e)); return; }
      Q.toast(res.existing ? 'They already have a login. Send them the link.' : 'Invitation emailed.'); r.portalId = ref.id; portalLink(r);
    });
  }
  function syncPortals() {
    if (!P || !bid()) return;
    S().recs.forEach(function (r) {
      if (r.kind !== P.kind || !r.portalId) return; var d = portalDoc(r), h = JSON.stringify([d.custEmail, d.custName, d.bizName, d.bizPhone, d.invoices]), key = 'vq_cp_' + r.portalId;
      try { if (localStorage.getItem(key) === h) return; } catch (e) { /* ignore */ }
      Q.db.collection('custPortals').doc(r.portalId).set(d).then(function () { try { localStorage.setItem(key, h); } catch (e) { /* ignore */ } }, function () { /* try again later */ });
    });
  }
  function addPortalActions() {
    if (!P || !C.kinds || !C.kinds[P.kind]) return; var kd = C.kinds[P.kind]; kd.actions = kd.actions || [];
    kd.actions.push({ l: 'Invite to customer portal', show: function (r) { return !r.portalId; }, run: function (r) { invite(r); } });
    kd.actions.push({ l: 'Customer portal link', show: function (r) { return !!r.portalId; }, run: function (r) { portalLink(r); } });
  }

  // ---------- answering a request ----------
  function rangeOf(r) { return B.fmtRange(tzOf(), r.start, r.end); }
  function reviewLink(r) { return base() + 'book.html?r=' + encodeURIComponent(r.id); }
  function respond(r, patch, text) {
    patch.updatedAt = Q.FV.serverTimestamp();
    Q.db.collection('apptRequests').doc(r.id).update(patch).then(function () {
      soonSync();
      if (r.source === 'portal') { notifyApi({ kind: 'aresp', requestId: r.id }); Q.toast('Saved. ' + first(r.name) + ' is notified in the customer portal.'); }
      else if (text) { Q.toast('Saved.'); Q.tools.showText('Tell ' + first(r.name), text, r.phone); }
      else Q.toast('Saved.');
    }, function (e) { Q.toast(Q.friendly(e)); });
  }
  function accept(r) {
    var clash = reqs.some(function (o) { return o.id !== r.id && o.status === 'accepted' && o.start < r.end && o.end > r.start; });
    function go() { respond(r, { status: 'accepted', note: '' }, 'Hi ' + first(r.name) + ', your appointment with ' + S().biz.name + ' is confirmed for ' + rangeOf(r) + '. Details: ' + reviewLink(r)); }
    if (clash) Q.ask('This overlaps another accepted appointment. Accept anyway?', 'Accept', go); else go();
  }
  function noteModal(title, label, yes, fn) {
    Q.modal(function (s, close) {
      s.appendChild(el('h3', '', title)); s.appendChild(el('label', 'f', label)); var t = el('textarea'); t.maxLength = 300; s.appendChild(t);
      var b = el('div', 'btns'), y = el('button', 'btn', yes), n = el('button', 'btn ghost', 'Cancel'); y.type = n.type = 'button'; y.onclick = function () { close(); fn(t.value.trim()); }; n.onclick = close; b.appendChild(y); b.appendChild(n); s.appendChild(b);
    });
  }
  function decline(r) { noteModal('Decline this request', 'Optional message to the customer', 'Decline', function (note) { respond(r, { status: 'declined', note: note }, 'Hi ' + first(r.name) + ', I am sorry, I cannot do ' + rangeOf(r) + '.' + (note ? ' ' + note : '') + ' You can ask for another time here: ' + reviewLink(r)); }); }
  function cancelAppt(r) { noteModal('Cancel this appointment', 'Optional message to the customer', 'Cancel appointment', function (note) { respond(r, { status: 'canceled', note: note }, 'Hi ' + first(r.name) + ', I need to cancel our appointment on ' + rangeOf(r) + '.' + (note ? ' ' + note : '') + ' Sorry about that. You can ask for another time here: ' + reviewLink(r)); }); }
  function suggest(r) {
    var pg = page; if (!pg) { Q.toast('Set up your availability first.'); return; }
    var type = (pg.types || []).filter(function (t) { return t.id === r.typeId; })[0] || (pg.types || [])[0]; if (!type) { Q.toast('Add an appointment type first.'); return; }
    var list = B.slots(pg, type, Date.now()).slice(0, 60);
    Q.modal(function (s, close) {
      s.appendChild(el('h3', '', 'Suggest another time')); s.appendChild(el('p', 'hint', 'Pick an open time. ' + first(r.name) + ' can accept it or ask again.'));
      if (!list.length) { s.appendChild(el('div', 'empty', 'No open times in the next ' + (pg.horizonDays || 30) + ' days. Change your availability first.')); }
      var sel = el('select'); list.forEach(function (x, i) { var o = el('option', '', B.fmtRange(pg.tz, x.s, x.e)); o.value = String(i); sel.appendChild(o); }); if (list.length) { s.appendChild(el('label', 'f', 'New time')); s.appendChild(sel); }
      s.appendChild(el('label', 'f', 'Message (optional)')); var t = el('textarea'); t.maxLength = 300; s.appendChild(t);
      var b = el('div', 'btns'), y = el('button', 'btn', 'Send suggestion'), n = el('button', 'btn ghost', 'Cancel'); y.type = n.type = 'button'; n.onclick = close;
      y.onclick = function () { var x = list[+sel.value]; if (!x) return; close(); respond(r, { status: 'countered', counter: { s: x.s, e: x.e }, note: t.value.trim() }, 'Hi ' + first(r.name) + ', ' + S().biz.name + ' can do ' + B.fmtRange(pg.tz, x.s, x.e) + ' instead.' + (t.value.trim() ? ' ' + t.value.trim() : '') + ' Accept or pick another time here: ' + reviewLink(r)); };
      if (list.length) b.appendChild(y); b.appendChild(n); s.appendChild(b);
    });
  }

  // ---------- availability settings ----------
  function defaultPage() { return { enabled: true, who: 'customers', tz: tzOf(), leadHours: 24, horizonDays: 30, types: [{ id: 't1', name: 'Estimate', min: 120, windows: [1, 2, 3, 4, 5].map(function (d) { return { d: d, s: 540, e: 1020 }; }) }], blocks: [] }; }
  function hhmm(m) { return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2); }
  function settingsModal() {
    var p = JSON.parse(JSON.stringify(page || defaultPage())); if (!page) p.enabled = true;
    Q.modal(function (s, close) {
      s.appendChild(el('h3', '', 'Appointment booking'));
      s.appendChild(el('p', 'hint', 'Choose the kinds of appointments you offer and the hours each one is open. Customers only ever see the open times, never the details of your calendar.'));
      var cw = el('div', 'chk'), ce = el('input'); ce.type = 'checkbox'; ce.id = 'bk_on'; ce.checked = p.enabled !== false; var cl = el('label', '', 'Customers can request appointments'); cl.htmlFor = 'bk_on'; cw.appendChild(ce); cw.appendChild(cl); s.appendChild(cw);
      s.appendChild(el('label', 'f', 'Who can request')); var who = el('select'); [['customers', 'Only my customers (they sign in to their customer portal)'], ['anyone', 'Anyone with my booking link']].forEach(function (o) { var x = el('option', '', o[1]); x.value = o[0]; who.appendChild(x); }); who.value = p.who || 'customers'; s.appendChild(who);
      var wn = el('div', 'note', ''); s.appendChild(wn);
      function whoNote() { wn.textContent = who.value === 'anyone' ? 'Anyone can ask for a time, with a short spam check. You can accept, suggest another time, or decline each one. A "Request appointment" button also shows on your customer portal.' : 'Only customers you have invited to the customer portal can request. A request button shows on their portal.'; if (who.value === 'anyone' && !(window.VQ_BOOKING && window.VQ_BOOKING.turnstileKey)) wn.textContent += ' The spam check is not set up yet, so requests from the public link will not work until it is.'; }
      who.onchange = whoNote; whoNote();
      s.appendChild(el('label', 'f', 'Your time zone')); var tz = el('select'); var zs = B.TZS.slice(); if (!zs.some(function (z) { return z[0] === p.tz; })) zs.push([p.tz, p.tz]); zs.forEach(function (z) { var o = el('option', '', z[1] + ' (' + z[0].split('/')[1].replace(/_/g, ' ') + ')'); o.value = z[0]; tz.appendChild(o); }); tz.value = p.tz; s.appendChild(tz);
      s.appendChild(el('label', 'f', 'Minimum notice')); var lead = el('select'); [[0, 'None'], [2, '2 hours'], [4, '4 hours'], [12, '12 hours'], [24, '1 day'], [48, '2 days'], [72, '3 days']].forEach(function (o) { var x = el('option', '', o[1]); x.value = String(o[0]); lead.appendChild(x); }); lead.value = String(p.leadHours); if (lead.value !== String(p.leadHours)) lead.value = '24'; s.appendChild(lead); s.appendChild(el('div', 'note', 'How soon from now a customer can book. Stops same-day surprises.'));
      s.appendChild(el('label', 'f', 'How far ahead')); var hz = el('select'); [14, 30, 60, 90].forEach(function (d) { var x = el('option', '', d + ' days'); x.value = String(d); hz.appendChild(x); }); hz.value = String(p.horizonDays); s.appendChild(hz);
      s.appendChild(el('h3', '', 'Appointment types')); s.appendChild(el('div', 'note', 'Each type has its own length and its own open days and hours. Example: Estimate, 2 hours, Monday to Friday, 9:00 to 5:00.'));
      var box = el('div'); s.appendChild(box); var cards = [];
      function typeCard(t) {
        var c = el('div', 'card'); box.appendChild(c); var days = {}, from = 540, to = 1020; (t.windows || []).forEach(function (w) { days[w.d] = 1; from = w.s; to = w.e; });
        var nm = el('input'); nm.maxLength = 40; nm.value = t.name || ''; nm.placeholder = 'Estimate, Consultation, Showing'; c.appendChild(el('label', 'f', 'Name')); c.appendChild(nm);
        var ln = el('select'); LENS.forEach(function (o) { var x = el('option', '', o[1]); x.value = String(o[0]); ln.appendChild(x); }); ln.value = String(t.min || 60); c.appendChild(el('label', 'f', 'Length of one appointment')); c.appendChild(ln);
        c.appendChild(el('label', 'f', 'Open days')); var dr = el('div', 'subs'); DAYS.forEach(function (d, i) { var b = el('button', days[i] ? 'on' : '', d); b.type = 'button'; b.onclick = function () { days[i] = days[i] ? 0 : 1; b.className = days[i] ? 'on' : ''; }; dr.appendChild(b); }); c.appendChild(dr);
        var f1 = el('input'); f1.type = 'time'; f1.value = hhmm(from); var f2 = el('input'); f2.type = 'time'; f2.value = hhmm(to); c.appendChild(el('label', 'f', 'Open from')); c.appendChild(f1); c.appendChild(el('label', 'f', 'Until')); c.appendChild(f2); c.appendChild(el('div', 'note', 'Appointments are offered back to back inside these hours. Example: 2 hours from 9:00 to 5:00 gives 9, 11, 1 and 3 o\'clock.'));
        var rm = el('button', 'btn sm danger', 'Remove this type'); rm.type = 'button'; rm.style.marginTop = '10px'; rm.onclick = function () { c.remove(); cards = cards.filter(function (x) { return x.c !== c; }); }; c.appendChild(rm);
        cards.push({ c: c, id: t.id, nm: nm, ln: ln, days: days, f1: f1, f2: f2 });
      }
      (p.types || []).forEach(typeCard);
      var add = el('button', 'btn ghost wide', 'Add another type'); add.type = 'button'; add.onclick = function () { if (cards.length >= 8) return; typeCard({ id: 't' + Date.now().toString(36), name: '', min: 60, windows: [1, 2, 3, 4, 5].map(function (d) { return { d: d, s: 540, e: 1020 }; }) }); }; s.appendChild(add);
      var msg = el('div', 'note err'); s.appendChild(msg); var b = el('div', 'btns'), sv = el('button', 'btn', 'Save'), cn = el('button', 'btn ghost', 'Cancel'); sv.type = cn.type = 'button'; cn.onclick = close;
      sv.onclick = function () {
        var types = [], bad = '';
        cards.forEach(function (c, i) {
          var name = c.nm.value.trim(), min = +c.ln.value, a = B.mins(c.f1.value), z = B.mins(c.f2.value), ds = [0, 1, 2, 3, 4, 5, 6].filter(function (d) { return c.days[d]; });
          if (!name) bad = bad || 'Give every appointment type a name.'; else if (!ds.length) bad = bad || name + ': pick at least one open day.'; else if (a == null || z == null || z - a < min) bad = bad || name + ': the open hours must be at least as long as one appointment.';
          types.push({ id: c.id || ('t' + Date.now().toString(36) + i), name: name.slice(0, 40), min: min, windows: ds.map(function (d) { return { d: d, s: a, e: z }; }) });
        });
        if (ce.checked && !types.length) bad = bad || 'Add at least one appointment type.'; if (bad) { msg.textContent = bad; return; }
        var doc = { bizId: bid(), enabled: ce.checked, who: who.value, tz: tz.value, leadHours: +lead.value, horizonDays: +hz.value, bizName: String(S().biz.name || '').slice(0, 80), bizPhone: bizPhone(), product: C.id, types: types, blocks: (page && page.blocks) || [], busy: [], updatedAt: Q.FV.serverTimestamp() };
        doc.busy = computeBusy(doc); sv.disabled = true;
        Q.db.collection('bookingPages').doc(bid()).set(doc).then(function () { lastHash = ''; close(); Q.toast('Saved.'); refresh(); }, function (e) { sv.disabled = false; msg.textContent = Q.friendly(e); });
      };
      b.appendChild(sv); b.appendChild(cn); s.appendChild(b);
    });
  }
  function blockModal() {
    if (!page) { Q.toast('Set up appointment booking first.'); return; }
    Q.modal(function (s, close) {
      s.appendChild(el('h3', '', 'Block off time')); s.appendChild(el('p', 'hint', 'Customers will not be offered these times. Use it for vacation, lunch, or anything not on your calendar.'));
      var d = el('input'); d.type = 'date'; d.value = ymdLocal(Date.now()); var f = el('input'); f.type = 'time'; f.value = '09:00'; var t = el('input'); t.type = 'time'; t.value = '17:00'; var n = el('input'); n.maxLength = 40; n.placeholder = 'Vacation';
      [['Date', d], ['From', f], ['Until', t], ['Note (optional)', n]].forEach(function (x) { s.appendChild(el('label', 'f', x[0])); s.appendChild(x[1]); });
      var msg = el('div', 'note err'); s.appendChild(msg); var b = el('div', 'btns'), y = el('button', 'btn', 'Block it'), c = el('button', 'btn ghost', 'Cancel'); y.type = c.type = 'button'; c.onclick = close;
      y.onclick = function () {
        var p = d.value.split('-'), a = B.mins(f.value), z = B.mins(t.value); if (p.length !== 3 || a == null || z == null || z <= a) { msg.textContent = 'Choose a date and a start before the end.'; return; }
        var tz = tzOf(), blocks = ((page.blocks || []).concat([{ s: B.zoned(tz, +p[0], +p[1], +p[2], a), e: B.zoned(tz, +p[0], +p[1], +p[2], z), n: n.value.trim().slice(0, 40) }])).slice(-60);
        Q.db.collection('bookingPages').doc(bid()).update({ blocks: blocks, updatedAt: Q.FV.serverTimestamp() }).then(function () { lastHash = ''; close(); soonSync(); Q.toast('Blocked.'); refresh(); }, function (e) { msg.textContent = Q.friendly(e); });
      };
      b.appendChild(y); b.appendChild(c); s.appendChild(b);
    });
  }

  // ---------- the Appointments page ----------
  function btn(l, cls, fn) { var b = el('button', 'btn sm' + (cls ? ' ' + cls : ''), l); b.type = 'button'; b.onclick = fn; return b; }
  function reqCard(r) {
    var c = el('div', 'card'), m = el('div', 'm'); m.appendChild(el('b', '', r.name + ' · ' + r.typeName)); c.appendChild(el('div', '', '')).appendChild(m.firstChild);
    var tx = el('div', 'hint', rangeOf(r) + (r.source === 'public' ? ' · from your booking link' : '')); c.appendChild(tx);
    if (r.reason) c.appendChild(el('div', '', r.reason)).style.margin = '6px 0';
    var who = [r.phone, r.email].filter(Boolean).join(' · '); if (who) c.appendChild(el('div', 'hint', who));
    if (r.status === 'countered' && r.counter) c.appendChild(el('div', 'note', 'You suggested ' + B.fmtRange(tzOf(), r.counter.s, r.counter.e) + '. Waiting for ' + first(r.name) + '.'));
    if (r.note && r.status !== 'pending') c.appendChild(el('div', 'note', 'Your message: ' + r.note));
    var row = el('div', 'btns');
    if (r.status === 'pending') { row.appendChild(btn('Accept', '', function () { accept(r); })); row.appendChild(btn('Other time', 'ghost', function () { suggest(r); })); row.appendChild(btn('Decline', 'ghost', function () { decline(r); })); }
    else if (r.status === 'accepted') { row.appendChild(btn('Change time', 'ghost', function () { suggest(r); })); row.appendChild(btn('Cancel', 'ghost', function () { cancelAppt(r); })); }
    else if (r.status === 'countered') { row.appendChild(btn('Cancel', 'ghost', function () { cancelAppt(r); })); }
    if (r.phone) { var a = el('a', 'btn sm ghost', 'Call'); a.href = 'tel:' + String(r.phone).replace(/[^\d+]/g, ''); row.appendChild(a); }
    c.appendChild(row); return c;
  }
  function apptsView(v) {
    v.appendChild(el('h2', '', 'Appointments'));
    var c = el('div', 'card'); v.appendChild(c);
    if (!page) {
      c.appendChild(el('div', 'hint', 'Let customers see your open times and ask for an appointment. You choose the types (like a 2-hour estimate) and the hours. Every request comes to you to accept, change or decline.'));
      var go = el('button', 'btn wide', 'Set up appointment booking'); go.type = 'button'; go.onclick = settingsModal; c.appendChild(go);
    } else {
      c.appendChild(el('div', '', page.enabled === false ? 'Booking is turned off.' : (page.who === 'anyone' ? 'Anyone with your link can ask for a time.' : 'Your customers can ask for a time from their portal.')));
      c.appendChild(el('div', 'hint', (page.types || []).map(function (t) { return t.name; }).join(', ') || 'No appointment types yet.'));
      var row = el('div', 'btns'); row.appendChild(btn('Availability', '', settingsModal)); row.appendChild(btn('Block off time', 'ghost', blockModal));
      if (page.who === 'anyone') row.appendChild(btn('Share booking link', 'ghost', function () { Q.tools.showText('Booking link', 'You can ask for an appointment with ' + S().biz.name + ' here:\n' + base() + 'book.html?b=' + bid(), ''); }));
      c.appendChild(row);
      var bl = (page.blocks || []).filter(function (b) { return b.e > Date.now(); });
      if (bl.length) { c.appendChild(el('h2', '', 'Blocked time')); bl.forEach(function (b) { var r = el('div', 'row'), m = el('div', 'm'); m.appendChild(el('b', '', (b.n || 'Blocked'))); m.appendChild(el('span', '', B.fmtRange(tzOf(), b.s, b.e))); r.appendChild(m); r.appendChild(btn('Remove', 'ghost', function () { Q.db.collection('bookingPages').doc(bid()).update({ blocks: (page.blocks || []).filter(function (x) { return x !== b && !(x.s === b.s && x.e === b.e); }), updatedAt: Q.FV.serverTimestamp() }).then(function () { lastHash = ''; soonSync(); }); })); c.appendChild(r); }); }
    }
    var now = Date.now(), pend = reqs.filter(function (r) { return r.status === 'pending'; }).sort(function (a, b) { return a.start - b.start; });
    var ctr = reqs.filter(function (r) { return r.status === 'countered'; }), up = reqs.filter(function (r) { return r.status === 'accepted' && r.end >= now; }).sort(function (a, b) { return a.start - b.start; });
    var old = reqs.filter(function (r) { return (r.status === 'declined' || r.status === 'canceled' || (r.status === 'accepted' && r.end < now)); }).sort(function (a, b) { return b.start - a.start; }).slice(0, 8);
    if (pend.length) { v.appendChild(el('h2', '', 'Waiting for you')); pend.forEach(function (r) { v.appendChild(reqCard(r)); }); }
    if (ctr.length) { v.appendChild(el('h2', '', 'You suggested another time')); ctr.forEach(function (r) { v.appendChild(reqCard(r)); }); }
    v.appendChild(el('h2', '', 'Coming up')); if (!up.length) v.appendChild(el('div', 'empty', 'No accepted appointments yet.')); up.forEach(function (r) { v.appendChild(reqCard(r)); });
    if (old.length) { v.appendChild(el('h2', '', 'Earlier')); old.forEach(function (r) { var row = el('div', 'row'), m = el('div', 'm'); m.appendChild(el('b', '', r.name + ' · ' + r.typeName)); m.appendChild(el('span', '', rangeOf(r))); row.appendChild(m); row.appendChild(el('span', 'pill' + (r.status === 'accepted' ? ' ok' : ' bad'), r.status === 'accepted' ? 'Done' : r.status)); v.appendChild(row); }); }
  }

  function start() {
    if (started) return; started = true;
    Q.db.collection('bookingPages').doc(bid()).onSnapshot(function (d) { page = d.exists ? d.data() : null; refresh(); soonSync(); }, function () { /* not set up */ });
    Q.db.collection('apptRequests').where('bizId', '==', bid()).onSnapshot(function (sn) { reqs = sn.docs.map(function (x) { var o = x.data(); o.id = x.id; return o; }); refresh(); soonSync(); }, function () { /* ignore */ });
    setInterval(function () { syncNow(); syncPortals(); }, 45000); setTimeout(syncPortals, 6000);
  }
  function boot() {
    Q.views.appts = apptsView;
    Q.menuTop.push({ l: 'Appointments', tab: 'appts', badge: pendingN });
    Q.eventSources.push(function (from, to) {
      var tz = tzOf(); return reqs.filter(function (r) { return r.status === 'accepted'; }).map(function (r) { return { date: B.ymd(tz, r.start), time: B.hm(tz, r.start), label: 'Appointment', title: r.name + ' · ' + r.typeName, act: { label: 'Open', run: function () { Q.S.tab = 'appts'; Q.render(); } } }; }).filter(function (e) { return e.date >= from && e.date <= to; });
    });
    Q.banners = Q.banners || [];
    Q.banners.push(function (v) {
      var n = pendingN(); if (!n) return; var b = el('button', 'vq-note blue'); b.type = 'button'; var d = el('span', 'dot', String(n)), t = el('div', 't'); t.appendChild(el('b', '', n + (n === 1 ? ' appointment request' : ' appointment requests'))); t.appendChild(el('span', '', 'Accept, suggest another time, or decline')); b.appendChild(d); b.appendChild(t); b.appendChild(el('span', 'go', '›')); b.onclick = function () { Q.S.tab = 'appts'; Q.render(); }; v.appendChild(b);
    });
    Q.onStart.push(start); if (Q.S.biz && Q.db) start();
  }
  addPortalActions();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
