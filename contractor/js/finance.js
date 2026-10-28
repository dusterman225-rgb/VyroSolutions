// Shared finance calculations for Vyro Business.
// Cash basis: income = payments actually received, expenses = bills actually paid.
(function () {
  // ---- Vyro's own fees (change these when pricing is decided) ----
  var VYRO_MONTHLY_FEE_CENTS = 500;   // Vyro subscription. Free during launch, so $0 for now.
  var VYRO_TX_FEE_PCT = 2;          // Pay with Vyro fee, paid by the receiving business (not live yet).

  // Suggested IRS Schedule C lines (sole proprietor / single-member LLC). Not tax advice.
  var SCHED_C = {
    'Materials': 'Line 22 Supplies (or Part III cost of goods sold)',
    'Subcontractor': 'Line 11 Contract labor',
    'Labor': 'Line 26 Wages (or Line 11 Contract labor)',
    'Equipment rental': 'Line 20a Rent or lease (vehicles, machinery, equipment)',
    'Fuel and vehicle': 'Line 9 Car and truck expenses',
    'Permits and fees': 'Line 23 Taxes and licenses',
    'Insurance': 'Line 15 Insurance',
    'Tools': 'Line 22 Supplies (large tools may be Line 13 depreciation)',
    'Office and software': 'Line 18 Office expense',
    'Other': 'Line 27a Other expenses',
    'Vyro fees': 'Line 27a Other expenses'
  };

  var PERIODS = [['lastMonth', 'Last month'], ['thisMonth', 'This month'], ['thisYear', 'This year so far'],
                 ['lastYear', 'Last year'], ['all', 'Since joining Vyro']];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function money(c) { return (c < 0 ? '-' : '') + vutil.fmt(Math.abs(c)); }

  async function load(ctx) {
    var biz = ctx.bizRef;
    var res = await Promise.all([biz.collection('invoices').get(), biz.collection('expenses').get()]);
    var invoices = res[0].docs.map(function (d) { var x = d.data(); x.id = d.id; return x; });
    var expenses = res[1].docs.map(function (d) { var x = d.data(); x.id = d.id; return x; });
    var payments = [];
    await Promise.all(invoices.filter(function (i) { return (i.paidCents || 0) > 0; }).map(async function (i) {
      var ps = await biz.collection('invoices').doc(i.id).collection('payments').get();
      ps.forEach(function (d) {
        var p = d.data(); p.id = d.id;
        p.invoiceNumber = i.number || ''; p.customerName = i.customerName || ''; payments.push(p);
      });
    }));
    var joined = ctx.biz.createdAt && ctx.biz.createdAt.toDate ? ymd(ctx.biz.createdAt.toDate()) : ymd(new Date());
    return { biz: ctx.biz, invoices: invoices, expenses: expenses, payments: payments, joined: joined };
  }

  function range(key, joined) {
    var now = new Date(), y = now.getFullYear(), m = now.getMonth(), today = ymd(now), from, to, label;
    if (key === 'thisMonth') { from = ymd(new Date(y, m, 1)); to = today; label = now.toLocaleString('en-US', { month: 'long', year: 'numeric' }) + ' (so far)'; }
    else if (key === 'thisYear') { from = y + '-01-01'; to = today; label = y + ' (so far)'; }
    else if (key === 'lastYear') { from = (y - 1) + '-01-01'; to = (y - 1) + '-12-31'; label = String(y - 1); }
    else if (key === 'all') { from = '0000-01-01'; to = today; label = 'Since joining Vyro (' + joined + ')'; }
    else { key = 'lastMonth'; var lm = new Date(y, m - 1, 1); from = ymd(lm); to = ymd(new Date(y, m, 0)); label = lm.toLocaleString('en-US', { month: 'long', year: 'numeric' }); }
    return { key: key, from: from, to: to, label: label, today: today };
  }

  function monthsActive(from, to, joined) {
    var start = from < joined ? joined : from;
    if (start > to) return 0;
    var sm = +start.slice(0, 4) * 12 + +start.slice(5, 7), em = +to.slice(0, 4) * 12 + +to.slice(5, 7);
    return em - sm + 1;
  }

  function compute(data, key) {
    var r = range(key, data.joined);
    function inR(d) { return !!d && d >= r.from && d <= r.to; }

    var income = 0, byMethod = {}, vyroGross = 0, vyroFees = 0, vyroCount = 0, ledger = [];
    data.payments.forEach(function (p) {
      if (p.reversed || !inR(p.receivedOn)) return;
      income += p.amountCents || 0;
      var m = p.method || 'Other'; byMethod[m] = (byMethod[m] || 0) + (p.amountCents || 0);
      var isVyro = p.source === 'vyro';
      if (isVyro) { vyroGross += p.amountCents || 0; vyroFees += p.feeCents || 0; vyroCount++; }
      ledger.push({ date: p.receivedOn, type: 'Income', desc: (p.customerName || 'Customer') + ' payment', cat: m, ref: p.invoiceNumber, cents: p.amountCents || 0, status: isVyro ? 'Pay with Vyro' : 'Recorded' });
    });

    var byCat = {}, spent = 0, subs = {};
    data.expenses.forEach(function (x) {
      if (x.status !== 'Paid') return;
      var d = x.paidOn || x.date;
      if (!inR(d)) return;
      var c = x.category || 'Other';
      byCat[c] = (byCat[c] || 0) + (x.amountCents || 0); spent += x.amountCents || 0;
      if (c === 'Subcontractor') {
        var k = (x.vendor || '(no vendor name)') + '|' + d.slice(0, 4);
        subs[k] = (subs[k] || 0) + (x.amountCents || 0);
      }
      ledger.push({ date: d, type: 'Expense', desc: (x.description || '') + (x.vendor ? ' - ' + x.vendor : ''), cat: c, ref: x.jobLabel || 'Overhead', cents: -(x.amountCents || 0), status: 'Paid' });
    });

    var months = monthsActive(r.from, r.to, data.joined);
    var vyroSub = months * VYRO_MONTHLY_FEE_CENTS;
    if (vyroSub) ledger.push({ date: r.to, type: 'Expense', desc: 'Vyro subscription (' + months + ' mo)', cat: 'Vyro fees', ref: 'Overhead', cents: -vyroSub, status: 'Charged' });
    if (vyroFees) ledger.push({ date: r.to, type: 'Expense', desc: 'Pay with Vyro fees (' + VYRO_TX_FEE_PCT + '%)', cat: 'Vyro fees', ref: 'Overhead', cents: -vyroFees, status: 'Charged' });

    var cats = Object.keys(byCat).map(function (c) { return { cat: c, cents: byCat[c], line: SCHED_C[c] || SCHED_C.Other }; });
    if (vyroSub + vyroFees) cats.push({ cat: 'Vyro fees', cents: vyroSub + vyroFees, line: SCHED_C['Vyro fees'] });
    cats.sort(function (a, b) { return b.cents - a.cents; });

    var totalCosts = spent + vyroSub + vyroFees, profit = income - totalCosts;
    var billed = 0, taxBilled = 0, owed = 0, billsOwed = 0;
    data.invoices.forEach(function (i) {
      if (i.status !== 'Draft' && i.status !== 'Voided' && inR(i.issueDate)) { billed += i.totalCents || 0; taxBilled += i.taxCents || 0; }
      if (i.status === 'Sent' || i.status === 'Partially Paid') owed += (i.totalCents || 0) - (i.paidCents || 0);
    });
    data.expenses.forEach(function (x) { if (x.status === 'Unpaid') billsOwed += x.amountCents || 0; });

    var subList = Object.keys(subs).map(function (k) { var p = k.split('|'); return { vendor: p[0], year: p[1], cents: subs[k] }; })
      .sort(function (a, b) { return a.year === b.year ? b.cents - a.cents : (a.year < b.year ? -1 : 1); });
    ledger.sort(function (a, b) { return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); });

    return {
      range: r, income: income, byMethod: byMethod, cats: cats, spent: spent, vyroSub: vyroSub, vyroFees: vyroFees,
      vyroGross: vyroGross, vyroCount: vyroCount, months: months, totalCosts: totalCosts, profit: profit,
      margin: income > 0 ? Math.round(profit / income * 100) : null,
      billed: billed, taxBilled: taxBilled, owed: owed, billsOwed: billsOwed, subs: subList, ledger: ledger
    };
  }

  function textSummary(biz, m) {
    var L = [];
    L.push((biz.name || 'My business') + ' - Profit and loss summary');
    L.push('Period: ' + m.range.label + ' (' + (m.range.from.slice(0, 4) === '0000' ? 'start' : m.range.from) + ' to ' + m.range.to + ')');
    L.push('Basis: cash (money actually received and paid)');
    L.push('');
    L.push('INCOME (payments received): ' + money(m.income));
    Object.keys(m.byMethod).forEach(function (k) { L.push('  ' + k + ': ' + money(m.byMethod[k])); });
    L.push('');
    L.push('EXPENSES (bills paid + Vyro fees): ' + money(m.totalCosts));
    m.cats.forEach(function (c) { L.push('  ' + c.cat + ': ' + money(c.cents) + '   [' + c.line + ']'); });
    L.push('');
    L.push('NET PROFIT: ' + money(m.profit) + (m.margin === null ? '' : ' (' + m.margin + '% margin)'));
    L.push('Sales tax billed on invoices in this period: ' + money(m.taxBilled));
    L.push('');
    L.push('Prepared from records entered in Vyro. Not tax advice. Review with a qualified tax professional.');
    return L.join('\n');
  }

  function cell(v, isNum) {
    var s = String(v == null ? '' : v);
    if (!isNum && /^[=+\-@\t\r]/.test(s)) s = "'" + s;   // stop spreadsheet formula injection
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function csv(m) {
    var rows = [['Date', 'Type', 'Description', 'Category or method', 'Job or invoice', 'Amount', 'Status'].map(function (h) { return cell(h); }).join(',')];
    m.ledger.forEach(function (e) {
      rows.push([cell(e.date), cell(e.type), cell(e.desc), cell(e.cat), cell(e.ref), cell((e.cents / 100).toFixed(2), true), cell(e.status)].join(','));
    });
    return rows.join('\r\n');
  }
  function download(name, content, type) {
    var blob = new Blob([content], { type: type || 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); resolve(); } catch (e) { reject(e); } t.remove();
    });
  }

  window.vfin = { PERIODS: PERIODS, SCHED_C: SCHED_C, VYRO_MONTHLY_FEE_CENTS: VYRO_MONTHLY_FEE_CENTS, VYRO_TX_FEE_PCT: VYRO_TX_FEE_PCT,
                  load: load, compute: compute, range: range, money: money, textSummary: textSummary, csv: csv, download: download, copy: copy };
})();
