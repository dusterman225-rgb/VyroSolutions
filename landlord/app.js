window.VQ_APP = {
  id: 'landlord', name: 'VyqilLandlord', who: 'For landlords and property managers', tag: 'Properties, tenants, rent and repairs.', alertText: 'rent due dates, lease ends and repair visits',
  tabKinds: ['tenant', 'repair', 'unit'],
  kinds: {
    property: { label: 'Property', plural: 'Properties', icon: '🏢', fields: [{ k: 'name', l: 'Name or address', t: 'text', req: 1, drop: 'Property details', dropOpenNew: true, dropClosed: true }, { k: 'city', l: 'City', t: 'text', drop: 'Property details', dropOpenNew: true, dropClosed: true }, { k: 'insuranceDue', l: 'Insurance renews', t: 'date', cal: 1, alert: { hour: 9 }, lbl: 'Insurance renews', drop: 'Property details', dropOpenNew: true, dropClosed: true }, { k: 'notes', l: 'Notes', t: 'area', drop: 'Property details', dropOpenNew: true, dropClosed: true }],
      actions: [{ l: 'New repair order', saveFirst: true, run: function (r) { Q.openForm('repair', null, { property: r.id, status: 'New' }); } }, { l: 'Add a unit', saveFirst: true, run: function (r) { Q.openForm('unit', null, { property: r.id, status: 'Vacant' }); } }],
      onSaved: function (r, prev) { if (prev && r.lat != null && (prev.name !== r.name || prev.city !== r.city)) Q.recs().doc(r.id).update({ lat: Q.FV.delete(), lng: Q.FV.delete(), loc: Q.FV.delete() }).catch(function () { /* looked up again next time */ }); },
      sub: function (r, rs) { var n = rs.filter(function (x) { return x.kind === 'unit' && x.property === r.id; }).length; return n + ' unit' + (n === 1 ? '' : 's'); } },
    unit: { label: 'Unit', plural: 'Units', icon: '🚪', stage: 'status', addMenu: ['unit', 'tenant', 'repair', 'property'], fields: [{ k: 'name', l: 'Unit name', t: 'text', req: 1, h: 'Apt 2B', drop: 'Unit information', dropClosed: true, dropIf: function (r) { return r.status === 'Occupied'; } }, { k: 'property', l: 'Property', t: 'link', to: 'property', drop: 'Unit information', dropClosed: true, dropIf: function (r) { return r.status === 'Occupied'; } }, { k: 'status', l: 'Status', t: 'select', o: ['Occupied', 'Vacant', 'Turnover'], req: 1, drop: 'Unit information', dropClosed: true, dropIf: function (r) { return r.status === 'Occupied'; } }, { k: 'rent', l: 'Monthly rent', t: 'money', drop: 'Unit information', dropClosed: true, dropIf: function (r) { return r.status === 'Occupied'; } }, { k: 'notes', l: 'Notes', t: 'area', drop: 'Unit information', dropClosed: true, dropIf: function (r) { return r.status === 'Occupied'; } }],
      title: function (r) { return (r.property ? Q.title(Q.get(r.property)) + ' · ' : '') + r.name; }, amount: function (r) { return r.rent || ''; } },
    tenant: { label: 'Tenant', plural: 'Tenants', icon: '👤', stage: 'status', closed: function (r) { return r.status === 'Moved out'; }, sort: function (a, b) { return (a.leaseEnd || '9') < (b.leaseEnd || '9') ? -1 : 1; },
      fields: [{ k: 'name', l: 'Name', t: 'text', req: 1 }, { k: 'unit', l: 'Unit', t: 'link', to: 'unit' }, { k: 'status', l: 'Status', t: 'select', o: ['Current', 'Notice given', 'Moved out'], req: 1 }, { k: 'phone', l: 'Phone', t: 'tel' }, { k: 'email', l: 'Email', t: 'email' }, { k: 'rent', l: 'Monthly rent', t: 'money' }, { k: 'dueDay', l: 'Rent due day of month', t: 'number', d: 1, hint: '1 to 28.' },
        { k: 'leaseStart', l: 'Lease start', t: 'date' }, { k: 'leaseEnd', l: 'Lease ends', t: 'date', cal: 1, alert: { hour: 9 }, lbl: 'Lease ends', onlyIf: function (r) { return r.status !== 'Moved out'; } }, { k: 'deposit', l: 'Security deposit held', t: 'money' }, { k: 'notes', l: 'Notes', t: 'area' }],
      sub: function (r) { return [r.unit ? Q.title(Q.get(r.unit)) : '', r.leaseEnd ? 'Lease ends ' + Q.u.fmtDate(r.leaseEnd) : ''].filter(Boolean).join(' · '); }, amount: function (r) { return r.rent || ''; } },
    payment: { label: 'Rent payment', plural: 'Rent ledger', icon: '💵', stage: 'method', sort: function (a, b) { return (a.date || '') < (b.date || '') ? 1 : -1; },
      fields: [{ k: 'tenant', l: 'Tenant', t: 'link', to: 'tenant' }, { k: 'date', l: 'Date received', t: 'date', req: 1, d: '' }, { k: 'amount', l: 'Amount', t: 'money', req: 1 }, { k: 'forMonth', l: 'For month', t: 'text', h: '2026-11' }, { k: 'method', l: 'Method', t: 'select', o: ['Cash', 'Check', 'Bank transfer', 'Card', 'Crypto', 'Other'] }, { k: 'notes', l: 'Notes', t: 'area' }],
      title: function (r) { return (r.tenant ? Q.title(Q.get(r.tenant)) : 'Payment') + ' · ' + (r.forMonth || ''); }, amount: function (r) { return r.amount || 0; }, sub: function (r) { return Q.u.fmtDate(r.date); } },
    repair: { label: 'Repair request', plural: 'Repairs', icon: '🔧', stage: 'status', closed: function (r) { return r.status === 'Done'; },
      fields: [{ k: 'issue', l: 'What is wrong', t: 'text', req: 1, hint: 'A short description, like "Kitchen sink is leaking".' }, { k: 'property', l: 'Property', t: 'link', to: 'property', hint: 'The building. Use this for outside or shared areas (roof, parking, hallway).' }, { k: 'unit', l: 'Unit', t: 'link', to: 'unit', hint: 'Which unit the repair is in, if it is inside one unit.' }, { k: 'trade', l: 'Type of work', t: 'select', hint: 'The kind of tradesperson needed. Used when you tap Find VyqilContractor.', o: ['Plumbing', 'Electrical', 'HVAC (heating and cooling)', 'Roofing', 'Painting', 'Flooring', 'Carpentry', 'Appliance repair', 'Handyman / general repair', 'Locksmith', 'Pest control', 'Landscaping and trees', 'Cleaning and turnover', 'Windows and doors', 'Other'] }, { k: 'status', l: 'Status', t: 'select', o: ['New', 'Scheduled', 'Waiting on parts', 'Done'], req: 1, hint: 'Where the repair stands. Choose Done when it is fixed and it moves out of your open list.' }, { k: 'urgent', l: 'Urgent', t: 'check', hint: 'Check for safety or damage problems (no heat, active leak). Urgent repairs show first.' }, { k: 'visit', l: 'Visit date', t: 'date', cal: 1, alert: { hour: 8 }, lbl: 'Repair visit', drop: 'Complete when Contractor Selected', hint: 'The day the repair person is coming. It goes on your calendar and you get a reminder that morning.' }, { k: 'vendor', l: 'Who is fixing it', t: 'text', drop: 'Complete when Contractor Selected', hint: 'The person or company doing the work.' }, { k: 'cost', l: 'Cost', t: 'money', drop: 'Complete when Contractor Selected', hint: 'What the repair cost you. It then counts toward expenses in your reports and the unit history.' }, { k: 'doneOn', l: 'Finished on', t: 'date', hint: 'The day the work was finished.', drop: 'Complete when Contractor Selected' }, { k: 'notes', l: 'Notes', t: 'area', hint: 'Anything the repair person should know: access, pets, tenant availability.' }],
      title: function (r) { return (r.urgent ? '[Urgent] ' : '') + r.issue; }, sub: function (r) { return r.unit ? Q.title(Q.get(r.unit)) : ''; }, amount: function (r) { return r.cost || ''; },
      actions: [{ l: 'Find VyqilContractor', saveFirst: true, note: 'Use this only if you do not already have a contractor you use. If you already have someone, just type their name under "Who is fixing it".', run: function (r) { Q.community.find(r, { target: 'contractor', cat: r.trade, title: r.issue, details: r.notes, urgent: r.urgent }); } }, { l: 'See contractor replies', show: function (r) { return !!r.cid; }, run: function (r) { Q.community.requests(r.cid); } }] }
  },
  // Rent due dates are worked out each month from each current tenant's due day, minus payments logged for that month.
  events: function (rs, from, to) {
    var out = [], u = Q.u, t = u.today(), now = new Date();
    rs.forEach(function (r) {
      if (r.kind !== 'tenant' || r.status === 'Moved out' || !r.rent) return; var day = Math.min(28, Math.max(1, +r.dueDay || 1));
      for (var m = (r.leaseStart ? -6 : -1); m <= 1; m++) { var d = new Date(now.getFullYear(), now.getMonth() + m, day), ds = u.ymd(d), ym = ds.slice(0, 7);
        if (ds < from || ds > to) continue; if (r.leaseStart && ds < r.leaseStart) continue;
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
  function propOf(r) { if (!r) return null; if (r.kind === 'property') return r; if (r.property && Q.get(r.property)) return Q.get(r.property); var u = r.kind === 'unit' ? r : (r.unit ? Q.get(r.unit) : null); return u && u.property ? Q.get(u.property) : null; }
  A.community = { product: 'landlord', place: propOf, places: function () { return Q.byKind('property'); },
    fallback: function () { var p = Q.byKind('property').filter(function (x) { return x.lat != null; })[0]; return p ? { lat: p.lat, lng: p.lng, city: p.loc || p.city || 'Your area' } : null; },
    chosen: { contractor: function (rec, o) { if (rec.kind !== 'repair') return null; var up = { vendor: o.bizName }; if (rec.status === 'New') up.status = 'Scheduled'; return up; } },
    inbound: { addKind: 'applicant', addLabel: 'Add as applicant', inboxTitle: 'Rental requests from realtors', listTitle: 'My rentals in the community', catLabel: 'Kinds of rentals you offer',
      listHelp: 'Realtors and other Vyqil businesses near you can send you people who need a rental. Vyqil uses the place you set, not live tracking. Only the town and an approximate point are saved.' } };
  A.kinds.applicant = { label: 'Application', plural: 'Applications', icon: '📝', stage: 'status', closed: function (r) { return r.status === 'Declined' || r.status === 'Moved in'; },
    fields: [{ k: 'name', l: 'Name', t: 'text', req: 1 }, { k: 'status', l: 'Status', t: 'select', o: ['New', 'Contacted', 'Viewing', 'Screening', 'Approved', 'Moved in', 'Declined'], req: 1 }, { k: 'phone', l: 'Phone', t: 'tel' }, { k: 'email', l: 'Email', t: 'email' },
      { k: 'looking', l: 'Looking for', t: 'text' }, { k: 'unit', l: 'Unit they want', t: 'link', to: 'unit' }, { k: 'budget', l: 'Monthly budget', t: 'money' }, { k: 'income', l: 'Monthly income (they reported)', t: 'money' }, { k: 'employer', l: 'Employer', t: 'text' }, { k: 'curAddr', l: 'Current address', t: 'text' }, { k: 'occupants', l: 'People moving in', t: 'number' }, { k: 'pets', l: 'Pets', t: 'text' }, { k: 'refs', l: 'References', t: 'area' }, { k: 'feePaid', l: 'Application fee paid', t: 'check' }, { k: 'idOk', l: 'ID checked', t: 'check' }, { k: 'incomeOk', l: 'Income verified', t: 'check' }, { k: 'refsOk', l: 'References called', t: 'check' }, { k: 'bgOk', l: 'Background or credit check done', t: 'check' }, { k: 'moveIn', l: 'Wants to move in', t: 'date', cal: 1, alert: { hour: 9 }, lbl: 'Applicant move-in', doneIf: function (r) { return r.status === 'Declined' || r.status === 'Moved in'; } }, { k: 'notes', l: 'Notes', t: 'area' }],
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
      if (t.leaseStart && ds < t.leaseStart) continue;
      if (U().diff(td, ds) > grace && !paidFor(rs, t, ym)) out.push({ ym: ym, due: ds, days: U().diff(td, ds), fee: t.lateFee || 0 });
    }
    return out;
  }
  A.overdueOf = overdueOf;
  function monthName(ym) { var p = ym.split('-'); return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][+p[1] - 1] + ' ' + p[0]; }
  function bizName() { return (Q.S.biz && Q.S.biz.name) || 'Your landlord'; }
  function copyText(text, shareTitle) { if (navigator.share) { navigator.share({ title: shareTitle, text: text }).catch(function () { /* cancelled */ }); return; } try { navigator.clipboard.writeText(text).then(function () { Q.toast('Copied.'); }, function () { Q.toast('Press and hold the text to copy it.'); }); } catch (e) { Q.toast('Press and hold the text to copy it.'); } }
  function showText(title, text, tenant) {
    Q.modal(function (s, close) {
      s.appendChild(U().el('h3', '', title)); var ta = U().el('textarea'); ta.value = text; ta.rows = 9; s.appendChild(ta);
      var b = U().el('div', 'btns'), c = U().el('button', 'btn', navigator.share ? 'Share' : 'Copy'), x = U().el('button', 'btn ghost', 'Close'); c.type = x.type = 'button'; c.onclick = function () { copyText(ta.value, title); }; x.onclick = close; if (tenant && window.VQ_LL && VQ_LL.portal) VQ_LL.portal.addButton(b, tenant, title, function () { return ta.value; }, close); b.appendChild(c); b.appendChild(x); s.appendChild(b);
    });
  }

  // ----- extra tenant fields: late fee, move-in and move-out checklist, deposit return
  var tf = K.tenant.fields, at = tf.length - 1; // keep Notes last
  var extra = [{ k: 'graceDays', l: 'Grace days after due day', t: 'number', hint: 'Rent is late after the due day plus these days. Leave empty for none.' }, { k: 'lateFee', l: 'Late fee', t: 'money', hint: 'A flat fee you charge when rent is late.' },
    { k: 'leaseSigned', l: 'Lease signed', t: 'check' }, { k: 'moveInDone', l: 'Move-in inspection done', t: 'check' }, { k: 'keysGiven', l: 'Keys given', t: 'check' },
    { k: 'finalInspection', l: 'Move-out inspection done', t: 'check' }, { k: 'keysBack', l: 'Keys returned', t: 'check' }, { k: 'depositBack', l: 'Deposit returned', t: 'money' }, { k: 'depositBackOn', l: 'Deposit returned on', t: 'date' }, { k: 'forwardAddr', l: 'Forwarding address', t: 'text' }];
  extra.push({ k: 'employer', l: 'Employer', t: 'text' }, { k: 'income', l: 'Monthly income', t: 'money' }, { k: 'prevAddr', l: 'Previous address', t: 'text' }, { k: 'occupants', l: 'People living there', t: 'number' }, { k: 'pets', l: 'Pets', t: 'text' });
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
      r1.onclick = function () { var p = lastPayment(t); if (!p) { Q.toast('No payment recorded for ' + t.name + ' yet.'); return; } close(); showText('Rent receipt', 'RENT RECEIPT\n\nReceived from: ' + t.name + (unit ? '\nUnit: ' + unit : '') + '\nAmount: ' + money(p.amount) + '\nDate received: ' + U().fmtDate(p.date) + '\nFor: ' + (p.forMonth ? monthName(p.forMonth) : 'rent') + '\nMethod: ' + (p.method || '') + '\n\nThank you.\n' + bizName(), t); };
      r2.onclick = function () { close(); var o = overdueOf(t, Q.S.recs), day = Math.min(28, Math.max(1, +t.dueDay || 1)); var txt = o.length ? 'Hi ' + first + ',\n\nOur records show ' + monthName(o[0].ym) + ' rent of ' + money(t.rent) + ' was due on ' + U().fmtDate(o[0].due) + ' and has not been received.' + (t.lateFee ? ' A late fee of ' + money(t.lateFee) + ' applies.' : '') + ' Please send it as soon as you can, or reply if you already did.\n\nThank you,\n' + bizName() : 'Hi ' + first + ',\n\nA friendly reminder that rent of ' + money(t.rent) + ' is due on day ' + day + ' of each month.\n\nThank you,\n' + bizName(); showText('Rent reminder', txt, t); };
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
    { l: 'Copy tenant portal link', show: function (r) { return !!r.portalId; }, run: function (r) { VQ_LL.portal.copyLink(r); } },
    { l: 'Email the tenant portal link', show: function (r) { return !!r.portalId; }, run: function (r) { VQ_LL.portal.emailLink(r); } },
    { l: 'Text the tenant portal link', show: function (r) { return !!r.portalId; }, run: function (r) { VQ_LL.portal.textLink(r); } }
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
    var invs = Q.S.recs.filter(function (p) { return p.kind === 'invoice' && p.tenant === t.id && p.status !== 'Draft' && p.status !== 'Void'; }).sort(function (a, b) { return (a.due || '') < (b.due || '') ? 1 : -1; }).slice(0, 8).map(function (p) { return { n: String(p.number || '').slice(0, 20), t: String(p.description || '').slice(0, 80), a: p.amount || 0, due: p.due || '', s: p.status === 'Paid' ? 'Paid' : 'Due' }; });
    var unit = t.unit ? Q.get(t.unit) : null, led = Q.S.recs.filter(function (p) { return p.kind === 'payment' && p.tenant === t.id; }).sort(function (a, b) { return (a.date || '') < (b.date || '') ? 1 : -1; }).slice(0, 12).map(function (p) { return { m: p.forMonth || (p.date || '').slice(0, 7), a: p.amount || 0, d: p.date || '', y: p.method || '' }; });
    return { bizId: Q.S.biz.id, recId: t.id, tenantEmail: String(t.email || '').trim().toLowerCase(), tenantName: String(t.name || '').slice(0, 80), unit: unit ? Q.title(unit).slice(0, 120) : '', rent: t.rent || 0, dueDay: Math.min(28, Math.max(1, +t.dueDay || 1)), lateFee: t.lateFee || 0, graceDays: +t.graceDays || 0, landlordName: bizName().slice(0, 80), landlordPhone: String((Q.S.biz && Q.S.biz.phone) || '').slice(0, 30), ledger: led, invoices: invs, payMethods: (Array.isArray(Q.S.biz.payMethods) ? Q.S.biz.payMethods : []).slice(0, 6) };
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
      // New registrants get a "set your password" email. Someone who already has a Vyqil login gets NO password email:
      // they are sent their tenant portal link instead (the landlord shares it), and they sign in with the password they already have.
      if (!res.existing) { try { await a.sendPasswordResetEmail(email, { url: portalBase() }); res.emailed = true; } catch (e2) { try { await a.sendPasswordResetEmail(email); res.emailed = true; } catch (e3) { res.mailError = Q.friendly(e3); } } }
      try { await a.signOut(); } catch (x) { /* ignore */ }
    } catch (e) { res.error = Q.friendly(e); }
    try { await app.delete(); } catch (x) { /* ignore */ }
    return res;
  }
  function tenantUrl(t) { return portalBase() + '?e=' + encodeURIComponent(String(t.email || '').trim().toLowerCase()); }
  function shareLink(t) { if (window.VQ_LL && VQ_LL.portal) VQ_LL.portal.linkModal(t); }
  window.VQ_LL = window.VQ_LL || {}; window.VQ_LL.tenantUrl = tenantUrl; window.VQ_LL.bizName = bizName;
  function invite(t) {
    var email = String(t.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { Q.toast('Add ' + (t.name || 'the tenant') + '\'s email first, then try again.'); return; }
    Q.ask('Create a tenant portal for ' + email + '? New members get an email to set a password. If they already have a Vyqil login, you will get their portal link to send instead.', 'Invite', async function () {
      Q.toast('Inviting...'); var res = await makeLogin(email); if (res.error) { Q.toast(res.error); return; }
      var ref = Q.db.collection('tenantPortals').doc(), d = portalData(t); d.updatedAt = Q.FV.serverTimestamp();
      try { await ref.set(d); await Q.recs().doc(t.id).update({ portalId: ref.id, updatedAt: Q.FV.serverTimestamp() }); } catch (e) { Q.toast(Q.friendly(e)); return; }
      Q.toast(res.existing ? 'Portal added.' : res.mailError ? 'Login ready, but the email could not be sent (' + res.mailError + '). Send them the link.' : 'Invitation emailed. They will get an email to set their password (check Spam).'); t.portalId = ref.id; if (res.existing && Q.portalExisting) Q.portalExisting(t); else shareLink(t);
    });
  }

  async function quietInvite(t) {
    var email = String(t.email || '').trim().toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { skip: true };
    var res = await makeLogin(email); if (res.error) return { error: res.error };
    var ref = Q.db.collection('tenantPortals').doc(), d = portalData(t); d.updatedAt = Q.FV.serverTimestamp();
    try { await ref.set(d); await Q.recs().doc(t.id).update({ portalId: ref.id, updatedAt: Q.FV.serverTimestamp() }); } catch (e) { return { error: Q.friendly(e) }; }
    t.portalId = ref.id; return { ok: true, existing: res.existing, mailError: res.mailError };
  }
  window.VQ_APP.portalInvite = { kind: 'tenant', coll: 'tenantPortals', noun: 'tenant', skip: function (t) { return t.status === 'Moved out'; }, quiet: quietInvite, linkOf: tenantUrl, after: function (t) { shareLink(t); } };

  // ----- repair requests sent by tenants
  var reqCount = 0, reqs = [];
  function listenRequests() {
    if (!Q.S.biz || listenRequests.on) return; listenRequests.on = true;
    Q.db.collection('tenantRequests').where('bizId', '==', Q.S.biz.id).where('status', '==', 'new').onSnapshot(function (s) {
      var before = reqCount; reqs = s.docs.map(function (d) { var x = d.data(); x.id = d.id; return x; }); reqCount = reqs.length; if (reqCount > before) Q.toast(reqCount + ' tenant repair request' + (reqCount === 1 ? '' : 's') + ' waiting. See your home screen.'); if (Q.S.tab === 'today') Q.render();
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
          mk.onclick = function () {
            mk.disabled = true; var qe = String(q.tenantEmail || '').trim().toLowerCase(), t = Q.get(q.recId) || Q.byKind('tenant').filter(function (x) { return (q.portalId && x.portalId === q.portalId) || (qe && String(x.email || '').trim().toLowerCase() === qe); })[0] || Q.byKind('tenant').filter(function (x) { return q.tenantName && x.name === q.tenantName; })[0] || null,
              un = (t && t.unit ? Q.get(t.unit) : null) || Q.byKind('unit').filter(function (x) { return q.unit && (Q.title(x) === q.unit || q.unit.indexOf(Q.title(x)) === 0 || Q.title(x).indexOf(q.unit) === 0); })[0] || null, txt = (q.issue + ' ' + (q.details || '')).toLowerCase(), trade = '';
            [['Plumbing', /leak|faucet|sink|toilet|drain|pipe|water|clog|shower|plumb/], ['Electrical', /electric|outlet|power|light|breaker|switch|wiring|spark/], ['HVAC (heating and cooling)', /heat|furnace|\bac\b|a\/c|air condition|cooling|thermostat|hvac/], ['Roofing', /roof|ceiling leak|shingle/], ['Appliance repair', /fridge|refrigerator|stove|oven|dishwasher|washer|dryer|microwave|appliance/], ['Locksmith', /lock|key|deadbolt/], ['Pest control', /pest|roach|mice|mouse|rat\b|ants|bed ?bug|termite/], ['Windows and doors', /window|door|screen/], ['Painting', /paint|wall|stain/], ['Flooring', /floor|carpet|tile/]].some(function (x) { if (x[1].test(txt)) { trade = x[0]; return true; } return false; });
            var who = (q.tenantName || (t && t.name) || 'Tenant'), phone = q.phone || (t && t.phone) || '', mail = (t && t.email) || q.tenantEmail || '';
            var notes = ['Reported by tenant ' + who + (un ? ' in ' + Q.title(un) : (q.unit ? ' in ' + q.unit : '')), phone ? 'Phone: ' + phone : '', mail ? 'Email: ' + mail : '', q.details ? 'Details: ' + q.details : ''].filter(Boolean).join('\n').slice(0, 900);
            var data = { kind: 'repair', issue: String(q.issue || 'Tenant repair request').slice(0, 120), status: 'New', urgent: !!q.urgent, notes: notes, by: 'tenant', createdAt: Q.FV.serverTimestamp(), updatedAt: Q.FV.serverTimestamp() };
            if (un) data.unit = un.id; else if (t && t.unit) data.unit = t.unit; var pr = (un && un.property) || (t && t.property) || ''; if (!pr && q.unit) { var pp = Q.byKind('property').filter(function (x) { return q.unit.indexOf(Q.title(x)) > -1; })[0]; if (pp) pr = pp.id; } if (pr) data.property = pr; if (trade) data.trade = trade;
            Q.recs().add(data).then(function (ref) { return Q.db.collection('tenantRequests').doc(q.id).update({ status: 'seen', repairId: ref.id }).then(function () { return ref.id; }); }).then(function (id) { Q.toast('Repair order created.'); var shown = Object.assign({}, data, { id: id }); delete shown.createdAt; delete shown.updatedAt; shown.id = id; close(); if (Q.openForm) Q.openForm('repair', shown); }, function (e) { mk.disabled = false; Q.toast(Q.friendly(e)); });
          };
          no.onclick = function () { no.disabled = true; Q.db.collection('tenantRequests').doc(q.id).update({ status: 'dismissed' }).catch(function (e) { no.disabled = false; Q.toast(Q.friendly(e)); }); };
          body.appendChild(c);
        });
      }
      draw(); var iv = setInterval(function () { if (!document.body.contains(s)) { clearInterval(iv); return; } draw(); }, 2000);
    });
  }
  function boot() {
    Q.extras.push(function (v) { v.appendChild(U().el('h2', '', 'Tenants')); var card = U().el('div', 'card'); v.appendChild(card); card.appendChild(U().el('div', 'hint', 'Invite a tenant from their tenant record. They sign in to see rent and payments and to send you repair requests.')); var b = U().el('button', 'btn ghost', 'Tenant repair requests' + (reqCount ? ' (' + reqCount + ' new)' : '')); b.type = 'button'; b.onclick = requestsModal; card.appendChild(b); });
    Q.onStart.push(function () { listenRequests(); setTimeout(syncAll, 6000); setInterval(syncAll, 45000); }); if (Q.S.biz) listenRequests();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.VQ_LL = window.VQ_LL || {}; window.VQ_LL.reqCount = function () { return reqCount; }; window.VQ_LL.requests = requestsModal; window.VQ_LL.syncOne = syncOne;
})();

