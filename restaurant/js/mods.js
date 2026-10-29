/* Item changes: NO an ingredient, or EXTRA of an ingredient (with its price). */
(function () {
  function fmt(c) { return '$' + ((c || 0) / 100).toFixed(2); }
  function extraCents(m, name) {
    var e = (m.extras || []); var k = String(name).toLowerCase();
    for (var i = 0; i < e.length; i++) { if (String(e[i].n).toLowerCase() === k) return e[i].c || 0; }
    return 0;
  }
  function sig(mods) { return (mods || []).map(function (x) { return x.t + ':' + x.i.toLowerCase(); }).sort().join(','); }
  function text(mods) { return (mods || []).map(function (x) { return (x.t === 'no' ? 'NO ' : 'EXTRA ') + x.i; }).join(' · '); }
  function add(mods) { var s = 0; (mods || []).forEach(function (x) { if (x.t === 'extra') s += x.c || 0; }); return s; }
  var bg = null, box = null;
  function ensure() {
    if (bg) return;
    bg = document.createElement('div'); bg.className = 'modal-bg'; box = document.createElement('div'); box.className = 'modal'; bg.appendChild(box); document.body.appendChild(bg);
    bg.addEventListener('click', function (e) { if (e.target === bg) bg.classList.remove('open'); });
  }
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  // m = menu item {name, ingredients[], extras[]}; current = mods array; done(mods)
  function open(m, current, done) {
    ensure(); box.textContent = '';
    var state = {}; (current || []).forEach(function (x) { state[x.i.toLowerCase()] = x.t; });
    box.appendChild(el('h2', '', m.name + ': ingredients'));
    var ings = m.ingredients || [];
    if (!ings.length) box.appendChild(el('div', 'note', 'No ingredients saved for this item, so there is nothing to change.'));
    var total = el('div', 'note', ''), rows = [];
    function recalc() { var s = 0; ings.forEach(function (n) { if (state[n.toLowerCase()] === 'extra') s += extraCents(m, n); }); total.textContent = s ? 'Extras add ' + fmt(s) + ' to this item.' : 'No extra charge so far.'; }
    ings.forEach(function (n) {
      var k = n.toLowerCase(), c = extraCents(m, n), row = el('div', 'item'), left = el('div', 'grow', n);
      var no = el('button', 'btn ghost', 'No'), ex = el('button', 'btn ghost', 'Extra ' + (c ? '+' + fmt(c) : 'free'));
      no.type = ex.type = 'button'; no.style.width = ex.style.width = 'auto'; no.style.marginTop = ex.style.marginTop = '0'; no.style.padding = ex.style.padding = '8px 12px';
      function paint() { no.className = 'btn' + (state[k] === 'no' ? '' : ' ghost'); ex.className = 'btn' + (state[k] === 'extra' ? '' : ' ghost'); recalc(); }
      no.addEventListener('click', function () { state[k] = state[k] === 'no' ? '' : 'no'; paint(); });
      ex.addEventListener('click', function () { state[k] = state[k] === 'extra' ? '' : 'extra'; paint(); });
      row.appendChild(left); row.appendChild(no); row.appendChild(ex); box.appendChild(row); paint();
    });
    box.appendChild(total); recalc();
    box.appendChild(el('div', 'note', 'Not an allergen guarantee. Always tell the kitchen about allergies.'));
    var ok = el('button', 'btn', 'Apply to this item'), cancel = el('button', 'btn ghost', 'Cancel'); ok.type = cancel.type = 'button';
    ok.addEventListener('click', function () {
      var out = []; ings.forEach(function (n) { var s = state[n.toLowerCase()]; if (s === 'no') out.push({ t: 'no', i: n, c: 0 }); else if (s === 'extra') out.push({ t: 'extra', i: n, c: extraCents(m, n) }); });
      bg.classList.remove('open'); done(out);
    });
    cancel.addEventListener('click', function () { bg.classList.remove('open'); });
    if (ings.length) box.appendChild(ok); box.appendChild(cancel); bg.classList.add('open');
  }
  window.vmods = { open: open, sig: sig, text: text, add: add, extraCents: extraCents };
})();
