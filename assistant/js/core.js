// VyqilAssistant core: shared state, date and money helpers, Firestore access, pop-ups.
(function () {
  var VA = window.VA = { S: { user: null, hid: '', hh: null, data: {}, tab: 'today', sub: {}, sel: null, listeners: [], unsubs: [] } };
  var COLS = ['events', 'bills', 'txns', 'goals', 'tasks', 'items', 'meals', 'people', 'home', 'notes'];
  VA.COLS = COLS; COLS.forEach(function (c) { VA.S.data[c] = []; });
  var $ = VA.$ = function (id) { return document.getElementById(id); };
  VA.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var esc = VA.esc;

  // ---- dates (all kept as local "YYYY-MM-DD" text, so time zones never shift a date) ----
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  VA.ymd = function (d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
  VA.parse = function (s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null; };
  VA.today = function () { return VA.ymd(new Date()); };
  VA.addDays = function (s, n) { var d = VA.parse(s); if (!d) return s; d.setDate(d.getDate() + n); return VA.ymd(d); };
  VA.addMonths = function (s, n) { var d = VA.parse(s); if (!d) return s; var day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); var last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return VA.ymd(d); };
  VA.diff = function (a, b) { var x = VA.parse(a), y = VA.parse(b); return x && y ? Math.round((y - x) / 864e5) : 0; };
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  VA.MON = MON; VA.DOW = DOW;
  VA.dow = function (s) { var d = VA.parse(s); return d ? DOW[d.getDay()] : ''; };
  VA.fmtDate = function (s) { var d = VA.parse(s); return d ? DOW[d.getDay()] + ', ' + MON[d.getMonth()] + ' ' + d.getDate() : ''; };
  VA.fmtShort = function (s) { var d = VA.parse(s); return d ? MON[d.getMonth()] + ' ' + d.getDate() : ''; };
  VA.fmtTime = function (t) { var m = /^(\d{1,2}):(\d{2})/.exec(t || ''); if (!m) return ''; var h = +m[1]; return ((h % 12) || 12) + ':' + m[2] + (h < 12 ? ' AM' : ' PM'); };
  VA.rel = function (s) { var n = VA.diff(VA.today(), s); if (n === 0) return 'today'; if (n === 1) return 'tomorrow'; if (n === -1) return 'yesterday'; return n > 0 ? 'in ' + n + ' days' : Math.abs(n) + ' days ago'; };

  // ---- money (stored as whole cents) ----
  VA.cents = function (v) { var n = Number(String(v == null ? '' : v).replace(/[$,\s]/g, '')); return isFinite(n) ? Math.round(n * 100) : 0; };
  VA.money = function (c) { c = Math.round(c || 0); return (c < 0 ? '-' : '') + '$' + (Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  VA.dollars = function (c) { return c ? String(Math.round(c) / 100) : ''; };

  // ---- Firestore ----
  VA.db = function () { return firebase.firestore(); };
  VA.col = function (name) { return VA.db().collection('households').doc(VA.S.hid).collection(name); };
  VA.get = function (name, id) { return (VA.S.data[name] || []).filter(function (x) { return x.id === id; })[0] || null; };
  VA.save = function (name, id, data) {
    var ref = id ? VA.col(name).doc(id) : VA.col(name).doc();
    var clean = {}; Object.keys(data).forEach(function (k) { if (k !== 'id' && data[k] !== undefined) clean[k] = data[k]; });
    clean.updatedAt = firebase.firestore.FieldValue.serverTimestamp(); clean.updatedBy = VA.S.user ? VA.S.user.uid : '';
    return ref.set(clean, { merge: true }).then(function () { return ref.id; });
  };
  VA.del = function (name, id) { return VA.col(name).doc(id).delete(); };
  VA.me = function () { var u = VA.S.user; var nm = VA.S.hh && VA.S.hh.memberNames && u && VA.S.hh.memberNames[u.uid]; return nm || (u && u.displayName) || 'Me'; };
  // Everyone a task or appointment can belong to: signed-in members plus kids, pets and others added under People.
  VA.who = function () {
    var out = [], seen = {};
    function add(n) { n = String(n || '').trim(); if (n && !seen[n.toLowerCase()]) { seen[n.toLowerCase()] = 1; out.push(n); } }
    var mn = VA.S.hh && VA.S.hh.memberNames || {}; Object.keys(mn).forEach(function (k) { add(mn[k]); });
    VA.S.data.people.forEach(function (p) { add(p.name); });
    return out;
  };
  VA.onChange = function (fn) { VA.S.listeners.push(fn); };
  var pend = null;
  VA.changed = function () { clearTimeout(pend); pend = setTimeout(function () { VA.S.listeners.forEach(function (f) { try { f(); } catch (e) { if (window.console) console.error(e); } }); }, 40); };
  VA.listen = function () {
    VA.S.unsubs.forEach(function (u) { try { u(); } catch (e) { /* ignore */ } }); VA.S.unsubs = [];
    COLS.forEach(function (c) {
      VA.S.unsubs.push(VA.col(c).onSnapshot(function (snap) {
        VA.S.data[c] = snap.docs.map(function (d) { var o = d.data(); o.id = d.id; return o; }); VA.changed();
      }, function (e) { VA.toast('Could not load ' + c + ' (' + (e && e.code || 'error') + '). Check that the latest firestore.rules were published.'); }));
    });
  };

  // ---- pop-ups ----
  VA.modal = function (html, mount) {
    var root = $('modalRoot'), m = document.createElement('div'); m.className = 'modal';
    m.innerHTML = '<div class="sheet">' + html + '</div>';
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
    root.appendChild(m);
    function close() { if (m.parentNode) { m.parentNode.removeChild(m); VA.changed(); } }
    if (mount) mount(m.firstChild, close);
    return close;
  };
  var tt = null;
  VA.toast = function (msg, label, fn) {
    var r = $('toastRoot'); r.innerHTML = ''; clearTimeout(tt);
    var t = document.createElement('div'); t.className = 'toast'; t.innerHTML = '<span>' + esc(msg) + '</span>' + (label ? '<button type="button">' + esc(label) + '</button>' : '');
    if (label) t.lastChild.addEventListener('click', function () { r.innerHTML = ''; if (fn) fn(); });
    r.appendChild(t); tt = setTimeout(function () { r.innerHTML = ''; }, label ? 7000 : 3800);
  };
  VA.confirm = function (msg, yes, fn) {
    VA.modal('<h3>' + esc(msg) + '</h3><div class="btns"><button class="btn danger" id="cY" type="button">' + esc(yes || 'Yes') + '</button><button class="btn ghost" id="cN" type="button">Cancel</button></div>', function (s, close) {
      s.querySelector('#cY').onclick = function () { close(); fn(); }; s.querySelector('#cN').onclick = close;
    });
  };
  VA.download = function (name, text, type) {
    var b = new Blob([text], { type: type || 'text/plain' }), a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
})();
