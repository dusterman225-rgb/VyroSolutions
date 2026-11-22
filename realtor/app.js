window.VQ_APP = {
  id: 'realtor', name: 'VyqilRealtor', who: 'For real estate agents', tag: 'Clients, showings, listings and deals in one place.', alertText: 'follow-ups, showings, closing deadlines and open houses',
  tabKinds: ['client', 'deal', 'listing'],
  checklists: {
    buyer: [
      { t: 'Offer accepted: send contract to all parties', off: 0 }, { t: 'Earnest money due', off: 3 }, { t: 'Order inspection', off: 2 }, { t: 'Inspection period ends', off: 10 },
      { t: 'Appraisal ordered', off: 7 }, { t: 'Loan commitment', off: 21 }, { t: 'Final walkthrough', off: -2, from: 'closeDate' }, { t: 'Closing', off: 0, from: 'closeDate' }],
    seller: [
      { t: 'Offer accepted: send contract to all parties', off: 0 }, { t: 'Earnest money received', off: 3 }, { t: 'Buyer inspection done', off: 7 }, { t: 'Answer repair requests', off: 10 },
      { t: 'Appraisal', off: 14 }, { t: 'Buyer loan commitment', off: 21 }, { t: 'Final walkthrough', off: -2, from: 'closeDate' }, { t: 'Closing and keys', off: 0, from: 'closeDate' }],
    listing: [
      { t: 'Walk the property with the seller', off: -14 }, { t: 'Make the pre-listing repair list', off: -12 }, { t: 'Repairs done', off: -7 }, { t: 'Deep clean and staging', off: -5 },
      { t: 'Listing photos', off: -4 }, { t: 'Sign and lockbox up', off: -2 }, { t: 'Listing goes live', off: 0 }, { t: 'First open house', off: 3 }]
  },
  kinds: {
    client: { label: 'Client', plural: 'Clients', icon: '👤', stage: 'stage', sort: function (a, b) { return (a.nextContact || '9') < (b.nextContact || '9') ? -1 : 1; },
      closed: function (r) { return r.stage === 'Closed' || r.stage === 'Lost'; },
      fields: [{ k: 'name', l: 'Name', t: 'text', req: 1 }, { k: 'stage', l: 'Stage', t: 'select', o: ['Lead', 'Active', 'Under contract', 'Closed', 'Lost'], req: 1 }, { k: 'type', l: 'Looking to', t: 'select', o: ['Buy', 'Sell', 'Both', 'Rent'] },
        { k: 'phone', l: 'Phone', t: 'tel' }, { k: 'email', l: 'Email', t: 'email' }, { k: 'budget', l: 'Budget or list price', t: 'money' },
        { k: 'areas', l: 'Areas they like', t: 'text' }, { k: 'preapproved', l: 'Pre-approved for a loan?', t: 'select', o: ['Not yet', 'Yes', 'Paying cash'] },
        { k: 'source', l: 'Where they came from', t: 'select', o: ['Referral', 'Past client', 'Open house', 'Online', 'Sign call', 'Vyqil Community', 'Other'] },
        { k: 'nextContact', l: 'Next follow-up', t: 'date', cal: 1, alert: { hour: 9 }, lbl: 'Follow up', doneIf: function (r) { return r.stage === 'Closed' || r.stage === 'Lost'; } },
        { k: 'birthday', l: 'Birthday', t: 'date', cal: 1, yearly: 1, alert: { hour: 9 }, lbl: 'Birthday' }, { k: 'homeDate', l: 'Home purchase date', t: 'date', cal: 1, yearly: 1, alert: { hour: 9 }, lbl: 'Home anniversary', hint: 'A yearly reminder to say hello after a closing.' },
        { k: 'notes', l: 'Notes', t: 'area' }],
      show: ['type', 'phone', 'nextContact'], addMenu: ['client', 'deal', 'listing', 'showing', 'vendor'] },
    deal: { label: 'Deal', plural: 'Deals', icon: '📄', stage: 'status', checklist: { tpl: function (r) { return r.side === 'Seller' ? 'seller' : 'buyer'; }, name: 'contract-to-close', base: 'contractDate' },
      closed: function (r) { return r.status === 'Closed' || r.status === 'Fell through'; },
      title: function (r) { return (r.address || 'Deal') + (r.client ? ' · ' + Q.title(Q.get(r.client)) : ''); },
      fields: [{ k: 'address', l: 'Property address', t: 'text', req: 1 }, { k: 'client', l: 'Client', t: 'link', to: 'client' }, { k: 'side', l: 'Your side', t: 'select', o: ['Buyer', 'Seller', 'Both'], hint: 'Seller deals get a seller checklist; buyer and both get the buyer checklist.' },
        { k: 'status', l: 'Status', t: 'select', o: ['Pending', 'Under contract', 'Closed', 'Fell through'], req: 1 }, { k: 'price', l: 'Sale price', t: 'money' }, { k: 'commPct', l: 'Commission %', t: 'number', h: '3' }, { k: 'split', l: 'Your share of commission %', t: 'number', h: '100', hint: 'After brokerage split. Leave blank for 100%.' },
        { k: 'contractDate', l: 'Contract date', t: 'date' },
        { k: 'inspectionEnd', l: 'Inspection period ends', t: 'date', cal: 1, alert: { hour: 9, eve: 1 }, lbl: 'Inspection period ends', doneIf: dealOver },
        { k: 'financingDate', l: 'Loan commitment due', t: 'date', cal: 1, alert: { hour: 9, eve: 1 }, lbl: 'Loan commitment due', doneIf: dealOver },
        { k: 'closeDate', l: 'Closing date', t: 'date', cal: 1, alert: { hour: 8, eve: 1 }, lbl: 'Closing', doneIf: dealOver },
        { k: 'commission', l: 'Your estimated commission', t: 'calc', fmt: 'money', f: comm },
        { k: 'paid', l: 'Commission received?', t: 'select', o: ['Not yet', 'Received'], hint: 'Mark Received when the commission check or deposit arrives.' },
        { k: 'helpers', l: 'Hired through Vyqil', t: 'text', hint: 'Filled in when you choose a Vyqil business from "Find a Vyqil".' },
        { k: 'notes', l: 'Notes', t: 'area' }],
      amount: function (r) { var f = comm(r); return f ? f : ''; }, sub: function (r) { return [r.price ? money(r.price) : '', r.closeDate ? 'Closes ' + Q.u.fmtDate(r.closeDate) : ''].filter(Boolean).join(' · '); }, addMenu: ['deal', 'client', 'listing', 'showing'] },
    listing: { label: 'Listing', plural: 'Listings', icon: '🏠', stage: 'status', checklist: { tpl: 'listing', name: 'get-it-listed', base: 'listDate' }, closed: function (r) { return r.status === 'Sold' || r.status === 'Withdrawn'; },
      fields: [{ k: 'address', l: 'Address', t: 'text', req: 1 }, { k: 'status', l: 'Status', t: 'select', o: ['Coming soon', 'Active', 'Pending', 'Sold', 'Withdrawn'], req: 1 }, { k: 'seller', l: 'Seller', t: 'link', to: 'client' },
        { k: 'price', l: 'List price', t: 'money' }, { k: 'beds', l: 'Beds', t: 'number' }, { k: 'baths', l: 'Baths', t: 'number' }, { k: 'sqft', l: 'Square feet', t: 'number' }, { k: 'mls', l: 'MLS number', t: 'text' },
        { k: 'listDate', l: 'List date', t: 'date', hint: 'The day it goes live. The get-it-listed checklist counts back from this date.' },
        { k: 'openHouse', l: 'Open house date', t: 'date', cal: 1, alert: { hour: 8, eve: 1 }, lbl: 'Open house', doneIf: listingOver },
        { k: 'expires', l: 'Listing expires', t: 'date', cal: 1, alert: { hour: 9 }, lbl: 'Listing expires', doneIf: listingOver },
        { k: 'helpers', l: 'Hired through Vyqil', t: 'text', hint: 'Filled in when you choose a Vyqil business from "Find a Vyqil".' },
        { k: 'notes', l: 'Notes', t: 'area' }],
      title: function (r) { return r.address || 'Listing'; }, sub: function (r) { return [r.price ? money(r.price) : '', r.beds ? r.beds + ' bd' : '', r.baths ? r.baths + ' ba' : ''].filter(Boolean).join(' · '); }, addMenu: ['listing', 'client', 'deal', 'showing'] },
    showing: { label: 'Showing', plural: 'Showings', icon: '🔑', stage: 'status', closed: function (r) { return r.status !== 'Scheduled'; }, sort: function (a, b) { return ((a.date || '') + (a.time || '')) < ((b.date || '') + (b.time || '')) ? -1 : 1; },
      title: function (r) { return (r.address || (r.listing ? Q.title(Q.get(r.listing)) : '') || 'Showing') + (r.client ? ' · ' + Q.title(Q.get(r.client)) : ''); },
      fields: [{ k: 'client', l: 'Client', t: 'link', to: 'client', req: 1 }, { k: 'listing', l: 'Listing (if it is yours)', t: 'link', to: 'listing' }, { k: 'address', l: 'Address', t: 'text', hint: 'Fill in for a home that is not one of your listings.' },
        { k: 'date', l: 'Date', t: 'date', req: 1, cal: 1, alert: { hour: 8 }, timeField: 'time', lbl: 'Showing', doneIf: function (r) { return r.status !== 'Scheduled'; } }, { k: 'time', l: 'Time', t: 'time' },
        { k: 'status', l: 'Status', t: 'select', o: ['Scheduled', 'Done', 'Cancelled', 'No show'], req: 1 }, { k: 'feedback', l: 'Client feedback', t: 'area', hint: 'What they liked, what they did not, and whether they want to make an offer.' }],
      sub: function (r) { return Q.u.fmtDate(r.date) + (r.time ? ' ' + Q.u.fmtTime(r.time) : ''); }, addMenu: ['showing', 'client', 'listing', 'deal'] },
    vendor: { label: 'Vendor', plural: 'Vendors', icon: '🤝', stage: 'type', sort: function (a, b) { return (a.type || '') < (b.type || '') ? -1 : 1; },
      fields: [{ k: 'name', l: 'Name or company', t: 'text', req: 1 }, { k: 'type', l: 'What they do', t: 'select', o: ['Inspector', 'Lender', 'Title or escrow', 'Attorney', 'Appraiser', 'Contractor', 'Cleaner or stager', 'Photographer', 'Insurance', 'Other'], req: 1 },
        { k: 'phone', l: 'Phone', t: 'tel' }, { k: 'email', l: 'Email', t: 'email' }, { k: 'notes', l: 'Notes', t: 'area' }],
      sub: function (r) { return [r.type, r.phone].filter(Boolean).join(' · '); } }
  },
  stats: [{ l: 'Active clients', fn: function (rs) { return rs.filter(function (r) { return r.kind === 'client' && (r.stage === 'Active' || r.stage === 'Lead'); }).length; } },
    { l: 'Open deals', fn: function (rs) { return rs.filter(function (r) { return r.kind === 'deal' && !dealOver(r); }).length; } },
    { l: 'Pending commission', fn: function (rs) { var t = 0; rs.forEach(function (r) { if (r.kind === 'deal' && !dealOver(r)) t += comm(r); }); return Q.u.money(t); } }],
  watch: [
    { l: 'Clients with no follow-up set', fn: function (rs) { return rs.filter(function (r) { return r.kind === 'client' && !r.nextContact && (r.stage === 'Lead' || r.stage === 'Active'); }); }, sub: function (r) { return r.stage; } },
    { l: 'Follow-ups past due', fn: function (rs, t) { return rs.filter(function (r) { return r.kind === 'client' && r.nextContact && r.nextContact < t && (r.stage === 'Lead' || r.stage === 'Active' || r.stage === 'Under contract'); }); }, sub: function (r) { return 'Was due ' + Q.u.fmtDate(r.nextContact); } },
    { l: 'Showings past due', fn: function (rs, t) { return rs.filter(function (r) { return r.kind === 'showing' && r.status === 'Scheduled' && r.date && r.date < t; }); }, sub: function (r) { return 'Was ' + Q.u.fmtDate(r.date) + '. Mark it Done, Cancelled or No show, and add feedback.'; } },
    { l: 'Closings past due', fn: function (rs, t) { return rs.filter(function (r) { return r.kind === 'deal' && !dealOver(r) && r.closeDate && r.closeDate < t; }); }, sub: function (r) { return 'Closing was ' + Q.u.fmtDate(r.closeDate) + '. Update the status.'; } },
    { l: 'Listings expired', fn: function (rs, t) { return rs.filter(function (r) { return r.kind === 'listing' && !listingOver(r) && r.expires && r.expires < t; }); }, sub: function (r) { return 'Expired ' + Q.u.fmtDate(r.expires) + '. Renew it or mark it Withdrawn.'; } },
    { l: 'Commission unpaid past due', fn: function (rs, t) { return rs.filter(function (r) { return r.kind === 'deal' && r.status === 'Closed' && r.paid !== 'Received' && r.closeDate && r.closeDate < t && comm(r) > 0; }); }, sub: function (r) { return 'Closed ' + Q.u.fmtDate(r.closeDate) + ', ' + Q.u.money(comm(r)) + ' not marked received.'; } }]
};
function money(c) { return Q.u.money(c); }
function dealOver(r) { return r.status === 'Closed' || r.status === 'Fell through'; }
function listingOver(r) { return r.status === 'Sold' || r.status === 'Withdrawn'; }
// Your estimated commission, in cents: price x commission % x your share %.
function comm(r) { var p = r.price || 0, c = (r.commPct == null || r.commPct === '' ? 0 : r.commPct), s = (r.split == null || r.split === '' ? 100 : r.split); return Math.round(p * c / 100 * s / 100); }

