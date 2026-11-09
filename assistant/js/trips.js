// VyqilAssistant Trips: plan a trip with a day-by-day plan, packing list, costs and confirmations.
(function () {
  var VA = window.VA, esc = VA.esc, S = VA.S, T = VA.trips = {};
  var TPL = {
    'Beach': ['Swimsuits', 'Sunscreen', 'Beach towels', 'Hat and sunglasses', 'Flip-flops', 'Cooler and water bottles'],
    'Camping': ['Tent and stakes', 'Sleeping bags', 'Headlamps and batteries', 'Stove and fuel', 'First aid kit', 'Bug spray', 'Matches or lighter', 'Cooler and food'],
    'City break': ['Comfortable walking shoes', 'Phone charger and battery pack', 'Day bag', 'Umbrella', 'Reservations printed or saved'],
    'Winter': ['Warm coat', 'Gloves and hat', 'Thermal layers', 'Boots', 'Lip balm and moisturizer'],
    'Business': ['Laptop and charger', 'Business clothes', 'Business cards', 'Meeting notes', 'Chargers'],
    'With kids': ['Snacks', 'Favorite toys or tablet', 'Wipes and spare clothes', 'Kids’ medicines', 'Car seat or stroller', 'Chargers and headphones'],
    'International': ['Passport (check it is valid 6 months)', 'Visa or entry forms if needed', 'Travel insurance', 'Plug adapters', 'Some local cash', 'Tell your bank you are traveling']
  };
  var BASICS = ['Phone and charger', 'Wallet and ID', 'Medicines', 'Toothbrush and toiletries', 'Underwear and socks', 'Clothes for each day'];
  var COST_TYPES = ['Flights', 'Hotel', 'Car', 'Food', 'Activities', 'Gas', 'Other'];
  function uid() { return Math.random().toString(36).slice(2, 9); }
  function days(t) { if (!t.start) return []; var end = t.end && t.end >= t.start ? t.end : t.start, out = [], d = t.start, n = 0; while (d <= end && n < 60) { out.push(d); d = VA.addDays(d, 1); n++; } return out; }
  function total(t) { var s = 0; (t.costs || []).forEach(function (c) { s += c.amount || 0; }); return s; }
  T.total = total; T.days = days;
  T.packLeft = function (t) { return (t.packing || []).filter(function (x) { return !x.done; }).length; };

  // ---------- list (shown under Household > Trips) ----------
  T.html = function () {
    var t0 = VA.today(), all = (S.data.trips || []).slice().sort(function (a, b) { return (a.start || '9') < (b.start || '9') ? -1 : 1; });
    var up = all.filter(function (x) { return (x.end || x.start || '9') >= t0; }), past = all.filter(function (x) { return (x.end || x.start || '9') < t0; }).reverse();
    function row(x) { var n = x.start ? VA.diff(t0, x.start) : null, left = T.packLeft(x); return '<div class="row" data-a="openTrip" data-id="' + esc(x.id) + '" style="cursor:pointer"><span style="font-size:1.3rem">✈️</span><div class="m"><b>' + esc(x.name) + '</b><span>' + esc(x.dest || '') + (x.start ? (x.dest ? ' · ' : '') + esc(VA.fmtShort(x.start)) + (x.end && x.end !== x.start ? ' - ' + esc(VA.fmtShort(x.end)) : '') : '') + (n != null && n > 0 ? ' · in ' + n + ' day' + (n === 1 ? '' : 's') : n === 0 ? ' · today' : '') + '</span></div>' + (x.packing && x.packing.length && n != null && n >= 0 ? '<span class="pill ' + (left ? 'warn' : 'ok') + '">' + (left ? left + ' to pack' : 'packed') + '</span>' : '') + '</div>'; }
    var h = '<div class="btns" style="margin-top:0"><button class="btn" data-a="addTrip" type="button">+ Plan a trip</button></div>';
    h += '<div class="card">' + (up.length ? up.map(row).join('') : '<div class="empty">No trips planned. Add one and VyqilAssistant builds a day-by-day plan, a packing list and a cost tracker, and reminds you to pack.</div>') + '</div>';
    if (past.length) h += '<h2>Past trips</h2><div class="card">' + past.slice(0, 10).map(row).join('') + '</div>';
    return h;
  };
  VA.act.addTrip = function () { T.form(null); };
  VA.act.openTrip = function (t, id) { T.open(id); };

  // ---------- add / edit the basics ----------
  T.form = function (item, preset) {
    return new Promise(function (resolve) {
      var v = Object.assign({}, preset || {}, item || {}), done = false;
      function fin(x) { if (!done) { done = true; resolve(x); } }
      VA.modal('<h3>' + (item ? 'Edit trip' : 'Plan a trip') + '</h3><label class="f">Trip name *</label><input id="tName" maxlength="60" placeholder="Summer in Maine" value="' + esc(v.name || '') + '">' +
        '<label class="f">Where</label><input id="tDest" maxlength="60" value="' + esc(v.dest || '') + '"><label class="f">Leave on *</label><input id="tStart" type="date" value="' + esc(v.start || '') + '"><label class="f">Back on</label><input id="tEnd" type="date" value="' + esc(v.end || '') + '">' +
        '<label class="f">Who is going</label><input id="tWho" maxlength="80" value="' + esc(v.who || '') + '"><label class="f">Trip budget ($, optional)</label><input id="tBud" type="number" min="0" step="1" inputmode="numeric" value="' + (v.budget ? Math.round(v.budget / 100) : '') + '">' +
        '<label class="f">Notes</label><textarea id="tNotes" maxlength="1500">' + esc(v.notes || '') + '</textarea><p class="hint" id="tErr" style="color:#ff8a8a"></p><div class="btns"><button class="btn" id="tSave" type="button">Save</button><button class="btn ghost" id="tNo" type="button">Cancel</button>' + (item && item.id ? '<button class="btn danger" id="tDel" type="button">Delete</button>' : '') + '</div>', function (s, close) {
        s.querySelector('#tNo').onclick = function () { close(); fin(null); };
        s.querySelector('#tSave').onclick = function () {
          var name = s.querySelector('#tName').value.trim(), st = s.querySelector('#tStart').value, en = s.querySelector('#tEnd').value, err = '';
          if (!name) err = 'Please name the trip.'; else if (!st) err = 'Please pick the day you leave.'; else if (en && en < st) err = 'The return date is before you leave.'; else if (en && VA.diff(st, en) > 59) err = 'Trips can be up to 60 days long.';
          if (err) { s.querySelector('#tErr').textContent = err; return; }
          var out = { name: name, dest: s.querySelector('#tDest').value.trim(), start: st, end: en || st, who: s.querySelector('#tWho').value.trim(), budget: VA.cents(s.querySelector('#tBud').value), notes: s.querySelector('#tNotes').value.trim() };
          if (!item) { out.packing = []; out.costs = []; out.plan = {}; out.docs = []; }
          s.querySelector('#tSave').disabled = true;
          VA.save('trips', item && item.id, out).then(function (id) { close(); VA.toast('Saved'); fin(id); if (!item) T.open(id); }).catch(function (e) { s.querySelector('#tSave').disabled = false; s.querySelector('#tErr').textContent = 'Could not save (' + (e && e.code || e.message) + ').'; });
        };
        var d = s.querySelector('#tDel'); if (d) d.onclick = function () { VA.confirm('Delete this trip and its lists?', 'Delete', function () { VA.del('trips', item.id).then(function () { close(); VA.toast('Deleted'); fin(null); }); }); };
      });
    });
  };

  // ---------- the trip itself ----------
  var tab = 'plan';
  T.open = function (id) {
    var cur = VA.get('trips', id); if (!cur) return;
    VA.modal('<div id="tripBody"></div>', function (s, close) {
      var box = s.querySelector('#tripBody');
      function get() { return VA.get('trips', id) || cur; }
      function put(patch) { return VA.save('trips', id, patch); }
      function draw() {
        var t = get(), n = VA.diff(VA.today(), t.start);
        var h = '<div style="display:flex;justify-content:space-between;gap:8px"><div><h3 style="margin:0">' + esc(t.name) + '</h3><div class="hint">' + esc(t.dest || '') + ' ' + esc(VA.fmtShort(t.start)) + (t.end !== t.start ? ' - ' + esc(VA.fmtShort(t.end)) : '') + (n > 0 ? ' · in ' + n + ' days' : '') + '</div></div><button class="ibtn" id="tx" type="button" aria-label="Close">✕</button></div>';
        h += '<div class="subs" style="margin-top:8px">' + [['plan', 'Plan'], ['pack', 'Packing'], ['cost', 'Costs'], ['docs', 'Bookings']].map(function (x) { return '<button data-tab="' + x[0] + '" class="' + (tab === x[0] ? 'on' : '') + '" type="button">' + x[1] + '</button>'; }).join('') + '</div>';
        if (tab === 'plan') {
          h += days(t).map(function (d, i) { var p = (t.plan || {})[d] || ''; return '<label class="f">Day ' + (i + 1) + ' · ' + esc(VA.fmtDate(d)) + '</label><textarea data-day="' + d + '" maxlength="600" placeholder="Flights, places, reservations...">' + esc(p) + '</textarea>'; }).join('');
          if (t.notes) h += '<p class="hint">' + esc(t.notes) + '</p>';
        } else if (tab === 'pack') {
          var pk = t.packing || [];
          h += '<div class="hint">' + (pk.length ? T.packLeft(t) + ' left to pack' : 'Start from a list, then add your own.') + '</div>';
          h += '<div class="subs">' + Object.keys(TPL).map(function (k) { return '<button data-tpl="' + esc(k) + '" type="button">+ ' + esc(k) + '</button>'; }).join('') + '<button data-tpl="_basics" type="button">+ Basics</button></div>';
          h += '<div class="row" style="border:0;padding:4px 0"><input id="pkNew" maxlength="80" placeholder="Add an item" style="flex:1"><button class="btn" id="pkAdd" type="button">Add</button></div><div class="card">' + (pk.length ? pk.map(function (x, i) { return '<div class="row"><input type="checkbox" data-pk="' + i + '"' + (x.done ? ' checked' : '') + ' aria-label="Packed"><div class="m"><b style="' + (x.done ? 'text-decoration:line-through;opacity:.55' : '') + '">' + esc(x.t) + '</b></div><button class="ibtn" data-pkdel="' + i + '" type="button" aria-label="Remove">✕</button></div>'; }).join('') : '<div class="empty">Nothing on the list yet.</div>') + '</div>';
          if (pk.length) h += '<div class="btns"><button class="btn ghost" id="pkSend" type="button">Add unpacked to my Packing list</button><button class="btn ghost" id="pkReset" type="button">Uncheck all</button></div>';
        } else if (tab === 'cost') {
          var tot = total(t), bud = t.budget || 0, by = {}; (t.costs || []).forEach(function (c) { by[c.type] = (by[c.type] || 0) + c.amount; });
          h += '<div class="stat"><div><b>' + VA.money(tot) + '</b><span>spent or booked</span></div>' + (bud ? '<div><b>' + VA.money(bud - tot) + '</b><span>' + (tot > bud ? 'over budget' : 'left in budget') + '</span></div>' : '') + '</div>';
          if (bud) h += '<div class="bar' + (tot > bud ? ' over' : '') + '"><i style="width:' + Math.min(100, Math.round(tot * 100 / bud)) + '%"></i></div>';
          h += '<div class="card">' + ((t.costs || []).length ? t.costs.map(function (c, i) { return '<div class="row"><div class="m"><b>' + esc(c.label || c.type) + '</b><span>' + esc(c.type) + '</span></div><span class="amt">' + VA.money(c.amount) + '</span><button class="ibtn" data-cdel="' + i + '" type="button" aria-label="Remove">✕</button></div>'; }).join('') : '<div class="empty">No costs yet.</div>') + '</div>';
          h += '<label class="f">Add a cost</label><input id="cLbl" maxlength="60" placeholder="What for"><select id="cType">' + COST_TYPES.map(function (x) { return '<option>' + x + '</option>'; }).join('') + '</select><input id="cAmt" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Amount ($)"><div class="btns"><button class="btn" id="cAdd" type="button">Add cost</button></div>';
          var names = Object.keys(by); if (names.length > 1) h += '<div class="hint">' + names.map(function (k) { return esc(k) + ' ' + VA.money(by[k]); }).join(' · ') + '</div>';
        } else {
          var dc = t.docs || [];
          h += '<div class="hint">Keep confirmation numbers and addresses here. Do not store passport, card or ID numbers.</div><div class="card">' + (dc.length ? dc.map(function (x, i) { return '<div class="row"><div class="m"><b>' + esc(x.t) + '</b><span>' + esc(x.ref || '') + '</span></div><button class="ibtn" data-ddel="' + i + '" type="button" aria-label="Remove">✕</button></div>'; }).join('') : '<div class="empty">No bookings saved yet.</div>') + '</div>';
          h += '<label class="f">Add a booking</label><input id="dT" maxlength="60" placeholder="Hotel, flight, rental car"><input id="dR" maxlength="120" placeholder="Confirmation number, address, time"><div class="btns"><button class="btn" id="dAdd" type="button">Save booking</button></div>';
        }
        h += '<div class="btns"><button class="btn ghost" id="tEdit" type="button">Edit trip</button><button class="btn ghost" id="tAsk" type="button">Ask for ideas</button></div>';
        box.innerHTML = h; wire();
      }
      function wire() {
        var t = get();
        box.querySelector('#tx').onclick = close;
        box.querySelectorAll('[data-tab]').forEach(function (b) { b.onclick = function () { tab = b.getAttribute('data-tab'); draw(); }; });
        box.querySelector('#tEdit').onclick = function () { close(); T.form(t); };
        box.querySelector('#tAsk').onclick = function () { close(); VA.go('ask'); VA.ai.send('Give me a simple plan and things to remember for my trip "' + t.name + '"' + (t.dest ? ' to ' + t.dest : '') + ' on ' + t.start + '. Keep it short.'); };
        box.querySelectorAll('[data-day]').forEach(function (a) { a.onchange = function () { var p = Object.assign({}, get().plan || {}); var v = a.value.trim(); if (v) p[a.getAttribute('data-day')] = v; else delete p[a.getAttribute('data-day')]; put({ plan: p }); }; });
        function addItems(arr) { var cur = (get().packing || []).slice(), have = {}; cur.forEach(function (x) { have[x.t.toLowerCase()] = 1; }); arr.forEach(function (x) { if (!have[x.toLowerCase()] && cur.length < 120) cur.push({ t: x, done: false }); }); put({ packing: cur }); }
        box.querySelectorAll('[data-tpl]').forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-tpl'); addItems(k === '_basics' ? BASICS : TPL[k]); }; });
        var pa = box.querySelector('#pkAdd'); if (pa) pa.onclick = function () { var v = box.querySelector('#pkNew').value.trim(); if (v) addItems([v.slice(0, 80)]); };
        var pn = box.querySelector('#pkNew'); if (pn) pn.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); pa.click(); } };
        box.querySelectorAll('[data-pk]').forEach(function (c) { c.onchange = function () { var cur = (get().packing || []).slice(), i = +c.getAttribute('data-pk'); if (cur[i]) { cur[i] = { t: cur[i].t, done: c.checked }; put({ packing: cur }); } }; });
        box.querySelectorAll('[data-pkdel]').forEach(function (c) { c.onclick = function () { var cur = (get().packing || []).slice(); cur.splice(+c.getAttribute('data-pkdel'), 1); put({ packing: cur }); }; });
        var rs = box.querySelector('#pkReset'); if (rs) rs.onclick = function () { put({ packing: (get().packing || []).map(function (x) { return { t: x.t, done: false }; }) }); };
        var sd = box.querySelector('#pkSend'); if (sd) sd.onclick = function () { var left = (get().packing || []).filter(function (x) { return !x.done; }); if (!left.length) { VA.toast('Everything is packed.'); return; } var have = {}; S.data.items.forEach(function (x) { if (x.list === 'Packing' && !x.done) have[(x.text || '').toLowerCase()] = 1; }); var n = 0; left.forEach(function (x) { if (!have[x.t.toLowerCase()]) { VA.save('items', null, { list: 'Packing', text: x.t, done: false }); n++; } }); VA.toast(n + ' added to your Packing list.'); };
        var ca = box.querySelector('#cAdd'); if (ca) ca.onclick = function () { var c = VA.cents(box.querySelector('#cAmt').value); if (!(c > 0)) { VA.toast('Enter an amount.'); return; } var cur = (get().costs || []).slice(); if (cur.length >= 100) return; cur.push({ label: box.querySelector('#cLbl').value.trim().slice(0, 60), type: box.querySelector('#cType').value, amount: c }); put({ costs: cur }); };
        box.querySelectorAll('[data-cdel]').forEach(function (c) { c.onclick = function () { var cur = (get().costs || []).slice(); cur.splice(+c.getAttribute('data-cdel'), 1); put({ costs: cur }); }; });
        var da = box.querySelector('#dAdd'); if (da) da.onclick = function () { var v = box.querySelector('#dT').value.trim(); if (!v) return; var cur = (get().docs || []).slice(); if (cur.length >= 40) return; cur.push({ t: v.slice(0, 60), ref: box.querySelector('#dR').value.trim().slice(0, 120) }); put({ docs: cur }); };
        box.querySelectorAll('[data-ddel]').forEach(function (c) { c.onclick = function () { var cur = (get().docs || []).slice(); cur.splice(+c.getAttribute('data-ddel'), 1); put({ docs: cur }); }; });
      }
      VA.onChange(function () { if (!box.isConnected) return; var ae = document.activeElement; if (ae && box.contains(ae) && /^(TEXTAREA|SELECT)$/.test(ae.tagName) || (ae && box.contains(ae) && ae.tagName === 'INPUT' && ae.type !== 'checkbox')) return; draw(); });
      tab = 'plan'; draw();
    });
  };
  // Dated things from trips, used by the calendar, Today and alerts.
  T.occ = function (from, to) {
    var out = [];
    (S.data.trips || []).forEach(function (t) {
      if (!t.start) return;
      if (t.start >= from && t.start <= to) out.push({ kind: 'trip', date: t.start, ref: t, time: '', who: '', color: '#62B6F5', icon: '✈️', title: 'Trip: ' + t.name + (t.dest ? ' to ' + t.dest : '') });
      var pd = VA.addDays(t.start, -2); if (pd >= from && pd <= to && T.packLeft(t) > 0 && (t.packing || []).length) out.push({ kind: 'trip', date: pd, ref: t, time: '', who: '', color: '#62B6F5', icon: '🧳', title: 'Finish packing for ' + t.name + ' (' + T.packLeft(t) + ' left)', pack: true });
    });
    return out;
  };
})();
