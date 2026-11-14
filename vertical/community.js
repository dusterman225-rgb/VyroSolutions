// VYQIL COMMUNITY (business app side). Loaded after engine.js; does nothing unless the app's settings include a "community" block.
//  - SEND: find nearby businesses of another Vyqil kind (contractor, services, landlord, realtor) and post a request they see as a lead.
//  - RECEIVE: list your own business in the community, see requests within your range, reply, or add them to your own records.
(function () {
  'use strict';
  var Q = window.Q, C = window.VQ_APP, V = window.VQCommunity;
  if (!Q || !C || !C.community || !V) return;
  var el = Q.u.el, S = Q.S, cfg = C.community, myLeads = [], offers = {}, watched = {}, firstLoad = true, replyCount = {};
  var dir = null, inLeads = [], inReplied = {}, inUnsub = null, inAsked = {};

  function db() { return Q.db; }
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* optional */ } }
  function field(s, label, node) { s.appendChild(el('label', 'f', label)); s.appendChild(node); return node; }
  function opt(sel, list, blank) { if (blank) { var b = el('option', '', blank); b.value = ''; sel.appendChild(b); } list.forEach(function (o) { var x = el('option', '', o); x.value = o; sel.appendChild(x); }); return sel; }
  function btnRow(s) { var r = el('div', 'btns'); s.appendChild(r); return r; }
  function mk(label, cls, fn) { var b = el('button', 'btn ' + (cls || ''), label); b.type = 'button'; if (fn) b.onclick = fn; return b; }
  function block(b) { b.style.cssText = 'display:block;width:100%;margin:8px 0'; return b; }
  function cidKey(t) { return t === 'contractor' ? 'cid' : 'cid_' + t; }
    function ms(ts) { return ts && ts.toMillis ? ts.toMillis() : Date.now(); }
  function refresh() { if (S.tab === 'more' && Q.render && !document.querySelector('.modal')) Q.render(); }

  // ---------- my own requests and the replies to them ----------
  function watchMine() {
    db().collection('communityLeads').where('fromBiz', '==', S.biz.id).onSnapshot(function (snap) {
      myLeads = snap.docs.map(function (d) { var o = d.data(); o.id = d.id; return o; }); myLeads.sort(function (a, b) { return ms(b.createdAt) - ms(a.createdAt); });
      myLeads.forEach(watchOffers); refresh();
    }, function () { /* the rest of the app keeps working without it */ });
    setTimeout(function () { firstLoad = false; }, 5000);
  }
  function watchOffers(l) {
    if (watched[l.id]) return;
    watched[l.id] = db().collection('communityLeads').doc(l.id).collection('offers').onSnapshot(function (snap) {
      offers[l.id] = snap.docs.map(function (d) { var o = d.data(); o.id = d.id; return o; });
      var n = offers[l.id].length;
      if (!firstLoad && n > (replyCount[l.id] || 0)) Q.toast('Someone replied to "' + (l.title || 'your request') + '". See More > Community.');
      replyCount[l.id] = n; refresh();
    }, function () { /* ignore */ });
  }
  function totalReplies() { var n = 0; myLeads.forEach(function (l) { if (l.status === 'open') n += (offers[l.id] || []).length; }); return n; }

  // ---------- where is it ----------
  function askPlace(placeRec, text, done) {
    Q.modal(function (s, close) {
      s.appendChild(el('h3', '', 'Where is it?'));
      s.appendChild(el('p', 'hint', 'Type a street address or ZIP code. Other businesses only ever see the town and state, never the address.'));
      var i = el('input'); i.maxLength = 120; i.value = text || ''; i.placeholder = '123 Main St, Springfield, IL or 62701'; field(s, 'Address or ZIP code', i);
      var msg = el('div', 'note err'); s.appendChild(msg);
      var b = btnRow(s), go = mk('Find it', '', null), me = mk('Use my location', 'ghost', null), x = mk('Cancel', 'ghost', close); b.appendChild(go); b.appendChild(me); b.appendChild(x);
      function got(p) {
        if (!p.city) p.city = placeRec && (placeRec.loc || placeRec.city) ? (placeRec.loc || placeRec.city) : 'Your area';
        lsSet('vq_place_' + S.biz.id, p);
        if (placeRec && placeRec.id) Q.recs().doc(placeRec.id).update({ lat: p.lat, lng: p.lng, loc: p.city, updatedAt: Q.FV.serverTimestamp() }).catch(function () { /* the place is still used for this request */ });
        close(); done(p);
      }
      go.onclick = function () { msg.textContent = 'Looking...'; V.geocode(i.value).then(got, function (e) { msg.textContent = e.message; }); };
      me.onclick = function () { msg.textContent = 'Getting your location...'; V.here().then(got, function (e) { msg.textContent = e.message; }); };
    });
  }
  function getPlace(rec, cb) {
    var pr = cfg.place ? cfg.place(rec) : null, text = pr ? (cfg.placeText ? cfg.placeText(pr) : [pr.name || pr.address, pr.city].filter(Boolean).join(', ')) : '';
    if (pr && pr.lat != null && pr.lng != null) return cb({ lat: pr.lat, lng: pr.lng, city: pr.loc || pr.city || 'Your area', rec: pr });
    if (!pr) { var saved = lsGet('vq_place_' + S.biz.id); if (saved) return cb(saved); var fb = cfg.fallback ? cfg.fallback() : null; if (fb) return cb(fb); if (dir && dir.lat != null) return cb({ lat: dir.lat, lng: dir.lng, city: dir.city || 'Your area' }); }
    askPlace(pr, text, function (p) { p.rec = pr; cb(p); });
  }

  // ---------- SEND: "Find a Vyqil..." ----------
  // preset (optional) fills in the form from a record: { target, cat, title, details, urgent }
  function find(rec, preset) { getPlace(rec, function (place) { openFind(rec, place, preset || {}); }); }
  function openFind(rec, place, pre) {
    Q.modal(function (s, close) {
      s.appendChild(el('h3', '', 'Find a Vyqil...'));
      var near = el('div', 'hint', 'Near ' + place.city + '. '); var ch = el('button', 'btn sm ghost', 'Change place'); ch.type = 'button';
      ch.onclick = function () { close(); lsSet('vq_place_' + S.biz.id, null); askPlace(place.rec, '', function (p) { p.rec = place.rec; openFind(rec, p, pre); }); }; near.appendChild(ch); s.appendChild(near);
      var existing = rec && pre.target && rec[cidKey(pre.target)] ? myLeads.filter(function (l) { return l.id === rec[cidKey(pre.target)]; })[0] : null;
      if (existing) { var ex = el('div', 'note'); ex.textContent = 'You already sent a request for this (' + (existing.status === 'open' ? 'open' : existing.status) + ', ' + (offers[existing.id] || []).length + ' replies). '; var vb = el('button', 'btn sm ghost', 'See replies'); vb.type = 'button'; vb.onclick = function () { close(); requests(existing.id); }; ex.appendChild(vb); s.appendChild(ex); }
      var need = el('select'), b0 = el('option', '', 'Choose what you need...'); b0.value = ''; need.appendChild(b0);
      V.ORDER.forEach(function (t) { if (t === cfg.product) return; var g = el('optgroup'); g.label = V.NEED[t]; V.CATS[t].forEach(function (c) { var o = el('option', '', c); o.value = t + '|' + c; g.appendChild(o); }); need.appendChild(g); });
      if (pre.target && pre.cat) need.value = pre.target + '|' + pre.cat; field(s, 'What do you need? *', need);
      var rad = opt(el('select'), ['25', '50', '100']); rad.value = '100'; Array.prototype.forEach.call(rad.options, function (o) { o.textContent = 'Within ' + o.value + ' miles'; }); field(s, 'How far to look', rad);
      var title = el('input'); title.maxLength = 100; title.value = pre.title || ''; title.placeholder = 'Kitchen sink is leaking / Clean after move-out'; field(s, 'What exactly *', title);
      var det = el('textarea'); det.maxLength = 600; det.rows = 3; det.value = pre.details || ''; det.placeholder = 'Anything they should know. Do not put a street address or personal names here.'; field(s, 'Details', det);
      var urg = el('input'), uw = el('div', 'chk'); urg.type = 'checkbox'; urg.id = 'cm_urg'; urg.checked = !!pre.urgent; var ul = el('label', '', 'Urgent'); ul.htmlFor = urg.id; uw.appendChild(urg); uw.appendChild(ul); s.appendChild(uw);
      var shp = el('input'), pw = el('div', 'chk'); shp.type = 'checkbox'; shp.id = 'cm_sp'; var pl = el('label', '', 'Let businesses who see this request call me'); pl.htmlFor = shp.id; pw.appendChild(shp); pw.appendChild(pl); s.appendChild(pw);
      var ph = el('input'); ph.type = 'tel'; ph.maxLength = 30; ph.placeholder = 'Your phone number'; ph.style.display = 'none'; ph.value = lsGet('vq_phone') || ''; s.appendChild(ph); shp.onchange = function () { ph.style.display = shp.checked ? '' : 'none'; };
      var msg = el('div', 'note err'); s.appendChild(msg);
      var all = block(mk('', '', null)); s.appendChild(all);
      function sel() { var p = need.value.split('|'); return { target: p[0], cat: p.slice(1).join('|') }; }
      function allLabel() { var t = sel().target; all.textContent = 'Send to every ' + (t ? V.NAMES[t] : 'matching business') + ' within ' + rad.value + ' miles'; } allLabel();
      var info = el('div', 'hint'); s.appendChild(info);
      var lh = el('h4', '', 'Businesses near you'); lh.style.marginTop = '14px'; s.appendChild(lh);
      var tl = el('a', 'hint', 'How sharing works and what to avoid posting'); tl.href = '../community-terms.html'; tl.target = '_blank'; tl.style.display = 'block'; tl.style.margin = '8px 0'; s.appendChild(tl);
      var list = el('div', 'card'); s.appendChild(list); btnRow(s).appendChild(mk('Close', 'ghost', close));
      function build(to, toName) {
        var c = sel(); if (!c.target) { msg.textContent = 'Choose what you need.'; return null; }
        if (!title.value.trim()) { msg.textContent = 'Say what exactly you need.'; return null; }
        if (shp.checked && String(ph.value).replace(/\D/g, '').length < 7) { msg.textContent = 'Type a phone number, or untick the box.'; return null; }
        if (shp.checked) lsSet('vq_phone', ph.value.trim());
        return { fromBiz: S.biz.id, fromUid: S.user.uid, fromProduct: cfg.product, target: c.target, fromName: String(S.biz.name || '').slice(0, 80), trade: c.cat, title: title.value.trim().slice(0, 100), details: det.value.trim().slice(0, 600), urgent: !!urg.checked,
          city: String(place.city || '').slice(0, 60), lat: V.r2(place.lat), lng: V.r2(place.lng), cell: V.cellOf(V.r2(place.lat), V.r2(place.lng)), to: to || '', toName: (toName || '').slice(0, 80), radius: +rad.value, status: 'open', phone: shp.checked ? ph.value.trim().slice(0, 30) : '', recId: rec && rec.id ? rec.id : '', createdAt: Q.FV.serverTimestamp() };
      }
      function post(to, toName, btn) {
        var d = build(to, toName); if (!d) return; var cw = V.canPost(); if (cw) { msg.textContent = cw; return; } msg.textContent = ''; btn.disabled = true;
        db().collection('communityLeads').add(d).then(function (ref) {
          V.notePost(); V.notify('lead', ref.id);
          if (rec && rec.id) { var up = { updatedAt: Q.FV.serverTimestamp() }; up[cidKey(d.target)] = ref.id; Q.recs().doc(rec.id).update(up).catch(function () { /* request is still sent */ }); }
          close(); Q.toast(to ? 'Request sent to ' + toName + '.' : 'Request sent to ' + V.NOUNS[d.target] + ' near you. Replies show in More > Community.');
        }, function (e) { btn.disabled = false; msg.textContent = Q.friendly(e); });
      }
      all.onclick = function () { post('', '', all); };
      var tick = 0;
      function load() {
        allLabel(); var my = ++tick, c = sel(); list.textContent = ''; info.textContent = '';
        if (!c.target) { list.appendChild(el('div', 'empty', 'Choose what you need to see who is near you.')); return; }
        info.textContent = 'This shows up as a lead for ' + V.NOUNS[c.target] + ' in the ' + V.NAMES[c.target] + ' app. They reply with their details and you choose.';
        list.appendChild(el('div', 'empty', 'Looking...'));
        V.findProviders(db(), place.lat, place.lng, +rad.value, c.cat, c.target).then(function (res) {
          res = res.slice(0, 25);
          return V.stats(db(), res.map(function (x) { return x.id; })).then(function (st) { return { res: res, st: st }; });
        }).then(function (o) {
          if (my !== tick) return; list.textContent = ''; var res = o.res;
          if (!res.length) { list.appendChild(el('div', 'empty', 'Nobody listed for this yet. Sending to everyone within ' + rad.value + ' miles still works: businesses that join later will see it.')); return; }
          res.sort(function (a, b) { var A = o.st[a.id] || {}, B = o.st[b.id] || {}; return ((B.n >= 5 && B.avg >= 4.5) ? 1 : 0) - ((A.n >= 5 && A.avg >= 4.5) ? 1 : 0) || a.miles - b.miles; });
          res.forEach(function (c2) {
            var row = el('div', 'row'), m = el('div', 'm'); m.appendChild(el('b', '', c2.name)); m.appendChild(el('span', '', Math.round(c2.miles) + ' mi · ' + (c2.city || '') + ' · ' + (c2.trades || []).slice(0, 3).join(', ')));
            var bd = V.badge(o.st[c2.id], c2.perk); if (bd) { var bs = el('span', '', bd); bs.style.color = '#2FBF8B'; m.appendChild(bs); }
            var tr = V.trust(c2); if (tr) { var ts = el('span', '', tr); ts.style.opacity = '.8'; m.appendChild(ts); }
            if (c2.phone) { var a = el('a', '', c2.phone); a.href = V.phoneHref(c2.phone); a.style.display = 'block'; m.appendChild(a); }
            row.appendChild(m); var ask = mk('Ask this one', 'sm', null); ask.onclick = function () { post(c2.id, c2.name, ask); }; row.appendChild(ask); list.appendChild(row);
          });
        }, function (e) { if (my !== tick) return; list.textContent = ''; list.appendChild(el('div', 'empty', Q.friendly(e))); });
      }
      need.onchange = load; rad.onchange = load; load();
    });
  }
  function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }

  // ---------- my requests and replies ----------
  function requests(focusId) {
    Q.modal(function (s, close) {
      s.appendChild(el('h3', '', 'My requests and replies'));
      var body = el('div'); s.appendChild(body); btnRow(s).appendChild(mk('Close', 'ghost', close));
      function draw() {
        body.textContent = '';
        if (!myLeads.length) { body.appendChild(el('div', 'empty', 'No requests yet. Use the buttons in More > Community, or on a record.')); return; }
        myLeads.forEach(function (l) {
          var card = el('div', 'card'); if (focusId === l.id) card.style.outline = '2px solid #2F9';
          var h = el('div', 'row'), m = el('div', 'm'); m.appendChild(el('b', '', (l.urgent ? '[Urgent] ' : '') + l.title));
          m.appendChild(el('span', '', (V.NAMES[l.target || 'contractor'] || '') + ' · ' + l.trade + ' · ' + (l.to ? 'asked ' + (l.toName || 'one business') : 'sent to everyone nearby') + ' · ' + V.ago(l.createdAt))); h.appendChild(m);
          h.appendChild(el('span', 'pill' + (l.status === 'open' ? '' : ' ok'), l.status === 'open' ? 'Open' : l.status === 'assigned' ? 'Chosen' : l.status === 'done' ? 'Done' : 'Closed')); card.appendChild(h);
          var os = offers[l.id] || [];
          if (!os.length && l.status === 'open') card.appendChild(el('div', 'hint', 'No replies yet. A notice appears here when one arrives.'));
          os.forEach(function (o) {
            var r = el('div', 'row'), mm = el('div', 'm'); mm.appendChild(el('b', '', o.bizName + (l.chosen === o.bizId ? ' (chosen)' : '')));
            (function (box) { V.trustFor(db(), o.bizId).then(function (t) { if (t) { var ts = el('span', '', t); ts.style.opacity = '.8'; box.insertBefore(ts, box.children[1] || null); } }); })(mm);
            if (o.priceNote) mm.appendChild(el('span', '', 'Price: ' + o.priceNote)); if (o.message) mm.appendChild(el('span', '', o.message));
            var th = V.phoneHref(o.phone); if (th) { var a = el('a', '', 'Call ' + o.phone); a.href = th; a.style.display = 'block'; mm.appendChild(a); }
            if (o.email) { var e = el('a', '', o.email); e.href = 'mailto:' + encodeURIComponent(o.email); e.style.display = 'block'; mm.appendChild(e); }
            r.appendChild(mm);
            var mb = mk('Messages', 'ghost sm', function () { V.openThread(db(), l.id, o.bizId, S.user.uid, true, o.bizName); }); r.appendChild(mb);
            if (l.status === 'open') { var ch = mk('Choose', 'sm', null); ch.onclick = function () { choose(l, o, ch); }; r.appendChild(ch); }
            card.appendChild(r);
          });
          if (l.status === 'assigned') {
            var dr = el('div', 'row'), rs = opt(el('select'), ['5', '4', '3', '2', '1']); Array.prototype.forEach.call(rs.options, function (o) { o.textContent = o.value + (o.value === '1' ? ' star' : ' stars'); });
            var dn = mk('Job done', 'sm', null); dn.onclick = function () { dn.disabled = true; db().collection('communityLeads').doc(l.id).update({ status: 'done', rating: +rs.value, closedAt: Q.FV.serverTimestamp() }).then(function () { Q.toast('Thanks. This counts toward ' + (l.chosenName || 'their') + ' community record.'); }, function (e3) { dn.disabled = false; Q.toast(Q.friendly(e3)); }); };
            dr.appendChild(el('span', 'hint', 'Finished? Rate ' + (l.chosenName || 'them') + ':')); dr.appendChild(rs); dr.appendChild(dn); card.appendChild(dr);
          }
          if (l.status === 'open') { var cl = mk('Close this request', 'ghost sm', null); cl.style.margin = '8px 0'; cl.onclick = function () { db().collection('communityLeads').doc(l.id).update({ status: 'closed', closedAt: Q.FV.serverTimestamp() }).then(function () { Q.toast('Request closed.'); }, function (e2) { Q.toast(Q.friendly(e2)); }); }; card.appendChild(cl); }
          body.appendChild(card);
        });
      }
      function choose(l, o, btn) {
        btn.disabled = true;
        db().collection('communityLeads').doc(l.id).update({ status: 'assigned', chosen: o.bizId, chosenName: o.bizName, closedAt: Q.FV.serverTimestamp() }).then(function () {
          var rec = l.recId ? Q.get(l.recId) : null, fn = cfg.chosen && cfg.chosen[l.target || 'contractor'];
          if (rec && fn) { var up = fn(rec, o, l); if (up) { up.updatedAt = Q.FV.serverTimestamp(); Q.recs().doc(rec.id).update(up).catch(function () { /* ignore */ }); } }
          V.notify('chosen', l.id); Q.toast(o.bizName + ' chosen. Contact them with the details shown.');
        }, function (e) { btn.disabled = false; Q.toast(Q.friendly(e)); });
      }
      draw();
      var iv = setInterval(function () { if (!document.body.contains(s)) { clearInterval(iv); return; } if (!(document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName))) draw(); }, 2500);
    });
  }

  // ---------- RECEIVE: list my business, see requests near me ----------
  function loadDirectory() {
    if (!cfg.inbound) return;
    db().collection('directory').doc(S.biz.id).get().then(function (d) { dir = d.exists ? d.data() : null; watchInbox(); refresh(); }, function () { /* ignore */ });
  }
  function inView(l) {
    if (!dir || dir.lat == null) return false;
    if ((l.target || 'contractor') !== cfg.product || l.fromBiz === S.biz.id) return false; if (l.to && l.to !== S.biz.id) return false;
    if (V.miles(dir.lat, dir.lng, l.lat, l.lng) > Math.min(dir.radius || 100, l.radius || 100)) return false;
    return l.to === S.biz.id || l.trade === 'Other' || !(dir.trades || []).length || dir.trades.indexOf(l.trade) > -1;
  }
  function watchInbox() {
    if (inUnsub) { inUnsub(); inUnsub = null; } if (!dir || dir.lat == null || !dir.listed) { inLeads = []; return; }
    inUnsub = db().collection('communityLeads').where('cell', 'in', V.cellsAround(dir.lat, dir.lng, dir.radius || 100)).where('status', '==', 'open').limit(150).onSnapshot(function (s) {
      inLeads = s.docs.map(function (d) { var x = d.data(); x.id = d.id; return x; }).filter(inView);
      inLeads.forEach(function (l) { if (inAsked[l.id]) return; inAsked[l.id] = 1; db().collection('communityLeads').doc(l.id).collection('offers').doc(S.biz.id).get().then(function (o) { if (o.exists) { inReplied[l.id] = true; refresh(); } }, function () { /* ignore */ }); });
      refresh();
    }, function () { /* ignore */ });
  }
  function waiting() { return inLeads.filter(function (l) { return !inReplied[l.id]; }).length; }

  function listing() {
    var ic = cfg.inbound, cats = V.CATS[cfg.product], me = dir ? { lat: dir.lat, lng: dir.lng, city: dir.city } : (lsGet('vq_place_' + S.biz.id) || { lat: null });
    Q.modal(function (s, close) {
      s.appendChild(el('h3', '', ic.listTitle || 'Community listing'));
      s.appendChild(el('p', 'hint', ic.listHelp || 'Other Vyqil businesses near you can find you, and requests within your range show up here. Vyqil uses the place you set, not live tracking. Only the town and an approximate point are saved.'));
      var pl = el('input'); pl.maxLength = 120; pl.value = me.city || ''; pl.placeholder = '62701 or Springfield, IL'; field(s, 'Where do you work from? (address or ZIP)', pl);
      var pm = el('div', 'note'); pm.textContent = me.lat != null ? 'Using ' + me.city + '.' : ''; s.appendChild(pm);
      var b1 = btnRow(s), f = mk('Find this place', 'ghost sm', null), u = mk('Use my location', 'ghost sm', null); b1.appendChild(f); b1.appendChild(u);
      function got(p) { me = p; if (!me.city) me.city = 'Your area'; pm.className = 'note ok'; pm.textContent = 'Using ' + me.city + '.'; }
      f.onclick = function () { pm.className = 'note'; pm.textContent = 'Looking...'; V.geocode(pl.value).then(got, function (e) { pm.className = 'note err'; pm.textContent = e.message; }); };
      u.onclick = function () { pm.className = 'note'; pm.textContent = 'Getting your location...'; V.here().then(got, function (e) { pm.className = 'note err'; pm.textContent = e.message; }); };
      s.appendChild(el('label', 'f', ic.catLabel || 'What you offer'));
      var boxes = {}; cats.forEach(function (c) { var w = el('div', 'chk'), i = el('input'); i.type = 'checkbox'; i.id = 'cm_c_' + c.replace(/\W/g, ''); i.checked = !!(dir && (dir.trades || []).indexOf(c) > -1); boxes[c] = i; var l = el('label', '', c); l.htmlFor = i.id; w.appendChild(i); w.appendChild(l); s.appendChild(w); });
      var rad = opt(el('select'), ['25', '50', '100']); Array.prototype.forEach.call(rad.options, function (o) { o.textContent = 'Up to ' + o.value + ' miles'; }); rad.value = String(dir && dir.radius || 100); field(s, 'How far will you go for work?', rad);
      var sp = el('input'), sw = el('div', 'chk'); sp.type = 'checkbox'; sp.id = 'cm_sp2'; sp.checked = !!(dir && dir.phone); var sl = el('label', '', 'Show my business phone to others who look me up'); sl.htmlFor = sp.id; sw.appendChild(sp); sw.appendChild(sl); s.appendChild(sw);
      var phIn = el('input'); phIn.type = 'tel'; phIn.maxLength = 30; phIn.placeholder = 'Business phone'; phIn.value = (dir && dir.phone) || lsGet('vq_phone') || ''; s.appendChild(phIn);
      var perk = el('input'); perk.maxLength = 80; perk.placeholder = '10% off for Vyqil businesses'; perk.value = (dir && dir.perk) || ''; field(s, 'Member perk for other Vyqil businesses (optional)', perk); s.appendChild(el('div', 'hint', 'Shown next to your name when other businesses look for someone like you. You set it and you honor it.'));
      var lic = el('input'); lic.maxLength = 40; lic.placeholder = 'License number (optional)'; lic.value = (dir && dir.license) || ''; field(s, 'License (optional)', lic);
      var iw = el('div', 'chk'), ins = el('input'); ins.type = 'checkbox'; ins.id = 'cm_ins'; ins.checked = !!(dir && dir.insured); var il = el('label', '', 'I carry business insurance'); il.htmlFor = ins.id; iw.appendChild(ins); iw.appendChild(il); s.appendChild(iw); s.appendChild(el('div', 'hint', 'Shown to others as self-reported. Vyqil does not check licenses or insurance.'));
      var lw = el('div', 'chk'), li = el('input'); li.type = 'checkbox'; li.id = 'cm_ls'; li.checked = !!(dir && dir.listed); var ll = el('label', '', ic.listLabel || 'List me in the Vyqil community (untick to hide)'); ll.htmlFor = li.id; lw.appendChild(li); lw.appendChild(ll); s.appendChild(lw);
      var tl = el('a', 'hint', 'How sharing works and what to avoid posting'); tl.href = '../community-terms.html'; tl.target = '_blank'; tl.style.display = 'block'; tl.style.margin = '8px 0'; s.appendChild(tl);
      var msg = el('div', 'note err'); s.appendChild(msg);
      var b2 = btnRow(s), save = mk('Save', '', null), x = mk('Cancel', 'ghost', close); b2.appendChild(save); b2.appendChild(x);
      save.onclick = function () {
        if (me.lat == null) { msg.textContent = 'Set your place first.'; return; }
        var picked = cats.filter(function (c) { return boxes[c].checked; }); if (li.checked && !picked.length) { msg.textContent = 'Tick at least one.'; return; }
        if (sp.checked && String(phIn.value).replace(/\D/g, '').length < 7) { msg.textContent = 'Type a phone number, or untick the box.'; return; }
        if (sp.checked) lsSet('vq_phone', phIn.value.trim());
        var d = { bizId: S.biz.id, ownerUid: S.user.uid, product: cfg.product, name: String(S.biz.name || '').slice(0, 80), trades: picked, radius: +rad.value, lat: V.r2(me.lat), lng: V.r2(me.lng), cell: V.cellOf(V.r2(me.lat), V.r2(me.lng)), city: String(me.city || '').slice(0, 60), listed: !!li.checked, phone: sp.checked ? phIn.value.trim().slice(0, 30) : '', perk: perk.value.trim().slice(0, 80), license: lic.value.trim().slice(0, 40), insured: !!ins.checked, updatedAt: Q.FV.serverTimestamp() };
        save.disabled = true;
        db().collection('directory').doc(S.biz.id).set(d).then(function () { dir = d; inAsked = {}; inReplied = {}; watchInbox(); close(); Q.toast('Saved.'); }, function (e) { save.disabled = false; msg.textContent = Q.friendly(e); });
      };
    });
  }

  function inbox() {
    var ic = cfg.inbound;
    Q.modal(function (s, close) {
      s.appendChild(el('h3', '', ic.inboxTitle || 'Requests near you'));
      var won = el('div'); s.appendChild(won);
      db().collection('communityLeads').where('chosen', '==', S.biz.id).get().then(function (sn) {
        var ws = sn.docs.map(function (d) { var x = d.data(); x.id = d.id; return x; }).filter(function (x) { return x.status === 'assigned' || x.status === 'done'; }); if (!ws.length) return;
        won.appendChild(el('h4', '', 'Jobs you won'));
        ws.forEach(function (l) {
          var c = el('div', 'card'), m = el('div', 'm'); m.appendChild(el('b', '', l.title)); m.appendChild(el('span', '', 'From ' + l.fromName + ' · ' + l.city + ' · ' + (l.status === 'done' ? 'Done' : 'Chosen'))); if (l.details) m.appendChild(el('span', '', l.details)); c.appendChild(m);
          var th = V.phoneHref(l.phone); if (th) { var a = el('a', '', 'Call ' + l.phone); a.href = th; a.style.cssText = 'display:block;margin:6px 0'; c.appendChild(a); }
          btnRow(c).appendChild(mk('Messages', 'ghost sm', function () { V.openThread(db(), l.id, S.biz.id, S.user.uid, false, l.fromName); })); won.appendChild(c);
        });
      }, function () { /* ignore */ });
      var body = el('div'); s.appendChild(body); btnRow(s).appendChild(mk('Close', 'ghost', close));
      function draw() {
        body.textContent = '';
        if (!dir || dir.lat == null) { body.appendChild(el('div', 'empty', 'Set up your community listing first (More > Community).')); return; }
        if (!dir.listed) { body.appendChild(el('div', 'empty', 'You are hidden. Turn on your community listing to see requests.')); return; }
        if (!inLeads.length) { body.appendChild(el('div', 'empty', 'No open requests within ' + (dir.radius || 100) + ' miles right now. New ones appear here by themselves.')); return; }
        inLeads.slice().sort(function (a, b) { return (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0) || V.miles(dir.lat, dir.lng, a.lat, a.lng) - V.miles(dir.lat, dir.lng, b.lat, b.lng); }).forEach(function (l) {
          var card = el('div', 'card'), h = el('div', 'row'), m = el('div', 'm'); m.appendChild(el('b', '', (l.urgent ? '[Urgent] ' : '') + l.title));
          m.appendChild(el('span', '', l.trade + ' · ' + Math.round(V.miles(dir.lat, dir.lng, l.lat, l.lng)) + ' mi · ' + l.city + ' · ' + V.ago(l.createdAt) + (l.to ? ' · asked you' : '') + (inReplied[l.id] ? ' · you replied' : '')));
          m.appendChild(el('span', '', 'From ' + l.fromName + ' (' + (V.NAMES[l.fromProduct] || 'Vyqil') + ')')); if (l.details) m.appendChild(el('span', '', l.details)); h.appendChild(m); card.appendChild(h);
          var th = V.phoneHref(l.phone); if (th) { var a = el('a', '', 'Call ' + l.phone); a.href = th; a.style.cssText = 'display:block;margin:6px 0'; card.appendChild(a); }
          var r = btnRow(card), rp = mk(inReplied[l.id] ? 'Update my reply' : 'Reply with my details', 'sm', function () { reply(l); }); r.appendChild(rp);
          if (inReplied[l.id]) r.appendChild(mk('Messages', 'ghost sm', function () { V.openThread(db(), l.id, S.biz.id, S.user.uid, false, l.fromName); }));
          r.appendChild(mk('Report', 'ghost sm', function () { V.report(db(), l, S.user.uid, S.biz.id).then(function (ok) { if (ok) Q.toast('Reported. Thank you.'); }, function (e) { Q.toast(Q.friendly(e)); }); }));
          if (ic.addKind || ic.addAs) { var ad = mk(ic.addLabel || 'Add to my records', 'ghost sm', null); ad.onclick = function () { ad.disabled = true; var o = ic.addAs ? ic.addAs(l) : makeRec(l); o.data.kind = o.kind; o.data.by = (S.user.email || '').split('@')[0].slice(0, 30); o.data.createdAt = Q.FV.serverTimestamp(); o.data.updatedAt = Q.FV.serverTimestamp(); Q.recs().add(o.data).then(function () { ad.textContent = 'Added'; }, function (e) { ad.disabled = false; Q.toast(Q.friendly(e)); }); }; r.appendChild(ad); }
          body.appendChild(card);
        });
      }
      draw(); var iv = setInterval(function () { if (!document.body.contains(s)) { clearInterval(iv); return; } draw(); }, 3000);
    });
  }
  // Builds a record of the app's own kind from a request: name, phone, address(town) and notes, plus the first option of any required list.
  function makeRec(l) {
    var ic = cfg.inbound, kd = C.kinds[ic.addKind], data = {};
    kd.fields.forEach(function (f) { if (f.t === 'select' && f.req && f.o && f.o.length) data[f.k] = f.o[0]; });
    Object.keys(ic.addDefaults || {}).forEach(function (k) { data[k] = ic.addDefaults[k]; });
    if (kd.fields.some(function (f) { return f.k === 'name'; })) data.name = l.fromName; if (l.phone) data.phone = l.phone;
    var note = 'Vyqil community: ' + l.trade + ' - ' + l.title + (l.details ? '. ' + l.details : '') + ' (' + l.city + ')';
    var nk = kd.fields.filter(function (f) { return f.k === 'notes' || f.k === 'note'; })[0]; if (nk) data[nk.k] = note.slice(0, 900);
    if (kd.fields.some(function (f) { return f.k === 'address'; })) data.address = l.city;
    return { kind: ic.addKind, data: data };
  }
  function reply(l) {
    Q.modal(function (s, close) {
      s.appendChild(el('h3', '', 'Reply to ' + l.fromName));
      var price = el('input'); price.maxLength = 60; price.placeholder = 'Free estimate, $95 call-out'; field(s, 'Your price or how you charge (optional)', price);
      var msg = el('textarea'); msg.maxLength = 300; msg.rows = 3; msg.placeholder = 'I can come Thursday morning.'; field(s, 'Message', msg);
      var ph = el('input'); ph.type = 'tel'; ph.maxLength = 30; ph.value = (dir && dir.phone) || lsGet('vq_phone') || ''; field(s, 'Phone they should call', ph);
      var em = el('input'); em.type = 'email'; em.maxLength = 80; em.value = S.user.email || ''; field(s, 'Email (optional)', em);
      var note = el('div', 'note', 'They see your business name and what you type here. They decide who to choose.'); s.appendChild(note);
      var b = btnRow(s), go = mk('Send reply', '', null), no = mk('Cancel', 'ghost', close); b.appendChild(go); b.appendChild(no);
      go.onclick = function () {
        if (!ph.value.trim() && !em.value.trim()) { note.className = 'note err'; note.textContent = 'Add a phone number or an email so they can reach you.'; return; }
        go.disabled = true; note.className = 'note'; note.textContent = 'Sending...';
        if (ph.value.trim()) lsSet('vq_phone', ph.value.trim());
        db().collection('communityLeads').doc(l.id).collection('offers').doc(S.biz.id).set({ bizId: S.biz.id, ownerUid: S.user.uid, bizName: String(S.biz.name || '').slice(0, 80), priceNote: price.value.trim().slice(0, 60), message: msg.value.trim().slice(0, 300), phone: ph.value.trim().slice(0, 30), email: em.value.trim().slice(0, 80), createdAt: Q.FV.serverTimestamp() })
          .then(function () { inReplied[l.id] = true; V.notify('reply', l.id, S.biz.id); close(); Q.toast('Reply sent.'); }, function (e) { go.disabled = false; note.className = 'note err'; note.textContent = Q.friendly(e); });
      };
    });
  }

  // ---------- wiring into the app ----------
  Q.community = { find: find, requests: requests, inbox: inbox, listing: listing };
  Q.onStart.push(watchMine); Q.onStart.push(loadDirectory);
  Q.extras.push(function (v) {
    v.appendChild(el('h2', '', 'Community'));
    var card = el('div', 'card'); v.appendChild(card);
    card.appendChild(el('div', 'hint', cfg.intro || 'Need a cleaner, a contractor, a photographer or a realtor? Post it once and Vyqil businesses within the distance you choose see it as a lead.'));
    card.appendChild(block(mk('Find a Vyqil...', '', function () { find(null, null); })));
    if (cfg.inbound) {
      var w = waiting();
      card.appendChild(block(mk((cfg.inbound.inboxTitle || 'Requests near you') + (w ? ' (' + w + ' waiting)' : ''), '', inbox)));
      card.appendChild(block(mk(dir && dir.listed ? 'My community listing (listed)' : 'Set up my community listing', 'ghost', listing)));
    }
    var n = totalReplies(), open = myLeads.filter(function (l) { return l.status === 'open'; }).length;
    card.appendChild(block(mk('My requests and replies' + (n ? ' (' + n + (n === 1 ? ' reply)' : ' replies)') : open ? ' (' + open + ' open)' : ''), 'ghost', function () { requests(); })));
  });
})();
