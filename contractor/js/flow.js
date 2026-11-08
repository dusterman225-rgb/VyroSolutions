// Documents flow. Everything goes to the customer's portal first, and one short message tells the customer to look there.
//   estimate sent  -> appears in the portal (customer can Approve / Revise / Decline)
//   estimate approved -> a contract is generated for the contractor to finish and share
//   contract marked signed/received -> a draft invoice is generated from the estimate and contract
// Vyqil has no server on this plan, so the follow-on steps run the next time the contractor opens the dashboard
// (and right away when the contractor taps the button on the contract page).
(function () {
  function first(a) { for (var i = 0; i < arguments.length; i++) { var v = arguments[i]; if (v !== undefined && v !== null && String(v).trim() !== '') return v; } return ''; }
  function today() { return vutil.todayStr(); }

  function portalLink(ctx) {
    var base = location.origin + '/contractor/portal-login.html', slug = ctx.biz.slug || '';
    if (!slug) { try { slug = sessionStorage.getItem('vyroSlug_' + ctx.bizId) || ''; } catch (e) { slug = ''; } }
    return base + (slug ? '?r=' + encodeURIComponent(slug) : '');
  }
  function myName(ctx) { return String(first(ctx.me && ctx.me.name, window.vyro && vyro.who && vyro.who(ctx), ctx.user && ctx.user.displayName, ctx.biz.name)).trim(); }

  // The one message used for every document.
  function message(ctx, to) {
    var link = portalLink(ctx);
    return {
      to: to || '', subject: myName(ctx) + ' sent you a new document',
      body: myName(ctx) + ' sent you a new document for you to review. Please check your customer portal.\n\n' + link + '\n\nThank you,\n' + (ctx.biz.name || '')
    };
  }

  function loadPortalJs() {
    if (window.vportal) return Promise.resolve(true);
    return new Promise(function (res) {
      var sc = document.createElement('script'); sc.src = '/contractor/js/portal.js';
      sc.onload = function () { res(!!window.vportal); }; sc.onerror = function () { res(false); }; document.head.appendChild(sc);
    });
  }
  function loadContractJs() {
    var need = [];
    if (!window.vcontract) need.push('/contractor/js/contracts.js');
    if (!window.VYRO_CONTRACT_DEFAULT) need.push('/contractor/js/contract-default.js');
    return Promise.all(need.map(function (src) {
      return new Promise(function (res) { var sc = document.createElement('script'); sc.src = src; sc.onload = function () { res(true); }; sc.onerror = function () { res(false); }; document.head.appendChild(sc); });
    })).then(function () { return !!window.vcontract; });
  }

  // ---------- estimate -> portal ----------
  function estimateText(ctx, e) {
    var L = [];
    L.push('ESTIMATE ' + (e.number || '') + (e.title ? ' - ' + e.title : ''));
    L.push('From: ' + (ctx.biz.name || '') + (ctx.biz.phone ? '   Phone: ' + ctx.biz.phone : ''));
    L.push('Prepared for: ' + (e.customerName || '') + (e.address ? '   ' + e.address : ''));
    if (e.validUntil) L.push('Valid until: ' + e.validUntil);
    L.push('');
    (e.lineItems || []).forEach(function (it) { L.push('  - ' + (it.description || '') + ' (qty ' + it.qty + ', ' + vutil.fmt(Math.round((Number(it.qty) || 0) * (Number(it.unitCents) || 0))) + ')'); });
    L.push('');
    L.push('Subtotal: ' + vutil.fmt(e.subtotalCents || 0));
    if (e.discountCents) L.push('Discount: -' + vutil.fmt(e.discountCents));
    if (e.taxCents) L.push('Tax (' + (e.taxPct || 0) + '%): ' + vutil.fmt(e.taxCents));
    L.push('TOTAL: ' + vutil.fmt(e.totalCents || 0));
    if (e.depositPct) L.push('Deposit requested (' + e.depositPct + '%): ' + vutil.fmt(Math.round((e.totalCents || 0) * e.depositPct / 100)));
    if (e.terms) { L.push(''); L.push('Terms:'); L.push(e.terms); }
    return L.join('\n');
  }

  // Puts the estimate in the customer's portal (creating the portal first if needed). Returns { ok, reason }.
  async function estimateToPortal(ctx, e) {
    try {
      var email = String(e.customerEmail || '').trim();
      if (!email) return { ok: false, reason: 'no-email' };
      if (!(await loadPortalJs())) return { ok: false, reason: 'no-portal-code' };
      var r = await vportal.ensure(ctx, e.id, { customerEmail: email, customerName: e.customerName || '', estimateNumber: e.number || '', title: e.title || '', address: e.address || '', status: 'Estimate', customerId: e.customerId || '' });
      if (!r || !r.ok) return { ok: false, reason: (r && r.reason) || 'failed', message: r && r.message };
      await vyro.db.collection('portals').doc(e.id).collection('documents').doc(e.id).set({
        kind: 'estimate', estimateId: e.id, title: 'Estimate ' + (e.number || '') + (e.title ? ' - ' + e.title : ''), body: estimateText(ctx, e),
        businessName: ctx.biz.name || '', sharedAt: vyro.stamp(), needsApproval: true,
        returnMethods: Array.isArray(ctx.biz.returnMethods) ? ctx.biz.returnMethods : [], returnNote: ctx.biz.returnNote || ''
      });
      await ctx.bizRef.collection('estimates').doc(e.id).update({ portalShared: true, portalSharedAt: vyro.stamp() });
      if (window.vutil && vutil.pushNotify) vutil.pushNotify(e.id, 'estimate');
      return { ok: true };
    } catch (err) { return { ok: false, reason: 'error', message: String((err && err.message) || err) }; }
  }

  // Updates the portal copy of the job and its invoices after an invoice is sent.
  async function invoiceToPortal(ctx, inv) {
    try {
      var email = String(inv.customerEmail || '').trim(), jid = inv.estimateId;
      if (!email || !jid) return { ok: false, reason: !email ? 'no-email' : 'no-job' };
      if (!(await loadPortalJs())) return { ok: false, reason: 'no-portal-code' };
      var js = await ctx.bizRef.collection('jobs').doc(jid).get();
      if (!js.exists) return { ok: false, reason: 'no-job' };
      var job = js.data(); job.id = jid; job.customerEmail = job.customerEmail || email;
      var r = await vportal.ensure(ctx, jid, job);
      if (r && r.ok && window.vutil && vutil.pushNotify) vutil.pushNotify(jid, 'invoice');
      return r && r.ok ? { ok: true } : { ok: false, reason: (r && r.reason) || 'failed', message: r && r.message };
    } catch (err) { return { ok: false, reason: 'error', message: String((err && err.message) || err) }; }
  }

  // ---------- estimate approved -> job -> contract ----------
  async function ensureJob(ctx, e) {
    var jref = ctx.bizRef.collection('jobs').doc(e.id), js = await jref.get();
    if (js.exists) return js.data();
    var j = {
      estimateId: e.id, estimateNumber: e.number || '', customerId: e.customerId || '', customerName: e.customerName || '', customerEmail: e.customerEmail || '', customerPhone: e.customerPhone || '',
      address: e.address || '', title: e.title || '', contractCents: e.totalCents || 0, depositPct: e.depositPct || 0, status: 'Not Started', startDate: '', targetEndDate: '', internalNotes: '',
      createdAt: vyro.stamp(), createdBy: ctx.user.uid, updatedAt: vyro.stamp()
    };
    await jref.set(j); return j;
  }

  async function approveFromPortal(ctx, e, d) {
    await ctx.bizRef.collection('estimates').doc(e.id).update({ status: 'Approved', approvedAt: vyro.stamp(), approvedVia: 'customer portal', acceptedBy: d.approvedBy || '', acceptedAt: d.approvedAt || null, updatedAt: vyro.stamp() });
    e.status = 'Approved';
    await ensureJob(ctx, e);
    try { await ctx.bizRef.collection('jobs').doc(e.id).collection('updates').add({ text: 'Estimate ' + (e.number || '') + ' approved in the portal by ' + (d.approvedBy || 'the customer'), by: 'Customer portal', kind: 'status', createdAt: vyro.stamp() }); } catch (x) { /* optional */ }
    if (e.publicToken && window.vpublic && vpublic.closeEstimate) { try { await vpublic.closeEstimate(ctx, e.publicToken); } catch (x) { /* optional */ } }
    if (e.leadId) { try { var lr = ctx.bizRef.collection('leads').doc(e.leadId), ls = await lr.get(); if (ls.exists && ['New', 'Contacted', 'Estimate Sent'].indexOf(ls.data().status) > -1) await lr.update({ status: 'Won', statusChangedAt: vyro.stamp(), updatedAt: vyro.stamp() }); } catch (x) { /* optional */ } }
  }

  async function makeContract(ctx, e) {
    if (!(await loadContractJs())) return null;
    await ensureJob(ctx, e);
    var body = '', tname = 'Home improvement contract (starter)';
    try {
      var ts = await ctx.bizRef.collection('templates').get();
      ts.forEach(function (d) { var t = d.data(); if (!body && t.body && /contract|home improvement/i.test(t.name || '') && !/change|lien|receipt|waiver/i.test(t.name || '')) { body = t.body; tname = t.name; } });
    } catch (x) { /* use the starter */ }
    if (!body && window.VYRO_CONTRACT_DEFAULT) body = window.VYRO_CONTRACT_DEFAULT.body;
    if (!body) return null;
    var f = await vcontract.fill(ctx, e.id, body);
    var ref = await ctx.bizRef.collection('contracts').add({
      jobId: e.id, estimateId: e.id, customerName: f.job.customerName || '', title: 'Contract - ' + (f.job.title || ('Estimate ' + (e.number || ''))),
      templateName: tname, body: f.text, status: 'Draft', auto: true, createdAt: vyro.stamp(), updatedAt: vyro.stamp(), createdBy: ctx.user.uid
    });
    await ctx.bizRef.collection('estimates').doc(e.id).update({ contractId: ref.id, autoContractAt: vyro.stamp() });
    return ref.id;
  }

  // ---------- contract signed/received -> draft invoice ----------
  async function makeInvoice(ctx, c, cid) {
    if (/change|lien|receipt|waiver|subcontract/i.test((c.title || '') + ' ' + (c.templateName || ''))) return null;   // only the main contract
    var eid = c.estimateId || c.jobId, es = await ctx.bizRef.collection('estimates').doc(eid).get();
    if (!es.exists) return null;
    try {   // never double-bill: if an invoice for this estimate already exists, do nothing
      var ex = await ctx.bizRef.collection('invoices').where('estimateId', '==', eid).limit(1).get();
      if (!ex.empty) { await ctx.bizRef.collection('contracts').doc(cid).update({ autoInvoiceAt: vyro.stamp() }); return null; }
    } catch (x) { /* continue */ }
    var e = es.data(), dep = Math.round(Number(e.depositPct) || 0), total = e.totalCents || 0, items, billingType, milestone = '';
    var plan = '';
    try { var js = await ctx.bizRef.collection('jobs').doc(eid).get(); if (js.exists) plan = js.data().paymentPlan || ''; } catch (x) { /* optional */ }
    if (dep > 0 && dep < 100) {
      var amt = Math.round(total * dep / 100);
      items = [{ description: 'Deposit (' + dep + '%) - ' + (e.title || 'Estimate ' + (e.number || '')), qty: 1, unitCents: amt }]; billingType = 'deposit'; milestone = 'Deposit';
    } else { items = e.lineItems || []; billingType = 'full'; }
    var sub = items.reduce(function (s, it) { return s + Math.round((Number(it.qty) || 0) * (Number(it.unitCents) || 0)); }, 0);
    var tax = billingType === 'full' ? (e.taxCents || 0) : 0, disc = billingType === 'full' ? (e.discountCents || 0) : 0;
    var d = new Date(); d.setDate(d.getDate() + 14);
    var due = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    var col = ctx.bizRef.collection('invoices'), ref = col.doc(), cref = ctx.bizRef.collection('counters').doc('invoice');
    var data = {
      customerId: e.customerId || '', customerName: e.customerName || '', customerEmail: e.customerEmail || '', customerPhone: e.customerPhone || '', address: e.address || '',
      estimateId: eid, estimateNumber: e.number || '', milestone: milestone, billingType: billingType, contractId: cid, auto: true,
      title: e.title || '', issueDate: today(), dueDate: due, lineItems: items, discountCents: disc, taxPct: billingType === 'full' ? (e.taxPct || 0) : 0,
      subtotalCents: sub, taxCents: tax, totalCents: sub - disc + tax, paidCents: 0, terms: plan ? 'Payment plan: ' + plan : (e.terms || ''), internalNotes: 'Created automatically when the contract was marked signed.',
      status: 'Draft', createdAt: vyro.stamp(), createdBy: ctx.user.uid, updatedAt: vyro.stamp()
    };
    await vyro.db.runTransaction(async function (tx) {
      var cs = await tx.get(cref), n = cs.exists ? cs.data().n + 1 : 1;
      tx.set(cref, { n: n }); data.number = 'INV-' + String(n).padStart(4, '0'); tx.set(ref, data);
    });
    await ctx.bizRef.collection('contracts').doc(cid).update({ invoiceId: ref.id, autoInvoiceAt: vyro.stamp() });
    return { id: ref.id, number: data.number };
  }

  // Runs when a contract is marked signed. Records the dates and makes the draft invoice. Safe to call twice.
  async function afterSigned(ctx, cid) {
    var cs = await ctx.bizRef.collection('contracts').doc(cid).get();
    if (!cs.exists) return null;
    var c = cs.data();
    if (c.status !== 'Signed' || c.invoiceId || c.autoInvoiceAt) return null;
    var out = { dates: true };
    try {   // dates for tracking: the contract's signed date goes on the job, and the job's schedule shows on the calendar
      var jr = ctx.bizRef.collection('jobs').doc(c.jobId), js = await jr.get();
      if (js.exists) { var u = { contractSignedOn: c.signedOn || today(), updatedAt: vyro.stamp() }; if (js.data().status === 'Not Started' && !js.data().startDate) u.status = 'Not Started'; await jr.update(u); }
    } catch (x) { out.dates = false; }
    try { out.invoice = await makeInvoice(ctx, c, cid); } catch (x) { out.error = String((x && x.message) || x); }
    return out;
  }

  // Dashboard sweep. Returns { notes: [ {text, href} ] } for the "What just happened" card.
  async function sync(ctx) {
    var notes = [];
    if (!(ctx.role === 'owner' || ctx.role === 'gm' || ctx.role === 'supervisor')) return { notes: notes };
    try {
      var es = await ctx.bizRef.collection('estimates').get(), ests = [];
      es.forEach(function (d) { var x = d.data(); x.id = d.id; ests.push(x); });
      for (var i = 0; i < ests.length; i++) {
        var e = ests[i];
        if (e.status === 'Sent' && e.portalShared) {
          var ds = null;
          try { ds = await vyro.db.collection('portals').doc(e.id).collection('documents').doc(e.id).get(); } catch (x) { ds = null; }
          if (ds && ds.exists) {
            var d = ds.data();
            if (d.approvedAt) { await approveFromPortal(ctx, e, d); notes.push({ text: (e.customerName || 'Your customer') + ' approved estimate ' + (e.number || '') + ' in the portal.', href: 'estimate.html?id=' + e.id }); }
            else if (d.response && ['revise', 'declined'].indexOf(d.response) > -1 && e.portalAnswer !== (d.response + '|' + (d.responseReason || ''))) {
              await ctx.bizRef.collection('estimates').doc(e.id).update({ portalAnswer: d.response + '|' + (d.responseReason || '') });
              notes.push({ text: (e.customerName || 'Your customer') + (d.response === 'revise' ? ' asked for changes to' : ' declined') + ' estimate ' + (e.number || '') + ': ' + (d.responseReason || ''), href: 'estimate.html?id=' + e.id });
            }
          }
        }
        if (e.status === 'Approved' && !e.contractId && !e.autoContractAt) {
          var cid = await makeContract(ctx, e);
          if (cid) notes.push({ text: 'A contract was created for estimate ' + (e.number || '') + '. Finish the blanks and share it.', href: 'contract.html?id=' + cid });
        }
      }
      var cs = await ctx.bizRef.collection('contracts').where('status', '==', 'Signed').get();
      for (var k = 0; k < cs.docs.length; k++) {
        var c = cs.docs[k].data();
        if (c.invoiceId || c.autoInvoiceAt || !(c.auto || c.autoInvoice)) continue;   // only contracts signed from now on, never old ones
        var r = await afterSigned(ctx, cs.docs[k].id);
        if (r && r.invoice) notes.push({ text: 'Contract signed. Draft invoice ' + r.invoice.number + ' was created. Check it and send it.', href: 'invoice.html?id=' + r.invoice.id });
      }
    } catch (x) { /* best effort; runs again next time */ }
    return { notes: notes };
  }

  // A reminder goes into the customer's portal as a message. Returns { ok } or { ok:false, reason }.
  async function reminderToPortal(ctx, item) {
    try {
      if (!item.portalId || !item.msg) return { ok: false, reason: 'no-portal' };
      var pr = vyro.db.collection('portals').doc(item.portalId), ps = await pr.get();
      if (!ps.exists) return { ok: false, reason: 'no-portal' };
      var text = String(item.msg.body || '').replace(/\n{3,}/g, '\n\n').slice(0, 1000);
      await pr.collection('messages').add({ from: 'contractor', text: text, by: myName(ctx), createdAt: vyro.stamp(), read: false });
      if (window.vutil && vutil.pushNotify) vutil.pushNotify(item.portalId, 'message');
      return { ok: true };
    } catch (err) { return { ok: false, reason: 'error' }; }
  }

  window.vflow = { reminderToPortal: reminderToPortal, message: message, portalLink: portalLink, estimateToPortal: estimateToPortal, invoiceToPortal: invoiceToPortal, makeContract: makeContract, afterSigned: afterSigned, sync: sync };
})();
