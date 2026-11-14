window.VQ_APP = {
  community: { product: 'auto', inbound: { addKind: 'customer', addLabel: 'Add as customer', inboxTitle: 'Requests near you', listTitle: 'My shop in the community', catLabel: 'What you offer' } },
  id: 'auto', name: 'VyqilAuto', who: 'For auto repair and detailing shops', tag: 'Customers, vehicles, repair orders and service reminders.', alertText: 'pickups, promised dates and customers due for service',
  tabKinds: ['order', 'vehicle', 'customer'],
  kinds: {
    customer: { label: 'Customer', plural: 'Customers', icon: '👤', fields: [{ k: 'name', l: 'Name', t: 'text', req: 1 }, { k: 'phone', l: 'Phone', t: 'tel' }, { k: 'email', l: 'Email', t: 'email' }, { k: 'notes', l: 'Notes', t: 'area' }] },
    vehicle: { label: 'Vehicle', plural: 'Vehicles', icon: '🚗', title: function (r) { return [r.year, r.make, r.model].filter(Boolean).join(' ') || 'Vehicle'; },
      fields: [{ k: 'owner', l: 'Owner', t: 'link', to: 'customer' }, { k: 'year', l: 'Year', t: 'number' }, { k: 'make', l: 'Make', t: 'text', req: 1 }, { k: 'model', l: 'Model', t: 'text' }, { k: 'plate', l: 'Plate', t: 'text' }, { k: 'vin', l: 'VIN', t: 'text' }, { k: 'miles', l: 'Mileage', t: 'number' },
        { k: 'serviceDue', l: 'Next service due', t: 'date', cal: 1, alert: { hour: 9 }, lbl: 'Service due' }, { k: 'notes', l: 'Notes', t: 'area' }], sub: function (r) { return [r.plate, r.owner ? Q.title(Q.get(r.owner)) : ''].filter(Boolean).join(' · '); } },
    order: { label: 'Repair order', plural: 'Repair orders', icon: '🔧', stage: 'status', closed: function (r) { return r.status === 'Picked up' || r.status === 'Cancelled'; },
      title: function (r) { return (r.vehicle ? Q.title(Q.get(r.vehicle)) : 'Order') + (r.number ? ' #' + r.number : ''); },
      fields: [{ k: 'vehicle', l: 'Vehicle', t: 'link', to: 'vehicle', req: 1 }, { k: 'number', l: 'Order number', t: 'text' }, { k: 'status', l: 'Status', t: 'select', o: ['Estimate', 'Approved', 'In progress', 'Waiting on parts', 'Ready', 'Picked up', 'Cancelled'], req: 1 }, { k: 'work', l: 'Work requested', t: 'area' },
        { k: 'dropOff', l: 'Drop-off date', t: 'date' }, { k: 'promised', l: 'Promised by', t: 'date', cal: 1, alert: { hour: 8 }, lbl: 'Promised' }, { k: 'parts', l: 'Parts', t: 'money' }, { k: 'labor', l: 'Labor', t: 'money' },
        { k: 'total', l: 'Total', t: 'calc', fmt: 'money', f: function (r) { return (r.parts || 0) + (r.labor || 0); } }, { k: 'paid', l: 'Paid', t: 'check' }, { k: 'nextMiles', l: 'Next service (miles)', t: 'number' }, { k: 'nextDate', l: 'Next service date', t: 'date', hint: 'Saving this sets the vehicle reminder.' }, { k: 'notes', l: 'Notes', t: 'area' }],
      amount: function (r) { return (r.parts || 0) + (r.labor || 0) || ''; }, sub: function (r) { return r.promised ? 'Promised ' + Q.u.fmtDate(r.promised) : ''; } }
  },
  events: function (rs) { var out = []; rs.forEach(function (o) { if (o.kind === 'order' && o.nextDate && o.vehicle && Q.u.isDate(o.nextDate)) { var v = Q.get(o.vehicle); if (v && v.serviceDue !== o.nextDate) out.push({ date: o.nextDate, label: 'Next service', title: Q.title(v), rec: o, kind: 'order', alert: { hour: 9 }, key: 'ns' }); } }); return out; },
  stats: [{ l: 'In the shop', fn: function (rs) { return rs.filter(function (r) { return r.kind === 'order' && ['Approved', 'In progress', 'Waiting on parts', 'Ready'].indexOf(r.status) > -1; }).length; } },
    { l: 'Ready for pickup', fn: function (rs) { return rs.filter(function (r) { return r.kind === 'order' && r.status === 'Ready'; }).length; } },
    { l: 'Unpaid', fn: function (rs) { var s = 0; rs.forEach(function (r) { if (r.kind === 'order' && !r.paid && r.status !== 'Cancelled' && r.status !== 'Estimate') s += (r.parts || 0) + (r.labor || 0); }); return Q.u.money(s); } }],
  watch: [{ l: 'Ready: customer waiting', fn: function (rs) { return rs.filter(function (r) { return r.kind === 'order' && r.status === 'Ready'; }); }, sub: function (r) { return r.number ? '#' + r.number : ''; } }]
};
