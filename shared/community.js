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
  // Asks the Vyqil alerts service to send a phone alert. Silent if alerts are not set up: the in-app lists still work.
  function notify(kind, leadId, bizId) {
    try {
      var u = String(window.VYQIL_PUSH_URL || 'https://vyqil-push.dusterman225.workers.dev').replace(/\/$/, '');
      return firebase.auth().currentUser.getIdToken().then(function (t) {
        return fetch(u + '/community', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + t }, body: JSON.stringify({ kind: kind, leadId: leadId, bizId: bizId || '' }) });
      }).catch(function () { /* alerts are optional */ });
    } catch (e) { return Promise.resolve(); }
  }
  window.VQCommunity = { TRADES: TRADES, CATS: CATS, NAMES: NAMES, NOUNS: NOUNS, NEED: NEED, ORDER: ORDER, stats: stats, MAX_MILES: MAX_MILES, r2: r2, cellOf: cellOf, miles: miles, cellsAround: cellsAround, geocode: geocode, here: here, ago: ago, phoneHref: phoneHref, findProviders: findProviders, badge: badge, notify: notify, findContractors: function (db, a, b, c, d) { return findProviders(db, a, b, c, d, 'contractor'); } };
})();
