window.VQ_APP = {
  id: 'realtor', name: 'VyqilRealtor', who: 'For real estate agents', tag: 'Clients, listings and deals in one place.', alertText: 'follow-ups, closing deadlines and open houses',
  tabKinds: ['client', 'deal', 'listing'],
  checklists: { buyer: [
    { t: 'Offer accepted: send contract to all parties', off: 0 }, { t: 'Earnest money due', off: 3 }, { t: 'Order inspection', off: 2 }, { t: 'Inspection period ends', off: 10 },
    { t: 'Appraisal ordered', off: 7 }, { t: 'Loan commitment', off: 21 }, { t: 'Final walkthrough', off: -2, from: 'closeDate' }, { t: 'Closing', off: 0, from: 'closeDate' }] },
  kinds: {
    client: { label: 'Client', plural: 'Clients', icon: '👤', stage: 'stage', sort: function (a, b) { return (a.nextContact || '9') < (b.nextContact || '9') ? -1 : 1; },
      closed: function (r) { return r.stage === 'Closed' || r.stage === 'Lost'; },
      fields: [{ k: 'name', l: 'Name', t: 'text', req: 1 }, { k: 'stage', l: 'Stage', t: 'select', o: ['Lead', 'Active', 'Under contract', 'Closed', 'Lost'], req: 1 }, { k: 'type', l: 'Looking to', t: 'select', o: ['Buy', 'Sell', 'Both', 'Rent'] },
        { k: 'phone', l: 'Phone', t: 'tel' }, { k: 'email', l: 'Email', t: 'email' }, { k: 'budget', l: 'Budget or list price', t: 'money' },
        { k: 'nextContact', l: 'Next follow-up', t: 'date', cal: 1, alert: { hour: 9 }, lbl: 'Follow up', doneIf: function (r) { return r.stage === 'Closed' || r.stage === 'Lost'; } },
        { k: 'birthday', l: 'Birthday', t: 'date', cal: 1, yearly: 1, alert: { hour: 9 }, lbl: 'Birthday' }, { k: 'homeDate', l: 'Home purchase date', t: 'date', cal: 1, yearly: 1, alert: { hour: 9 }, lbl: 'Home anniversary', hint: 'A yearly reminder to say hello after a closing.' },
        { k: 'notes', l: 'Notes', t: 'area' }],
      show: ['type', 'phone', 'nextContact'] },
    deal: { label: 'Deal', plural: 'Deals', icon: '📄', stage: 'status', checklist: { tpl: 'buyer', name: 'contract-to-close', base: 'contractDate' },
      closed: function (r) { return r.status === 'Closed' || r.status === 'Fell through'; },
      title: function (r) { return (r.address || 'Deal') + (r.client ? ' · ' + Q.title(Q.get(r.client)) : ''); },
      fields: [{ k: 'address', l: 'Property address', t: 'text', req: 1 }, { k: 'client', l: 'Client', t: 'link', to: 'client' }, { k: 'side', l: 'Your side', t: 'select', o: ['Buyer', 'Seller', 'Both'] },
        { k: 'status', l: 'Status', t: 'select', o: ['Pending', 'Under contract', 'Closed', 'Fell through'], req: 1 }, { k: 'price', l: 'Sale price', t: 'money' }, { k: 'commPct', l: 'Commission %', t: 'number', h: '3' }, { k: 'split', l: 'Your share of commission %', t: 'number', h: '100', hint: 'After brokerage split. Leave blank for 100%.' },
        { k: 'contractDate', l: 'Contract date', t: 'date' }, { k: 'closeDate', l: 'Closing date', t: 'date', cal: 1, alert: { hour: 8, eve: 1 }, lbl: 'Closing' },
        { k: 'commission', l: 'Your estimated commission', t: 'calc', fmt: 'money', f: function (r) { var p = r.price || 0, c = (r.commPct == null || r.commPct === '' ? 0 : r.commPct), s = (r.split == null || r.split === '' ? 100 : r.split); return Math.round(p * c / 100 * s / 100); } },
        { k: 'notes', l: 'Notes', t: 'area' }],
      amount: function (r) { var f = this.fields[9].f(r); return f ? f : ''; }, sub: function (r) { return [r.price ? money(r.price) : '', r.closeDate ? 'Closes ' + Q.u.fmtDate(r.closeDate) : ''].filter(Boolean).join(' · '); } },
    listing: { label: 'Listing', plural: 'Listings', icon: '🏠', stage: 'status', closed: function (r) { return r.status === 'Sold' || r.status === 'Withdrawn'; },
      fields: [{ k: 'address', l: 'Address', t: 'text', req: 1 }, { k: 'status', l: 'Status', t: 'select', o: ['Coming soon', 'Active', 'Pending', 'Sold', 'Withdrawn'], req: 1 }, { k: 'seller', l: 'Seller', t: 'link', to: 'client' },
        { k: 'price', l: 'List price', t: 'money' }, { k: 'beds', l: 'Beds', t: 'number' }, { k: 'baths', l: 'Baths', t: 'number' }, { k: 'sqft', l: 'Square feet', t: 'number' },
        { k: 'listDate', l: 'List date', t: 'date' }, { k: 'openHouse', l: 'Open house date', t: 'date', cal: 1, alert: { hour: 8, eve: 1 }, lbl: 'Open house' }, { k: 'expires', l: 'Listing expires', t: 'date', cal: 1, alert: { hour: 9 }, lbl: 'Listing expires' }, { k: 'notes', l: 'Notes', t: 'area' }],
      title: function (r) { return r.address || 'Listing'; }, sub: function (r) { return [r.price ? money(r.price) : '', r.beds ? r.beds + ' bd' : '', r.baths ? r.baths + ' ba' : ''].filter(Boolean).join(' · '); } }
  },
  stats: [{ l: 'Active clients', fn: function (rs) { return rs.filter(function (r) { return r.kind === 'client' && (r.stage === 'Active' || r.stage === 'Lead'); }).length; } },
    { l: 'Open deals', fn: function (rs) { return rs.filter(function (r) { return r.kind === 'deal' && r.status !== 'Closed' && r.status !== 'Fell through'; }).length; } },
    { l: 'Pending commission', fn: function (rs) { var t = 0; rs.forEach(function (r) { if (r.kind === 'deal' && r.status !== 'Closed' && r.status !== 'Fell through') t += window.VQ_APP.kinds.deal.fields[9].f(r); }); return Q.u.money(t); } }],
  watch: [{ l: 'Clients with no follow-up set', fn: function (rs) { return rs.filter(function (r) { return r.kind === 'client' && !r.nextContact && (r.stage === 'Lead' || r.stage === 'Active'); }); }, sub: function (r) { return r.stage; } }]
};
function money(c) { return Q.u.money(c); }

// Community: look for rental space for a client, get listing photos or repairs done, and receive requests from landlords.
(function () {
  var A = window.VQ_APP;
  A.community = { product: 'realtor', place: function (r) { return r && r.address ? r : null; }, placeText: function (r) { return r.address; },
    inbound: { addKind: 'client', addDefaults: { stage: 'Lead' }, addLabel: 'Add as client', inboxTitle: 'Requests from landlords and others', listTitle: 'My realtor listing', catLabel: 'What you help with' } };
  A.kinds.client.actions = [{ l: 'Find rental space for this client', run: function (r) { Q.community.find(r, { target: 'landlord', cat: 'Apartment', title: 'Rental for a client', details: r.budget ? 'Budget about ' + Q.u.money(r.budget) + ' a month.' : '' }); } }];
  A.kinds.listing.actions = [{ l: 'Find a photographer, cleaner or contractor', run: function (r) { Q.community.find(r, { target: 'photo', cat: 'Real estate photos', title: 'Photos for a listing' }); } }];
})();
