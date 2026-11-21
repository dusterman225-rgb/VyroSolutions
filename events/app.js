// VyqilEvents: event planning for weddings, parties and other events. Runs on the shared Vyqil engine (../vertical/engine.js).
// Records: clients, events, guests, vendors, vendor bookings and budget, tasks, day-of timeline and invoices.
window.VQ_APP = {
  community: { product: 'events', inbound: { addKind: 'client', addDefaults: {}, addLabel: 'Add as client', inboxTitle: 'Event requests near you', listTitle: 'My event planning in the community', catLabel: 'Events you plan' } },
  id: 'events', name: 'VyqilEvents', who: 'For wedding, party and event planners', tag: 'Clients, events, guests, vendors and budgets in one place.', alertText: 'event dates, tasks and vendor payments',
  tabKinds: ['event', 'client', 'task'],
  kinds: {
    client: { label: 'Client', plural: 'Clients', icon: '👤', stage: 'status', closed: function (r) { return r.status === 'Past client'; },
      title: function (r) { return [r.name, r.partner].filter(Boolean).join(' & ') || 'Client'; },
      fields: [{ k: 'name', l: 'Name', t: 'text', req: 1 }, { k: 'partner', l: 'Partner or second contact', t: 'text', hint: 'For a wedding, the other half of the couple.' }, { k: 'phone', l: 'Phone', t: 'tel' }, { k: 'email', l: 'Email', t: 'email', hint: 'Used to send them the client portal link.' }, { k: 'status', l: 'Status', t: 'select', o: ['Inquiry', 'Active client', 'Past client'], req: 1 }, { k: 'source', l: 'How they found you', t: 'select', o: ['Referral', 'Vyqil Community', 'Instagram or Facebook', 'Google', 'Venue or vendor', 'Bridal show', 'Other'] }, { k: 'notes', l: 'Notes', t: 'area', hint: 'Style, must-haves, family details.' }],
      sub: function (r) { return [r.phone, r.email].filter(Boolean).join(' · '); } },
    event: { label: 'Event', plural: 'Events', icon: '🥂', stage: 'status', closed: function (r) { return r.status === 'Done' || r.status === 'Cancelled'; },
      sort: function (a, b) { return (a.date || '9999') < (b.date || '9999') ? -1 : 1; },
      checklist: { tpl: 'plan', base: 'date', name: 'planning checklist' },
      fields: [{ k: 'title', l: 'Event name', t: 'text', req: 1, h: 'Smith wedding, Maya’s 30th' }, { k: 'client', l: 'Client', t: 'link', to: 'client', req: 1 }, { k: 'type', l: 'Event type', t: 'select', o: ['Wedding', 'Engagement party', 'Bridal or baby shower', 'Birthday party', 'Anniversary', 'Graduation', 'Corporate event', 'Holiday party', 'Fundraiser', 'Other'], req: 1 }, { k: 'date', l: 'Event date', t: 'date', req: 1, cal: 1, alert: { hour: 9 }, lbl: 'Event', hint: 'It goes on your calendar with a reminder that morning.' }, { k: 'time', l: 'Start time', t: 'time' }, { k: 'venue', l: 'Venue', t: 'text' }, { k: 'venueAddress', l: 'Venue address', t: 'text' }, { k: 'guests', l: 'Expected guests', t: 'number' }, { k: 'budget', l: 'Client budget', t: 'money', hint: 'The total the client plans to spend. Vendor bookings are compared with it.' }, { k: 'status', l: 'Status', t: 'select', o: ['Inquiry', 'Proposal sent', 'Booked', 'Planning', 'Done', 'Cancelled'], req: 1 }, { k: 'notes', l: 'Notes', t: 'area' }],
      sub: function (r) { return [r.date ? Q.u.fmtDate(r.date) : '', r.venue].filter(Boolean).join(' · '); }, amount: function (r) { return r.budget || ''; },
      actions: [
        { l: 'Event summary to share', group: 'Share and bill', run: function (r) { A.fn.summary(r); } },
        { l: 'Text the client', group: 'Share and bill', show: function (r) { var c = r.client ? Q.get(r.client) : null; return !!(c && c.phone); }, run: function (r) { var c = Q.get(r.client); location.href = Q.tools.smsUrl(c.phone, ''); } },
        { l: 'Create an invoice for this event', group: 'Share and bill', run: function (r) { Q.openForm('invoice', null, { client: r.client, event: r.id, date: Q.u.today() }); } }
      ] },
    guest: { label: 'Guest', plural: 'Guests', icon: '🎟️', stage: 'rsvp', closed: function (r) { return r.rsvp === 'Declined'; },
      fields: [{ k: 'name', l: 'Guest name', t: 'text', req: 1 }, { k: 'event', l: 'Event', t: 'link', to: 'event', req: 1 }, { k: 'party', l: 'Party size', t: 'number', hint: 'How many people this invitation covers, including the guest.' }, { k: 'rsvp', l: 'RSVP', t: 'select', o: ['Pending', 'Attending', 'Declined'], req: 1 }, { k: 'meal', l: 'Meal choice or diet', t: 'text' }, { k: 'table', l: 'Table or seat', t: 'text' }, { k: 'phone', l: 'Phone', t: 'tel' }, { k: 'email', l: 'Email', t: 'email' }, { k: 'notes', l: 'Notes', t: 'area' }],
      sub: function (r) { var e = r.event ? Q.get(r.event) : null; return [e ? Q.title(e) : '', r.party ? 'party of ' + r.party : '', r.table ? 'table ' + r.table : ''].filter(Boolean).join(' · '); } },
    vendor: { label: 'Vendor', plural: 'Vendors', icon: '🤝', stage: 'category',
      fields: [{ k: 'name', l: 'Business name', t: 'text', req: 1 }, { k: 'category', l: 'What they do', t: 'select', o: ['Venue', 'Caterer', 'Bakery or cake', 'Photographer', 'Videographer', 'DJ or band', 'Florist', 'Decor and rentals', 'Officiant', 'Hair and makeup', 'Transportation', 'Lighting and sound', 'Stationery', 'Bar service', 'Other'], req: 1 }, { k: 'contact', l: 'Contact person', t: 'text' }, { k: 'phone', l: 'Phone', t: 'tel' }, { k: 'email', l: 'Email', t: 'email' }, { k: 'website', l: 'Website', t: 'text' }, { k: 'notes', l: 'Notes', t: 'area', hint: 'Pricing, packages, past experience.' }],
      sub: function (r) { return [r.phone, r.email].filter(Boolean).join(' · '); } },
    booking: { label: 'Vendor booking', plural: 'Vendor bookings and budget', icon: '💳', stage: 'status', closed: function (r) { return r.status === 'Paid in full'; },
      sort: function (a, b) { return (a.due || '9999') < (b.due || '9999') ? -1 : 1; },
      title: function (r) { var v = r.vendor ? Q.get(r.vendor) : null; return (r.item || 'Booking') + (v ? ' · ' + Q.title(v) : ''); },
      fields: [{ k: 'event', l: 'Event', t: 'link', to: 'event', req: 1 }, { k: 'vendor', l: 'Vendor', t: 'link', to: 'vendor' }, { k: 'item', l: 'What is it for', t: 'text', req: 1, h: 'Photography package, cake, DJ' }, { k: 'cost', l: 'Total cost', t: 'money', req: 1 }, { k: 'deposit', l: 'Deposit paid so far', t: 'money' }, { k: 'due', l: 'Next payment due', t: 'date', cal: 1, alert: { hour: 9 }, lbl: 'Vendor payment due' }, { k: 'status', l: 'Status', t: 'select', o: ['Quoted', 'Booked', 'Deposit paid', 'Paid in full'], req: 1 }, { k: 'notes', l: 'Notes', t: 'area' }],
      amount: function (r) { return r.cost || 0; }, sub: function (r) { var e = r.event ? Q.get(r.event) : null; return [e ? Q.title(e) : '', r.due ? 'Due ' + Q.u.fmtDate(r.due) : ''].filter(Boolean).join(' · '); } },
    task: { label: 'Task', plural: 'Tasks', icon: '✅', stage: 'status', closed: function (r) { return r.status === 'Done'; },
      sort: function (a, b) { return (a.due || '9999') < (b.due || '9999') ? -1 : 1; },
      fields: [{ k: 'title', l: 'Task', t: 'text', req: 1, h: 'Confirm the florist, send final headcount' }, { k: 'event', l: 'Event', t: 'link', to: 'event' }, { k: 'due', l: 'Due date', t: 'date', cal: 1, alert: { hour: 9 }, lbl: 'Task due' }, { k: 'status', l: 'Status', t: 'select', o: ['To do', 'Doing', 'Done'], req: 1 }, { k: 'who', l: 'Who is doing it', t: 'text' }, { k: 'notes', l: 'Notes', t: 'area' }],
      sub: function (r) { var e = r.event ? Q.get(r.event) : null; return [e ? Q.title(e) : '', r.due ? 'Due ' + Q.u.fmtDate(r.due) : '', r.who].filter(Boolean).join(' · '); } },
    timeline: { label: 'Day-of schedule item', plural: 'Day-of schedule', icon: '⏰',
      sort: function (a, b) { return (a.time || '') < (b.time || '') ? -1 : 1; },
      title: function (r) { return (r.time ? Q.u.fmtTime(r.time) + ' ' : '') + (r.what || 'Schedule item'); },
      fields: [{ k: 'event', l: 'Event', t: 'link', to: 'event', req: 1 }, { k: 'time', l: 'Time', t: 'time', req: 1 }, { k: 'what', l: 'What happens', t: 'text', req: 1, h: 'Guests arrive, first dance, cake cutting' }, { k: 'who', l: 'Who is responsible', t: 'text' }, { k: 'notes', l: 'Notes', t: 'area' }],
      sub: function (r) { var e = r.event ? Q.get(r.event) : null; return [e ? Q.title(e) : '', r.who].filter(Boolean).join(' · '); } },
    invoice: { label: 'Invoice', plural: 'Invoices', icon: '🧾', stage: 'status', closed: function (r) { return r.status === 'Paid' || r.status === 'Void'; }, sort: function (a, b) { return (a.date || '') < (b.date || '') ? 1 : -1; },
      title: function (r) { return (r.client ? Q.title(Q.get(r.client)) : 'Invoice') + (r.number ? ' #' + r.number : ''); },
      fields: [{ k: 'client', l: 'Client', t: 'link', to: 'client', req: 1 }, { k: 'event', l: 'Event', t: 'link', to: 'event' }, { k: 'number', l: 'Invoice number', t: 'text' }, { k: 'date', l: 'Date', t: 'date', req: 1 }, { k: 'amount', l: 'Amount', t: 'money', req: 1 }, { k: 'due', l: 'Due date', t: 'date', cal: 1, alert: { hour: 9 }, lbl: 'Invoice due' }, { k: 'status', l: 'Status', t: 'select', o: ['Unpaid', 'Paid', 'Void'], req: 1 }, { k: 'notes', l: 'Notes', t: 'area', hint: 'Deposit, planning fee, what it covers.' }],
      amount: function (r) { return r.amount || 0; }, sub: function (r) { return r.due ? 'Due ' + Q.u.fmtDate(r.due) : ''; } }
  },
  // Planning checklists. Each step is due this many days from the event date (negative = before).
  checklists: {
    plan: [['Sign the contract and collect the deposit', -330], ['Set the budget and guest count', -320], ['Book the venue', -300], ['Book photographer and videographer', -270], ['Book caterer and bar service', -240], ['Book music (DJ or band)', -220], ['Book florist and decor', -200], ['Send save-the-dates', -180], ['Book hair, makeup and transportation', -150], ['Order stationery and invitations', -120], ['Send invitations', -75], ['Menu and cake tasting', -60], ['Final vendor confirmations', -30], ['Chase RSVPs', -21], ['Final headcount and seating chart to venue and caterer', -10], ['Day-of timeline to all vendors', -7], ['Final vendor payments', -3], ['Event day', 0], ['Send thank-you notes and collect reviews', 7]].map(function (x) { return { t: x[0], off: x[1] }; })
  },
  stats: [
    { l: 'Upcoming events', fn: function (rs, t) { return rs.filter(function (r) { return r.kind === 'event' && r.date >= t && r.status !== 'Cancelled' && r.status !== 'Done'; }).length; } },
    { l: 'Open tasks', fn: function (rs) { return rs.filter(function (r) { return r.kind === 'task' && r.status !== 'Done'; }).length; } },
    { l: 'Unpaid', fn: function (rs) { var s = 0; rs.forEach(function (r) { if (r.kind === 'invoice' && r.status === 'Unpaid') s += r.amount || 0; }); return Q.u.money(s); } }
  ],
  watch: []
};

