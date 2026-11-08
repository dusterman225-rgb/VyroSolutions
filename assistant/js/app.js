// VyqilAssistant app shell: sign-in check, household set-up, tabs, menu, alerts.
(function () {
  var VA = window.VA, esc = VA.esc, S = VA.S, $ = VA.$;
  firebase.initializeApp(window.VYRO_FIREBASE_CONFIG);
  try { firebase.firestore().enablePersistence({ synchronizeTabs: true }).catch(function () { /* works without it */ }); } catch (e) { /* ignore */ }
  var TABS = ['today', 'calendar', 'money', 'house', 'ask'];

  VA.go = function (tab, sub) { S.tab = tab; if (sub) { S.sub[tab] = sub; } VA.render(); window.scrollTo(0, 0); };
  VA.render = function () {
    if (!S.hid) return;
    document.querySelectorAll('#tabs button').forEach(function (b) { b.className = b.getAttribute('data-t') === S.tab ? 'on' : ''; });
    $('hhName').textContent = (S.hh && S.hh.name) || 'Household';
    $('fab').style.display = S.tab === 'ask' ? 'none' : '';
    var root = $('view'), y = window.scrollY, ae = document.activeElement;
    if (ae && (ae.id === 'newItem' || ae.id === 'vq' || ae.id === 'askIn')) { var keep = ae.id, val = ae.value; VA.views[S.tab](root); var n = $(keep); if (n) { n.value = val; n.focus(); } return; }
    VA.views[S.tab](root); window.scrollTo(0, y);
  };
  VA.onChange(function () { if (!document.querySelector('.modal')) VA.render(); });
  $('tabs').onclick = function (e) { var b = e.target.closest('button[data-t]'); if (b) VA.go(b.getAttribute('data-t')); };
  $('fab').onclick = function () { VA.quickAdd(); };

  // ---- household set-up: use the saved one, join with an invite code, or start a new one ----
  function code() { var a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', o = ''; for (var i = 0; i < 8; i++) o += a.charAt(Math.floor(Math.random() * a.length)); return o; }
  function memberName(u) { var n = ''; try { n = sessionStorage.getItem('va_name') || ''; } catch (e) { /* ignore */ } return n || u.displayName || (u.email || 'Me').split('@')[0]; }
  function boot(u) {
    var db = VA.db(), uref = db.collection('users').doc(u.uid);
    return uref.get().then(function (d) {
      var hid = d.exists && d.data().lifeHid;
      if (hid) return hid;
      var join = ''; try { join = (sessionStorage.getItem('va_join') || new URLSearchParams(location.search).get('join') || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); } catch (e) { /* ignore */ }
      var nm = memberName(u);
      function fresh() {
        var ref = db.collection('households').doc();
        return ref.set({ name: nm + "'s household", members: [u.uid], memberNames: (function () { var o = {}; o[u.uid] = nm; return o; })(), createdAt: firebase.firestore.FieldValue.serverTimestamp() }).then(function () { return ref.id; });
      }
      var p = join ? db.collection('householdInvites').doc(join).get().then(function (iv) {
        if (!iv.exists) { VA.toast('That invite code was not found, so I made a new household for you.'); return fresh(); }
        var h = iv.data().hid, up = { members: firebase.firestore.FieldValue.arrayUnion(u.uid), joinCode: join }; up['memberNames.' + u.uid] = nm;
        return db.collection('households').doc(h).update(up).then(function () { return h; });
      }).catch(function () { VA.toast('Could not use that invite code, so I made a new household for you.'); return fresh(); }) : fresh();
      return p.then(function (h) { return uref.set({ lifeHid: h }, { merge: true }).then(function () { return h; }); });
    });
  }
  function start(u) {
    S.user = u;
    boot(u).then(function (hid) {
      S.hid = hid;
      try { sessionStorage.removeItem('va_join'); sessionStorage.removeItem('va_name'); } catch (e) { /* ignore */ }
      VA.db().collection('households').doc(hid).onSnapshot(function (s) { S.hh = s.exists ? s.data() : null; VA.changed(); }, function () { /* ignore */ });
      VA.listen(); VA.render(); setInterval(alerts, 60000); setTimeout(alerts, 4000);
    }).catch(function (e) {
      $('view').innerHTML = '<div class="card"><b>Could not open your household.</b><div class="hint" style="margin:6px 0">' + esc(e && e.code || e && e.message || 'error') + '. If this says permission-denied, publish the latest firestore.rules in Firebase.</div><button class="btn" onclick="location.reload()" type="button">Try again</button></div>';
    });
  }
  firebase.auth().onAuthStateChanged(function (u) { if (!u || u.isAnonymous) { location.replace('login.html'); return; } start(u); });

  // ---- alerts: only while the app is open (there is no server to send them otherwise) ----
  function note(title, body, key) {
    try { if (localStorage.getItem(key)) return; localStorage.setItem(key, '1'); } catch (e) { /* ignore */ }
    try { new Notification(title, { body: body, icon: '/icons/icon-192.png' }); } catch (e) { VA.toast(title + ' - ' + body); }
  }
  function alerts() {
    if (!window.Notification || Notification.permission !== 'granted' || !S.hid) return;
    var t = VA.today(), now = new Date(), mins = now.getHours() * 60 + now.getMinutes();
    VA.occ(t, t).forEach(function (o) {
      if (o.kind === 'event' && +o.ref.remind > 0 && o.time) { var m = /^(\d+):(\d+)/.exec(o.time), st = +m[1] * 60 + +m[2]; if (mins >= st - +o.ref.remind && mins < st) note(o.title, 'Starts at ' + VA.fmtTime(o.time) + (o.who ? ' (' + o.who + ')' : ''), 'va_n_' + o.ref.id + t); }
      if (o.kind === 'bill' && o.first && now.getHours() >= 8) note('Bill due today', o.title, 'va_n_' + o.ref.id + t);
    });
    var tm = VA.addDays(t, 1); VA.occ(tm, tm).forEach(function (o) { if (o.kind === 'event' && +o.ref.remind >= 1440 && now.getHours() >= 17) note('Tomorrow: ' + o.title, o.time ? VA.fmtTime(o.time) : 'All day', 'va_n_' + o.ref.id + tm); if (o.kind === 'bill' && o.first && now.getHours() >= 17) note('Bill due tomorrow', o.title, 'va_n_' + o.ref.id + tm); });
  }
  $('bellBtn').onclick = function () {
    if (VA.push && VA.push.supported()) { VA.push.panel(); return; }
    if (!window.Notification) { VA.toast('This browser cannot show alerts. Use the calendar file under Calendar instead.'); return; }
    if (Notification.permission === 'granted') { VA.toast('Alerts are on while VyqilAssistant is open. For alerts when it is closed, add the calendar file (Calendar tab) to your phone.'); return; }
    Notification.requestPermission().then(function (p) { VA.toast(p === 'granted' ? 'Alerts turned on while the app is open.' : 'Alerts are off. You can allow them in your browser settings.'); alerts(); });
  };

  // ---- menu ----
  $('menuBtn').onclick = function () {
    var hh = S.hh || {}, names = hh.memberNames || {};
    VA.modal('<h3>Household</h3><label class="f">Household name</label><input id="mName" value="' + esc(hh.name || '') + '" maxlength="60">' +
      '<label class="f">Members</label><div class="card" style="margin:0">' + Object.keys(names).map(function (k) { return '<div class="row"><span class="av">' + esc((names[k] || '?').charAt(0).toUpperCase()) + '</span><div class="m"><b>' + esc(names[k]) + (k === S.user.uid ? ' (you)' : '') + '</b></div></div>'; }).join('') + '</div>' +
      '<div class="btns"><button class="btn" id="mSave" type="button">Save name</button><button class="btn ghost" id="mInv" type="button">Invite my partner or family</button></div><p class="hint" id="mInfo"></p>' +
      '<div class="btns"><button class="btn ghost" id="mIcs" type="button">Calendar file</button><button class="btn ghost" id="mCsv" type="button">Money file</button></div>' +
      '<div class="btns"><button class="btn ghost" id="mPush" type="button">Phone alerts</button></div>' +
      '<div class="btns"><button class="btn ghost" id="mOut" type="button">Sign out</button><button class="btn ghost" id="mX" type="button">Close</button></div>' +
      '<p class="hint">' + esc(S.user.email || '') + '</p>', function (s, close) {
      s.querySelector('#mX').onclick = close;
      s.querySelector('#mSave').onclick = function () { var v = s.querySelector('#mName').value.trim(); if (v) VA.db().collection('households').doc(S.hid).set({ name: v }, { merge: true }).then(function () { VA.toast('Saved'); }); };
      s.querySelector('#mPush').onclick = function () { close(); VA.push.panel(); };
      s.querySelector('#mIcs').onclick = function () { VA.act.ics(); }; s.querySelector('#mCsv').onclick = function () { VA.act.csv(); };
      s.querySelector('#mOut').onclick = function () { (VA.push && VA.push.on() ? VA.push.disable().catch(function () { /* ignore */ }) : Promise.resolve()).then(function () { return firebase.auth().signOut(); }).then(function () { location.replace('login.html'); }); };
      s.querySelector('#mInv').onclick = function () {
        var c = code(), link = location.origin + location.pathname.replace(/index\.html$/, '') + 'login.html?join=' + c;
        VA.db().collection('householdInvites').doc(c).set({ hid: S.hid, by: S.user.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() }).then(function () {
          s.querySelector('#mInfo').innerHTML = 'Invite code: <b style="font-size:1.2rem;letter-spacing:.1em">' + c + '</b><br>They tap Create account on the sign-in page and type this code, or open this link:<br><a href="' + esc(link) + '">' + esc(link) + '</a><br><button class="btn sm" id="mShare" type="button" style="margin-top:8px">Share invite</button>';
          s.querySelector('#mShare').onclick = function () { var t = 'Join our household on VyqilAssistant. Use code ' + c + ' or open ' + link; if (navigator.share) navigator.share({ text: t }).catch(function () { /* cancelled */ }); else if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { VA.toast('Copied'); }); };
        }).catch(function (e) { s.querySelector('#mInfo').textContent = 'Could not make an invite (' + (e && e.code || 'error') + '). Publish the latest firestore.rules.'; });
      };
    });
  };
  if ('serviceWorker' in navigator) { try { navigator.serviceWorker.register('sw.js'); } catch (e) { /* optional */ } }
})();
