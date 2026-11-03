// Online estimate acceptance: private link pages, and syncing customer acceptances into your account.
(function () {
  function makeToken() {
    var a = new Uint8Array(24); crypto.getRandomValues(a);
    var s = ''; for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function col() { return vyro.db.collection('publicEstimates'); }

  // Creates or refreshes the customer-facing copy of an estimate. Only what the customer needs is copied.
  async function publishEstimate(ctx, estimateId, e, token) {
    var ref = col().doc(token);
    var snap = await ref.get();
    if (snap.exists && snap.data().status === 'Accepted') return;     // never reopen an accepted estimate
    var b = ctx.biz;
    var doc = {
      bizId: ctx.bizId, estimateId: estimateId, number: e.number || '',
      businessName: b.name || '', businessPhone: b.phone || '', businessEmail: b.email || '',
      customerName: e.customerName || '', title: e.title || '', validUntil: e.validUntil || '',
      lineItems: e.lineItems || [], subtotalCents: e.subtotalCents || 0, discountCents: e.discountCents || 0,
      taxPct: e.taxPct || 0, taxCents: e.taxCents || 0, totalCents: e.totalCents || 0, depositPct: e.depositPct || 0,
      terms: e.terms || '', status: 'Sent', processed: false, updatedAt: vyro.stamp()
    };
    if (snap.exists) await ref.update(doc);
    else { doc.createdAt = vyro.stamp(); await ref.set(doc); }
  }

  // Closes the online link (estimate voided, rejected or approved by hand).
  async function closeEstimate(ctx, token) {
    var ref = col().doc(token), snap = await ref.get();
    if (snap.exists && snap.data().status !== 'Accepted') await ref.update({ status: 'Closed', updatedAt: vyro.stamp() });
  }

  // Turns customer acceptances into approved estimates + jobs. Returns a list of what was accepted.
  async function syncAccepted(ctx) {
    var snap = await col().where('bizId', '==', ctx.bizId).where('status', '==', 'Accepted').get();
    var done = [];
    for (var i = 0; i < snap.docs.length; i++) {
      var d = snap.docs[i], p = d.data();
      if (p.processed) continue;
      var eref = ctx.bizRef.collection('estimates').doc(p.estimateId);
      var es = await eref.get();
      if (es.exists && (es.data().status === 'Sent' || es.data().status === 'Draft')) {
        var e = es.data();
        await eref.update({
          status: 'Approved', approvedAt: vyro.stamp(), approvedVia: 'customer link',
          acceptedBy: p.acceptedBy || '', acceptedAt: p.acceptedAt || null, updatedAt: vyro.stamp()
        });
        var jref = ctx.bizRef.collection('jobs').doc(p.estimateId), js = await jref.get();
        if (!js.exists) {
          await jref.set({
            estimateId: p.estimateId, estimateNumber: e.number || '', customerId: e.customerId || '',
            customerName: e.customerName || '', customerEmail: e.customerEmail || '', customerPhone: e.customerPhone || '',
            address: e.address || '', title: e.title || '', contractCents: e.totalCents || 0, depositPct: e.depositPct || 0,
            status: 'Not Started', startDate: '', targetEndDate: '', internalNotes: '',
            createdAt: vyro.stamp(), createdBy: ctx.user.uid, updatedAt: vyro.stamp()
          });
        }
        try { var ar = await afterApproval(ctx, p.estimateId, Object.assign({}, e, { id: p.estimateId })); if (ar.customerId) e.customerId = ar.customerId; } catch (x) { /* optional */ }
        try { await jref.collection('updates').add({ text: 'Estimate ' + (e.number || '') + ' accepted online by ' + (p.acceptedBy || 'the customer'), by: 'Customer link', kind: 'status', createdAt: vyro.stamp() }); } catch (x) { /* optional */ }
        if (e.customerId) { try { await ctx.bizRef.collection('customers').doc(e.customerId).update({ archived: false, archivedAt: null }); } catch (x) { /* optional */ } }
        if (e.leadId) {
          try {
            var lref = ctx.bizRef.collection('leads').doc(e.leadId), ls = await lref.get();
            if (ls.exists && ['New', 'Contacted', 'Estimate Sent'].indexOf(ls.data().status) > -1) {
              await lref.update({ status: 'Won', statusChangedAt: vyro.stamp(), updatedAt: vyro.stamp() });
            }
          } catch (x) { /* optional */ }
        }
        done.push({ number: e.number || '', customer: e.customerName || '', by: p.acceptedBy || '', jobId: p.estimateId });
      }
      await d.ref.update({ processed: true });
    }
    return done;
  }


  // Runs the moment an estimate becomes Approved (by hand or accepted online): makes sure the customer record exists,
  // links it to the estimate and job, then creates the customer's portal login and emails the invitation.
  function loadPortalJs() {
    if (window.vportal) return Promise.resolve(true);
    return new Promise(function (res) {
      var sc = document.createElement('script'); sc.src = '/contractor/js/portal.js';
      sc.onload = function () { res(!!window.vportal); }; sc.onerror = function () { res(false); }; document.head.appendChild(sc);
    });
  }
  async function afterApproval(ctx, estId, e) {
    var out = { customerId: e.customerId || '', invited: false, reason: '' };
    var name = (e.customerName || '').trim(), em = (e.customerEmail || '').trim();
    try {
      if (!out.customerId && name) {
        if (em) { var f = await ctx.bizRef.collection('customers').where('email', '==', em).limit(1).get(); if (!f.empty) out.customerId = f.docs[0].id; }
        if (!out.customerId) {
          var cref = ctx.bizRef.collection('customers').doc();
          await cref.set({ name: name, nameLower: name.toLowerCase(), phone: e.customerPhone || '', email: em, address: e.address || '', language: 'en', notes: '', fromEstimateId: estId, createdAt: vyro.stamp(), createdBy: ctx.user.uid, updatedAt: vyro.stamp() });
          out.customerId = cref.id;
        }
        try { await ctx.bizRef.collection('estimates').doc(estId).update({ customerId: out.customerId }); } catch (x) { /* optional */ }
        try { await ctx.bizRef.collection('jobs').doc(estId).update({ customerId: out.customerId }); } catch (x) { /* optional */ }
      }
    } catch (x) { /* the Jobs page repairs a missing customer later */ }
    try {
      if (ctx.role !== 'employee' && await loadPortalJs()) {
        var js = await ctx.bizRef.collection('jobs').doc(estId).get();
        if (js.exists) {
          var j = js.data(); j.id = estId; j.customerId = out.customerId || j.customerId || '';
          var r = await vportal.ensure(ctx, estId, j);
          out.invited = !!(r && r.ok && r.emailed); out.reason = r && !r.ok ? (r.reason || '') : '';
        }
      }
    } catch (x) { out.reason = 'error'; }
    return out;
  }

  window.vpublic = { afterApproval: afterApproval, makeToken: makeToken, publishEstimate: publishEstimate, closeEstimate: closeEstimate, syncAccepted: syncAccepted };
})();
