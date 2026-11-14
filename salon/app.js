window.VQ_APP = {
  community: { product: 'salon', inbound: { addKind: 'client', addLabel: 'Add as client', inboxTitle: 'Requests near you', listTitle: 'My salon in the community', catLabel: 'What you offer' } },
  id: 'salon', name: 'VyqilSalon', who: 'For salons, barbers and spas', tag: 'Appointments, clients and rebooking.', alertText: 'appointments and clients due to rebook',
  tabKinds: ['appt', 'client', 'service'],
  kinds: {
    appt: { label: 'Appointment', plural: 'Appointments', icon: '📅', stage: 'status', closed: function (r) { return r.status === 'Done' || r.status === 'Cancelled' || r.status === 'No-show'; }, sort: function (a, b) { return ((a.date || '') + (a.time || '')) < ((b.date || '') + (b.time || '')) ? -1 : 1; },
      title: function (r) { return (r.client ? Q.title(Q.get(r.client)) : 'Appointment') + (r.service ? ' · ' + Q.title(Q.get(r.service)) : ''); },
      fields: [{ k: 'client', l: 'Client', t: 'link', to: 'client', req: 1 }, { k: 'service', l: 'Service', t: 'link', to: 'service' }, { k: 'date', l: 'Date', t: 'date', req: 1, cal: 1, alert: { before: 60 }, timeField: 'time', lbl: 'Appointment' }, { k: 'time', l: 'Time', t: 'time', req: 1 }, { k: 'staff', l: 'Stylist', t: 'text' },
        { k: 'status', l: 'Status', t: 'select', o: ['Booked', 'Done', 'Cancelled', 'No-show'], req: 1 }, { k: 'price', l: 'Price', t: 'money' }, { k: 'tip', l: 'Tip', t: 'money' }, { k: 'notes', l: 'Notes', t: 'area' }],
      sub: function (r) { return Q.u.fmtDate(r.date) + ' ' + Q.u.fmtTime(r.time) + (r.staff ? ' · ' + r.staff : ''); }, amount: function (r) { return r.price || ''; } },
    client: { label: 'Client', plural: 'Clients', icon: '👤', fields: [{ k: 'name', l: 'Name', t: 'text', req: 1 }, { k: 'phone', l: 'Phone', t: 'tel' }, { k: 'email', l: 'Email', t: 'email' }, { k: 'rebookEvery', l: 'Usually rebooks every (weeks)', t: 'number' },
        { k: 'formula', l: 'Color formula / preferences', t: 'area', hint: 'Only you can see this.' }, { k: 'allergies', l: 'Allergies or sensitivities', t: 'text' }, { k: 'birthday', l: 'Birthday', t: 'date', cal: 1, yearly: 1, alert: { hour: 9 }, lbl: 'Birthday' }, { k: 'notes', l: 'Notes', t: 'area' }],
      sub: function (r, rs) { var last = ''; rs.forEach(function (a) { if (a.kind === 'appt' && a.client === r.id && a.status === 'Done' && a.date > last) last = a.date; }); return last ? 'Last visit ' + Q.u.fmtDate(last) : r.phone || ''; } },
    service: { label: 'Service', plural: 'Services', icon: '✂️', fields: [{ k: 'name', l: 'Service', t: 'text', req: 1 }, { k: 'mins', l: 'Minutes', t: 'number' }, { k: 'price', l: 'Price', t: 'money' }], amount: function (r) { return r.price || ''; }, sub: function (r) { return r.mins ? r.mins + ' min' : ''; } }
  },
  stats: [{ l: 'Today', fn: function (rs, t) { return rs.filter(function (r) { return r.kind === 'appt' && r.date === t && r.status === 'Booked'; }).length + ' booked'; } },
    { l: 'This week booked', fn: function (rs, t) { var e = Q.u.addDays(t, 7); return rs.filter(function (r) { return r.kind === 'appt' && r.status === 'Booked' && r.date >= t && r.date <= e; }).length; } },
    { l: 'Revenue this month', fn: function (rs, t) { var m = t.slice(0, 7), s = 0; rs.forEach(function (r) { if (r.kind === 'appt' && r.status === 'Done' && (r.date || '').slice(0, 7) === m) s += (r.price || 0) + (r.tip || 0); }); return Q.u.money(s); } }],
  watch: [{ l: 'Due to rebook', fn: function (rs, t) { return rs.filter(function (c) { if (c.kind !== 'client' || !c.rebookEvery) return false; var last = '', next = false; rs.forEach(function (a) { if (a.kind === 'appt' && a.client === c.id) { if (a.status === 'Done' && a.date > last) last = a.date; if (a.status === 'Booked' && a.date >= t) next = true; } }); return !next && last && Q.u.diff(t, last) >= c.rebookEvery * 7; }); }, sub: function (r) { return 'Every ' + r.rebookEvery + ' weeks'; } }]
};
