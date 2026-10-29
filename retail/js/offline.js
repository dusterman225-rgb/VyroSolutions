// Saves orders on this phone if the internet drops, then uploads them when it comes back.
// Only used when a save cannot reach the database. Every order has its own fixed id, so uploading twice never makes a duplicate.
(function () {
  var STAMPS = ['createdAt', 'updatedAt', 'paidAt'];
  function key(ctx) { return 'vyroQueue:' + ctx.bizRef.id; }
  function read(ctx) { try { return JSON.parse(localStorage.getItem(key(ctx)) || '[]'); } catch (e) { return []; } }
  function write(ctx, q) { try { localStorage.setItem(key(ctx), JSON.stringify(q)); return true; } catch (e) { return false; } }
  function isNetwork(e) {
    return !navigator.onLine || (e && (e.code === 'unavailable' || e.code === 'deadline-exceeded' || e.code === 'vyro/timeout' || /network|offline|timeout|failed to fetch/i.test(String(e.message || ''))));
  }
  function withTimeout(p, ms) { return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej({ code: 'vyro/timeout' }); }, ms); })]); }
  function store(ctx, kind, id, data) {
    var plain = {}, stamps = [];
    Object.keys(data).forEach(function (k) { if (STAMPS.indexOf(k) >= 0) stamps.push(k); else plain[k] = data[k]; });
    var q = read(ctx), ex = q.filter(function (x) { return x.id === id; })[0];
    if (ex) {
      Object.keys(plain).forEach(function (k) { ex.data[k] = plain[k]; });
      stamps.forEach(function (s) { if (ex.stamps.indexOf(s) < 0) ex.stamps.push(s); });
      if (kind === 'set') ex.kind = 'set';
    } else q.push({ kind: kind, id: id, data: plain, stamps: stamps, at: Date.now() });
    return write(ctx, q);
  }
  function send(ctx, e, ms) {
    var d = {}; Object.keys(e.data).forEach(function (k) { d[k] = e.data[k]; });
    e.stamps.forEach(function (s) { d[s] = vyro.stamp(); });
    var ref = ctx.bizRef.collection('orders').doc(e.id);
    return withTimeout(e.kind === 'set' ? ref.set(d) : ref.update(d), ms);
  }
  // Try to save now. Returns 'saved' or 'queued'. Real errors (not the internet) are thrown.
  async function save(ctx, kind, id, data) {
    var waiting = read(ctx).some(function (x) { return x.id === id; });
    if (!waiting && navigator.onLine) {
      try {
        var d = {}; Object.keys(data).forEach(function (k) { d[k] = data[k]; });
        var ref = ctx.bizRef.collection('orders').doc(id);
        await withTimeout(kind === 'set' ? ref.set(d) : ref.update(d), 8000);
        return 'saved';
      } catch (e) { if (!isNetwork(e)) throw e; }
    }
    if (!store(ctx, kind, id, data)) throw { code: 'vyro/no-room', message: 'This phone has no room to keep the order. Connect to the internet and try again.' };
    return 'queued';
  }
  async function flush(ctx) {
    var q = read(ctx);
    for (var i = 0; i < q.length; i++) {
      try { await send(ctx, q[i], 15000); q.splice(i, 1); i--; write(ctx, q); }
      catch (e) {
        if (isNetwork(e)) break;
        try { var ex = await ctx.bizRef.collection('orders').doc(q[i].id).get(); if (ex.exists) { q.splice(i, 1); i--; write(ctx, q); } else { q[i].failed = String(e && e.code || 'error'); write(ctx, q); } }
        catch (e2) { break; }
      }
    }
    return read(ctx).length;
  }
  function count(ctx) { return read(ctx).length; }
  window.vqueue = { save: save, flush: flush, count: count };
})();
