// Automatic email: asks the Vyro Mail Worker to send an estimate or invoice to the customer.
(function () {
  function url() { return (window.VYRO_MAIL_URL || '').trim(); }
  async function send(ctx, kind, docId) {
    if (!url()) return { ok: false, error: 'not_configured' };
    try {
      var tok = await vyro.auth.currentUser.getIdToken();
      var r = await fetch(url(), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: tok, bizId: ctx.bizId, kind: kind, docId: docId })
      });
      return await r.json();
    } catch (e) { return { ok: false, error: 'network' }; }
  }
  function explain(r) {
    var e = r && r.error;
    if (e === 'no_email') return 'This customer has no email address. Add it on their customer page, pick the customer again here, save, and tap Send again.';
    if (e === 'provider_refused') return 'The email service did not accept it: ' + (r.detail || 'unknown reason') + '. Until a domain is set up it can only email the address you signed up with. You can use the mail app buttons below instead.';
    if (e === 'not_configured' || e === 'bad_origin') return 'Automatic email is not finished being set up (check the Worker settings, especially SITE_ORIGIN). Use the mail app buttons below for now.';
    if (e === 'network') return 'Could not reach the email service. Check the address in js/mail-config.js, or use the mail app buttons below.';
    if (e === 'too_many') return 'That is a lot of emails in a short time. Please wait a bit and try again.';
    if (e === 'wrong_status') return 'This document can no longer be sent in its current status.';
    return 'Could not send automatically (' + (e || 'unknown') + '). Use the mail app buttons below.';
  }
  window.vmail = { ready: function () { return !!url(); }, send: send, explain: explain };
})();
        