// ===== VyqilLandlord full build: leases, invoices, expenses, bills, vendors, inspections, reports, messages, letters, profile =====
(function () {
  'use strict';
  var A = window.VQ_APP, K = A.kinds, u = null;
  function U() { return u || (u = Q.u); }
  function el(t, c, x) { return U().el(t, c, x); }
  function money(c) { return U().money(c); }
  function cents(s) { var t = String(s == null ? '' : s).replace(/[$,\s]/g, ''); if (t === '' || !/^\d*\.?\d{0,2}$/.test(t) || t === '.') return null; return Math.round(parseFloat(t) * 100); }
  function today() { return U().today(); }
  function biz() { return Q.S.biz || {}; }
  function prof() { return biz().profile || {}; }
  function title(id) { return id ? Q.title(Q.get(id)) : ''; }
  function nameOf(id) { var t = id ? Q.get(id) : null; return t ? (t.name || Q.title(t)) : ''; }
  function addMonths(ds, n) { var p = ds.split('-'), d = new Date(+p[0], +p[1] - 1 + n, 1), last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(+p[2], last)); return U().ymd(d); }
  function ymOf(ds) { return String(ds || '').slice(0, 7); }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function monthLabel(ym) { var p = ym.split('-'); return MONTHS[+p[1] - 1] + ' ' + p[0]; }
  function copyText(text, t) { if (navigator.share) { navigator.share({ title: t, text: text }).catch(function () { /* cancelled */ }); return; } try { navigator.clipboard.writeText(text).then(function () { Q.toast('Copied.'); }, function () { Q.toast('Press and hold the text to copy it.'); }); } catch (e) { Q.toast('Press and hold the text to copy it.'); } }
  function showText(t, text, tenant) {
    Q.modal(function (s, close) {
      s.appendChild(el('h3', '', t)); var ta = el('textarea'); ta.value = text; ta.rows = 12; ta.maxLength = 20000; s.appendChild(ta);
      var b = el('div', 'btns'), c = el('button', 'btn', navigator.share ? 'Share' : 'Copy'), pr = el('button', 'btn ghost', 'Print'), x = el('button', 'btn ghost', 'Close'); c.type = pr.type = x.type = 'button';
      c.onclick = function () { copyText(ta.value, t); }; x.onclick = close;
      pr.onclick = function () { var w = window.open('', '_blank'); if (!w) { Q.toast('Allow pop-ups to print.'); return; } var d = w.document; d.title = t; var pre = d.createElement('pre'); pre.style.cssText = 'font:14px/1.5 Arial,sans-serif;white-space:pre-wrap;margin:24px'; pre.textContent = ta.value; d.body.appendChild(pre); w.focus(); setTimeout(function () { w.print(); }, 300); };
      if (tenant && window.VQ_LL && VQ_LL.portal) VQ_LL.portal.addButton(b, tenant, t, function () { return ta.value; }, close);
      b.appendChild(c); b.appendChild(pr); b.appendChild(x); s.appendChild(b);
    });
  }
  function letterhead() { var p = prof(), b = biz(); return [b.name || 'Landlord', p.address || '', [p.phone, p.email].filter(Boolean).join('  ·  ')].filter(Boolean).join('\n'); }
  function fmt(d) { return d ? U().fmtDate(d) : ''; }
  function unitOf(t) { return t && t.unit ? Q.get(t.unit) : null; }
  function propOfUnit(un) { return un && un.property ? Q.get(un.property) : null; }
  function propIdOfTenant(tid) { var t = Q.get(tid), un = unitOf(t); return un && un.property ? un.property : ''; }
  function add(kind, data) { data.kind = kind; data.by = (Q.S.user.email || '').split('@')[0].slice(0, 30); data.createdAt = Q.FV.serverTimestamp(); data.updatedAt = Q.FV.serverTimestamp(); return Q.recs().add(data); }
  function upd(id, data) { data.updatedAt = Q.FV.serverTimestamp(); return Q.recs().doc(id).update(data); }
  var TRADES = ['Plumbing', 'Electrical', 'HVAC (heating and cooling)', 'Roofing', 'Painting', 'Flooring', 'Carpentry', 'Appliance repair', 'Handyman / general repair', 'Locksmith', 'Pest control', 'Landscaping and trees', 'Cleaning and turnover', 'Windows and doors', 'Other'];
  var CATS = ['Repairs and maintenance', 'Insurance', 'Property tax', 'Mortgage interest', 'Utilities', 'Management fees', 'Legal and professional', 'Advertising', 'Supplies', 'Travel', 'Other'];
  var propField = { k: 'property', l: 'Property', t: 'link', to: 'property' };

  // ---------- applications: approve and make a tenant ----------
  var AP = K.applicant;
  // Approving an application creates the tenant from what the applicant filled in, then opens the tenant page so it can be reviewed.
  async function approveApplicant(r) {
    try {
      var ex = Q.byKind('tenant').filter(function (t) { return t.fromApp === r.id; })[0];
      if (ex) { Q.openForm('tenant', ex); return; }
      var un = r.unit ? Q.get(r.unit) : null, t = { name: r.name, status: 'Current', phone: r.phone || '', email: r.email || '', dueDay: 1, leaseStart: r.moveIn || today(), fromApp: r.id };
      if (r.unit) t.unit = r.unit; if (un && un.rent) t.rent = un.rent;
      if (r.employer) t.employer = r.employer; if (r.income != null && r.income !== '') t.income = r.income; if (r.curAddr) t.prevAddr = r.curAddr; if (r.occupants != null && r.occupants !== '') t.occupants = r.occupants; if (r.pets) t.pets = r.pets;
      var nt = [r.refs ? 'References: ' + r.refs : '', r.notes || ''].filter(Boolean).join('\n').slice(0, 1400); if (nt) t.notes = nt;
      var shown = JSON.parse(JSON.stringify(t)), ref = await add('tenant', t); await upd(r.id, { status: 'Moved in' }); if (un) await upd(un.id, { status: 'Occupied' });
      Q.toast('Tenant page opened with the application details. Check it and save.');
      setTimeout(function () { Q.openForm('tenant', Object.assign({ id: ref.id, kind: 'tenant' }, shown)); }, 200);
    } catch (e) { Q.toast(Q.friendly(e)); }
  }
  AP.onSaved = function (r, prev) { if (r.status === 'Approved' && (!prev || prev.status !== 'Approved')) approveApplicant(r); };
  AP.actions = [
    { l: 'Approve and make a tenant', show: function (r) { return r.status !== 'Moved in' && r.status !== 'Declined'; }, run: function (r) {
      Q.ask('Approve ' + r.name + ' and open a new tenant page filled in from the application' + (r.unit ? ' for ' + title(r.unit) : '') + '?', 'Approve', function () { approveApplicant(r); });
    } },
    { l: 'Write a decline letter', run: function (r) {
      showText('Letter to ' + r.name, letterhead() + '\n\n' + fmt(today()) + '\n\nDear ' + (r.name || 'Applicant').split(/\s+/)[0] + ',\n\nThank you for applying to rent' + (r.unit ? ' ' + title(r.unit) : '') + '. After reviewing your application, we are not able to offer you the rental at this time.\n\nIf we used a credit or background report in this decision, federal law may require us to give you the name of the reporting company and your rights to a free copy and to dispute it. Please contact us if you would like that information.\n\nWe wish you the best in your search.\n\n' + (biz().name || '') + '\n\n(Check your state and local rules for required wording before sending.)');
    } },
    { l: 'Find a Vyqil to help', run: function (r) { Q.community.find(r, { target: 'realtor', cat: 'Lease a vacant unit', title: 'Help with ' + (r.name || 'an applicant') }); } }
  ];
  AP.sub = function (r) { var ck = ['idOk', 'incomeOk', 'refsOk', 'bgOk'].filter(function (k) { return r[k]; }).length; return [r.phone, r.unit ? title(r.unit) : r.looking, ck ? 'Screening ' + ck + '/4' : ''].filter(Boolean).join(' · '); };
  delete AP.show;

  // ---------- leases ----------
  K.lease = { label: 'Lease', plural: 'Leases', icon: '📄', stage: 'status', closed: function (r) { return r.status === 'Ended'; },
    fields: [{ k: 'tenant', l: 'Tenant', t: 'link', to: 'tenant', req: 1 }, { k: 'unit', l: 'Unit', t: 'link', to: 'unit' }, { k: 'status', l: 'Status', t: 'select', o: ['Draft', 'Sent', 'Signed', 'Ended'], req: 1 },
      { k: 'start', l: 'Starts', t: 'date', req: 1, d: function () { return today(); } }, { k: 'end', l: 'Ends', t: 'date', req: 1 }, { k: 'rent', l: 'Monthly rent', t: 'money', req: 1 }, { k: 'dueDay', l: 'Rent due day (1 to 28)', t: 'number', d: 1 },
      { k: 'deposit', l: 'Security deposit', t: 'money' }, { k: 'lateFee', l: 'Late fee', t: 'money' }, { k: 'graceDays', l: 'Grace days', t: 'number' }, { k: 'pets', l: 'Pets allowed', t: 'text', h: 'None, or one cat under 15 lb' },
      { k: 'utilities', l: 'Who pays utilities', t: 'text', h: 'Tenant pays electric and gas; landlord pays water' }, { k: 'terms', l: 'Extra terms', t: 'area' }],
    title: function (r) { return (nameOf(r.tenant) || 'Lease') + (r.start ? ' · ' + fmt(r.start) : ''); }, amount: function (r) { return r.rent || ''; },
    sub: function (r) { return [r.unit ? title(r.unit) : '', r.end ? 'to ' + fmt(r.end) : ''].filter(Boolean).join(' '); },
    actions: [
      { l: 'View or share the lease', run: function (r) { showText('Lease agreement', leaseText(r), r.tenant ? Q.get(r.tenant) : null); } },
      { l: 'Mark signed and update the tenant', show: function (r) { return r.status !== 'Signed' && r.status !== 'Ended'; }, run: function (r) { applyLease(r, true); } },
      { l: 'Update the tenant record from this lease', show: function (r) { return r.status === 'Signed'; }, run: function (r) { applyLease(r, false); } }
    ] };
  function applyLease(r, sign) {
    var t = r.tenant ? Q.get(r.tenant) : null; if (!t) { Q.toast('Choose a tenant on the lease first.'); return; }
    var up = { rent: r.rent || t.rent || null, leaseStart: r.start || t.leaseStart || '', leaseEnd: r.end || t.leaseEnd || '', deposit: r.deposit != null ? r.deposit : (t.deposit || null), dueDay: +r.dueDay || t.dueDay || 1, status: 'Current', leaseSigned: true };
    if (r.unit) up.unit = r.unit; if (r.lateFee != null) up.lateFee = r.lateFee; if (r.graceDays != null) up.graceDays = r.graceDays;
    Object.keys(up).forEach(function (k) { if (up[k] === undefined) delete up[k]; });
    (sign ? upd(r.id, { status: 'Signed' }) : Promise.resolve()).then(function () { return upd(t.id, up); }).then(function () { Q.toast('Tenant record updated.'); }, function (e) { Q.toast(Q.friendly(e)); });
  }
  function leaseText(r) {
    var t = r.tenant ? Q.get(r.tenant) : null, un = r.unit ? Q.get(r.unit) : unitOf(t), pr = propOfUnit(un), where = un ? Q.title(un) : '(address)', due = Math.min(28, Math.max(1, +r.dueDay || 1));
    var L = ['RESIDENTIAL LEASE AGREEMENT', '', '(Sample template. Rental laws differ by state and city. Have a local attorney or your landlord association review it before you rely on it.)', '', letterhead(), '',
      '1. PARTIES. This lease is between ' + (biz().name || 'the Landlord') + ' ("Landlord") and ' + (nameOf(r.tenant) || 'the Tenant') + ' ("Tenant").',
      '2. PROPERTY. Landlord rents to Tenant: ' + where + (pr && pr.city ? ', ' + pr.city : '') + '.',
      '3. TERM. The lease starts ' + fmt(r.start) + ' and ends ' + fmt(r.end) + '.',
      '4. RENT. Tenant pays ' + money(r.rent) + ' each month, due on day ' + due + '.' + (prof().payInfo ? ' Payment: ' + prof().payInfo : ''),
      '5. LATE FEE. ' + (r.lateFee ? 'If rent is not received within ' + (+r.graceDays || 0) + ' day(s) after the due date, Tenant owes a late fee of ' + money(r.lateFee) + '.' : 'No late fee is set.'),
      '6. SECURITY DEPOSIT. ' + (r.deposit ? 'Tenant pays a security deposit of ' + money(r.deposit) + '. Landlord holds it and returns it as the law requires after Tenant moves out, less lawful deductions.' : 'No security deposit.'),
      '7. UTILITIES. ' + (r.utilities || 'As agreed between the parties.'),
      '8. PETS. ' + (r.pets || 'No pets without written permission.'),
      '9. USE. The home is for residential use by the people named in this lease. No illegal activity. No disturbing neighbors.',
      '10. CARE AND REPAIRS. Tenant keeps the home clean and reports damage or needed repairs promptly. Landlord keeps the home fit to live in as the law requires.',
      '11. ENTRY. Landlord may enter with reasonable notice as allowed by law, or at once in an emergency.',
      '12. ENDING THE LEASE. Either party must give the notice the law and this lease require. Tenant returns all keys at move-out.'];
    if (r.terms) L.push('13. ADDITIONAL TERMS. ' + r.terms);
    L.push('', 'Landlord signature: ______________________  Date: __________', '', 'Tenant signature: ______________________  Date: __________');
    return L.join('\n');
  }

  // ---------- invoices ----------
  function nextInvoiceNo() { var n = 0; Q.byKind('invoice').forEach(function (r) { var m = /(\d+)$/.exec(r.number || ''); if (m && +m[1] > n) n = +m[1]; }); return 'INV-' + ('000' + (n + 1)).slice(-4); }
  K.invoice = { label: 'Invoice', plural: 'Invoices', icon: '🧾', stage: 'status', closed: function (r) { return r.status === 'Paid' || r.status === 'Void'; }, sort: function (a, b) { return (a.due || '') < (b.due || '') ? 1 : -1; },
    fields: [{ k: 'tenant', l: 'Bill to', t: 'link', to: 'tenant', req: 1 }, { k: 'number', l: 'Invoice number', t: 'text', req: 1, d: function () { return nextInvoiceNo(); } }, { k: 'description', l: 'What it is for', t: 'text', req: 1, h: 'Pet fee, late fee, repair charge, utilities' },
      { k: 'amount', l: 'Amount', t: 'money', req: 1 }, { k: 'issued', l: 'Issued', t: 'date', d: function () { return today(); } }, { k: 'due', l: 'Due', t: 'date', cal: 1, alert: { hour: 9 }, lbl: 'Invoice due', d: function () { return U().addDays(today(), 14); } },
      { k: 'status', l: 'Status', t: 'select', o: ['Draft', 'Sent', 'Paid', 'Void'], req: 1, d: 'Sent' }, { k: 'notes', l: 'Notes', t: 'area' }],
    title: function (r) { return (r.number || 'Invoice') + ' · ' + (nameOf(r.tenant) || ''); }, amount: function (r) { return r.amount || ''; }, sub: function (r) { return (r.description || '') + (r.due ? ' · due ' + fmt(r.due) : ''); },
    actions: [
      { l: 'Share the invoice', run: function (r) { showText('Invoice ' + (r.number || ''), invoiceText(r), r.tenant ? Q.get(r.tenant) : null); } },
      { l: 'Mark paid and add to rent ledger', show: function (r) { return r.status !== 'Paid' && r.status !== 'Void'; }, run: function (r) {
        Q.ask('Mark invoice ' + (r.number || '') + ' paid and record ' + money(r.amount) + ' as received today?', 'Mark paid', async function () {
          try { await add('payment', { tenant: r.tenant || null, date: today(), amount: r.amount || 0, forMonth: ymOf(r.due || today()), method: 'Other', notes: ('Invoice ' + (r.number || '') + ': ' + (r.description || '')).slice(0, 300) }); await upd(r.id, { status: 'Paid' }); Q.toast('Recorded.'); } catch (e) { Q.toast(Q.friendly(e)); } });
      } }
    ] };
  function invoiceText(r) {
    var t = r.tenant ? Q.get(r.tenant) : null;
    return ['INVOICE ' + (r.number || ''), '', letterhead(), '', 'Bill to: ' + (nameOf(r.tenant) || ''), (t && unitOf(t) ? 'Unit: ' + Q.title(unitOf(t)) : ''), 'Issued: ' + fmt(r.issued || today()), 'Due: ' + fmt(r.due), '', r.description || '', 'Amount due: ' + money(r.amount), r.status === 'Paid' ? '\nPAID. Thank you.' : '', prof().payInfo ? '\nHow to pay: ' + prof().payInfo : '', r.notes ? '\n' + r.notes : ''].filter(function (x) { return x !== ''; }).join('\n');
  }

  // ---------- expenses and bills ----------
  K.expense = { label: 'Expense', plural: 'Expenses', icon: '💳', stage: 'category', sort: function (a, b) { return (a.date || '') < (b.date || '') ? 1 : -1; },
    fields: [{ k: 'date', l: 'Date', t: 'date', req: 1, d: function () { return today(); } }, { k: 'amount', l: 'Amount', t: 'money', req: 1 }, { k: 'category', l: 'Category', t: 'select', o: CATS, req: 1 }, propField, { k: 'vendor', l: 'Paid to', t: 'text' }, { k: 'notes', l: 'Notes', t: 'area' }],
    title: function (r) { return (r.vendor || r.category || 'Expense'); }, amount: function (r) { return r.amount || 0; }, sub: function (r) { return [fmt(r.date), r.property ? title(r.property) : ''].filter(Boolean).join(' · '); } };
  K.bill = { label: 'Recurring bill', plural: 'Recurring bills', icon: '🔁', stage: 'frequency', closed: function (r) { return r.status === 'Stopped'; },
    fields: [{ k: 'name', l: 'Bill', t: 'text', req: 1, h: 'Insurance, water, mortgage interest' }, { k: 'amount', l: 'Usual amount', t: 'money' }, { k: 'frequency', l: 'How often', t: 'select', o: ['Monthly', 'Quarterly', 'Yearly'], req: 1 }, { k: 'nextDue', l: 'Next due', t: 'date', req: 1, cal: 1, alert: { hour: 9 }, lbl: 'Bill due' },
      { k: 'category', l: 'Category', t: 'select', o: CATS, d: 'Utilities' }, propField, { k: 'status', l: 'Status', t: 'select', o: ['Active', 'Stopped'], d: 'Active' }, { k: 'notes', l: 'Notes', t: 'area' }],
    title: function (r) { return r.name; }, amount: function (r) { return r.amount || ''; }, sub: function (r) { return 'Next ' + fmt(r.nextDue); },
    actions: [{ l: 'Mark paid and log the expense', show: function (r) { return r.status !== 'Stopped'; }, run: function (r) {
      Q.modal(function (s, close) {
        s.appendChild(el('h3', '', 'Paid: ' + r.name)); s.appendChild(el('label', 'f', 'Amount paid')); var a = el('input'); a.inputMode = 'decimal'; a.value = r.amount ? (r.amount / 100).toFixed(2) : ''; s.appendChild(a); var m = el('div', 'note err'); s.appendChild(m);
        var b = el('div', 'btns'), go = el('button', 'btn', 'Save'), x = el('button', 'btn ghost', 'Cancel'); go.type = x.type = 'button'; b.appendChild(go); b.appendChild(x); s.appendChild(b); x.onclick = close;
        go.onclick = async function () { var c = cents(a.value); if (c === null || c <= 0) { m.textContent = 'Enter the amount like 125.50.'; return; } go.disabled = true;
          try { var step = r.frequency === 'Yearly' ? 12 : r.frequency === 'Quarterly' ? 3 : 1; await add('expense', { date: today(), amount: c, category: r.category || 'Other', property: r.property || null, vendor: r.name, notes: 'From recurring bill' }); await upd(r.id, { nextDue: addMonths(r.nextDue, step) }); close(); Q.toast('Logged. Next due ' + fmt(addMonths(r.nextDue, step)) + '.'); } catch (e) { m.textContent = Q.friendly(e); go.disabled = false; } };
      });
    } }] };

  // ---------- vendors and inspections ----------
  K.vendor = { label: 'Vendor', plural: 'Vendors', icon: '🧰', stage: 'trade',
    fields: [{ k: 'name', l: 'Name or company', t: 'text', req: 1 }, { k: 'trade', l: 'Trade', t: 'select', o: TRADES }, { k: 'phone', l: 'Phone', t: 'tel' }, { k: 'email', l: 'Email', t: 'email' }, { k: 'license', l: 'License number', t: 'text' }, { k: 'insured', l: 'Has insurance', t: 'check' }, { k: 'notes', l: 'Notes', t: 'area' }],
    sub: function (r) { return [r.phone, r.license ? 'Lic ' + r.license : '', r.insured ? 'Insured' : ''].filter(Boolean).join(' · '); },
    actions: [{ l: 'Find more like this on Vyqil', run: function (r) { Q.community.find(r, { target: 'contractor', cat: r.trade || 'Other', title: (r.trade || 'Contractor') + ' needed' }); } }] };
  A.checklists = A.checklists || {};
  A.checklists.inspect = ['Entry and living room', 'Kitchen: sink, stove, fridge', 'Bathrooms: leaks, mold, fixtures', 'Bedrooms and closets', 'Doors, locks and windows', 'Walls, floors and ceilings', 'Smoke and CO detectors', 'Heating, cooling and water heater', 'Outside and parking'].map(function (t) { return { t: t, off: 0 }; });
  K.inspection = { label: 'Inspection', plural: 'Inspections', icon: '🔍', stage: 'status', closed: function (r) { return r.status === 'Done'; }, sort: function (a, b) { return (a.date || '') < (b.date || '') ? 1 : -1; },
    fields: [{ k: 'unit', l: 'Unit', t: 'link', to: 'unit', req: 1 }, { k: 'type', l: 'Type', t: 'select', o: ['Move-in', 'Move-out', 'Routine', 'Annual'], req: 1 }, { k: 'date', l: 'Date', t: 'date', req: 1, cal: 1, alert: { hour: 9 }, lbl: 'Inspection', d: function () { return today(); } }, { k: 'status', l: 'Status', t: 'select', o: ['Scheduled', 'Done'], req: 1 }, { k: 'notes', l: 'What you found', t: 'area' }],
    checklist: { tpl: 'inspect', base: 'date', name: 'room-by-room' },
    title: function (r) { return (r.type || 'Inspection') + ' · ' + (r.unit ? title(r.unit) : ''); }, sub: function (r) { return fmt(r.date); },
    actions: [{ l: 'Write a notice of entry', run: function (r) { letters(null, 'entry', r); } }] };

  // ---------- profile ----------
  function profileModal() {
    Q.modal(function (s, close) {
      var p = prof(); s.appendChild(el('h3', '', 'Business profile')); s.appendChild(el('p', 'hint', 'This appears at the top of leases, invoices and letters, and is shared with your tenants in the tenant portal.'));
      var F = {}; [['phone', 'Phone', 'tel', 30], ['email', 'Email', 'email', 80], ['address', 'Mailing address', 'text', 160], ['website', 'Website', 'text', 100], ['payInfo', 'How tenants pay you', 'text', 200]].forEach(function (x) { s.appendChild(el('label', 'f', x[1])); var i = el('input'); i.type = x[2]; i.maxLength = x[3]; i.value = p[x[0]] || ''; if (x[0] === 'payInfo') i.placeholder = 'Zelle to 555-0100, or check by mail'; s.appendChild(i); F[x[0]] = i; });
      var m = el('div', 'note err'); s.appendChild(m); var b = el('div', 'btns'), go = el('button', 'btn', 'Save'), x = el('button', 'btn ghost', 'Cancel'); go.type = x.type = 'button'; b.appendChild(go); b.appendChild(x); s.appendChild(b); x.onclick = close;
      go.onclick = function () {
        var o = {}; Object.keys(F).forEach(function (k) { o[k] = F[k].value.trim(); }); go.disabled = true;
        Q.db.collection('businesses').doc(biz().id).update({ profile: o }).then(function () { Q.S.biz.profile = o; Q.S.biz.phone = o.phone || ''; close(); Q.toast('Saved.'); }, function (e) { m.textContent = Q.friendly(e); go.disabled = false; });
      };
    });
  }

  // ---------- letters and notices ----------
  var LETTERS = {
    late: { l: 'Late rent reminder', f: [['amount', 'Amount owed', 'money'], ['date', 'Pay by', 'date']], t: function (t, v) { return 'This is a reminder that your rent' + (v.amount ? ' of ' + v.amount : '') + ' is past due. Please pay' + (v.date ? ' by ' + v.date : ' as soon as you can') + '.' + (t.lateFee ? ' A late fee of ' + money(t.lateFee) + ' may apply under your lease.' : '') + ' If you already paid, thank you, and please let me know so I can update my records.'; } },
    increase: { l: 'Rent increase notice', f: [['amount', 'New monthly rent', 'money'], ['date', 'Starts on', 'date']], t: function (t, v) { return 'Your monthly rent is going from ' + money(t.rent) + ' to ' + (v.amount || '(new rent)') + ', starting ' + (v.date || '(date)') + '. All other lease terms stay the same. Please contact me with any questions.'; } },
    entry: { l: 'Notice of entry', f: [['date', 'Date of visit', 'date'], ['time', 'Time window', 'text'], ['why', 'Reason', 'text']], t: function (t, v) { return 'I will need to enter your home on ' + (v.date || '(date)') + (v.time ? ', ' + v.time : '') + ' for the following reason: ' + (v.why || 'inspection or repair') + '. Please let me know if you have a problem with that time.'; } },
    renew: { l: 'Lease renewal offer', f: [['amount', 'Rent for the new term', 'money'], ['date', 'New lease ends', 'date']], t: function (t, v) { return 'Your lease ends ' + (t.leaseEnd ? fmt(t.leaseEnd) : '(date)') + '. I would be glad to have you stay. I am offering a new lease through ' + (v.date || '(date)') + ' at ' + (v.amount || money(t.rent)) + ' per month. Please let me know if you would like to renew.'; } },
    violation: { l: 'Lease violation warning', f: [['why', 'What happened', 'text'], ['date', 'Fix it by', 'date']], t: function (t, v) { return 'I am writing about a problem under your lease: ' + (v.why || '(describe)') + '. Please correct this' + (v.date ? ' by ' + v.date : ' right away') + '. If it is not fixed I may have to take further steps allowed by your lease and the law.'; } },
    deposit: { l: 'Security deposit statement', f: [['amount', 'Amount deducted', 'money'], ['why', 'What the deductions were for', 'text']], t: function (t, v) { var dep = t.deposit || 0, ded = cents(v.amount) || 0; return 'Your security deposit was ' + money(dep) + '. Deductions: ' + (ded ? money(ded) : '$0.00') + (v.why ? ' (' + v.why + ')' : '') + '. Amount returned to you: ' + money(Math.max(0, dep - ded)) + '. Please send a forwarding address if it is not on file.'; } }
  };
  function letters(tenant, pick, insp) {
    Q.modal(function (s, close) {
      s.appendChild(el('h3', '', 'Letters and notices')); s.appendChild(el('label', 'f', 'Tenant *')); var ts = el('select'); var t0 = el('option', '', 'Choose a tenant'); t0.value = ''; ts.appendChild(t0); Q.byKind('tenant').filter(function (t) { return t.status !== 'Moved out'; }).forEach(function (t) { var o = el('option', '', t.name); o.value = t.id; ts.appendChild(o); }); s.appendChild(ts);
      if (tenant) ts.value = tenant.id; else if (insp && insp.unit) { var m0 = Q.byKind('tenant').filter(function (t) { return t.unit === insp.unit && t.status !== 'Moved out'; })[0]; if (m0) ts.value = m0.id; }
      
      s.appendChild(el('label', 'f', 'Letter')); var ls = el('select'); Object.keys(LETTERS).forEach(function (k) { var o = el('option', '', LETTERS[k].l); o.value = k; ls.appendChild(o); }); if (pick) ls.value = pick; s.appendChild(ls);
      var box = el('div'), inputs = {}; s.appendChild(box);
      function draw() { box.textContent = ''; inputs = {}; LETTERS[ls.value].f.forEach(function (f) { box.appendChild(el('label', 'f', f[1])); var i = el('input'); i.type = f[2] === 'date' ? 'date' : 'text'; if (f[2] === 'money') i.inputMode = 'decimal'; i.maxLength = 160; if (insp && f[0] === 'date' && ls.value === 'entry') i.value = insp.date || ''; box.appendChild(i); inputs[f[0]] = { i: i, t: f[2] }; }); }
      ls.onchange = draw; draw();
      var m = el('div', 'note', 'Notice periods and required wording differ by state and city. Check your local rules before you send.'); s.appendChild(m);
      var b = el('div', 'btns'), go = el('button', 'btn', 'Write it'), x = el('button', 'btn ghost', 'Close'); go.type = x.type = 'button'; b.appendChild(go); b.appendChild(x); s.appendChild(b); x.onclick = close;
      go.onclick = function () {
        var t = Q.get(ts.value); if (!t) { m.className = 'note err'; m.textContent = 'Choose a tenant first.'; return; } var v = {}, L = LETTERS[ls.value];
        for (var k in inputs) { var raw = inputs[k].i.value.trim(); v[k] = inputs[k].t === 'money' ? (raw && cents(raw) != null ? money(cents(raw)) : (raw ? raw : '')) : inputs[k].t === 'date' ? (raw ? fmt(raw) : '') : raw; }
        if (ls.value === 'deposit') v.amount = inputs.amount.i.value.trim();
        close(); showText(L.l + ' for ' + t.name, letterhead() + '\n\n' + fmt(today()) + '\n\nDear ' + (t.name || 'Tenant').split(/\s+/)[0] + ',\n\n' + L.t(t, v) + '\n\nThank you,\n' + (biz().name || ''), t);
      };
    });
  }

  // ---------- messages with tenants ----------
  var msgs = [], msgBound = false, lastUnread = -1;
  function unread() { return msgs.filter(function (m) { return m.from === 'tenant' && m.status === 'new'; }).length; }
  function bindMessages() {
    if (msgBound || !Q.S.biz) return; msgBound = true;
    Q.db.collection('tenantMsgs').where('bizId', '==', Q.S.biz.id).onSnapshot(function (s) {
      msgs = s.docs.map(function (d) { var x = d.data(); x.id = d.id; return x; }); var n = unread();
      if (lastUnread >= 0 && n > lastUnread) Q.toast('New message from a tenant. See More > Messages.'); lastUnread = n;
      if (Q.S.tab === 'more' || Q.S.tab === 'messages' || Q.S.tab === 'today') Q.render();
    }, function () { /* optional */ });
  }
  function threadOf(pid) { return msgs.filter(function (m) { return m.portalId === pid; }).sort(function (a, b) { return ms(a) - ms(b); }); }
  function ms(m) { return m.createdAt && m.createdAt.toMillis ? m.createdAt.toMillis() : Date.now(); }
  function thread(t) {
    Q.modal(function (s, close) {
      s.appendChild(el('h3', '', 'Messages with ' + t.name)); var box = el('div'); box.style.cssText = 'max-height:46vh;overflow:auto'; s.appendChild(box);
      function draw() {
        box.textContent = ''; var th = threadOf(t.portalId); if (!th.length) box.appendChild(el('p', 'hint', 'No messages yet.'));
        th.forEach(function (m) { var me = m.from === 'landlord', d = el('div', 'card'); d.style.cssText = 'margin:6px 0;' + (me ? 'margin-left:24px' : 'margin-right:24px;border-color:#2b5a85'); d.appendChild(el('div', '', m.body)); d.appendChild(el('div', 'hint', (me ? 'You' : t.name) + (m.createdAt && m.createdAt.toDate ? ' · ' + U().fmtDate(U().ymd(m.createdAt.toDate())) : ''))); box.appendChild(d); });
        var fresh = th.filter(function (m) { return m.from === 'tenant' && m.status === 'new'; }); fresh.forEach(function (m) { Q.db.collection('tenantMsgs').doc(m.id).update({ status: 'seen' }).catch(function () { /* optional */ }); m.status = 'seen'; });
        box.scrollTop = box.scrollHeight;
      }
      draw(); var ta = el('textarea'); ta.maxLength = 1000; ta.placeholder = 'Write a message'; ta.rows = 3; s.appendChild(ta); var er = el('div', 'note err'); s.appendChild(er);
      var b = el('div', 'btns'), go = el('button', 'btn', 'Send'), tx = el('button', 'btn ghost', 'Send text message'), x = el('button', 'btn ghost', 'Close'); go.type = tx.type = x.type = 'button'; b.appendChild(go); b.appendChild(tx); b.appendChild(x); s.appendChild(b); x.onclick = close; tx.onclick = function () { VQ_LL.portal.textHeadsUp(t, 'a message'); };
      go.onclick = function () { var body = ta.value.trim(); if (!body) return; go.disabled = true; er.textContent = '';
        Q.db.collection('tenantMsgs').add({ portalId: t.portalId, bizId: biz().id, tenantEmail: String(t.email || '').trim().toLowerCase(), from: 'landlord', body: body, status: 'new', createdAt: Q.FV.serverTimestamp() }).then(function () { ta.value = ''; go.disabled = false; }, function (e) { er.textContent = Q.friendly(e); go.disabled = false; }); };
      var iv = setInterval(function () { if (!document.body.contains(s)) { clearInterval(iv); return; } draw(); }, 2500);
    });
  }
  function convos() {
    var ts = Q.byKind('tenant'), out = [], seen = {};
    function emailOfT(t) { return String(t.email || '').trim().toLowerCase(); }
    ts.forEach(function (t) { if (t.portalId && t.status !== 'Moved out') { seen[t.portalId] = 1; out.push({ t: t, pid: t.portalId }); } });
    var byPid = {}; msgs.forEach(function (m) { if (m.portalId && !seen[m.portalId]) (byPid[m.portalId] = byPid[m.portalId] || []).push(m); });
    Object.keys(byPid).forEach(function (pid) {
      var m0 = byPid[pid][0], em = String(m0.tenantEmail || '').trim().toLowerCase(), t = ts.filter(function (x) { return (em && emailOfT(x) === em) || x.portalId === pid; })[0];
      if (t && !t.portalId && Q.recs) { try { Q.recs().doc(t.id).update({ portalId: pid, updatedAt: Q.FV.serverTimestamp() }); } catch (e) { /* optional */ } }
      out.push({ t: { id: t ? t.id : '', name: t ? t.name : (m0.tenantName || em || 'Tenant'), email: em || (t && t.email) || '', phone: t ? t.phone : '', portalId: pid }, pid: pid });
    });
    return out;
  }
  function messagesView(v) {
    bindMessages();     var h = el('h2', '', 'Messages'); v.appendChild(h); var c = el('div', 'card'); v.appendChild(c);
    var cs = convos();
    if (!cs.length) { c.appendChild(el('div', 'empty', 'No tenant is in the tenant portal yet. Invite your tenants from the Tenants page. Then you can message each other here.')); return; }
    cs.sort(function (a, b) { var ta = threadOf(a.pid), tb = threadOf(b.pid); return (tb.length ? ms(tb[tb.length - 1]) : 0) - (ta.length ? ms(ta[ta.length - 1]) : 0); });
    cs.forEach(function (x) {
      var t = x.t, th = threadOf(x.pid), last = th[th.length - 1], n = th.filter(function (m) { return m.from === 'tenant' && m.status === 'new'; }).length, row = el('div', 'row tap' + (n ? ' newmsg' : '')), m = el('div', 'm');
      m.appendChild(el('b', '', t.name)); m.appendChild(el('span', '', last ? (last.from === 'landlord' ? 'You: ' : '') + String(last.body).slice(0, 70) : 'No messages yet')); row.appendChild(m); if (n) row.appendChild(el('span', 'pill bad', n + ' new')); row.onclick = function () { thread(t); }; c.appendChild(row);
    });
    v.appendChild(el('div', 'note', 'Tenants write to you from their tenant portal page. These messages stay in Vyqil. They are not sent by email or text, but you get a phone alert when one arrives.'));
  }

  // ---------- reports ----------
  function incomeRows() { return Q.byKind('payment').filter(function (p) { return U().isDate(p.date); }); }
  function repairRows() { return Q.byKind('repair').filter(function (r) { return r.status === 'Done' && r.cost; }).map(function (r) { var un = r.unit ? Q.get(r.unit) : null; return { date: U().isDate(r.doneOn) ? r.doneOn : (U().isDate(r.visit) ? r.visit : ''), amount: r.cost, category: 'Repairs and maintenance', property: un && un.property || '', vendor: r.vendor || r.issue }; }); }
  function expenseRows() { return Q.byKind('expense').filter(function (e) { return U().isDate(e.date); }).concat(repairRows().filter(function (r) { return r.date; })); }
  function sum(list) { var t = 0; list.forEach(function (x) { t += x.amount || 0; }); return t; }
  function bar(v, max, color) { var d = el('div'); d.style.cssText = 'height:8px;border-radius:4px;background:' + color + ';width:' + Math.max(2, max ? Math.round(v / max * 100) : 0) + '%;margin:2px 0'; return d; }
  function summaryFor(year) {
    var inc = incomeRows().filter(function (p) { return p.date.slice(0, 4) === year; }), ex = expenseRows().filter(function (e) { return e.date.slice(0, 4) === year; }), by = {};
    ex.forEach(function (e) { by[e.category || 'Other'] = (by[e.category || 'Other'] || 0) + (e.amount || 0); });
    return { year: year, income: sum(inc), expenses: sum(ex), by: by };
  }
  function summaryText(sm) {
    var L = ['RENTAL INCOME AND EXPENSES, ' + sm.year, biz().name || '', '', 'Rent and other income received: ' + money(sm.income), '', 'Expenses by category:']; Object.keys(sm.by).sort().forEach(function (k) { L.push('  ' + k + ': ' + money(sm.by[k])); });
    L.push('  Total expenses: ' + money(sm.expenses), '', 'Net: ' + money(sm.income - sm.expenses), '', 'This is a summary of what you recorded in VyqilLandlord. It is not tax advice. Check it against your bank records and share it with your tax preparer.'); return L.join('\n');
  }
  function csvOf(sm) { var rows = [['Year', 'Item', 'Amount']]; rows.push([sm.year, 'Income', (sm.income / 100).toFixed(2)]); Object.keys(sm.by).sort().forEach(function (k) { rows.push([sm.year, k, (sm.by[k] / 100).toFixed(2)]); }); rows.push([sm.year, 'Net', ((sm.income - sm.expenses) / 100).toFixed(2)]); return rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n'); }
  function reportsView(v) {
    var now = new Date(), thisYm = U().ymd(now).slice(0, 7), act = Q.byKind('tenant').filter(function (t) { return t.status !== 'Moved out'; });
    v.appendChild(el('h2', '', 'Reports'));
    var expected = 0, got = 0; act.forEach(function (t) { expected += t.rent || 0; });
    Q.byKind('payment').forEach(function (p) { if ((p.forMonth || ymOf(p.date)) === thisYm) got += p.amount || 0; });
    var st = el('div', 'stat'); [[money(expected), 'Rent expected ' + monthLabel(thisYm)], [money(got), 'Received'], [money(Math.max(0, expected - got)), 'Still to collect']].forEach(function (x) { var d = el('div'); d.appendChild(el('b', '', x[0])); d.appendChild(el('span', '', x[1])); st.appendChild(d); }); v.appendChild(st);
    var units = Q.byKind('unit'), occ = units.filter(function (x) { return x.status === 'Occupied'; }).length, vac = 0; units.forEach(function (x) { if (x.status !== 'Occupied' && x.rent) vac += x.rent; });
    var dep = 0; act.forEach(function (t) { dep += t.deposit || 0; }); var inv = 0; Q.byKind('invoice').forEach(function (r) { if (r.status === 'Sent' || r.status === 'Draft') inv += r.amount || 0; });
    var ends = act.filter(function (t) { return U().isDate(t.leaseEnd) && U().diff(t.leaseEnd, today()) >= 0 && U().diff(t.leaseEnd, today()) <= 90; }).length;
    v.appendChild(el('h2', '', 'Your portfolio')); var c0 = el('div', 'card'); v.appendChild(c0);
    [['Occupancy', units.length ? Math.round(occ / units.length * 100) + '% (' + occ + ' of ' + units.length + ' units)' : 'No units yet'], ['Rent lost to vacancies', money(vac) + ' a month'], ['Security deposits held', money(dep)], ['Unpaid invoices', money(inv)], ['Leases ending in 90 days', String(ends)]].forEach(function (x) { var r = el('div', 'row'), m = el('div', 'm'); m.appendChild(el('b', '', x[0])); r.appendChild(m); r.appendChild(el('span', 'amt', x[1])); c0.appendChild(r); });
    v.appendChild(el('h2', '', 'Last 6 months')); var c1 = el('div', 'card'); v.appendChild(c1); var months = []; for (var i = 5; i >= 0; i--) months.push(U().ymd(new Date(now.getFullYear(), now.getMonth() - i, 1)).slice(0, 7));
    var data = months.map(function (m) { return { m: m, i: sum(incomeRows().filter(function (p) { return ymOf(p.date) === m; })), e: sum(expenseRows().filter(function (x) { return ymOf(x.date) === m; })) }; }), mx = 0; data.forEach(function (d) { mx = Math.max(mx, d.i, d.e); });
    data.forEach(function (d) { var w = el('div'); w.style.margin = '8px 0'; w.appendChild(el('b', '', monthLabel(d.m))); w.appendChild(bar(d.i, mx, '#2bd08a')); w.appendChild(el('div', 'hint', 'Income ' + money(d.i))); w.appendChild(bar(d.e, mx, '#e5484d')); w.appendChild(el('div', 'hint', 'Expenses ' + money(d.e) + ' · Net ' + money(d.i - d.e))); c1.appendChild(w); });
    v.appendChild(el('h2', '', 'By property (this year)')); var c2 = el('div', 'card'); v.appendChild(c2); var yr = String(now.getFullYear()), pm = {};
    Q.byKind('property').forEach(function (p) { pm[p.id] = { n: Q.title(p), i: 0, e: 0 }; }); pm._ = { n: 'Not assigned to a property', i: 0, e: 0 };
    incomeRows().filter(function (p) { return p.date.slice(0, 4) === yr; }).forEach(function (p) { var k = propIdOfTenant(p.tenant); (pm[k] || pm._).i += p.amount || 0; });
    expenseRows().filter(function (e) { return e.date.slice(0, 4) === yr; }).forEach(function (e) { (pm[e.property] || pm._).e += e.amount || 0; });
    Object.keys(pm).forEach(function (k) { var x = pm[k]; if (!x.i && !x.e) return; var r = el('div', 'row'), m = el('div', 'm'); m.appendChild(el('b', '', x.n)); m.appendChild(el('span', '', 'Income ' + money(x.i) + ' · Expenses ' + money(x.e))); r.appendChild(m); r.appendChild(el('span', 'amt', money(x.i - x.e))); c2.appendChild(r); });
    if (!c2.firstChild) c2.appendChild(el('div', 'empty', 'Record rent payments and expenses to see this.'));
    v.appendChild(el('h2', '', 'Tax summary')); var c3 = el('div', 'card'); v.appendChild(c3); var ys = el('select'); for (var y = now.getFullYear(); y >= now.getFullYear() - 3; y--) { var o = el('option', '', String(y)); o.value = String(y); ys.appendChild(o); } c3.appendChild(ys);
    var b = el('div', 'btns'), sv = el('button', 'btn', 'View and share'), dl = el('button', 'btn ghost', 'Download CSV'); sv.type = dl.type = 'button'; b.appendChild(sv); b.appendChild(dl); c3.appendChild(b);
    sv.onclick = function () { showText('Income and expenses ' + ys.value, summaryText(summaryFor(ys.value))); };
    dl.onclick = function () { var a = el('a'); a.href = URL.createObjectURL(new Blob([csvOf(summaryFor(ys.value))], { type: 'text/csv' })); a.download = 'landlord-summary-' + ys.value + '.csv'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); };
    c3.appendChild(el('div', 'note', 'Repair costs come from your Repairs list (finished repairs with a cost). Add everything else under Expenses. This is a record of what you entered, not tax advice.'));
  }

  // ---------- More hub ----------
  A.hub = function (v) {
    function open(id) { return function () { Q.S.tab = id; Q.S.q = ''; Q.render(); window.scrollTo(0, 0); }; }
    function group(h, rows) { v.appendChild(el('h2', '', h)); var c = el('div', 'card'); rows.forEach(function (x) { var r = el('div', 'row tap'), m = el('div', 'm'); m.appendChild(el('b', '', x[0])); if (x[1]) m.appendChild(el('span', '', x[1])); r.appendChild(m); if (x[3]) r.appendChild(el('span', 'pill bad', String(x[3]))); r.onclick = x[2]; c.appendChild(r); }); v.appendChild(c); }
    var n = function (k) { return Q.byKind(k).length + ' total'; }, newApps = Q.byKind('applicant').filter(function (a) { return a.status === 'New'; }).length, unp = Q.byKind('invoice').filter(function (r) { return r.status === 'Sent'; }).length;
    group('Rentals', [['Properties', n('property'), open('property')], ['Units', n('unit'), open('unit')], ['Applications', n('applicant'), open('applicant'), newApps ? newApps + ' new' : ''], ['Leases', n('lease'), open('lease')], ['Inspections', n('inspection'), open('inspection')]]);
    group('Finances', [['Rent ledger', n('payment'), open('payment')], ['Invoices', n('invoice'), open('invoice'), unp ? unp + ' open' : ''], ['Expenses', n('expense'), open('expense')], ['Recurring bills', n('bill'), open('bill')], ['Reports and tax summary', 'Income, expenses, by property', open('reports')]]);
    var un = unread();
    group('People', [['Messages', 'Talk with your tenants', open('messages'), un ? un + ' new' : ''], ['Vendors', n('vendor'), open('vendor')], ['Letters and notices', 'Late rent, rent increase, entry, renewal', function () { letters(); }]]);
  };

  // ---------- Today: things that need a look ----------
  A.watch.push({ l: 'Applications to review', fn: function (rs) { return rs.filter(function (r) { return r.kind === 'applicant' && (r.status === 'New' || r.status === 'Screening'); }); }, sub: function (r) { return r.status; } });
  A.watch.push({ l: 'Unpaid invoices', fn: function (rs, t) { return rs.filter(function (r) { return r.kind === 'invoice' && r.status === 'Sent' && r.due && r.due < t; }); }, sub: function (r) { return 'Due ' + fmt(r.due) + ' · ' + money(r.amount); } });

  function boot() {
    Q.views.messages = messagesView; Q.views.reports = reportsView;
    Q.extras.push(function (v) { v.appendChild(el('h2', '', 'Business profile')); var c = el('div', 'card'); v.appendChild(c); var p = prof(); c.appendChild(el('div', 'hint', [p.phone, p.email, p.address].filter(Boolean).join(' · ') || 'Add your phone, address and how tenants pay you. It appears on leases, invoices and letters.')); var b = el('button', 'btn ghost', 'Edit business profile'); b.type = 'button'; b.style.cssText = 'display:block;width:100%;margin-top:8px'; b.onclick = profileModal; c.appendChild(b); });
    Q.onStart.push(function () { bindMessages(); }); if (Q.S.biz) bindMessages();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  A.fn = { letters: letters, profileModal: profileModal, unread: unread };
  window.VQ_LL = window.VQ_LL || {}; window.VQ_LL.unread = unread;
})();

