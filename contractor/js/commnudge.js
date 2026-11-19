// Dashboard card that nudges a contractor to set up the Vyqil community listing, and counts nearby requests.
(function () {
  function css() {
    if (document.getElementById('vqNoteCss')) return; var st = document.createElement('style'); st.id = 'vqNoteCss';
    st.textContent = '.vq-note{display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;text-align:left;margin:12px 0;padding:12px 14px 12px 18px;border-radius:12px;border:1px solid #1c2a3a;background:#0C1117;color:#e8eef7;font:inherit;cursor:pointer;position:relative;overflow:hidden;text-decoration:none}.vq-note::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:#2b7bd8}.vq-note.red::before{background:#e5484d}.vq-note .t{flex:1;min-width:0}.vq-note .t b{display:block;font-size:.95rem}.vq-note .t span{display:block;font-size:.8rem;color:#8a9bb0;margin-top:2px}.vq-note .dot{min-width:24px;height:24px;border-radius:12px;background:#e5484d;color:#fff;font-size:.78rem;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 6px}.vq-note.blue .dot{background:#2b7bd8}.vq-note .go{color:#8a9bb0;font-size:1.3rem;line-height:1}';
    document.head.appendChild(st);
  }
  function noteEl(tone, count, title, sub) {
    var a = document.createElement('a'); a.className = 'vq-note ' + tone; a.href = 'community.html'; var d = document.createElement('span'); d.className = 'dot'; d.textContent = count; a.appendChild(d);
    var t = document.createElement('div'); t.className = 't'; var b = document.createElement('b'); b.textContent = title; var sp = document.createElement('span'); sp.textContent = sub; t.appendChild(b); t.appendChild(sp); a.appendChild(t);
    var g = document.createElement('span'); g.className = 'go'; g.textContent = '\u203a'; a.appendChild(g); return a;
  }
  // Community requests that match this business become leads on their own (source "Vyqil Community"). A request is only added once per device, so deleting a lead keeps it deleted.
  function autoAdd(ctx, list) {
    if (['owner', 'gm', 'supervisor'].indexOf(ctx.role) < 0) return; var key = 'vq_comm_sync_' + ctx.bizId, done = []; try { done = JSON.parse(localStorage.getItem(key) || '[]') || []; } catch (e) { /* optional */ }
    var dis = lj('vq_ldis_' + ctx.bizId) || {}, col = ctx.bizRef.collection('leads'), todo = list.filter(function (l) { return done.indexOf(l.id) < 0 && !dis[l.id]; }).slice(0, 15);
    todo.forEach(function (l) {
      var ref = col.doc('vq' + l.id);
      ref.get().then(function (d) {
        var p = d.exists ? Promise.resolve() : ref.set({ communityLeadId: l.id, name: l.fromName, phone: l.phone || '', email: l.email || '', address: l.city, source: 'Vyqil Community', status: 'New', followUpOn: '', jobDetails: (l.trade + ': ' + l.title + (l.details ? '. ' + l.details : '') + ' (Vyqil community request)').slice(0, 900), notes: 'From the Vyqil community. Reply there to give them your contact details.', createdAt: vyro.stamp(), createdBy: ctx.user.uid, statusChangedAt: vyro.stamp(), updatedAt: vyro.stamp() });
        return p.then(function () { done.push(l.id); try { localStorage.setItem(key, JSON.stringify(done.slice(-300))); } catch (e) { /* optional */ } });
      }).catch(function () { /* try again next time */ });
    });
  }
  // Makes (or finds) the lead for a community job and opens a new estimate with everything Vyqil knows filled in:
  // customer name, phone, email, town and the job description.
  async function quote(ctx, l) {
    var col = ctx.bizRef.collection('leads'), id = '', q = await col.where('communityLeadId', '==', l.id).limit(1).get();
    var info = { name: l.fromName || '', phone: l.phone || '', email: l.email || '', address: l.city || '', jobDetails: (l.trade + ': ' + l.title + (l.details ? '. ' + l.details : '') + ' (Vyqil community request)').slice(0, 900), updatedAt: vyro.stamp() };
    if (!q.empty) { id = q.docs[0].id; var cur = q.docs[0].data(), up = { updatedAt: vyro.stamp() }; if (!cur.email && info.email) up.email = info.email; if (!cur.phone && info.phone) up.phone = info.phone; await col.doc(id).update(up); }
    else { id = 'vq' + l.id; await col.doc(id).set(Object.assign({ communityLeadId: l.id, source: 'Vyqil Community', status: 'New', followUpOn: '', notes: 'From the Vyqil community. Reply there to give them your contact details.', createdAt: vyro.stamp(), createdBy: ctx.user.uid, statusChangedAt: vyro.stamp() }, info)); }
    location.href = 'estimate.html?lead=' + encodeURIComponent(id) + '&tpl=' + encodeURIComponent(l.trade || '');
  }
  function lj(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function mount(ctx, opts) {
    opts = opts || {}; var V = window.VQCommunity, host = opts.host || document.getElementById('vTiles'); if (!V || !host || !ctx) return; css();
    var canEdit = ctx.role === 'owner' || ctx.role === 'gm', db = vyro.db, seenKey = 'vq_comm_seen_' + ctx.bizId;
    var card = document.createElement('a'); card.className = 'card'; card.href = 'community.html'; card.style.cssText = 'display:none;text-decoration:none;color:inherit;margin:12px 0';
    var h = document.createElement('h2'); h.style.margin = '0 0 4px'; var p = document.createElement('p'); p.style.cssText = 'margin:0;opacity:.85'; card.appendChild(h); card.appendChild(p);
    host.parentNode.insertBefore(card, host);
    var redHost = host.parentNode, redRef = card;
    if (!opts.leadsOnly) {
      // Someone chose this business: show it on the dashboard until the Community page has been opened.
      db.collection('communityLeads').where('chosen', '==', ctx.bizId).get().then(function (s) {
        var m = lj('vq_won_seen_' + ctx.bizId) || {}, fresh = s.docs.filter(function (d) { return d.data().status === 'assigned' && !m[d.id]; });
        if (!fresh.length) return; var l0 = fresh[0].data();
        var wrap = document.createElement('div');
        wrap.appendChild(noteEl('blue', String(fresh.length), 'You were chosen' + (fresh.length === 1 ? ' for ' + (l0.title || 'a job') : ''), fresh.length === 1 ? 'From ' + (l0.fromName || 'a Vyqil business') + '. Tap to see their details.' : 'Tap to see who picked you'));
        fresh.slice(0, 3).forEach(function (d) {
          var l = d.data(), b = document.createElement('button'); l.id = d.id; b.type = 'button'; b.className = 'btn'; b.style.cssText = 'display:block;width:100%;margin:0 0 8px';
          b.textContent = 'Create estimate' + (fresh.length > 1 ? ': ' + (l.title || 'job') : '');
          b.onclick = function () { b.disabled = true; b.textContent = 'Opening...'; quote(ctx, l).catch(function () { b.disabled = false; b.textContent = 'Could not start. Open Community instead'; b.onclick = function () { location.href = 'community.html'; }; }); };
          wrap.appendChild(b);
        });
        redHost.insertBefore(wrap, redRef);
      }, function () { /* optional */ });
      db.collection('communityLeads').where('fromBiz', '==', ctx.bizId).where('status', '==', 'open').get().then(function (s) {
        var n = 0, pend = s.docs.length, counts = {}; if (!pend) return;
        s.docs.forEach(function (d) { db.collection('communityLeads').doc(d.id).collection('offers').get().then(function (o) { var seen = 0; try { seen = +JSON.parse(localStorage.getItem('vq_rep_seen_' + d.id) || '0') || 0; } catch (e) { /* optional */ } var cnt = o.size != null ? o.size : o.docs.length; counts[d.id] = cnt; if (cnt > seen) n += cnt - seen; if (--pend === 0 && n) { var red = noteEl('red', String(n), 'New ' + (n === 1 ? 'reply' : 'replies'), (n === 1 ? 'A business replied' : n + ' businesses replied') + ' to your requests'); red.onclick = function (ev) { ev.preventDefault(); red.remove(); s.docs.forEach(function (q) { try { localStorage.setItem('vq_rep_seen_' + q.id, JSON.stringify(counts[q.id] || 0)); } catch (e) { /* optional */ } }); location.href = 'community.html'; }; redHost.insertBefore(red, redRef); } }, function () { pend--; }); });
      }, function () { /* optional */ });
    }
    function show(t, s) { h.textContent = t; p.textContent = s; card.style.display = 'block'; }
    function badge(n) { var a = document.querySelector('a.mi[href="community.html"]'); if (!a || !n) return; var b = document.createElement('span'); b.className = 'badge'; b.textContent = n; a.appendChild(document.createTextNode(' ')); a.appendChild(b); }
    db.collection('directory').doc(ctx.bizId).get().then(function (d) {
      var x = d.exists ? d.data() : null;
      if (!x || x.lat == null) { if (canEdit && !opts.leadsOnly) show('Get jobs from nearby Vyqil businesses', 'Set your location and trades so landlords, realtors and other businesses within 100 miles can send you requests. It takes a minute.'); return; }
      if (!x.listed) { if (canEdit && !opts.leadsOnly) show('You are hidden from the Vyqil community', 'Turn your listing on to receive requests from nearby businesses.'); return; }
      var seen = 0; try { seen = +localStorage.getItem(seenKey) || 0; } catch (e) { /* optional */ }
      var rad = x.radius || 100, trades = x.trades || [];
      return db.collection('communityLeads').where('cell', 'in', V.cellsAround(x.lat, x.lng, rad)).where('status', '==', 'open').get().then(function (s) {
        var total = 0, fresh = 0, match = [], dis = lj('vq_ldis_' + ctx.bizId) || {}, seenL = lj('vq_lseen_' + ctx.bizId) || {};
        s.docs.forEach(function (q) {
          var l = q.data(); if (dis[q.id]) return; if ((l.target || 'contractor') !== 'contractor' || l.fromBiz === ctx.bizId) return;
          if (l.to && l.to !== ctx.bizId) return;
          if (V.miles(x.lat, x.lng, l.lat, l.lng) > Math.min(rad, l.radius || 100)) return;
          if (!l.to && trades.length && l.trade !== 'Other' && trades.indexOf(l.trade) < 0) return;
          l.id = q.id; match.push(l); total++; if (!seenL[q.id]) fresh++;
        });
        if (fresh) show('You have ' + fresh + ' new ' + (fresh === 1 ? 'lead' : 'leads'), 'From other Vyqil businesses near you. Tap to see and reply. Replying is how you win the job.');
        else if (total) show(total + ' open community ' + (total === 1 ? 'lead' : 'leads') + ' near you', 'Tap to see them.');
        badge(fresh); autoAdd(ctx, match);
      });
    }).catch(function () { /* the card is optional */ });
  }
  window.vcommnudge = { quote: quote, mount: mount, leadsBanner: function (ctx) { var h = document.getElementById('listView') || document.querySelector('main, .wrap, body > div'); if (h && h.firstElementChild) mount(ctx, { host: h.firstElementChild, leadsOnly: true }); } };
})();
