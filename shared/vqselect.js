// Replaces the phone's plain dropdown (white list, gray text) with a Vyqil-styled list. The real <select> stays in the page, hidden, so everything that reads it keeps working.
(function () {
  // Look of the Vyqil dropdown (blue and black), so pages without engine.css match too.
  if (!document.getElementById('vq-sel-css')) {
    var st = document.createElement('style'); st.id = 'vq-sel-css';
    st.textContent = 'button.vq-sel{text-transform:none;letter-spacing:normal;font-weight:400;box-shadow:none;display:block;width:100%;box-sizing:border-box;text-align:left;min-height:44px;padding:12px 38px 12px 12px;border-radius:12px;border:1px solid rgba(201,209,217,.14);background:rgba(5,7,10,.7) url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'14\' height=\'9\' viewBox=\'0 0 14 9\'%3E%3Cpath d=\'M1 1l6 6 6-6\' fill=\'none\' stroke=\'%234B9CD3\' stroke-width=\'2\'/%3E%3C/svg%3E") no-repeat right 14px center;color:#fff;font:16px system-ui,sans-serif;cursor:pointer;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      'button.vq-sel.ph{color:#8B96A3}button.vq-sel:disabled{opacity:.5}button.vq-sel:focus,button.vq-sel:active{border-color:#4B9CD3;box-shadow:0 0 14px rgba(75,156,211,.45);outline:none}' +
      'div.vq-pick{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.75);display:flex;align-items:flex-end;justify-content:center}' +
      'div.vq-pick-box{width:100%;max-width:560px;max-height:75vh;overflow-y:auto;background:#0a0f15;border:1px solid rgba(201,209,217,.14);border-radius:18px 18px 0 0;padding:8px 0 calc(14px + env(safe-area-inset-bottom));box-sizing:border-box;box-shadow:0 -10px 40px rgba(0,0,0,.6)}' +
      'button.vq-opt{text-transform:none;letter-spacing:normal;font-weight:400;box-shadow:none;display:block;width:100%;text-align:left;padding:14px 18px;background:none;border:0;border-bottom:1px solid rgba(255,255,255,.06);color:#C9D1D9;font:16px system-ui,sans-serif;cursor:pointer;border-radius:0;margin:0;min-height:0}' +
      'button.vq-opt.on{color:#fff;background:rgba(75,156,211,.18);box-shadow:inset 3px 0 0 #4B9CD3}button.vq-opt:active{background:rgba(75,156,211,.28)}button.vq-opt:disabled{opacity:.4}' +
      'div.vq-grp{padding:12px 18px 6px;color:#4B9CD3;font:700 .72rem system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase}';
    document.head.appendChild(st);
  }

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