// ===== Community: find rentals, repairs, cleaners and photographers near a property, and receive requests from landlords and others =====
(function () {
  var A = window.VQ_APP, K = A.kinds;
  function addHelper(rec, o) { var cur = String(rec.helpers || ''); if (cur.indexOf(o.bizName) >= 0) return null; return { helpers: (cur ? cur + ', ' : '') + o.bizName }; }
  A.community = { product: 'realtor', place: function (r) { return r && r.address ? r : null; }, placeText: function (r) { return r.address; },
    places: function () { return Q.byKind('listing').filter(function (l) { return l.address; }); },
    chosen: { contractor: addHelper, services: addHelper, photo: addHelper },
    inbound: { addKind: 'client', addDefaults: { stage: 'Lead', source: 'Vyqil Community' }, addLabel: 'Add as client', inboxTitle: 'Requests from landlords and others', listTitle: 'My realtor listing', catLabel: 'What you help with' } };
  function call(r) { if (r.phone) window.location.href = 'tel:' + String(r.phone).replace(/[^\d+]/g, ''); }
  function text(r) { if (r.phone) window.location.href = 'sms:' + String(r.phone).replace(/[^\d+]/g, ''); }
  K.client.actions = [
    { l: 'Call', show: function (r) { return !!r.phone; }, run: call },
    { l: 'Text', show: function (r) { return !!r.phone; }, run: text },
    { l: 'Add a showing for this client', run: function (r) { Q.openForm('showing', null, { client: r.id, status: 'Scheduled' }); } },
    { l: 'Start a deal for this client', run: function (r) { Q.openForm('deal', null, { client: r.id, status: 'Pending', side: r.type === 'Sell' ? 'Seller' : 'Buyer' }); } },
    { l: 'Find rental space for this client', run: function (r) { Q.community.find(r, { target: 'landlord', cat: 'Apartment', title: 'Rental for a client', details: r.budget ? 'Budget about ' + Q.u.money(r.budget) + ' a month.' : '' }); } },
    { l: 'Find a cleaner for their move', run: function (r) { Q.community.find(r, { target: 'services', cat: 'Move-out and turnover cleaning', title: 'Move cleaning for ' + (r.name || 'a client') }); } }];
  K.deal.actions = [
    { l: 'Find a contractor for repair requests', saveFirst: true, run: function (r) { Q.community.find(r, { target: 'contractor', cat: 'Handyman / general repair', title: 'Repairs after inspection: ' + (r.address || 'a deal') }); } },
    { l: 'Find a cleaner for closing', saveFirst: true, run: function (r) { Q.community.find(r, { target: 'services', cat: 'Move-out and turnover cleaning', title: 'Cleaning before closing: ' + (r.address || 'a deal') }); } },
    { l: 'Find a photographer', saveFirst: true, run: function (r) { Q.community.find(r, { target: 'photo', cat: 'Real estate photos', title: 'Photos: ' + (r.address || 'a property') }); } }];
  K.listing.actions = [
    { l: 'Find a contractor for pre-listing repairs', saveFirst: true, run: function (r) { Q.community.find(r, { target: 'contractor', cat: 'Handyman / general repair', title: 'Pre-listing repairs: ' + (r.address || 'a listing') }); } },
    { l: 'Find a cleaner or stager', saveFirst: true, run: function (r) { Q.community.find(r, { target: 'services', cat: 'Staging', title: 'Cleaning and staging: ' + (r.address || 'a listing') }); } },
    { l: 'Find a photographer', saveFirst: true, run: function (r) { Q.community.find(r, { target: 'photo', cat: 'Real estate photos', title: 'Photos for a listing: ' + (r.address || 'a listing') }); } },
    { l: 'Add a showing at this listing', run: function (r) { Q.openForm('showing', null, { listing: r.id, status: 'Scheduled' }); } }];
  var VT = { 'Contractor': ['contractor', 'Handyman / general repair'], 'Cleaner or stager': ['services', 'Staging'], 'Photographer': ['photo', 'Real estate photos'] };
  K.vendor.actions = [
    { l: 'Call', show: function (r) { return !!r.phone; }, run: call },
    { l: 'Text', show: function (r) { return !!r.phone; }, run: text },
    { l: 'Find more like this on Vyqil', show: function (r) { return !!VT[r.type]; }, run: function (r) { var v = VT[r.type]; Q.community.find(r, { target: v[0], cat: v[1], title: r.type + ' needed' }); } }];
})();

