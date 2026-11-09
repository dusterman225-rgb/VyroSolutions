window.VQ_APP = {
  id: 'landlord', name: 'VyqilLandlord', who: 'For landlords and property managers', tag: 'Properties, tenants, rent and repairs.', alertText: 'rent due dates, lease ends and repair visits',
  tabKinds: ['unit', 'tenant', 'repair'],
  kinds: {
    property: { label: 'Property', plural: 'Properties', icon: '🏢', fields: [{ k: 'name', l: 'Name or address', t: 'text', req: 1 }, { k: 'city', l: 'City', t: 'text' }, { k: 'insuranceDue', l: 'Insurance renews', t: 'date', cal: 1, alert: { hour: 9 }, lbl: 'Insurance renews' }, { k: 'notes', l: 'Notes', t: 'area' }],
      sub: function (r, rs) { var n = rs.filter(function (x) { return x.kind === 'unit' && x.property === r.id; }).length; return n + ' unit' + (n === 1 ? '' : 's'); } },
    unit: { label: 'Unit', plural: 'Units', icon: '🚪', stage: 'status', fields: [{ k: 'name', l: 'Unit name', t: 'text', req: 1, h: 'Apt 2B' }, { k: 'property', l: 'Property', t: 'link', to: 'property' }, { k: 'status', l: 'Status', t: 'select', o: ['Occupied', 'Vacant', 'Turnover'], req: 1 }, { k: 'rent', l: 'Monthly rent', t: 'money' }, { k: 'notes', l: 'Notes', t: 'area' }],
      title: function (r) { return (r.property ? Q.title(Q.get(r.property)) + ' · ' : '') + r.name; }, amount: function (r) { return r.rent || ''; } },
    tenant: { label: 'Tenant', plural: 'Tenants', icon: '👤', stage: 'status', closed: function (r) { return r.status === 'Moved out'; }, sort: function (a, b) { return (a.leaseEnd || '9') < (b.leaseEnd || '9') ? -1 : 1; },
      fields: [{ k: 'name', l: 'Name', t: 'text', req: 1 }, { k: 'unit', l: 'Unit', t: 'link', to: 'unit' }, { k: 'status', l: 'Status', t: 'select', o: ['Current', 'Notice given', 'Moved out'], req: 1 }, { k: 'phone', l: 'Phone', t: 'tel' }, { k: 'email', l: 'Email', t: 'email' }, { k: 'rent', l: 'Monthly rent', t: 'money' }, { k: 'dueDay', l: 'Rent due day of month', t: 'number', d: 1, hint: '1 to 28.' },
        { k: 'leaseStart', l: 'Lease start', t: 'date' }, { k: 'leaseEnd', l: 'Lease ends', t: 'date', cal: 1, alert: { hour: 9 }, lbl: 'Lease ends', onlyIf: function (r) { return r.status !== 'Moved out'; } }, { k: 'deposit', l: 'Security deposit held', t: 'money' }, { k: 'notes', l: 'Notes', t: 'area' }],
      sub: function (r) { return [r.unit ? Q.title(Q.get(r.unit)) : '', r.leaseEnd ? 'Lease ends ' + Q.u.fmtDate(r.leaseEnd) : ''].filter(Boolean).join(' · '); }, amount: function (r) { return r.rent || ''; } },
    payment: { label: 'Rent payment', plural: 'Rent ledger', icon: '💵', stage: 'method', sort: function (a, b) { return (a.date || '') < (b.date || '') ? 1 : -1; },
      fields: [{ k: 'tenant', l: 'Tenant', t: 'link', to: 'tenant' }, { k: 'date', l: 'Date received', t: 'date', req: 1, d: '' }, { k: 'amount', l: 'Amount', t: 'money', req: 1 }, { k: 'forMonth', l: 'For month', t: 'text', h: '2026-11' }, { k: 'method', l: 'Method', t: 'select', o: ['Cash', 'Check', 'Bank transfer', 'Card', 'Crypto', 'Other'] }, { k: 'notes', l: 'Notes', t: 'area' }],
      title: function (r) { return (r.tenant ? Q.title(Q.get(r.tenant)) : 'Payment') + ' · ' + (r.forMonth || ''); }, amount: function (r) { return r.amount || 0; }, sub: function (r) { return Q.u.fmtDate(r.date); } },
    repair: { label: 'Repair request', plural: 'Repairs', icon: '🔧', stage: 'status', closed: function (r) { return r.status === 'Done'; },
      fields: [{ k: 'issue', l: 'What is wrong', t: 'text', req: 1 }, { k: 'unit', l: 'Unit', t: 'link', to: 'unit' }, { k: 'status', l: 'Status', t: 'select', o: ['New', 'Scheduled', 'Waiting on parts', 'Done'], req: 1 }, { k: 'urgent', l: 'Urgent', t: 'check' }, { k: 'visit', l: 'Visit date', t: 'date', cal: 1, alert: { hour: 8 }, lbl: 'Repair visit' }, { k: 'vendor', l: 'Who is fixing it', t: 'text' }, { k: 'cost', l: 'Cost', t: 'money' }, { k: 'notes', l: 'Notes', t: 'area' }],
      title: function (r) { return (r.urgent ? '[Urgent] ' : '') + r.issue; }, sub: function (r) { return r.unit ? Q.title(Q.get(r.unit)) : ''; }, amount: function (r) { return r.cost || ''; } }
  },
  // Rent due dates are worked out each month from each current tenant's due day, minus payments logged for that month.
  events: function (rs, from, to) {
    var out = [], u = Q.u, t = u.today(), now = new Date();
    rs.forEach(function (r) {
      if (r.kind !== 'tenant' || r.status === 'Moved out' || !r.rent) return; var day = Math.min(28, Math.max(1, +r.dueDay || 1));
      for (var m = -1; m <= 1; m++) { var d = new Date(now.getFullYear(), now.getMonth() + m, day), ds = u.ymd(d), ym = ds.slice(0, 7);
        if (ds < from || ds > to) continue;
        var paid = rs.some(function (p) { return p.kind === 'payment' && p.tenant === r.id && (p.forMonth === ym || (!p.forMonth && (p.date || '').slice(0, 7) === ym)); }); if (paid) continue;
        out.push({ date: ds, label: 'Rent due', title: r.name + ' ' + u.money(r.rent), rec: r, kind: 'tenant', alert: { hour: 9 }, key: 'rent' + ym }); }
    }); return out; },
  stats: [{ l: 'Occupied', fn: function (rs) { var u = rs.filter(function (r) { return r.kind === 'unit'; }); return u.filter(function (r) { return r.status === 'Occupied'; }).length + ' of ' + u.length; } },
    { l: 'Monthly rent roll', fn: function (rs) { var t = 0; rs.forEach(function (r) { if (r.kind === 'tenant' && r.status !== 'Moved out') t += r.rent || 0; }); return Q.u.money(t); } },
    { l: 'Open repairs', fn: function (rs) { return rs.filter(function (r) { return r.kind === 'repair' && r.status !== 'Done'; }).length; } }],
  watch: [{ l: 'Vacant units', fn: function (rs) { return rs.filter(function (r) { return r.kind === 'unit' && r.status !== 'Occupied'; }); }, sub: function (r) { return r.status; } }]
};
