window.VQ_APP = {
  community: { product: 'photo', inbound: { addKind: 'client', addDefaults: { source: 'Vyqil Community' }, addLabel: 'Add as client', inboxTitle: 'Requests near you', listTitle: 'My studio in the community', catLabel: 'What you shoot' } },
  id: 'photo', name: 'VyqilPhoto', who: 'For photographers and videographers', tag: 'Bookings, deposits and delivery.', alertText: 'shoots, balances due and gallery deadlines',
  tabKinds: ['booking', 'client', 'package'],
  checklists: { shoot: [{ t: 'Contract signed', off: -30 }, { t: 'Deposit received', off: -28 }, { t: 'Shot list and timeline sent', off: -7 }, { t: 'Balance due', off: -3 }, { t: 'Charge batteries and clear cards', off: -1 }, { t: 'Backup photos', off: 1 }, { t: 'Preview sent', off: 7 }, { t: 'Gallery delivered', off: 21 }] },
  kinds: {
    client: { label: 'Client', plural: 'Clients', icon: '👤', stage: 'source', addMenu: ['client', 'booking', 'package'],
      fields: [{ k: 'name', l: 'Name', t: 'text', req: 1 }, { k: 'phone', l: 'Phone', t: 'tel' }, { k: 'email', l: 'Email', t: 'email' }, { k: 'source', l: 'How they found you', t: 'select', o: ['Referral', 'Instagram', 'Website', 'Venue', 'Vyqil Community', 'Other'] }, { k: 'notes', l: 'Notes', t: 'area' }] },
    booking: { label: 'Booking', plural: 'Bookings', icon: '📷', stage: 'status', checklist: { tpl: 'shoot', name: 'shoot', base: 'date' }, addMenu: ['booking', 'client', 'package', 'expense'],
      closed: function (r) { return r.status === 'Delivered' || r.status === 'Cancelled'; }, sort: function (a, b) { return (a.date || '9') < (b.date || '9') ? -1 : 1; },
      title: function (r) { return (r.client ? Q.title(Q.get(r.client)) : 'Booking') + (r.type ? ' · ' + r.type : ''); },
      fields: [{ k: 'client', l: 'Client', t: 'link', to: 'client', req: 1 }, { k: 'type', l: 'Type of shoot', t: 'select', o: ['Wedding', 'Portrait', 'Family', 'Newborn', 'Real estate', 'Event', 'Commercial', 'Video', 'Other'] }, { k: 'status', l: 'Status', t: 'select', o: ['Inquiry', 'Booked', 'Shot', 'Editing', 'Delivered', 'Cancelled'], req: 1 },
        { k: 'followUp', l: 'Follow up on this inquiry', t: 'date', cal: 1, alert: { hour: 9 }, lbl: 'Follow up', doneIf: function (r) { return r.status !== 'Inquiry'; }, hint: 'For an inquiry that has not booked yet.' },
        { k: 'package', l: 'Package', t: 'link', to: 'package' },
        { k: 'date', l: 'Shoot date', t: 'date', cal: 1, alert: { hour: 7, eve: 1 }, timeField: 'time', lbl: 'Shoot', doneIf: function (r) { return r.status !== 'Booked'; } }, { k: 'time', l: 'Start time', t: 'time' }, { k: 'place', l: 'Location', t: 'text' }, { k: 'hours', l: 'Hours of coverage', t: 'number' },
        { k: 'total', l: 'Package price', t: 'money' }, { k: 'deposit', l: 'Deposit paid', t: 'money' },
        { k: 'balanceDue', l: 'Balance due date', t: 'date', cal: 1, alert: { hour: 9 }, lbl: 'Balance due', doneIf: function (r) { return !!r.paidRest || r.status === 'Cancelled' || r.status === 'Inquiry'; } },
        { k: 'balance', l: 'Balance', t: 'calc', fmt: 'money', f: owed }, { k: 'paidRest', l: 'Balance paid', t: 'check' },
        { k: 'deliverBy', l: 'Gallery due', t: 'date', cal: 1, alert: { hour: 9 }, lbl: 'Gallery due', doneIf: function (r) { return r.status === 'Delivered' || r.status === 'Cancelled'; } }, { k: 'galleryUrl', l: 'Gallery link', t: 'text', hint: 'Paste the link to the finished gallery, then text it to the client.' },
        { k: 'shots', l: 'Shot list and timeline', t: 'area' }, { k: 'helpers', l: 'Hired through Vyqil', t: 'text', hint: 'Filled in when you choose a Vyqil business from "Find a Vyqil".' }, { k: 'notes', l: 'Notes', t: 'area' }],
      amount: function (r) { return r.total || ''; }, sub: function (r) { return [r.date ? Q.u.fmtDate(r.date) : '', owed(r) ? 'Owes ' + Q.u.money(owed(r)) : ''].filter(Boolean).join(' · '); } },
    package: { label: 'Package', plural: 'Packages', icon: '🎁', stage: 'type', addMenu: ['package', 'booking', 'client'],
      fields: [{ k: 'name', l: 'Package name', t: 'text', req: 1 }, { k: 'type', l: 'Type of shoot', t: 'select', o: ['Wedding', 'Portrait', 'Family', 'Newborn', 'Real estate', 'Event', 'Commercial', 'Video', 'Other'] }, { k: 'price', l: 'Price', t: 'money', req: 1 }, { k: 'hours', l: 'Hours of coverage', t: 'number' }, { k: 'includes', l: 'What is included', t: 'area' }],
      amount: function (r) { return r.price || ''; }, sub: function (r) { return [r.type, r.hours ? r.hours + ' hr' : ''].filter(Boolean).join(' · '); } },
    expense: { label: 'Expense', plural: 'Expenses', icon: '🧾', stage: 'category', sort: function (a, b) { return (a.date || '') < (b.date || '') ? 1 : -1; },
      title: function (r) { return (r.category || 'Expense') + (r.note ? ' · ' + r.note : ''); },
      fields: [{ k: 'date', l: 'Date', t: 'date', req: 1 }, { k: 'amount', l: 'Amount', t: 'money', req: 1 }, { k: 'category', l: 'Category', t: 'select', o: ['Gear', 'Software and editing', 'Second shooter', 'Travel and mileage', 'Insurance', 'Marketing', 'Props and supplies', 'Fees', 'Other'], req: 1 }, { k: 'note', l: 'What it was for', t: 'text' }, { k: 'booking', l: 'For which booking', t: 'link', to: 'booking' }],
      amount: function (r) { return r.amount || ''; }, sub: function (r) { return r.date ? Q.u.fmtDate(r.date) : ''; } }
  },
  stats: [{ l: 'Upcoming shoots', fn: function (rs, t) { return rs.filter(function (r) { return r.kind === 'booking' && r.date >= t && r.status === 'Booked'; }).length; } },
    { l: 'To edit / deliver', fn: function (rs) { return rs.filter(function (r) { return r.kind === 'booking' && (r.status === 'Shot' || r.status === 'Editing'); }).length; } },
    { l: 'Balances owed', fn: function (rs) { var s = 0; rs.forEach(function (r) { if (counts(r)) s += owed(r); }); return Q.u.money(s); } }],
  watch: [
    { l: 'Balances past due', fn: function (rs, t) { return rs.filter(function (r) { return counts(r) && owed(r) > 0 && r.balanceDue && r.balanceDue < t; }); }, sub: function (r) { return Q.u.money(owed(r)) + ' was due ' + Q.u.fmtDate(r.balanceDue); } },
    { l: 'Galleries past due', fn: function (rs, t) { return rs.filter(function (r) { return r.kind === 'booking' && r.deliverBy && r.deliverBy < t && r.status !== 'Delivered' && r.status !== 'Cancelled' && r.status !== 'Inquiry'; }); }, sub: function (r) { return 'Was due ' + Q.u.fmtDate(r.deliverBy); } },
    { l: 'Shoots past due: update the status', fn: function (rs, t) { return rs.filter(function (r) { return r.kind === 'booking' && r.status === 'Booked' && r.date && r.date < t; }); }, sub: function (r) { return 'Shoot was ' + Q.u.fmtDate(r.date) + '. Mark it Shot.'; } },
    { l: 'Inquiry follow-ups past due', fn: function (rs, t) { return rs.filter(function (r) { return r.kind === 'booking' && r.status === 'Inquiry' && r.followUp && r.followUp < t; }); }, sub: function (r) { return 'Was due ' + Q.u.fmtDate(r.followUp); } },
    { l: 'Balance owed (not yet due)', fn: function (rs, t) { return rs.filter(function (r) { return counts(r) && owed(r) > 0 && !(r.balanceDue && r.balanceDue < t); }); }, sub: function (r) { return Q.u.money(owed(r)) + (r.balanceDue ? ' due ' + Q.u.fmtDate(r.balanceDue) : ''); } }]
};
// What the client still owes: the package price minus the deposit, until "Balance paid" is ticked.
function owed(r) { return r.paidRest ? 0 : Math.max(0, (r.total || 0) - (r.deposit || 0)); }
function counts(r) { return r.kind === 'booking' && r.status !== 'Cancelled' && r.status !== 'Inquiry'; }

