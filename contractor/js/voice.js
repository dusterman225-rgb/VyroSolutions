// VyqilAssistant (included with every Vyqil app) voice and "fill it for me". Loaded by js/auth.js after sign-in.
//  - A small microphone beside every typed field. Tap it, talk, and the words are typed in.
//  - A "Fill by voice" bar on estimates, invoices, expenses and leads: say it all at once and the form fills in.
//  - Both come with the VyqilAssistant, which is included with VyqilContractor.
// Nothing is saved by voice. The person always checks the fields and taps Save.
(function () {
  if (window.vvoice) return;
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;   // Chrome, Edge, Safari, Samsung Internet. Firefox has none.
  var base = '', ctxRef = null, planState = null, planPromise = null, active = null;
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function loadCfg() {
    return new Promise(function (res) {
      if (window.VYRO_HELP_URL) return res();
      var s = document.createElement('script'); s.src = '/shared/helpbot-config.js'; s.onload = res; s.onerror = res; document.head.appendChild(s);
    });
  }
  async function post(path, body) {
    var tk = await vyro.auth.currentUser.getIdToken();
    var r = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tk }, body: JSON.stringify(body) });
    var d = {}; try { d = await r.json(); } catch (e) { /* not JSON */ }
    return { status: r.status, data: d };
  }

  // ---- does this business have the VyqilAssistant? (asked of the helper; remembered for 10 minutes) ----
  function cacheKey() { return 'vyroPlan_' + (ctxRef ? ctxRef.bizId : ''); }
  function checkPlan() {
    if (planPromise) return planPromise;
    planPromise = (async function () {
      try { var c = JSON.parse(sessionStorage.getItem(cacheKey()) || 'null'); if (c && Date.now() - c.t < 600000) { planState = c.on; return c.on; } } catch (e) { /* no cache */ }
      await loadCfg(); base = (window.VYRO_HELP_URL || '').replace(/\/+$/, '');
      if (!base) { planState = false; return false; }
      try {
        var r = await post('/assistant', { status: true, today: today() });
        planState = !!(r.data && r.data.plan === true);
        try { sessionStorage.setItem(cacheKey(), JSON.stringify({ on: planState, t: Date.now() })); } catch (e) { /* ignore */ }
      } catch (e) { planState = false; }
      return planState;
    })();
    return planPromise;
  }

  // ---- messages ----
  function sheet(title, text, buttons) {
    var ov = el('div'); ov.style.cssText = 'position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.75);display:flex;align-items:flex-end;justify-content:center';
    var bx = el('div'); bx.style.cssText = 'background:#0C1117;color:#E8EDF2;border-radius:16px 16px 0 0;padding:20px;max-width:480px;width:100%;box-sizing:border-box;font:16px Arial,Helvetica,sans-serif';
    var h = el('h2', '', title); h.style.margin = '0 0 8px'; bx.appendChild(h);
    var p = el('div', '', text); p.style.cssText = 'line-height:1.5;margin-bottom:14px'; bx.appendChild(p);
    buttons.forEach(function (b) {
      var a = el(b.href ? 'a' : 'button', 'btn' + (b.ghost ? ' ghost' : ''), b.label); if (b.href) a.href = b.href; else a.type = 'button';
      a.addEventListener('click', function () { ov.remove(); if (b.go) b.go(); }); bx.appendChild(a);
    });
    ov.appendChild(bx); ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); }); document.body.appendChild(ov);
  }
  function upgrade() {
    sheet('Voice is not available right now', 'Talking instead of typing, filling in a form by voice, and scanning receipts come with the VyqilAssistant, which is included with your Vyqil subscription. It could not be reached just now. Check your connection, reload the page, and try again.',
      [{ label: 'OK' }]);
  }
  function needNotice() {
    sheet('One quick step first', 'Open the Assistant page once and accept its notice. After that, voice and form filling work everywhere.', [{ label: 'Open the Assistant', href: 'assistant.html' }, { label: 'Not now', ghost: true }]);
  }
  function micNotice(go) {
    var key = SR ? 'vyroVoiceOk' : 'vyroVoiceRecOk';
    try { if (localStorage.getItem(key) === '1') { go(); return; } } catch (e) { /* ask each time */ }
    var text = SR
      ? 'Your browser turns your voice into text using its own speech service (Google on Android and Chrome, Apple on iPhone and Mac). Vyqil does not record or keep audio. Do not say passwords or card numbers.'
      : 'Your browser cannot turn speech into text by itself, so Vyqil records up to 25 seconds while you talk and sends that short recording to its AI service to type it for you. The recording is not saved. Do not say passwords or card numbers.';
    sheet('Using your voice', text, [{ label: 'Continue', go: function () { try { localStorage.setItem(key, '1'); } catch (e) { /* ignore */ } go(); } }, { label: 'Cancel', ghost: true }]);
  }

  // ---- gate: runs fn only when the business has the assistant ----
  async function gate(fn) {
    var on = planState === null ? await checkPlan() : planState;
    if (!on) { upgrade(); return; }
    fn();
  }

  // ---- dictation into one field ----
  function tidy(field, t) {
    var type = (field.type || '').toLowerCase();
    if (type === 'email') return t.replace(/\s+at\s+/gi, '@').replace(/\s+dot\s+/gi, '.').replace(/\s+/g, '').toLowerCase();
    if (type === 'tel') return t.replace(/[^0-9+\-() ]/g, '').trim();
    if (field.inputMode === 'decimal' || field.inputMode === 'numeric') return t.replace(/[^0-9.]/g, '');
    return t;
  }
  function micBlocked() {
    sheet('The microphone did not start', 'Your browser says it allows the microphone for this site, but the phone itself may still be blocking it. On Android: Settings > Apps > your browser > Permissions > Microphone > Allow. Then close the browser fully and reopen Vyqil. Until then you can use the microphone key on your keyboard.', [{ label: 'OK' }]);
  }
  function stop() { if (active) { try { active.rec.stop(); } catch (e) { /* ignore */ } } }
  function dictate(field, btn) {
    if (!SR) {
      if (canRecord()) { record(field, btn); return; }
      sheet('Voice typing is not available here', 'This browser cannot use the microphone (some in-app browsers block it). Open Vyqil in Chrome, Firefox, Safari or Edge, or use the microphone key on your keyboard.', [{ label: 'OK' }]); return;
    }
    if (active && active.field === field) { stop(); return; }
    stop();
    var rec = new SR(); rec.lang = navigator.language || 'en-US'; rec.interimResults = true; rec.continuous = false;
    var before = field.value, sep = before && !/\s$/.test(before) && field.inputMode !== 'decimal' && field.type !== 'email' && field.type !== 'tel' ? ' ' : '';
    rec.onresult = function (e) {
      var t = ''; for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      var v = before + sep + tidy(field, t);
      if (field.maxLength > 0) v = v.slice(0, field.maxLength);
      field.value = v; field.dispatchEvent(new Event('input', { bubbles: true }));
    };
    rec.onerror = function (e) {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        // Some browsers (and in-app browsers like Via) offer built-in speech typing but refuse to run it even when the site's
        // microphone permission is on. Recording the sound directly works there, so try that before giving up.
        if (canRecord()) { btn.classList.remove('rec'); active = null; record(field, btn); return; }
        micBlocked();
      }
    };
    rec.onend = function () { btn.classList.remove('rec'); if (active && active.rec === rec) active = null; field.dispatchEvent(new Event('change', { bubbles: true })); };
    active = { rec: rec, field: field };
    btn.classList.add('rec');
    try { rec.start(); } catch (e) { btn.classList.remove('rec'); active = null; }
  }

  // ---- browsers with no built-in speech to text (Firefox, some in-app browsers): record a short clip and let the assistant type it ----
  function canRecord() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder && (window.AudioContext || window.webkitAudioContext)); }
  function wavBase64(blob) {
    return blob.arrayBuffer().then(function (ab) {
      var AC = window.AudioContext || window.webkitAudioContext, ac = new AC();
      return ac.decodeAudioData(ab).then(function (buf) {
        try { ac.close(); } catch (e) { /* ignore */ }
        var rate = 16000, off = new OfflineAudioContext(1, Math.max(1, Math.ceil(buf.duration * rate)), rate), src = off.createBufferSource();
        src.buffer = buf; src.connect(off.destination); src.start();
        return off.startRendering();
      });
    }).then(function (out) {
      var f = out.getChannelData(0), n = f.length, bytes = new Uint8Array(44 + n * 2), dv = new DataView(bytes.buffer);
      function str(o, t) { for (var i = 0; i < t.length; i++) dv.setUint8(o + i, t.charCodeAt(i)); }
      str(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
      dv.setUint32(24, 16000, true); dv.setUint32(28, 32000, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); str(36, 'data'); dv.setUint32(40, n * 2, true);
      for (var i = 0; i < n; i++) { var v = Math.max(-1, Math.min(1, f[i])); dv.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true); }
      var bin = '', CH = 0x8000; for (var j = 0; j < bytes.length; j += CH) bin += String.fromCharCode.apply(null, bytes.subarray(j, j + CH));
      return btoa(bin);
    });
  }
  function record(field, btn) {
    if (active && active.field === field && active.mr) { try { active.mr.stop(); } catch (e) { /* ignore */ } return; }
    stop();
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var chunks = [], mr;
      try { mr = new MediaRecorder(stream); } catch (e) { stream.getTracks().forEach(function (t) { t.stop(); }); sheet('Recording is not available here', 'This browser could not start recording.', [{ label: 'OK' }]); return; }
      var cap = setTimeout(function () { try { mr.stop(); } catch (e) { /* ignore */ } }, 25000);
      mr.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      mr.onstop = function () {
        clearTimeout(cap); stream.getTracks().forEach(function (t) { t.stop(); });
        btn.classList.remove('rec'); active = null;
        if (!chunks.length) return;
        btn.classList.add('busy'); btn.disabled = true;
        var before = field.value, sep = before && !/\s$/.test(before) && field.inputMode !== 'decimal' && field.type !== 'email' && field.type !== 'tel' ? ' ' : '';
        wavBase64(new Blob(chunks, { type: mr.mimeType || 'audio/webm' })).then(function (b64) {
          return post('/transcribe', { audio: b64, today: today() });
        }).then(function (r) {
          if (r.status === 402) { upgrade(); return; }
          if (r.data && r.data.error === 'consent') { needNotice(); return; }
          if (r.status === 429) { sheet('Voice limit reached', 'You have used today\'s voice typing for this business. It resets tomorrow. You can still type.', [{ label: 'OK' }]); return; }
          if (r.status !== 200 || !r.data || typeof r.data.text !== 'string') { sheet('Could not type that', (r.data && r.data.detail) || 'Please try again in a minute.', [{ label: 'OK' }]); return; }
          if (!r.data.text.trim()) { sheet('Did not catch that', 'I did not hear any speech. Tap the microphone, speak clearly, then tap it again to finish.', [{ label: 'OK' }]); return; }
          var v = before + sep + tidy(field, r.data.text.trim());
          if (field.maxLength > 0) v = v.slice(0, field.maxLength);
          field.value = v; field.dispatchEvent(new Event('input', { bubbles: true })); field.dispatchEvent(new Event('change', { bubbles: true }));
        }).catch(function () { sheet('Could not type that', 'Check your connection and try again.', [{ label: 'OK' }]); }).then(function () { btn.classList.remove('busy'); btn.disabled = false; });
      };
      active = { mr: mr, field: field, rec: { stop: function () { try { mr.stop(); } catch (e) { /* ignore */ } } } };
      btn.classList.add('rec'); mr.start();
    }).catch(function () { micBlocked(); });
  }

  // ---- microphone buttons ----
  var MIC_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/></svg>';
  function eligible(f) {
    if (f.__vmic || f.disabled || f.readOnly || f.closest('#vmenuHost,.vmenu-wrap,.vyroConsent,.byo,[data-nomic]')) return false;
    var tag = f.tagName.toLowerCase(), type = (f.type || 'text').toLowerCase();
    if (tag === 'input' && ['text', 'email', 'tel'].indexOf(type) < 0) return false;
    if (tag === 'textarea' && f.id === 'q') return false;
    var id = (f.id || '') + ' ' + (f.name || '') + ' ' + (f.autocomplete || '');
    if (/pass|pin\b|key|card|cvv|ssn|cc-|otp|token/i.test(id)) return false;
    return !!(f.closest('label.field') || (f.parentElement && f.parentElement.classList.contains('r1')));
  }
  function addMic(f) {
    if (!eligible(f)) return;
    f.__vmic = true;
    var host = f.closest('label.field') || f.parentElement;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    f.classList.add('vmic-in');
    var b = el('button', 'vmic'); b.type = 'button'; b.innerHTML = MIC_SVG; b.setAttribute('aria-label', 'Speak instead of typing'); b.title = 'Speak instead of typing';
    if (!f.closest('label.field')) b.classList.add('mid');
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); gate(function () { micNotice(function () { dictate(f, b); }); }); });
    host.appendChild(b);
  }
  function scan() { Array.prototype.forEach.call(document.querySelectorAll('input,textarea'), addMic); }

  // ---- "Fill by voice" bar ----
  var fillDone = false;
  function attachFill() {
    var cfg = window.VYRO_FILL; if (fillDone || !cfg || !cfg.kind || !cfg.apply) return;
    var anchor = document.querySelector(cfg.anchor || '#form'); if (!anchor) return;
    fillDone = true;
    var d = el('details', 'sec'); d.id = 'vFillBar';
    d.appendChild(el('summary', '', 'Fill this by voice'));
    var inn = el('div', 'in'), lab = el('label', 'field'); lab.appendChild(el('span', '', 'Say or type what you need'));
    var ta = el('textarea'); ta.rows = 3; ta.maxLength = 1200; ta.placeholder = cfg.hint || 'Describe it in your own words'; lab.appendChild(ta); inn.appendChild(lab);
    var go = el('button', 'btn', 'Fill the form'); go.type = 'button'; inn.appendChild(go);
    var msg = el('div', 'note', ''); inn.appendChild(msg);
    inn.appendChild(el('div', 'note', 'Your words are sent to the assistant\'s AI to fill the fields. It never saves anything: check every field, then tap Save. Do not include passwords or card numbers.'));
    d.appendChild(inn); anchor.insertBefore(d, anchor.firstChild);
    scan();
    go.addEventListener('click', function () {
      gate(async function () {
        var text = ta.value.trim(); if (text.length < 3) { msg.textContent = 'Say or type what you need first.'; msg.className = 'note err'; return; }
        go.disabled = true; msg.textContent = 'Working...'; msg.className = 'note';
        try {
          var r = await post('/assistant', { mode: 'fill', kind: cfg.kind, text: text, today: today() });
          if (r.status === 402) { upgrade(); msg.textContent = ''; }
          else if (r.data && r.data.error === 'consent') { needNotice(); msg.textContent = ''; }
          else if (r.status === 429) { msg.textContent = 'You have used today\'s assistant answers for this business. It resets tomorrow.'; msg.className = 'note err'; }
          else if (!r.data || !r.data.fields) { msg.textContent = (r.data && r.data.detail) || 'Could not fill the form. Try again in a minute.'; msg.className = 'note err'; }
          else { cfg.apply(r.data.fields); msg.textContent = 'Filled in. Check every field before you save.'; msg.className = 'note ok'; }
        } catch (e) { msg.textContent = 'Could not reach the assistant. Check your connection and try again.'; msg.className = 'note err'; }
        go.disabled = false;
      });
    });
  }

  // ---- receipt photo: opens the camera, shrinks the picture, asks the assistant to read it ----
  function shrink(file, max) {
    return new Promise(function (res, rej) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var s = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        var q = 0.8, out = c.toDataURL('image/jpeg', q);
        while (out.length > 1500000 && q > 0.4) { q -= 0.15; out = c.toDataURL('image/jpeg', q); }
        res(out);
      };
      img.onerror = function () { rej(new Error('That picture could not be opened.')); }; img.src = url;
    });
  }
  async function readReceipt(file) {
    var image = await shrink(file, 1500);
    var r = await post('/vision', { image: image, kind: 'receipt', need: 'assistant', today: today() });
    if (r.status === 402) { upgrade(); return null; }
    if (r.data && r.data.error === 'consent') { needNotice(); return null; }
    if (r.status === 429) throw new Error('You have reached today\'s receipt scans. It resets tomorrow.');
    if (!r.data || !r.data.result) throw new Error((r.data && r.data.detail) || 'Could not read that receipt. Try a clearer, flatter photo.');
    return r.data.result;
  }

  var css = document.createElement('style');
  css.textContent = '.vmic{position:absolute;right:6px;bottom:6px;width:34px;height:34px;border-radius:50%;border:1px solid #2f4a68;background:#0a0f16;color:#7fd0ff;display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;z-index:2}' +
    '.vmic.mid{top:50%;bottom:auto;transform:translateY(-50%)}.vmic.rec{background:#c0392b;border-color:#c0392b;color:#fff;animation:vmicp 1s infinite}' +
    '.vmic.busy{opacity:.5}@keyframes vmicp{0%,100%{box-shadow:0 0 0 0 rgba(192,57,43,.6)}50%{box-shadow:0 0 0 7px rgba(192,57,43,0)}}.vmic-in{padding-right:46px!important}';
  document.head.appendChild(css);

  window.vvoice = {
    mount: function (ctx) {
      ctxRef = ctx; if (window.__vyroHelpbot) return;
      checkPlan(); scan(); attachFill();
      var t = null; new MutationObserver(function () { clearTimeout(t); t = setTimeout(function () { scan(); attachFill(); }, 200); }).observe(document.body, { childList: true, subtree: true });
    },
    attachFill: attachFill, gate: gate, readReceipt: readReceipt, upgrade: upgrade,
    // A ready-made microphone button for one field (used by the assistant chat box).
    micButton: function (field) {
      var b = el('button', 'vmic'); b.type = 'button'; b.innerHTML = MIC_SVG; b.setAttribute('aria-label', 'Speak instead of typing'); b.title = 'Speak instead of typing';
      b.style.cssText = 'position:static;flex:0 0 auto;width:42px;height:42px;margin:0';
      b.addEventListener('click', function (e) { e.preventDefault(); gate(function () { micNotice(function () { dictate(field, btn_); }); }); });
      var btn_ = b; return b;
    }
  };
})();
