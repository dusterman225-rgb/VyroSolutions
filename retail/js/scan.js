/* Camera barcode scanner. Uses the phone's built-in BarcodeDetector (Chrome on Android and some computers).
   Where it is missing (for example iPhone Safari), staff type the number or use a USB or Bluetooth scanner, which types like a keyboard. */
(function () {
  var bg = null, stream = null, timer = null;
  function supported() { return !!(window.BarcodeDetector && navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }
  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    if (stream) { try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} stream = null; }
    if (bg) { bg.remove(); bg = null; }
  }
  async function open(done) {
    if (!supported()) { alert('This phone or browser cannot scan with the camera. Type the number, or use a USB or Bluetooth barcode scanner.'); return; }
    stop();
    bg = document.createElement('div'); bg.className = 'modal-bg open'; bg.style.zIndex = 1200;
    var box = document.createElement('div'); box.className = 'modal'; bg.appendChild(box);
    var h = document.createElement('h2'); h.textContent = 'Point the camera at the barcode'; box.appendChild(h);
    var v = document.createElement('video'); v.setAttribute('playsinline', ''); v.muted = true; v.style.cssText = 'width:100%;border-radius:12px;background:#000'; box.appendChild(v);
    var m = document.createElement('div'); m.className = 'note'; box.appendChild(m);
    var c = document.createElement('button'); c.type = 'button'; c.className = 'btn ghost'; c.textContent = 'Cancel'; c.addEventListener('click', stop); box.appendChild(c);
    document.body.appendChild(bg);
    try {
      var det = new BarcodeDetector();
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      v.srcObject = stream; await v.play();
      var busy = false;
      timer = setInterval(async function () {
        if (busy) return; busy = true;
        try { var r = await det.detect(v); if (r && r.length && r[0].rawValue) { var val = r[0].rawValue; stop(); done(val); return; } } catch (e) { /* keep trying */ }
        busy = false;
      }, 300);
    } catch (e) { m.textContent = 'Could not open the camera. Allow camera access for this site, or type the number.'; m.className = 'note err'; }
  }
  window.vscan = { supported: supported, open: open, stop: stop };
})();
