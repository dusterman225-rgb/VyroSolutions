// Vyqil Beta notice, 30-day free trial banner and feedback form for every engine app.
(function () {
  'use strict';
  var TRIAL_DAYS = 30;
  function start() {
    var Q = window.Q, C = window.VQ_APP; if (!Q || !C || Q.beta) return; Q.beta = true;
    var S = Q.S, db = firebase.firestore();
    function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
    var st = document.createElement('style'); st.textContent =
      '.betabar{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;justify-content:center;padding:7px 36px 7px 12px;font-size:.76rem;line-height:1.3;text-align:center;position:relative;background:var(--card2,#101722);color:var(--text,#dbe9ff);border-bottom:1px solid var(--line,#1c2530)}' +
      '.betabar b.tag{letter-spacing:.14em;font-size:.68rem;padding:2px 8px;border-radius:999px;background:var(--blue,#2b7bd8);color:#fff}' +
      '.betabar a{color:inherit;text-decoration:underline;cursor:pointer}.betabar .x{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:0;color:inherit;opacity:.6;font-size:1.1rem;padding:4px 8px;cursor:pointer}' +
      '.betanote{margin:14px auto 0;max-width:420px;font-size:.78rem;line-height:1.45;text-align:center;opacity:.85;padding:10px 12px;border:1px dashed var(--line,#2f4a68);border-radius:12px}.betanote a{text-decoration:underline;cursor:pointer}' +
      '.fbtypes{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 10px}.fbtypes button{border:1px solid var(--line,#2f4a68);background:transparent;color:inherit;border-radius:999px;padding:8px 14px;font-size:.86rem}.fbtypes button.on{background:var(--blue,#2b7bd8);border-color:transparent;color:#fff}' +
      '.fbchk{display:flex;gap:8px;align-items:flex-start;font-size:.84rem;margin:8px 0}.fbchk input{width:auto;margin-top:3px}';
    document.head.appendChild(st);

    var extra = 0, extraFor = '';
    function loadExtra() {
      if (!S.biz || extraFor === S.biz.id) return; extraFor = S.biz.id;
      db.collection('businesses').doc(S.biz.id).collection('aiPlans').doc('trial').get().then(function (d) { extra = (d.exists && Number(d.data().extraDays)) || 0; paint(); }, function () { });
    }
    function trialInfo() {
      if (!S.biz) return null; var c = S.biz.createdAt, ms = c && c.toMillis ? c.toMillis() : (c && c.seconds ? c.seconds * 1000 : Date.now());
      var end = ms + (TRIAL_DAYS + extra) * 864e5, left = Math.ceil((end - Date.now()) / 864e5); return { left: left, end: end, extra: extra };
    }

    // ---------- feedback form ----------
    function feedback(kind) {
      Q.modal(function (s, close) {
        s.appendChild(el('h3', '', 'Send feedback'));
        s.appendChild(el('p', 'hint', 'This app is in Beta. Tell us what is broken, confusing or missing. Testers who actively help shape Vyqil earn another 30 days free.'));
        var type = kind || 'Idea', row = el('div', 'fbtypes');
        ['Bug', 'Idea', 'Question', 'Love it'].forEach(function (t) { var b = el('button', t === type ? 'on' : '', t); b.type = 'button'; b.onclick = function () { type = t; [].forEach.call(row.children, function (x) { x.className = x === b ? 'on' : ''; }); }; row.appendChild(b); });
        s.appendChild(row);
        var ta = el('textarea'); ta.rows = 5; ta.maxLength = 2000; ta.placeholder = 'What happened, or what would make this better? (If it is a bug: what did you tap, and what did you expect?)'; s.appendChild(ta);
        function chk(text, on) { var l = el('label', 'fbchk'), i = document.createElement('input'); i.type = 'checkbox'; i.checked = on; l.appendChild(i); l.appendChild(el('span', '', text)); s.appendChild(l); return i; }
        var contact = chk('You may contact me about this feedback', true), tester = chk('I want to be an active tester (more surveys, early features, and bonus free time)', false);
        var msg = el('div', 'err'); msg.style.minHeight = '1.2em'; s.appendChild(msg);
        var send = el('button', 'btn', 'Send'), cn = el('button', 'btn ghost', 'Cancel'); send.type = cn.type = 'button'; send.style.marginRight = '8px'; cn.onclick = close;
        send.onclick = function () {
          var t = ta.value.trim(), u = firebase.auth().currentUser; if (!u) { msg.textContent = 'Please sign in first so we can read your feedback.'; return; } if (t.length < 5) { msg.textContent = 'Please write a little more.'; return; }
          send.disabled = true; msg.textContent = '';
          db.collection('feedback').add({ uid: u.uid, email: (u.email || '').toLowerCase(), bizId: (S.biz && S.biz.id) || '', bizName: String((S.biz && S.biz.name) || '').slice(0, 80), app: C.id, kind: type, message: t, tab: String(S.tab || '').slice(0, 40), contactOk: contact.checked, wantsToTest: tester.checked, ua: navigator.userAgent.slice(0, 160), status: 'new', createdAt: firebase.firestore.FieldValue.serverTimestamp() })
            .then(function () { close(); Q.toast('Thank you! Your feedback was sent.'); }, function () { send.disabled = false; msg.textContent = 'Could not send. Please try again.'; });
        };
        var bw = el('div'); bw.appendChild(send); bw.appendChild(cn); s.appendChild(bw);
      });
    }
    Q.feedback = feedback;
    Q.feedbackMenu = function () { return [{ l: 'Send feedback', run: function () { feedback(); } }, { l: 'About the Beta', run: about }]; };
    function about() {
      Q.modal(function (s, close) {
        s.appendChild(el('h3', '', 'About the Beta'));
        s.appendChild(el('p', 'hint', 'Vyqil apps are in Beta. Everyone who signs up gets a 30-day free trial of the apps for testing purposes. The optional AI Assistant is a paid add-on and is not part of the free trial. Features can change, and you may run into bugs. Please keep your own backup of anything important. Your feedback is how we make Vyqil better, and testers who actively help can earn another 30 days free.'));
        var t = trialInfo(); if (t) s.appendChild(el('p', 'hint', t.left > 0 ? 'Your free trial has ' + t.left + ' day' + (t.left === 1 ? '' : 's') + ' left' + (t.extra ? ' (includes ' + t.extra + ' bonus days)' : '') + '.' : 'Your free trial has ended.'));
        var f = el('button', 'btn', 'Send feedback'), x = el('button', 'btn ghost', 'Close'); f.type = x.type = 'button'; f.style.marginRight = '8px'; f.onclick = function () { close(); feedback(); }; x.onclick = close;
        var bw = el('div'); bw.appendChild(f); bw.appendChild(x); s.appendChild(bw);
      });
    }

    // ---------- banner (signed in) and note (sign-in / sign-up screens) ----------
    var bar = null;
    function paint() {
      var app = document.getElementById('app'); if (!app) return; loadExtra();
      var hide = false; try { hide = sessionStorage.getItem('vq_beta_hide') === '1'; } catch (e) { }
      var t = trialInfo();
      if (t && !hide) {
        if (!bar) { bar = el('div', 'betabar'); document.body.insertBefore(bar, document.body.firstChild); }
        bar.innerHTML = '';
        bar.appendChild(el('b', 'tag', 'BETA'));
        bar.appendChild(el('span', '', t.left > 0 ? 'Free 30-day trial for testing: ' + t.left + ' day' + (t.left === 1 ? '' : 's') + ' left' : 'Your free beta trial has ended'));
        var a = el('a', '', 'Send feedback'); a.onclick = function () { feedback(); }; bar.appendChild(a);
        var i = el('a', '', 'About'); i.onclick = about; bar.appendChild(i);
        var x = el('button', 'x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Hide'); x.onclick = function () { try { sessionStorage.setItem('vq_beta_hide', '1'); } catch (e) { } paint(); }; bar.appendChild(x);
      } else if (bar) { bar.remove(); bar = null; }
      var au = app.querySelector('.auth');
      if (au && !au.querySelector('.betanote')) {
        var n = el('div', 'betanote'); n.appendChild(document.createTextNode('Vyqil apps are in Beta. Everyone who signs up gets a 30-day free trial of the apps for testing purposes (the optional AI Assistant is a paid add-on). '));
        var f = el('a', '', 'Send feedback'); f.onclick = function () { feedback(); }; n.appendChild(f); au.appendChild(n);
      }
    }
    var timer; function later() { clearTimeout(timer); timer = setTimeout(paint, 120); }
    try { new MutationObserver(later).observe(document.getElementById('app') || document.body, { childList: true, subtree: true }); } catch (e) { }
    setInterval(paint, 5000); paint();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 0); }); else setTimeout(start, 0);
})();
