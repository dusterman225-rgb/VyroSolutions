/* Vyro Network: one login, many businesses, apps switched on per business.
   Identity (users) is separate from the business (businesses), the team (members), the apps (businesses.apps),
   the plan (businesses/{id}/network/subscription) and storage (businesses/{id}/network/storage). */
(function () {
  'use strict';
  if (!window.VYRO_FIREBASE_CONFIG) { document.addEventListener('DOMContentLoaded', function () { var e = document.getElementById('err'); if (e) e.textContent = 'Setup problem: js/firebase-config.js is missing. Copy it from your other Vyro repo.'; }); return; }
  firebase.initializeApp(window.VYRO_FIREBASE_CONFIG);
  var auth = firebase.auth(), db = firebase.firestore(), FV = firebase.firestore.FieldValue;
  function stamp() { return FV.serverTimestamp(); }
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  var URLS = window.VYRO_APP_URLS || {};

  var APPS = [
    { id: 'restaurant', name: 'VyroRestaurant', desc: 'Tables, point of sale, kitchen, team, Pay with Vyro.', live: true },
    { id: 'takeout', name: 'VyroTakeout', desc: 'Takeout and fast food only. No tables or table QR codes. Costs less.', live: true },
    { id: 'contractor', name: 'VyroContractor', desc: 'Estimates, jobs, invoices, customer portal.', live: true },
    { id: 'retail', name: 'VyroRetail', desc: 'Inventory and checkout for shops.', live: false },
    { id: 'crm', name: 'VyroCRM', desc: 'Shared customer relationships.', live: false }
  ];
  // Defaults are names. The real power comes from the rules, not these labels.
  var ROLE_LABEL = { owner: 'Owner', gm: 'Administrator', supervisor: 'Manager', employee: 'Employee', cook: 'Employee (cook)', server: 'Employee (server)', host: 'Employee (host)', kiosk: 'Device' };
  var INVITE_ROLES = { owner: ['employee', 'cook', 'server', 'host', 'supervisor', 'gm'], gm: ['employee', 'cook', 'server', 'host', 'supervisor'], supervisor: ['employee', 'cook', 'server', 'host'] };
  var BUSINESS_TYPES = ['Restaurant or cafe', 'Contractor or trades', 'Retail shop', 'Services', 'Other'];
  var CURRENCIES = ['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'MXN'];
  var TIMEZONES = ['America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York', 'America/Anchorage', 'Pacific/Honolulu', 'America/Toronto', 'Europe/London', 'Europe/Paris', 'Australia/Sydney'];
  var STORAGE_INCLUDED = 1073741824; // planned allowance shown to owners: 1 GB. Not enforced until file storage is connected.

  function friendly(e) {
    var c = e && e.code || '', m = e && e.message || String(e);
    var map = { 'auth/invalid-credential': 'That email and password do not match.', 'auth/wrong-password': 'That email and password do not match.', 'auth/user-not-found': 'That email and password do not match.',
      'auth/email-already-in-use': 'That email already has a Vyro account. Sign in instead.', 'auth/weak-password': 'Use a password with at least 8 characters.', 'auth/invalid-email': 'That email does not look right.',
      'auth/too-many-requests': 'Too many tries. Wait a few minutes and try again.', 'auth/network-request-failed': 'No connection. Check your internet and try again.',
      'permission-denied': 'You are not allowed to do that here.', 'auth/requires-recent-login': 'Please sign out and sign in again, then retry.' };
    return map[c] || (/permission/i.test(m) ? map['permission-denied'] : m);
  }

  // ---- account ----
  async function signUp(name, email, pw) {
    var cred = await auth.createUserWithEmailAndPassword(email.trim(), pw);
    try { await cred.user.updateProfile({ displayName: name }); } catch (e) {}
    await db.collection('users').doc(cred.user.uid).set({ name: name, email: email.trim().toLowerCase(), termsAt: stamp(), termsVersion: 'draft-1', createdAt: stamp() }, { merge: true });
    try { await cred.user.sendEmailVerification(); } catch (e) {}
    return cred.user;
  }
  function signIn(email, pw) { return auth.signInWithEmailAndPassword(email.trim(), pw); }
  function resetPassword(email) { return auth.sendPasswordResetEmail(email.trim()); }
  function signOut() { return auth.signOut(); }
  function requireAuth(cb) { auth.onAuthStateChanged(function (u) { if (!u) { location.replace('index.html'); } else { cb(u); } }); }
  async function me(uid) { var d = await db.collection('users').doc(uid).get(); return d.exists ? d.data() : {}; }

  // ---- businesses (workspaces) ----
  async function workspaces(user) {
    var ud = await db.collection('users').doc(user.uid).get(), data = ud.data() || {};
    var ids = (data.bizIds || []).slice(); if (data.bizId && ids.indexOf(data.bizId) < 0) ids.push(data.bizId);
    var out = [];
    await Promise.all(ids.map(async function (id) {
      try {
        var r = await Promise.all([db.collection('businesses').doc(id).get(), db.collection('businesses').doc(id).collection('members').doc(user.uid).get()]);
        if (r[0].exists && r[1].exists) { var b = r[0].data(); out.push({ id: id, name: b.name || 'Business', type: b.type || '', status: b.status || 'active', apps: b.apps || {}, product: b.product || '', role: r[1].data().role, active: data.bizId === id }); }
      } catch (e) {}
    }));
    out.sort(function (a, b) { return a.name.localeCompare(b.name); });
    return out;
  }
  async function createWorkspace(user, f) {
    var bizRef = db.collection('businesses').doc(), apps = {}, first = '';
    (f.apps || []).forEach(function (a) { apps[a] = true; if (!first) first = a; });
    var b = { name: f.name, ownerUid: user.uid, type: f.type || '', country: f.country || '', timezone: f.timezone || '', currency: f.currency || 'USD', status: 'active', apps: apps, createdAt: stamp() };
    if (first) b.product = first;
    var batch = db.batch();
    batch.set(bizRef, b);
    var mem = { role: 'owner', email: (user.email || '').toLowerCase(), createdAt: stamp() }; if (f.ownerName) mem.name = f.ownerName;
    batch.set(bizRef.collection('members').doc(user.uid), mem);
    await batch.commit();
    // Second step: these need the owner membership to exist first.
    await db.collection('users').doc(user.uid).set({ bizIds: FV.arrayUnion(bizRef.id), bizId: bizRef.id }, { merge: true });
    var b2 = db.batch();
    b2.set(bizRef.collection('network').doc('subscription'), { plan: 'founding', status: 'active', price: 0, currency: 'USD', note: 'Free during launch', createdAt: stamp() });
    b2.set(bizRef.collection('network').doc('storage'), { includedBytes: STORAGE_INCLUDED, additionalBytes: 0, usedBytes: 0, status: 'not-connected', createdAt: stamp() });
    await b2.commit();
    await audit(bizRef.id, 'workspace.create', f.name);
    return bizRef.id;
  }
  async function getWorkspace(id, user) {
    var r = await Promise.all([db.collection('businesses').doc(id).get(), db.collection('businesses').doc(id).collection('members').doc(user.uid).get()]);
    if (!r[0].exists || !r[1].exists) throw { message: 'You are not a member of that business.' };
    return { id: id, ref: db.collection('businesses').doc(id), biz: r[0].data(), me: r[1].data(), role: r[1].data().role };
  }
  function isOwnerLevel(role) { return role === 'owner' || role === 'gm'; }
  async function setActive(user, bizId) { await db.collection('users').doc(user.uid).set({ bizId: bizId }, { merge: true }); }
  function appUrl(appId, bizId) { return URLS[appId] || '#'; }
  async function launch(user, ws, appId) { await setActive(user, ws.id); location.href = appUrl(appId, ws.id); }

  async function updateBusiness(ws, patch, action, detail) { await ws.ref.update(patch); await audit(ws.id, action, detail); }
  async function setApp(ws, appId, on) {
    var p = {}; p['apps.' + appId] = !!on;
    if (on && !ws.biz.product) p.product = appId;
    await ws.ref.update(p); await audit(ws.id, on ? 'app.activate' : 'app.deactivate', appId);
    ws.biz.apps = ws.biz.apps || {}; ws.biz.apps[appId] = !!on;
  }
  async function closeWorkspace(ws) { await ws.ref.update({ status: 'closed', closedAt: stamp() }); await audit(ws.id, 'workspace.close', ws.biz.name); }
  async function reopenWorkspace(ws) { await ws.ref.update({ status: 'active' }); await audit(ws.id, 'workspace.reopen', ws.biz.name); }

  // ---- team ----
  async function members(ws) { var s = await ws.ref.collection('members').get(); var o = []; s.forEach(function (d) { var m = d.data(); m.uid = d.id; o.push(m); }); return o; }
  async function invitesFor(ws) { var s = await db.collection('invites').where('bizId', '==', ws.id).get(); var o = []; s.forEach(function (d) { var i = d.data(); i.id = d.id; o.push(i); }); return o; }
  async function invite(ws, user, email, name, role) {
    email = String(email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw { message: 'Enter a valid email.' };
    var exp = firebase.firestore.Timestamp.fromDate(new Date(Date.now() + 14 * 86400000));
    await db.collection('invites').doc(email + '__' + ws.id).set({ email: email, bizId: ws.id, bizName: ws.biz.name || '', product: ws.biz.product || '', role: role, name: name || '', addedBy: user.uid, createdAt: stamp(), expiresAt: exp });
    await audit(ws.id, 'invite.send', email + ' as ' + role);
  }
  async function cancelInvite(ws, id) { await db.collection('invites').doc(id).delete(); await audit(ws.id, 'invite.cancel', id.split('__')[0]); }
  async function myInvites(user) {
    var s = await db.collection('invites').where('email', '==', (user.email || '').toLowerCase()).get(); var o = [];
    s.forEach(function (d) { var i = d.data(); i.id = d.id; var x = i.expiresAt && i.expiresAt.toDate ? i.expiresAt.toDate() : null; i.expired = !!(x && x.getTime() < Date.now()); o.push(i); });
    return o;
  }
  async function acceptInvite(user, inv) {
    if (inv.expired) throw { message: 'This invitation has expired. Ask them to send a new one.' };
    var m = { role: inv.role, email: user.email.toLowerCase(), name: inv.name || '', addedBy: inv.addedBy, inviteId: inv.id, createdAt: stamp() };
    await db.collection('businesses').doc(inv.bizId).collection('members').doc(user.uid).set(m);
    await db.collection('users').doc(user.uid).set({ bizIds: FV.arrayUnion(inv.bizId) }, { merge: true });
    try { await db.collection('invites').doc(inv.id).delete(); } catch (e) {}
  }
  async function declineInvite(inv) { await db.collection('invites').doc(inv.id).delete(); }
  async function setRole(ws, uid, role) { await ws.ref.collection('members').doc(uid).update({ role: role }); await audit(ws.id, 'member.role', uid + ' -> ' + role); }
  async function removeMember(ws, uid) { await ws.ref.collection('members').doc(uid).delete(); await audit(ws.id, 'member.remove', uid); }

  // ---- plan, storage, activity ----
  async function subscription(ws) { try { var d = await ws.ref.collection('network').doc('subscription').get(); return d.exists ? d.data() : null; } catch (e) { return null; } }
  async function storage(ws) { try { var d = await ws.ref.collection('network').doc('storage').get(); return d.exists ? d.data() : null; } catch (e) { return null; } }
  async function activity(ws) { var s = await ws.ref.collection('audit').orderBy('at', 'desc').limit(50).get(); var o = []; s.forEach(function (d) { o.push(d.data()); }); return o; }
  async function audit(bizId, action, detail) {
    try { var u = auth.currentUser; await db.collection('businesses').doc(bizId).collection('audit').add({ action: String(action).slice(0, 60), detail: String(detail || '').slice(0, 300), by: u.uid, byEmail: u.email || '', at: stamp() }); } catch (e) {}
  }
  async function exportData(ws) {
    var names = ['members', 'menu', 'tables', 'supply', 'reservations', 'orders', 'customers', 'jobs', 'estimates', 'invoices', 'expenses', 'settings', 'audit'], out = { business: ws.biz, exportedAt: new Date().toISOString(), collections: {} };
    await Promise.all(names.map(async function (n) { try { var s = await ws.ref.collection(n).get(); out.collections[n] = []; s.forEach(function (d) { out.collections[n].push(Object.assign({ _id: d.id }, d.data())); }); } catch (e) {} }));
    return JSON.stringify(out, function (k, v) { return v && v.toDate ? v.toDate().toISOString() : v; }, 2);
  }
  function fmtBytes(n) { if (n >= 1073741824) return (n / 1073741824).toFixed(1) + ' GB'; if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB'; return Math.round(n / 1024) + ' KB'; }

  window.vnet = { auth: auth, db: db, el: el, friendly: friendly, APPS: APPS, ROLE_LABEL: ROLE_LABEL, INVITE_ROLES: INVITE_ROLES, BUSINESS_TYPES: BUSINESS_TYPES, CURRENCIES: CURRENCIES, TIMEZONES: TIMEZONES,
    signUp: signUp, signIn: signIn, resetPassword: resetPassword, signOut: signOut, requireAuth: requireAuth, me: me, workspaces: workspaces, createWorkspace: createWorkspace, getWorkspace: getWorkspace,
    isOwnerLevel: isOwnerLevel, setActive: setActive, appUrl: appUrl, launch: launch, updateBusiness: updateBusiness, setApp: setApp, closeWorkspace: closeWorkspace, reopenWorkspace: reopenWorkspace,
    members: members, invitesFor: invitesFor, invite: invite, cancelInvite: cancelInvite, myInvites: myInvites, acceptInvite: acceptInvite, declineInvite: declineInvite, setRole: setRole, removeMember: removeMember,
    subscription: subscription, storage: storage, activity: activity, audit: audit, exportData: exportData, fmtBytes: fmtBytes };
})();
