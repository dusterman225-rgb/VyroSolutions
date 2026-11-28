/* Saves reads. Menu, supply and team lists are kept on the device and only re-downloaded after someone changes them.
   A tiny "version" note (settings/ver, 1 read) tells every device when a list changed, so nothing goes stale. */
(function () {
  var memVer = {}; // per business: { at, data }
  function key(ctx, name) { return 'vc_' + ctx.bizRef.id + '_' + name; }
  function snap(rows) {
    var docs = rows.map(function (r) { return { id: r[0], data: function () { return r[1]; }, exists: true }; });
    return { docs: docs, size: docs.length, empty: !docs.length, forEach: function (f) { docs.forEach(f); } };
  }
  async function version(ctx) {
    var m = memVer[ctx.bizRef.id];
    if (m && Date.now() - m.at < 15000) return m.data;      // asked in the last 15 seconds: no new read
    try { var d = await ctx.bizRef.collection('settings').doc('ver').get(); m = { at: Date.now(), data: d.exists ? d.data() : {} }; }
    catch (e) { return null; }                                // cannot read the note: do not cache at all
    memVer[ctx.bizRef.id] = m; return m.data;
  }
  async function get(ctx, name) {
    var ver = await version(ctx), k = key(ctx, name), saved = null;
    if (ver) { try { saved = JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) {} }
    var want = ver ? (ver[name] || 0) : null;
    if (saved && ver && saved.v === want && Date.now() - saved.t < (want ? 12 * 3600000 : 5 * 60000)) return snap(saved.rows);
    var s = await ctx.bizRef.collection(name).get(), rows = [];
    s.forEach(function (d) { rows.push([d.id, d.data()]); });
    if (ver) { try { localStorage.setItem(k, JSON.stringify({ v: want, t: Date.now(), rows: rows })); } catch (e) {} }
    return snap(rows);
  }
  // Call after changing menu, supply or members.
  async function bump(ctx, name) {
    try { var p = {}; p[name] = Date.now(); await ctx.bizRef.collection('settings').doc('ver').set(p, { merge: true }); delete memVer[ctx.bizRef.id]; localStorage.removeItem(key(ctx, name)); } catch (e) { /* never block the real change */ }
  }
  window.vcache = { get: get, bump: bump };
})();
