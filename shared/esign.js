// VQSign: the building blocks for a legally meaningful e-signature (US ESIGN Act / UETA style):
//  1. the signer agrees to do business electronically (consent),  2. the signer shows intent to sign (typed name + drawn signature + a click),
//  3. the signature is tied to the exact document (SHA-256 fingerprint of its content),  4. an audit record is kept (server time, time zone, device).
// This helps a document stand up. It is not legal advice, and some documents cannot be signed electronically (wills, certain notices).
(function () {
  var CONSENT = 'esign-v1';
  function hash(obj) {
    var txt = typeof obj === 'string' ? obj : JSON.stringify(obj);
    try { var b = new TextEncoder().encode(txt); return crypto.subtle.digest('SHA-256', b).then(function (d) { return Array.prototype.map.call(new Uint8Array(d), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }); }
    catch (e) { return Promise.resolve(''); }
  }
  // A small finger/mouse signature pad. Returns { el, png(), empty(), clear() }. png() is a small black-on-transparent PNG (about 5-15 KB).
  function pad(host) {
    var wrap = document.createElement('div'), c = document.createElement('canvas'), W = 520, H = 160; c.width = W; c.height = H;
    c.style.cssText = 'width:100%;height:auto;max-height:160px;touch-action:none;background:#fff;border:1px solid #888;border-radius:10px;display:block';
    var x = c.getContext('2d'); x.lineWidth = 3; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#111'; var down = false, ink = false;
    function pt(e) { var r = c.getBoundingClientRect(), t = e.touches ? e.touches[0] : e; return [(t.clientX - r.left) * W / r.width, (t.clientY - r.top) * H / r.height]; }
    function start(e) { e.preventDefault(); down = true; var p = pt(e); x.beginPath(); x.moveTo(p[0], p[1]); }
    function move(e) { if (!down) return; e.preventDefault(); var p = pt(e); x.lineTo(p[0], p[1]); x.stroke(); ink = true; }
    function end() { down = false; }
    c.addEventListener('mousedown', start); c.addEventListener('mousemove', move); window.addEventListener('mouseup', end);
    c.addEventListener('touchstart', start, { passive: false }); c.addEventListener('touchmove', move, { passive: false }); c.addEventListener('touchend', end);
    var clr = document.createElement('button'); clr.type = 'button'; clr.textContent = 'Clear signature'; clr.style.cssText = 'margin-top:6px;background:none;border:1px solid #888;color:inherit;border-radius:10px;padding:8px 12px;font:inherit';
    function clear() { x.clearRect(0, 0, W, H); ink = false; } clr.onclick = clear;
    wrap.appendChild(c); wrap.appendChild(clr); if (host) host.appendChild(wrap);
    return { el: wrap, clear: clear, empty: function () { return !ink; }, png: function () { if (!ink) return ''; var o = document.createElement('canvas'); o.width = 360; o.height = 112; var ox = o.getContext('2d'); ox.fillStyle = '#fff'; ox.fillRect(0, 0, 360, 112); ox.drawImage(c, 0, 0, 360, 112); return o.toDataURL('image/png'); } };
  }
  // The audit record stored next to the signed document.
  function record(o) {
    var tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* ignore */ }
    return { name: String(o.name || '').slice(0, 120), email: String(o.email || '').slice(0, 120), drawn: String(o.drawn || '').slice(0, 40000), consent: CONSENT, docHash: String(o.docHash || '').slice(0, 80), tz: tz.slice(0, 60), ua: String(navigator.userAgent || '').slice(0, 200), clientTime: new Date().toISOString() };
  }
  window.VQSign = { CONSENT: CONSENT, hash: hash, pad: pad, record: record };
})();
