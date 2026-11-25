// Vyqil Beta notice, 30-day free trial banner and feedback form for Contractor.
(function () {
  if (window.vqBeta) return;
  var TRIAL_DAYS = 30;
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  var st = document.createElement('style'); st.textContent =
    '.betabar{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;justify-content:center;padding:7px 36px 7px 12px;font-size:.76rem;line-height:1.3;text-align:center;position:relative;background:#101722;color:#dbe9ff;border-bottom:1px solid #1c2530}' +
    '.betabar b.tag{letter-spacing:.14em;font-size:.68rem;padding:2px 8px;border-radius:999px;background:#2b7bd8;color:#fff}.betabar a{color:inherit;text-decoration:underline;cursor:pointer}' +
    '.betabar .x{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:0;color:inherit;opacity:.6;font-size:1.1rem;padding:4px 8px;cursor:pointer}' +
    '.betanote{margin:14px auto 0;max-width:420px;font-size:.78rem;line-height:1.45;text-align:center;opacity:.85;padding:10px 12px;border:1px dashed #2f4a68;border-radius:12px}.betanote a{text-decoration:underline;cursor:pointer}' +
    '.fbm{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:90;display:flex;align-items:flex-end;justify-content:center}.fbb{background:#0a0f16;color:#e8eef6;width:100%;max-width:560px;max-height:92dvh;overflow-y:auto;border-radius:18px 18px 0 0;padding:18px;box-sizing:border-box}' +
    '.fbtypes{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 10px}.fbtypes button{border:1px solid #2f4a68;background:transparent;color:inherit;border-radius:999px;padding:8px 14px;font-size:.86rem}.fbtypes button.on{background:#2b7bd8;border-color:#2b7bd8;color:#fff}' +
    '.fbchk{display:flex;gap:8px;align-items:flex-start;font-size:.84rem;margin:8px 0}.fbchk input{width:auto;margin-top:3px}.fbb textarea{width:100%;box-sizing:border-box;margin:0}';
  document.head.appendChild(st);
  var CTX = null, extra = 0, bar = null;
  function modal(fn) { var bg = el('div', 'fbm'), b = el('div', 'fbb'); bg.appendChild(b); document.body.appendChild(bg); function close() { bg.remove(); } bg.onclick = function (e) { if (e.target === bg) close(); }; fn(b, close); }
  function toast(m) { var t = el('div', '', m); t.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#1c2530;color:#fff;padding:10px 16px;border-radius:12px;z-index:99;font-size:.9rem'; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3200); }
  function trial() { var c = CTX && CTX.biz && CTX.biz.createdAt; var ms = c && c.toMillis ? c.toMillis() : (c && c.seconds ? c.seconds * 1000 : 0); if (!ms) return null; var end = ms + (TRIAL_DAYS + extra) * 864e5; return { left: Math.ceil((end - Date.now()) / 864e5) }; }
  function feedback(kind) {
    modal(function (s, close) {
      s.appendChild(el('h3', '', 'Send feedback')); var p = el('p', '', 'This app is in Beta. Tell us what is broken, confusing or missing. Testers who actively help shape Vyqil earn another 30 days free.'); p.style.opacity = '.75'; s.appendChild(p);
      var type = kind || 'Idea', row = el('div', 'fbtypes');
      ['Bug', 'Idea', 'Question', 'Love it'].forEach(function (t) { var b = el('button', t === type ? 'on' : '', t); b.type = 'button'; b.onclick = function () { type = t; [].forEach.call(row.children, function (x) { x.className = x === b ? 'on' : ''; }); }; row.appendChild(b); });
      s.appendChild(row);
      var ta = el('textarea'); ta.rows = 5; ta.maxLength = 2000; ta.placeholder = 'What happened, or what would make this better?'; s.appendChild(ta);
      function chk(text, on) { var l = el('label', 'fbchk'), i = document.createElement('input'); i.type = 'checkbox'; i.checked = on; l.appendChild(i); l.appendChild(el('span', '', text)); s.appendChild(l); return i; }
      var contact = chk('You may contact me about this feedback', true), tester = chk('I want to be an active tester (more surveys, early features, and bonus free time)', false);
      var msg = el('div'); msg.style.cssText = 'min-height:1.2em;color:#ff8a8a'; s.appendChild(msg);
      var send = el('button', 'btn', 'Send'), cn = el('button', 'btn ghost', 'Cancel'); send.type = cn.type = 'button'; send.style.marginRight = '8px'; cn.onclick = close;
      send.onclick = function () {
        var t = ta.value.trim(), u = firebase.auth().currentUser; if (!u) { msg.textContent = 'Please sign in first so we can read your feedback.'; return; } if (t.length < 5) { msg.textContent = 'Please write a little more.'; return; }
        send.disabled = true;
        firebase.firestore().collection('feedback').add({ uid: u.uid, email: (u.email || '').toLowerCase(), bizId: (CTX && CTX.bizId) || '', bizName: String((CTX && CTX.biz && CTX.biz.name) || '').slice(0, 80), app: 'contractor', kind: type, message: t, tab: String(location.pathname.split('/').pop() || '').slice(0, 40), contactOk: !!contact.checked, wantsToTest: !!tester.checked, ua: String(navigator.userAgent || '').slice(0, 200), status: 'new', createdAt: firebase.firestore.FieldValue.serverTimestamp() })
          .then(function () { close(); toast('Thank you! Your feedback was sent.'); }, function () { send.disabled = false; msg.textContent = 'Could not send. Please try again.'; });
      };
      var bw = el('div'); bw.appendChild(send); bw.appendChild(cn); s.appendChild(bw);
    });
  }
  function about() {
    modal(function (s, close) {
      s.appendChild(el('h3', '', 'About the Beta'));
      var p = el('p', '', 'Vyqil apps are in Beta. Everyone who signs up gets a 30-day free trial of the apps for testing purposes. The optional AI Assistant is a paid add-on and is not part of the free trial. Features can change, and you may run into bugs. Your feedback shapes what we build.'); p.style.opacity = '.8'; s.appendChild(p);
      var t = trial(); if (t) { var q = el('p', '', t.left > 0 ? 'Your free trial has ' + t.left + ' day' + (t.left === 1 ? '' : 's') + ' left' + (extra ? ' (includes ' + extra + ' bonus days)' : '') + '.' : 'Your free trial has ended.'); q.style.opacity = '.8'; s.appendChild(q); }
      var f = el('button', 'btn', 'Send feedback'), x = el('button', 'btn ghost', 'Close'); f.type = x.type = 'button'; f.style.marginRight = '8px'; f.onclick = function () { close(); feedback(); }; x.onclick = close;
      var bw = el('div'); bw.appendChild(f); bw.appendChild(x); s.appendChild(bw);
    });
  }
  function paint() {
    var hide = false; try { hide = sessionStorage.getItem('vq_beta_hide') === '1'; } catch (e) { }
    var t = trial();
    if (t && !hide) {
      if (!bar) { bar = el('div', 'betabar'); document.body.insertBefore(bar, document.body.firstChild); } bar.innerHTML = '';
      bar.appendChild(el('b', 'tag', 'BETA')); bar.appendChild(el('span', '', t.left > 0 ? 'Free 30-day trial for testing: ' + t.left + ' day' + (t.left === 1 ? '' : 's') + ' left' : 'Your free beta trial has ended'));
      var a = el('a', '', 'Send feedback'); a.onclick = function () { feedback(); }; bar.appendChild(a);
      var i = el('a', '', 'About'); i.onclick = about; bar.appendChild(i);
      var x = el('button', 'x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Hide'); x.onclick = function () { try { sessionStorage.setItem('vq_beta_hide', '1'); } catch (e) { } paint(); }; bar.appendChild(x);
    } else if (bar) { bar.remove(); bar = null; }
  }
  window.vqBeta = {
    feedback: feedback, about: about,
    mount: function (ctx) {
      CTX = ctx; paint();
      try { firebase.firestore().collection('businesses').doc(ctx.bizId).collection('aiPlans').doc('trial').get().then(function (d) { extra = (d.exists && Number(d.data().extraDays)) || 0; paint(); }, function () { }); } catch (e) { }
    },
    note: function () { // sign-in and sign-up screens
      var h = document.querySelector('form') || document.querySelector('.card'); if (!h || document.querySelector('.betanote')) return;
      var n = el('div', 'betanote'); n.appendChild(document.createTextNode('Vyqil apps are in Beta. Everyone who signs up gets a 30-day free trial of the apps for testing purposes (the optional AI Assistant is a paid add-on).'));
      h.parentNode.insertBefore(n, h.nextSibling);
    }
  };
  if (!window.__vyroMenuMounted) document.addEventListener('DOMContentLoaded', function () { setTimeout(function () { if (!CTX && /login|signup|index|signinlink/.test(location.pathname + 'index')) { if (/(login|signup)\.html$/.test(location.pathname)) window.vqBeta.note(); } }, 300); });
})();
