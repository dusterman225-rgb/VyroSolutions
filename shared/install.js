/* Install Vyro on a phone's home screen.
   - Android and desktop Chrome: shows a real "Install app" button.
   - iPhone and iPad (Safari): shows the two taps (Share, then Add to Home Screen).
   Put <span id="vInstall"></span> where the button should go, or call vinstall.open(). Hides itself once installed. */
(function () {
  var ev = null, standalone = false;
  try { standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) {}
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); ev = e; draw(); });
  window.addEventListener('appinstalled', function () { ev = null; standalone = true; draw(); });
  try { if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {}); } catch (e) {}
  function help() {
    var bg = document.createElement('div'); bg.style.cssText = 'position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.7);display:flex;align-items:flex-end;justify-content:center';
    var bx = document.createElement('div'); bx.style.cssText = 'background:#0C1117;color:#E8EDF2;border-radius:16px 16px 0 0;padding:20px;max-width:480px;width:100%;font:16px system-ui,sans-serif';
    var t = document.createElement('h2'); t.textContent = 'Put Vyro on your home screen'; t.style.margin = '0 0 8px'; bx.appendChild(t);
    var p = document.createElement('div'); p.style.lineHeight = '1.5';
    p.textContent = ios ? '1. Tap the Share button (the square with an arrow) at the bottom of Safari. 2. Scroll down and tap Add to Home Screen. 3. Tap Add.' : '1. Open your browser menu (the three dots). 2. Tap Install app, or Add to Home screen. 3. Tap Install.';
    bx.appendChild(p);
    var c = document.createElement('button'); c.textContent = 'Got it'; c.style.cssText = 'margin-top:14px;width:100%;min-height:46px;border:0;border-radius:12px;background:#4B9CD3;color:#05070A;font:inherit;font-weight:800'; c.onclick = function () { bg.remove(); }; bx.appendChild(c);
    bg.appendChild(bx); bg.addEventListener('click', function (e) { if (e.target === bg) bg.remove(); }); document.body.appendChild(bg);
  }
  function open() {
    if (ev) { ev.prompt(); ev.userChoice.then(function () { ev = null; draw(); }).catch(function () {}); } else help();
  }
  function draw() {
    var host = document.getElementById('vInstall'); if (!host) return; host.textContent = '';
    if (standalone) return;
    var b = document.createElement('button'); b.type = 'button'; b.textContent = '⬇ Install app'; b.setAttribute('aria-label', 'Install this app on your home screen');
    b.style.cssText = 'min-height:40px;padding:0 16px;border-radius:999px;border:1px solid #4B9CD3;background:transparent;color:#4B9CD3;font:inherit;font-weight:700;cursor:pointer';
    b.addEventListener('click', open); host.appendChild(b);
  }
  window.vinstall = { open: open, can: function () { return !standalone; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', draw); else draw();
})();
