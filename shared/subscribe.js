// Vyqil subscription: 30-day free trial (counted by the server), then $7/month per app, paid through PayPal.
// Shows reminders at 10, 7, 3 days and on the last day of the trial, and locks the app when the trial has ended without a subscription.
// The server decides the state (free trial / active / locked); if it cannot be reached the app is NOT locked.
(function () {
  if (window.VQSub) return;
  var BASE = function () { return String(window.VYQIL_ASSISTANT_URL || 'https://vyqil-assistant.dusterman225.workers.dev').replace(/\/$/, ''); };
  var CUR = null, DATA = null, REMIND = [10, 7, 3, 1];
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  function api(path, body) {
    var u = firebase.auth().currentUser; if (!u) return Promise.reject(new Error('signin'));
    return u.getIdToken().then(function (t) {
      return fetch(BASE() + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(body || {}) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.detail || j.error || 'error'); e.detail = j.detail; throw e; } return j; }); });
    });
  }
  var css = document.createElement('style'); css.textContent =
    '.vqs-bg{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:300;display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto}' +
    '.vqs-lock{background:#05070A}.vqs-box{background:#0a0f16;color:#e8eef6;width:100%;max-width:440px;border:1px solid #1c2530;border-radius:18px;padding:22px;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif}' +
    '.vqs-box h3{margin:0 0 8px;font-size:1.2rem}.vqs-box p{margin:8px 0;line-height:1.45;opacity:.85;font-size:.95rem}.vqs-price{font-size:1.6rem;font-weight:800;margin:10px 0}' +
    '.vqs-btn{display:block;width:100%;box-sizing:border-box;border:0;border-radius:12px;padding:14px;font-size:1rem;font-weight:700;background:#2b7bd8;color:#fff;margin-top:10px;cursor:pointer}.vqs-btn.ghost{background:transparent;border:1px solid #2f4a68;color:#cfe6ff;font-weight:600}' +
    '.vqs-err{color:#ff8a8a;min-height:1.2em;font-size:.88rem}.vqs-lk{display:inline-block;margin:12px 12px 0 0;color:#9ec8ff;font-size:.88rem;text-decoration:underline;cursor:pointer;background:none;border:0;padding:0}';
  document.head.appendChild(css);
  function app() { return (CUR && CUR.app) || ''; }
  function ret() { return location.href.split('#')[0].replace(/([?&])(pp|subscription_id|ba_token|token|PayerID|paid)=[^&]*/g, '$1').replace(/[?&]+$/, ''); }
  function money() { return '$7/month'; }
  function subscribe(btn, err) {
    if (btn) { btn.disabled = true; btn.textContent = 'Opening PayPal...'; } if (err) err.textContent = '';
    api('/pp/subscribe', { kind: 'app', app: CUR.app, bizId: CUR.bizId, email: (firebase.auth().currentUser || {}).email || '', returnUrl: ret() })
      .then(function (d) { if (d && d.url) location.href = d.url; else throw new Error('No checkout link'); })
      .catch(function (e) { if (btn) { btn.disabled = false; btn.textContent = 'Subscribe for ' + money(); } if (err) err.textContent = (e && e.detail) || 'Could not open PayPal. Please try again.'; });
  }
  function dateText(s) { try { return new Date(s + 'T12:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }); } catch (e) { return s; } }
  function modal(build, locked) {
    var bg = el('div', 'vqs-bg' + (locked ? ' vqs-lock' : '')), box = el('div', 'vqs-box'); bg.appendChild(box);
    function close() { bg.remove(); } if (!locked) bg.addEventListener('click', function (e) { if (e.target === bg) close(); });
    build(box, close); document.body.appendChild(bg); return bg;
  }
  function lock(d) {
    if (document.getElementById('vqsLock')) return;
    var bg = modal(function (b) {
      b.appendChild(el('h3', '', 'Your free trial has ended'));
      b.appendChild(el('p', '', 'The 30-day free trial of ' + (CUR.appName || 'this app') + ' ended' + (d.trialEnd ? ' on ' + dateText(d.trialEnd) : '') + '. Your information is safe and waiting for you.'));
      if (d.canBuy) {
        b.appendChild(el('div', 'vqs-price', money())); b.appendChild(el('p', '', 'One subscription for this app, billed monthly through PayPal. Cancel any time.'));
        var err = el('div', 'vqs-err'), go = el('button', 'vqs-btn', 'Subscribe for ' + money()); go.type = 'button'; go.onclick = function () { subscribe(go, err); }; b.appendChild(go); b.appendChild(err);
      } else b.appendChild(el('p', '', 'Please ask the owner of this business to subscribe. Then reopen this page.'));
      var sw = el('a', 'vqs-lk', 'Switch business'); sw.href = '/dashboard.html'; b.appendChild(sw);
      var so = el('button', 'vqs-lk', 'Sign out'); so.type = 'button'; so.onclick = function () { firebase.auth().signOut().then(function () { location.href = '/dashboard.html'; }, function () { location.href = '/dashboard.html'; }); }; b.appendChild(so);
    }, true); bg.id = 'vqsLock';
  }
  function remind(d) {
    if (!d.canBuy || d.state !== 'trial' || typeof d.daysLeft !== 'number') return;
    var key = 'vqs_rem_' + CUR.bizId + '_' + CUR.app, seen = {}; try { seen = JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { }
    var due = REMIND.filter(function (t) { return d.daysLeft <= t && !seen[t]; }); if (!due.length) return;
    REMIND.forEach(function (t) { if (d.daysLeft <= t) seen[t] = 1; }); try { localStorage.setItem(key, JSON.stringify(seen)); } catch (e) { }
    var n = d.daysLeft;
    modal(function (b, close) {
      b.appendChild(el('h3', '', n <= 1 ? 'Your free trial ends today' : 'Your free trial ends in ' + n + ' days'));
      b.appendChild(el('p', '', 'Subscribe now to keep using ' + (CUR.appName || 'this app') + ' without a break. Your first payment is on the day your trial ends, not today.'));
      b.appendChild(el('div', 'vqs-price', money())); var err = el('div', 'vqs-err');
      var go = el('button', 'vqs-btn', 'Subscribe for ' + money()); go.type = 'button'; go.onclick = function () { subscribe(go, err); };
      var later = el('button', 'vqs-btn ghost', 'Remind me later'); later.type = 'button'; later.onclick = close; b.appendChild(go); b.appendChild(later); b.appendChild(err);
    });
  }
  function open() {
    function show(d) {
      modal(function (b, close) {
        b.appendChild(el('h3', '', 'Subscription: ' + (CUR.appName || 'this app')));
        var err = el('div', 'vqs-err');
        if (d.state === 'free') b.appendChild(el('p', '', d.why === 'admin' ? 'Free: you are a Vyqil admin.' : 'Free: this business has a complimentary subscription.'));
        else if (d.state === 'active') {
          b.appendChild(el('p', '', d.cancelled ? 'Cancelled. You can keep using this app until ' + dateText(d.until) + '.' : 'Active: $7/month. Paid up through about ' + dateText(d.until) + ', and it renews by itself.'));
          if (d.managed && !d.cancelled && d.canBuy) { var cn = el('button', 'vqs-btn ghost', 'Cancel subscription'); cn.type = 'button'; cn.onclick = function () { if (!confirm('Cancel your subscription? You keep access until the end of the month you already paid for.')) return; cn.disabled = true; api('/pp/cancel', { kind: 'app', app: CUR.app, bizId: CUR.bizId }).then(function () { try { sessionStorage.removeItem('vqsub_' + CUR.bizId + '_' + CUR.app); } catch (e) { } close(); open(); }, function (e) { cn.disabled = false; err.textContent = (e && e.detail) || 'Could not cancel. Please try again.'; }); }; b.appendChild(cn); }
        } else {
          b.appendChild(el('p', '', 'Free trial: ' + d.daysLeft + ' day' + (d.daysLeft === 1 ? '' : 's') + ' left' + (d.trialEnd ? ' (ends ' + dateText(d.trialEnd) + ')' : '') + '.'));
          if (d.canBuy) { b.appendChild(el('div', 'vqs-price', money())); b.appendChild(el('p', '', 'Subscribe any time during your trial. You are not charged until the trial ends. Cancel any time.')); var go = el('button', 'vqs-btn', 'Subscribe for ' + money()); go.type = 'button'; go.onclick = function () { subscribe(go, err); }; b.appendChild(go); }
          else b.appendChild(el('p', '', 'Only the owner can subscribe.'));
        }
        b.appendChild(err); var x = el('button', 'vqs-btn ghost', 'Close'); x.type = 'button'; x.onclick = close; b.appendChild(x);
      });
    }
    if (DATA) show(DATA); else load(true).then(function (d) { if (d) show(d); });
  }
  function load(fresh) {
    var key = 'vqsub_' + CUR.bizId + '_' + CUR.app, now = Date.now();
    if (!fresh) { try { var c = JSON.parse(sessionStorage.getItem(key) || 'null'); if (c && now - c.t < 15 * 60000 && c.d.state !== 'locked') { return Promise.resolve(c.d); } } catch (e) { } }
    return api('/sub/status', { bizId: CUR.bizId, app: CUR.app }).then(function (d) {
      try { sessionStorage.setItem(key, JSON.stringify({ t: now, d: d })); localStorage.setItem(key + '_last', JSON.stringify({ t: now, d: d })); } catch (e) { } return d;
    }, function () {
      try { var l = JSON.parse(localStorage.getItem(key + '_last') || 'null'); if (l && now - l.t < 24 * 3600000) return l.d; } catch (e) { } return null; // server not reachable: never lock by mistake
    });
  }
  // Coming back from PayPal: confirm what was bought so it switches on right away.
  function handleReturn() {
    var q = new URLSearchParams(location.search), pp = q.get('pp'); if (!pp) return Promise.resolve(false);
    var body = { bizId: CUR.bizId }; if (pp === 'sub') body.subscriptionId = q.get('subscription_id'); else if (pp === 'order') body.orderId = q.get('token'); else return Promise.resolve(false);
    if (!body.subscriptionId && !body.orderId) return Promise.resolve(false);
    try { history.replaceState(null, '', ret() + location.hash); } catch (e) { }
    try { sessionStorage.removeItem('vqsub_' + CUR.bizId + '_' + CUR.app); } catch (e) { }
    return api('/pp/confirm', body).then(function (r) {
      var t = el('div', '', r && r.kind === 'topup' ? 'Thank you! Your credits were added.' : 'Thank you! Your subscription is active.'); t.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#1c8a4a;color:#fff;padding:12px 18px;border-radius:12px;z-index:400;font-size:.95rem';
      document.body.appendChild(t); setTimeout(function () { t.remove(); if (r && r.kind !== 'app') location.reload(); }, 1800); return true;
    }, function () { return false; });
  }
  window.VQSub = {
    open: open,
    start: function (o) {
      if (!o || !o.bizId || !o.app) return; CUR = { app: String(o.app), appName: o.appName || '', bizId: o.bizId };
      function go() { handleReturn().then(function () { return load(true); }).then(function (d) { if (!d) return; DATA = d; if (d.state === 'locked') lock(d); else remind(d); }); }
      if (firebase.auth().currentUser) go(); else { var un = firebase.auth().onAuthStateChanged(function (u) { if (u) { un(); go(); } }); }
    }
  };
})();
