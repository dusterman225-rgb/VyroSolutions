// Contracts: fill a template from a job, and share/unshare it in the customer's portal.
(function () {
  function longDate(s) {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
    var p = s.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function first() { for (var i = 0; i < arguments.length; i++) { var v = arguments[i]; if (v !== undefined && v !== null && String(v).trim() !== '') return v; } return ''; }
  var ROLE_LABEL = { owner: 'Owner', gm: 'General manager', supervisor: 'Manager', employee: 'Team member' };

  // Gathers everything Vyro already knows and returns the {{placeholder}} values. Nothing here is typed by hand.
  async function values(ctx, jobId) {
    var js = await ctx.bizRef.collection('jobs').doc(jobId).get();
    if (!js.exists) throw { code: 'vyro/no-job' };
    var job = js.data(), cust = {}, est = {}, b = ctx.biz || {}, me = ctx.me || {};
    if (job.customerId) { try { var cs = await ctx.bizRef.collection('customers').doc(job.customerId).get(); if (cs.exists) cust = cs.data(); } catch (e) { /* optional */ } }
    var estId = job.estimateId || jobId;
    try { var es = await ctx.bizRef.collection('estimates').doc(estId).get(); if (es.exists) est = es.data(); } catch (e) { /* optional */ }
    if (!cust.name && (job.customerName || est.customerName) && !job.customerId && est.customerId) {
      try { var c2 = await ctx.bizRef.collection('customers').doc(est.customerId).get(); if (c2.exists) cust = c2.data(); } catch (e) { /* optional */ }
    }
    var scope = (est.lineItems || []).map(function (it) {
      return '  - ' + (it.description || '') + ' (qty ' + it.qty + ', ' + vutil.fmt(Math.round(it.qty * it.unitCents)) + ')';
    }).join('\n');
    var total = first(job.contractCents, est.totalCents) || 0;
    var depPct = first(job.depositPct, est.depositPct) || 0;
    var dep = depPct ? Math.round(total * depPct / 100) : 0;
    var paidSum = null, invNums = [];
    try {
      var iv = await ctx.bizRef.collection('invoices').where('estimateId', '==', estId).get();
      paidSum = 0;
      iv.forEach(function (d) { var x = d.data(); if (x.status !== 'Voided') { paidSum += x.paidCents || 0; if (x.number) invNums.push(x.number); } });
      invNums.sort();
    } catch (e) { paidSum = null; }
    var myName = first(me.name, vyro.who && vyro.who(ctx), ctx.user && ctx.user.displayName);
    return { job: job, depositCents: dep, map: {
      paid_to_date: paidSum === null ? '' : vutil.fmt(paidSum),
      balance_due: paidSum === null ? '' : vutil.fmt(Math.max(0, total - paidSum)),
      contractor_name: myName, contractor_title: first(me.title, ROLE_LABEL[ctx.role]),
      contract_date: longDate(vutil.todayStr()),
      estimate_number: first(job.estimateNumber, est.number),
      invoice_number: invNums.length ? invNums[invNums.length - 1] : '', invoice_numbers: invNums.join(', '),
      business_name: b.name, business_address: first(b.address, b.businessAddress),
      business_phone: first(b.phone, me.phone), business_email: first(b.email, me.email, ctx.user && ctx.user.email),
      license_number: first(b.licenseNumber, b.license),
      customer_name: first(job.customerName, est.customerName, cust.name),
      customer_address: first(cust.address, est.address, job.address),
      customer_phone: first(job.customerPhone, cust.phone, est.customerPhone), customer_email: first(job.customerEmail, cust.email, est.customerEmail),
      job_address: first(job.address, est.address, cust.address), project_title: first(job.title, est.title),
      scope: scope, contract_total: total ? vutil.fmt(total) : '',
      deposit_amount: dep ? vutil.fmt(dep) : '',
      start_date: longDate(job.startDate), target_end_date: longDate(job.targetEndDate)
    } };
  }

  async function fill(ctx, jobId, templateBody) {
    var v = await values(ctx, jobId), job = v.job, map = v.map;
    // Templates saved before this change: fill the contractor's printed name and title in too.
    if (map.contractor_name && templateBody.indexOf('{{contractor_name}}') < 0) {
      templateBody = templateBody
        .replace('Contractor: {{business_name}},', 'Contractor: {{business_name}}, represented by {{contractor_name}}, {{contractor_title}},')
        .replace(/Printed name and title: _+/, 'Printed name and title: {{contractor_name}}, {{contractor_title}}');
    }
    var text = templateBody.replace(/\{\{(\w+)\}\}/g, function (m, k) {
      var x = map[k]; if (k === 'deposit_amount' && !String(x || '').trim()) return '[down payment amount]';
      return (x !== undefined && x !== null && String(x).trim()) ? String(x) : '[' + k.replace(/_/g, ' ') + ']';
    });
    var cap = Math.min(100000, Math.round((job.contractCents || 0) * 0.10));
    return { text: text, job: job, depositCents: v.depositCents, californiaCapCents: cap };
  }

  // Fills any [blank] in an existing contract from current data. Anything Vyro does not know stays in brackets.
  async function refill(ctx, jobId, body) {
    var v = await values(ctx, jobId), n = 0;
    var text = String(body).replace(/\[([a-z][a-z ]*)\]/g, function (m, k) {
      var key = k.replace(/ /g, '_'), x = v.map[key === 'down_payment_amount' ? 'deposit_amount' : key];
      if (x !== undefined && x !== null && String(x).trim()) { n++; return String(x); } return m;
    });
    return { text: text, filled: n, left: blanks(text) };
  }

  function blanks(text) { return (text.match(/\[[^\]]+\]/g) || []).length; }

  async function share(ctx, contractId, c) {
    var pref = vyro.db.collection('portals').doc(c.jobId);
    await pref.collection('documents').doc(contractId).set({
      title: c.title || 'Contract', body: c.body, businessName: ctx.biz.name || '', sharedAt: vyro.stamp()
    });
  }
  async function unshare(contractId, jobId) {
    try { await vyro.db.collection('portals').doc(jobId).collection('documents').doc(contractId).delete(); } catch (e) { /* may not exist */ }
  }

  window.vcontract = { fill: fill, refill: refill, blanks: blanks, share: share, unshare: unshare, longDate: longDate };
})();
