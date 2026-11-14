// VYQIL COMMUNITY: shared helpers for matching businesses by distance (used by VyqilLandlord and VyqilContractor).
// No map service key is needed. A place is turned into latitude/longitude with the free OpenStreetMap search, or the phone's own location.
// Locations are rounded to about 0.7 miles before they are saved, and a request never contains a street address.
(function () {
  'use strict';
  var TRADES = ['Plumbing', 'Electrical', 'HVAC (heating and cooling)', 'Roofing', 'Painting', 'Flooring', 'Carpentry', 'Appliance repair', 'Handyman / general repair', 'Locksmith', 'Pest control', 'Landscaping and trees', 'Cleaning and turnover', 'Windows and doors', 'Other'];
  var SERVICE_TYPES = ['House cleaning', 'Move-out and turnover cleaning', 'Lawn care', 'Pool service', 'Pressure washing', 'Window cleaning', 'Snow removal', 'Junk removal', 'Pest control', 'Staging', 'Other'];
  var RENTAL_TYPES = ['Apartment', 'House', 'Room', 'Condo or townhome', 'Commercial or office', 'Storage or garage', 'Other'];
  var REALTOR_TYPES = ['Lease a vacant unit', 'Sell a property', 'Buy a property', 'Property management help', 'Commercial', 'Other'];
  var SALON_TYPES = ['Hair', 'Barber', 'Nails', 'Skin care and makeup', 'Massage and spa', 'Other'];
  var AUTO_TYPES = ['Repair', 'Oil change and maintenance', 'Tires', 'Body and paint', 'Detailing', 'Towing', 'Other'];
  var PHOTO_TYPES = ['Real estate photos', 'Portraits', 'Events', 'Product photos', 'Video', 'Other'];
  var LESSON_TYPES = ['Tutoring', 'Music', 'Fitness', 'Language', 'Art', 'Driving', 'Other'];
  // One entry per kind of Vyqil business. "need" is how it reads in the "What do you need?" list.
  var CATS = { contractor: TRADES, services: SERVICE_TYPES, landlord: RENTAL_TYPES, realtor: REALTOR_TYPES, salon: SALON_TYPES, auto: AUTO_TYPES, photo: PHOTO_TYPES, lessons: LESSON_TYPES };
  var NAMES = { contractor: 'VyqilContractor', services: 'VyqilServices', landlord: 'VyqilLandlord', realtor: 'VyqilRealtor', salon: 'VyqilSalon', auto: 'VyqilAuto', photo: 'VyqilPhoto', lessons: 'VyqilLessons' };
  var NOUNS = { contractor: 'contractors', services: 'cleaning, lawn and other service businesses', landlord: 'landlords', realtor: 'realtors', salon: 'salons', auto: 'auto shops', photo: 'photographers', lessons: 'teachers and coaches' };
  var NEED = { contractor: 'Repairs and contractors', services: 'Cleaning, lawn and other services', landlord: 'Rental space (landlords)', realtor: 'Realtor help', salon: 'Hair, nails and beauty', auto: 'Auto repair and care', photo: 'Photography and video', lessons: 'Lessons and tutoring' };
  var ORDER = ['contractor', 'services', 'realtor', 'landlord', 'photo', 'auto', 'salon', 'lessons'];
  var MAX_MILES = 100;
  function r2(n) { return Math.round(n * 100) / 100; }
  function cellOf(lat, lng) { return Math.floor((lat + 90) / 2) + '_' + Math.floor((lng + 180) / 2); }
  // Distance in miles between two points.
  function miles(a, b, c, d) {
    var R = 3958.8, t = Math.PI / 180, dLat = (c - a) * t, dLng = (d - b) * t;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a * t) * Math.cos(c * t) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }
  // The 2-degree grid squares that can hold anything within `radius` miles. A search asks for these squares, then checks exact distance.
  function cellsAround(lat, lng, radius) {
    radius = Math.min(MAX_MILES, Math.max(1, radius || MAX_MILES));
    var dLat = radius / 69, dLng = radius / (69 * Math.max(0.2, Math.cos(lat * Math.PI / 180)));
    var a0 = Math.floor((lat - dLat + 90) / 2), a1 = Math.floor((lat + dLat + 90) / 2), b0 = Math.floor((lng - dLng + 180) / 2), b1 = Math.floor((lng + dLng + 180) / 2), out = [];
    for (var a = a0; a <= a1; a++) for (var b = b0; b <= b1; b++) out.push(a + '_' + b);
    var mid = cellOf(lat, lng).split('_').map(Number);
    out.sort(function (x, y) { var p = x.split('_').map(Number), q = y.split('_').map(Number); return (Math.abs(p[0] - mid[0]) + Math.abs(p[1] - mid[1])) - (Math.abs(q[0] - mid[0]) + Math.abs(q[1] - mid[1])); });
    return out.slice(0, 30);
  }
  function label(addr) {
    if (!addr) return '';
    var town = addr.city || addr.town || addr.village || addr.hamlet || addr.suburb || addr.county || '', st = addr.state || '';
    return (town + (town && st ? ', ' : '') + st).slice(0, 60);
  }
  // Street address or ZIP code to a place. Rejects with a plain message.
  function geocode(text) {
    text = String(text || '').trim();
    if (text.length < 3) return Promise.reject(new Error('Type a street address, a town or a ZIP code.'));
    return fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=' + encodeURIComponent(text), { headers: { 'Accept': 'application/json' } })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (j) {
        if (!j || !j.length) throw new Error('That place was not found. Try a ZIP code or the town and state.');
        var lat = parseFloat(j[0].lat), lng = parseFloat(j[0].lon);
        return { lat: r2(lat), lng: r2(lng), city: label(j[0].address) || String(j[0].display_name || '').split(',').slice(0, 2).join(',').slice(0, 60) };
      }, function () { throw new Error('The place search is not answering. Try again, or use "Use my location".'); });
  }
  function here() {
    return new Promise(function (ok, no) {
      if (!navigator.geolocation) { no(new Error('This browser cannot share a location.')); return; }
      navigator.geolocation.getCurrentPosition(function (p) {
        var lat = p.coords.latitude, lng = p.coords.longitude, out = { lat: r2(lat), lng: r2(lng), city: '' };
        fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&addressdetails=1&lat=' + lat + '&lon=' + lng).then(function (r) { return r.json(); })
          .then(function (j) { out.city = label(j && j.address); ok(out); }, function () { ok(out); });
      }, function () { no(new Error('Location was not shared. Type a ZIP code instead.')); }, { timeout: 15000, maximumAge: 600000 });
    });
  }
  function ago(ts) {
    var t = ts && ts.toMillis ? ts.toMillis() : 0; if (!t) return 'just now';
    var m = Math.round((Date.now() - t) / 60000); if (m < 2) return 'just now'; if (m < 60) return m + ' min ago'; var h = Math.round(m / 60); if (h < 24) return h + ' hr ago'; var d = Math.round(h / 24); return d + (d === 1 ? ' day ago' : ' days ago');
  }
  function phoneHref(p) { var d = String(p || '').replace(/[^0-9+]/g, ''); return d.length >= 7 ? 'tel:' + d : ''; }
  // Businesses of one kind (contractor, services, landlord, realtor) in the directory near a point, for one category.
  function findProviders(db, lat, lng, radius, cat, product) {
    product = product || 'contractor';
    return db.collection('directory').where('cell', 'in', cellsAround(lat, lng, radius)).where('listed', '==', true).limit(100).get().then(function (s) {
      var out = [];
      s.docs.forEach(function (d) { var x = d.data(); x.id = d.id; if ((x.product || 'contractor') !== product) return; var mi = miles(lat, lng, x.lat, x.lng); x.miles = mi;
        if (mi > radius) return; if (mi > (x.radius || MAX_MILES)) return;   // they only want work inside their own range
        if (cat && cat !== 'Other' && (x.trades || []).indexOf(cat) < 0) return; out.push(x); });
      out.sort(function (a, b) { return a.miles - b.miles; }); return out;
    });
  }
  // Completed community jobs and average rating for a set of businesses, in one query (people only see jobs the requester marked done).
  function stats(db, ids) {
    ids = (ids || []).slice(0, 30); if (!ids.length) return Promise.resolve({});
    return db.collection('communityLeads').where('chosen', 'in', ids).where('status', '==', 'done').get().then(function (s) {
      var out = {}; s.docs.forEach(function (d) { var x = d.data(), o = out[x.chosen] || (out[x.chosen] = { n: 0, sum: 0, rated: 0 }); o.n++; if (x.rating) { o.sum += x.rating; o.rated++; } });
      Object.keys(out).forEach(function (k) { out[k].avg = out[k].rated ? out[k].sum / out[k].rated : 0; }); return out;
    }, function () { return {}; });
  }
  function badge(st, perk) {
    var t = []; if (st && st.n) t.push(st.n + (st.n === 1 ? ' Vyqil job' : ' Vyqil jobs') + (st.avg ? ' · ' + st.avg.toFixed(1) + ' stars' : ''));
    if (st && st.n >= 5 && st.avg >= 4.5) t.unshift('Top community neighbor'); if (perk) t.push('Perk: ' + perk); return t.join(' · ');
  }
  // Self-reported license and insurance text. Vyqil does not check it, and it always says so.
  function trust(c) { var t = []; if (c && c.license) t.push('License: ' + String(c.license).slice(0, 40)); if (c && c.insured) t.push('Says insured'); return t.length ? t.join(' \u00b7 ') + ' (self-reported, not verified)' : ''; }
  var tcache = {};
  function trustFor(db, id) { if (!tcache[id]) tcache[id] = db.collection('directory').doc(id).get().then(function (d) { return d.exists ? trust(d.data()) : ''; }, function () { return ''; }); return tcache[id]; }
  // Posting limits (this device only) so one account cannot flood the neighborhood by accident.
  function canPost() { try { var a = JSON.parse(localStorage.getItem('vq_post_log') || '[]').filter(function (t) { return Date.now() - t < 864e5; }); if (a.length && Date.now() - a[a.length - 1] < 60000) return 'Please wait a minute before posting again.'; if (a.length >= 10) return 'You have posted 10 requests today. Try again tomorrow.'; } catch (e) { /* no limit if storage is blocked */ } return ''; }
  function notePost() { try { var a = JSON.parse(localStorage.getItem('vq_post_log') || '[]').filter(function (t) { return Date.now() - t < 864e5; }); a.push(Date.now()); localStorage.setItem('vq_post_log', JSON.stringify(a)); } catch (e) { /* optional */ } }
  // Tells the Vyqil team a request is spam or abusive. Only the team can read reports.
  function report(db, l, uid, bizId) {
    var r = window.prompt('What is wrong with this request? (spam, fake, abusive, wrong place...)'); if (!r || !r.trim()) return Promise.resolve(false);
    return db.collection('communityReports').add({ leadId: l.id, reporterUid: uid, reporterBiz: bizId, reason: r.trim().slice(0, 200), createdAt: firebase.firestore.FieldValue.serverTimestamp() }).then(function () { return true; });
  }
  // A short message thread between the person who posted and one business that replied. asker=true when I posted the request.
  function openThread(db, leadId, offerId, uid, asker, title) {
    var ov = document.createElement('div'); ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:70;background:rgba(0,0,0,.75);display:flex;align-items:flex-end;justify-content:center';
    var sh = document.createElement('div'); sh.style.cssText = 'background:#0a0f15;border:1px solid #1f2e3f;border-radius:18px 18px 0 0;width:100%;max-width:560px;height:80vh;display:flex;flex-direction:column;padding:14px;box-sizing:border-box;color:#eef3f8;font-family:Arial,sans-serif';
    var h = document.createElement('h3'); h.textContent = 'Messages with ' + (title || 'them'); h.style.margin = '0 0 6px';
    var tip = document.createElement('div'); tip.textContent = 'Share only what the job needs. Keep street addresses until you have picked someone.'; tip.style.cssText = 'color:#9fb0c4;font-size:.78rem;margin-bottom:8px';
    var list = document.createElement('div'); list.style.cssText = 'flex:1;overflow-y:auto;border-top:1px solid #1f2e3f;border-bottom:1px solid #1f2e3f;padding:8px 0';
    var note = document.createElement('div'); note.style.cssText = 'color:#ff8a8a;font-size:.8rem;min-height:1em;margin-top:6px';
    var row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;margin-top:8px';
    var inp = document.createElement('input'); inp.type = 'text'; inp.maxLength = 300; inp.placeholder = 'Type a message'; inp.style.cssText = 'flex:1;min-width:0;background:#14202e;border:1px solid #27405c;color:#eef3f8;border-radius:10px;padding:10px;font:16px Arial,sans-serif';
    var send = document.createElement('button'); send.type = 'button'; send.textContent = 'Send'; send.style.cssText = 'background:#2f7cf6;color:#fff;border:0;border-radius:10px;padding:0 16px;font-weight:700';
    var close = document.createElement('button'); close.type = 'button'; close.textContent = 'Close'; close.style.cssText = 'background:none;color:#9fb0c4;border:1px solid #1f2e3f;border-radius:10px;padding:8px;margin-top:8px';
    row.appendChild(inp); row.appendChild(send); [h, tip, list, note, row, close].forEach(function (n) { sh.appendChild(n); }); ov.appendChild(sh); document.body.appendChild(ov);
    var col = db.collection('communityLeads').doc(leadId).collection('offers').doc(offerId).collection('msgs'), unsub = null;
    function ms(m) { var c = m.createdAt; return c && c.toMillis ? c.toMillis() : Date.now(); }
    unsub = col.onSnapshot(function (snap) {
      var a = snap.docs.map(function (d) { return d.data(); }).sort(function (x, y) { return ms(x) - ms(y); }); list.textContent = '';
      if (!a.length) { var e = document.createElement('div'); e.textContent = 'No messages yet.'; e.style.cssText = 'color:#9fb0c4;text-align:center;padding:14px'; list.appendChild(e); }
      a.forEach(function (m) { var mine = m.uid === uid, b = document.createElement('div'); b.textContent = m.text; b.style.cssText = 'max-width:80%;margin:5px 0;padding:8px 10px;border-radius:12px;word-wrap:break-word;' + (mine ? 'margin-left:auto;background:#1b4a8a' : 'background:#16212d'); list.appendChild(b); });
      list.scrollTop = list.scrollHeight;
    }, function (e) { note.textContent = (e && e.message) || 'Could not load messages.'; });
    function shut() { if (unsub) unsub(); ov.remove(); }
    close.onclick = shut; ov.addEventListener('click', function (e) { if (e.target === ov) shut(); });
    function go() {
      var t = inp.value.trim(); if (!t) return; send.disabled = true; note.textContent = '';
      col.add({ uid: uid, from: asker ? 'asker' : 'provider', text: t.slice(0, 300), createdAt: firebase.firestore.FieldValue.serverTimestamp() }).then(function () { inp.value = ''; send.disabled = false; notify('msg', leadId, offerId); }, function (e) { send.disabled = false; note.textContent = (e && e.message) || 'Could not send.'; });
    }
    send.onclick = go; inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
  }
  // Asks the Vyqil alerts service to send a phone alert. Silent if alerts are not set up: the in-app lists still work.
  function notify(kind, leadId, bizId) {
    try {
      var u = String(window.VYQIL_PUSH_URL || 'https://vyqil-push.dusterman225.workers.dev').replace(/\/$/, '');
      return firebase.auth().currentUser.getIdToken().then(function (t) {
        return fetch(u + '/community', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + t }, body: JSON.stringify({ kind: kind, leadId: leadId, bizId: bizId || '' }) });
      }).catch(function () { /* alerts are optional */ });
    } catch (e) { return Promise.resolve(); }
  }
  window.VQCommunity = { TRADES: TRADES, CATS: CATS, NAMES: NAMES, NOUNS: NOUNS, NEED: NEED, ORDER: ORDER, stats: stats, MAX_MILES: MAX_MILES, r2: r2, cellOf: cellOf, miles: miles, cellsAround: cellsAround, geocode: geocode, here: here, ago: ago, phoneHref: phoneHref, findProviders: findProviders, badge: badge, trust: trust, trustFor: trustFor, canPost: canPost, notePost: notePost, report: report, openThread: openThread, notify: notify, findContractors: function (db, a, b, c, d) { return findProviders(db, a, b, c, d, 'contractor'); } };
})();
