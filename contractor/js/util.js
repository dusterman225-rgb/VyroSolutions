(function () {
  function fmt(cents) {
    return ((cents || 0) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }
  function toCents(v) {
    var n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''));
    return isNaN(n) ? 0 : Math.round(n * 100);
  }
  function totals(items, discountCents, taxPct) {
    var sub = 0;
    items.forEach(function (i) { sub += Math.round((Number(i.qty) || 0) * (i.unitCents || 0)); });
    var disc = Math.min(Math.max(discountCents || 0, 0), sub);
    var taxable = sub - disc;
    var tax = Math.round(taxable * (Number(taxPct) || 0) / 100);
    return { subtotalCents: sub, discountCents: disc, taxCents: tax, totalCents: taxable + tax };
  }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  window.vutil = { fmt: fmt, toCents: toCents, totals: totals, todayStr: todayStr };
})();
                              