// ===== Community, messages to clients, Pay with Vyqil, menu and Get started: same format as the other Vyqil apps =====
(function () {
  var A = window.VQ_APP, K = A.kinds;
  function clientOf(r) { return r.kind === 'client' ? r : (r.client ? Q.get(r.client) : null) || {}; }
  function sms(phone, body) { if (phone) window.location.href = 'sms:' + String(phone).replace(/[^\d+]/g, '') + (body ? '?&body=' + encodeURIComponent(body) : ''); }
  function addHelper(rec, o) { var cur = String(rec.helpers || ''); if (cur.indexOf(o.bizName) >= 0) return null; return { helpers: (cur ? cur + ', ' : '') + o.bizName }; }
  A.community.place = function (r) { return r && r.place ? r : null; };
  A.community.placeText = function (r) { return r.place; };
  A.community.places = function () { return Q.byKind('booking').filter(function (b) { return b.place; }); };
  A.community.chosen = { salon: addHelper, events: addHelper };
  K.client.actions = [
    { l: 'Call', show: function (r) { return !!r.phone; }, run: function (r) { window.location.href = 'tel:' + String(r.phone).replace(/[^\d+]/g, ''); } },
    { l: 'Text', show: function (r) { return !!r.phone; }, run: function (r) { sms(r.phone); } },
    { l: 'New booking for this client', run: function (r) { Q.openForm('booking', null, { client: r.id, status: 'Inquiry' }); } }];
  K.booking.actions = [
    { l: 'Text the gallery link', show: function (r) { return !!(r.galleryUrl && clientOf(r).phone); }, run: function (r) { var c = clientOf(r); sms(c.phone, 'Hi ' + String(c.name || '').split(/\s+/)[0] + ', your photos are ready: ' + r.galleryUrl + ' Thank you! ' + ((Q.S.biz && Q.S.biz.name) || '')); } },
    { l: 'Text a balance reminder', show: function (r) { return !!(owed(r) > 0 && clientOf(r).phone); }, run: function (r) { var c = clientOf(r); sms(c.phone, 'Hi ' + String(c.name || '').split(/\s+/)[0] + ', a friendly reminder that the balance of ' + Q.u.money(owed(r)) + (r.balanceDue ? ' is due ' + Q.u.fmtDate(r.balanceDue) : ' is due') + '. Thank you! ' + ((Q.S.biz && Q.S.biz.name) || '')); } },
    { l: 'Find hair and makeup', saveFirst: true, run: function (r) { Q.community.find(r, { target: 'salon', cat: 'Skin care and makeup', title: 'Hair and makeup for a shoot' }); } },
    { l: 'Find an event planner', saveFirst: true, run: function (r) { Q.community.find(r, { target: 'events', cat: r.type === 'Wedding' ? 'Wedding' : 'Other', title: 'Planner for a ' + (r.type || 'event') }); } }];
  // Pay with Vyqil: the client pays the balance by QR code (USDC, 2% Vyqil fee paid by the business).
  A.pay = { items: [
    { kind: 'booking', contact: function (r) { var c = clientOf(r); return { phone: c.phone, email: c.email }; }, label: function (r) { return 'Balance: ' + (r.type || 'shoot'); }, show: function (r) { return counts(r) && owed(r) >= 50; }, cents: function (r) { return owed(r); },
      onPaid: async function (r, found, req) {
        var cur = Q.get(r.id); if ((cur && cur.paidRest) || (cur && cur.paySig === found.signature)) throw { code: 'vq/already' };
        await Q.recs().doc(r.id).update({ paidRest: true, paySig: found.signature, payNote: ('Pay with Vyqil, USDC' + (req.net === 'mainnet' ? '' : ' (TEST)')).slice(0, 80), updatedAt: Q.FV.serverTimestamp() });
      } }] };
  function newInquiries() { return Q.byKind('booking').filter(function (b) { return b.status === 'Inquiry'; }).length; }
  A.menu = function () {
    return [
      { h: 'Work', items: [{ l: 'Bookings', tab: 'booking', badge: newInquiries }, { l: 'Clients', tab: 'client' }, { l: 'Packages', tab: 'package' }] },
      { h: 'Community', items: Q.communityMenu ? Q.communityMenu() : [] },
      { h: 'Finances', items: [{ l: 'Expenses', tab: 'expense' }, { l: 'Reports and tax summary', tab: 'reports' }, { l: 'Pay with Vyqil setup', run: function () { var p = Q.payMenu()[0]; if (p) p.run(); } }] }
    ];
  };
  A.quick = [{ l: 'Bookings', tab: 'booking' }, { l: 'Clients', tab: 'client' }, { l: 'Expenses', tab: 'expense' }];
  A.starter = function () {
    var st = [
      { id: 'pk', t: 'Add your packages', h: 'What you offer and what it costs. Pick one when you book a shoot.', kind: 'package', form: 'package' },
      { id: 'cl', t: 'Add a client', h: 'Name, phone and how they found you.', kind: 'client', form: 'client' },
      { id: 'bk', t: 'Book a shoot', h: 'Adds a shoot checklist, deposit and balance tracking, and a phone reminder.', kind: 'booking', form: 'booking' },
      { id: 'ex', t: 'Log an expense', h: 'Gear, travel, editing. Feeds your reports and tax summary.', kind: 'expense', form: 'expense' }];
    if (Q.portalInvite) st.push({ id: 'cinv', t: 'Invite your clients to the portal', h: 'One tap emails an invite to every client who is not in yet.', done: function (rs) { var p = Q.portalPending ? Q.portalPending() : []; return !p.length && rs.some(function (r) { return r.kind === 'client' && r.portalId; }); }, run: function () { if (Q.portalInviteAll) Q.portalInviteAll(); } });
    st.push({ id: 'pay', t: 'Set up Pay with Vyqil', h: 'Optional. Collect balances by QR code, paid in dollar coins.', done: function () { return !!(Q.S.biz && Q.S.biz.payWallet); }, run: function () { if (Q.pay) Q.pay.setup(); } });
    st.push({ id: 'alerts', t: 'Turn on phone alerts', h: 'Get reminders even when the app is closed.', manual: true, run: function () { Q.push.panel(); } });
    if (Q.community && Q.community.listing) st.push({ id: 'comm', t: 'Set up Vyqil Community', h: 'Be found by nearby Vyqil businesses, and find them.', manual: true, run: function () { Q.community.listing(); } });
    return st;
  };
})();

