// Ready-to-send messages for the things that cannot be sent automatically (Vyro has no email or text service of its own).
// The contractor reads each one and sends it from their own phone. Used by the daily pop-up and the Invoices page.
(function () {
  function first(n) { return (String(n || '').trim().split(/\s+/)[0]) || 'there'; }
  function tail(ctx) { var ph = (ctx.biz.phone || '').trim(); return (ph ? ' You can call me at ' + ph + '.' : ' Just reply to this message.') + '\n\nThank you,\n' + ctx.biz.name; }
  function days(a, b) { return Math.floor((Date.parse(b + 'T00:00:00') - Date.parse(a + 'T00:00:00')) / 86400000); }

  function invoice(ctx, i, today) {
    var late = days(i.dueDate, today), bal = vutil.fmt((i.totalCents || 0) - (i.paidCents || 0)), n = i.number || '';
    var subject = (late > 30 ? 'Final reminder: ' : late > 7 ? 'Past due: ' : 'Friendly reminder: ') + 'invoice ' + n + ' from ' + ctx.biz.name, body;
    if (late <= 7) body = 'Hi ' + first(i.customerName) + ',\n\nA quick reminder that invoice ' + n + ' for ' + bal + ' was due on ' + i.dueDate + '. If it has already been sent, thank you and please ignore this.' + tail(ctx);
    else if (late <= 30) body = 'Hi ' + first(i.customerName) + ',\n\nInvoice ' + n + ' for ' + bal + ' is now ' + late + ' days past due (it was due ' + i.dueDate + '). Please send payment this week, or let me know when I can expect it.' + tail(ctx);
    else body = 'Hi ' + first(i.customerName) + ',\n\nInvoice ' + n + ' for ' + bal + ' is now ' + late + ' days past due. I need to hear from you this week so we can arrange payment. If something is wrong with the invoice, please tell me and I will fix it.' + tail(ctx);
    return { to: i.customerEmail || '', phone: i.customerPhone || '', subject: subject, body: body, late: late,
      tone: late > 30 ? 'final reminder' : late > 7 ? 'firm reminder' : 'friendly reminder' };
  }
  function estimate(ctx, e) {
    var link = e.publicToken ? location.origin + '/contractor/accept.html?t=' + e.publicToken : '';
    var body = 'Hi ' + first(e.customerName) + ',\n\nJust checking in on estimate ' + (e.number || '') + (e.title ? ' for ' + e.title : '') + ' (' + vutil.fmt(e.totalCents || 0) + '). Do you have any questions, or is there anything you would like me to change?' +
      (link ? '\n\nYou can accept it here:\n' + link : '') + tail(ctx);
    return { to: e.customerEmail || '', phone: e.customerPhone || '', subject: 'Following up on estimate ' + (e.number || '') + ' from ' + ctx.biz.name, body: body };
  }
  function lead(ctx, l) {
    var body = 'Hi ' + first(l.name) + ', this is ' + ctx.biz.name + '. Following up on your ' + (l.jobDetails ? 'request (' + String(l.jobDetails).slice(0, 80) + ')' : 'request') + '. When is a good time to talk or come take a look?' + tail(ctx);
    return { to: l.email || '', phone: l.phone || '', subject: 'Following up from ' + ctx.biz.name, body: body };
  }

  // Email / Text / Copy buttons for one message. onSent runs after any of them is tapped.
  function buttons(p, onSent) {
    var box = document.createElement('div'); box.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-top:8px';
    function mk(tag, label, ghost) { var a = document.createElement(tag); a.className = 'btn' + (ghost ? ' ghost' : ''); a.textContent = label; if (tag === 'button') a.type = 'button'; box.appendChild(a); return a; }
    if (p.to || !p.phone) { var em = mk('a', 'Email'); em.href = vcompose.href(p); em.addEventListener('click', function () { this.href = vcompose.href(p); if (onSent) onSent(); }); }
    var ph = String(p.phone || '').replace(/[^0-9+]/g, '');
    if (ph) { var sm = mk('a', 'Text', !!p.to); sm.href = 'sms:' + ph + '?&body=' + encodeURIComponent(p.body.replace(/\n\n/g, '\n')); sm.addEventListener('click', function () { if (onSent) onSent(); }); }
    var cp = mk('button', 'Copy', true);
    cp.addEventListener('click', async function () { try { await navigator.clipboard.writeText(p.body); cp.textContent = 'Copied'; if (onSent) onSent(); } catch (e) { cp.textContent = 'Could not copy'; } });
    return box;
  }
  window.vremind = { invoice: invoice, estimate: estimate, lead: lead, buttons: buttons, days: days };
})();
