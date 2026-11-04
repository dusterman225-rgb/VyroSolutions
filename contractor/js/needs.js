// Glowing blue outline on every box that still needs to be filled in. The glow goes away as soon as the box has something in it.
// vneeds.watch(['#title', ['#cust', '#cname'], '.line .r1 input'])  - an array inside the list means "any one of these is enough".
(function () {
  var CSS = '.vneed{outline:2px solid #4ba3ff!important;outline-offset:1px;border-radius:8px;box-shadow:0 0 0 3px rgba(75,163,255,.25),0 0 14px 3px rgba(75,163,255,.75)!important;animation:vneedPulse 2.2s ease-in-out infinite}' +
    '@keyframes vneedPulse{50%{box-shadow:0 0 0 3px rgba(75,163,255,.15),0 0 8px 1px rgba(75,163,255,.45)}}' +
    '@media(prefers-reduced-motion:reduce){.vneed{animation:none}}';
  function shown(e) { return e && e.type !== 'hidden' && !e.disabled && e.offsetParent !== null; }
  function empty(e) { return !String(e.value == null ? '' : e.value).trim(); }
  function watch(list) {
    if (!document.getElementById('vneedCss')) { var st = document.createElement('style'); st.id = 'vneedCss'; st.textContent = CSS; document.head.appendChild(st); }
    function all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
    function paint() {
      list.forEach(function (item) {
        var group = Array.isArray(item) ? item : [item], els = [];
        group.forEach(function (s) { els = els.concat(all(s)); });
        var visible = els.filter(shown);
        var filled = Array.isArray(item) && visible.some(function (e) { return !empty(e); });
        els.forEach(function (e) { e.classList.toggle('vneed', shown(e) && empty(e) && !filled); });
      });
    }
    ['input', 'change', 'keyup'].forEach(function (ev) { document.addEventListener(ev, function () { setTimeout(paint, 0); }, true); });
    try { new MutationObserver(function () { setTimeout(paint, 0); }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'value'] }); } catch (e) { /* older browser */ }
    setInterval(paint, 1500); paint();
  }
  window.vneeds = { watch: watch };
})();
