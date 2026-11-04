// Email helper. Opening the phone's mail app is only allowed right after a real tap, so every email screen offers
// several ways: open the mail app, open Gmail in the browser, Share (any app), or Copy the text.
(function () {
  function toStr(x) { return x == null ? '' : String(x); }
  function href(p) {
    return 'mailto:' + encodeURIComponent(toStr(p.to)).replace('%40', '@') + '?subject=' + encodeURIComponent(toStr(p.subject)) +
      '&body=' + encodeURIComponent(toStr(p.body).replace(/\r?\n/g, '\r\n'));
  }
  // Android: hand the subject and message to the mail app as separate pieces, which Gmail fills in reliably.
  // If the browser cannot do that, it falls back to the ordinary mailto link.
  function isAndroid() { return /android/i.test(navigator.userAgent || ''); }
  function androidHref(p) {
    var plain = href(p);
    return 'intent:mailto:' + toStr(p.to).replace(/[#;]/g, '') + '#Intent;action=android.intent.action.SENDTO;' +
      'S.android.intent.extra.SUBJECT=' + encodeURIComponent(toStr(p.subject)) + ';S.android.intent.extra.TEXT=' + encodeURIComponent(toStr(p.body).replace(/\r\n/g, '\n')) +
      ';S.browser_fallback_url=' + encodeURIComponent(plain) + ';end';
  }
  function best(p) { return isAndroid() ? androidHref(p) : href(p); }
  function open(p) {
    var a = document.createElement('a'); a.href = best(p); a.rel = 'noopener'; a.style.display = 'none';
    document.body.appendChild(a); a.click(); setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 800);
  }
  function gmail(p) {
    window.open('https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(toStr(p.to)) + '&su=' + encodeURIComponent(toStr(p.subject)) +
      '&body=' + encodeURIComponent(toStr(p.body)), '_blank');
  }
  function plain(p) { return (p.to ? 'To: ' + p.to + '\n' : '') + 'Subject: ' + toStr(p.subject) + '\n\n' + toStr(p.body); }
  async function share(p) {
    if (!navigator.share) return false;
    try { await navigator.share({ title: toStr(p.subject), text: plain(p) }); return true; } catch (e) { return false; }
  }
  async function copy(p) {
    try { await navigator.clipboard.writeText(plain(p)); return true; } catch (e) { return false; }
  }
  window.vcompose = { href: best, plainHref: href, href0: href, open: open, gmail: gmail, share: share, copy: copy, canShare: !!navigator.share };
})();
