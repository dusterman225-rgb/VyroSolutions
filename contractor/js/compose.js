// Email helper. Opening the phone's mail app is only allowed right after a real tap, so every email screen offers
// several ways: open the mail app, open Gmail in the browser, Share (any app), or Copy the text.
(function () {
  function toStr(x) { return x == null ? '' : String(x); }
  function href(p) {
    return 'mailto:' + encodeURIComponent(toStr(p.to)).replace('%40', '@') + '?subject=' + encodeURIComponent(toStr(p.subject)) +
      '&body=' + encodeURIComponent(toStr(p.body).replace(/\r?\n/g, '\r\n'));
  }
  function open(p) {
    var a = document.createElement('a'); a.href = href(p); a.rel = 'noopener'; a.style.display = 'none';
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
  window.vcompose = { href: href, open: open, gmail: gmail, share: share, copy: copy, canShare: !!navigator.share };
})();
