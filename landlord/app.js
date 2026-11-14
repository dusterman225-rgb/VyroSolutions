window.VQ_APP = {
  id: 'landlord', name: 'VyqilLandlord', who: 'For landlords and property managers', tag: 'Properties, tenants, rent and repairs.', alertText: 'rent due dates, lease ends and repair visits',
  tabKinds: ['tenant', 'repair', 'unit'],
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
      fields: [{ k: 'issue', l: 'What is wrong', t: 'text', req: 1 }, { k: 'unit', l: 'Unit', t: 'link', to: 'unit' }, { k: 'trade', l: 'Type of work', t: 'select', o: ['Plumbing', 'Electrical', 'HVAC (heating and cooling)', 'Roofing', 'Painting', 'Flooring', 'Carpentry', 'Appliance repair', 'Handyman / general repair', 'Locksmith', 'Pest control', 'Landscaping and trees', 'Cleaning and turnover', 'Windows and doors', 'Other'] }, { k: 'status', l: 'Status', t: 'select', o: ['New', 'Scheduled', 'Waiting on parts', 'Done'], req: 1 }, { k: 'urgent', l: 'Urgent', t: 'check' }, { k: 'visit', l: 'Visit date', t: 'date', cal: 1, alert: { hour: 8 }, lbl: 'Repair visit' }, { k: 'vendor', l: 'Who is fixing it', t: 'text' }, { k: 'cost', l: 'Cost', t: 'money' }, { k: 'notes', l: 'Notes', t: 'area' }],
      title: function (r) { return (r.urgent ? '[Urgent] ' : '') + r.issue; }, sub: function (r) { return r.unit ? Q.title(Q.get(r.unit)) : ''; }, amount: function (r) { return r.cost || ''; },
      actions: [{ l: 'Find VyqilContractor', saveFirst: true, run: function (r) { Q.community.find(r, { target: 'contractor', cat: r.trade, title: r.issue, details: r.notes, urgent: r.urgent }); } }, { l: 'See contractor replies', show: function (r) { return !!r.cid; }, run: function (r) { Q.community.requests(r.cid); } }] }
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

// Community: find a contractor, cleaner or realtor from your records, and receive rental requests from realtors.
(function () {
  var A = window.VQ_APP;
  function propOf(r) { if (!r) return null; if (r.kind === 'property') return r; var u = r.kind === 'unit' ? r : (r.unit ? Q.get(r.unit) : null); return u && u.property ? Q.get(u.property) : null; }
  A.community = { product: 'landlord', place: propOf,
    fallback: function () { var p = Q.byKind('property').filter(function (x) { return x.lat != null; })[0]; return p ? { lat: p.lat, lng: p.lng, city: p.loc || p.city || 'Your area' } : null; },
    chosen: { contractor: function (rec, o) { if (rec.kind !== 'repair') return null; var up = { vendor: o.bizName }; if (rec.status === 'New') up.status = 'Scheduled'; return up; } },
    inbound: { addKind: 'applicant', addLabel: 'Add as applicant', inboxTitle: 'Rental requests from realtors', listTitle: 'My rentals in the community', catLabel: 'Kinds of rentals you offer',
      listHelp: 'Realtors and other Vyqil businesses near you can send you people who need a rental. Vyqil uses the place you set, not live tracking. Only the town and an approximate point are saved.' } };
  A.kinds.applicant = { label: 'Applicant', plural: 'Applicants', icon: '📝', stage: 'status', closed: function (r) { return r.status === 'Declined' || r.status === 'Moved in'; },
    fields: [{ k: 'name', l: 'Name', t: 'text', req: 1 }, { k: 'status', l: 'Status', t: 'select', o: ['New', 'Contacted', 'Viewing', 'Approved', 'Moved in', 'Declined'], req: 1 }, { k: 'phone', l: 'Phone', t: 'tel' }, { k: 'email', l: 'Email', t: 'email' },
      { k: 'looking', l: 'Looking for', t: 'text' }, { k: 'budget', l: 'Monthly budget', t: 'money' }, { k: 'moveIn', l: 'Wants to move in', t: 'date', cal: 1, alert: { hour: 9 }, lbl: 'Applicant move-in', doneIf: function (r) { return r.status === 'Declined' || r.status === 'Moved in'; } }, { k: 'notes', l: 'Notes', t: 'area' }],
    show: ['phone', 'looking'] };
  A.kinds.unit.actions = [
    { l: 'Find a cleaner for this unit', run: function (r) { Q.community.find(r, { target: 'services', cat: 'Move-out and turnover cleaning', title: 'Clean ' + (r.name || 'a unit') }); } },
    { l: 'Find a realtor to rent it', show: function (r) { return r.status !== 'Occupied'; }, run: function (r) { Q.community.find(r, { target: 'realtor', cat: 'Lease a vacant unit', title: 'Find a tenant for ' + (r.name || 'a unit') }); } }];
})();

