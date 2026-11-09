window.VQ_APP = {
  id: 'services', name: 'VyqilServices', who: 'For cleaning, lawn and pool services', tag: 'Recurring customers, routes and invoices.', alertText: 'visits and unpaid invoices',
  tabKinds: ['visit', 'customer', 'invoice'],
  kinds: {
    customer: { label: 'Customer', plural: 'Customers', icon: '👤', stage: 'plan', closed: function (r) { return r.plan === 'Paused'; },
      fields: [{ k: 'name', l: 'Name', t: 'text', req: 1 }, { k: 'address', l: 'Address', t: 'text' }, { k: 'phone', l: 'Phone', t: 'tel' }, { k: 'email', l: 'Email', t: 'email' }, { k: 'plan', l: 'Plan', t: 'select', o: ['Weekly', 'Every 2 weeks', 'Monthly', 'One-time', 'Paused'], req: 1 }, { k: 'price', l: 'Price per visit', t: 'money' }, { k: 'day', l: 'Usual day', t: 'select', o: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] }, { k: 'access', l: 'Gate code / access notes', t: 'text' }, { k: 'notes', l: 'Notes', t: 'area' }],
      sub: function (r) { return [r.address, r.day].filter(Boolean).join(' · '); }, amount: function (r) { return r.price || ''; } },
    visit: { label: 'Visit', plural: 'Visits', icon: '🚚', stage: 'status', closed: function (r) { return r.status === 'Done' || r.status === 'Skipped'; }, sort: function (a, b) { return ((a.date || '') + (a.time || '')) < ((b.date || '') + (b.time || '')) ? -1 : 1; },
      title: function (r) { return r.customer ? Q.title(Q.get(r.customer)) : 'Visit'; },
      fields: [{ k: 'customer', l: 'Customer', t: 'link', to: 'customer', req: 1 }, { k: 'date', l: 'Date', t: 'date', req: 1, cal: 1, alert: { hour: 7 }, timeField: 'time', lbl: 'Visit' }, { k: 'time', l: 'Time', t: 'time' }, { k: 'status', l: 'Status', t: 'select', o: ['Scheduled', 'Done', 'Skipped'], req: 1 }, { k: 'price', l: 'Price', t: 'money' }, { k: 'notes', l: 'Notes', t: 'area' }],
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
