// Phone alerts for VyqilContractor and the customer portal.
//  - Team phones: a daily-ready list of dated reminders (invoices, estimates, bills, leads, job starts) AND an instant alert
//    when a customer messages, approves, asks for changes or declines.
//  - Customer phones: an instant alert when the contractor sends an estimate, invoice, document, message or project update.
// Alerts only contain short fixed wording. Amounts, names of documents and message text never leave the app.
(function () {
  var URL_ = function () { return String(window.VYQIL_PUSH_URL || 'https://vyqil-push.dusterman225.workers.dev').replace(/\/$/, ''); };
  var KEY = { team: 'vq_push_team', customer: 'vq_push_customer' };
  var last = '';

  function flag(mode) { try { return localStorage.getItem(KEY[mode]) === '1'; } catch (e) { return false; } }
  function setFlag(mode, v) { try { if (v) localStorage.setItem(KEY[mode], '1'); else localStorage.removeItem(KEY[mode]); } catch (e) { /* ignore */ } }
  function supported() { return !!(window.Notification && 'serviceWorker' in navigator && 'PushManager' in window); }
  function iosNeedsInstall() { var ios = /iPhone|iPad|iPod/.test(navigator.userAgent); var st = window.navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches); return ios && !st; }
  function reg() { return navigator.serviceWorker.register('sw.js').then(function () { return navigator.serviceWorker.ready; }); }
  function current() { return reg().then(function (r) { return r.pushManager.getSubscription(); }); }
  function key(b64) { var s = b64.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; var r = atob(s), o = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) o[i] = r.charCodeAt(i); return o; }
  function api(path, body) {
    var u = firebase.auth().currentUser; if (!u) return Promise.reject(new Error('Please sign in again.'));
    return u.getIdToken().then(function (tok) {
      return fetch(URL_() + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok }, body: JSON.stringify(body || {}) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.detail || j.error || ('error ' + r.status)); e.code = j.error; throw e; } return j; }); });
    });
  }

  // ---------- team reminders (dated, 14 days ahead) ----------
  function addDays(ymd, n) { var p = ymd.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2] + n); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function at(ymd, h) { var p = ymd.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], h, 0).getTime(); }
  function ms(t) { return t && t.toMillis ? t.toMillis() : 0; }
  function ymdOf(m) { var d = new Date(m); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function first(n) { return String(n || '').trim().split(/\s+/)[0] || 'customer'; }

  async function buildTeam(ctx) {
    var today = vutil.todayStr(), end = addDays(today, 14), soon = Date.now() + 20000, out = [];
    var money = ctx.role === 'owner' || ctx.role === 'supervisor' || ctx.role === 'gm';
    function add(id, ymd, hour, title, body) { if (!ymd || ymd > end) return; var t = at(ymd, hour); if (t > soon) out.push({ id: id + '|' + ymd, at: t, title: String(title).slice(0, 80), body: String(body || '').slice(0, 160) }); }
    async function grab(name) { var a = []; try { (await ctx.bizRef.collection(name).get()).forEach(function (d) { var x = d.data(); x.id = d.id; a.push(x); }); } catch (e) { /* optional */ } return a; }
    var r = await Promise.all([money ? grab('invoices') : [], money ? grab('estimates') : [], money ? grab('expenses') : [], grab('leads'), grab('jobs')]);
    r[0].forEach(function (i) {
      if ((i.status !== 'Sent' && i.status !== 'Partially Paid') || !/^\d{4}-\d{2}-\d{2}$/.test(i.dueDate || '')) return;
      var what = 'Invoice ' + (i.number || '') + ' (' + first(i.customerName) + ') ' + vutil.fmt((i.totalCents || 0) - (i.paidCents || 0));
      add('inv' + i.id + 'd1', addDays(i.dueDate, -1), 8, 'Invoice due tomorrow', what);
      add('inv' + i.id + 'd0', i.dueDate, 8, 'Invoice due today', what);
      [1, 3, 7].forEach(function (k) { add('inv' + i.id + 'p' + k, addDays(i.dueDate, k), 8, 'Invoice ' + k + ' day' + (k > 1 ? 's' : '') + ' past due', what + '. Open to check and send a reminder.'); });
    });
    r[1].forEach(function (e) {
      if (e.status !== 'Sent') return;
      var what = 'Estimate ' + (e.number || '') + ' (' + first(e.customerName) + ') ' + vutil.fmt(e.totalCents || 0);
      if (/^\d{4}-\d{2}-\d{2}$/.test(e.validUntil || '')) { add('est' + e.id + 'x3', addDays(e.validUntil, -3), 8, 'Estimate expires in 3 days', what); add('est' + e.id + 'x0', e.validUntil, 8, 'Estimate expires today', what); }
      var sent = ms(e.sentAt); if (sent) { add('est' + e.id + 'w3', addDays(ymdOf(sent), 3), 9, 'No answer yet on an estimate', what); add('est' + e.id + 'w7', addDays(ymdOf(sent), 7), 9, 'Estimate waiting a week', what); }
    });
    r[2].forEach(function (b) {
      if (b.status !== 'Unpaid' || !/^\d{4}-\d{2}-\d{2}$/.test(b.dueDate || '')) return;
      var what = (b.vendor || b.description || 'A bill') + ' ' + vutil.fmt(b.amountCents || 0);
      add('exp' + b.id + 'd1', addDays(b.dueDate, -1), 8, 'Bill due tomorrow', what); add('exp' + b.id + 'd0', b.dueDate, 8, 'Bill due today', what);
    });
    r[3].forEach(function (l) { if (['Won', 'Lost'].indexOf(l.status) > -1 || !/^\d{4}-\d{2}-\d{2}$/.test(l.followUpOn || '')) return; add('lead' + l.id, l.followUpOn, 8, 'Follow up with ' + (l.name || 'a lead'), l.jobDetails ? String(l.jobDetails).slice(0, 80) : ''); });
    r[4].forEach(function (j) {
      if (['Not Started', 'Scheduled'].indexOf(j.status) < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(j.startDate || '')) return;
      add('job' + j.id + 's1', addDays(j.startDate, -1), 17, 'Job starts tomorrow', (j.title || 'Job') + ' (' + first(j.customerName) + ')');
      add('job' + j.id + 's0', j.startDate, 7, 'Job starts today', (j.title || 'Job') + ' (' + first(j.customerName) + ')');
    });
    return out.slice(0, 200);
  }

  function syncTeam(ctx, force) {
    if (!flag('team') || !supported() || Notification.permission !== 'granted') return Promise.resolve(false);
    return Promise.all([buildTeam(ctx), current()]).then(function (a) {
      if (!a[1]) { setFlag('team', false); return false; }
      var sig = JSON.stringify(a[0]); if (!force && sig === last) return true;
      return api('/sync', { sub: a[1].toJSON(), items: a[0] }).then(function () { last = sig; return true; });
    }).catch(function (e) { if (window.console) console.warn('alerts sync', e); return false; });
  }

  // ---------- turn on / off ----------
  function enable(mode, ctx) {
    if (!supported()) return Promise.reject(new Error('This browser cannot receive alerts while closed.'));
    if (iosNeedsInstall()) return Promise.reject(new Error('On iPhone, first add this site to your Home Screen (Share, then Add to Home Screen), open it from there, and turn alerts on again.'));
    return Notification.requestPermission().then(function (p) {
      if (p !== 'granted') throw new Error('Alerts are blocked. Allow notifications for this site in your browser or phone settings, then try again.');
      return reg();
    }).then(function (r) {
      return fetch(URL_() + '/vapid').then(function (x) { return x.json(); }).then(function (v) {
        if (!v.key) throw new Error('The alerts service is not set up yet.');
        return r.pushManager.getSubscription().then(function (old) { return old || r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(v.key) }); });
      });
    }).then(function (sub) {
      return api('/join', mode === 'team' ? { sub: sub.toJSON(), as: 'team', bizId: ctx.bizId } : { sub: sub.toJSON(), as: 'customer' }).then(function () {
        setFlag(mode, true); last = '';
        return mode === 'team' ? syncTeam(ctx, true) : true;
      });
    }).catch(function (e) {
      if (/Failed to fetch|NetworkError|Load failed/i.test(e && e.message)) throw new Error('Could not reach the alerts service. It may not be set up yet.');
      throw e;
    });
  }
  function disable(mode) {
    return current().then(function (sub) {
      setFlag(mode, false); last = '';
      if (!sub) return;
      return api('/off', { endpoint: sub.endpoint }).catch(function () { /* unsubscribed below anyway */ }).then(function () { return sub.unsubscribe(); });
    });
  }
  function test() { return current().then(function (sub) { if (!sub) throw new Error('Alerts are not on yet.'); return api('/test', { sub: sub.toJSON() }); }); }

  // ---------- the panel ----------
  function panel(mode, ctx) {
    var on = flag(mode) && window.Notification && Notification.permission === 'granted', blocked = window.Notification && Notification.permission === 'denied';
    var shade = document.createElement('div'); shade.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
    var box = document.createElement('div'); box.style.cssText = 'background:#0b1624;color:#e8f1fb;border:1px solid rgba(75,163,255,.5);border-radius:16px 16px 0 0;padding:18px 16px 22px;width:100%;max-width:520px;max-height:85vh;overflow:auto;font:15px/1.45 system-ui,sans-serif';
    function p(txt, small) { var e = document.createElement('p'); e.textContent = txt; e.style.cssText = 'margin:8px 0;' + (small ? 'opacity:.8;font-size:.88rem' : ''); box.appendChild(e); return e; }
    var h = document.createElement('h2'); h.textContent = 'Phone alerts'; h.style.margin = '0 0 6px'; box.appendChild(h);
    function btn(label, ghost, fn) { var b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.className = 'btn' + (ghost ? ' ghost' : ''); b.style.cssText = 'margin:6px 8px 0 0'; b.onclick = fn; return b; }
    function close() { if (shade.parentNode) shade.parentNode.removeChild(shade); }
    if (!supported()) {
      p('This browser cannot receive alerts while it is closed. Try Chrome on Android, or on iPhone open this page in Safari and add it to your Home Screen.');
      box.appendChild(btn('Close', true, close));
    } else {
      p(on ? 'On for this phone.' : 'Off.').style.fontWeight = '700';
      if (mode === 'customer') {
        p('Get a short alert on your phone when your contractor sends you an estimate, an invoice, a document to review, a message, or a project update. The alert only says that something new is waiting. No amounts or details are sent.', true);
      } else {
        p('Get an alert the moment a customer messages you, approves, asks for changes or declines. You also get reminders for invoices due or past due, estimates about to expire or waiting, bills, lead follow-ups and job start days.', true);
        p('Reminders are scheduled from what the app knew the last time you opened your dashboard, so open it now and then. If an invoice is paid while the app is closed, you may still get one more past-due reminder.', true);
        p('To do this, short reminder titles (for example "Invoice due today" with a customer first name and amount) for the next 14 days are held by the VyqilContractor alerts service until they are delivered.', true);
      }
      if (iosNeedsInstall()) p('iPhone: open this page in Safari, tap Share, then Add to Home Screen. Open it from your Home Screen and turn alerts on there.', true);
      if (blocked) { var bp = p('Notifications are blocked for this site. Allow them in your browser or phone settings first.', true); bp.style.color = '#ff8a8a'; }
      var msg = p('', true);
      function say(t, bad) { msg.textContent = t; msg.style.color = bad ? '#ff8a8a' : ''; }
      if (on) {
        box.appendChild(btn('Send a test alert', false, function () { say('Sending…'); test().then(function (r) { say(r.ok ? 'Sent. It should arrive in a few seconds.' : 'The phone service refused it (' + r.status + '). Turn alerts off and on again.', !r.ok); }).catch(function (e) { say(e.message || 'Could not send.', true); }); }));
        box.appendChild(btn('Turn off', true, function () { disable(mode).then(close).catch(function () { say('Could not turn off. Try again.', true); }); }));
      } else {
        box.appendChild(btn('Turn on alerts', false, function (ev) { var b = ev.target; b.disabled = true; say('Setting up…'); enable(mode, ctx).then(function () { close(); alert('Alerts are on.'); }).catch(function (e) { b.disabled = false; say(e.message || 'Could not turn on alerts.', true); }); }));
      }
      if (mode === 'customer') p('On a shared phone, turn alerts off before you sign out.', true);
      box.appendChild(btn('Close', true, close));
    }
    shade.appendChild(box); shade.addEventListener('click', function (e) { if (e.target === shade) close(); }); document.body.appendChild(shade);
  }

  window.vpush = { panel: panel, syncTeam: syncTeam, enable: enable, disable: disable, flag: flag };
})();
