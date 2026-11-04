// Ready-to-send reminders. Vyro has no email or text service of its own, so every reminder is written for you and opens
// in YOUR email or messages app: you read it and tap send. The same list drives the coloured tiles at the top of the
// dashboard and the daily pop-up.
//
// Reminder ladder (days past due, or days waiting): day 1, day 3, day 5, day 7, then URGENT after day 7.
(function () {
  var DAY = 86400000;
  var MONTHS = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

  function first(n) { return (String(n || '').trim().split(/\s+/)[0]) || 'there'; }
  function days(a, b) { return Math.floor((Date.parse(b + 'T00:00:00') - Date.parse(a + 'T00:00:00')) / 86400000); }
  // 2026-11-10 -> "Nov. 10, 2026"
  function pretty(ymd) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
    return m ? MONTHS[Number(m[2]) - 1] + ' ' + Number(m[3]) + ', ' + m[1] : String(ymd || '');
  }
  function ymdOf(ms) { if (!ms) return ''; var d = new Date(ms); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function ms(t) { return t && t.toMillis ? t.toMillis() : 0; }
  // 1-2 -> 1, 3-4 -> 3, 5-6 -> 5, 7 -> 7, 8+ -> 'urgent'
  function stageOf(d) { return d < 1 ? 0 : d < 3 ? 1 : d < 5 ? 3 : d < 7 ? 5 : d === 7 ? 7 : 'urgent'; }
  function stageName(s) { return s === 'urgent' ? 'Urgent' : s ? 'Day ' + s + ' reminder' : ''; }
  function fix(b) { return b.replace(/(https?:\/\/[^\s\u0001]+)\u0001/g, '$1\n\n').replace(/\u0001/g, ' '); }
  function tail(ctx) { var ph = (ctx.biz.phone || '').trim(); return '\u0001' + (ph ? 'You can call me at ' + ph + ' or just reply to this message.' : 'Just reply to this message.') + '\n\nThank you,\n' + ctx.biz.name; }
  function portalLink(ctx) {
    var base = location.origin + '/contractor/portal-login.html', slug = ctx.biz.slug || '';
    if (!slug) { try { slug = sessionStorage.getItem('vyroSlug_' + ctx.bizId) || ''; } catch (e) { slug = ''; } }
    return base + (slug ? '?r=' + encodeURIComponent(slug) : '');
  }
  function returnWays(ctx) {
    var m = Array.isArray(ctx.biz.returnMethods) ? ctx.biz.returnMethods : [];
    return (m.length ? 'You can return it by: ' + m.join(', ') + '.' : '') + (ctx.biz.returnNote ? ' ' + ctx.biz.returnNote : '');
  }

  // ---------- messages ----------
  function invoice(ctx, i, today) {
    var late = days(i.dueDate, today), st = stageOf(late), bal = vutil.fmt((i.totalCents || 0) - (i.paidCents || 0)), n = i.number || '', due = pretty(i.dueDate), link = '\n\nYou can see this invoice any time in your customer portal:\n' + portalLink(ctx);
    var hi = 'Hi ' + first(i.customerName) + ',\n\n', subject, body;
    if (st === 1 || st === 0) {
      subject = 'Friendly reminder: invoice ' + n + ' from ' + ctx.biz.name;
      body = hi + 'I hope you are doing well. This is a quick reminder that invoice ' + n + ' for ' + bal + ' was due on ' + due + '. If payment is already on its way, thank you, and please disregard this note.' + link + tail(ctx);
    } else if (st === 3) {
      subject = 'Following up: invoice ' + n + ' from ' + ctx.biz.name;
      body = hi + 'I am following up on invoice ' + n + ' for ' + bal + ', which was due on ' + due + ' and is now ' + late + ' days past due. Could you let me know when I can expect payment? If you have any questions about the invoice, I am glad to go over it with you.' + link + tail(ctx);
    } else if (st === 5) {
      subject = 'Second reminder: invoice ' + n + ' from ' + ctx.biz.name;
      body = hi + 'I am checking in again about invoice ' + n + ' for ' + bal + ' (due ' + due + ', now ' + late + ' days past due). Please send payment at your earliest convenience, or reply with the date I can expect it.' + link + tail(ctx);
    } else if (st === 7) {
      subject = 'Past due: invoice ' + n + ' from ' + ctx.biz.name;
      body = hi + 'Invoice ' + n + ' for ' + bal + ' is now a week past due (it was due ' + due + '). I would appreciate payment this week, or a quick note telling me when to expect it. If something is wrong with the invoice, please tell me and I will fix it right away.' + link + tail(ctx);
    } else {
      subject = 'URGENT: invoice ' + n + ' from ' + ctx.biz.name + ' is ' + late + ' days past due';
      body = hi + 'Invoice ' + n + ' for ' + bal + ' is now ' + late + ' days past due (it was due ' + due + '). I need to hear from you today so we can arrange payment. If there is a problem with the invoice, please tell me and I will help resolve it.' + link + tail(ctx);
    }
    return { to: i.customerEmail || '', phone: i.customerPhone || '', subject: subject, body: fix(body), late: late, stage: st, tone: st === 'urgent' ? 'urgent reminder' : st >= 7 ? 'firm reminder' : 'friendly reminder' };
  }

  function estimate(ctx, e, waited) {
    var link = e.publicToken ? '\n\nYou can review and accept it here:\n' + location.origin + '/contractor/accept.html?t=' + e.publicToken : '';
    var d = waited == null ? 3 : waited, st = stageOf(d), n = e.number || '', what = 'estimate ' + n + (e.title ? ' for ' + e.title : '') + ' (' + vutil.fmt(e.totalCents || 0) + ')';
    var hi = 'Hi ' + first(e.customerName) + ',\n\n', subject, body;
    if (st === 1 || st === 0) { subject = 'Thank you for the opportunity: estimate ' + n; body = hi + 'Thank you again for the opportunity to quote your project. I wanted to make sure ' + what + ' reached you, and to ask if you have any questions.' + link + tail(ctx); }
    else if (st === 3) { subject = 'Following up on estimate ' + n + ' from ' + ctx.biz.name; body = hi + 'Just checking in on ' + what + '. Is there anything you would like me to explain or change?' + link + tail(ctx); }
    else if (st === 5) { subject = 'Checking in: estimate ' + n; body = hi + 'I wanted to follow up once more on ' + what + '. If you are comparing options, I am happy to answer any questions or adjust the scope to fit your budget.' + link + tail(ctx); }
    else if (st === 7) { subject = 'Estimate ' + n + ' from ' + ctx.biz.name; body = hi + 'It has been about a week since I sent ' + what + '. Please let me know if you would like to move forward, or if I should close it out. Prices and my schedule can change, so I would be glad to hear from you soon.' + link + tail(ctx); }
    else { subject = 'Still interested? Estimate ' + n + ' from ' + ctx.biz.name; body = hi + 'I have not heard back about ' + what + ', sent ' + d + ' days ago. If you would still like to go ahead, please let me know this week so I can hold a spot on my schedule. If not, no problem at all, just tell me and I will close it out.' + link + tail(ctx); }
    return { to: e.customerEmail || '', phone: e.customerPhone || '', subject: subject, body: fix(body), stage: st, tone: stageName(st) };
  }

  // A shared contract or other document that must be returned signed.
  function docMsg(ctx, c, waited, email) {
    var d = waited == null ? 1 : waited, st = stageOf(d), t = c.title || 'your contract', ways = returnWays(ctx);
    var hi = 'Hi ' + first(c.customerName) + ',\n\n', subject, body, ret = (ways ? '\n\n' + ways : '');
    if (st === 1 || st === 0) { subject = 'Signed copy of ' + t; body = hi + 'A quick reminder to please return the signed copy of ' + t + '. You can read and print it from your customer portal:\n' + portalLink(ctx) + ret + tail(ctx); }
    else if (st === 3) { subject = 'Following up: signed ' + t; body = hi + 'I am following up on the signed copy of ' + t + '. Once I have it back, I will confirm the next steps with you.' + ret + tail(ctx); }
    else if (st === 5) { subject = 'Second reminder: signed ' + t; body = hi + 'I still need the signed copy of ' + t + '. Please return it when you can, or let me know if anything in it needs to change.' + ret + tail(ctx); }
    else if (st === 7) { subject = 'Needed this week: signed ' + t; body = hi + 'It has been a week and I have not yet received the signed ' + t + '. I cannot schedule or start the work until I have it, so I would appreciate it this week.' + ret + tail(ctx); }
    else { subject = 'URGENT: signed ' + t + ' still needed'; body = hi + 'I still have not received the signed ' + t + ' (' + d + ' days). I cannot start or continue the work without it. Please return it today, or call me if there is a problem.' + ret + tail(ctx); }
    return { to: email || c.customerEmail || '', phone: c.customerPhone || '', subject: subject, body: fix(body), stage: st, tone: stageName(st) };
  }

  function lead(ctx, l) {
    var body = 'Hi ' + first(l.name) + ', this is ' + ctx.biz.name + '. Following up on your ' + (l.jobDetails ? 'request (' + String(l.jobDetails).slice(0, 80) + ')' : 'request') + '. When is a good time to talk or come take a look?' + tail(ctx);
    return { to: l.email || '', phone: l.phone || '', subject: 'Following up from ' + ctx.biz.name, body: fix(body) };
  }

  // ---------- one list for the tiles and the pop-up ----------
  var COLORS = { invoice: '#f0c36d', estimate: '#4B9CD3', document: '#b48cff', lead: '#7fe3b0' };

  async function collect(ctx) {
    var today = vutil.todayStr(), now = Date.now(), money = ctx.role === 'owner' || ctx.role === 'supervisor' || ctx.role === 'gm', items = [];
    var invoices = [], ests = [], leads = [], cons = [], jobs = {};
    async function grab(name, arr, map) {
      try { (await ctx.bizRef.collection(name).get()).forEach(function (d) { var x = d.data(); x.id = d.id; if (map) map[d.id] = x; else arr.push(x); }); } catch (e) { /* optional */ }
    }
    if (!ctx.biz.slug) { try { if (!sessionStorage.getItem('vyroSlug_' + ctx.bizId)) { var qs = await vyro.db.collection('publicBrands').where('bizId', '==', ctx.bizId).get(); if (!qs.empty) sessionStorage.setItem('vyroSlug_' + ctx.bizId, qs.docs[0].id); } } catch (e) { /* optional */ } }
    await Promise.all([
      money ? grab('invoices', invoices) : 0, money ? grab('estimates', ests) : 0, money ? grab('contracts', cons) : 0,
      money ? grab('jobs', null, jobs) : 0, grab('leads', leads)
    ]);
    function acts(col, x) {
      return {
        snoozed: x.remindLaterOn === today,
        remindedToday: ymdOf(Math.max(ms(x.lastReminderAt), ms(x.lastFollowUpAt))) === today,
        later: function () { x.remindLaterOn = today; return ctx.bizRef.collection(col).doc(x.id).update({ remindLaterOn: today }); },
        sent: function () { var u = { lastReminderAt: vyro.stamp(), reminders: (x.reminders || 0) + 1 }; if (col === 'estimates') u.lastFollowUpAt = vyro.stamp(); return ctx.bizRef.collection(col).doc(x.id).update(u); }
      };
    }
    function add(it, a) { Object.keys(a).forEach(function (k) { it[k] = a[k]; }); items.push(it); }

    invoices.forEach(function (i) {
      if (i.status !== 'Sent' && i.status !== 'Partially Paid') return;
      if (!i.dueDate) return;
      var bal = vutil.fmt((i.totalCents || 0) - (i.paidCents || 0));
      if (i.dueDate < today) {
        var p = invoice(ctx, i, today);
        add({ kind: 'invoice', color: COLORS.invoice, label: 'Invoice', id: i.id, customer: i.customerName || '', title: 'Invoice due from ' + (i.customerName || 'customer') + ' on ' + pretty(i.dueDate), sub: (i.number || '') + ' · ' + bal, days: p.late, dayWord: 'past due', stage: p.stage, urgent: p.stage === 'urgent', msg: p, doneLabel: 'Paid', open: 'invoice.html?id=' + i.id }, acts('invoices', i));
      } else if (days(today, i.dueDate) <= 3) {
        var left = days(today, i.dueDate);
        add({ kind: 'invoice', color: COLORS.invoice, label: 'Invoice', id: i.id, customer: i.customerName || '', title: 'Invoice due from ' + (i.customerName || 'customer') + ' on ' + pretty(i.dueDate), sub: (i.number || '') + ' · ' + bal + ' · ' + (left === 0 ? 'due today' : 'due in ' + left + ' day' + (left === 1 ? '' : 's')), days: 0, soon: true, stage: 0, msg: invoice(ctx, i, i.dueDate), open: 'invoice.html?id=' + i.id }, acts('invoices', i));
      }
    });
    ests.forEach(function (e) {
      if (e.status !== 'Sent') return;
      var sent = ms(e.sentAt); if (!sent) return;
      var w = Math.floor((now - sent) / DAY); if (w < 1) return;
      add({ kind: 'estimate', color: COLORS.estimate, label: 'Estimate', id: e.id, customer: e.customerName || '', title: 'Estimate ' + (e.number || '') + ' for ' + (e.customerName || 'customer') + ' sent ' + pretty(ymdOf(sent)), sub: vutil.fmt(e.totalCents || 0) + ' · no answer yet', days: w, dayWord: 'waiting', stage: stageOf(w), urgent: stageOf(w) === 'urgent', msg: estimate(ctx, e, w), doneLabel: 'Open', open: 'estimate.html?id=' + e.id }, acts('estimates', e));
    });
    cons.forEach(function (c) {
      if (c.status !== 'Shared') return;
      var sh = ms(c.sharedAt); if (!sh) return;
      var w = Math.floor((now - sh) / DAY); if (w < 1) return;
      var j = jobs[c.jobId] || {}, email = j.customerEmail || '', who = c.customerName || j.customerName || '';
      var it = { kind: 'document', color: COLORS.document, label: 'Return signed', id: c.id, customer: who, title: (c.title || 'Contract') + ' from ' + (who || 'customer') + ' not returned (shared ' + pretty(ymdOf(sh)) + ')', sub: c.title || 'Contract', days: w, dayWord: 'not returned', stage: stageOf(w), urgent: stageOf(w) === 'urgent', msg: docMsg(ctx, { title: c.title, customerName: who, customerPhone: j.customerPhone }, w, email), doneLabel: 'Got it back', open: 'contract.html?id=' + c.id };
      it.done = function () { return ctx.bizRef.collection('contracts').doc(c.id).update({ status: 'Signed', signedOn: today, updatedAt: vyro.stamp() }); };
      add(it, acts('contracts', c));
    });
    leads.forEach(function (l) {
      if (!l.followUpOn || l.followUpOn > today || ['Won', 'Lost'].indexOf(l.status) > -1) return;
      var late = days(l.followUpOn, today);
      add({ kind: 'lead', color: COLORS.lead, label: 'Lead', id: l.id, customer: l.name || 'Lead', title: 'Follow up with ' + (l.name || 'lead') + ' (follow-up date ' + pretty(l.followUpOn) + ')', sub: l.jobDetails ? String(l.jobDetails).slice(0, 60) : '', days: late, dayWord: late > 0 ? 'overdue' : 'due today', stage: stageOf(late), urgent: stageOf(late) === 'urgent', msg: lead(ctx, l), doneLabel: 'Open', open: 'leads.html' }, acts('leads', l));
    });
    items.sort(function (a, b) { return (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0) || (b.days || 0) - (a.days || 0); });
    return items;
  }

  // Email / Text / Copy buttons for one message. onSent runs after any of them is tapped.
  function buttons(p, onSent) {
    var box = window.document.createElement('div'); box.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-top:8px';
    function mk(tag, label, ghost) { var a = window.document.createElement(tag); a.className = 'btn' + (ghost ? ' ghost' : ''); a.textContent = label; if (tag === 'button') a.type = 'button'; box.appendChild(a); return a; }
    if (p.to || !p.phone) { var em = mk('a', 'Email'); em.href = vcompose.href(p); em.addEventListener('click', function () { this.href = vcompose.href(p); if (onSent) onSent(); }); }
    var ph = String(p.phone || '').replace(/[^0-9+]/g, '');
    if (ph) { var sm = mk('a', 'Text', !!p.to); sm.href = 'sms:' + ph + '?&body=' + encodeURIComponent(p.body.replace(/\n\n/g, '\n')); sm.addEventListener('click', function () { if (onSent) onSent(); }); }
    var cp = mk('button', 'Copy', true);
    cp.addEventListener('click', async function () { try { await navigator.clipboard.writeText(p.body); cp.textContent = 'Copied'; if (onSent) onSent(); } catch (e) { cp.textContent = 'Could not copy'; } });
    return box;
  }
  window.vremind = { invoice: invoice, estimate: estimate, docMsg: docMsg, lead: lead, buttons: buttons, days: days, pretty: pretty, stageOf: stageOf, stageName: stageName, collect: collect, COLORS: COLORS };
})();