// Landlord operations: late fees, receipts, lease renewal, finishing repairs with cost, and the tenant portal.
(function () {
  var A = window.VQ_APP, K = A.kinds, u = null;
  function U() { return u || (u = Q.u); }
  function ymOf(d) { return U().ymd(d).slice(0, 7); }
  function cents(s) { var t = String(s || '').replace(/[$,\s]/g, ''); if (!/^\d*\.?\d{0,2}$/.test(t) || t === '' || t === '.') return null; return Math.round(parseFloat(t) * 100); }
  function fld(s, label, input, hint) { var w = U().el('div'); w.appendChild(U().el('label', 'f', label)); w.appendChild(input); if (hint) w.appendChild(U().el('div', 'hint', hint)); s.appendChild(w); return input; }
  function inp(type, val, ph) { var i = U().el('input'); i.type = type; i.value = val == null ? '' : val; if (ph) i.placeholder = ph; return i; }
  function sel(opts, val) { var s = U().el('select'); opts.forEach(function (o) { var p = U().el('option', '', o); p.value = o; s.appendChild(p); }); if (val) s.value = val; return s; }
  function money(c) { return U().money(c); }
  function isActive(t) { return t.kind === 'tenant' && t.status !== 'Moved out'; }
  function paidFor(rs, t, ym) { return rs.some(function (p) { return p.kind === 'payment' && p.tenant === t.id && (p.forMonth === ym || (!p.forMonth && (p.date || '').slice(0, 7) === ym)); }); }
  // Months (this one and last) where rent is past its due day plus grace days and no payment is logged.
  function overdueOf(t, rs) {
    var out = []; if (!isActive(t) || !t.rent) return out; var now = new Date(), day = Math.min(28, Math.max(1, +t.dueDay || 1)), grace = Math.max(0, +t.graceDays || 0), td = U().today();
    for (var m = -1; m <= 0; m++) {
      var d = new Date(now.getFullYear(), now.getMonth() + m, day), ds = U().ymd(d), ym = ds.slice(0, 7);
      if (t.leaseStart && ym < t.leaseStart.slice(0, 7)) continue;
      if (U().diff(td, ds) > grace && !paidFor(rs, t, ym)) out.push({ ym: ym, due: ds, days: U().diff(td, ds), fee: t.lateFee || 0 });
    }
    return out;
  }
  function monthName(ym) { var p = ym.split('-'); return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][+p[1] - 1] + ' ' + p[0]; }
  function bizName() { return (Q.S.biz && Q.S.biz.name) || 'Your landlord'; }
  function copyText(text, shareTitle) { if (navigator.share) { navigator.share({ title: shareTitle, text: text }).catch(function () { /* cancelled */ }); return; } try { navigator.clipboard.writeText(text).then(function () { Q.toast('Copied.'); }, function () { Q.toast('Press and hold the text to copy it.'); }); } catch (e) { Q.toast('Press and hold the text to copy it.'); } }
  function showText(title, text) {
    Q.modal(function (s, close) {
      s.appendChild(U().el('h3', '', title)); var ta = U().el('textarea'); ta.value = text; ta.rows = 9; s.appendChild(ta);
      var b = U().el('div', 'btns'), c = U().el('button', 'btn', navigator.share ? 'Share' : 'Copy'), x = U().el('button', 'btn ghost', 'Close'); c.type = x.type = 'button'; c.onclick = function () { copyText(ta.value, title); }; x.onclick = close; b.appendChild(c); b.appendChild(x); s.appendChild(b);
    });
  }

  // ----- extra tenant fields: late fee, move-in and move-out checklist, deposit return
  var tf = K.tenant.fields, at = tf.length - 1; // keep Notes last
  var extra = [{ k: 'graceDays', l: 'Grace days after due day', t: 'number', hint: 'Rent is late after the due day plus these days. Leave empty for none.' }, { k: 'lateFee', l: 'Late fee', t: 'money', hint: 'A flat fee you charge when rent is late.' },
    { k: 'leaseSigned', l: 'Lease signed', t: 'check' }, { k: 'moveInDone', l: 'Move-in inspection done', t: 'check' }, { k: 'keysGiven', l: 'Keys given', t: 'check' },
    { k: 'finalInspection', l: 'Move-out inspection done', t: 'check' }, { k: 'keysBack', l: 'Keys returned', t: 'check' }, { k: 'depositBack', l: 'Deposit returned', t: 'money' }, { k: 'depositBackOn', l: 'Deposit returned on', t: 'date' }, { k: 'forwardAddr', l: 'Forwarding address', t: 'text' }];
  tf.splice.apply(tf, [at, 0].concat(extra));
  K.repair.fields.splice(K.repair.fields.length - 1, 0, { k: 'doneOn', l: 'Finished on', t: 'date' });
  K.tenant.sub = function (r, rs) {
    var bits = [r.unit ? Q.title(Q.get(r.unit)) : '', r.leaseEnd ? 'Lease ends ' + U().fmtDate(r.leaseEnd) : ''];
    var od = overdueOf(r, rs || Q.S.recs); if (od.length) bits.push('Rent late'); if (r.status === 'Moved out' && r.deposit && !r.depositBackOn) bits.push('Deposit to return');
    return bits.filter(Boolean).join(' · ');
  };
  K.property.sub = function (r, rs) {
    var ids = rs.filter(function (x) { return x.kind === 'unit' && x.property === r.id; }).map(function (x) { return x.id; }), n = ids.length, spent = 0;
    rs.forEach(function (x) { if (x.kind === 'repair' && x.status === 'Done' && x.cost && ids.indexOf(x.unit) >= 0) spent += x.cost; });
    return n + ' unit' + (n === 1 ? '' : 's') + (spent ? ' · ' + money(spent) + ' in repairs' : '');
  };

  // ----- calendar: also remind 60 days before each lease ends
  var baseEvents = A.events;
  A.events = function (rs, from, to) {
    var out = baseEvents(rs, from, to);
    rs.forEach(function (r) { if (!isActive(r) || !U().isDate(r.leaseEnd)) return; var d = U().addDays(r.leaseEnd, -60); if (d < from || d > to || d < U().today()) return; out.push({ date: d, label: 'Renewal decision', title: r.name + ' · lease ends in 60 days', rec: r, kind: 'tenant', alert: { hour: 9 }, key: 'renew' + r.leaseEnd }); });
    return out;
  };
  A.stats.push({ l: 'Rent overdue', fn: function (rs) { var n = 0, t = 0; rs.forEach(function (r) { var o = overdueOf(r, rs); if (o.length) { n++; o.forEach(function () { t += r.rent || 0; }); } }); return n ? n + ' · ' + money(t) : 'None'; } });
  A.watch.unshift({ l: 'Rent overdue', fn: function (rs) { return rs.filter(function (r) { return overdueOf(r, rs).length; }); }, sub: function (r) { var o = overdueOf(r, Q.S.recs), n = o[0]; return monthName(n.ym) + ' rent, ' + n.days + ' days late' + (r.lateFee ? ' · fee ' + money(r.lateFee) : ''); } });
  A.watch.push({ l: 'Leases ending in 60 days', fn: function (rs) { var t = U().today(); return rs.filter(function (r) { return isActive(r) && U().isDate(r.leaseEnd) && U().diff(r.leaseEnd, t) >= 0 && U().diff(r.leaseEnd, t) <= 60; }); }, sub: function (r) { return 'Ends ' + U().fmtDate(r.leaseEnd) + ' (' + U().rel(r.leaseEnd) + ')'; } });

  // ----- tenant actions
  function recordPayment(t) {
    var od = overdueOf(t, Q.S.recs)[0], defMonth = od ? od.ym : ymOf(new Date());
    Q.modal(function (s, close) {
      s.appendChild(U().el('h3', '', 'Record rent from ' + t.name));
      var am = fld(s, 'Amount received', inp('text', t.rent ? (t.rent / 100).toFixed(2) : '')), dt = fld(s, 'Date received', inp('date', U().today())), fm = fld(s, 'For month', inp('text', defMonth), 'Like 2026-11.'), me = fld(s, 'Method', sel(['Cash', 'Check', 'Bank transfer', 'Card', 'Crypto', 'Other'], 'Bank transfer'));
      var msg = U().el('div', 'err'), b = U().el('div', 'btns'), go = U().el('button', 'btn', 'Save payment'), x = U().el('button', 'btn ghost', 'Cancel'); go.type = x.type = 'button'; s.appendChild(msg); b.appendChild(go); b.appendChild(x); s.appendChild(b); x.onclick = close;
      go.onclick = function () {
        var c = cents(am.value); if (c === null || c <= 0) { msg.textContent = 'Enter the amount like 950.00.'; return; } if (!U().isDate(dt.value)) { msg.textContent = 'Pick the date received.'; return; } if (!/^\d{4}-\d{2}$/.test(fm.value.trim())) { msg.textContent = 'For month looks like 2026-11.'; return; }
        go.disabled = true;
        Q.recs().add({ kind: 'payment', tenant: t.id, amount: c, date: dt.value, forMonth: fm.value.trim(), method: me.value, by: (Q.S.user.email || '').split('@')[0].slice(0, 30), createdAt: Q.FV.serverTimestamp(), updatedAt: Q.FV.serverTimestamp() })
          .then(function () { close(); Q.toast('Payment recorded.'); setTimeout(syncAll, 1500); }, function (e) { go.disabled = false; msg.textContent = Q.friendly(e); });
      };
    });
  }
  function lastPayment(t) { return Q.S.recs.filter(function (p) { return p.kind === 'payment' && p.tenant === t.id; }).sort(function (a, b) { return (a.date || '') < (b.date || '') ? 1 : -1; })[0]; }
  function receiptOrReminder(t) {
    Q.modal(function (s, close) {
      s.appendChild(U().el('h3', '', 'Message for ' + t.name));
      var first = (t.name || 'there').split(/\s+/)[0], unit = t.unit ? Q.title(Q.get(t.unit)) : '';
      var r1 = U().el('button', 'btn', 'Receipt for the last payment'), r2 = U().el('button', 'btn ghost', 'Rent reminder'), x = U().el('button', 'btn ghost', 'Close'); r1.type = r2.type = x.type = 'button';
      r1.onclick = function () { var p = lastPayment(t); if (!p) { Q.toast('No payment recorded for ' + t.name + ' yet.'); return; } close(); showText('Rent receipt', 'RENT RECEIPT\n\nReceived from: ' + t.name + (unit ? '\nUnit: ' + unit : '') + '\nAmount: ' + money(p.amount) + '\nDate received: ' + U().fmtDate(p.date) + '\nFor: ' + (p.forMonth ? monthName(p.forMonth) : 'rent') + '\nMethod: ' + (p.method || '') + '\n\nThank you.\n' + bizName()); };
      r2.onclick = function () { close(); var o = overdueOf(t, Q.S.recs), day = Math.min(28, Math.max(1, +t.dueDay || 1)); var txt = o.length ? 'Hi ' + first + ',\n\nOur records show ' + monthName(o[0].ym) + ' rent of ' + money(t.rent) + ' was due on ' + U().fmtDate(o[0].due) + ' and has not been received.' + (t.lateFee ? ' A late fee of ' + money(t.lateFee) + ' applies.' : '') + ' Please send it as soon as you can, or reply if you already did.\n\nThank you,\n' + bizName() : 'Hi ' + first + ',\n\nA friendly reminder that rent of ' + money(t.rent) + ' is due on day ' + day + ' of each month.\n\nThank you,\n' + bizName(); showText('Rent reminder', txt); };
      s.appendChild(r1); s.appendChild(r2); s.appendChild(x); x.onclick = close;
    });
  }
  function renewLease(t) {
    Q.modal(function (s, close) {
      s.appendChild(U().el('h3', '', 'Renew the lease for ' + t.name));
      var from = U().isDate(t.leaseEnd) ? U().addDays(t.leaseEnd, 1) : U().today(), mo = fld(s, 'Months', sel(['6', '12', '18', '24'], '12')), rent = fld(s, 'Monthly rent', inp('text', t.rent ? (t.rent / 100).toFixed(2) : ''), 'Change it if the rent goes up.');
      s.appendChild(U().el('div', 'hint', 'New lease starts ' + U().fmtDate(from) + '.')); var msg = U().el('div', 'err'), b = U().el('div', 'btns'), go = U().el('button', 'btn', 'Renew'), x = U().el('button', 'btn ghost', 'Cancel'); go.type = x.type = 'button'; s.appendChild(msg); b.appendChild(go); b.appendChild(x); s.appendChild(b); x.onclick = close;
      go.onclick = function () { var c = cents(rent.value); if (c === null || c <= 0) { msg.textContent = 'Enter the rent like 950.00.'; return; } var d = U().parse(from); d.setMonth(d.getMonth() + (+mo.value)); d.setDate(d.getDate() - 1); go.disabled = true;
        Q.recs().doc(t.id).update({ leaseStart: from, leaseEnd: U().ymd(d), rent: c, status: 'Current', leaseSigned: false, updatedAt: Q.FV.serverTimestamp() }).then(function () { close(); Q.toast('Lease renewed to ' + U().fmtDate(U().ymd(d)) + '.'); setTimeout(syncAll, 1500); }, function (e) { go.disabled = false; msg.textContent = Q.friendly(e); }); };
    });
  }
  K.tenant.actions = [
    { l: 'Record rent payment', show: isActive, run: recordPayment },
    { l: 'Receipt or rent reminder', run: receiptOrReminder },
    { l: 'Renew lease', show: isActive, run: renewLease },
    { l: 'Invite to tenant portal', show: function (r) { return !r.portalId; }, run: function (r) { invite(r); } },
    { l: 'Update tenant portal now', show: function (r) { return !!r.portalId; }, run: function (r) { syncOne(r, true).then(function () { Q.toast('Tenant portal updated.'); }, function (e) { Q.toast(Q.friendly(e)); }); } },
    { l: 'Tenant portal link', show: function (r) { return !!r.portalId; }, run: function (r) { shareLink(r); } }
  ];
  K.repair.actions.push({ l: 'Mark done and record cost', show: function (r) { return r.status !== 'Done'; }, run: function (r) {
    Q.modal(function (s, close) {
      s.appendChild(U().el('h3', '', 'Finish: ' + r.issue)); var co = fld(s, 'What it cost', inp('text', r.cost ? (r.cost / 100).toFixed(2) : '')), dt = fld(s, 'Finished on', inp('date', U().today())), ve = fld(s, 'Who fixed it', inp('text', r.vendor || ''));
      var msg = U().el('div', 'err'), b = U().el('div', 'btns'), go = U().el('button', 'btn', 'Mark done'), x = U().el('button', 'btn ghost', 'Cancel'); go.type = x.type = 'button'; s.appendChild(msg); b.appendChild(go); b.appendChild(x); s.appendChild(b); x.onclick = close;
      go.onclick = function () { var c = co.value.trim() === '' ? 0 : cents(co.value); if (c === null) { msg.textContent = 'Enter the cost like 125.50, or leave it empty.'; return; } go.disabled = true;
        Q.recs().doc(r.id).update({ status: 'Done', cost: c || null, doneOn: dt.value || U().today(), vendor: ve.value.trim().slice(0, 80), updatedAt: Q.FV.serverTimestamp() }).then(function () { close(); Q.toast('Repair done.'); }, function (e) { go.disabled = false; msg.textContent = Q.friendly(e); }); };
    });
  } });

  // ----- tenant portal: a login for the tenant, a copy of their rent info, and repair requests that come back to you
  function portalBase() { return location.origin + location.pathname.replace(/[^\/]*$/, '') + 'tenant.html'; }
  function portalData(t) {
    var unit = t.unit ? Q.get(t.unit) : null, led = Q.S.recs.filter(function (p) { return p.kind === 'payment' && p.tenant === t.id; }).sort(function (a, b) { return (a.date || '') < (b.date || '') ? 1 : -1; }).slice(0, 12).map(function (p) { return { m: p.forMonth || (p.date || '').slice(0, 7), a: p.amount || 0, d: p.date || '', y: p.method || '' }; });
    return { bizId: Q.S.biz.id, recId: t.id, tenantEmail: String(t.email || '').trim().toLowerCase(), tenantName: String(t.name || '').slice(0, 80), unit: unit ? Q.title(unit).slice(0, 120) : '', rent: t.rent || 0, dueDay: Math.min(28, Math.max(1, +t.dueDay || 1)), lateFee: t.lateFee || 0, graceDays: +t.graceDays || 0, landlordName: bizName().slice(0, 80), landlordPhone: String((Q.S.biz && Q.S.biz.phone) || '').slice(0, 30), ledger: led };
  }
  function hashOf(d) { return JSON.stringify(d); }
  function syncOne(t, force) {
    var d = portalData(t); if (!t.portalId || !d.tenantEmail) return Promise.resolve();
    var key = 'vq_tp_' + t.portalId, h = hashOf(d); try { if (!force && localStorage.getItem(key) === h) return Promise.resolve(); } catch (e) { /* optional */ }
    d.updatedAt = Q.FV.serverTimestamp();
    return Q.db.collection('tenantPortals').doc(t.portalId).set(d).then(function () { try { localStorage.setItem(key, h); } catch (e) { /* optional */ } });
  }
  function syncAll() { if (!Q.S.biz) return; Q.S.recs.forEach(function (r) { if (r.kind === 'tenant' && r.portalId && isActive(r)) syncOne(r).catch(function () { /* try again later */ }); }); }
  function randomPassword() { var a = new Uint8Array(24); crypto.getRandomValues(a); var s = ''; for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s).replace(/[^A-Za-z0-9]/g, 'x') + 'Aa1!'; }
  async function makeLogin(email) {
    var app = firebase.initializeApp(window.VYRO_FIREBASE_CONFIG, 'tenant-' + Date.now()), res = { existing: false, emailed: false, error: '' };
    try {
      var a = app.auth(); await a.setPersistence(firebase.auth.Auth.Persistence.NONE);
      try { await a.createUserWithEmailAndPassword(email, randomPassword()); } catch (e) { if (!e || e.code !== 'auth/email-already-in-use') throw e; res.existing = true; }
      if (!res.existing) { try { await a.sendPasswordResetEmail(email, { url: portalBase() }); } catch (e2) { await a.sendPasswordResetEmail(email); } res.emailed = true; }
      try { await a.signOut(); } catch (x) { /* ignore */ }
    } catch (e) { res.error = Q.friendly(e); }
    try { await app.delete(); } catch (x) { /* ignore */ }
    return res;
  }
  function shareLink(t) {
    var url = portalBase() + '?e=' + encodeURIComponent(String(t.email || '').trim().toLowerCase()), first = (t.name || 'there').split(/\s+/)[0];
    showText('Tenant portal link', 'Hi ' + first + ',\n\nYou can see your rent, your payment history and send me repair requests in your tenant portal:\n' + url + '\n\nSign in with your email and password. If you have not set a password yet, use the email we sent, or tap "Forgot your password?" on that page.\n\nThank you,\n' + bizName());
  }
  function invite(t) {
    var email = String(t.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { Q.toast('Add ' + (t.name || 'the tenant') + '\'s email first, then try again.'); return; }
    Q.ask('Create a tenant login for ' + email + ' and email them a link to set a password?', 'Invite', async function () {
      Q.toast('Inviting...'); var res = await makeLogin(email); if (res.error) { Q.toast(res.error); return; }
      var ref = Q.db.collection('tenantPortals').doc(), d = portalData(t); d.updatedAt = Q.FV.serverTimestamp();
      try { await ref.set(d); await Q.recs().doc(t.id).update({ portalId: ref.id, updatedAt: Q.FV.serverTimestamp() }); } catch (e) { Q.toast(Q.friendly(e)); return; }
      Q.toast(res.existing ? 'They already have a login. Send them the link.' : 'Invitation emailed.'); t.portalId = ref.id; shareLink(t);
    });
  }

  // ----- repair requests sent by tenants
  var reqCount = 0, reqs = [];
  function listenRequests() {
    if (!Q.S.biz || listenRequests.on) return; listenRequests.on = true;
    Q.db.collection('tenantRequests').where('bizId', '==', Q.S.biz.id).where('status', '==', 'new').onSnapshot(function (s) {
      var before = reqCount; reqs = s.docs.map(function (d) { var x = d.data(); x.id = d.id; return x; }); reqCount = reqs.length; if (reqCount > before) Q.toast(reqCount + ' tenant repair request' + (reqCount === 1 ? '' : 's') + ' waiting. See More > Tenant repair requests.');
    }, function () { /* optional */ });
  }
  function requestsModal() {
    Q.modal(function (s, close) {
      s.appendChild(U().el('h3', '', 'Tenant repair requests')); var body = U().el('div'); s.appendChild(body); var x = U().el('button', 'btn ghost', 'Close'); x.type = 'button'; x.onclick = close; s.appendChild(x);
      function draw() {
        body.textContent = ''; if (!reqs.length) { body.appendChild(U().el('p', 'hint', 'No new requests.')); return; }
        reqs.forEach(function (q) {
          var c = U().el('div', 'card'); c.appendChild(U().el('b', '', (q.urgent ? '[Urgent] ' : '') + q.issue)); c.appendChild(U().el('div', 'hint', q.tenantName + (q.unit ? ' · ' + q.unit : '') + (q.phone ? ' · ' + q.phone : ''))); if (q.details) c.appendChild(U().el('div', '', q.details));
          var b = U().el('div', 'btns'), mk = U().el('button', 'btn', 'Make a repair'), no = U().el('button', 'btn ghost', 'Dismiss'); mk.type = no.type = 'button'; b.appendChild(mk); b.appendChild(no); c.appendChild(b);
          mk.onclick = function () { mk.disabled = true; var t = Q.get(q.recId), data = { kind: 'repair', issue: q.issue.slice(0, 120), status: 'New', urgent: !!q.urgent, notes: ('From tenant ' + q.tenantName + (q.phone ? ' (' + q.phone + ')' : '') + (q.details ? '. ' + q.details : '')).slice(0, 900), by: 'tenant', createdAt: Q.FV.serverTimestamp(), updatedAt: Q.FV.serverTimestamp() }; if (t && t.unit) data.unit = t.unit;
            Q.recs().add(data).then(function (ref) { return Q.db.collection('tenantRequests').doc(q.id).update({ status: 'seen', repairId: ref.id }); }).then(function () { Q.toast('Repair created.'); }, function (e) { mk.disabled = false; Q.toast(Q.friendly(e)); }); };
          no.onclick = function () { no.disabled = true; Q.db.collection('tenantRequests').doc(q.id).update({ status: 'dismissed' }).catch(function (e) { no.disabled = false; Q.toast(Q.friendly(e)); }); };
          body.appendChild(c);
        });
      }
      draw(); var iv = setInterval(function () { if (!document.body.contains(s)) { clearInterval(iv); return; } draw(); }, 2000);
    });
  }
  function boot() {
    Q.extras.push(function (v) { v.appendChild(U().el('h2', '', 'Tenants')); var card = U().el('div', 'card'); v.appendChild(card); card.appendChild(U().el('div', 'hint', 'Invite a tenant from their tenant record. They sign in to see rent and payments and to send you repair requests.')); var b = U().el('button', 'btn ghost', 'Tenant repair requests' + (reqCount ? ' (' + reqCount + ' new)' : '')); b.type = 'button'; b.onclick = requestsModal; card.appendChild(b); });
    Q.onStart.push(function () { listenRequests(); setTimeout(syncAll, 6000); setInterval(syncAll, 45000); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
