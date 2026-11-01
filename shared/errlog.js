/* Problem log. When something breaks on a page (a script error or a failed request nobody handled), one short line is saved
   to the business's own "errors" list so the owner can see it on the Data and activity page. No outside service, no cost.
   It records only: the message, the page, the time and who it happened to (never passwords or customer details). */
(function () {
  var sent = 0, seen = {}, ctxRef = null;
  function clip(s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) : s; }
  function send(msg, extra) {
    try {
      if (!ctxRef || sent >= 5) return;
      msg = clip(msg, 200); if (!msg || seen[msg]) return;
      if (/^script error\.?$/i.test(msg) || /ResizeObserver loop/i.test(msg)) return;
      seen[msg] = 1; sent++;
      ctxRef.bizRef.collection('errors').add({
        msg: msg, page: clip(location.pathname, 80), extra: clip(extra, 120), by: ctxRef.user.uid, role: ctxRef.role || '',
        ua: clip(navigator.userAgent, 100), at: firebase.firestore.FieldValue.serverTimestamp()
      }).catch(function () { /* logging must never cause another error */ });
    } catch (e) { /* ignore */ }
  }
  function install(ctx) {
    if (ctxRef) { ctxRef = ctx; return; }
    ctxRef = ctx;
    window.addEventListener('error', function (e) { send(e && e.message, (e && e.filename ? e.filename.split('/').pop() : '') + ':' + (e && e.lineno || '')); });
    window.addEventListener('unhandledrejection', function (e) {
      var r = e && e.reason; send('Unhandled: ' + ((r && (r.message || r.code)) || r), r && r.code ? String(r.code) : '');
    });
  }
  window.vyroErr = { install: install, report: send };
})();
