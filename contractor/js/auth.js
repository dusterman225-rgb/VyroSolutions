(function () {
  firebase.initializeApp(window.VYRO_FIREBASE_CONFIG);
  var auth = firebase.auth();
  var db = firebase.firestore();
  var stamp = firebase.firestore.FieldValue.serverTimestamp;
  var busy = false;

  function friendly(err) {
    var map = {
      'auth/email-already-in-use': 'That email already has an account. Sign in with it, then use the invitation on the home screen.',
      'auth/invalid-email': 'That email address does not look right.',
      'auth/weak-password': 'Choose a stronger password (at least 8 characters).',
      'auth/invalid-credential': 'Email or password is incorrect.',
      'auth/wrong-password': 'Email or password is incorrect.',
      'auth/user-not-found': 'Email or password is incorrect.',
      'auth/too-many-requests': 'Too many tries. Wait a few minutes and try again.',
      'auth/network-request-failed': 'No connection. Check your internet and try again.',
      'permission-denied': 'Permission denied. Check the Firestore rules were published, or you may not have access.',
      'vyro/email-in-use': 'That email already has a Vyro login with a different password. Type that login\'s password here to add this business to it, or go to the sign in page and tap "Forgot your password?".',
      'vyro/no-business': 'No business found for this account. You may have been removed from the team.'
    };
    return map[err && err.code] || 'Something went wrong. Please try again.';
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  // Creates a login and a business. If the email already has a Vyro login (for example a customer or an employee who now
  // owns a business), the same password signs in and the new business is added to that one login.
  async function signUp(email, password, businessName, product) {
    busy = true;
    try {
      var cred, existing = false;
      try { cred = await auth.createUserWithEmailAndPassword(email, password); }
      catch (e0) {
        if (e0 && e0.code === 'auth/email-already-in-use') {
          try { cred = await auth.signInWithEmailAndPassword(email, password); existing = true; }
          catch (e1) { throw { code: 'vyro/email-in-use' }; }
        } else { throw e0; }
      }
      try {
        var uid = cred.user.uid;
        var bizRef = db.collection('businesses').doc();
        var batch = db.batch();
        batch.set(bizRef, { name: businessName, ownerUid: uid, product: product || 'contractor', createdAt: stamp() });
        batch.set(bizRef.collection('members').doc(uid), { role: 'owner', email: email.toLowerCase(), createdAt: stamp() });
        var ud = { email: email.toLowerCase(), bizId: bizRef.id, bizIds: firebase.firestore.FieldValue.arrayUnion(bizRef.id) };
        if (!existing) ud.createdAt = stamp();
        batch.set(db.collection('users').doc(uid), ud, { merge: true });
        await batch.commit();
      } catch (e) {
        if (!existing) { try { await cred.user.delete(); } catch (_) {} }
        throw e;
      }
      if (!existing) { try { await cred.user.sendEmailVerification(); } catch (_) { /* optional */ } }
      return cred.user;
    } finally { busy = false; }
  }

  function randomPassword() {
    var a = new Uint8Array(24); crypto.getRandomValues(a);
    return Array.from(a, function (x) { return x.toString(36).padStart(2, '0'); }).join('') + 'Aa1!';
  }

  // Firebase emails a link that lets the person choose their own password.
  async function sendLoginEmail(email) {
    try {
      await auth.sendPasswordResetEmail(email, { url: location.origin + location.pathname.replace(/[^\/]*$/, '') + 'login.html' });
    } catch (e) {
      await auth.sendPasswordResetEmail(email);
    }
  }

  // Owner or supervisor adds a team member. A brand new email gets a login with a random password nobody sees.
  // An email that already has a Vyro account gets an INVITATION instead; they accept it after signing in.
  async function addMember(bizId, email, name, role, extra) {
    email = String(email || '').trim().toLowerCase();
    var app2 = firebase.initializeApp(window.VYRO_FIREBASE_CONFIG, 'second-' + Date.now());
    var a2 = app2.auth();
    var d2 = app2.firestore();
    var uid = null;
    try {
      await a2.setPersistence(firebase.auth.Auth.Persistence.NONE);
      var cred;
      try {
        cred = await a2.createUserWithEmailAndPassword(email, randomPassword());
      } catch (e) {
        if (e && e.code === 'auth/email-already-in-use') { return await invitePerson(bizId, email, name, role, extra); }
        throw e;
      }
      uid = cred.user.uid;
      try {
        await d2.collection('users').doc(uid).set({ email: email, bizId: bizId, bizIds: [bizId], createdAt: stamp() });
        var mdoc = { role: role, email: email, name: name, addedBy: auth.currentUser.uid, createdAt: stamp() };
        if (extra) { Object.keys(extra).forEach(function (k) { mdoc[k] = extra[k]; }); }
        await db.collection('businesses').doc(bizId).collection('members').doc(uid).set(mdoc);
      } catch (e) {
        try { await d2.collection('users').doc(uid).delete(); } catch (_) {}
        try { await cred.user.delete(); } catch (_) {}
        throw e;
      }
      var emailSent = true;
      try { await sendLoginEmail(email); } catch (e) { emailSent = false; }
      return { uid: uid, emailSent: emailSent };
    } finally {
      try { await a2.signOut(); } catch (_) {}
      try { await app2.delete(); } catch (_) {}
    }
  }

  // ---- people who work for more than one business ----
  async function invitePerson(bizId, email, name, role, extra) {
    var b = await db.collection('businesses').doc(bizId).get();
    var inv = { email: email, bizId: bizId, bizName: (b.data() && b.data().name) || '', product: (b.data() && b.data().product) || '',
      role: role, name: name || '', addedBy: auth.currentUser.uid, createdAt: stamp() };
    if (extra && extra.title) inv.title = extra.title;
    if (extra && extra.perms) inv.perms = extra.perms;
    await db.collection('invites').doc(email + '__' + bizId).set(inv);
    return { invited: true, emailSent: false };
  }
  async function myInvites() {
    var u = auth.currentUser; if (!u || !u.email) return [];
    var s = await db.collection('invites').where('email', '==', u.email.toLowerCase()).get();
    var out = []; s.forEach(function (d) { var x = d.data(); x.id = d.id; out.push(x); }); return out;
  }
  async function acceptInvite(inv) {
    var u = auth.currentUser;
    var mdoc = { role: inv.role, email: u.email.toLowerCase(), name: inv.name || '', addedBy: inv.addedBy, inviteId: inv.id, createdAt: stamp() };
    if (inv.title) mdoc.title = inv.title; if (inv.perms) mdoc.perms = inv.perms;
    await db.collection('businesses').doc(inv.bizId).collection('members').doc(u.uid).set(mdoc);
    await db.collection('users').doc(u.uid).set({ bizId: inv.bizId, bizIds: firebase.firestore.FieldValue.arrayUnion(inv.bizId) }, { merge: true });
    try { await db.collection('invites').doc(inv.id).delete(); } catch (_) {}
  }
  async function declineInvite(inv) { await db.collection('invites').doc(inv.id).delete(); }
  // Businesses this login belongs to (current one first).
  async function myWorkplaces(ctx) {
    var ud = await db.collection('users').doc(auth.currentUser.uid).get();
    var ids = (ud.data() && ud.data().bizIds) || []; var cur = ctx && ctx.bizId;
    if (cur && ids.indexOf(cur) < 0) ids = ids.concat([cur]);
    var out = [];
    await Promise.all(ids.map(async function (id) {
      try {
        var r = await Promise.all([db.collection('businesses').doc(id).get(), db.collection('businesses').doc(id).collection('members').doc(auth.currentUser.uid).get()]);
        if (r[0].exists && r[1].exists) out.push({ id: id, name: r[0].data().name || 'Business', product: r[0].data().product || '', role: r[1].data().role });
      } catch (_) {}
    }));
    return out;
  }
  async function switchWorkplace(id, fromId) {
    var add = [id]; if (fromId) add.push(fromId);
    await db.collection('users').doc(auth.currentUser.uid).set({ bizId: id, bizIds: firebase.firestore.FieldValue.arrayUnion.apply(null, add) }, { merge: true });
  }
  // Draws "your workplaces" and "invitations" into a container element.
  async function mountSwitcher(ctx, box, opts) {
    try {
      var list = await myWorkplaces(ctx), inv = await myInvites();
      box.textContent = '';
      inv.forEach(function (i) {
        var c = el('div', 'card'); c.appendChild(el('div', 'note', (i.bizName || 'A business') + ' invited you to join as ' + i.role + '.'));
        var a = el('button', 'btn', 'Accept and switch'); a.type = 'button';
        a.addEventListener('click', async function () { a.disabled = true; try { await acceptInvite(i); location.reload(); } catch (e) { c.appendChild(el('div', 'note err', friendly(e))); a.disabled = false; } });
        var d = el('button', 'btn ghost', 'Decline'); d.type = 'button';
        d.addEventListener('click', async function () { try { await declineInvite(i); c.remove(); } catch (e) {} });
        c.appendChild(a); c.appendChild(d); box.appendChild(c);
      });
      var owned = list.filter(function (w) { return w.role === 'owner'; });
      var chain = !!(opts && opts.chainUrl) && owned.length > 1 && ctx.role === 'owner';
      if (list.length > 1) {
        list.sort(function (x, y) { return x.name.localeCompare(y.name); });
        var c2 = el('div', 'card'); c2.appendChild(el('div', 'note', chain ? 'Your locations. Pick one to work in, or see them all together.' : 'You work at more than one business. Switch workplace:'));
        var sel = document.createElement('select'); sel.style.width = '100%';
        list.forEach(function (w) { var o = document.createElement('option'); o.value = w.id; o.textContent = w.name + (w.id === ctx.bizId ? ' (current)' : ''); if (w.id === ctx.bizId) o.selected = true; sel.appendChild(o); });
        if (chain) { var oa = document.createElement('option'); oa.value = '__all'; oa.textContent = 'All locations (summary)'; sel.appendChild(oa); }
        sel.addEventListener('change', async function () {
          if (sel.value === '__all') { location.href = opts.chainUrl; return; }
          if (sel.value === ctx.bizId) return;
          sel.disabled = true; try { await switchWorkplace(sel.value, ctx.bizId); location.reload(); } catch (e) { sel.disabled = false; }
        });
        c2.appendChild(sel); box.appendChild(c2);
      }
    } catch (e) { /* the switcher is optional */ }
  }


  // Separate sign-ins: contractor team, restaurant team, and customers each use their own door.
  async function signInAs(kind, email, pw) {
    busy = true;
    try {
      var cred = await auth.signInWithEmailAndPassword(email, pw);
      var ud = await db.collection('users').doc(cred.user.uid).get();
      var data = ud.exists ? ud.data() : {}, bizId = data.bizId, want = kind === 'restaurant' ? 'restaurant' : 'contractor';
      async function hasApp(id, w) {
        try { var b = await db.collection('businesses').doc(id).get(); if (!b.exists) return false; var d = b.data(); return (d.product || 'contractor') === w || !!(d.apps && d.apps[w]); } catch (e) { return false; }
      }
      var wrong = null;
      if (!bizId) {
        wrong = 'This is a customer account, not a business or team login. Use the customer sign in.';
      } else {
        if (!(await hasApp(bizId, want))) {
          // Someone who works for both kinds of business: switch them to the right one.
          var ids = (data.bizIds || []).filter(function (x) { return x !== bizId; }), found = null;
          for (var i = 0; i < ids.length && !found; i++) { if (await hasApp(ids[i], want)) found = ids[i]; }
          if (found) { await db.collection('users').doc(cred.user.uid).set({ bizId: found, bizIds: firebase.firestore.FieldValue.arrayUnion(bizId, found) }, { merge: true }); }
          else { wrong = 'This login has no ' + (want === 'restaurant' ? 'restaurant' : 'contractor') + ' business on it. Use the sign in for your business type, or ask the owner to turn this app on.'; }
        }
      }
      if (wrong) { await auth.signOut(); busy = false; throw { msg: wrong }; }
      busy = false;
      return cred.user;
    } catch (e) { busy = false; throw e; }
  }

  function signIn(email, password) { return auth.signInWithEmailAndPassword(email, password); }
  function resetPassword(email) { return auth.sendPasswordResetEmail(email); }
  function signOut() { try { sessionStorage.removeItem('vyroHelp'); } catch (e) { /* ignore */ } return auth.signOut(); }

  function requireAuth(cb) {
    auth.onAuthStateChanged(function (u) {
      if (!u) { location.replace('login.html'); } else { cb(u); }
    });
  }
  function redirectIfSignedIn() {
    auth.onAuthStateChanged(async function (u) {
      if (!u || busy) return;
      // Contractors and team members go to the app; customers (no business) go to their portal.
      var dest = 'app.html';
      try { var d = await db.collection('users').doc(u.uid).get(); if (!d.exists || !d.data().bizId) dest = 'portal.html'; } catch (e) { /* default */ }
      location.replace(dest);
    });
  }

  var APP = 'contractor';
  async function loadContext(user) {
    var u = await db.collection('users').doc(user.uid).get();
    if (!u.exists || !u.data().bizId) { throw { code: 'vyro/no-business' }; }
    var bizRef = db.collection('businesses').doc(u.data().bizId);
    var res = await Promise.all([bizRef.get(), bizRef.collection('members').doc(user.uid).get()]);
    if (res[0].exists && res[1].exists) {
    var bizData0 = res[0].exists ? res[0].data() : null;
    if (bizData0 && !((bizData0.product || 'contractor') === APP || (bizData0.apps && bizData0.apps[APP]))) {
      // Signed in to another app with this same login? The shared "current business" may point at that app's business. Switch to this app's one.
      var others = (u.data().bizIds || []).filter(function (x) { return x !== bizRef.id; });
      for (var oi = 0; oi < others.length; oi++) {
        try {
          var rr = db.collection('businesses').doc(others[oi]), pair = await Promise.all([rr.get(), rr.collection('members').doc(user.uid).get()]);
          if (pair[0].exists && pair[1].exists && ((pair[0].data().product || 'contractor') === APP || (pair[0].data().apps && pair[0].data().apps[APP]))) {
            await db.collection('users').doc(user.uid).set({ bizId: rr.id }, { merge: true }); bizRef = rr; res = pair; break;
          }
        } catch (e) { /* try the next one */ }
      }
    }
    }
    if (!res[0].exists || !res[1].exists) { throw { code: 'vyro/no-business' }; }
    if (res[0].data().status === 'closed') { throw { code: 'vyro/closed', message: 'This business is closed. The owner can reopen it in Vyro Network.' }; }
    return { user: user, bizId: bizRef.id, bizRef: bizRef, biz: res[0].data(), me: res[1].data(), role: res[1].data().role };
  }

  // Sign-in required, then loads the business. Errors show in the element with id="err".
  function start(cb) {
    requireAuth(async function (user) {
      try {
        var ctx = await loadContext(user);
        if (window.VYRO_STAFF_ONLY && ctx.role !== 'owner' && ctx.role !== 'gm' && ctx.role !== 'supervisor') {
          Array.prototype.forEach.call(document.querySelectorAll('.wrap > *'), function (n) {
            if (!n.classList.contains('brand') && !n.classList.contains('back') && n.id !== 'err') n.style.display = 'none';
          });
          var ee = document.getElementById('err');
          if (ee) ee.textContent = 'Only the owner or a supervisor can use this page.';
          return;
        }
        await cb(ctx);
      } catch (err) {
        if (err && err.code === 'vyro/no-business' && !/portal/.test(location.pathname)) { location.replace('portal.html'); return; }
        var e = document.getElementById('err');
        if (e) { e.textContent = friendly(err); }
      }
    });
  }

  // Change log (best effort). Owners can read it in the rules; nobody can edit or delete entries.
  function audit(ctx, action, detail) {
    try {
      return ctx.bizRef.collection('audit').add({
        action: String(action).slice(0, 60), detail: String(detail || '').slice(0, 300),
        by: ctx.user.uid, byEmail: ctx.user.email || '', role: ctx.role, at: stamp()
      }).catch(function () { /* never block the real action */ });
    } catch (e) { return Promise.resolve(); }
  }

  function nameOf(m) { if (!m) return ''; if (m.name) return m.name; var e = String(m.email || ''); var l = e.split('@')[0].replace(/[._-]+/g, ' ').trim(); return l ? l.replace(/\b\w/g, function (c) { return c.toUpperCase(); }) : 'Team member'; }
  function who(ctx) { return nameOf(ctx.me || { email: ctx.user.email }); }
  window.vyro = { nameOf: nameOf, who: who, audit: audit, auth: auth, db: db, stamp: stamp, friendly: friendly, el: el,
    signUp: signUp, addMember: addMember, mountSwitcher: mountSwitcher, myInvites: myInvites, acceptInvite: acceptInvite, sendLoginEmail: sendLoginEmail,
    signIn: signIn, signInAs: signInAs, resetPassword: resetPassword, signOut: signOut,
    requireAuth: requireAuth, redirectIfSignedIn: redirectIfSignedIn,
    loadContext: loadContext, start: start };

  // Help chat on every page. It remembers the conversation while the person moves between pages.
  try {
    if (!window.__vyroHelpbot && !/assistant(\.html)?\/?$/.test(location.pathname)) {
      var addScript = function (src, done) {
        var s = document.createElement('script'); s.src = src; if (done) s.onload = done; document.head.appendChild(s);
      };
      addScript('/shared/helpbot-config.js', function () { addScript('js/helpbot.js'); });
    }
  } catch (e) { /* the help chat is optional */ }
})();
