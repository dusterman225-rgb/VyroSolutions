/* Download everything. vexport.collect(ctx, onProgress) reads the business's records and returns { business, data, skipped };
   vexport.downloadJson(...) and vexport.downloadCsv(...) save files on this phone. Nothing is sent anywhere. */
(function () {
  var NAMES = ['members', 'customers', 'leads', 'estimates', 'invoices', 'jobs', 'expenses', 'subs', 'recurring', 'contracts', 'documents', 'templates',
    'timelog', 'messages', 'updates', 'tasks', 'orders', 'menu', 'tables', 'supply', 'closes', 'coupons', 'waste', 'shifts', 'schedule', 'swaps', 'overtime',
    'products', 'vendors', 'purchases', 'stockLog', 'reservations', 'events', 'payRequests', 'settings', 'audit'];

  function plain(v) {
    if (v == null) return v;
    if (typeof v.toDate === 'function') { try { return v.toDate().toISOString(); } catch (e) { return null; } }
    if (Array.isArray(v)) return v.map(plain);
    if (typeof v === 'object') { var o = {}; Object.keys(v).forEach(function (k) { o[k] = plain(v[k]); }); return o; }
    return v;
  }
  async function collect(ctx, progress) {
    var out = { exportedAt: new Date().toISOString(), business: null, data: {}, skipped: [] };
    try { var b = await ctx.bizRef.get(); out.business = b.exists ? plain(b.data()) : null; } catch (e) { out.skipped.push('business'); }
    for (var i = 0; i < NAMES.length; i++) {
      var n = NAMES[i]; if (progress) progress(n, i, NAMES.length);
      try {
        var s = await ctx.bizRef.collection(n).get();
        if (!s.empty) out.data[n] = s.docs.map(function (d) { var x = plain(d.data()); x._id = d.id; return x; });
      } catch (e) { out.skipped.push(n); }
    }
    return out;
  }
  function save(name, text, type) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function stamp() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function downloadJson(ctx, all) { save('vyro-' + (ctx.biz.slug || 'business') + '-' + stamp() + '.json', JSON.stringify(all, null, 2), 'application/json'); }
  // One spreadsheet file for one list. Nested values become text. Leading = + - @ are defused so a spreadsheet never runs them as a formula.
  function downloadCsv(ctx, name, rows) {
    var cols = []; rows.forEach(function (r) { Object.keys(r).forEach(function (k) { if (cols.indexOf(k) < 0) cols.push(k); }); });
    function q(v) {
      if (v == null) return '""'; if (typeof v === 'object') v = JSON.stringify(v); v = String(v);
      if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"';
    }
    var lines = [cols.map(q).join(',')]; rows.forEach(function (r) { lines.push(cols.map(function (c) { return q(r[c]); }).join(',')); });
    save('vyro-' + name + '-' + stamp() + '.csv', lines.join('\n'), 'text/csv');
  }
  async function one(ctx, name) { var s = await ctx.bizRef.collection(name).get(); return s.docs.map(function (d) { var x = plain(d.data()); x._id = d.id; return x; }); }
  window.vexport = { one: one, collect: collect, downloadJson: downloadJson, downloadCsv: downloadCsv, NAMES: NAMES };
})();
