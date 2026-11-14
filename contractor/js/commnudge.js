// Dashboard card that nudges a contractor to set up the Vyqil community listing, and counts nearby requests.
(function () {
  function mount(ctx) {
    var V = window.VQCommunity, host = document.getElementById('vTiles'); if (!V || !host || !ctx) return;
    var canEdit = ctx.role === 'owner' || ctx.role === 'gm', db = vyro.db, seenKey = 'vq_comm_seen_' + ctx.bizId;
    var card = document.createElement('a'); card.className = 'card'; card.href = 'community.html'; card.style.cssText = 'display:none;text-decoration:none;color:inherit;border:2px solid #2FBF8B;margin:12px 0';
    var h = document.createElement('h2'); h.style.margin = '0 0 4px'; var p = document.createElement('p'); p.style.cssText = 'margin:0;opacity:.85'; card.appendChild(h); card.appendChild(p);
    host.parentNode.insertBefore(card, host);
    function show(t, s) { h.textContent = t; p.textContent = s; card.style.display = 'block'; }
    function badge(n) { var a = document.querySelector('a.mi[href="community.html"]'); if (!a || !n) return; var b = document.createElement('span'); b.className = 'badge'; b.textContent = n; a.appendChild(document.createTextNode(' ')); a.appendChild(b); }
    db.collection('directory').doc(ctx.bizId).get().then(function (d) {
      var x = d.exists ? d.data() : null;
      if (!x || x.lat == null) { if (canEdit) show('Get jobs from nearby Vyqil businesses', 'Set your location and trades so landlords, realtors and other businesses within 100 miles can send you requests. It takes a minute.'); return; }
      if (!x.listed) { if (canEdit) show('You are hidden from the Vyqil community', 'Turn your listing on to receive requests from nearby businesses.'); return; }
      var seen = 0; try { seen = +localStorage.getItem(seenKey) || 0; } catch (e) { /* optional */ }
      var rad = x.radius || 100, trades = x.trades || [];
      return db.collection('communityLeads').where('cell', 'in', V.cellsAround(x.lat, x.lng, rad)).where('status', '==', 'open').get().then(function (s) {
        var total = 0, fresh = 0;
        s.docs.forEach(function (q) {
          var l = q.data(); if ((l.target || 'contractor') !== 'contractor' || l.fromBiz === ctx.bizId) return;
          if (l.to && l.to !== ctx.bizId) return;
          if (V.miles(x.lat, x.lng, l.lat, l.lng) > Math.min(rad, l.radius || 100)) return;
          if (!l.to && trades.length && l.trade !== 'Other' && trades.indexOf(l.trade) < 0) return;
          total++; var ms = l.createdAt && l.createdAt.toMillis ? l.createdAt.toMillis() : 0; if (ms > seen) fresh++;
        });
        if (fresh) show(fresh + (fresh === 1 ? ' new request near you' : ' new requests near you'), 'Tap to see and reply. Replying is how you win the job.');
        else if (total) show(total + ' open ' + (total === 1 ? 'request' : 'requests') + ' near you', 'Tap to see them.');
        badge(fresh);
      });
    }).catch(function () { /* the card is optional */ });
  }
  window.vcommnudge = { mount: mount };
})();
