window.VQ_APP = {
  community: { product: 'services', inbound: { addKind: 'customer', addDefaults: { plan: 'One-time' }, addLabel: 'Add as customer', inboxTitle: 'Service requests near you', listTitle: 'My services in the community', catLabel: 'Services you offer' } },
  id: 'services', name: 'VyqilServices', who: 'For cleaning, lawn and pool services', tag: 'Recurring customers, routes and invoices.', alertText: 'visits and unpaid invoices',
  tabKinds: ['visit', 'customer', 'invoice'],
  kinds: {
    customer: { label: 'Customer', plural: 'Customers', icon: '👤', stage: 'plan', closed: function (r) { return r.plan === 'Paused'; },
      fields: [{ k: 'name', l: 'Name', t: 'text', req: 1 }, { k: 'address', l: 'Address', t: 'text' }, { k: 'phone', l: 'Phone', t: 'tel' }, { k: 'email', l: 'Email', t: 'email' }, { k: 'plan', l: 'Plan', t: 'select', o: ['Weekly', 'Every 2 weeks', 'Monthly', 'One-time', 'Paused'], req: 1 }, { k: 'price', l: 'Price per visit', t: 'money' }, { k: 'day', l: 'Usual day', t: 'select', o: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] }, { k: 'access', l: 'Gate code / access notes', t: 'text' }, { k: 'notes', l: 'Notes', t: 'area' }],
      sub: function (r) { return [r.address, r.day].filter(Boolean).join(' · '); }, amount: function (r) { return r.price || ''; } },
    visit: { label: 'Visit', plural: 'Visits', icon: '🚚', stage: 'status', closed: function (r) { return r.status === 'Done' || r.status === 'Skipped'; }, sort: function (a, b) { return ((a.date || '') + (a.time || '')) < ((b.date || '') + (b.time || '')) ? -1 : 1; },
      title: function (r) { return r.customer ? Q.title(Q.get(r.customer)) : 'Visit'; },
      fields: [{ k: 'customer', l: 'Customer', t: 'link', to: 'customer', req: 1 }, { k: 'date', l: 'Date', t: 'date', req: 1, cal: 1, alert: { hour: 7 }, timeField: 'time', lbl: 'Visit', hint: 'The day you are going. It goes on your calendar with a reminder that morning.' }, { k: 'time', l: 'Time', t: 'time', hint: 'Start time. Used for tomorrow\'s reminder texts and the route order.' }, { k: 'status', l: 'Status', t: 'select', o: ['Scheduled', 'Done', 'Skipped'], req: 1, hint: 'Done means the work is finished and ready to invoice. Skipped is for a visit that did not happen.' }, { k: 'price', l: 'Price', t: 'money', hint: 'What this visit costs the customer. It is filled into the invoice.' }, { k: 'notes', l: 'Notes', t: 'area', hint: 'Gate codes, pets, special requests.' }],
      sub: function (r) { return Q.u.fmtDate(r.date) + (r.time ? ' ' + Q.u.fmtTime(r.time) : ''); }, amount: function (r) { return r.price || ''; } },
    invoice: { label: 'Invoice', plural: 'Invoices', icon: '🧾', stage: 'status', closed: function (r) { return r.status === 'Paid' || r.status === 'Void'; }, sort: function (a, b) { return (a.date || '') < (b.date || '') ? 1 : -1; },
      title: function (r) { return (r.customer ? Q.title(Q.get(r.customer)) : 'Invoice') + (r.number ? ' #' + r.number : ''); },
      fields: [{ k: 'customer', l: 'Customer', t: 'link', to: 'customer', req: 1 }, { k: 'number', l: 'Invoice number', t: 'text' }, { k: 'date', l: 'Date', t: 'date', req: 1 }, { k: 'amount', l: 'Amount', t: 'money', req: 1 }, { k: 'due', l: 'Due date', t: 'date', cal: 1, alert: { hour: 9 }, lbl: 'Invoice due' }, { k: 'status', l: 'Status', t: 'select', o: ['Unpaid', 'Paid', 'Void'], req: 1 }, { k: 'notes', l: 'Notes', t: 'area' }],
      amount: function (r) { return r.amount || 0; }, sub: function (r) { return r.due ? 'Due ' + Q.u.fmtDate(r.due) : ''; } }
  },
  stats: [{ l: 'Visits today', fn: function (rs, t) { return rs.filter(function (r) { return r.kind === 'visit' && r.date === t && r.status === 'Scheduled'; }).length; } },
    { l: 'Unpaid', fn: function (rs) { var s = 0; rs.forEach(function (r) { if (r.kind === 'invoice' && r.status === 'Unpaid') s += r.amount || 0; }); return Q.u.money(s); } },
    { l: 'Active customers', fn: function (rs) { return rs.filter(function (r) { return r.kind === 'customer' && r.plan !== 'Paused'; }).length; } }],
  watch: [{ l: 'Recurring customers with nothing scheduled', fn: function (rs, t) { return rs.filter(function (c) { return c.kind === 'customer' && c.plan && c.plan !== 'Paused' && c.plan !== 'One-time' && !rs.some(function (v) { return v.kind === 'visit' && v.customer === c.id && v.status === 'Scheduled' && v.date >= t; }); }); }, sub: function (r) { return r.plan; } }]
};

