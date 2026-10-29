// Restaurant colour theme: accent, background and text colours chosen by the restaurant.
// Everything else (panels, borders, input boxes, muted text) is worked out from those three colours.
// The saved choice is also kept in this phone's browser so pages paint in the right colours straight away.
(function () {
  var KEY = 'vyroTheme';
  var PRESETS = {
    'Vyro dark': { accent: '#4B9CD3', bg: '#05070A', text: '#E6EBF0' },
    'Warm cafe': { accent: '#B5651D', bg: '#FFF8EE', text: '#3A2A1A' },
    'Fresh green': { accent: '#2E9E5B', bg: '#0B1410', text: '#E8F3EC' },
    'Classic red': { accent: '#C8102E', bg: '#FFFFFF', text: '#1B1B1B' },
    'Midnight gold': { accent: '#D4A537', bg: '#0E0E12', text: '#F3EFE6' },
    'Ocean': { accent: '#0E7FA6', bg: '#F2F9FC', text: '#10303D' }
  };
  function hex(c) { return /^#[0-9a-fA-F]{6}$/.test(c || ''); }
  function rgb(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function toHex(a) { return '#' + a.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  function mix(a, b, t) { var x = rgb(a), y = rgb(b); return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]); }
  function lum(c) { var v = rgb(c).map(function (n) { n /= 255; return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; }
  function contrast(a, b) { var l1 = lum(a), l2 = lum(b); if (l1 < l2) { var t = l1; l1 = l2; l2 = t; } return (l1 + 0.05) / (l2 + 0.05); }
  function rgba(c, a) { var x = rgb(c); return 'rgba(' + x[0] + ',' + x[1] + ',' + x[2] + ',' + a + ')'; }

  function css(t) {
    var A = t.accent, B = t.bg, T = t.text;
    var panel = mix(B, T, 0.07), field = mix(B, T, 0.05), muted = mix(T, B, 0.38), line = rgba(T, 0.2);
    var onAccent = contrast('#FFFFFF', A) >= contrast('#000000', A) ? '#FFFFFF' : '#000000';
    return [
      'html,body{background:' + B + ' !important}',
      'body{color:' + T + ';background:radial-gradient(900px 500px at 50% -10%,' + rgba(A, 0.18) + ',transparent 60%),' + B + ' !important}',
      '.tag,.card p,.field span,.note,.item small,.line small,.soon,.menu .mh small,.strip small,.menu-btn,.tab{color:' + muted + '}',
      '.err,.late{color:#d64545 !important}.ok{color:#2e9e5b}',
      '.card,.modal{background:' + panel + ';border-color:' + line + ';box-shadow:0 8px 28px ' + rgba(T, 0.12) + '}',
      '.card h2,.row b,.item b,.line .amt,.totals .big span,.totals .big b,.menu .mh b,.pos-item b,.modal h2,h1,h2,h3{color:' + T + '}',
      '.field input,.field select,.field textarea,.search,.line input,.line select,.item select,.cal-form input,input[type=text],input[type=number],input[type=search],input[type=date],input[type=email],input[type=tel],select,textarea{background:' + field + ';color:' + T + ';border-color:' + line + '}',
      '.field input:focus,.field select:focus,.field textarea:focus,.search:focus{border-color:' + A + ';box-shadow:0 0 0 3px ' + rgba(A, 0.25) + '}',
      '.btn{background:' + A + ';border-color:' + A + ';color:' + onAccent + ';box-shadow:none}',
      '.btn.ghost,.mini,.qty button,.pos-info{background:transparent;border-color:' + line + ';color:' + T + ';box-shadow:none}',
      '.btn:disabled{opacity:.5}',
      '.back,.link,.status{color:' + A + '}.dot{background:' + A + ';box-shadow:0 0 10px ' + A + '}',
      '.row,.item,.menu .mi{border-color:' + line + '}',
      '.tab{border-color:' + line + '}.tab.on,.tabs button.on{border-color:' + A + ';color:' + T + ';background:' + rgba(A, 0.18) + ';box-shadow:none}',
      '.tabs button{background:transparent;color:' + muted + ';border:1px solid ' + line + ';border-radius:999px;font:inherit}',
      '.strip>div,.pos-item,details.sec,details.more{background:' + panel + ';border-color:' + line + ';color:' + T + '}',
      '.pos-item:active{background:' + rgba(A, 0.22) + '}',
      'details.sec>summary,details.more>summary{color:' + T + '}',
      '.menu,.menu-btn{background:' + panel + ';border-color:' + line + ';box-shadow:0 8px 28px ' + rgba(T, 0.16) + '}',
      '.menu .mi{color:' + T + '}.menu .mi:hover{background:' + rgba(A, 0.14) + ';color:' + T + '}',
      '.menu .mh{background:linear-gradient(160deg,' + rgba(A, 0.18) + ',transparent)}',
      '.pill{border-color:' + line + ';color:' + T + '}.pill.New,.pill.Open,.pill.Sent{border-color:' + A + ';color:' + A + '}',
      '.pill.Paid{border-color:#2e9e5b;color:#2e9e5b}.pill.Voided{border-color:#d64545;color:#d64545}',
      '.mark-small,.brand .wordmark{filter:none}',
      '.total-row.big{border-color:' + line + '}',
      '.modal-bg{background:rgba(0,0,0,.55)}'
    ].join('\n');
  }
  function apply(t) {
    if (!t || !hex(t.accent) || !hex(t.bg) || !hex(t.text)) return false;
    var s = document.getElementById('vyro-theme');
    if (!s) { s = document.createElement('style'); s.id = 'vyro-theme'; document.head.appendChild(s); }
    s.textContent = css(t);
    var m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', t.bg);
    return true;
  }
  function cached() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function remember(t) { try { if (t) localStorage.setItem(KEY, JSON.stringify(t)); else localStorage.removeItem(KEY); } catch (e) {} }
  function check(t) {
    var msgs = [];
    if (contrast(t.text, t.bg) < 4.5) msgs.push('The text colour is too close to the background colour to read comfortably.');
    if (contrast(t.accent, t.bg) < 2.2) msgs.push('The accent colour is too close to the background colour. Buttons and highlights would be hard to see.');
    return msgs;
  }
  // Paint from this phone's saved copy at once, then confirm against the restaurant's saved theme.
  var c = cached(); if (c) apply(c);
  async function load(ctx) {
    try {
      var s = await ctx.bizRef.collection('settings').doc('theme').get();
      if (s.exists) { var d = s.data(); if (apply(d)) remember({ accent: d.accent, bg: d.bg, text: d.text }); }
      else if (c) { remember(null); var st = document.getElementById('vyro-theme'); if (st) st.remove(); }
    } catch (e) { /* keep the cached colours */ }
  }
  window.vtheme = { PRESETS: PRESETS, apply: apply, load: load, check: check, remember: remember };
})();
