/* Photo to data. vaiphoto.read(file, kind) shrinks a photo of a receipt or invoice, sends it to the Vyqil AI helper,
   and resolves with {result, model, checked}. Nothing is saved here: the page shows it and the person confirms. */
(function () {
  function shrink(file) {
    return new Promise(function (res, rej) {
      var r = new FileReader(); r.onerror = function () { rej(new Error('Could not open that photo.')); };
      r.onload = function () {
        var im = new Image(); im.onerror = function () { rej(new Error('Could not open that photo.')); };
        im.onload = function () {
          var side = 1400, q = 0.8, out = '';
          for (var i = 0; i < 6; i++) {
            var k = Math.min(1, side / Math.max(im.width, im.height)), cv = document.createElement('canvas');
            cv.width = Math.max(1, Math.round(im.width * k)); cv.height = Math.max(1, Math.round(im.height * k));
            var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(im, 0, 0, cv.width, cv.height);
            out = cv.toDataURL('image/jpeg', q); if (out.length <= 1200000) break; q = Math.max(0.5, q - 0.1); side = Math.round(side * 0.8);
          }
          out.length > 1700000 ? rej(new Error('That photo is too large.')) : res(out);
        };
        im.src = r.result;
      };
      r.readAsDataURL(file);
    });
  }
  async function read(file, kind) {
    var base = (window.VYRO_HELP_URL || '').replace(/\/+$/, '');
    if (!base || /PUT-YOUR/.test(base)) throw new Error('The AI helper is not connected yet.');
    var image = await shrink(file), token = await vyro.auth.currentUser.getIdToken();
    var d = new Date(), today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    var r = await fetch(base + '/vision', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ image: image, kind: kind || 'receipt', today: today }) });
    var j = {}; try { j = await r.json(); } catch (e) {}
    if (r.status === 429) throw new Error('You have used today\'s ' + (j.limit || '') + ' photo reads. They reset tomorrow.' + (j.plus ? '' : ' Photo Plus ($5 a month) raises it to 50 a day. Ask your Vyqil contact to switch it on.'));
    if (!r.ok) throw new Error('The photo reader is busy. Try again in a moment.' + (j.detail && window.VYRO_HELP_DEBUG ? ' [' + j.detail + ']' : ''));
    return j;
  }
  window.vaiphoto = { read: read, shrink: shrink };
})();