(function () {
  'use strict';
  var A = window.VQ_APP;
  function U() { return Q.u; }
  function el(t, c, x) { return U().el(t, c, x); }
  function money(c) { return U().money(c); }
  function fmt(d) { return d ? U().fmtDate(d) : ''; }
  function evName(id) { var e = id ? Q.get(id) : null; return e ? Q.title(e) : ''; }

  // ---------- watch list: things that need attention ----------
  A.watch.push({ l: 'Overdue tasks', fn: function (rs, t) { return rs.filter(function (r) { return r.kind === 'task' && r.status !== 'Done' && r.due && r.due < t; }); }, sub: function (r) { return 'Due ' + fmt(r.due) + (evName(r.event) ? ' · ' + evName(r.event) : ''); } });
  A.watch.push({ l: 'Vendor payments due in the next 14 days', fn: function (rs, t) { return rs.filter(function (r) { return r.kind === 'booking' && r.status !== 'Paid in full' && r.status !== 'Quoted' && r.due && r.due <= U().addDays(t, 14); }); }, sub: function (r) { return 'Due ' + fmt(r.due) + ' · ' + money(r.cost) + (evName(r.event) ? ' · ' + evName(r.event) : ''); } });
  A.watch.push({ l: 'Guests who have not RSVPed (event within 30 days)', fn: function (rs, t) { return rs.filter(function (g) { if (g.kind !== 'guest' || g.rsvp !== 'Pending') return false; var e = g.event ? Q.get(g.event) : null; return e && e.date && e.date >= t && e.date <= U().addDays(t, 30); }); }, sub: function (r) { return evName(r.event); } });
  A.watch.push({ l: 'Events over budget', fn: function (rs) { return rs.filter(function (e) { if (e.kind !== 'event' || !e.budget || e.status === 'Done' || e.status === 'Cancelled') return false; return spent(e.id, rs) > e.budget; }); }, sub: function (e) { return 'Booked ' + money(spent(e.id)) + ' of ' + money(e.budget); } });
  A.watch.push({ l: 'Unpaid invoices past due', fn: function (rs, t) { return rs.filter(function (r) { return r.kind === 'invoice' && r.status === 'Unpaid' && r.due && r.due < t; }); }, sub: function (r) { return 'Due ' + fmt(r.due) + ' · ' + money(r.amount); } });
  A.watch.push({ l: 'Events with no vendors booked yet (within 60 days)', fn: function (rs, t) { return rs.filter(function (e) { return e.kind === 'event' && e.date && e.date >= t && e.date <= U().addDays(t, 60) && (e.status === 'Booked' || e.status === 'Planning') && !rs.some(function (b) { return b.kind === 'booking' && b.event === e.id; }); }); }, sub: function (r) { return fmt(r.date); } });

  // total of vendor bookings that are actually booked (not just quoted) for an event
  function spent(eventId, rs) { var s = 0; (rs || Q.S.recs).forEach(function (b) { if (b.kind === 'booking' && b.event === eventId && b.status !== 'Quoted') s += b.cost || 0; }); return s; }

  // ---------- share a plain-text event summary ----------
  A.fn = A.fn || {};
  A.fn.summary = function (e) {
    var lines = [Q.title(e) + (e.type ? ' (' + e.type + ')' : '')];
    if (e.date) lines.push('Date: ' + fmt(e.date) + (e.time ? ' at ' + U().fmtTime(e.time) : ''));
    if (e.venue) lines.push('Venue: ' + e.venue + (e.venueAddress ? ', ' + e.venueAddress : ''));
    if (e.guests) lines.push('Expected guests: ' + e.guests);
    var tl = Q.byKind('timeline').filter(function (t) { return t.event === e.id; }).sort(function (a, b) { return (a.time || '') < (b.time || '') ? -1 : 1; });
    if (tl.length) { lines.push('', 'Day-of schedule:'); tl.forEach(function (t) { lines.push('  ' + U().fmtTime(t.time) + '  ' + t.what + (t.who ? ' (' + t.who + ')' : '')); }); }
    var bk = Q.byKind('booking').filter(function (b) { return b.event === e.id && b.status !== 'Quoted'; });
    if (bk.length) { lines.push('', 'Vendors:'); bk.forEach(function (b) { var v = b.vendor ? Q.get(b.vendor) : null; lines.push('  ' + (b.item || '') + (v ? ': ' + Q.title(v) + (v.phone ? ' ' + v.phone : '') : '')); }); }
    var g = Q.byKind('guest').filter(function (x) { return x.event === e.id; }), yes = 0, no = 0, pend = 0;
    g.forEach(function (x) { var n = +x.party || 1; if (x.rsvp === 'Attending') yes += n; else if (x.rsvp === 'Declined') no += n; else pend += n; });
    if (g.length) lines.push('', 'RSVPs: ' + yes + ' attending, ' + no + ' declined, ' + pend + ' waiting');
    Q.tools.showText('Event summary', lines.join('\n'));
  };

  // ---------- home: show budget and RSVP numbers on the event record ----------
  A.hub = function (v) {
    var n = function (k) { return Q.byKind(k).length + ' total'; }, open = Q.tools.open;
    Q.tools.hubGroup(v, 'Planning', [['Events', n('event'), open('event')], ['Clients', n('client'), open('client')], ['Tasks', n('task'), open('task')], ['Day-of schedule', n('timeline'), open('timeline')]]);
    Q.tools.hubGroup(v, 'People', [['Guests', n('guest'), open('guest')], ['Vendors', n('vendor'), open('vendor')], ['Vendor bookings and budget', n('booking'), open('booking')]]);
    Q.tools.hubGroup(v, 'Finances', [['Invoices', n('invoice'), open('invoice')], ['Budget and RSVP overview', 'Per event totals', function () { Q.S.tab = 'overview'; Q.render(); }]]);
  };

  // ---------- budget and RSVP overview (one card per upcoming event) ----------
  function overview(v) {
    v.appendChild(el('h2', '', 'Budget and RSVP overview'));
    var evs = Q.byKind('event').filter(function (e) { return e.status !== 'Cancelled' && e.status !== 'Done'; }).sort(function (a, b) { return (a.date || '9999') < (b.date || '9999') ? -1 : 1; });
    if (!evs.length) { v.appendChild(el('div', 'empty', 'Add an event to see its budget and RSVP numbers here.')); return; }
    evs.forEach(function (e) {
      var c = el('div', 'card'), sp = spent(e.id), g = Q.byKind('guest').filter(function (x) { return x.event === e.id; }), yes = 0, no = 0, pend = 0;
      g.forEach(function (x) { var n = +x.party || 1; if (x.rsvp === 'Attending') yes += n; else if (x.rsvp === 'Declined') no += n; else pend += n; });
      var tasks = Q.byKind('task').filter(function (t) { return t.event === e.id; }), done = tasks.filter(function (t) { return t.status === 'Done'; }).length;
      var h = el('b', '', Q.title(e)); h.style.display = 'block'; c.appendChild(h);
      c.appendChild(el('div', 'hint', [e.date ? fmt(e.date) : 'No date yet', e.venue].filter(Boolean).join(' · ')));
      c.appendChild(el('div', '', 'Booked ' + money(sp) + (e.budget ? ' of ' + money(e.budget) + ' (' + (sp > e.budget ? money(sp - e.budget) + ' over' : money(e.budget - sp) + ' left') + ')' : '')));
      c.appendChild(el('div', '', 'Guests: ' + yes + ' attending, ' + no + ' declined, ' + pend + ' waiting' + (e.guests ? ' (expecting ' + e.guests + ')' : '')));
      c.appendChild(el('div', '', 'Tasks: ' + done + ' of ' + tasks.length + ' done'));
      var b = el('button', 'btn ghost sm', 'Open event'); b.type = 'button'; b.style.marginTop = '8px'; b.onclick = function () { Q.openForm('event', e); }; c.appendChild(b);
      v.appendChild(c);
    });
  }

  // ---------- two looks: elegant wedding theme (wedding.css) or the standard Vyqil look ----------
  function applyStyle(s) {
    var wed = s === 'wedding'; document.documentElement.classList.toggle('wed', wed);
    var l = document.getElementById('vqWed');
    if (wed && !l) { l = document.createElement('link'); l.id = 'vqWed'; l.rel = 'stylesheet'; l.href = 'wedding.css'; document.head.appendChild(l); }
    if (!wed && l && l.parentNode) l.parentNode.removeChild(l);
    var m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', wed ? '#FBF8F2' : '#05070A');
    try { localStorage.setItem('vq_events_style', s || ''); } catch (e) { /* optional */ }
  }
  try { applyStyle(localStorage.getItem('vq_events_style') || ''); } catch (e) { /* optional */ }
  function chooseStyle(first) {
    Q.modal(function (s, close) {
      s.appendChild(el('h3', '', first ? 'What kind of planner are you?' : 'Choose your look'));
      s.appendChild(el('p', 'hint', 'This sets how the app looks for your whole team. You can change it any time from the menu.'));
      [['wedding', 'Wedding planner', 'Formal and elegant: ivory, white and gold with classic serif type.'], ['party', 'Party and event planner', 'The standard Vyqil look: dark and modern.']].forEach(function (o) {
        var b = el('button', 'btn ghost'); b.type = 'button'; b.style.cssText = 'display:block;width:100%;margin:8px 0;text-align:left'; b.appendChild(el('b', '', o[1])); var sp = el('div', 'hint', o[2]); sp.style.marginTop = '4px'; b.appendChild(sp);
        b.onclick = function () { applyStyle(o[0]); try { Q.S.biz.eventStyle = o[0]; Q.db.collection('businesses').doc(Q.S.biz.id).update({ eventStyle: o[0] }); } catch (e) { /* the look still applies on this device */ } close(); };
        s.appendChild(b);
      });
      if (!first) { var c = el('button', 'btn ghost', 'Cancel'); c.type = 'button'; c.onclick = close; s.appendChild(c); }
    });
  }
  A.fn.style = function () { chooseStyle(false); };

  function boot() {
    Q.views.overview = overview;
    Q.onStart.push(function () {
      var b = Q.S.biz || {};
      if (b.eventStyle) applyStyle(b.eventStyle);
      else if (b.role === 'owner') { var tries = 0, tm = setInterval(function () { tries++; if (tries > 50) { clearInterval(tm); return; } if (!Q.S.loaded) return; clearInterval(tm); setTimeout(function () { if (!document.querySelector('.modal') && !(Q.S.biz && Q.S.biz.eventStyle)) chooseStyle(true); }, 400); }, 400); }
    });
    Q.extras = Q.extras || [];
    Q.extras.push(function (v) { if (Q.tools && Q.tools.profileCard) Q.tools.profileCard(v); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

// Menu, quick buttons and starter checklist.
(function () {
  var A = window.VQ_APP;
  A.menu = function () {
    var F = A.fn || {};
    return [
      { h: 'Planning', items: [{ l: 'Events', tab: 'event' }, { l: 'Clients', tab: 'client' }, { l: 'Tasks', tab: 'task' }, { l: 'Day-of schedule', tab: 'timeline' }] },
      { h: 'People', items: [{ l: 'Guests', tab: 'guest' }, { l: 'Vendors', tab: 'vendor' }, { l: 'Vendor bookings and budget', tab: 'booking' }] },
      { h: 'Finances', items: [{ l: 'Invoices', tab: 'invoice' }, { l: 'Budget and RSVP overview', tab: 'overview' }, { l: 'Pay with Vyqil setup', run: function () { var p = Q.payMenu()[0]; if (p) p.run(); } }] },
      { h: 'Look', items: [{ l: 'Choose wedding or party look', run: function () { F.style && F.style(); } }] }
    ];
  };
  A.quick = [{ l: 'New client', form: 'client' }, { l: 'New event', form: 'event' }, { l: 'New task', form: 'task' }];
  A.starter = function () {
    return [
      { id: 'client', t: 'First, add a client', h: 'Name, partner, phone and email.', kind: 'client', form: 'client' },
      { id: 'event', t: 'Create their event', h: 'Date, venue, guest count and budget. Then add the planning checklist inside it.', kind: 'event', form: 'event' },
      { id: 'vendor', t: 'Add your vendors', h: 'Venues, caterers, photographers and more, so you can book them on events.', kind: 'vendor', form: 'vendor' },
      { id: 'book', t: 'Book a vendor on an event', h: 'Track cost, deposit and the next payment date.', kind: 'booking', form: 'booking' },
      { id: 'guest', t: 'Start the guest list', h: 'RSVPs, meal choices and tables.', kind: 'guest', form: 'guest' },
      { id: 'inv', t: 'Send your first invoice', h: 'Planning fee or deposit.', kind: 'invoice', form: 'invoice' },
      { id: 'cinv', t: 'Invite clients to their portal', h: 'Open a client and send the portal link so they can see invoices.', manual: true, run: function () { if (Q.portalInviteAll) Q.portalInviteAll(); } },
      { id: 'comm', t: 'Set up Vyqil Community', h: 'Be found by nearby Vyqil businesses, and find them.', manual: true, run: function () { if (Q.community) Q.community.listing(); } },
      { id: 'alerts', t: 'Turn on phone alerts', h: 'Get event, task and payment alerts when the app is closed.', manual: true, run: function () { Q.push.panel(); } }
    ];
  };
})();

// Client portal: clients see their invoices and can request appointments (consultations, tastings).
window.VQ_APP.portal = { kind: 'client', invoices: function (c, recs) {
  return recs.filter(function (r) { return r.kind === 'invoice' && r.client === c.id && r.status !== 'Void'; }).sort(function (a, b) { return (a.date || '') < (b.date || '') ? 1 : -1; }).map(function (r) { return { n: String(r.number || ''), t: 'Invoice', a: r.amount || 0, s: r.status || '', d: r.due || r.date || '' }; });
} };

// Pay with Vyqil: clients can pay invoices by QR code in dollar coins.
(function () {
  var A = window.VQ_APP;
  A.pay = { items: [
    { kind: 'invoice', contact: function (r) { var c = r.client ? Q.get(r.client) : null; return c ? { phone: c.phone, email: c.email } : {}; }, label: function (r) { return 'Invoice' + (r.number ? ' #' + r.number : ''); }, show: function (r) { return r.status !== 'Paid' && r.status !== 'Void'; },
      onPaid: async function (r, found, req) {
        var cur = Q.get(r.id); if ((cur && cur.status === 'Paid') || (cur && cur.paySig === found.signature)) throw { code: 'vq/already' };
        await Q.recs().doc(r.id).update({ status: 'Paid', paidOn: Q.u.today(), paySig: found.signature, payNote: ('Pay with Vyqil, USDC' + (req.net === 'mainnet' ? '' : ' (TEST)')).slice(0, 80), updatedAt: Q.FV.serverTimestamp() });
      } }
  ] };
})();
