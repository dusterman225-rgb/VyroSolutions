// Customer portal: creates the customer's login, and keeps a customer-safe copy of the job up to date.
(function () {
  function portals() { return vyro.db.collection('portals'); }
  function randomPassword() {
    var a = new Uint8Array(24); crypto.getRandomValues(a);
    var s = ''; for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
    return btoa(s).replace(/[^A-Za-z0-9]/g, 'x') + 'Aa1!';
  }
  function cleanEmail(e) { return (e || '').trim().toLowerCase(); }

  // Makes the customer's login (if the email has none yet) and emails them a link to set their password.
  async function inviteCustomer(email) {
    var app = firebase.initializeApp(window.VYRO_FIREBASE_CONFIG, 'portal-' + Date.now());
    var result = { created: false, emailed: false, error: '' };
    try {
      var a = app.auth();
      await a.setPersistence(firebase.auth.Auth.Persistence.NONE);
      try {
        await a.createUserWithEmailAndPassword(email, randomPassword());
        result.created = true;
      } catch (e) {
        if (!e || e.code !== 'auth/email-already-in-use') throw e;
      }
      try { await a.sendPasswordResetEmail(email, { url: location.origin + location.pathname.replace(/[^\/]*$/, '') + 'portal-login.html' }); result.emailed = true; }
      catch (e2) { await a.sendPasswordResetEmail(email); result.emailed = true; }
      try { await a.signOut(); } catch (x) { /* ignore */ }
    } catch (e) { result.error = vyro.friendly(e); }
    try { await app.delete(); } catch (x) { /* ignore */ }
    return result;
  }

  // Customer-safe copy of the job + invoices. Never copies costs, profit or internal notes.
  async function syncJob(ctx, jobId, job) {
    var pref = portals().doc(jobId);
    var snap = await pref.get();
    if (!snap.exists) return false;
    if (!job) { var js = await ctx.bizRef.collection('jobs').doc(jobId).get(); if (!js.exists) return false; job = js.data(); }
    var is = null;
    try { is = await ctx.bizRef.collection('invoices').where('estimateId', '==', jobId).get(); } catch (e0) { is = null; }   // employees cannot read invoices
    if (!is) {
      await pref.update({ status: job.status || '', startDate: job.startDate || '', targetEndDate: job.targetEndDate || '', title: job.title || '', address: job.address || '', updatedAt: vyro.stamp() });
      return true;
    }
    var paid = 0, owed = 0, keep = {}, batch = vyro.db.batch();
    is.forEach(function (d) {
      var i = d.data();
      if (i.status === 'Draft' || i.status === 'Voided') return;
      paid += i.paidCents || 0;
      if (i.status === 'Sent' || i.status === 'Partially Paid') owed += (i.totalCents || 0) - (i.paidCents || 0);
      keep[d.id] = true;
      batch.set(pref.collection('invoices').doc(d.id), {
        number: i.number || '', status: i.status, billingType: i.billingType || '',
        totalCents: i.totalCents || 0, paidCents: i.paidCents || 0, dueDate: i.dueDate || '',
        updatedAt: vyro.stamp()
      });
    });
    var old = await pref.collection('invoices').get();
    old.forEach(function (d) { if (!keep[d.id]) batch.delete(d.ref); });
    batch.update(pref, {
      status: job.status || '', startDate: job.startDate || '', targetEndDate: job.targetEndDate || '',
      title: job.title || '', address: job.address || '', contractCents: job.contractCents || 0,
      paidCents: paid, owedCents: owed,
      businessName: ctx.biz.name || '', businessPhone: ctx.biz.phone || '', businessEmail: ctx.biz.email || '',
      updatedAt: vyro.stamp()
    });
    await batch.commit();
    return true;
  }

  // Creates the portal for a job (login + email + customer-safe copy). Safe to call again; it only emails once unless force.
  async function ensure(ctx, jobId, job, force, skipInvite) {
    var email = cleanEmail(job.customerEmail);
    if (!email) return { ok: false, reason: 'no-email' };
    var pref = portals().doc(jobId), snap = await pref.get(), inv = null;
    if ((!snap.exists || force) && !skipInvite) {
      if (email === cleanEmail(ctx.user.email)) {
        inv = { created: false, emailed: false, error: 'That is your own sign-in email. Use a different email for the customer.' };
        return { ok: false, reason: 'own-email', message: inv.error };
      }
      inv = await inviteCustomer(email);
      if (inv.error && !inv.created && !inv.emailed) return { ok: false, reason: 'invite-failed', message: inv.error };
    }
    if (!snap.exists) {
      await pref.set({
        bizId: ctx.bizId, jobId: jobId, customerEmail: email, customerName: job.customerName || '',
        estimateNumber: job.estimateNumber || '', title: job.title || '', address: job.address || '',
        status: job.status || '', startDate: '', targetEndDate: '', contractCents: 0, paidCents: 0, owedCents: 0,
        businessName: ctx.biz.name || '', businessPhone: ctx.biz.phone || '', businessEmail: ctx.biz.email || '',
        createdAt: vyro.stamp(), updatedAt: vyro.stamp()
      });
    } else if (snap.data().customerEmail !== email) {
      await pref.update({ customerEmail: email, updatedAt: vyro.stamp() });
    }
    await syncJob(ctx, jobId, job);
    return { ok: true, created: inv ? inv.created : false, emailed: inv ? inv.emailed : false, email: email };
  }

  // Shows a note in the customer's portal.
  async function shareUpdate(jobId, text, id) {
    var pref = portals().doc(jobId);
    if (!(await pref.get()).exists) return false;
    var col = pref.collection('updates');
    var data = { text: text, createdAt: vyro.stamp() };
    if (id) await col.doc(id).set(data); else await col.add(data);
    return true;
  }

  // One portal per customer: makes a portal for each of their jobs, and emails the login link once.
  // Finds a customer's jobs: linked by customer id, or (for estimates typed in by name) by the same email.
  // Jobs found by email get linked to the customer so the portal and deletes work from now on.
  async function findJobs(ctx, customerId, email, rawEmail) {
    var col = ctx.bizRef.collection('jobs'), seen = {}, out = [];
    var links = [];
    function add(d, link) { if (seen[d.id]) return; seen[d.id] = 1; out.push(d); if (link && !d.data().customerId) links.push(d.ref.update({ customerId: customerId }).catch(function () { /* optional */ })); }
    (await col.where('customerId', '==', customerId).get()).forEach(function (d) { add(d, false); });
    var emails = [cleanEmail(email)];
    if (rawEmail && (rawEmail || '').trim() && emails.indexOf(rawEmail.trim()) < 0) emails.push(rawEmail.trim());
    for (var i = 0; i < emails.length; i++) {
      if (!emails[i]) continue;
      (await col.where('customerEmail', '==', emails[i]).get()).forEach(function (d) { add(d, true); });
    }
    await Promise.all(links);
    return out;
  }

  async function ensureForCustomer(ctx, customerId, email, name, rawEmail) {
    var all = await findJobs(ctx, customerId, email, rawEmail);
    var jobs = all.filter(function (d) { return d.data().status !== 'Cancelled'; });
    if (!jobs.length) return { ok: false, reason: 'no-jobs', message: 'This customer has no jobs yet. A portal is created once they have a job.' };
    var out = null;
    for (var i = 0; i < jobs.length; i++) {
      var j = jobs[i].data(); j.customerEmail = email; if (name) j.customerName = name;
      var r = await ensure(ctx, jobs[i].id, j, i === 0, i > 0);
      if (i === 0) out = r;
      if (i === 0 && !r.ok) return r;
    }
    return out;
  }

  // True if any of this customer's jobs has a portal.
  async function hasForCustomer(ctx, customerId, email, rawEmail) {
    var docs = await findJobs(ctx, customerId, email, rawEmail);
    for (var i = 0; i < docs.length; i++) { if (await exists(docs[i].id)) return true; }
    return false;
  }

  // Deletes the portal (and everything in it) for each of this customer's jobs. Used when a customer is archived or deleted.
  async function removeForCustomer(ctx, customerId) {
    var js = await ctx.bizRef.collection('jobs').where('customerId', '==', customerId).get();
    for (var i = 0; i < js.docs.length; i++) await removeForJob(js.docs[i].id);
  }
  async function removeForJob(jobId) {
    var pref = portals().doc(jobId);
    if (!(await pref.get()).exists) return;
    var subs = ['updates', 'invoices', 'messages', 'documents'];
    for (var s = 0; s < subs.length; s++) {
      var qs = await pref.collection(subs[s]).get();
      for (var k = 0; k < qs.docs.length; k++) await qs.docs[k].ref.delete();
    }
    await pref.delete();
  }

  async function exists(jobId) { return (await portals().doc(jobId).get()).exists; }

  window.vportal = { findJobs: findJobs, ensure: ensure, ensureForCustomer: ensureForCustomer, hasForCustomer: hasForCustomer, removeForCustomer: removeForCustomer, removeForJob: removeForJob, syncJob: syncJob, shareUpdate: shareUpdate, exists: exists };
})();
