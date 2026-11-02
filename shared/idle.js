// Signs people out after a stretch with no taps, so a lost or borrowed phone does not stay open to the business.
// Owners and general managers: 30 minutes. Supervisors: 60 minutes. Staff: 10 hours (a shift). Kiosk screens: never.
// The time is kept on the phone, so closing the page and coming back later is also checked.
(function () {
  var KEY = 'vyroLastActive';
  function now() { return Date.now(); }
  function read() { try { return parseInt(localStorage.getItem(KEY) || '0', 10) || 0; } catch (e) { return 0; } }
  function write() { try { localStorage.setItem(KEY, String(now())); } catch (e) { /* storage blocked: only same-page idle is checked */ } }
  window.vyroIdle = { limitFor: function (role) {
    if (window.VYRO_IDLE_MINUTES) return window.VYRO_IDLE_MINUTES;
    return role === 'owner' || role === 'gm' ? 30 : role === 'supervisor' ? 60 : 600;
  }, start: function (ctx, signOutFn) {
    if (!ctx || ctx.role === 'kiosk') return;
    var limit = window.vyroIdle.limitFor(ctx.role) * 60000, last = now(), done = false;
    var stored = read(); if (stored && now() - stored > limit) { out(); return; }
    function out() { if (done) return; done = true; try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } Promise.resolve(signOutFn()).catch(function () { }); }
    function touch() { var t = now(); if (t - last > 5000) { last = t; write(); } }
    ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(function (ev) { window.addEventListener(ev, touch, { passive: true, capture: true }); });
    write();
    function check() { var l = Math.max(last, read()); if (now() - l > limit) out(); }
    setInterval(check, 30000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
  } };
})();
