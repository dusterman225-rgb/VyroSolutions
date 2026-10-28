/* Sold out (86) and out-of-stock checks for menu items. */
(function () {
  // supplyRows: [{name, onHand}]; returns {ingredientLower: true} for ingredients at zero
  function outSet(supplyRows) { var o = {}; (supplyRows || []).forEach(function (s) { if ((s.onHand || 0) <= 0 && s.name) o[String(s.name).toLowerCase()] = true; }); return o; }
  // returns '' when available, otherwise a short reason
  function why(m, out) {
    if (m.soldOut) return 'Sold out';
    var l = m.ingredients || []; for (var i = 0; i < l.length; i++) { if (out && out[String(l[i]).toLowerCase()]) return 'Out of ' + l[i]; }
    return '';
  }
  window.vavail = { outSet: outSet, why: why };
})();
