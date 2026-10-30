/* Coupon codes, shared by every Vyro point-of-sale app. Owners and general managers make the codes (coupons page).
   Cashiers type a code at checkout; it becomes the sale's one discount. Rules in firestore.rules count each use on the server side. */
(function () {
  var bg = null, box = null;
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  function fmt(c) { c = Math.round(Number(c) || 0); return '$' + (c / 100).toFixed(2); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function clean(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20); }
  // '' when the coupon can be used on a sale of this size, otherwise the reason in plain words.
  function why(c, sub) {
    if (!c || c.active !== true) return 'That coupon is switched off.';
    var t = today();
    if (c.startDate && t < c.startDate) return 'That coupon starts on ' + c.startDate + '.';
    if (c.endDate && t > c.endDate) return 'That coupon expired on ' + c.endDate + '.';
    if (c.maxUses > 0 && (c.usedCount || 0) >= c.maxUses) return 'That coupon has been used up.';
    if (c.minSubCents && sub < c.minSubCents) return 'Spend at least ' + fmt(c.minSubCents) + ' to use that coupon.';
    return '';
  }
  function toDisc(c) {
    var d = { pct: 0, flat: 0, reason: 'Coupon ' + c.code, coupon: c.code };
    if (c.type === 'pct') { d.pct = c.value; if (c.maxOffCents) d.cap = c.maxOffCents; } else { d.flat = c.valueCents || 0; }
    if (c.minSubCents) d.minSub = c.minSubCents;
    return d;
  }
  function describe(c) {
    return (c.type === 'pct' ? c.value + '% off' + (c.maxOffCents ? ' (up to ' + fmt(c.maxOffCents) + ')' : '') : fmt(c.valueCents) + ' off') + (c.minSubCents ? ' when you spend ' + fmt(c.minSubCents) + '+' : '');
  }
  function prompt(ctx, sub, done) {
    if (!bg) { bg = el('div', 'modal-bg'); box = el('div', 'modal'); bg.appendChild(box); document.body.appendChild(bg); bg.addEventListener('click', function (e) { if (e.target === bg) bg.classList.remove('open'); }); }
    box.textContent = ''; box.appendChild(el('h2', '', 'Coupon code'));
    var inp = document.createElement('input'); inp.placeholder = 'Type or scan the code'; inp.autocapitalize = 'characters'; inp.autocomplete = 'off'; inp.maxLength = 24; inp.style.cssText = 'width:100%;text-transform:uppercase'; box.appendChild(inp);
    var m = el('div', 'note', 'A sale can have one discount or coupon. A coupon replaces any discount already on the sale.'); box.appendChild(m);
    var go = el('button', 'btn', 'Apply coupon'), cx = el('button', 'btn ghost', 'Cancel'); go.type = cx.type = 'button';
    cx.addEventListener('click', function () { bg.classList.remove('open'); });
    async function apply() {
      var code = clean(inp.value); if (code.length < 3) { m.textContent = 'Type the coupon code.'; m.className = 'note err'; return; }
      go.disabled = true; m.textContent = 'Checking...'; m.className = 'note';
      try {
        var st = await ctx.bizRef.collection('settings').doc('pos').get();
        if (st.exists && st.data().couponsOff === true) { m.textContent = 'Coupons are switched off for this business.'; m.className = 'note err'; go.disabled = false; return; }
        var d = await ctx.bizRef.collection('coupons').doc(code).get();
        if (!d.exists) { m.textContent = 'No coupon has that code.'; m.className = 'note err'; go.disabled = false; return; }
        var c = d.data(); c.code = code; var bad = why(c, sub);
        if (bad) { m.textContent = bad; m.className = 'note err'; go.disabled = false; return; }
        bg.classList.remove('open'); done(toDisc(c), c);
      } catch (e) { m.textContent = (window.vyro && vyro.friendly) ? vyro.friendly(e) : 'Could not check the coupon.'; m.className = 'note err'; go.disabled = false; }
    }
    go.addEventListener('click', apply); inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); apply(); } });
    box.appendChild(go); box.appendChild(cx); bg.classList.add('open'); setTimeout(function () { inp.focus(); }, 60);
  }
  // Counts one use. Best effort: the sale is already saved, and the database refuses a count past the coupon's limit.
  function used(ctx, code) {
    try { return ctx.bizRef.collection('coupons').doc(code).update({ usedCount: firebase.firestore.FieldValue.increment(1), updatedAt: firebase.firestore.FieldValue.serverTimestamp() }).catch(function () {}); } catch (e) { return null; }
  }
  window.vcoupon = { prompt: prompt, used: used, why: why, toDisc: toDisc, describe: describe, clean: clean, fmt: fmt, today: today };
})();
