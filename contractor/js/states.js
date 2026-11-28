/* US states helper: a list for dropdowns, and a guess from an address typed as text. */
(function () {
  var L = [['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['DC','District of Columbia'],['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming']];
  var byCode = {}, byName = {}; L.forEach(function (s) { byCode[s[0]] = s[1]; byName[s[1].toLowerCase()] = s[0]; });
  function code(x) { x = String(x || '').trim(); if (!x) return ''; var u = x.toUpperCase(); if (byCode[u]) return u; return byName[x.toLowerCase()] || ''; }
  function name(x) { var c = code(x); return c ? byCode[c] : ''; }
  // Looks for "CA 90210", ", CA", or a full state name in an address.
  function fromAddress(a) {
    a = String(a || ''); if (!a.trim()) return '';
    var m = a.match(/\b([A-Za-z]{2})\.?,?\s+\d{5}(?:-\d{4})?\b/); if (m && byCode[m[1].toUpperCase()]) return m[1].toUpperCase();
    m = a.match(/,\s*([A-Za-z]{2})\s*(?:,|$)/); if (m && byCode[m[1].toUpperCase()]) return m[1].toUpperCase();
    var low = a.toLowerCase(), best = '';
    L.forEach(function (s) { var n = s[1].toLowerCase(); if (new RegExp('(^|[\\s,])' + n + '([\\s,\\d]|$)').test(low) && n.length > best.length) best = n; });
    return best ? byName[best] : '';
  }
  function fill(sel, val) {
    if (!sel) return; if (!sel.options.length) { var o0 = document.createElement('option'); o0.value = ''; o0.textContent = 'Choose a state'; sel.appendChild(o0); L.forEach(function (s) { var o = document.createElement('option'); o.value = s[0]; o.textContent = s[1]; sel.appendChild(o); }); }
    if (val !== undefined) sel.value = code(val);
    if (sel.__vqRefresh) { try { sel.__vqRefresh(); } catch (e) { /* ignore */ } }
  }
  window.vstates = { LIST: L, code: code, name: name, fromAddress: fromAddress, fill: fill };
})();
