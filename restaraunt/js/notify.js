// Tells a server when one of THEIR orders is ready in the kitchen. Works while the page is open on the phone.
(function () {
  var audio = null, unlocked = false;
  function unlock() { if (unlocked) return; unlocked = true; try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audio = null; } }
  ['click', 'touchstart', 'keydown'].forEach(function (ev) { document.addEventListener(ev, unlock, { once: true, passive: true }); });
  function beep() {
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) {}
    if (!audio) return;
    try { var o = audio.createOscillator(), g = audio.createGain(); o.frequency.value = 660; g.gain.value = 0.2; o.connect(g); g.connect(audio.destination); o.start(); setTimeout(function () { o.frequency.value = 880; }, 150); setTimeout(function () { o.stop(); }, 350); } catch (e) {}
  }
  function bar() {
    var b = document.getElementById('vyro-ready');
    if (!b) {
      b = document.createElement('div'); b.id = 'vyro-ready';
      b.style.cssText = 'position:fixed;left:10px;right:10px;top:10px;z-index:80;display:none;flex-direction:column;gap:6px';
      document.body.appendChild(b);
    }
    return b;
  }
  function toast(text) {
    var t = document.createElement('div');
    t.style.cssText = 'background:#2e9e5b;color:#fff;padding:14px 16px;border-radius:12px;font-weight:700;box-shadow:0 6px 20px rgba(0,0,0,.4);cursor:pointer';
    t.textContent = text + ' (tap to hide)';
    t.addEventListener('click', function () { t.remove(); var b = bar(); if (!b.children.length) b.style.display = 'none'; });
    var b = bar(); b.style.display = 'flex'; b.appendChild(t);
  }
  // onCount(n) is called with how many of this person's orders are Ready right now.
  function start(ctx, onCount) {
    var seen = null;
    try {
      return ctx.bizRef.collection('orders').where('dateKey', '==', vutil.todayStr()).onSnapshot(function (s) {
        var now = {}, ready = 0;
        s.forEach(function (d) {
          var o = d.data(); if (o.byUid !== ctx.user.uid || o.status === 'Voided') return;
          var k = o.kitchenStatus || 'New'; now[d.id] = k; if (k === 'Ready') ready++;
          if (seen && k === 'Ready' && seen[d.id] !== 'Ready') { toast('READY: ' + (o.tableName ? 'Table ' + o.tableName : (o.number || '') + (o.label ? ' · ' + o.label : ''))); beep(); }
        });
        seen = now; if (onCount) onCount(ready);
      }, function () { /* notifications are optional */ });
    } catch (e) { return null; }
  }
  window.vnotify = { start: start };
})();
                                                                                
