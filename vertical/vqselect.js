// Replaces the phone's plain dropdown (white list, gray text) with a Vyqil-styled list. The real <select> stays in the page, hidden, so everything that reads it keeps working.
(function () {
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  function enhance(sel) {
    if (sel.__vq || sel.multiple || sel.hasAttribute('data-native')) return; sel.__vq = 1;
    var b = el('button', 'vq-sel'); b.type = 'button'; sel.style.display = 'none'; sel.parentNode.insertBefore(b, sel.nextSibling);
    function label() { var o = sel.options[sel.selectedIndex]; var t = o ? o.textContent : ''; if (b.textContent !== t) b.textContent = t; b.classList.toggle('ph', !o || o.value === ''); b.disabled = sel.disabled; }
    sel.__vqlabel = label; label(); sel.addEventListener('change', label);
    b.onclick = function () { pick(sel); };
  }
  function pick(sel) {
    var ov = el('div', 'vq-pick'), box = el('div', 'vq-pick-box'); ov.appendChild(box);
    function close() { ov.remove(); document.removeEventListener('keydown', esc); } function esc(e) { if (e.key === 'Escape') close(); }
    function item(o) { var b = el('button', 'vq-opt' + (o === sel.options[sel.selectedIndex] ? ' on' : ''), o.textContent || '(none)'); b.type = 'button'; b.onclick = function () { sel.selectedIndex = o.index; sel.dispatchEvent(new Event('change', { bubbles: true })); sel.dispatchEvent(new Event('input', { bubbles: true })); close(); }; if (o.disabled) b.disabled = true; box.appendChild(b); }
    Array.prototype.forEach.call(sel.children, function (c) { if (c.tagName === 'OPTGROUP') { box.appendChild(el('div', 'vq-grp', c.label)); Array.prototype.forEach.call(c.children, item); } else if (c.tagName === 'OPTION') item(c); });
    ov.onclick = function (e) { if (e.target === ov) close(); }; document.addEventListener('keydown', esc); document.body.appendChild(ov);
    var on = box.querySelector('.on'); if (on) on.scrollIntoView({ block: 'center' });
  }
  var queued = false;
  function scan() { queued = false; Array.prototype.forEach.call(document.querySelectorAll('select'), enhance); }
  function soon() { if (!queued) { queued = true; requestAnimationFrame(scan); } }
  function boot() { scan(); new MutationObserver(soon).observe(document.body, { childList: true, subtree: true }); setInterval(function () { Array.prototype.forEach.call(document.querySelectorAll('select'), function (s) { if (s.__vqlabel) s.__vqlabel(); }); }, 400); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
