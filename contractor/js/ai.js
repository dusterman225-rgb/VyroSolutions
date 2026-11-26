// Vyqil Assistant for Contractor. Uses the same assistant code as the other apps (vertical/assistant.js),
// through a small adapter, so it works on Contractor's own data (jobs, invoices, estimates, customers, expenses, leads...).
// Contractor has its OWN assistant, memory, saved documents and credits (app name: "contractor").
(function () {
  window.vqContractorAI = function (ctx, host) {
    var db = firebase.firestore(), FV = firebase.firestore.FieldValue;
    function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
    var money = 'money', F = function (k, l, t, extra) { var o = { k: k, l: l, t: t }; for (var x in (extra || {})) o[x] = extra[x]; return o; };
    var EXP = ['Materials', 'Subcontractor', 'Labor', 'Equipment rental', 'Fuel and vehicle', 'Permits and fees', 'Insurance', 'Tools', 'Office and software', 'Other'];
    var kinds = {
      job: { label: 'Job', plural: 'Jobs', fields: [F('customerName', 'Customer', 'text'), F('title', 'Job', 'text'), F('status', 'Status', 'select'), F('startDate', 'Start date', 'date'), F('targetEndDate', 'Target end date', 'date'), F('contractCents', 'Contract amount', money), F('address', 'Address', 'text'), F('internalNotes', 'Notes', 'area')] },
      estimate: { label: 'Estimate', plural: 'Estimates', fields: [F('customerName', 'Customer', 'text'), F('title', 'Estimate', 'text'), F('status', 'Status', 'select'), F('validUntil', 'Valid until', 'date'), F('totalCents', 'Total', money)] },
      invoice: { label: 'Invoice', plural: 'Invoices', fields: [F('customerName', 'Customer', 'text'), F('title', 'Invoice', 'text'), F('status', 'Status', 'select'), F('issueDate', 'Issued', 'date'), F('dueDate', 'Due date', 'date'), F('balanceCents', 'Balance owed', money), F('totalCents', 'Total', money), F('paidCents', 'Paid so far', money)] },
      customer: { label: 'Customer', plural: 'Customers', scan: 1, fields: [F('name', 'Name', 'text', { req: 1 }), F('phone', 'Phone', 'text'), F('email', 'Email', 'text'), F('address', 'Address', 'text'), F('notes', 'Notes', 'area')] },
      expense: { label: 'Expense or bill', plural: 'Expenses and bills', scan: 1, fields: [F('description', 'What it was for', 'text', { req: 1 }), F('vendor', 'Vendor', 'text'), F('category', 'Category', 'select', { o: EXP }), F('amountCents', 'Amount', money, { req: 1 }), F('date', 'Date', 'date', { req: 1 }), F('status', 'Status', 'select', { o: ['Paid', 'Unpaid'] }), F('dueDate', 'Due date', 'date'), F('reference', 'Receipt or reference number', 'text'), F('notes', 'Notes', 'area')] },
      lead: { label: 'Lead', plural: 'Leads', scan: 1, fields: [F('name', 'Name', 'text', { req: 1 }), F('phone', 'Phone', 'text'), F('email', 'Email', 'text'), F('address', 'Address', 'text'), F('source', 'Source', 'text'), F('status', 'Status', 'select'), F('followUpOn', 'Follow up on', 'date'), F('jobDetails', 'Job details', 'area')] },
      contract: { label: 'Contract', plural: 'Contracts', fields: [F('title', 'Contract', 'text'), F('status', 'Status', 'select'), F('customerName', 'Customer', 'text')] },
      sub: { label: 'Subcontractor', plural: 'Subcontractors', fields: [F('name', 'Name', 'text'), F('trade', 'Trade', 'text'), F('phone', 'Phone', 'text'), F('email', 'Email', 'text')] },
      recurring: { label: 'Recurring bill', plural: 'Recurring bills', fields: [F('description', 'Bill', 'text'), F('vendor', 'Vendor', 'text'), F('amountCents', 'Amount', money), F('nextDue', 'Next due', 'date')] },
      document: { label: 'Other document (contract, agreement, form...)', plural: 'Documents', scan: 1, fields: [F('title', 'Document name', 'text', { req: 1 }), F('notes', 'Text of the document', 'area')] }
    };
    var C = { id: 'contractor', name: 'Contractor', kinds: kinds };
    var S = { biz: { id: ctx.bizId, col: '@contractor' } };
    // Only these can be created from a scanned photo; the rest of Contractor (invoices, estimates, contracts) has its own pages.
    var scanKinds = {}; Object.keys(kinds).forEach(function (k) { if (kinds[k].scan) scanKinds[k] = kinds[k]; });
    var Cscan = { id: 'contractor', name: 'Contractor', kinds: scanKinds };
    var main = host, Q = {
      S: S, db: db, FV: FV, views: {}, tools: { cents: 1 },
      byKind: function () { return []; }, get: function () { return null; }, title: function () { return ''; },
      render: function () { main.innerHTML = ''; Q.views.assistant(main); },
      toast: function (m) { var t = el('div', 'aitoast', m); document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3200); },
      modal: function (fn) {
        var bg = el('div', 'aimodal'), box = el('div', 'aibox'); bg.appendChild(box); document.body.appendChild(bg);
        function close() { bg.remove(); } bg.addEventListener('click', function (e) { if (e.target === bg) close(); }); fn(box, close);
      },
      // "Open the form" after a scan: show the filled details and save them as a new record (or a saved document).
      openForm: function (kind, rec, p) {
        var col = { customer: 'customers', expense: 'expenses', lead: 'leads' }[kind], kd = kinds[kind];
        Q.modal(function (s, close) {
          s.appendChild(el('h3', '', 'Check and save: ' + kd.label));
          var inputs = {};
          kd.fields.forEach(function (f) {
            var lab = el('label', 'aif'), v = p[f.k] == null ? '' : p[f.k]; lab.appendChild(el('span', '', f.l + (f.req ? ' *' : '')));
            var i;
            if (f.t === 'area') { i = document.createElement('textarea'); i.rows = 5; i.value = v; }
            else if (f.t === 'select' && f.o) { i = document.createElement('select'); var b = el('option', '', ''); b.value = ''; i.appendChild(b); f.o.forEach(function (o) { var op = el('option', '', o); op.value = o; i.appendChild(op); }); i.value = v; }
            else if (f.t === 'money') { i = document.createElement('input'); i.type = 'text'; i.inputMode = 'decimal'; i.value = v === '' ? '' : (v / 100).toFixed(2); }
            else { i = document.createElement('input'); i.type = f.t === 'date' ? 'date' : 'text'; i.value = v; }
            lab.appendChild(i); s.appendChild(lab); inputs[f.k] = i;
          });
          var msg = el('p', 'hint', 'Check everything against the original first. Nothing is saved until you tap Save.'); s.appendChild(msg);
          var go = el('button', 'btn', 'Save'), cn = el('button', 'btn ghost', 'Cancel'); go.type = cn.type = 'button'; go.style.marginRight = '8px'; cn.onclick = close;
          go.onclick = function () {
            var d = {}; kd.fields.forEach(function (f) {
              var v = String(inputs[f.k].value || '').trim(); if (!v) { d[f.k] = f.t === 'money' ? 0 : ''; return; }
              d[f.k] = f.t === 'money' ? Math.round(parseFloat(v.replace(/[$,\s]/g, '')) * 100) || 0 : v;
            });
            var first = kd.fields[0].k; if (!d[first]) { msg.textContent = kd.fields[0].l + ' is needed.'; msg.className = 'hint err'; return; }
            go.disabled = true; var base = db.collection('businesses').doc(ctx.bizId), ts = FV.serverTimestamp(), pr;
            if (kind === 'document') pr = base.collection('aiDocs').add({ app: 'contractor', title: d.title.slice(0, 120), body: String(d.notes || '').slice(0, 55000), kind: 'scan', period: '', by: (ctx.user.email || '').toLowerCase(), createdAt: ts });
            else {
              if (kind === 'customer') d.nameLower = d.name.toLowerCase();
              if (kind === 'expense') { if (d.status !== 'Paid') { d.status = 'Unpaid'; } else { d.paidOn = d.date; d.dueDate = ''; } d.jobId = ''; d.jobLabel = ''; d.method = d.method || ''; }
              if (kind === 'lead') { d.status = d.status || 'New'; d.source = d.source || 'Scanned document'; }
              d.createdAt = ts; d.updatedAt = ts; d.createdBy = ctx.user.uid; pr = base.collection(col).add(d);
            }
            pr.then(function () { close(); Q.toast(kind === 'document' ? 'Saved. Find it under Saved.' : 'Saved to ' + kd.plural.toLowerCase() + '.'); }, function () { go.disabled = false; msg.textContent = 'Could not save. Your role may not be allowed to add this.'; msg.className = 'hint err'; });
          };
          var bw = el('div'); bw.appendChild(go); bw.appendChild(cn); s.appendChild(bw);
        });
      }
    };
    window.Q = Q; window.VQ_APP = C;
    // the scan screens read their choices from VQ_APP.kinds, so give them only the kinds that can be saved from a photo,
    // while chat and reports use the full list (the worker reads the fixed Contractor collections itself).
    var realKinds = kinds; C.kinds = realKinds; C.scanKinds = scanKinds;
    var css = document.createElement('style'); css.textContent = '.aitoast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#0C1117;color:#C9D1D9;border:1px solid rgba(75,156,211,.5);box-shadow:0 0 14px rgba(75,156,211,.45);padding:10px 16px;border-radius:12px;z-index:99;font-size:.9rem}' +
      '.aimodal{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:80;display:flex;align-items:flex-end;justify-content:center;overflow-y:auto}' +
      '.aibox{background:#0a0f15;color:#C9D1D9;border:1px solid rgba(201,209,217,.14);width:100%;max-width:560px;max-height:92dvh;overflow-y:auto;border-radius:18px 18px 0 0;padding:16px 16px calc(18px + env(safe-area-inset-bottom));box-sizing:border-box;box-shadow:0 -10px 40px rgba(0,0,0,.6)}' +
      '.aibox h3{margin:0 0 10px;color:#fff;letter-spacing:.06em;text-transform:uppercase;font-size:.95rem}' +
      '.aif{display:block;margin:12px 0 4px}.aif span{display:block;margin-bottom:4px;color:#8B96A3;font-size:.72rem;font-weight:600;letter-spacing:.12em;text-transform:uppercase}' +
      '.aif input,.aif select,.aif textarea{width:100%;box-sizing:border-box;margin:0;background:rgba(5,7,10,.7);border:1px solid rgba(201,209,217,.14);color:#fff;border-radius:12px;padding:12px;font:16px system-ui,sans-serif;min-height:44px;outline:none;color-scheme:dark}' +
      '.aif textarea{min-height:80px;resize:vertical}.aif input:focus,.aif select:focus,.aif textarea:focus{border-color:#4B9CD3;box-shadow:0 0 14px rgba(75,156,211,.45)}' +
      '.aibox .btn{margin-top:10px}.hint{color:#8B96A3;font-size:.84rem}.hint.err{color:#ff8a8a}';
    document.head.appendChild(css);
    var s = document.createElement('script'); s.src = '../vertical/assistant.js';
    s.onload = function () { var n = 0, t = setInterval(function () { if (Q.views.assistant) { clearInterval(t); Q.render(); } else if (++n > 60) { clearInterval(t); host.textContent = 'Could not start the Assistant. Please refresh.'; } }, 50); };
    s.onerror = function () { host.textContent = 'Could not load the Assistant. Please refresh.'; };
    document.head.appendChild(s);
    window.vqScan = function () { if (Q.scanFlow) Q.scanFlow(''); };
  };
})();