// ===== Landlord: move-in and move-out steps, unit history, rent reminders =====
(function () {
  'use strict';
  var A = window.VQ_APP, K = A.kinds, u = null;
  function U() { return u || (u = Q.u); }
  function el(t, c, x) { return U().el(t, c, x); }
  function money(c) { return U().money(c); }
  function cents(s) { var t = String(s == null ? '' : s).replace(/[$,\s]/g, ''); if (t === '' || !/^\d*\.?\d{0,2}$/.test(t) || t === '.') return null; return Math.round(parseFloat(t) * 100); }
  function fmt(d) { return d ? U().fmtDate(d) : ''; }
  function upd(id, d) { d.updatedAt = Q.FV.serverTimestamp(); return Q.recs().doc(id).update(d); }
  function add(kind, d) { d.kind = kind; d.by = (Q.S.user.email || '').split('@')[0].slice(0, 30); d.createdAt = Q.FV.serverTimestamp(); d.updatedAt = Q.FV.serverTimestamp(); return Q.recs().add(d); }
  function pad(n) { return ('0' + n).slice(-2); }
  function act(label) { var a = (K.tenant.actions || []).filter(function (x) { return x.l === label; })[0]; return a; }
  function shareText(t, text) { if (navigator.share) { navigator.share({ title: t, text: text }).catch(function () { /* cancelled */ }); return; } try { navigator.clipboard.writeText(text).then(function () { Q.toast('Copied.'); }, function () { Q.toast('Press and hold the text to copy it.'); }); } catch (e) { Q.toast('Press and hold the text to copy it.'); } }
  function textModal(t, text) { Q.modal(function (s, close) { s.appendChild(el('h3', '', t)); var ta = el('textarea'); ta.value = text; ta.rows = 11; ta.maxLength = 20000; s.appendChild(ta); var b = el('div', 'btns'), c = el('button', 'btn', navigator.share ? 'Share' : 'Copy'), x = el('button', 'btn ghost', 'Close'); c.type = x.type = 'button'; c.onclick = function () { shareText(t, ta.value); }; x.onclick = close; b.appendChild(c); b.appendChild(x); s.appendChild(b); }); }
  function fresh(id) { return Q.get(id) || {}; }

  // ---- steps ----
  function inspectionFor(t, type) { return Q.byKind('inspection').filter(function (i) { return i.unit === t.unit && i.type === type; })[0]; }
  function stepsModal(t0, mode) {
    Q.modal(function (s, close) {
      var box = el('div'); s.appendChild(el('h3', '', (mode === 'in' ? 'Move-in steps: ' : 'Move-out steps: ') + t0.name)); s.appendChild(box);
      var x = el('button', 'btn ghost', 'Close'); x.type = 'button'; x.style.marginTop = '10px'; x.onclick = close; s.appendChild(x);
      function step(done, label, hint, btn, fn) {
        var r = el('div', 'row'), m = el('div', 'm'); m.appendChild(el('b', '', (done ? '✓ ' : '○ ') + label)); if (hint) m.appendChild(el('span', '', hint)); r.appendChild(m);
        if (btn) { var b = el('button', done ? 'btn ghost sm' : 'btn sm', btn); b.type = 'button'; b.onclick = function () { fn(); }; r.appendChild(b); } box.appendChild(r);
      }
      function toggle(key, val) { return function () { var o = {}; o[key] = val; upd(t0.id, o).then(draw, function (e) { Q.toast(Q.friendly(e)); }); }; }
      function draw() {
        box.textContent = ''; var t = fresh(t0.id), leases = Q.byKind('lease').filter(function (l) { return l.tenant === t.id; }), lease = leases[0];
        if (mode === 'in') {
          step(!!t.unit, 'Unit chosen', t.unit ? Q.title(Q.get(t.unit)) : 'Open the tenant and choose the unit', '', null);
          step(!!(lease || t.leaseSigned), 'Lease', lease ? 'Lease is ' + lease.status : (t.leaseSigned ? 'Marked signed' : 'No lease written yet'), lease ? 'Open' : 'Write', function () { if (lease) { close(); Q.S.tab = 'lease'; Q.render(); return; } add('lease', { tenant: t.id, unit: t.unit || null, status: 'Draft', start: t.leaseStart || U().today(), end: t.leaseEnd || U().addDays(U().today(), 364), rent: t.rent || 0, dueDay: +t.dueDay || 1, deposit: t.deposit || null, lateFee: t.lateFee || null, graceDays: t.graceDays || null }).then(function () { Q.toast('Lease draft created. Edit it in More > Leases.'); draw(); }, function (e) { Q.toast(Q.friendly(e)); }); });
          step(!!t.deposit, 'Security deposit', t.deposit ? money(t.deposit) + ' recorded' : 'Add it on the tenant record', '', null);
          var ins = inspectionFor(t, 'Move-in'); step(!!(t.moveInDone || (ins && ins.status === 'Done')), 'Move-in inspection', ins ? 'Inspection is ' + ins.status : 'Walk through with the room checklist', ins ? 'Open' : 'Schedule', function () { if (ins) { close(); Q.S.tab = 'inspection'; Q.render(); return; } if (!t.unit) { Q.toast('Choose a unit first.'); return; } add('inspection', { unit: t.unit, type: 'Move-in', date: t.leaseStart || U().today(), status: 'Scheduled' }).then(function () { Q.toast('Scheduled. Find it in More > Inspections.'); draw(); }, function (e) { Q.toast(Q.friendly(e)); }); });
          step(!!t.moveInDone, 'Inspection finished', '', t.moveInDone ? 'Undo' : 'Mark done', toggle('moveInDone', !t.moveInDone));
          step(!!t.keysGiven, 'Keys given', '', t.keysGiven ? 'Undo' : 'Mark done', toggle('keysGiven', !t.keysGiven));
          step(!!t.portalId, 'Tenant portal', t.portalId ? 'Invited' : 'Lets them see rent and message you', t.portalId ? '' : 'Invite', function () { var a = act('Invite to tenant portal'); close(); if (a) a.run(t); });
        } else {
          var oi = inspectionFor(t, 'Move-out');
          step(!!(t.finalInspection || (oi && oi.status === 'Done')), 'Move-out inspection', oi ? 'Inspection is ' + oi.status : 'Compare with the move-in checklist', oi ? 'Open' : 'Schedule', function () { if (oi) { close(); Q.S.tab = 'inspection'; Q.render(); return; } if (!t.unit) { Q.toast('Choose a unit first.'); return; } add('inspection', { unit: t.unit, type: 'Move-out', date: U().today(), status: 'Scheduled' }).then(function () { Q.toast('Scheduled.'); draw(); }, function (e) { Q.toast(Q.friendly(e)); }); });
          step(!!t.finalInspection, 'Inspection finished', '', t.finalInspection ? 'Undo' : 'Mark done', toggle('finalInspection', !t.finalInspection));
          step(!!t.keysBack, 'Keys returned', '', t.keysBack ? 'Undo' : 'Mark done', toggle('keysBack', !t.keysBack));
          var cost = 0; Q.byKind('repair').forEach(function (r) { if (r.unit === t.unit && r.status === 'Done' && r.cost && r.doneOn && t.leaseStart && r.doneOn >= t.leaseStart) cost += r.cost; });
          step(t.depositBack != null && !!t.depositBackOn, 'Deposit returned', t.deposit ? 'Held ' + money(t.deposit) + (t.depositBackOn ? ' · returned ' + money(t.depositBack || 0) + ' on ' + fmt(t.depositBackOn) : (cost ? ' · repairs since move-in ' + money(cost) : '')) : 'No deposit recorded', t.deposit ? 'Return it' : '', function () { depositModal(t, draw); });
          step(t.status === 'Moved out', 'Move out', t.status === 'Moved out' ? 'Done. The unit is marked Vacant.' : 'Marks the tenant moved out and the unit vacant', t.status === 'Moved out' ? '' : 'Finish', function () {
            Q.ask('Mark ' + t.name + ' as moved out and set the unit to Vacant?', 'Move out', function () { var p = upd(t.id, { status: 'Moved out' }); if (t.unit) p = p.then(function () { return upd(t.unit, { status: 'Vacant' }); }); p.then(function () { Q.toast('Moved out.'); draw(); }, function (e) { Q.toast(Q.friendly(e)); }); });
          });
        }
      }
      draw();
    });
  }
  function depositModal(t, done) {
    Q.modal(function (s, close) {
      s.appendChild(el('h3', '', 'Return the deposit')); s.appendChild(el('p', 'hint', 'Deposit held: ' + money(t.deposit || 0) + '. Many states require an itemized list of deductions and a deadline for returning it. Check yours.'));
      s.appendChild(el('label', 'f', 'Deductions')); var d = el('input'); d.inputMode = 'decimal'; d.placeholder = '0.00'; s.appendChild(d); s.appendChild(el('label', 'f', 'Date returned')); var dt = el('input'); dt.type = 'date'; dt.value = U().today(); s.appendChild(dt);
      var m = el('div', 'note'); s.appendChild(m); function upm() { var c = d.value.trim() === '' ? 0 : cents(d.value); m.textContent = c === null ? '' : 'Amount to return: ' + money(Math.max(0, (t.deposit || 0) - c)); } d.oninput = upm; upm();
      var b = el('div', 'btns'), go = el('button', 'btn', 'Save'), x = el('button', 'btn ghost', 'Cancel'); go.type = x.type = 'button'; b.appendChild(go); b.appendChild(x); s.appendChild(b); x.onclick = close;
      go.onclick = function () { var c = d.value.trim() === '' ? 0 : cents(d.value); if (c === null || c > (t.deposit || 0)) { m.className = 'note err'; m.textContent = 'Deductions must be an amount up to the deposit.'; return; } go.disabled = true; upd(t.id, { depositBack: Math.max(0, (t.deposit || 0) - c), depositBackOn: dt.value || U().today() }).then(function () { close(); Q.toast('Saved.'); if (done) done(); }, function (e) { m.textContent = Q.friendly(e); go.disabled = false; }); };
    });
  }
  K.tenant.actions = (K.tenant.actions || []).concat([
    { l: 'Move-in steps', show: function (r) { return r.status !== 'Moved out'; }, run: function (r) { stepsModal(r, 'in'); } },
    { l: 'Move-out steps', run: function (r) { stepsModal(r, 'out'); } }]);

  // ---- unit history ----
  K.unit.actions = (K.unit.actions || []).concat([{ l: 'History of this unit', run: function (r) {
    var L = ['HISTORY: ' + Q.title(r), ''], ts = Q.byKind('tenant').filter(function (t) { return t.unit === r.id; }).sort(function (a, b) { return (b.leaseStart || '') < (a.leaseStart || '') ? -1 : 1; }), rp = Q.byKind('repair').filter(function (x) { return x.unit === r.id; }), spent = 0, paid = 0;
    L.push('TENANTS'); if (!ts.length) L.push('  None recorded.'); ts.forEach(function (t) { L.push('  ' + t.name + ' · ' + (t.leaseStart ? fmt(t.leaseStart) : '?') + ' to ' + (t.status === 'Moved out' ? 'moved out' : (t.leaseEnd ? fmt(t.leaseEnd) : 'now')) + (t.rent ? ' · ' + money(t.rent) + '/mo' : '')); Q.byKind('payment').forEach(function (p) { if (p.tenant === t.id) paid += p.amount || 0; }); });
    L.push('', 'REPAIRS'); if (!rp.length) L.push('  None recorded.'); rp.sort(function (a, b) { return (b.doneOn || '') < (a.doneOn || '') ? -1 : 1; }).forEach(function (x) { if (x.status === 'Done' && x.cost) spent += x.cost; L.push('  ' + (x.doneOn ? fmt(x.doneOn) : x.status) + ' · ' + x.issue + (x.cost ? ' · ' + money(x.cost) : '') + (x.vendor ? ' · ' + x.vendor : '')); });
    var is = Q.byKind('inspection').filter(function (x) { return x.unit === r.id; }); L.push('', 'INSPECTIONS'); if (!is.length) L.push('  None recorded.'); is.forEach(function (x) { L.push('  ' + fmt(x.date) + ' · ' + x.type + ' · ' + x.status); });
    L.push('', 'Rent received from these tenants: ' + money(paid), 'Repair spending: ' + money(spent));
    textModal('Unit history', L.join('\n'));
  } }]);

  // ---- rent reminders ----
  function firstName(t) { return String(t.name || 'there').split(/\s+/)[0]; }
  function dueList() {
    var out = [], td = U().today(), now = new Date();
    Q.byKind('tenant').forEach(function (t) {
      if (t.status === 'Moved out' || !t.rent) return; var od = A.overdueOf ? A.overdueOf(t, Q.S.recs) : [];
      if (od.length) { var o = od[0]; out.push({ t: t, late: true, due: o.due, ym: o.ym, days: o.days }); return; }
      var day = Math.min(28, Math.max(1, +t.dueDay || 1)), d = new Date(now.getFullYear(), now.getMonth(), day), ds = U().ymd(d), ym = ds.slice(0, 7);
      if (U().diff(ds, td) < 0) { d = new Date(now.getFullYear(), now.getMonth() + 1, day); ds = U().ymd(d); ym = ds.slice(0, 7); }
      var days = U().diff(ds, td); if (days < 0 || days > 5) return; if (t.leaseStart && ds < t.leaseStart) return;
      var paid = Q.S.recs.some(function (p) { return p.kind === 'payment' && p.tenant === t.id && (p.forMonth === ym || (!p.forMonth && String(p.date || '').slice(0, 7) === ym)); }); if (!paid) out.push({ t: t, late: false, due: ds, ym: ym, days: days });
    });
    return out;
  }
  function reminderText(x) {
    var t = x.t, p = (Q.S.biz && Q.S.biz.profile) || {}, who = (Q.S.biz && Q.S.biz.name) || '';
    if (x.late) return 'Hi ' + firstName(t) + ', this is a reminder that rent of ' + money(t.rent) + ' was due ' + fmt(x.due) + ' and I have not received it yet.' + (t.lateFee ? ' A late fee of ' + money(t.lateFee) + ' may apply under your lease.' : '') + ' If you already paid, please let me know. Thank you. ' + who;
    return 'Hi ' + firstName(t) + ', a friendly reminder that rent of ' + money(t.rent) + ' is due ' + fmt(x.due) + '.' + (p.payInfo ? ' ' + p.payInfo + '.' : '') + ' Thank you. ' + who;
  }
  function remindersModal() {
    var list = dueList();
    Q.modal(function (s, close) {
      s.appendChild(el('h3', '', 'Rent reminders')); if (!list.length) { s.appendChild(el('p', 'hint', 'Nobody needs a reminder. Rent that is late, or due in the next 5 days and not paid, shows up here.')); }
      var picks = [];
      list.forEach(function (x) { var r = el('label', 'row'); r.style.cursor = 'pointer'; var c = el('input'); c.type = 'checkbox'; c.checked = true; c.style.cssText = 'width:20px;height:20px;flex:none'; var m = el('div', 'm'); m.appendChild(el('b', '', x.t.name)); m.appendChild(el('span', '', (x.late ? 'Late ' + x.days + ' day' + (x.days === 1 ? '' : 's') + ' · ' : 'Due ' + fmt(x.due) + ' · ') + money(x.t.rent) + (x.t.portalId ? ' · in portal' : ' · no portal'))); r.appendChild(c); r.appendChild(m); s.appendChild(r); picks.push({ x: x, c: c }); });
      if (list.length) s.appendChild(el('p', 'hint', 'Tenants in the portal get the message there the next time they open it. Tenants do not get a phone alert yet. For everyone else, you can share the text yourself.'));
      var er = el('div', 'note'); s.appendChild(er); var b = el('div', 'btns'); s.appendChild(b);
      if (list.length) {
        var go = el('button', 'btn', 'Send to portal'), sh = el('button', 'btn ghost', 'Share text'); go.type = sh.type = 'button'; b.appendChild(go); b.appendChild(sh);
        go.onclick = function () {
          var sel = picks.filter(function (p) { return p.c.checked && p.x.t.portalId && p.x.t.email; }); if (!sel.length) { er.className = 'note err'; er.textContent = 'Pick tenants who are in the portal.'; return; } go.disabled = true;
          Promise.all(sel.map(function (p) { return Q.db.collection('tenantMsgs').add({ portalId: p.x.t.portalId, bizId: Q.S.biz.id, tenantEmail: String(p.x.t.email).trim().toLowerCase(), from: 'landlord', body: reminderText(p.x).slice(0, 1000), status: 'new', createdAt: Q.FV.serverTimestamp() }); })).then(function () { close(); Q.toast('Sent to ' + sel.length + ' tenant' + (sel.length === 1 ? '' : 's') + '.'); if (window.VQ_LL && VQ_LL.portal) VQ_LL.portal.after(sel.map(function (p) { return p.x.t; }), 'a rent reminder'); }, function (e) { go.disabled = false; er.className = 'note err'; er.textContent = Q.friendly(e); });
        };
        sh.onclick = function () { var sel = picks.filter(function (p) { return p.c.checked; }); if (!sel.length) return; close(); textModal('Rent reminders', sel.map(function (p) { return p.x.t.name + ':\n' + reminderText(p.x); }).join('\n\n')); };
      }
      var x = el('button', 'btn ghost', 'Close'); x.type = 'button'; x.onclick = close; b.appendChild(x);
    });
  }
  var oldHub = A.hub;
  A.hub = function (v) {
    oldHub(v); var n = dueList().length; if (!n) { return; }
    var c = el('div', 'card'), r = el('div', 'row tap'), m = el('div', 'm'); m.appendChild(el('b', '', 'Rent reminders')); m.appendChild(el('span', '', 'Send a reminder to tenants who are late or due soon')); r.appendChild(m); r.appendChild(el('span', 'pill bad', String(n))); r.onclick = remindersModal; c.appendChild(r);
    var first = v.querySelector('h2'); var hs = v.querySelectorAll('h2'); var money2 = null; for (var i = 0; i < hs.length; i++) if (hs[i].textContent === 'Finances') money2 = hs[i]; if (money2 && money2.nextSibling) { v.insertBefore(el('h2', '', 'Needs attention'), money2); v.insertBefore(c, money2); }
  };
  function bootR() {
    Q.banners = Q.banners || [];
    if (false) Q.banners.push(function (v) {
      var n = dueList().length; if (!n) return; var b = el('button', 'vq-note blue'); b.type = 'button'; var d = el('span', 'dot', String(n)), t = el('div', 't'); t.appendChild(el('b', '', n + (n === 1 ? ' tenant needs' : ' tenants need') + ' a rent reminder')); t.appendChild(el('span', '', 'Late or due in the next 5 days')); b.appendChild(d); b.appendChild(t); b.appendChild(el('span', 'go', '\u203a')); b.onclick = remindersModal; v.appendChild(b);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootR); else bootR();

  // ---------- home dashboard: everything that needs the landlord, in one place ----------
  function homeNote(v, n, cls, title, sub, fn) {
    if (!n) return; var b = el('button', 'vq-note ' + cls); b.type = 'button'; var d = el('span', 'dot', String(n)), t = el('div', 't'); t.appendChild(el('b', '', title)); t.appendChild(el('span', '', sub));
    b.appendChild(d); b.appendChild(t); b.appendChild(el('span', 'go', '\u203a')); b.onclick = fn; v.appendChild(b);
  }
  function go(id) { return function () { Q.S.tab = id; Q.S.q = ''; Q.S.calSel = null; Q.render(); window.scrollTo(0, 0); }; }
  function bootHome() {
    Q.banners = Q.banners || [];
    Q.banners.push(function (v) {
      var urgent = Q.byKind('repair').filter(function (r) { return r.status !== 'Done' && r.urgent; }).length;
      var newApps = Q.byKind('applicant').filter(function (a) { return a.status === 'New'; }).length;
      homeNote(v, urgent, 'red', urgent + (urgent === 1 ? ' urgent repair' : ' urgent repairs'), 'Not done yet', go('repair'));
      var rc = (window.VQ_LL && VQ_LL.reqCount && VQ_LL.reqCount()) || 0, un = (window.VQ_LL && VQ_LL.unread && VQ_LL.unread()) || 0;
      homeNote(v, rc, 'red', rc + (rc === 1 ? ' repair request from a tenant' : ' repair requests from tenants'), 'Make it a repair order or dismiss it', function () { VQ_LL.requests(); });
      homeNote(v, un, 'blue', un + (un === 1 ? ' new message from a tenant' : ' new messages from tenants'), 'Tap to read and reply', go('messages'));
      var calm = Math.max(0, Q.byKind('repair').filter(function (r) { return r.status === 'New' && !r.urgent; }).length);
      homeNote(v, calm, 'blue', calm + (calm === 1 ? ' new repair order' : ' new repair orders'), 'Waiting to be scheduled', go('repair'));
      homeNote(v, newApps, 'blue', newApps + (newApps === 1 ? ' new rental application' : ' new rental applications'), 'Contact them or move them along', go('applicant'));
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootHome); else bootHome();
})();


// Contractor-style menu, quick buttons and starter checklist for Landlord.
(function () {
  var A = window.VQ_APP;
  function go(id) { return function () { Q.S.tab = id; Q.S.q = ''; Q.S.calSel = null; Q.render(); window.scrollTo(0, 0); }; }
  function newApps() { return Q.byKind('applicant').filter(function (a) { return a.status === 'New'; }).length; }
  A.menu = function () {
    var F = A.fn || {};
    return [
      { h: 'Work', items: [
        { l: 'Applications', tab: 'applicant', badge: newApps },
        { l: 'Properties', tab: 'property' }, { l: 'Units', tab: 'unit' }, { l: 'Tenants', tab: 'tenant' },
        { l: 'Repairs', tab: 'repair' }, { l: 'Leases', tab: 'lease' }, { l: 'Inspections', tab: 'inspection' }] },
      { h: 'Community', items: Q.communityMenu ? Q.communityMenu() : [] },
      { h: 'Finances', items: [
        { l: 'Rent ledger', tab: 'payment' }, { l: 'Invoices', tab: 'invoice' }, { l: 'Expenses', tab: 'expense' },
        { l: 'Recurring bills', tab: 'bill' }, { l: 'Reports and tax summary', tab: 'reports' }, { l: 'Pay with Vyqil setup', run: function () { var p = Q.payMenu()[0]; if (p) p.run(); } }] },
      { h: 'People', items: [
        { l: 'Messages', tab: 'messages', badge: function () { return F.unread ? F.unread() : 0; } },
        { l: 'Vendors', tab: 'vendor' },
        { l: 'Letters and notices', run: function () { if (F.letters) F.letters(); } }] },
      { h: 'Business', items: [
        { l: 'Business profile', run: function () { if (F.profileModal) F.profileModal(); } }] }
    ];
  };
  A.quick = [
    { l: 'Tenants', tab: 'tenant' }, { l: 'Properties', tab: 'property' }, { l: 'Messages', tab: 'messages' }
  ];
  A.starter = function () {
    var F = A.fn || {};
    return [
      { id: 'prof', t: 'Add your business profile', h: 'Phone, address and how tenants pay you. It prints on leases and letters.', done: function () { var b = Q.S.biz || {}, p = b.profile || {}; return !!(p.phone || p.email || p.address); }, run: function () { if (F.profileModal) F.profileModal(); } },
      { id: 'prop', t: 'First, add a property', h: 'A building, house or complex you manage.', kind: 'property', form: 'property' },
      { id: 'unit', t: 'Next, add a unit', h: 'An apartment or house inside that property.', kind: 'unit', form: 'unit' },
      { id: 'ten', t: 'Add your tenants', h: 'Who lives in each unit, their rent and due day.', kind: 'tenant', form: 'tenant' },
      { id: 'lease', t: 'Write a lease', h: 'Create a lease from the tenant details.', kind: 'lease', form: 'lease' },
      { id: 'inv', t: 'Invite your tenants to the portal', h: 'One tap emails an invite to every tenant who is not in yet.', done: function (rs) { var ts = rs.filter(function (r) { return r.kind === 'tenant' && r.status !== 'Moved out'; }); return ts.some(function (r) { return r.portalId; }) && !(Q.portalPending && Q.portalPending()); }, run: function () { if (Q.portalPending && Q.portalPending()) Q.portalInviteAll(); else go('tenant')(); } },
      { id: 'comm', t: 'Set up Vyqil Community', h: 'Be found by nearby Vyqil businesses, and find them.', manual: true, run: function () { if (Q.community) Q.community.listing(); } },
      { id: 'alerts', t: 'Turn on phone alerts', h: 'Get rent and repair alerts when the app is closed.', manual: true, run: function () { Q.push.panel(); } }
    ];
  };
})();

// ===== Tenant portal: sharing the link, sending things to the portal, and the text message that goes with it =====
(function () {
  var A = window.VQ_APP, K = A.kinds, LL = window.VQ_LL = window.VQ_LL || {};
  function el(t, c, x) { return Q.u.el(t, c, x); }
  function first(t) { return String((t && t.name) || 'there').split(/\s+/)[0]; }
  function digits(p) { return String(p || '').replace(/[^\d+]/g, ''); }
  function enc(x) { return encodeURIComponent(x); }
  function url(t) { return LL.tenantUrl(t); }
  function biz() { return LL.bizName(); }
  function goodEmail(e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(e || '').trim()); }
  function linkMessage(t) { return 'Hi ' + first(t) + ',\n\nYou can see your rent, your payment history and send me repair requests in your tenant portal:\n' + url(t) + '\n\nSign in with your email and password. If you have not set a password yet, use the email we sent, or tap "Forgot your password?" on that page.\n\nThank you,\n' + biz(); }

  // Copies the link and nothing else.
  function copyLink(t) {
    var u = url(t);
    function fallback() {
      Q.modal(function (s, close) {
        s.appendChild(el('h3', '', 'Tenant portal link')); var i = el('input'); i.value = u; i.readOnly = true; s.appendChild(i); s.appendChild(el('div', 'note', 'Press and hold the link to copy it.'));
        var b = el('div', 'btns'), x = el('button', 'btn ghost', 'Close'); x.type = 'button'; x.onclick = close; b.appendChild(x); s.appendChild(b); setTimeout(function () { try { i.focus(); i.select(); } catch (e) { /* ignore */ } }, 60);
      });
    }
    try { navigator.clipboard.writeText(u).then(function () { Q.toast('Link copied.'); }, fallback); } catch (e) { fallback(); }
  }
  function emailLink(t) {
    var e = String(t.email || '').trim(); if (!goodEmail(e)) { Q.toast('Add ' + first(t) + '\'s email first.'); return; }
    location.href = 'mailto:' + e + '?subject=' + enc(biz() + ': your tenant portal') + '&body=' + enc(linkMessage(t).replace(/\n/g, '\r\n'));
  }
  function smsTo(t, body) {
    var p = digits(t.phone); if (p.length < 7) { Q.toast('Add ' + first(t) + '\'s phone number first.'); return; }
    location.href = 'sms:' + p + '?&body=' + enc(body);
  }
  function textLink(t) { smsTo(t, 'Hi ' + first(t) + ', here is your tenant portal link: ' + url(t) + ' - ' + biz()); }
  function linkModal(t) {
    Q.modal(function (s, close) {
      s.appendChild(el('h3', '', 'Tenant portal link for ' + (t.name || 'the tenant'))); var i = el('input'); i.value = url(t); i.readOnly = true; s.appendChild(i);
      var b = el('div', 'btns'), c = el('button', 'btn', 'Copy link'), em = el('button', 'btn ghost', 'Email the link'), tx = el('button', 'btn ghost', 'Text the link'), x = el('button', 'btn ghost', 'Close');
      [c, em, tx, x].forEach(function (n) { n.type = 'button'; b.appendChild(n); }); c.onclick = function () { copyLink(t); }; em.onclick = function () { emailLink(t); }; tx.onclick = function () { textLink(t); }; x.onclick = close; s.appendChild(b);
    });
  }

  // A message to the tenant's portal. Long text is cut into several messages because each one holds 1000 characters.
  function chunks(text) {
    var out = [], cur = ''; String(text).split(/\n\n/).forEach(function (p) { while (p.length > 950) { if (cur) { out.push(cur); cur = ''; } out.push(p.slice(0, 950)); p = p.slice(950); } if ((cur + '\n\n' + p).length > 950) { out.push(cur); cur = p; } else cur = cur ? cur + '\n\n' + p : p; });
    if (cur) out.push(cur); return out.slice(0, 8);
  }
  function send(t, title, body) {
    var parts = chunks((title ? title + '\n\n' : '') + body), em = String(t.email || '').trim().toLowerCase(), seq = Promise.resolve();
    parts.forEach(function (p) { seq = seq.then(function () { return Q.db.collection('tenantMsgs').add({ portalId: t.portalId, bizId: Q.S.biz.id, tenantEmail: em, from: 'landlord', body: p, status: 'new', createdAt: Q.FV.serverTimestamp() }); }); });
    return seq;
  }
  // After something goes to the portal, offer a text message so the tenant knows to look. One or many tenants.
  function after(list, what) {
    list = (Array.isArray(list) ? list : [list]).filter(Boolean); if (!list.length) return;
    Q.modal(function (s, close) {
      s.appendChild(el('h3', '', 'Sent to the tenant portal'));
      s.appendChild(el('p', 'hint', 'Tenants do not get a phone alert from the portal. Send a text message so they know to look.'));
      list.forEach(function (t) {
        var r = el('div', 'row'), m = el('div', 'm'); m.appendChild(el('b', '', t.name || 'Tenant')); m.appendChild(el('span', '', digits(t.phone).length >= 7 ? t.phone : 'No phone number on file')); r.appendChild(m);
        var b = el('button', 'btn sm', 'Send text message'); b.type = 'button'; b.disabled = digits(t.phone).length < 7; b.onclick = function () { smsTo(t, 'Hi ' + first(t) + ', I sent you ' + (what || 'something') + ' in your tenant portal: ' + url(t) + ' - ' + biz()); }; r.appendChild(b); s.appendChild(r);
      });
      var b2 = el('div', 'btns'), x = el('button', 'btn ghost', 'Done'); x.type = 'button'; x.onclick = close; b2.appendChild(x); s.appendChild(b2);
    });
  }
  function textHeadsUp(t, what) { smsTo(t, 'Hi ' + first(t) + ', I sent you ' + (what || 'something') + ' in your tenant portal: ' + url(t) + ' - ' + biz()); }
  // The "Send to tenant portal" button that sits next to Share / Copy / Print.
  function addButton(row, t, title, getText, close) {
    if (!t || !t.portalId) return;
    var b = el('button', 'btn', 'Send to tenant portal'); b.type = 'button';
    b.onclick = function () { b.disabled = true; b.textContent = 'Sending...'; send(t, title, getText()).then(function () { if (close) close(); Q.toast('Sent to the tenant portal.'); after(t, title.toLowerCase().indexOf('invoice') > -1 ? 'an invoice' : title.toLowerCase().indexOf('lease') > -1 ? 'your lease' : 'a message'); }, function (e) { b.disabled = false; b.textContent = 'Send to tenant portal'; Q.toast(Q.friendly(e)); }); };
    row.insertBefore(b, row.firstChild);
  }
  LL.portal = { copyLink: copyLink, emailLink: emailLink, textLink: textLink, linkModal: linkModal, send: send, after: after, addButton: addButton, textHeadsUp: textHeadsUp };

  // Invoices and leases go straight to the portal too.
  function tenantOf(r) { return r.tenant ? Q.get(r.tenant) : null; }
  K.invoice.actions.unshift({ l: 'Send invoice to tenant portal', show: function (r) { var t = tenantOf(r); return !!(t && t.portalId) && r.status !== 'Void'; }, run: function (r) {
    var t = tenantOf(r), txt = 'INVOICE ' + (r.number || '') + '\n' + (r.description || '') + '\nAmount due: ' + Q.u.money(r.amount) + (r.due ? '\nDue: ' + Q.u.fmtDate(r.due) : '') + (r.notes ? '\n' + r.notes : '');
    var go = function () { LL.syncOne(t, true).catch(function () { /* the message still goes */ }); send(t, '', txt).then(function () { Q.toast('Invoice sent to the tenant portal.'); after(t, 'an invoice'); }, function (e) { Q.toast(Q.friendly(e)); }); };
    if (r.status === 'Draft') Q.recs().doc(r.id).update({ status: 'Sent', updatedAt: Q.FV.serverTimestamp() }).then(go, function (e) { Q.toast(Q.friendly(e)); }); else go();
  } });
})();

// Every tenant portal option sits in one drop-down on the tenant page.
(function () {
  var A = window.VQ_APP, ta = A.kinds.tenant.actions || [];
  ta.forEach(function (a) { if (/portal/i.test(a.l)) a.group = 'Tenant portal'; });
  var first = ta.filter(function (a) { return a.group; });
  A.kinds.tenant.actions = ta.filter(function (a) { return !a.group; }).concat(first);
})();

// Insurance renewals get their own calendar color.
(function () { var A = window.VQ_APP; A.calColors = [{ m: /insurance/i, c: '#a6e22e' }].concat(A.calColors || []); })();

// ===== Pay with Vyqil for Landlord: pay an invoice or collect rent by QR code (USDC, 2% Vyqil fee paid by the landlord) =====
(function () {
  var A = window.VQ_APP;
  function today() { return Q.u.today(); }
  function ym(d) { return String(d || today()).slice(0, 7); }
  function addPay(data) { data.kind = 'payment'; data.by = (Q.S.user.email || '').split('@')[0].slice(0, 30); data.createdAt = Q.FV.serverTimestamp(); data.updatedAt = Q.FV.serverTimestamp(); return Q.recs().add(data); }
  function seen(sig) { return Q.byKind('payment').some(function (p) { return p.paySig === sig; }); }
  function note(req, sig) { return ('Pay with Vyqil, USDC' + (req.net === 'mainnet' ? '' : ' (TEST)') + ' · ' + sig.slice(0, 12)).slice(0, 300); }
  function tenOf(r) { return r.kind === 'tenant' ? r : (r.tenant ? Q.get(r.tenant) : null); }
  function viaPortal(r, text) { var t = tenOf(r), LL = window.VQ_LL; if (!t || !t.portalId || !LL || !LL.portal) return Promise.reject({ message: 'This tenant has no portal yet.' }); return LL.portal.send(t, '', text).then(function () { try { LL.portal.after(t, 'a payment link'); } catch (e) { /* optional */ } }); }
  function canPortal(r) { var t = tenOf(r); return !!(t && t.portalId); }
  function contact(r) { var t = tenOf(r) || {}; return { phone: t.phone, email: t.email }; }
  A.pay = { items: [
    { kind: 'invoice', portalSend: viaPortal, canPortal: canPortal, contact: contact, label: function (r) { return 'Invoice ' + (r.number || ''); }, show: function (r) { return r.status !== 'Paid' && r.status !== 'Void' && (+r.amount || 0) >= 50; }, cents: function (r) { return Math.round(+r.amount || 0); },
      onPaid: async function (r, found, req) {
        var cur = Q.get(r.id); if ((cur && cur.status === 'Paid') || seen(found.signature)) throw { code: 'vq/already' };
        await addPay({ tenant: r.tenant || null, date: today(), amount: req.usdCents, forMonth: ym(r.due), method: 'Crypto', notes: note(req, found.signature), paySig: found.signature });
        await Q.recs().doc(r.id).update({ status: 'Paid', paySig: found.signature, updatedAt: Q.FV.serverTimestamp() });
      } },
    { kind: 'tenant', action: 'Collect rent with Pay with Vyqil', linkAction: 'Send a rent pay link', portalSend: viaPortal, canPortal: canPortal, contact: contact, editable: true, label: function () { return 'Rent'; }, show: function (r) { return r.status !== 'Moved out' && (+r.rent || 0) >= 50; }, cents: function (r) { return Math.round(+r.rent || 0); },
      onPaid: async function (r, found, req) {
        if (seen(found.signature)) throw { code: 'vq/already' };
        var od = A.overdueOf ? A.overdueOf(r, Q.S.recs) : [], month = od.length ? od[0].ym : ym();
        await addPay({ tenant: r.id, date: today(), amount: req.usdCents, forMonth: month, method: 'Crypto', notes: note(req, found.signature), paySig: found.signature });
      } }
  ] };
  var oldStarter = A.starter;
  A.starter = function () { var st = oldStarter(); st.push({ id: 'pay', t: 'Set up Pay with Vyqil', h: 'Optional. Collect rent and invoices by QR code, paid in dollar coins.', done: function () { return !!(Q.S.biz && Q.S.biz.payWallet); }, run: function () { if (Q.pay) Q.pay.setup(); } }); return st; };
})();

// Tenants are listed A to Z.
(function () { window.VQ_APP.kinds.tenant.sort = function (a, b) { return String(a.name || '').toLowerCase().localeCompare(String(b.name || '').toLowerCase()); }; })();
