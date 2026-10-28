/* Discount or free item with a reason. open({staff, maxPct, current}, done) -> done(null | {pct, flat, reason}) */
(function () {
  var bg = null, box = null;
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  function amount(disc, sub) { if (!disc) return 0; var d = disc.pct ? Math.round(sub * disc.pct / 100) : (disc.flat || 0); return Math.max(0, Math.min(d, sub)); }
  function open(o, done) {
    if (!bg) { bg = el('div', 'modal-bg'); box = el('div', 'modal'); bg.appendChild(box); document.body.appendChild(bg); bg.addEventListener('click', function (e) { if (e.target === bg) bg.classList.remove('open'); }); }
    box.textContent = ''; box.appendChild(el('h2', '', 'Discount or free item'));
    var cap = o.staff ? 100 : (o.maxPct || 0), cur = o.current || {}, sel = { pct: cur.pct || 0, flat: cur.flat || 0 };
    var presets = [10, 15, 20, 50, 100].filter(function (p) { return p <= cap; }), row = el('div', 'tabs'); row.style.flexWrap = 'wrap';
    var pc = document.createElement('input'), fl = document.createElement('input');
    presets.forEach(function (p) { var b = el('button', sel.pct === p ? 'on' : '', p === 100 ? 'Comp (100%)' : p + '% off'); b.type = 'button'; b.addEventListener('click', function () { sel = { pct: p, flat: 0 }; pc.value = ''; fl.value = ''; Array.prototype.forEach.call(row.children, function (x) { x.classList.toggle('on', x === b); }); }); row.appendChild(b); });
    box.appendChild(row);
    pc.type = 'number'; pc.inputMode = 'decimal'; pc.min = '0'; pc.max = String(cap); pc.placeholder = 'Other % off'; pc.style.width = '100%';
    pc.addEventListener('input', function () { var v = Math.min(cap, Math.max(0, parseFloat(pc.value) || 0)); sel = { pct: v, flat: 0 }; fl.value = ''; Array.prototype.forEach.call(row.children, function (x) { x.classList.remove('on'); }); });
    box.appendChild(pc);
    if (o.staff) { fl.type = 'number'; fl.inputMode = 'decimal'; fl.step = '0.01'; fl.min = '0'; fl.placeholder = 'Or a dollar amount off'; fl.style.cssText = 'width:100%;margin-top:8px'; fl.addEventListener('input', function () { sel = { pct: 0, flat: Math.round((parseFloat(fl.value) || 0) * 100) }; pc.value = ''; Array.prototype.forEach.call(row.children, function (x) { x.classList.remove('on'); }); }); box.appendChild(fl); }
    else box.appendChild(el('div', 'note', 'You can give up to ' + cap + '% off. Ask a manager for more.'));
    var why = document.createElement('select'); why.style.cssText = 'width:100%;margin-top:8px';
    ['Guest complaint', 'Wrong or late order', 'Employee meal', 'Manager comp', 'Promotion or coupon', 'Other'].forEach(function (r) { var op = document.createElement('option'); op.textContent = r; if (cur.reason === r) op.selected = true; why.appendChild(op); }); box.appendChild(why);
    var msg = el('div', 'note', ''); box.appendChild(msg);
    var ok = el('button', 'btn', 'Apply'), none = el('button', 'btn ghost', 'Remove discount'), cx = el('button', 'btn ghost', 'Cancel'); ok.type = none.type = cx.type = 'button';
    ok.addEventListener('click', function () { if (!sel.pct && !sel.flat) { msg.textContent = 'Choose how much to take off.'; msg.className = 'note err'; return; } bg.classList.remove('open'); done({ pct: sel.pct, flat: sel.flat, reason: why.value }); });
    none.addEventListener('click', function () { bg.classList.remove('open'); done(null); }); cx.addEventListener('click', function () { bg.classList.remove('open'); });
    box.appendChild(ok); if (o.current) box.appendChild(none); box.appendChild(cx); bg.classList.add('open');
  }
  window.vdisc = { open: open, amount: amount };
})();
