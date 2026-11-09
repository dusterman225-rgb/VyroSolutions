// VyqilAssistant Money extras: bank CSV import, debt payoff plans, subscriptions view, month-over-month comparison.
// Everything here runs on the phone. A bank file is read in the browser and is never uploaded anywhere.
(function () {
  var VA = window.VA, esc = VA.esc, S = VA.S, MX = VA.mx = {};
  function m(c) { return VA.money(c); }

  // ---------- subscriptions ----------
  function perMonth(b) { var a = b.amount || 0; return b.repeat === 'weekly' ? a * 52 / 12 : b.repeat === 'yearly' ? a / 12 : b.repeat === 'once' ? 0 : a; }
  MX.subsHtml = function () {
    var t = VA.today(), all = S.data.bills.filter(function (b) { return !b.paid && (b.category === 'Subscriptions' || b.sub); }).sort(function (a, b) { return perMonth(b) - perMonth(a); });
    var mon = 0; all.forEach(function (b) { mon += perMonth(b); });
    var h = '<div class="stat"><div><b>' + m(Math.round(mon)) + '</b><span>per month</span></div><div><b>' + m(Math.round(mon * 12)) + '</b><span>per year</span></div><div><b>' + all.length + '</b><span>subscriptions</span></div></div>';
    h += '<div class="btns"><button class="btn" data-a="addSub" type="button">+ Add subscription</button></div>';
    h += '<div class="card">' + (all.length ? all.map(function (b) {
      var trial = b.trialEnds && VA.diff(t, b.trialEnds) >= 0 && VA.diff(t, b.trialEnds) <= 14;
      return '<div class="row" data-a="editBill" data-id="' + esc(b.id) + '" style="cursor:pointer"><div class="m"><b>' + esc(b.name) + '</b><span>' + esc(b.repeat === 'yearly' ? 'Yearly' : b.repeat === 'weekly' ? 'Weekly' : 'Monthly') + ' · next ' + esc(VA.fmtShort(b.dueDate)) + (trial ? ' <span class="pill warn">trial ends ' + esc(VA.fmtShort(b.trialEnds)) + '</span>' : '') + '</span></div><span class="amt">' + m(b.amount) + '</span></div>';
    }).join('') : '<div class="empty">No subscriptions yet. Add streaming, apps and memberships to see what they cost per year.</div>') + '</div>';
    if (all.length) h += '<div class="hint">Tip: the biggest ones are at the top. Cancel anything you have not used in a month.</div>';
    return h;
  };
  VA.act.addSub = function () { VA.openForm('bill', null, { category: 'Subscriptions', sub: true }); };

  // ---------- month over month ----------
  MX.compareHtml = function (ym) {
    var prev = VA.addMonths(ym + '-01', -1).slice(0, 7);
    function sums(k) { var by = {}, tot = 0; S.data.txns.forEach(function (x) { if ((x.date || '').slice(0, 7) === k && x.type !== 'income') { var c = x.category || 'Other'; by[c] = (by[c] || 0) + (x.amount || 0); tot += x.amount || 0; } }); return { by: by, tot: tot }; }
    var a = sums(ym), b = sums(prev), cats = {}; Object.keys(a.by).concat(Object.keys(b.by)).forEach(function (c) { cats[c] = 1; });
    var list = Object.keys(cats).map(function (c) { return { c: c, now: a.by[c] || 0, was: b.by[c] || 0 }; }).filter(function (x) { return x.now || x.was; }).sort(function (x, y) { return Math.abs(y.now - y.was) - Math.abs(x.now - x.was); });
    if (!list.length || !b.tot) return '';
    var d = a.tot - b.tot, h = '<h2>Compared to last month<small>' + VA.MON[+prev.slice(5) - 1] + '</small></h2><div class="card"><div class="row" style="border:0"><div class="m"><b>' + m(a.tot) + ' vs ' + m(b.tot) + '</b><span>' + (d > 0 ? 'Up ' + m(d) : d < 0 ? 'Down ' + m(-d) : 'The same') + ' overall</span></div></div>';
    list.slice(0, 8).forEach(function (x) { var dd = x.now - x.was; h += '<div class="row"><div class="m"><b>' + esc(x.c) + '</b><span>' + m(x.now) + ' now, ' + m(x.was) + ' before</span></div><span class="pill ' + (dd > 0 ? 'warn' : dd < 0 ? 'ok' : '') + '">' + (dd > 0 ? '+' : dd < 0 ? '-' : '') + m(Math.abs(dd)) + '</span></div>'; });
    return h + '</div>';
  };

  // ---------- debt payoff ----------
  // Simulates paying every debt's minimum, with all extra money going to one debt at a time.
  // order: 'snow' = smallest balance first, 'aval' = highest interest rate first. Works in cents.
  MX.simulate = function (debts, extra, order) {
    var ds = debts.map(function (d) { return { id: d.id, name: d.name, bal: d.balance || 0, apr: d.apr || 0, min: d.minPay || 0, paidOff: 0 }; }), months = 0, interest = 0, i;
    var seq = ds.slice().sort(function (a, b) { return order === 'aval' ? b.apr - a.apr || a.bal - b.bal : a.bal - b.bal || b.apr - a.apr; }), orderOut = [];
    while (months < 600) {
      var open = ds.filter(function (d) { return d.bal > 0; }); if (!open.length) break; months++;
      var pool = extra;
      open.forEach(function (d) { var int = Math.round(d.bal * d.apr / 1200); d.bal += int; interest += int; });
      open.forEach(function (d) { var pay = Math.min(d.bal, d.min); d.bal -= pay; if (d.bal === 0) pool += d.min - pay; });
      // leftover and freed-up minimums roll onto the first debt in the chosen order that is still open
      for (i = 0; i < seq.length && pool > 0; i++) { var d = seq[i]; if (d.bal > 0) { var p = Math.min(d.bal, pool); d.bal -= p; pool -= p; } }
      ds.forEach(function (d) { if (d.bal === 0 && !d.paidOff) { d.paidOff = months; orderOut.push({ name: d.name, month: months }); } });
      if (months >= 600) break;
    }
    var left = ds.reduce(function (s, d) { return s + d.bal; }, 0);
    return { months: months, interest: interest, never: left > 0, order: orderOut };
  };
  function extraNow() { var v = 0; try { v = parseInt(localStorage.getItem('va_debt_extra') || '0', 10) || 0; } catch (e) { /* ignore */ } return v; }
  MX.debtHtml = function () {
    var ds = S.data.debts || [], extra = extraNow(), tot = 0, mins = 0; ds.forEach(function (d) { tot += d.balance || 0; mins += d.minPay || 0; });
    var h = '<div class="stat"><div><b>' + m(tot) + '</b><span>total owed</span></div><div><b>' + m(mins) + '</b><span>minimums per month</span></div></div>';
    h += '<div class="btns"><button class="btn" data-a="addDebt" type="button">+ Add debt</button></div>';
    h += '<div class="card">' + (ds.length ? ds.map(function (d) { return '<div class="row" data-a="editDebt" data-id="' + esc(d.id) + '" style="cursor:pointer"><div class="m"><b>' + esc(d.name) + '</b><span>' + (d.apr || 0) + '% interest · minimum ' + m(d.minPay) + '</span></div><span class="amt">' + m(d.balance) + '</span></div>'; }).join('') : '<div class="empty">Add each credit card or loan you owe. You will see how fast you could be debt free.</div>') + '</div>';
    if (!ds.length) return h;
    h += '<label class="f">Extra you can pay each month on top of the minimums ($)</label><input id="debtExtra" type="number" min="0" step="10" inputmode="numeric" value="' + (extra ? Math.round(extra / 100) : '') + '" placeholder="0">';
    var A = MX.simulate(ds, extra, 'aval'), B = MX.simulate(ds, extra, 'snow'), base = MX.simulate(ds, 0, 'aval');
    function when(n) { return VA.MON[(new Date().getMonth() + n) % 12] + ' ' + (new Date().getFullYear() + Math.floor((new Date().getMonth() + n) / 12)); }
    function plan(title, note, r) {
      if (r.never) return '<div class="card"><b>' + title + '</b><div class="hint">' + note + '</div><div class="hint" style="color:#ff8a8a">With these payments, at least one debt never gets paid off because the payment is smaller than the interest. Add more each month.</div></div>';
      return '<div class="card"><b>' + title + '</b><div class="hint">' + note + '</div><div class="stat" style="margin-top:8px"><div><b>' + Math.floor(r.months / 12) + 'y ' + (r.months % 12) + 'm</b><span>until debt free (' + esc(when(r.months)) + ')</span></div><div><b>' + m(r.interest) + '</b><span>interest paid</span></div></div><div class="hint" style="margin-top:8px">Paid off in this order: ' + r.order.map(function (o) { return esc(o.name) + ' (' + o.month + ' mo)'; }).join(', ') + '</div></div>';
    }
    h += plan('Avalanche: highest interest first', 'Pays the least interest overall. Best for your wallet.', A) + plan('Snowball: smallest balance first', 'Clears accounts sooner, which keeps many people going.', B);
    if (extra && !A.never && !base.never) h += '<div class="hint">Paying ' + m(extra) + ' extra each month saves about ' + m(base.interest - A.interest) + ' in interest and ' + (base.months - A.months) + ' months with the avalanche plan.</div>';
    h += '<div class="hint">These are estimates from the numbers you entered. Interest is worked out monthly. Your lender’s figures win. This is not financial advice.</div>';
    h += '<div class="btns"><button class="btn ghost" data-a="askDebt" type="button">Ask the assistant about my debts</button></div>';
    return h;
  };
  VA.act.addDebt = function () { VA.openForm('debt'); };
  VA.act.editDebt = function (t, id) { VA.openForm('debt', VA.get('debts', id)); };
  VA.act.askDebt = function () { VA.go('ask'); VA.ai.send('Look at my debts. Explain in simple words what order I should pay them in and what I should do this month.'); };
  MX.afterRender = function (root) {
    var i = root.querySelector('#debtExtra'); if (!i) return;
    i.onchange = function () { var c = VA.cents(i.value); try { localStorage.setItem('va_debt_extra', String(c > 0 ? c : 0)); } catch (e) { /* ignore */ } VA.render(); };
  };

  // ---------- bank CSV import ----------
  function parseCSV(text) {
    var rows = [], row = [], f = '', q = false, i, c; text = String(text).replace(/^﻿/, '');
    for (i = 0; i < text.length; i++) {
      c = text.charAt(i);
      if (q) { if (c === '"') { if (text.charAt(i + 1) === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text.charAt(i + 1) === '\n') i++; row.push(f); f = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = []; }
      else f += c;
    }
    row.push(f); if (row.length > 1 || row[0] !== '') rows.push(row); return rows;
  }
  function pDate(s, dmy) {
    s = String(s || '').trim(); var a;
    if ((a = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return a[1] + '-' + ('0' + a[2]).slice(-2) + '-' + ('0' + a[3]).slice(-2);
    if ((a = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/.exec(s))) { var x = +a[1], y = +a[2], yr = +a[3]; if (yr < 100) yr += 2000; var mo = dmy ? y : x, dd = dmy ? x : y; if (mo < 1 || mo > 12 || dd < 1 || dd > 31) return ''; return yr + '-' + ('0' + mo).slice(-2) + '-' + ('0' + dd).slice(-2); }
    return '';
  }
  function pMoney(s) { var t = String(s == null ? '' : s).trim(); if (!t) return null; var neg = /^\(.*\)$/.test(t) || /^-/.test(t) || /-$/.test(t) || /\bDR\b/i.test(t); t = t.replace(/[^0-9.]/g, ''); if (!t || isNaN(+t)) return null; var c = Math.round(parseFloat(t) * 100); return neg ? -c : c; }
  var KEYS = [['Groceries', /grocer|market|kroger|safeway|trader joe|whole foods|aldi|costco|publix|albertsons|food lion|wegmans/i], ['Dining', /restaurant|cafe|coffee|starbucks|mcdonald|pizza|burger|taco|doordash|uber eats|grubhub|chipotle|diner|bar &|grill/i], ['Gas', /shell|chevron|exxon|mobil|bp |arco|76 |gas station|fuel|sunoco|valero/i], ['Bills', /electric|water|utility|insurance|verizon|at&t|t-mobile|comcast|xfinity|spectrum|internet|geico|state farm|progressive/i], ['Health', /pharmacy|cvs|walgreens|clinic|dental|dentist|medical|doctor|hospital/i], ['Fun', /netflix|spotify|hulu|disney|cinema|theat|steam|game|movie|ticket/i], ['Shopping', /amazon|target|walmart|best buy|ebay|etsy|home depot|lowe|ikea|nike/i], ['Home', /rent|mortgage|hoa|plumb|hardware/i], ['Pay', /payroll|direct dep|salary|paycheck|deposit from employer/i]];
  function guess(desc) { for (var i = 0; i < KEYS.length; i++) if (KEYS[i][1].test(desc)) return KEYS[i][0]; return 'Other'; }
  MX.importCsv = function () {
    VA.modal('<h3>Import bank file</h3><p class="hint">Download a CSV file of transactions from your bank’s website or app, then pick it here. The file is read on your phone and is not uploaded. Entries already in VyqilAssistant are skipped, so importing the same file twice is safe.</p><input id="impFile" type="file" accept=".csv,text/csv,text/plain"><div id="impBody"></div><div class="btns"><button class="btn ghost" id="impX" type="button">Close</button></div>', function (s, close) {
      s.querySelector('#impX').onclick = close; var body = s.querySelector('#impBody');
      s.querySelector('#impFile').onchange = function (ev) {
        var f = ev.target.files[0]; if (!f) return; if (f.size > 3000000) { body.innerHTML = '<p class="hint" style="color:#ff8a8a">That file is too big. Export a shorter date range.</p>'; return; }
        var rd = new FileReader(); rd.onload = function () { try { step2(String(rd.result)); } catch (e) { body.innerHTML = '<p class="hint" style="color:#ff8a8a">Could not read that file.</p>'; } }; rd.readAsText(f);
      };
      function step2(text) {
        var rows = parseCSV(text); if (rows.length < 2) { body.innerHTML = '<p class="hint" style="color:#ff8a8a">That file has no rows.</p>'; return; }
        var hi = 0; for (var r = 0; r < Math.min(8, rows.length); r++) { if (rows[r].filter(function (c) { return /date|amount|description|debit|credit/i.test(c); }).length >= 2) { hi = r; break; } }
        var head = rows[hi], data = rows.slice(hi + 1).filter(function (x) { return x.length >= 2; });
        function find(re) { for (var i = 0; i < head.length; i++) if (re.test(head[i])) return i; return -1; }
        var cDate = find(/date/i), cDesc = find(/desc|memo|payee|name|detail/i), cAmt = find(/^amount$|amount/i), cDeb = find(/debit|withdraw/i), cCred = find(/credit|deposit/i);
        function sel(id, idx, none) { return '<select id="' + id + '">' + (none ? '<option value="-1">(none)</option>' : '') + head.map(function (h, i) { return '<option value="' + i + '"' + (i === idx ? ' selected' : '') + '>' + esc(h || ('Column ' + (i + 1))) + '</option>'; }).join('') + '</select>'; }
        body.innerHTML = '<p class="hint">' + data.length + ' rows found. Check that these columns are right.</p><label class="f">Date column</label>' + sel('cDate', cDate) + '<label class="f">Description column</label>' + sel('cDesc', cDesc) + '<label class="f">Amount column</label>' + sel('cAmt', cAmt, 1) + '<label class="f">If your bank uses separate Debit and Credit columns</label>' + sel('cDeb', cDeb, 1) + sel('cCred', cCred, 1) +
          '<label class="f">In the amount column, money spent is</label><select id="sign"><option value="neg">negative (-12.50)</option><option value="pos">positive (12.50)</option></select><label class="f">Dates are written as</label><select id="dfmt"><option value="mdy">Month/Day/Year (US)</option><option value="dmy">Day/Month/Year</option></select><div id="impPrev"></div><div class="btns"><button class="btn" id="impGo" type="button">Import</button></div>';
        function build() {
          var ci = { d: +body.querySelector('#cDate').value, s: +body.querySelector('#cDesc').value, a: +body.querySelector('#cAmt').value, db: +body.querySelector('#cDeb').value, cr: +body.querySelector('#cCred').value }, spendNeg = body.querySelector('#sign').value === 'neg', dmy = body.querySelector('#dfmt').value === 'dmy';
          var out = [], bad = 0; data.forEach(function (x) {
            var date = pDate(x[ci.d], dmy), desc = String(x[ci.s] || '').trim().slice(0, 80), cents = null, type = 'expense';
            if (ci.db >= 0 || ci.cr >= 0) { var dv = ci.db >= 0 ? pMoney(x[ci.db]) : null, cv = ci.cr >= 0 ? pMoney(x[ci.cr]) : null; if (dv) { cents = Math.abs(dv); type = 'expense'; } else if (cv) { cents = Math.abs(cv); type = 'income'; } }
            else if (ci.a >= 0) { var v = pMoney(x[ci.a]); if (v != null) { var spent = spendNeg ? v < 0 : v > 0; type = spent ? 'expense' : 'income'; cents = Math.abs(v); } }
            if (!date || !cents || cents > 100000000) { bad++; return; }
            var cat = type === 'income' ? 'Pay' : guess(desc); out.push({ date: date, note: desc, amount: cents, type: type, category: cat });
          }); return { out: out, bad: bad };
        }
        function prev() {
          var b = build(), ex = {}; S.data.txns.forEach(function (x) { ex[x.date + '|' + x.amount + '|' + String(x.note || '').toLowerCase()] = 1; });
          var fresh = [], seen = {}; b.out.forEach(function (x) { var k = x.date + '|' + x.amount + '|' + x.note.toLowerCase(); if (ex[k]) return; fresh.push(x); }); var dup = b.out.length - fresh.length;
          body.querySelector('#impPrev').innerHTML = '<div class="card"><b>' + fresh.length + ' new entries</b><div class="hint">' + dup + ' already in the app will be skipped' + (b.bad ? ', ' + b.bad + ' rows could not be read' : '') + '.</div>' + fresh.slice(0, 4).map(function (x) { return '<div class="row"><div class="m"><b>' + esc(x.note || '(no description)') + '</b><span>' + esc(x.date) + ' · ' + esc(x.category) + '</span></div><span class="amt">' + (x.type === 'income' ? '+' : '') + m(x.amount) + '</span></div>'; }).join('') + '</div><p class="hint">If the first entries look reversed (spending shown as money received), change the setting above.</p>';
          return fresh;
        }
        var cur = prev(); body.querySelectorAll('select').forEach(function (e) { e.onchange = function () { cur = prev(); }; });
        body.querySelector('#impGo').onclick = function () {
          if (!cur.length) { VA.toast('Nothing new to import.'); return; } if (cur.length > 2000) { VA.toast('That is a lot at once. Export a shorter date range (under 2,000 rows).'); return; }
          var btn = body.querySelector('#impGo'); btn.disabled = true; btn.textContent = 'Importing...';
          var db = VA.db(), i = 0;
          (function next() {
            if (i >= cur.length) { close(); VA.toast('Imported ' + cur.length + ' entries.'); return; }
            var b = db.batch(), n = Math.min(i + 400, cur.length);
            for (; i < n; i++) { var x = cur[i], ref = VA.col('txns').doc(); b.set(ref, { type: x.type, amount: x.amount, date: x.date, category: x.category, note: x.note, imported: true, updatedAt: firebase.firestore.FieldValue.serverTimestamp(), updatedBy: S.user.uid }); }
            b.commit().then(next).catch(function (e) { btn.disabled = false; btn.textContent = 'Import'; VA.toast('Stopped part way (' + (e && e.code || 'error') + '). Run the import again to finish; entries already added are skipped.'); });
          })();
        };
      }
    });
  };
  VA.act.importCsv = function () { MX.importCsv(); };
  MX._parseCSV = parseCSV; MX._pMoney = pMoney; MX._pDate = pDate;
})();