// ===== Menu, quick links and Get started, in the same format as the other Vyqil apps =====
(function () {
  var A = window.VQ_APP;
  function newLeads() { return Q.byKind('client').filter(function (c) { return c.stage === 'Lead'; }).length; }
  A.menu = function () {
    return [
      { h: 'Work', items: [{ l: 'Clients', tab: 'client', badge: newLeads }, { l: 'Showings', tab: 'showing' }, { l: 'Listings', tab: 'listing' }, { l: 'Deals', tab: 'deal' }] },
      { h: 'Community', items: Q.communityMenu ? Q.communityMenu() : [] },
      { h: 'People', items: [{ l: 'Vendors', tab: 'vendor' }] }
    ];
  };
  A.quick = [{ l: 'Clients', tab: 'client' }, { l: 'Deals', tab: 'deal' }, { l: 'Listings', tab: 'listing' }];
  A.starter = function () {
    var st = [
      { id: 'cl', t: 'First, add a client', h: 'A buyer, seller or renter you are working with.', kind: 'client', form: 'client' },
      { id: 'ls', t: 'Add a listing', h: 'A property you are selling. A get-it-listed checklist counts back from the list date.', kind: 'listing', form: 'listing' },
      { id: 'sh', t: 'Schedule a showing', h: 'Gets a phone reminder that morning.', kind: 'showing', form: 'showing' },
      { id: 'dl', t: 'Start a deal', h: 'Adds a contract-to-close checklist and your estimated commission.', kind: 'deal', form: 'deal' },
      { id: 've', t: 'Add your go-to vendors', h: 'Inspector, lender, title company. Find more on Vyqil any time.', kind: 'vendor', form: 'vendor' }];
    if (Q.portalInvite) st.push({ id: 'cinv', t: 'Invite your clients to the portal', h: 'One tap emails an invite to every client who is not in yet.', done: function (rs) { var p = Q.portalPending ? Q.portalPending() : []; return !p.length && rs.some(function (r) { return r.kind === 'client' && r.portalId; }); }, run: function () { if (Q.portalInviteAll) Q.portalInviteAll(); } });
    st.push({ id: 'alerts', t: 'Turn on phone alerts', h: 'Get reminders even when the app is closed.', manual: true, run: function () { Q.push.panel(); } });
    if (Q.community && Q.community.listing) st.push({ id: 'comm', t: 'Set up Vyqil Community', h: 'Be found by nearby Vyqil businesses, and find them.', manual: true, run: function () { Q.community.listing(); } });
    return st;
  };
})();

// Customer portal: which kind of record is the customer.
window.VQ_APP.portal = { kind: 'client' };
