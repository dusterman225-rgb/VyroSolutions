(function () {
  function fmt(cents) {
    return ((cents || 0) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }
  function toCents(v) {
    var n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''));
    return isNaN(n) ? 0 : Math.round(n * 100);
  }
  function totals(items, discountCents, taxPct) {
    var sub = 0;
    items.forEach(function (i) { sub += Math.round((Number(i.qty) || 0) * (i.unitCents || 0)); });
    var disc = Math.min(Math.max(discountCents || 0, 0), sub);
    var taxable = sub - disc;
    var tax = Math.round(taxable * (Number(taxPct) || 0) / 100);
    return { subtotalCents: sub, discountCents: disc, taxCents: tax, totalCents: taxable + tax };
  }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  // ---- phone alerts (see js/push.js) ----
  function pushUrl() { return String(window.VYQIL_PUSH_URL || 'https://vyqil-push.dusterman225.workers.dev').replace(/\/$/, ''); }
  // Tells the other side's phones that something new is waiting. Fixed wording, never blocks or fails the page.
  function pushNotify(portalId, kind) {
    try {
      var u = firebase.auth().currentUser; if (!u || !portalId) return;
      u.getIdToken().then(function (t) {
        return fetch(pushUrl() + '/notify', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + t }, body: JSON.stringify({ portalId: String(portalId), kind: kind }), keepalive: true });
      }).catch(function () { /* alerts are best effort */ });
    } catch (e) { /* ignore */ }
  }
  function pushLoad() {
    return window.vpush ? Promise.resolve(window.vpush) : new Promise(function (res) { var s = document.createElement('script'); s.src = 'js/push.js'; s.onload = function () { res(window.vpush); }; s.onerror = function () { res(null); }; document.head.appendChild(s); });
  }
  function pushPanel(mode, ctx) { return pushLoad().then(function (p) { if (p) p.panel(mode, ctx); }); }
  function pushSync(ctx) { try { if (localStorage.getItem('vq_push_team') !== '1') return; } catch (e) { return; } pushLoad().then(function (p) { if (p) p.syncTeam(ctx); }); }
  window.vutil = { fmt: fmt, toCents: toCents, totals: totals, todayStr: todayStr, pushNotify: pushNotify, pushPanel: pushPanel, pushSync: pushSync };
})();
                              