// ===== Reports and tax summary =====
(function () {
  function U() { return Q.u; }
  function el(t, c, x) { return U().el(t, c, x); }
  function money(c) { return U().money(c); }
  function collected(b) { return (b.deposit || 0) + (b.paidRest ? Math.max(0, (b.total || 0) - (b.deposit || 0)) : 0); }
  function incomeRows() { return Q.byKind('booking').filter(function (b) { return counts(b) && U().isDate(b.date) && collected(b) > 0; }).map(function (b) { return { date: b.date, amount: collected(b), client: b.client }; }); }
  function expRows() { return Q.byKind('expense').filter(function (e) { return U().isDate(e.date); }); }
  function sum(rows, f) { var s = 0; rows.forEach(function (x) { s += f ? f(x) : (x.amount || 0); }); return s; }
  function summaryFor(year) {
    var inc = sum(incomeRows().filter(function (x) { return x.date.slice(0, 4) === year; })), by = {}, ex = 0;
    expRows().filter(function (e) { return e.date.slice(0, 4) === year; }).forEach(function (e) { by[e.category || 'Other'] = (by[e.category || 'Other'] || 0) + (e.amount || 0); ex += e.amount || 0; });
    return { year: year, income: inc, expenses: ex, by: by };
  }
  function summaryText(s) { var t = 'Income and expenses ' + s.year + '\n\nIncome (money received, by shoot date): ' + money(s.income) + '\n\nExpenses: ' + money(s.expenses) + '\n'; Object.keys(s.by).sort().forEach(function (k) { t += '  ' + k + ': ' + money(s.by[k]) + '\n'; }); return t + '\nNet: ' + money(s.income - s.expenses) + '\n\nA record of what you entered, not tax advice.'; }
  function reportsView(v) {
    var TL = Q.tools, now = new Date(), ym = U().ymd(now).slice(0, 7), yr = String(now.getFullYear()), td = U().today();
    var inc = incomeRows(), exp = expRows();
    v.appendChild(el('h2', '', 'Reports')); var st = el('div', 'stat');
    [[money(sum(inc.filter(function (x) { return x.date.slice(0, 7) === ym; }))), 'Received this month'], [money(sum(exp.filter(function (e) { return e.date.slice(0, 7) === ym; }))), 'Expenses'], [money(sum(Q.byKind('booking').filter(counts), owed)), 'Owed to you']].forEach(function (x) { var d = el('div'); d.appendChild(el('b', '', x[0])); d.appendChild(el('span', '', x[1])); st.appendChild(d); });
    v.appendChild(st);
    v.appendChild(el('h2', '', 'Who owes you')); var c1 = el('div', 'card'); v.appendChild(c1); var ag = [0, 0, 0];
    Q.byKind('booking').filter(function (b) { return counts(b) && owed(b) > 0; }).forEach(function (b) { var days = b.balanceDue && U().isDate(b.balanceDue) ? U().diff(td, b.balanceDue) : 0; ag[days > 60 ? 2 : days > 30 ? 1 : 0] += owed(b); });
    [['Not due yet or up to 30 days late', ag[0]], ['31 to 60 days late', ag[1]], ['Over 60 days late', ag[2]]].forEach(function (x) { var r = el('div', 'row'), m = el('div', 'm'); m.appendChild(el('b', '', x[0])); r.appendChild(m); r.appendChild(el('span', 'amt', money(x[1]))); c1.appendChild(r); });
    v.appendChild(el('h2', '', 'Last 6 months')); var c2 = el('div', 'card'); v.appendChild(c2); var months = [];
    for (var i = 5; i >= 0; i--) months.push(U().ymd(new Date(now.getFullYear(), now.getMonth() - i, 1)).slice(0, 7));
    var data = months.map(function (m) { return { m: m, i: sum(inc.filter(function (x) { return x.date.slice(0, 7) === m; })), e: sum(exp.filter(function (x) { return x.date.slice(0, 7) === m; })) }; }), mx = 0; data.forEach(function (d) { mx = Math.max(mx, d.i, d.e); });
    data.forEach(function (d) { var w = el('div'); w.style.margin = '8px 0'; w.appendChild(el('b', '', TL.monthLabel(d.m))); w.appendChild(TL.bar(d.i, mx, '#2bd08a')); w.appendChild(el('div', 'hint', 'Received ' + money(d.i))); w.appendChild(TL.bar(d.e, mx, '#e5484d')); w.appendChild(el('div', 'hint', 'Expenses ' + money(d.e) + ' · Net ' + money(d.i - d.e))); c2.appendChild(w); });
    v.appendChild(el('h2', '', 'Top clients this year')); var c3 = el('div', 'card'); v.appendChild(c3); var by = {};
    inc.filter(function (x) { return x.date.slice(0, 4) === yr; }).forEach(function (x) { by[x.client || ''] = (by[x.client || ''] || 0) + x.amount; });
    var top = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; }).slice(0, 10); if (!top.length) c3.appendChild(el('div', 'empty', 'Record deposits and paid balances to see this.'));
    top.forEach(function (k) { var c = k ? Q.get(k) : null, r = el('div', 'row'), m = el('div', 'm'); m.appendChild(el('b', '', (c && c.name) || 'No client')); r.appendChild(m); r.appendChild(el('span', 'amt', money(by[k]))); c3.appendChild(r); });
    v.appendChild(el('h2', '', 'Tax summary')); var c5 = el('div', 'card'); v.appendChild(c5); var ys = el('select');
    for (var y = now.getFullYear(); y >= now.getFullYear() - 3; y--) { var o = el('option', '', String(y)); o.value = String(y); ys.appendChild(o); } c5.appendChild(ys);
    var b = el('div', 'btns'), sv = el('button', 'btn', 'View and share'), dl = el('button', 'btn ghost', 'Download CSV'); sv.type = dl.type = 'button'; b.appendChild(sv); b.appendChild(dl); c5.appendChild(b);
    sv.onclick = function () { TL.showText('Income and expenses ' + ys.value, summaryText(summaryFor(ys.value))); };
    dl.onclick = function () { var sm = summaryFor(ys.value), rows = [['Year', 'Item', 'Amount'], [sm.year, 'Income', (sm.income / 100).toFixed(2)]]; Object.keys(sm.by).sort().forEach(function (k) { rows.push([sm.year, k, (sm.by[k] / 100).toFixed(2)]); }); rows.push([sm.year, 'Net', ((sm.income - sm.expenses) / 100).toFixed(2)]); TL.download('photo-summary-' + sm.year + '.csv', TL.csv(rows)); };
    c5.appendChild(el('div', 'note', 'Income counts deposits and balances you marked paid, placed by shoot date. This is a record of what you entered, not tax advice.'));
  }
  function boot() { Q.views.reports = reportsView; }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

// Customer portal: clients see their shoots and balances.
window.VQ_APP.portal = { kind: 'client', invoices: function (c, recs) {
  return recs.filter(function (r) { return r.kind === 'booking' && r.client === c.id && r.status !== 'Cancelled' && r.status !== 'Inquiry'; }).sort(function (a, b) { return (a.date || '') < (b.date || '') ? 1 : -1; })
    .map(function (r) { return { n: '', t: (r.type || 'Shoot') + ' shoot', a: owed(r) || r.total || 0, s: r.paidRest || !owed(r) ? 'Paid' : 'Balance due', d: r.balanceDue || r.date || '' }; });
} };
