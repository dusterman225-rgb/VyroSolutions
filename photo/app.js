window.VQ_APP = {
  id: 'photo', name: 'VyqilPhoto', who: 'For photographers and videographers', tag: 'Bookings, deposits and delivery.', alertText: 'shoots, balances due and gallery deadlines',
  tabKinds: ['booking', 'client'],
  checklists: { shoot: [{ t: 'Contract signed', off: -30 }, { t: 'Deposit received', off: -28 }, { t: 'Shot list and timeline sent', off: -7 }, { t: 'Balance due', off: -3 }, { t: 'Charge batteries and clear cards', off: -1 }, { t: 'Backup photos', off: 1 }, { t: 'Preview sent', off: 7 }, { t: 'Gallery delivered', off: 21 }] },
  kinds: {
    client: { label: 'Client', plural: 'Clients', icon: '👤', stage: 'source', fields: [{ k: 'name', l: 'Name', t: 'text', req: 1 }, { k: 'phone', l: 'Phone', t: 'tel' }, { k: 'email', l: 'Email', t: 'email' }, { k: 'source', l: 'How they found you', t: 'select', o: ['Referral', 'Instagram', 'Website', 'Venue', 'Other'] }, { k: 'notes', l: 'Notes', t: 'area' }] },
    booking: { label: 'Booking', plural: 'Bookings', icon: '📷', stage: 'status', checklist: { tpl: 'shoot', name: 'shoot', base: 'date' }, closed: function (r) { return r.status === 'Delivered' || r.status === 'Cancelled'; }, sort: function (a, b) { return (a.date || '9') < (b.date || '9') ? -1 : 1; },
      title: function (r) { return (r.client ? Q.title(Q.get(r.client)) : 'Booking') + (r.type ? ' · ' + r.type : ''); },
      fields: [{ k: 'client', l: 'Client', t: 'link', to: 'client', req: 1 }, { k: 'type', l: 'Type of shoot', t: 'select', o: ['Wedding', 'Portrait', 'Family', 'Newborn', 'Event', 'Commercial', 'Video', 'Other'] }, { k: 'status', l: 'Status', t: 'select', o: ['Inquiry', 'Booked', 'Shot', 'Editing', 'Delivered', 'Cancelled'], req: 1 },
        { k: 'date', l: 'Shoot date', t: 'date', cal: 1, alert: { hour: 7, eve: 1 }, timeField: 'time', lbl: 'Shoot' }, { k: 'time', l: 'Start time', t: 'time' }, { k: 'place', l: 'Location', t: 'text' },
        { k: 'total', l: 'Package price', t: 'money' }, { k: 'deposit', l: 'Deposit paid', t: 'money' }, { k: 'balance', l: 'Balance', t: 'calc', fmt: 'money', f: function (r) { return Math.max(0, (r.total || 0) - (r.deposit || 0) - (r.paidRest ? Math.max(0, (r.total || 0) - (r.deposit || 0)) : 0)); } }, { k: 'paidRest', l: 'Balance paid', t: 'check' },
        { k: 'deliverBy', l: 'Gallery due', t: 'date', cal: 1, alert: { hour: 9 }, lbl: 'Gallery due', doneIf: function (r) { return r.status === 'Delivered'; } }, { k: 'notes', l: 'Notes', t: 'area' }],
      amount: function (r) { return r.total || ''; }, sub: function (r) { return r.date ? Q.u.fmtDate(r.date) : ''; } }
  },
  stats: [{ l: 'Upcoming shoots', fn: function (rs, t) { return rs.filter(function (r) { return r.kind === 'booking' && r.date >= t && r.status === 'Booked'; }).length; } },
    { l: 'To edit / deliver', fn: function (rs) { return rs.filter(function (r) { return r.kind === 'booking' && (r.status === 'Shot' || r.status === 'Editing'); }).length; } },
    { l: 'Balances owed', fn: function (rs) { var s = 0; rs.forEach(function (r) { if (r.kind === 'booking' && r.status !== 'Cancelled' && r.status !== 'Inquiry' && !r.paidRest) s += Math.max(0, (r.total || 0) - (r.deposit || 0)); }); return Q.u.money(s); } }],
  watch: [{ l: 'Balance owed', fn: function (rs) { return rs.filter(function (r) { return r.kind === 'booking' && r.status !== 'Cancelled' && r.status !== 'Inquiry' && !r.paidRest && (r.total || 0) > (r.deposit || 0); }); }, sub: function (r) { return Q.u.money((r.total || 0) - (r.deposit || 0)); } }]
};