// ===== VyqilServices full build: quotes, route, crew, supplies, expenses, reports, visit reminders, texts =====
(function () {
  'use strict';
  var A = window.VQ_APP, K = A.kinds, u = null, T = null;
  function U() { return u || (u = Q.u); }
  function TL() { return T || (T = Q.tools); }
  function el(t, c, x) { return U().el(t, c, x); }
  function money(c) { return U().money(c); }
  function today() { return U().today(); }
  function fmt(d) { return d ? U().fmtDate(d) : ''; }
  function biz() { return Q.S.biz || {}; }
  function cname(id) { var c = id ? Q.get(id) : null; return c ? (c.name || '') : ''; }
  function first(n) { return String(n || 'there').split(/\s+/)[0]; }
  var PLAN_MULT = { 'Weekly': 4.33, 'Every 2 weeks': 2.17, 'Monthly': 1 };
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var CATS = ['Supplies', 'Fuel', 'Vehicle', 'Equipment', 'Insurance', 'Wages and crew', 'Marketing', 'Fees and software', 'Other'];
  function nextNo() { var n = 0; Q.byKind('invoice').forEach(function (r) { var m = /(\d+)$/.exec(r.number || ''); if (m && +m[1] > n) n = +m[1]; }); return ('000' + (n + 1)).slice(-4); }
  function mapsUrl(addr) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr); }

  // ---- customers ----
  var CU = K.customer;
  CU.fields.splice(CU.fields.length - 1, 0, { k: 'propType', l: 'Kind of place', t: 'select', o: ['House', 'Apartment', 'Office or shop', 'Yard only', 'Pool', 'Other'] }, { k: 'source', l: 'Where they came from', t: 'select', o: ['Referral', 'Vyqil Community', 'Online', 'Walk-in or flyer', 'Other'] });
  CU.actions = [
    { l: 'Text or call', show: function (r) { return !!r.phone; }, run: function (r) { textsModal(r); } },
    { l: 'Open the address in Maps', show: function (r) { return !!r.address; }, run: function (r) { window.open(mapsUrl(r.address), '_blank'); } },
    { l: 'Schedule upcoming visits', show: function (r) { return r.plan && r.plan !== 'Paused' && r.plan !== 'One-time'; }, run: function (r) { scheduleModal(r); } },
    { l: 'Invoice completed visits', run: function (r) { invoiceVisits(r); } },
    { l: 'Write a quote', run: function (r) { Q.openForm('quote', null, { customer: r.id, prospect: r.name, address: r.address || '' }); } }
  ];
  CU.sub = function (r, rs) { var next = (rs || Q.S.recs).filter(function (v) { return v.kind === 'visit' && v.customer === r.id && v.status === 'Scheduled' && v.date >= today(); }).sort(function (a, b) { return a.date < b.date ? -1 : 1; })[0]; return [r.address, r.day, next ? 'Next ' + fmt(next.date) : ''].filter(Boolean).join(' · '); };
  function scheduleModal(c) {
    Q.modal(function (s, close) {
      s.appendChild(el('h3', '', 'Schedule visits for ' + c.name)); s.appendChild(el('p', 'hint', 'Plan: ' + c.plan + (c.day ? ', usually ' + c.day : '') + '. Dates that already have a visit are skipped.'));
      s.appendChild(el('label', 'f', 'How far ahead')); var n = el('select'); [['4', 'Next 4 visits'], ['8', 'Next 8 visits'], ['12', 'Next 12 visits']].forEach(function (x) { var o = el('option', '', x[1]); o.value = x[0]; n.appendChild(o); }); s.appendChild(n);
      s.appendChild(el('label', 'f', 'Time')); var tm = el('input'); tm.type = 'time'; tm.value = '09:00'; s.appendChild(tm);
      var crew = el('select'); var o0 = el('option', '', 'No crew chosen'); o0.value = ''; crew.appendChild(o0); Q.byKind('crew').filter(function (x) { return x.status !== 'Off'; }).forEach(function (x) { var o = el('option', '', x.name); o.value = x.id; crew.appendChild(o); }); if (crew.options.length > 1) { s.appendChild(el('label', 'f', 'Crew')); s.appendChild(crew); }
      var m = el('div', 'note'); s.appendChild(m); var b = el('div', 'btns'), go = el('button', 'btn', 'Create visits'), x = el('button', 'btn ghost', 'Cancel'); go.type = x.type = 'button'; b.appendChild(go); b.appendChild(x); s.appendChild(b); x.onclick = close;
      go.onclick = async function () {
        go.disabled = true; var step = c.plan === 'Weekly' ? 7 : c.plan === 'Every 2 weeks' ? 14 : 0, count = +n.value, d = today(), want = DAYS.indexOf(c.day), made = 0, have = Q.byKind('visit').filter(function (v) { return v.customer === c.id; }).map(function (v) { return v.date; }), last = have.filter(function (x) { return x >= today(); }).sort().pop();
        try {
          if (want >= 0) { while (U().parse(d).getDay() !== want) d = U().addDays(d, 1); } else d = U().addDays(d, 1);
          if (last && step && last >= d) { d = U().addDays(last, step); }
          for (var i = 0; i < count; i++) {
            var ds = c.plan === 'Monthly' ? TL().addMonths(d, i) : U().addDays(d, i * step); if (have.indexOf(ds) < 0) { var v = { customer: c.id, date: ds, time: tm.value, status: 'Scheduled', price: c.price || null }; if (crew.value) v.crew = crew.value; await TL().add('visit', v); made++; }
          }
          close(); Q.toast(made + ' visit' + (made === 1 ? '' : 's') + ' scheduled.');
        } catch (e) { m.className = 'note err'; m.textContent = Q.friendly(e); go.disabled = false; }
      };
    });
  }
  function invoiceVisits(c) {
    var vs = Q.byKind('visit').filter(function (v) { return v.customer === c.id && v.status === 'Done' && !v.invoiced; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    if (!vs.length) { Q.toast('No finished visits waiting to be invoiced.'); return; }
    var total = 0; vs.forEach(function (v) { total += v.price || c.price || 0; });
    Q.ask('Create one invoice for ' + vs.length + ' finished visit' + (vs.length === 1 ? '' : 's') + ' totaling ' + money(total) + '?', 'Create invoice', async function () {
      try {
        await TL().add('invoice', { customer: c.id, number: nextNo(), date: today(), due: U().addDays(today(), 14), amount: total, status: 'Unpaid', notes: ('Visits: ' + vs.map(function (v) { return fmt(v.date); }).join(', ')).slice(0, 900) });
        for (var i = 0; i < vs.length; i++) await TL().upd(vs[i].id, { invoiced: true });
        Q.toast('Invoice created. Find it in Invoices.');
      } catch (e) { Q.toast(Q.friendly(e)); }
    });
  }

  // ---- texts to customers ----
  var TEXTS = [
    ['Visit reminder', function (c, v) { return 'Hi ' + first(c.name) + ', this is ' + (biz().name || 'us') + '. A reminder that we are coming ' + (v ? fmt(v.date) + (v.time ? ' at ' + U().fmtTime(v.time) : '') : 'soon') + '. Reply here if you need to change anything.'; }],
    ['On my way', function (c) { return 'Hi ' + first(c.name) + ', we are on our way to you now. ' + (biz().name || ''); }],
    ['Running late', function (c) { return 'Hi ' + first(c.name) + ', we are running a little behind and will be there as soon as we can. Sorry for the wait. ' + (biz().name || ''); }],
    ['Need to reschedule', function (c) { return 'Hi ' + first(c.name) + ', we need to move your next visit. What day works for you this week? Thank you. ' + (biz().name || ''); }],
    ['Thank you', function (c) { return 'Hi ' + first(c.name) + ', thank you for choosing ' + (biz().name || 'us') + '. If you are happy with the work, a short review or a referral means a lot to a small business like ours.'; }],
    ['Payment reminder', function (c) { var inv = Q.byKind('invoice').filter(function (i) { return i.customer === c.id && i.status === 'Unpaid'; })[0]; return 'Hi ' + first(c.name) + ', a friendly reminder that ' + (inv ? 'invoice ' + (inv.number || '') + ' for ' + money(inv.amount) + ' is waiting' : 'you have an open invoice') + '.' + (TL().prof().payInfo ? ' ' + TL().prof().payInfo + '.' : '') + ' Thank you. ' + (biz().name || ''); }],
    ['Price update', function (c) { return 'Hi ' + first(c.name) + ', a heads up that our price per visit is changing' + (c.price ? ' from ' + money(c.price) : '') + ' starting next month. Thank you for being a customer. ' + (biz().name || ''); }]
  ];
  function textsModal(c0, vis) {
    Q.modal(function (s, close) {
      s.appendChild(el('h3', '', 'Texts to customers')); s.appendChild(el('label', 'f', 'Customer')); var cs = el('select'); Q.byKind('customer').filter(function (x) { return x.plan !== 'Paused'; }).forEach(function (x) { var o = el('option', '', x.name); o.value = x.id; cs.appendChild(o); }); s.appendChild(cs); if (c0) cs.value = c0.id;
      s.appendChild(el('label', 'f', 'Message')); var ts = el('select'); TEXTS.forEach(function (x, i) { var o = el('option', '', x[0]); o.value = String(i); ts.appendChild(o); }); s.appendChild(ts);
      var ta = el('textarea'); ta.rows = 5; ta.maxLength = 600; s.appendChild(ta);
      function fill() { var c = Q.get(cs.value); if (!c) return; var v = vis && vis.customer === c.id ? vis : Q.byKind('visit').filter(function (x) { return x.customer === c.id && x.status === 'Scheduled' && x.date >= today(); }).sort(function (a, b) { return a.date < b.date ? -1 : 1; })[0]; ta.value = TEXTS[+ts.value][1](c, v); }
      cs.onchange = ts.onchange = fill; fill();
      var b = el('div', 'btns'), sm = el('button', 'btn', 'Open in Messages'), call = el('button', 'btn ghost', 'Call'), x = el('button', 'btn ghost', 'Close'); sm.type = call.type = x.type = 'button'; b.appendChild(sm); b.appendChild(call); b.appendChild(x); s.appendChild(b); x.onclick = close;
      sm.onclick = function () { var c = Q.get(cs.value); if (!c || !c.phone) { Q.toast('Add a phone number to this customer first.'); return; } location.href = TL().smsUrl(c.phone, ta.value); };
      call.onclick = function () { var c = Q.get(cs.value); if (!c || !c.phone) { Q.toast('Add a phone number to this customer first.'); return; } location.href = 'tel:' + String(c.phone).replace(/[^\d+]/g, ''); };
    });
  }

  // ---- visits ----
  var VI = K.visit;
  VI.fields.splice(VI.fields.length - 1, 0, { k: 'crew', l: 'Crew member', t: 'link', to: 'crew' }, { k: 'tasks', l: 'What to do this visit', t: 'area' });
  VI.sub = function (r) { return [U().fmtDate(r.date) + (r.time ? ' ' + U().fmtTime(r.time) : ''), r.crew ? cname(r.crew) : '', r.invoiced ? 'Invoiced' : ''].filter(Boolean).join(' · '); };
  VI.actions = [
    { l: 'Mark done', show: function (r) { return r.status === 'Scheduled'; }, run: function (r) { TL().upd(r.id, { status: 'Done', doneOn: today() }).then(function () { Q.toast('Marked done.'); }, function (e) { Q.toast(Q.friendly(e)); }); } },
    { l: 'Mark done and invoice now', show: function (r) { return r.status === 'Scheduled'; }, run: function (r) {
      var c = r.customer ? Q.get(r.customer) : null; if (!c) { Q.toast('Choose a customer on the visit first.'); return; }
      TL().upd(r.id, { status: 'Done', doneOn: today(), invoiced: true }).then(function () { return TL().add('invoice', { customer: c.id, number: nextNo(), date: today(), due: U().addDays(today(), 14), amount: r.price || c.price || 0, status: 'Unpaid', notes: ('Visit ' + fmt(r.date)).slice(0, 200) }); }).then(function () { Q.toast('Done. Invoice created.'); }, function (e) { Q.toast(Q.friendly(e)); });
    } },
    { l: 'Text the customer', run: function (r) { var c = r.customer ? Q.get(r.customer) : null; if (!c || !c.phone) { Q.toast('The customer needs a phone number.'); return; } textsModal(c, r); } },
    { l: 'Open the address in Maps', run: function (r) { var c = r.customer ? Q.get(r.customer) : null; if (!c || !c.address) { Q.toast('The customer needs an address.'); return; } window.open(mapsUrl(c.address), '_blank'); } }
  ];

  // ---- quotes ----
  K.quote = { label: 'Quote', plural: 'Quotes', icon: '📋', stage: 'status', closed: function (r) { return r.status === 'Accepted' || r.status === 'Declined'; }, sort: function (a, b) { return (a.sentOn || '') < (b.sentOn || '') ? 1 : -1; },
    fields: [{ k: 'prospect', l: 'For', t: 'text', req: 1, h: 'Customer or prospect name' }, { k: 'customer', l: 'Existing customer', t: 'link', to: 'customer' }, { k: 'phone', l: 'Phone', t: 'tel' }, { k: 'address', l: 'Address', t: 'text' }, { k: 'service', l: 'Service', t: 'text', req: 1, h: 'Deep clean, weekly lawn care' }, { k: 'price', l: 'Price', t: 'money', req: 1 },
      { k: 'plan', l: 'How often', t: 'select', o: ['One-time', 'Weekly', 'Every 2 weeks', 'Monthly'], d: 'One-time' }, { k: 'status', l: 'Status', t: 'select', o: ['Draft', 'Sent', 'Accepted', 'Declined'], req: 1 }, { k: 'sentOn', l: 'Sent on', t: 'date' }, { k: 'followUp', l: 'Follow up on', t: 'date', cal: 1, alert: { hour: 9 }, lbl: 'Quote follow-up', doneIf: function (r) { return r.status === 'Accepted' || r.status === 'Declined'; } }, { k: 'details', l: 'What is included', t: 'area' }],
    title: function (r) { return (r.prospect || 'Quote') + ' · ' + (r.service || ''); }, amount: function (r) { return r.price || ''; }, sub: function (r) { return [r.plan, r.sentOn ? 'Sent ' + fmt(r.sentOn) : ''].filter(Boolean).join(' · '); },
    actions: [
      { l: 'View or share the quote', run: function (r) { TL().showText('Quote for ' + r.prospect, quoteText(r), r.phone || (r.customer && Q.get(r.customer) ? Q.get(r.customer).phone : '')); } },
      { l: 'Mark sent today', show: function (r) { return r.status === 'Draft'; }, run: function (r) { TL().upd(r.id, { status: 'Sent', sentOn: today(), followUp: U().addDays(today(), 3) }).then(function () { Q.toast('Marked sent. Follow-up set for 3 days.'); }); } },
      { l: 'Accepted: make the customer and first visit', show: function (r) { return r.status !== 'Accepted'; }, run: function (r) { acceptQuote(r); } }
    ] };
  function quoteText(r) { return ['QUOTE', '', TL().letterhead(), '', 'For: ' + (r.prospect || ''), r.address ? 'Address: ' + r.address : '', 'Date: ' + fmt(r.sentOn || today()), '', 'Service: ' + (r.service || ''), r.details ? r.details : '', 'Price: ' + money(r.price) + (r.plan && r.plan !== 'One-time' ? ' per visit, ' + r.plan.toLowerCase() : ''), '', 'This quote is good for 30 days. Reply to accept and we will schedule your first visit.'].filter(function (x) { return x !== ''; }).join('\n'); }
  function acceptQuote(r) {
    Q.ask('Mark this quote accepted' + (r.customer ? '' : ' and create ' + r.prospect + ' as a customer') + ', with a first visit scheduled?', 'Accept', async function () {
      try {
        var id = r.customer; if (!id) { var c = { name: r.prospect, address: r.address || '', phone: r.phone || '', plan: r.plan || 'One-time', price: r.price || null, source: 'Other' }; id = (await TL().add('customer', c)).id; }
        await TL().add('visit', { customer: id, date: U().addDays(today(), 2), time: '09:00', status: 'Scheduled', price: r.price || null });
        await TL().upd(r.id, { status: 'Accepted', customer: id }); Q.toast('Accepted. First visit is on the schedule for the day after tomorrow.');
      } catch (e) { Q.toast(Q.friendly(e)); }
    });
  }

  // ---- invoices ----
  var IN = K.invoice, nf = IN.fields.filter(function (f) { return f.k === 'number'; })[0]; if (nf) nf.d = function () { return nextNo(); };
  IN.fields.forEach(function (f) { if (f.k === 'date') f.d = function () { return today(); }; if (f.k === 'due') f.d = function () { return U().addDays(today(), 14); }; });
  IN.fields.splice(IN.fields.length - 1, 0, { k: 'paidOn', l: 'Paid on', t: 'date' }, { k: 'method', l: 'Paid by', t: 'select', o: ['Cash', 'Check', 'Card', 'Zelle or Venmo', 'Bank transfer', 'Other'] });
  IN.actions = [
    { l: 'View or share the invoice', run: function (r) { var c = r.customer ? Q.get(r.customer) : null; TL().showText('Invoice ' + (r.number || ''), invoiceText(r), c && c.phone); } },
    { l: 'Mark paid', show: function (r) { return r.status === 'Unpaid'; }, run: function (r) { payModal(r); } },
    { l: 'Text a payment reminder', show: function (r) { return r.status === 'Unpaid'; }, run: function (r) { var c = r.customer ? Q.get(r.customer) : null; if (!c || !c.phone) { Q.toast('The customer needs a phone number.'); return; } var t = TEXTS[5]; TL().showText('Payment reminder', t[1](c), c.phone); } }
  ];
  function invoiceText(r) { var c = r.customer ? Q.get(r.customer) : null; return ['INVOICE ' + (r.number || ''), '', TL().letterhead(), '', 'Bill to: ' + (c ? c.name : ''), c && c.address ? c.address : '', 'Date: ' + fmt(r.date || today()), 'Due: ' + fmt(r.due), '', r.notes || 'Service', 'Amount due: ' + money(r.amount), r.status === 'Paid' ? '\nPAID' + (r.paidOn ? ' on ' + fmt(r.paidOn) : '') + '. Thank you.' : '', r.status !== 'Paid' && TL().prof().payInfo ? '\nHow to pay: ' + TL().prof().payInfo : ''].filter(function (x) { return x !== ''; }).join('\n'); }
  function payModal(r) {
    Q.modal(function (s, close) {
      s.appendChild(el('h3', '', 'Mark paid: ' + money(r.amount))); s.appendChild(el('label', 'f', 'Paid by')); var m = el('select'); ['Cash', 'Check', 'Card', 'Zelle or Venmo', 'Bank transfer', 'Other'].forEach(function (x) { var o = el('option', '', x); o.value = x; m.appendChild(o); }); s.appendChild(m); s.appendChild(el('label', 'f', 'Date')); var d = el('input'); d.type = 'date'; d.value = today(); s.appendChild(d);
      var b = el('div', 'btns'), go = el('button', 'btn', 'Save'), x = el('button', 'btn ghost', 'Cancel'); go.type = x.type = 'button'; b.appendChild(go); b.appendChild(x); s.appendChild(b); x.onclick = close;
      go.onclick = function () { go.disabled = true; TL().upd(r.id, { status: 'Paid', paidOn: d.value || today(), method: m.value }).then(function () { close(); Q.toast('Marked paid.'); }, function (e) { Q.toast(Q.friendly(e)); go.disabled = false; }); };
    });
  }

  // ---- expenses, crew, supplies ----
  K.expense = { label: 'Expense', plural: 'Expenses', icon: '💳', stage: 'category', sort: function (a, b) { return (a.date || '') < (b.date || '') ? 1 : -1; },
    fields: [{ k: 'date', l: 'Date', t: 'date', req: 1, d: function () { return today(); } }, { k: 'amount', l: 'Amount', t: 'money', req: 1 }, { k: 'category', l: 'Category', t: 'select', o: CATS, req: 1 }, { k: 'vendor', l: 'Paid to', t: 'text' }, { k: 'notes', l: 'Notes', t: 'area' }],
    title: function (r) { return r.vendor || r.category || 'Expense'; }, amount: function (r) { return r.amount || 0; }, sub: function (r) { return [fmt(r.date), r.category].filter(Boolean).join(' · '); } };
  K.crew = { label: 'Crew member', plural: 'Crew', icon: '🧑‍🔧', stage: 'role', closed: function (r) { return r.status === 'Off'; },
    fields: [{ k: 'name', l: 'Name', t: 'text', req: 1 }, { k: 'role', l: 'Role', t: 'select', o: ['Cleaner', 'Technician', 'Driver', 'Helper', 'Lead'] }, { k: 'phone', l: 'Phone', t: 'tel' }, { k: 'rate', l: 'Hourly pay', t: 'money' }, { k: 'status', l: 'Status', t: 'select', o: ['Active', 'Off'], d: 'Active' }, { k: 'notes', l: 'Notes', t: 'area' }],
    sub: function (r, rs) { var n = (rs || Q.S.recs).filter(function (v) { return v.kind === 'visit' && v.crew === r.id && v.status === 'Scheduled' && v.date >= today(); }).length; return [r.role, r.phone, n ? n + ' upcoming' : ''].filter(Boolean).join(' · '); },
    actions: [{ l: 'Text this crew member', show: function (r) { return !!r.phone; }, run: function (r) { location.href = TL().smsUrl(r.phone, ''); } }] };
  K.supply = { label: 'Supply', plural: 'Supplies', icon: '🧴', stage: 'unit',
    fields: [{ k: 'name', l: 'Item', t: 'text', req: 1, h: 'All-purpose cleaner, pool chlorine' }, { k: 'qty', l: 'How many on hand', t: 'number', req: 1 }, { k: 'unit', l: 'Counted in', t: 'text', h: 'bottles, bags, gallons' }, { k: 'reorderAt', l: 'Reorder when at or below', t: 'number' }, { k: 'store', l: 'Where you buy it', t: 'text' }, { k: 'notes', l: 'Notes', t: 'area' }],
    sub: function (r) { return r.qty + ' ' + (r.unit || '') + (r.reorderAt != null && r.reorderAt !== '' && +r.qty <= +r.reorderAt ? ' · Reorder' : '') + (r.store ? ' · ' + r.store : ''); },
    actions: [{ l: 'Used some', run: function (r) { adjust(r, -1); } }, { l: 'Restocked', run: function (r) { adjust(r, 1); } }] };
  function adjust(r, sign) {
    Q.modal(function (s, close) {
      s.appendChild(el('h3', '', (sign < 0 ? 'Used: ' : 'Restocked: ') + r.name)); s.appendChild(el('label', 'f', 'How many')); var n = el('input'); n.type = 'number'; n.value = '1'; n.min = '0'; s.appendChild(n);
      var b = el('div', 'btns'), go = el('button', 'btn', 'Save'), x = el('button', 'btn ghost', 'Cancel'); go.type = x.type = 'button'; b.appendChild(go); b.appendChild(x); s.appendChild(b); x.onclick = close;
      go.onclick = function () { var k = Math.max(0, +n.value || 0); TL().upd(r.id, { qty: Math.max(0, (+r.qty || 0) + sign * k) }).then(function () { close(); }, function (e) { Q.toast(Q.friendly(e)); }); };
    });
  }

  // ---- route ----
  var routeDay = null;
  function routeView(v) {
    var d = routeDay || today(); v.appendChild(el('h2', '', 'Route'));
    var nav = el('div', 'btns'), pv = el('button', 'btn ghost', '‹ Day'), tdb = el('button', 'btn ghost', 'Today'), nx = el('button', 'btn ghost', 'Day ›'); [pv, tdb, nx].forEach(function (b) { b.type = 'button'; nav.appendChild(b); }); v.appendChild(nav);
    pv.onclick = function () { routeDay = U().addDays(d, -1); Q.render(); }; nx.onclick = function () { routeDay = U().addDays(d, 1); Q.render(); }; tdb.onclick = function () { routeDay = today(); Q.render(); };
    var vs = Q.byKind('visit').filter(function (x) { return x.date === d && x.status !== 'Skipped'; }).sort(function (a, b) { return (a.time || '') < (b.time || '') ? -1 : 1; }), rev = 0; vs.forEach(function (x) { rev += x.price || (x.customer && Q.get(x.customer) && Q.get(x.customer).price) || 0; });
    v.appendChild(el('div', 'hint', fmt(d) + ' · ' + vs.length + ' visit' + (vs.length === 1 ? '' : 's') + (rev ? ' · about ' + money(rev) : '')));
    if (!vs.length) { v.appendChild(el('div', 'card empty', 'Nothing scheduled for this day.')); return; }
    var groups = {}; vs.forEach(function (x) { (groups[x.crew || ''] = groups[x.crew || ''] || []).push(x); });
    Object.keys(groups).forEach(function (g) {
      v.appendChild(el('div', 'sec', g ? cname(g) : (Object.keys(groups).length > 1 ? 'No crew chosen' : 'Stops'))); var c = el('div', 'card'); v.appendChild(c);
      var addrs = [];
      groups[g].forEach(function (x, i) {
        var cu = x.customer ? Q.get(x.customer) : null, r = el('div', 'row tap'), m = el('div', 'm'); m.appendChild(el('b', '', (i + 1) + '. ' + (x.time ? U().fmtTime(x.time) + ' · ' : '') + (cu ? cu.name : 'Visit'))); m.appendChild(el('span', '', [cu && cu.address, cu && cu.access ? 'Access: ' + cu.access : '', x.tasks].filter(Boolean).join(' · '))); r.appendChild(m); if (x.status === 'Done') r.appendChild(el('span', 'pill ok', 'Done')); if (cu && cu.address) addrs.push(cu.address);
        r.onclick = function () { Q.openForm('visit', x); }; c.appendChild(r);
      });
      if (addrs.length) { var go = el('button', 'btn', 'Route in Maps'); go.type = 'button'; go.style.cssText = 'width:100%;margin-top:8px'; go.onclick = function () { var a = addrs.slice(0, 10), url = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(a[a.length - 1]) + (a.length > 1 ? '&waypoints=' + encodeURIComponent(a.slice(0, -1).join('|')) : ''); window.open(url, '_blank'); }; c.appendChild(go); if (addrs.length > 10) c.appendChild(el('div', 'note', 'Maps takes up to 10 stops. The first 10 are included.')); }
    });
  }

  // ---- visit reminders ----
  function tomorrowVisits() { var t = U().addDays(today(), 1); return Q.byKind('visit').filter(function (v) { return v.date === t && v.status === 'Scheduled'; }).sort(function (a, b) { return (a.time || '') < (b.time || '') ? -1 : 1; }); }
  function remindersModal() {
    var list = tomorrowVisits();
    Q.modal(function (s, close) {
      s.appendChild(el('h3', '', 'Tomorrow’s visits')); if (!list.length) s.appendChild(el('p', 'hint', 'No visits scheduled for tomorrow.'));
      list.forEach(function (v) { var c = v.customer ? Q.get(v.customer) : null, r = el('div', 'row'), m = el('div', 'm'); m.appendChild(el('b', '', (v.time ? U().fmtTime(v.time) + ' · ' : '') + (c ? c.name : 'Visit'))); m.appendChild(el('span', '', c && c.phone ? c.phone : 'No phone number')); r.appendChild(m); if (c && c.phone) { var b = el('button', 'btn sm', 'Text'); b.type = 'button'; b.onclick = function () { location.href = TL().smsUrl(c.phone, TEXTS[0][1](c, v)); }; r.appendChild(b); } s.appendChild(r); });
      if (list.length) s.appendChild(el('p', 'hint', 'Each Text button opens your Messages app with the reminder filled in. You tap send.'));
      var x = el('button', 'btn ghost', 'Close'); x.type = 'button'; x.onclick = close; s.appendChild(x);
    });
  }

  // ---- reports ----
  function paidInvoices() { return Q.byKind('invoice').filter(function (i) { return i.status === 'Paid'; }).map(function (i) { return { date: U().isDate(i.paidOn) ? i.paidOn : i.date, amount: i.amount || 0, customer: i.customer }; }).filter(function (x) { return U().isDate(x.date); }); }
  function expRows() { return Q.byKind('expense').filter(function (e) { return U().isDate(e.date); }); }
  function sum(l) { var t = 0; l.forEach(function (x) { t += x.amount || 0; }); return t; }
  function summaryFor(y) { var inc = paidInvoices().filter(function (x) { return x.date.slice(0, 4) === y; }), ex = expRows().filter(function (e) { return e.date.slice(0, 4) === y; }), by = {}; ex.forEach(function (e) { by[e.category || 'Other'] = (by[e.category || 'Other'] || 0) + (e.amount || 0); }); return { year: y, income: sum(inc), expenses: sum(ex), by: by }; }
  function summaryText(sm) { var L = ['INCOME AND EXPENSES, ' + sm.year, biz().name || '', '', 'Income received: ' + money(sm.income), '', 'Expenses by category:']; Object.keys(sm.by).sort().forEach(function (k) { L.push('  ' + k + ': ' + money(sm.by[k])); }); L.push('  Total expenses: ' + money(sm.expenses), '', 'Net: ' + money(sm.income - sm.expenses), '', 'This is a summary of what you recorded in VyqilServices. It is not tax advice. Check it against your bank records.'); return L.join('\n'); }
  function reportsView(v) {
    var now = new Date(), ym = U().ymd(now).slice(0, 7), yr = String(now.getFullYear()), inv = Q.byKind('invoice'), billed = 0, got = 0;
    inv.forEach(function (i) { if (U().isDate(i.date) && i.date.slice(0, 7) === ym && i.status !== 'Void') billed += i.amount || 0; }); paidInvoices().forEach(function (x) { if (x.date.slice(0, 7) === ym) got += x.amount; });
    v.appendChild(el('h2', '', 'Reports')); var st = el('div', 'stat'); [[money(billed), 'Billed ' + TL().monthLabel(ym)], [money(got), 'Paid this month'], [money(sum(expRows().filter(function (e) { return e.date.slice(0, 7) === ym; }))), 'Expenses']].forEach(function (x) { var d = el('div'); d.appendChild(el('b', '', x[0])); d.appendChild(el('span', '', x[1])); st.appendChild(d); }); v.appendChild(st);
    var recurring = 0, active = Q.byKind('customer').filter(function (c) { return c.plan && c.plan !== 'Paused'; }); active.forEach(function (c) { recurring += Math.round((c.price || 0) * (PLAN_MULT[c.plan] || 0)); });
    var done = Q.byKind('visit').filter(function (x) { return x.status === 'Done' && U().isDate(x.date) && x.date.slice(0, 7) === ym; }), notInv = Q.byKind('visit').filter(function (x) { return x.status === 'Done' && !x.invoiced; }).length;
    v.appendChild(el('h2', '', 'Your business')); var c0 = el('div', 'card'); v.appendChild(c0);
    [['Active customers', String(active.length)], ['Expected monthly income from regular customers', money(recurring)], ['Visits done this month', String(done.length)], ['Finished visits not yet invoiced', String(notInv)]].forEach(function (x) { var r = el('div', 'row'), m = el('div', 'm'); m.appendChild(el('b', '', x[0])); r.appendChild(m); r.appendChild(el('span', 'amt', x[1])); c0.appendChild(r); });
    v.appendChild(el('h2', '', 'Who owes you')); var c1 = el('div', 'card'); v.appendChild(c1); var ag = [0, 0, 0], td = today();
    inv.forEach(function (i) { if (i.status !== 'Unpaid') return; var days = i.due && U().isDate(i.due) ? U().diff(td, i.due) : 0; ag[days > 60 ? 2 : days > 30 ? 1 : 0] += i.amount || 0; });
    [['Current or up to 30 days late', ag[0]], ['31 to 60 days late', ag[1]], ['Over 60 days late', ag[2]]].forEach(function (x) { var r = el('div', 'row'), m = el('div', 'm'); m.appendChild(el('b', '', x[0])); r.appendChild(m); r.appendChild(el('span', 'amt', money(x[1]))); c1.appendChild(r); });
    v.appendChild(el('h2', '', 'Last 6 months')); var c2 = el('div', 'card'); v.appendChild(c2); var months = [];
    for (var i = 5; i >= 0; i--) months.push(U().ymd(new Date(now.getFullYear(), now.getMonth() - i, 1)).slice(0, 7));
    var data = months.map(function (m) { return { m: m, i: sum(paidInvoices().filter(function (x) { return x.date.slice(0, 7) === m; })), e: sum(expRows().filter(function (x) { return x.date.slice(0, 7) === m; })) }; }), mx = 0; data.forEach(function (d) { mx = Math.max(mx, d.i, d.e); });
    data.forEach(function (d) { var w = el('div'); w.style.margin = '8px 0'; w.appendChild(el('b', '', TL().monthLabel(d.m))); w.appendChild(TL().bar(d.i, mx, '#2bd08a')); w.appendChild(el('div', 'hint', 'Paid ' + money(d.i))); w.appendChild(TL().bar(d.e, mx, '#e5484d')); w.appendChild(el('div', 'hint', 'Expenses ' + money(d.e) + ' · Net ' + money(d.i - d.e))); c2.appendChild(w); });
    v.appendChild(el('h2', '', 'Top customers this year')); var c3 = el('div', 'card'); v.appendChild(c3); var by = {};
    paidInvoices().filter(function (x) { return x.date.slice(0, 4) === yr; }).forEach(function (x) { by[x.customer || ''] = (by[x.customer || ''] || 0) + x.amount; });
    var top = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; }).slice(0, 10); if (!top.length) c3.appendChild(el('div', 'empty', 'Mark invoices paid to see this.'));
    top.forEach(function (k) { var r = el('div', 'row'), m = el('div', 'm'); m.appendChild(el('b', '', cname(k) || 'No customer')); r.appendChild(m); r.appendChild(el('span', 'amt', money(by[k]))); c3.appendChild(r); });
    var crews = Q.byKind('crew'); if (crews.length) { v.appendChild(el('h2', '', 'Visits done by crew this month')); var c4 = el('div', 'card'); v.appendChild(c4); crews.forEach(function (cr) { var n = done.filter(function (x) { return x.crew === cr.id; }).length; var r = el('div', 'row'), m = el('div', 'm'); m.appendChild(el('b', '', cr.name)); r.appendChild(m); r.appendChild(el('span', 'amt', String(n))); c4.appendChild(r); }); }
    v.appendChild(el('h2', '', 'Tax summary')); var c5 = el('div', 'card'); v.appendChild(c5); var ys = el('select'); for (var y = now.getFullYear(); y >= now.getFullYear() - 3; y--) { var o = el('option', '', String(y)); o.value = String(y); ys.appendChild(o); } c5.appendChild(ys);
    var b = el('div', 'btns'), sv = el('button', 'btn', 'View and share'), dl = el('button', 'btn ghost', 'Download CSV'); sv.type = dl.type = 'button'; b.appendChild(sv); b.appendChild(dl); c5.appendChild(b);
    sv.onclick = function () { TL().showText('Income and expenses ' + ys.value, summaryText(summaryFor(ys.value))); };
    dl.onclick = function () { var sm = summaryFor(ys.value), rows = [['Year', 'Item', 'Amount'], [sm.year, 'Income', (sm.income / 100).toFixed(2)]]; Object.keys(sm.by).sort().forEach(function (k) { rows.push([sm.year, k, (sm.by[k] / 100).toFixed(2)]); }); rows.push([sm.year, 'Net', ((sm.income - sm.expenses) / 100).toFixed(2)]); TL().download('services-summary-' + ys.value + '.csv', TL().csv(rows)); };
    c5.appendChild(el('div', 'note', 'Income counts invoices you marked paid. This is a record of what you entered, not tax advice.'));
  }

  // ---- More hub, banners, watch ----
  A.fn = { reminders: function () { remindersModal(); }, texts: function () { textsModal(null); }, tomorrow: function () { return tomorrowVisits().length; } };
  A.hub = function (v) {
    var n = function (k) { return Q.byKind(k).length + ' total'; }, unp = Q.byKind('invoice').filter(function (i) { return i.status === 'Unpaid'; }).length, low = lowSupplies().length, tom = tomorrowVisits().length, open = TL().open;
    TL().hubGroup(v, 'Work', [['Visits', n('visit'), open('visit')], ['Route and map', 'A day’s stops, in order', open('route')], ['Visit reminders', 'Text tomorrow’s customers', remindersModal, tom ? tom + ' tomorrow' : ''], ['Quotes', n('quote'), open('quote')], ['Customers', n('customer'), open('customer')], ['Crew', n('crew'), open('crew')], ['Supplies', n('supply'), open('supply'), low ? low + ' low' : '']]);
    TL().hubGroup(v, 'Money', [['Invoices', n('invoice'), open('invoice'), unp ? unp + ' unpaid' : ''], ['Expenses', n('expense'), open('expense')], ['Reports and tax summary', 'Income, who owes you, top customers', open('reports')]]);
    TL().hubGroup(v, 'People', [['Texts to customers', 'Reminder, on my way, running late, thank you', function () { textsModal(null); }]]);
  };
  function lowSupplies() { return Q.byKind('supply').filter(function (r) { return r.reorderAt != null && r.reorderAt !== '' && +r.qty <= +r.reorderAt; }); }
  A.watch.push({ l: 'Quotes waiting on an answer', fn: function (rs, t) { return rs.filter(function (r) { return r.kind === 'quote' && r.status === 'Sent' && r.sentOn && U().diff(t, r.sentOn) >= 3; }); }, sub: function (r) { return 'Sent ' + fmt(r.sentOn) + ' · ' + money(r.price); } });
  A.watch.push({ l: 'Unpaid invoices past due', fn: function (rs, t) { return rs.filter(function (r) { return r.kind === 'invoice' && r.status === 'Unpaid' && r.due && r.due < t; }); }, sub: function (r) { return 'Due ' + fmt(r.due) + ' · ' + money(r.amount); } });
  A.watch.push({ l: 'Finished visits not invoiced', fn: function (rs) { return rs.filter(function (r) { return r.kind === 'visit' && r.status === 'Done' && !r.invoiced; }); }, sub: function (r) { return fmt(r.date); } });
  A.watch.push({ l: 'Supplies to reorder', fn: function () { return lowSupplies(); }, sub: function (r) { return r.qty + ' ' + (r.unit || '') + ' left'; } });

  function boot() {
    Q.views.route = routeView; Q.views.reports = reportsView; Q.banners = Q.banners || [];
    Q.banners.push(function (v) {
      var n = tomorrowVisits().length; if (!n) return; var b = el('button', 'vq-note blue'); b.type = 'button'; var d = el('span', 'dot', String(n)), t = el('div', 't'); t.appendChild(el('b', '', n + (n === 1 ? ' visit' : ' visits') + ' tomorrow')); t.appendChild(el('span', '', 'Send reminder texts to your customers')); b.appendChild(d); b.appendChild(t); b.appendChild(el('span', 'go', '›')); b.onclick = remindersModal; v.appendChild(b);
    });
    Q.extras.push(function (v) { TL().profileCard(v); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();


// Contractor-style menu, quick buttons and starter checklist for Services.
(function () {
  var A = window.VQ_APP;
  A.menu = function () {
    var F = A.fn || {};
    return [
      { h: 'Work', items: [
        { l: 'Leads', tab: 'leads' }, { l: 'Visits', tab: 'visit' }, { l: 'Route and map', tab: 'route' },
        { l: 'Visit reminders', run: function () { F.reminders && F.reminders(); }, badge: function () { return F.tomorrow ? F.tomorrow() : 0; } },
        { l: 'Quotes', tab: 'quote' }, { l: 'Customers', tab: 'customer' }, { l: 'Crew', tab: 'crew' }, { l: 'Supplies', tab: 'supply' }] },
      { h: 'Money', items: [{ l: 'Invoices', tab: 'invoice' }, { l: 'Expenses', tab: 'expense' }, { l: 'Reports and tax summary', tab: 'reports' }] },
      { h: 'People', items: [{ l: 'Texts to customers', run: function () { F.texts && F.texts(); } }] }
    ];
  };
  A.quick = [{ l: 'New customer', form: 'customer' }, { l: 'New visit', form: 'visit' }, { l: 'New quote', form: 'quote' }];
  A.starter = function () {
    return [
      { id: 'cust', t: 'First, add a customer', h: 'Name, address, phone and how often you serve them.', kind: 'customer', form: 'customer' },
      { id: 'visit', t: 'Next, schedule a visit', h: 'Or open a customer and tap Schedule upcoming visits.', kind: 'visit', form: 'visit' },
      { id: 'quote', t: 'Write a quote', h: 'Send a price before the job.', kind: 'quote', form: 'quote' },
      { id: 'crew', t: 'Add your crew', h: 'Optional. Assign visits to people.', kind: 'crew', form: 'crew' },
      { id: 'inv', t: 'Invoice a completed visit', h: 'Open a finished visit and tap Mark done and invoice.', kind: 'invoice', form: 'invoice' },
      { id: 'comm', t: 'Set up Vyqil Community', h: 'Be found by nearby Vyqil businesses, and find them.', manual: true, run: function () { if (Q.community) Q.community.listing(); } },
      { id: 'alerts', t: 'Turn on phone alerts', h: 'Get visit and invoice alerts when the app is closed.', manual: true, run: function () { Q.push.panel(); } }
    ];
  };
})();

// Customer portal: customers see their invoices and can request appointments.
window.VQ_APP.portal = { kind: 'customer', invoices: function (c, recs) {
  return recs.filter(function (r) { return r.kind === 'invoice' && r.customer === c.id && r.status !== 'Void'; }).sort(function (a, b) { return (a.date || '') < (b.date || '') ? 1 : -1; }).map(function (r) { return { n: String(r.number || ''), t: 'Invoice', a: r.amount || 0, s: r.status || '', d: r.due || r.date || '' }; });
} };

// ===== Services tailoring: pick your services (pool, lawn, cleaning...), then everything is built around them =====
(function () {
  'use strict';
  var A = window.VQ_APP, K = A.kinds;
  function U() { return Q.u; }
  function el(t, c, x) { return U().el(t, c, x); }
  function today() { return U().today(); }

  // What each service usually involves. The owner can edit every line later; these are starting points.
  var SVC = {
    'House cleaning': { icon: '🧹', plan: 'Every 2 weeks', tasks: ['Dust all surfaces', 'Vacuum and mop floors', 'Clean and sanitize kitchen', 'Clean and sanitize bathrooms', 'Empty trash cans', 'Make beds if asked'], included: 'Dusting, vacuuming, mopping, kitchen and bathroom cleaning, and trash removal.', supplies: [['All-purpose cleaner', 'bottles', 2], ['Glass cleaner', 'bottles', 2], ['Microfiber cloths', 'packs', 1], ['Trash bags', 'boxes', 1]] },
    'Move-out and turnover cleaning': { icon: '📦', plan: 'One-time', tasks: ['Clean inside oven and fridge', 'Wipe inside cabinets and drawers', 'Clean all baseboards', 'Scrub tubs, tiles and toilets', 'Clean windows and tracks', 'Vacuum and mop every room'], included: 'A top-to-bottom clean of an empty home, including inside appliances and cabinets.', supplies: [['Oven cleaner', 'cans', 1], ['Degreaser', 'bottles', 1], ['Magic erasers', 'packs', 1]] },
    'Lawn care': { icon: '🌱', plan: 'Weekly', tasks: ['Mow', 'Edge walks and beds', 'Trim around obstacles', 'Blow clippings off hard surfaces', 'Check gate is latched'], included: 'Mowing, edging, trimming and blowing off all hard surfaces.', supplies: [['Mower gas', 'gallons', 2], ['Trimmer line', 'spools', 1], ['Mower blades', 'blades', 1]] },
    'Landscaping': { icon: '🌳', plan: 'Monthly', tasks: ['Weed beds', 'Prune shrubs', 'Refresh mulch where needed', 'Check sprinkler heads', 'Haul away debris'], included: 'Bed weeding, pruning, mulch touch-ups and debris haul-away.', supplies: [['Mulch', 'bags', 5], ['Weed killer', 'bottles', 1], ['Pruning shears', 'pairs', 1]] },
    'Pool service': { icon: '🏊', plan: 'Weekly', tasks: ['Test and balance chemicals', 'Skim surface', 'Brush walls and steps', 'Vacuum pool', 'Empty skimmer and pump baskets', 'Check filter pressure'], included: 'Weekly chemical testing and balancing, skimming, brushing, vacuuming and basket cleaning.', supplies: [['Chlorine tablets', 'buckets', 1], ['Shock', 'bags', 2], ['pH increaser', 'tubs', 1], ['pH decreaser', 'tubs', 1], ['Test strips', 'bottles', 1]] },
    'Pressure washing': { icon: '💦', plan: 'One-time', tasks: ['Pre-wet and apply cleaner', 'Wash driveway and walks', 'Wash siding or deck', 'Rinse and check results with the customer'], included: 'Pressure washing of the surfaces listed, with cleaner applied and a full rinse.', supplies: [['Surface cleaner', 'gallons', 1], ['Nozzle tips', 'sets', 1]] },
    'Window cleaning': { icon: '🪟', plan: 'Monthly', tasks: ['Wash outside glass', 'Wipe frames and sills', 'Clean screens', 'Clean inside glass if booked'], included: 'Inside and outside glass, frames and sills.', supplies: [['Glass cleaner concentrate', 'bottles', 1], ['Squeegee blades', 'blades', 2], ['Scrubber sleeves', 'sleeves', 1]] },
    'Gutter cleaning': { icon: '🍂', plan: 'One-time', tasks: ['Clear gutters by hand', 'Flush downspouts', 'Check for sagging or leaks', 'Bag and remove debris'], included: 'Debris cleared from all gutters, downspouts flushed, and debris removed.', supplies: [['Trash bags', 'boxes', 1], ['Work gloves', 'pairs', 2]] },
    'Carpet cleaning': { icon: '🧽', plan: 'One-time', tasks: ['Pre-vacuum and inspect', 'Pre-treat stains', 'Hot water extraction', 'Set up fans if needed'], included: 'Pre-vacuum, stain pre-treatment and deep hot water extraction.', supplies: [['Carpet shampoo', 'gallons', 2], ['Spot remover', 'bottles', 2]] },
    'Snow removal': { icon: '❄️', plan: 'One-time', tasks: ['Plow or shovel driveway', 'Clear walkways and steps', 'Salt or sand icy spots', 'Clear mailbox area'], included: 'Driveway and walkway clearing, with salt on icy spots.', supplies: [['Ice melt', 'bags', 4], ['Shovel', 'each', 1], ['Plow gas or diesel', 'gallons', 5]] },
    'Junk removal': { icon: '🚛', plan: 'One-time', tasks: ['Walk through and confirm what goes', 'Load and haul', 'Sweep the area', 'Take items to donation or dump'], included: 'Loading and hauling away the items we agree on, plus a quick sweep up.', supplies: [['Dump or disposal fees', 'receipts', 0], ['Moving straps', 'sets', 1], ['Contractor trash bags', 'boxes', 1]] },
    'Pest control': { icon: '🐜', plan: 'Monthly', tasks: ['Inspect inside and outside', 'Treat entry points and perimeter', 'Set or check traps', 'Report findings to the customer'], included: 'Inspection, perimeter treatment and trap checks, with a written report.', supplies: [['Perimeter spray', 'gallons', 1], ['Bait stations', 'packs', 2], ['Gloves and mask', 'sets', 1]] },
    'Pet waste removal': { icon: '🐕', plan: 'Weekly', tasks: ['Walk the full yard', 'Bag and remove waste', 'Latch the gate behind you', 'Rinse the tools'], included: 'Weekly yard scoop and haul-away.', supplies: [['Waste bags', 'rolls', 3], ['Disinfectant spray', 'bottles', 1]] },
    'Tree trimming': { icon: '🪓', plan: 'One-time', tasks: ['Mark and agree what comes off', 'Trim branches', 'Chip or haul the cuttings', 'Rake up and check power lines'], included: 'Trimming of the trees we agree on, with cuttings chipped or hauled.', supplies: [['Chainsaw chain and bar oil', 'bottles', 1], ['Chipper gas', 'gallons', 2]] },
    'Staging': { icon: '🛋️', plan: 'One-time', tasks: ['Walk the home and plan the layout', 'Place furniture and decor', 'Final photo-ready touches'], included: 'A staging plan, furniture and decor placement, and final touches before photos.', supplies: [] },
    'Other': { icon: '🛠️', plan: 'One-time', tasks: [], included: '', supplies: [] }
  };
  var ORDER = Object.keys(SVC);
  function info(n) { return SVC[n] || { icon: '🛠️', plan: 'One-time', tasks: [], included: '', supplies: [] }; }

  // Make the community directory (and the "Need a Vyqil" lists in this app) know the full service list.
  try { var cats = window.VQCommunity && window.VQCommunity.CATS && window.VQCommunity.CATS.services; if (cats) { ORDER.forEach(function (n) { if (n !== 'Other' && cats.indexOf(n) < 0) cats.splice(Math.max(0, cats.indexOf('Other')), 0, n); }); } } catch (e) { /* optional */ }

  function mySvc() { return ((Q.S && Q.S.biz && Q.S.biz.services) || []).slice(); }
  function optList() { var m = mySvc(); return m.length ? m : ORDER.slice(); }
  function save(arr) {
    return firebase.firestore().collection('businesses').doc(Q.S.biz.id).update({ services: arr }).then(function () { Q.S.biz.services = arr; });
  }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  // Dropdowns that show only the owner's own services.
  function svcField(key, label, req) {
    var f = { k: key, l: label, t: 'select', req: req ? 1 : 0, hint: 'Pick from the services you offer. Change that list under My services.' };
    Object.defineProperty(f, 'o', { get: optList, enumerable: true });
    return f;
  }
  var CU = K.customer; CU.fields.splice(CU.fields.length - 1, 0, svcField('service', 'Main service'));
  var VI = K.visit; VI.fields.splice(VI.fields.length - 1, 0, svcField('service', 'Service this visit'));
  var QU = K.quote; QU.fields.splice(1, 0, svcField('svc', 'Service (pick one)'));
  (QU.fields.filter(function (f) { return f.k === 'service'; })[0] || {}).req = 0;
  var oldQT = QU.title; QU.title = function (r) { return (r.prospect || 'Quote') + ' · ' + (r.service || r.svc || ''); };
  var oldQS = QU.actions[0].run;
  QU.actions[0] = { l: 'View or share the quote', run: function (r) {
    var s = r.service || r.svc || '', r2 = Object.assign({}, r, { service: s, details: r.details || info(s).included || '' });
    oldQS(r2);
  } };
  VI.actions.unshift({ l: 'Add the usual tasks for this service', show: function (r) { return !r.tasks; }, run: function (r) {
    var s = r.service || (r.customer && Q.get(r.customer) && Q.get(r.customer).service) || '', t = info(s).tasks;
    if (!t.length) { Q.toast('Pick a service on the visit first, or type your own tasks.'); return; }
    Q.tools.upd(r.id, { service: r.service || s, tasks: t.join('\n').slice(0, 1400) }).then(function () { Q.toast('Tasks added.'); }, function (e) { Q.toast(Q.friendly(e)); });
  } });
  CU.actions.push({ l: 'Quote their main service', show: function (r) { return !!r.service; }, run: function (r) { Q.openForm('quote', null, { customer: r.id, prospect: r.name, address: r.address || '', svc: r.service, plan: info(r.service).plan, details: info(r.service).included }); } });
  var oldWQ = CU.actions.filter(function (a) { return a.l === 'Write a quote'; })[0]; if (oldWQ) oldWQ.run = function (r) { Q.openForm('quote', null, { customer: r.id, prospect: r.name, address: r.address || '', svc: r.service || '', plan: r.service ? info(r.service).plan : undefined, details: r.service ? info(r.service).included : '' }); };

  // ---- My services screen ----
  function suppliesFor(arr) {
    var have = Q.byKind('supply').map(function (s) { return String(s.name || '').toLowerCase(); }), made = 0, chain = Promise.resolve();
    arr.forEach(function (n) { info(n).supplies.forEach(function (s) { if (have.indexOf(s[0].toLowerCase()) > -1) return; have.push(s[0].toLowerCase()); made++; chain = chain.then(function () { return Q.tools.add('supply', { name: s[0], qty: 0, unit: s[1], reorderAt: s[2] }); }); }); });
    return chain.then(function () { return made; });
  }
  function myServices(first) {
    Q.modal(function (s, close) {
      var cur = mySvc();
      s.appendChild(el('h3', '', first ? 'What services do you offer?' : 'My services'));
      s.appendChild(el('p', 'hint', 'Add each service you offer, like pool cleaning or lawn care. Your visits, quotes, supplies and community listing are built around this list. You can change it any time.'));
      var list = el('div'); s.appendChild(list);
      var pick = el('select'), addB = el('button', 'btn', 'Add service'); addB.type = 'button';
      var cust = el('input'); cust.maxLength = 40; cust.placeholder = 'Or type your own, like Dock cleaning';
      var addC = el('button', 'btn ghost', 'Add my own'); addC.type = 'button';
      var msg = el('div', 'note');
      function draw() {
        list.textContent = '';
        if (!cur.length) list.appendChild(el('div', 'empty', 'Nothing added yet.'));
        cur.forEach(function (n, i) {
          var row = el('div', 'row'), m = el('div', 'm'); m.appendChild(el('b', '', info(n).icon + ' ' + n));
          var rm = el('button', 'btn ghost sm', 'Remove'); rm.type = 'button'; rm.onclick = function () { cur.splice(i, 1); draw(); };
          row.appendChild(m); row.appendChild(rm); list.appendChild(row);
        });
        pick.textContent = ''; var b0 = el('option', '', 'Choose a service...'); b0.value = ''; pick.appendChild(b0);
        ORDER.filter(function (n) { return cur.indexOf(n) < 0; }).forEach(function (n) { var o = el('option', '', n); o.value = n; pick.appendChild(o); });
      }
      s.appendChild(el('label', 'f', 'Add a service')); s.appendChild(pick); s.appendChild(addB);
      s.appendChild(el('label', 'f', 'Not on the list?')); s.appendChild(cust); s.appendChild(addC); s.appendChild(msg);
      addB.onclick = function () { if (pick.value && cur.indexOf(pick.value) < 0) { cur.push(pick.value); draw(); } };
      addC.onclick = function () { var v = cust.value.trim(); if (v && cur.indexOf(v) < 0) { cur.push(v); cust.value = ''; draw(); } };
      var sup = el('div', 'chk'), si = el('input'); si.type = 'checkbox'; si.id = 'svc_sup'; si.checked = true; var sl = el('label', '', 'Also add the supplies these services usually need to my Supplies list'); sl.htmlFor = si.id; sup.appendChild(si); sup.appendChild(sl); s.appendChild(sup);
      var b = el('div', 'btns'), go = el('button', 'btn', 'Save'), x = el('button', 'btn ghost', first ? 'Not now' : 'Cancel'); go.type = x.type = 'button'; b.appendChild(go); b.appendChild(x); s.appendChild(b);
      x.onclick = close;
      go.onclick = function () {
        go.disabled = true;
        save(cur).then(function () { return si.checked ? suppliesFor(cur.filter(function (n) { return mySvc().indexOf(n) > -1; })) : 0; }).then(function (n) {
          close(); Q.toast('Services saved.' + (n ? ' ' + n + ' supplies added.' : '')); Q.render();
        }, function (e) { msg.className = 'note err'; msg.textContent = Q.friendly(e); go.disabled = false; });
      };
      draw();
    });
  }
  A.fn = A.fn || {}; A.fn.services = function () { myServices(false); };

  // ---- Home card, shown once automatically on first run ----
  Q.extras.push(function (v) {
    var m = mySvc(), c = el('div', 'card'); v.appendChild(el('h2', '', 'My services'));
    v.appendChild(c);
    if (!m.length) {
      c.appendChild(el('div', 'hint', 'Choose the services you offer. Visits, quotes, supplies and your community listing are then built around them.'));
      var b = el('button', 'btn', 'Choose my services'); b.type = 'button'; b.style.cssText = 'display:block;width:100%;margin-top:8px'; b.onclick = function () { myServices(true); }; c.appendChild(b);
      var key = 'vq_svc_ask_' + (Q.S.biz ? Q.S.biz.id : ''); if (!ls(key)) { ls(key, '1'); setTimeout(function () { myServices(true); }, 500); }
    } else {
      var w = el('div'); m.forEach(function (n) { var t = el('span', 'tag', info(n).icon + ' ' + n); t.style.cssText = 'display:inline-block;margin:0 6px 6px 0;padding:6px 10px;border-radius:999px;background:rgba(127,127,127,.18);font-size:14px'; w.appendChild(t); }); c.appendChild(w);
      var e = el('button', 'btn ghost', 'Edit my services'); e.type = 'button'; e.style.cssText = 'display:block;width:100%;margin-top:4px'; e.onclick = function () { myServices(false); }; c.appendChild(e);
    }
  });

  // ---- Menu: Community has its own group; My services sits under Work ----
  var oldMenu = A.menu;
  A.menu = function () {
    var g = oldMenu(), F = A.fn || {};
    g.forEach(function (grp) { if (grp.h === 'Work') grp.items = grp.items.filter(function (i) { return i.tab !== 'leads'; }); });
    g[0].items.unshift({ l: 'My services', run: function () { F.services && F.services(); } });
    g.splice(1, 0, { h: 'Community', items: Q.communityMenu ? Q.communityMenu() : [] });
    return g;
  };

  // ---- Get started: first step is choosing services ----
  var oldStarter = A.starter;
  A.starter = function () {
    var st = oldStarter();
    st.unshift({ id: 'svc', t: 'Choose your services', h: 'Pool, lawn, cleaning... everything else is built around this.', done: function () { return mySvc().length > 0; }, run: function () { myServices(true); } });
    return st;
  };
})();
