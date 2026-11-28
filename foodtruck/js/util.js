// Small helpers shared by the restaurant pages. Money is always whole cents.
(function () {
  function fmt(c) {
    c = Math.round(Number(c) || 0);
    var neg = c < 0; c = Math.abs(c);
    var d = String(Math.floor(c / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + '$' + d + '.' + String(c % 100).padStart(2, '0');
  }
  function toCents(v) {
    var n = parseFloat(String(v == null ? '' : v).replace(/[$,\s]/g, ''));
    return isFinite(n) ? Math.round(n * 100) : 0;
  }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  window.vutil = { fmt: fmt, toCents: toCents, todayStr: todayStr };
})();
