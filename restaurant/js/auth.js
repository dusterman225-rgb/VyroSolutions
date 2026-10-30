(function () {
  // If the Firebase settings file is missing or is the wrong file, say so on the page instead of showing a blank screen.
  if (!window.VYRO_FIREBASE_CONFIG || typeof firebase === 'undefined') {
    var setupMsg = 'Setup problem: js/firebase-config.js is missing or is the wrong file. Copy it from your contractor repo. It must start with window.VYRO_FIREBASE_CONFIG = .';
    var showSetup = function () {
      var e = document.getElementById('err') || document.getElementById('msg');
      if (e) { e.textContent = setupMsg; e.className = 'note err'; }
    };
    var fail = function () { showSetup(); return Promise.reject({ code: 'vyro/setup' }); };
    window.vyro = { loginUrl: loginUrl, start: showSetup, redirectIfSignedIn: function () {}, signIn: fail, signUp: fail, resetPassword: fail, signOut: function () { return Promise.resolve(); },
      friendly: function () { return setupMsg; }, el: function (t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x !== undefined) n.textContent = x; return n; }, audit: function () {} };
    showSetup();
    return;
  }
  firebase.initializeApp(window.VYRO_FIREBASE_CONFIG);
  var auth = firebase.auth();
  var db = firebase.firestore();
  var stamp = firebase.firestore.FieldValue.serverTimestamp;
  var busy = false;

  function friendly(err) {
    if (err && err.msg) { return err.msg; }
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
      if (product && product !== 'contractor') { await makeBrand(bizRef.id, businessName, product); }
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
    try { var dup = await db.collection('businesses').doc(bizId).collection('members').where('email', '==', email).limit(1).get(); if (!dup.empty) { throw { msg: 'That email is already on your team.' }; } }
    catch (e0) { if (e0 && e0.msg) { throw e0; } }
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
        try { await db.collection('businesses').doc(bizId).collection('members').doc(uid).set(mdoc); }
        catch (em) { if (em && em.code === 'permission-denied') { throw { msg: 'Could not add them to your team: permission denied on team members. Publish the newest firestore.rules in Firebase (Firestore > Rules > Publish), then try again.' }; } throw em; }
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
    if (extra && extra.empType) { inv.empType = extra.empType; inv.weeklyHours = extra.weeklyHours; }
    try { await db.collection('invites').doc(email + '__' + bizId).set(inv); }
    catch (e) { if (e && e.code === 'permission-denied') { throw { msg: 'Could not send the invitation: permission denied on invitations. Publish the newest firestore.rules in Firebase (Firestore > Rules > Publish), then try again.' }; } throw e; }
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
    if (inv.empType) { mdoc.empType = inv.empType; mdoc.weeklyHours = inv.weeklyHours; }
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
        if (r[0].exists && r[1].exists) out.push({ id: id, name: r[0].data().name || 'Business', product: r[0].data().product || '', apps: r[0].data().apps || {}, role: r[1].data().role });
      } catch (_) {}
    }));
    return out;
  }
  function homeFor(w) {
    var p = w.product || Object.keys(w.apps || {}).filter(function (k) { return w.apps[k]; })[0] || '';
    return p === 'restaurant' ? '/restaurant/index.html' : p === 'takeout' ? '/takeout/index.html' : p === 'retail' ? '/retail/index.html' : p === 'contractor' ? '/contractor/app.html' : '/dashboard.html';
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
        list.forEach(function (w) { var o = document.createElement('option'); o.value = w.id; o.textContent = w.name + ({ restaurant: ' \u00b7 Restaurant', takeout: ' \u00b7 Takeout', retail: ' \u00b7 Retail', contractor: ' \u00b7 Contractor' }[w.product] || '') + (w.id === ctx.bizId ? ' (current)' : ''); if (w.id === ctx.bizId) o.selected = true; sel.appendChild(o); });
        if (chain) { var oa = document.createElement('option'); oa.value = '__all'; oa.textContent = 'All locations (summary)'; sel.appendChild(oa); }
        sel.addEventListener('change', async function () {
          if (sel.value === '__all') { location.href = opts.chainUrl; return; }
          if (sel.value === ctx.bizId) return;
          sel.disabled = true; try {
            await switchWorkplace(sel.value, ctx.bizId);
            var pick = list.filter(function (w) { return w.id === sel.value; })[0], here = pick && (pick.product === APP || (pick.apps && pick.apps[APP]) || (!pick.product && APP === 'contractor'));
            if (here || !pick) { location.reload(); } else { location.href = homeFor(pick); }   // a different kind of business opens in its own app
          } catch (e) { sel.disabled = false; }
        });
        c2.appendChild(sel); box.appendChild(c2);
      }
    } catch (e) { /* the switcher is optional */ }
  }


  var APP = 'restaurant'; // the takeout build changes this one word

  // ---- staff sign-in link: /login?r=<name>. The name comes from the business name and the owner can change it. ----
  var RESERVED = ['login', 'logout', 'signup', 'admin', 'api', 'app', 'www', 'help', 'support', 'restaurant', 'takeout', 'contractor', 'network', 'vyro', 'vyrosystems', 'index', 'portal', 'settings', 'home', 'static', 'css', 'js', 'images', 'shared', 'docs', 'workers', 'retail', 'crm', 'account', 'dashboard', 'business', 'legal', 'go', 'index'];
  function slugify(n) { var s = String(n || '').toLowerCase().replace(/['\u2019]/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '').slice(0, 26); if (s.length < 3) s = (s + 'biz').slice(0, 3) + Math.floor(100 + Math.random() * 900); return s; }
  async function brandFree(slug, bizId) {
    if (RESERVED.indexOf(slug) >= 0) return false;
    var d = await db.collection('publicBrands').doc(slug).get();
    return !d.exists || d.data().bizId === bizId;
  }
  async function makeBrand(bizId, name, product, colors) {
    try {
      var base = slugify(name), slug = base;
      for (var i = 2; i < 40 && !(await brandFree(slug, bizId)); i++) { slug = base.slice(0, 26) + i; }
      var doc = { name: name, bizId: bizId, product: product || APP, tagline: '', createdAt: stamp(), updatedAt: stamp() };
      if (colors && colors.accent) { doc.accent = colors.accent; doc.bg = colors.bg; doc.text = colors.text; }
      await db.collection('publicBrands').doc(slug).set(doc);
      await db.collection('businesses').doc(bizId).update({ slug: slug });
      return slug;
    } catch (e) { return ''; }   // best effort: the owner can set it up later in Settings
  }

  // Separate sign-ins: contractor team, restaurant team, and customers each use their own door.
  async function signInAs(kind, email, pw) {
    busy = true;
    try {
      var cred = await auth.signInWithEmailAndPassword(email, pw);
      var ud = await db.collection('users').doc(cred.user.uid).get();
      var data = ud.exists ? ud.data() : {}, bizId = data.bizId, want = kind === 'restaurant' ? 'restaurant' : kind === 'takeout' ? 'takeout' : 'contractor';
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
          else { wrong = 'This login has no ' + (want === 'contractor' ? 'contractor' : want === 'takeout' ? 'takeout' : 'restaurant') + ' business on it. Use the sign in for your business type, or ask the owner to turn this app on.'; }
        }
      }
      if (wrong) { await auth.signOut(); busy = false; throw { msg: wrong }; }
      busy = false;
      return cred.user;
    } catch (e) { busy = false; throw e; }
  }

  // A chain owner adds another location. The same login owns every location.
  async function createLocation(name, service, ownerName) {
    var u = auth.currentUser, bizRef = db.collection('businesses').doc(), batch = db.batch();
    batch.set(bizRef, { name: name, ownerUid: u.uid, product: APP, service: APP === 'takeout' ? 'quick' : (service || 'restaurant'), createdAt: stamp() });
    var m = { role: 'owner', email: (u.email || '').toLowerCase(), createdAt: stamp() }; if (ownerName) m.name = ownerName;
    batch.set(bizRef.collection('members').doc(u.uid), m);
    await batch.commit();
    await db.collection('users').doc(u.uid).set({ bizIds: firebase.firestore.FieldValue.arrayUnion(bizRef.id) }, { merge: true });
    await makeBrand(bizRef.id, name, APP);
    return bizRef;
  }

  // Make this business the current one, but only if the signed-in person is really on its team. Returns their role, or ''.
  async function enterBusiness(bizId) {
    var u = auth.currentUser; if (!u || !bizId) return '';
    try {
      var m = await db.collection('businesses').doc(bizId).collection('members').doc(u.uid).get();
      if (!m.exists) return '';
      await db.collection('users').doc(u.uid).set({ bizId: bizId, bizIds: firebase.firestore.FieldValue.arrayUnion(bizId) }, { merge: true });
      return m.data().role || 'employee';
    } catch (e) { return ''; }
  }
  // The signed-in person's role in their current business.
  async function currentRole() {
    var u = auth.currentUser; if (!u) return '';
    try { var d = await db.collection('users').doc(u.uid).get(), id = d.data() && d.data().bizId; if (!id) return ''; var m = await db.collection('businesses').doc(id).collection('members').doc(u.uid).get(); return m.exists ? (m.data().role || '') : ''; } catch (e) { return ''; }
  }

  function signIn(email, password) { return auth.signInWithEmailAndPassword(email, password); }
  function resetPassword(email) { return auth.sendPasswordResetEmail(email); }
  // Owners go back to the owner sign-in. Employees go back to their business's own sign-in link.
  function loginUrl() { try { return localStorage.getItem('vyro_login_url') || 'login.html'; } catch (e) { return 'login.html'; } }
  function signOut() { try { sessionStorage.removeItem('vyroHelp'); } catch (e) { /* ignore */ } return auth.signOut(); }

  function requireAuth(cb) {
    auth.onAuthStateChanged(function (u) {
      if (!u) { location.replace(loginUrl()); } else { cb(u); }
    });
  }
  function redirectIfSignedIn() {
    auth.onAuthStateChanged(async function (u) {
      if (!u || busy) return;
      // Everyone who signs in goes to the restaurant home.
      var dest = 'index.html';
      location.replace(dest);
    });
  }

  async function loadContext(user) {
    var u = await db.collection('users').doc(user.uid).get();
    if (!u.exists || !u.data().bizId) { throw { code: 'vyro/no-business' }; }
    var bizRef = db.collection('businesses').doc(u.data().bizId);
    var res = await Promise.all([bizRef.get(), bizRef.collection('members').doc(user.uid).get()]);
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
    if (!res[0].exists || !res[1].exists) { throw { code: 'vyro/no-business' }; }
    if (res[0].data().status === 'closed') { throw { code: 'vyro/closed', message: 'This business is closed. The owner can reopen it in Vyro Network.' }; }
    var bizData = res[0].data(); if (APP === 'takeout') { bizData.service = 'quick'; }
    try { var rl = res[1].data().role, sg = (bizData).slug; if ((rl === 'owner' || rl === 'gm') || !sg) localStorage.removeItem('vyro_login_url'); else localStorage.setItem('vyro_login_url', '/' + sg + '/login'); } catch (e) { /* ignore */ }
    return { user: user, bizId: bizRef.id, bizRef: bizRef, biz: bizData, me: res[1].data(), role: res[1].data().role };
  }

  // Sign-in required, then loads the business. Errors show in the element with id="err".

  // ---- "must be at work" check (set by the owner under Work location) ----
  function metersBetween(a, b, c, d) {
    var R = 6371000, r = Math.PI / 180, dLa = (c - a) * r, dLo = (d - b) * r;
    var x = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }
  function whereAmI() {
    return new Promise(function (ok, no) {
      if (!navigator.geolocation) { no({ msg: 'This phone or browser cannot share its location.' }); return; }
      navigator.geolocation.getCurrentPosition(ok, function (e) {
        no({ msg: e && e.code === 1 ? 'Location is turned off for this site. Allow location in your browser settings, then try again.' : 'Could not find your location. Go outside or near a window and try again.' });
      }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 });
    });
  }
  function needsWorkCheck(ctx) {
    if (window.VYRO_NO_WORKCHECK) return false;   // schedule and notifications work from anywhere
    var g = ctx.biz && ctx.biz.geo;
    return !!(g && g.required && typeof g.lat === 'number' && typeof g.lng === 'number' && ctx.role !== 'owner' && ctx.role !== 'gm' && ctx.role !== 'supervisor' && ctx.role !== 'kiosk');
  }
  async function checkAtWork(ctx) {
    var g = ctx.biz.geo, key = 'vyroAtWork:' + ctx.bizId + ':' + ctx.user.uid;
    try { var t = parseInt(localStorage.getItem(key) || '0', 10); if (t && Date.now() - t < 10 * 60000) return true; } catch (e) {}
    var p = await whereAmI();
    var d = metersBetween(g.lat, g.lng, p.coords.latitude, p.coords.longitude);
    var slack = Math.min(p.coords.accuracy || 0, 100);
    if (d <= (g.radiusM || 150) + slack) { try { localStorage.setItem(key, String(Date.now())); } catch (e) {} return true; }
    try { localStorage.removeItem(key); } catch (e) {}
    throw { msg: 'You are about ' + (d >= 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m') + ' from work. You can use Vyro Restaurant only when you are at work.' };
  }
  function workGate(ctx) {
    return new Promise(function (done) {
      var ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#05070A;color:#fff;display:none;align-items:center;justify-content:center;padding:24px;text-align:center';
      var box = document.createElement('div'); box.style.maxWidth = '340px';
      var h = document.createElement('h2'); h.textContent = 'Checking that you are at work';
      var m = document.createElement('div'); m.className = 'note'; m.style.margin = '12px 0';
      var b = document.createElement('button'); b.className = 'btn'; b.type = 'button'; b.textContent = 'Check my location again';
      var o = document.createElement('button'); o.className = 'btn ghost'; o.type = 'button'; o.textContent = 'Sign out';
      var lk = document.createElement('div'); lk.style.cssText = 'margin:14px 0;display:flex;gap:10px;justify-content:center'; [['schedule.html', 'View schedule'], ['notifications.html', 'Notifications']].forEach(function (p) { var a = document.createElement('a'); a.href = p[0]; a.textContent = p[1]; a.style.cssText = 'color:#6FB6EA;font-weight:700'; lk.appendChild(a); });
      box.appendChild(h); box.appendChild(m); box.appendChild(b); box.appendChild(lk); box.appendChild(o); ov.appendChild(box); document.body.appendChild(ov);
      var finished = false;
      async function run(first) {
        b.disabled = true; m.className = 'note'; m.textContent = 'Checking...';
        if (first) { ov.style.display = 'flex'; }
        try { await checkAtWork(ctx); ov.style.display = 'none'; if (!finished) { finished = true; done(); } }
        catch (e) { ov.style.display = 'flex'; h.textContent = 'You are not at work'; m.className = 'note err'; m.textContent = (e && e.msg) || 'Could not check your location.'; }
        b.disabled = false;
      }
      b.addEventListener('click', function () { run(false); });
      o.addEventListener('click', async function () { await signOut(); location.href = loginUrl(); });
      run(true);
      setInterval(function () { run(false); }, 5 * 60000);
    });
  }

  function loadScript(src) { return new Promise(function (res) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = res; document.head.appendChild(s); }); }
  // Adds the bottom bar (Home, two main pages, More) and the ? help button to every restaurant page.
  async function mountNav(ctx) {
    try {
      var page = (location.pathname.split('/').pop() || 'index.html'); if (!/\.html$/.test(page)) page += '.html';   // the host may hide .html
      if (window.VYRO_NO_NAV || ctx.role === 'kiosk' || (ctx.biz.product && ctx.biz.product !== 'restaurant' && !(ctx.biz.apps && ctx.biz.apps.restaurant))) return;
      if (['kiosk.html', 'board.html', 'receipt.html', 'order.html', 'login.html', 'signup.html'].indexOf(page) >= 0) return;
      if (!window.vroles) await loadScript('js/roles.js');
      if (!window.vnav) await loadScript('js/nav.js');
      if (!window.vinstall) await loadScript('../shared/install.js');
      if (window.vnav && window.vroles) window.vnav.mount(ctx);
    } catch (e) { /* the page still works without the bar */ }
  }

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
        // work-location check switched off for testing
        await mountNav(ctx);
        await cb(ctx);
      } catch (err) {
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
  window.vyro = { enterBusiness: enterBusiness, currentRole: currentRole, slugify: slugify, brandFree: brandFree, makeBrand: makeBrand, RESERVED: RESERVED, nameOf: nameOf, who: who, audit: audit, auth: auth, db: db, stamp: stamp, friendly: friendly, el: el,
    signUp: signUp, addMember: addMember, mountSwitcher: mountSwitcher, myInvites: myInvites, acceptInvite: acceptInvite, sendLoginEmail: sendLoginEmail,
    signIn: signIn, signInAs: signInAs, createLocation: createLocation, myWorkplaces: myWorkplaces, switchWorkplace: switchWorkplace, resetPassword: resetPassword, signOut: signOut,
    requireAuth: requireAuth, redirectIfSignedIn: redirectIfSignedIn,
    loadContext: loadContext, start: start };

})();
