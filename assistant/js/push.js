// Phone alerts that arrive even when VyqilAssistant is closed. The app sends the next 14 days of reminders
// to the alerts worker (only after the person turns this on); the worker sends them as notifications on time.
(function () {
  var VA = window.VA, S = VA.S, esc = VA.esc || function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var URL_ = function () { return String(window.VYQIL_PUSH_URL || '').replace(/\/$/, ''); };
  var last = '', timer = null, busy = false;
  var ON = 'va_push';

  function supported() { return !!(window.Notification && 'serviceWorker' in navigator && 'PushManager' in window && URL_()); }
  function iosNeedsInstall() { var ios = /iPhone|iPad|iPod/.test(navigator.userAgent); var standalone = window.navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches); return ios && !standalone; }
  function flag() { try { return localStorage.getItem(ON) === '1'; } catch (e) { return false; } }
  function setFlag(v) { try { if (v) localStorage.setItem(ON, '1'); else localStorage.removeItem(ON); } catch (e) { /* ignore */ } }

  function when(date, h, m) { var p = date.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], h, m || 0).getTime(); }
  function myName() { var mn = S.hh && S.hh.memberNames || {}; return S.user && mn[S.user.uid] || ''; }
  function ready() { var n = 0; for (var k in (S.loaded || {})) n++; return n >= 10 && S.hid; }

  // The reminders for the next 14 days, each with the time it should arrive.
  function build() {
    var t = VA.today(), to = VA.addDays(t, 14), out = [], now = Date.now() + 20000, me = myName().toLowerCase();
    function add(id, at, title, body) { if (at > now) out.push({ id: id, at: at, title: String(title).slice(0, 80), body: String(body || '').slice(0, 160) }); }
    VA.occ(t, to).forEach(function (o) {
      var r = o.ref, id = o.kind + '|' + r.id + '|' + o.date, eve = when(VA.addDays(o.date, -1), 17), morning = when(o.date, 8);
      var other = o.who && me && String(o.who).toLowerCase() !== me && (o.kind === 'task' || o.kind === 'home');
      if (other) return;
      if (o.kind === 'event') {
        var rem = +r.remind || 0; if (!rem) return;
        if (rem >= 1440) add(id + '|d', eve, 'Tomorrow: ' + o.title, o.time ? VA.fmtTime(o.time) : 'All day');
        else if (o.time) { var m = /^(\d+):(\d+)/.exec(o.time); if (m) add(id + '|h', when(o.date, +m[1], +m[2]) - rem * 60000, o.title, 'Starts at ' + VA.fmtTime(o.time) + (o.who ? ' (' + o.who + ')' : '')); }
      } else if (o.kind === 'bill') {
        add(id + '|m', morning, 'Bill due today', o.title + (r.autopay ? ' (autopay)' : ''));
        add(id + '|e', eve, 'Bill due tomorrow', o.title + (r.autopay ? ' (autopay)' : ''));
      } else if (o.kind === 'trial') add(id + '|e', eve, 'Free trial ends tomorrow', r.name || o.title);
      else if (o.kind === 'task') add(id + '|m', morning, 'Task due today', o.title);
      else if (o.kind === 'home') add(id + '|m', morning, 'Home care due today', o.title);
      else if (o.kind === 'bday') add(id + '|m', morning, 'Birthday today', o.title);
    });
    return out;
  }

  function api(path, body, method) {
    var u = firebase.auth().currentUser; if (!u) return Promise.reject(new Error('Please sign in again.'));
    return u.getIdToken().then(function (tok) {
      return fetch(URL_() + path, { method: method || 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok }, body: method === 'GET' ? undefined : JSON.stringify(body || {}) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.detail || j.error || ('error ' + r.status)); e.code = j.error; throw e; } return j; }); });
    });
  }
  function reg() { return navigator.serviceWorker.register('sw.js').then(function () { return navigator.serviceWorker.ready; }); }
  function key(b64) { var s = b64.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; var r = atob(s), o = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) o[i] = r.charCodeAt(i); return o; }
  function current() { return reg().then(function (r) { return r.pushManager.getSubscription(); }); }

  function sync(force) {
    if (!flag() || !supported() || Notification.permission !== 'granted' || !ready() || busy) return Promise.resolve(false);
    var items = build(), sig = JSON.stringify(items);
    if (!force && sig === last) return Promise.resolve(true);
    busy = true;
    return current().then(function (sub) {
      if (!sub) { setFlag(false); return false; }
      return api('/sync', { sub: sub.toJSON(), items: items }).then(function () { last = sig; return true; });
    }).catch(function (e) { if (window.console) console.warn('alerts sync', e); return false; }).then(function (ok) { busy = false; return ok; });
  }
  function soon() { clearTimeout(timer); timer = setTimeout(function () { sync(false); }, 4000); }

  function enable() {
    if (!supported()) return Promise.reject(new Error('This browser cannot receive alerts when closed.'));
    if (iosNeedsInstall()) return Promise.reject(new Error('On iPhone, first add VyqilAssistant to your Home Screen (Share, then Add to Home Screen), open it from there, and turn alerts on again.'));
    return Notification.requestPermission().then(function (p) {
      if (p !== 'granted') throw new Error('Alerts are blocked. Allow notifications for this site in your browser or phone settings, then try again.');
      return reg();
    }).then(function (r) {
      return fetch(URL_() + '/vapid').then(function (x) { return x.json(); }).then(function (v) {
        if (!v.key) throw new Error('The alerts service is not set up yet.');
        return r.pushManager.getSubscription().then(function (old) { return old || r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(v.key) }); });
      });
    }).then(function (sub) {
      return api('/sync', { sub: sub.toJSON(), items: build() }).then(function () { setFlag(true); last = ''; });
    }).catch(function (e) {
      if (/Failed to fetch|NetworkError|Load failed/i.test(e && e.message)) throw new Error('Could not reach the alerts service. It may not be set up yet.');
      throw e;
    });
  }
  function disable() {
    return current().then(function (sub) {
      setFlag(false); last = '';
      if (!sub) return;
      var ep = sub.endpoint;
      return api('/off', { endpoint: ep }).catch(function () { /* the phone is unsubscribed below anyway */ }).then(function () { return sub.unsubscribe(); });
    });
  }
  function test() { return current().then(function (sub) { if (!sub) throw new Error('Alerts are not on yet.'); return api('/test', { sub: sub.toJSON() }); }); }

  function panel() {
    var on = flag() && window.Notification && Notification.permission === 'granted';
    var blocked = window.Notification && Notification.permission === 'denied';
    var h = '<h3>Phone alerts</h3>';
    if (!supported()) {
      h += '<p class="hint">' + (URL_() ? 'This browser cannot receive alerts while closed. Try Chrome on Android, or on iPhone open this page in Safari and add it to your Home Screen.' : 'Alerts are not set up yet.') + ' You can still add the Calendar file to your phone for reminders.</p><div class="btns"><button class="btn ghost" id="pX" type="button">Close</button></div>';
    } else {
      h += '<p>' + (on ? '<b style="color:#6fe0a0">On for this phone.</b>' : '<b>Off.</b>') + '</p>' +
        '<p class="hint">Get a notification even when VyqilAssistant is closed: appointments (1 hour or 1 day before, if you set a reminder), bills (the evening before and the morning they are due), your tasks and home care (the morning they are due), and birthdays.</p>' +
        '<p class="hint">To do this, the titles and times of your next 14 days of reminders are sent to the VyqilAssistant alerts service until they are delivered. Nothing else is shared. Each notification travels through your phone maker\'s push service in encrypted form.</p>' +
        (iosNeedsInstall() ? '<p class="hint"><b>iPhone:</b> open this page in Safari, tap Share, then Add to Home Screen. Open VyqilAssistant from your Home Screen and turn alerts on there.</p>' : '') +
        (blocked ? '<p class="hint" style="color:#ff8a8a">Notifications are blocked for this site. Allow them in your browser or phone settings first.</p>' : '') +
        '<p class="hint" id="pMsg"></p><div class="btns">' + (on ? '<button class="btn" id="pTest" type="button">Send a test alert</button><button class="btn ghost" id="pOff" type="button">Turn off</button>' : '<button class="btn" id="pOn" type="button">Turn on alerts</button>') + '<button class="btn ghost" id="pX" type="button">Close</button></div>';
    }
    VA.modal(h, function (s, close) {
      var msg = function (t, bad) { var m = s.querySelector('#pMsg'); if (m) { m.textContent = t; m.style.color = bad ? '#ff8a8a' : ''; } };
      var x = s.querySelector('#pX'); if (x) x.onclick = close;
      var b = s.querySelector('#pOn'); if (b) b.onclick = function () { b.disabled = true; msg('Setting up…'); enable().then(function () { close(); VA.toast('Alerts are on. Tap the bell to send a test.'); }).catch(function (e) { b.disabled = false; msg(e.message || 'Could not turn on alerts.', true); }); };
      b = s.querySelector('#pOff'); if (b) b.onclick = function () { b.disabled = true; disable().then(function () { close(); VA.toast('Alerts are off.'); }).catch(function () { b.disabled = false; msg('Could not turn off. Try again.', true); }); };
      b = s.querySelector('#pTest'); if (b) b.onclick = function () { b.disabled = true; msg('Sending…'); test().then(function (r) { b.disabled = false; msg(r.ok ? 'Sent. It should arrive in a few seconds.' : 'The phone service refused it (' + r.status + '). Turn alerts off and on again.', !r.ok); }).catch(function (e) { b.disabled = false; msg(e.message || 'Could not send.', true); }); };
    });
  }

  VA.push = { supported: supported, enable: enable, disable: disable, test: test, panel: panel, sync: sync, on: flag };
  VA.onChange(soon);
})();
