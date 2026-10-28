// Floating Help chat bubble with a live-chat style window. Set window.VYRO_HELP_URL in js/helpbot-config.js.
(function () {
  if (window.__vyroHelpbot) return;
  var URL_ = window.VYRO_HELP_URL;
  if (!URL_ || /PUT-YOUR/.test(URL_)) return;
  window.__vyroHelpbot = true;
  var KEY = 'vyroHelp';
  var NAME = 'Vyro Help';   // change this word to rename the helper
  var css = document.createElement('style');
  css.textContent =
    '#hbBtn{position:fixed;right:14px;bottom:14px;z-index:50;padding:13px 18px;border-radius:999px;border:0;background:#2b7bd8;color:#fff;font-weight:700;box-shadow:0 4px 14px rgba(0,0,0,.4)}' +
    '#hbBox{position:fixed;right:10px;left:10px;bottom:70px;max-width:400px;margin-left:auto;z-index:50;background:#0a0f16;border:1px solid #1c2530;border-radius:16px;display:none;flex-direction:column;height:min(520px,72vh);overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.5)}' +
    '#hbHead{display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid #1c2530;color:#fff}' +
    '#hbHead b{display:block;font-size:.95rem}#hbHead small{display:block;opacity:.7;font-size:.74rem}#hbNew{margin-left:auto;background:none;border:1px solid #2f4a68;color:#cfe6ff;border-radius:999px;font-size:.7rem;padding:4px 9px}#hbX{margin-left:6px;background:none;border:0;color:#fff;font-size:1.3rem;padding:4px 8px}' +
    '.hbAv{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#4ba3ff,#7fd0ff);display:flex;align-items:center;justify-content:center;color:#031018;font-weight:800;flex:0 0 auto;position:relative}' +
    '.hbAv i{position:absolute;right:0;bottom:0;width:9px;height:9px;border-radius:50%;background:#3ddc84;border:2px solid #0a0f16}' +
    '#hbLog{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}' +
    '.hbR{display:flex;gap:6px}.hbR.me{justify-content:flex-end}.hbR .hbAv{width:24px;height:24px;font-size:.65rem;align-self:flex-end}.hbR .hbAv i{display:none}' +
    '.hbB{max-width:80%;padding:9px 12px;border-radius:16px;white-space:pre-wrap;word-break:break-word;line-height:1.4;font-size:.88rem;color:#e8eef6}' +
    '.hbR.bot .hbB{background:#161d27;border-bottom-left-radius:4px}.hbR.me .hbB{background:#2b7bd8;color:#fff;border-bottom-right-radius:4px}' +
    '.hbT{display:block;font-size:.64rem;opacity:.55;margin-top:4px}' +
    '.hbDots .hbB{display:flex;gap:4px;padding:12px 14px}.hbDots .hbB span{width:6px;height:6px;border-radius:50%;background:#8aa0b8;animation:hbBlink 1.2s infinite}' +
    '.hbDots .hbB span:nth-child(2){animation-delay:.2s}.hbDots .hbB span:nth-child(3){animation-delay:.4s}@keyframes hbBlink{0%,60%,100%{opacity:.25}30%{opacity:1}}' +
    '#hbChips{display:flex;flex-wrap:wrap;gap:6px;padding:0 12px 8px}#hbChips button{border:1px solid #2f4a68;background:transparent;color:#cfe6ff;border-radius:999px;padding:6px 11px;font-size:.78rem}' +
    '#hbRow{display:flex;gap:6px;padding:8px;border-top:1px solid #1c2530;align-items:flex-end}#hbRow textarea{flex:1;min-width:0;resize:none;max-height:90px;border-radius:18px;padding:9px 12px;margin:0;box-sizing:border-box}' +
    '#hbRow button{border:0;border-radius:50%;width:38px;height:38px;background:#2b7bd8;color:#fff;flex:0 0 auto}#hbRow button:disabled{opacity:.4}' +
    '#hbFine{font-size:.62rem;opacity:.5;text-align:center;padding:0 8px 6px;color:#fff}';
  document.head.appendChild(css);

  function el(tag, id, cls, text) { var e = document.createElement(tag); if (id) e.id = id; if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function clock() { return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }

  var btn = el('button', 'hbBtn', '', 'Help'); btn.type = 'button';
  var box = el('div', 'hbBox');
  var head = el('div', 'hbHead');
  var av = el('div', '', 'hbAv', NAME.charAt(0)); av.appendChild(document.createElement('i'));
  var who = document.createElement('div'); who.appendChild(el('b', '', '', NAME)); who.appendChild(el('small', '', '', 'AI helper · Online'));
  var x = el('button', 'hbX', '', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close');
  var nc = el('button', 'hbNew', '', 'New chat'); nc.type = 'button';
  head.appendChild(av); head.appendChild(who); head.appendChild(nc); head.appendChild(x);
  var log = el('div', 'hbLog'), chips = el('div', 'hbChips'), fine = el('div', 'hbFine', '', 'AI can make mistakes. Please don\'t share passwords or card numbers.');
  var row = el('div', 'hbRow'), inp = el('textarea'); inp.rows = 1; inp.maxLength = 500; inp.placeholder = 'Type your question...';
  var send = el('button', '', '', '➤'); send.type = 'button'; send.setAttribute('aria-label', 'Send');
  row.appendChild(inp); row.appendChild(send);
  [head, log, chips, fine, row].forEach(function (n) { box.appendChild(n); });
  document.body.appendChild(btn); document.body.appendChild(box);

  var S = { open: false, greeted: false, hist: [], log: [], pending: false };
  try { var raw = sessionStorage.getItem(KEY); if (raw) S = Object.assign(S, JSON.parse(raw)); } catch (e) { /* storage unavailable */ }
  function save() { try { S.log = S.log.slice(-40); S.hist = S.hist.slice(-12); sessionStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
  var busy = false;

  function bubble(who2, text, ts, skipSave) {
    var r = el('div', '', 'hbR ' + who2);
    if (who2 === 'bot') r.appendChild(el('div', '', 'hbAv', NAME.charAt(0)));
    ts = ts || clock();
    var b = el('div', '', 'hbB', text); b.appendChild(el('span', '', 'hbT', ts));
    r.appendChild(b); log.appendChild(r); log.scrollTop = log.scrollHeight;
    if (!skipSave) { S.log.push({ w: who2, t: text, ts: ts }); save(); }
    return r;
  }
  function dots() {
    var r = el('div', '', 'hbR bot hbDots'); r.appendChild(el('div', '', 'hbAv', NAME.charAt(0)));
    var b = el('div', '', 'hbB'); b.appendChild(document.createElement('span')); b.appendChild(document.createElement('span')); b.appendChild(document.createElement('span'));
    r.appendChild(b); log.appendChild(r); log.scrollTop = log.scrollHeight; return r;
  }
  function showChips() {
    chips.textContent = '';
    ['How do I get started?', 'I\'m lost, where do I go?', 'How do I contact support?'].forEach(function (t) {
      var c = el('button', '', '', t); c.type = 'button'; c.addEventListener('click', function () { inp.value = t; go(); }); chips.appendChild(c);
    });
  }
  function greet() {
    S.greeted = true; save(); var d = dots();
    setTimeout(function () {
      d.remove();
      var biz = (window.VYRO_BIZ_NAME || '').trim();
      bubble('bot', 'Hi! My name is ' + NAME + ', the AI helper for ' + (biz || 'this site') + '. How can I help you today?');
      showChips();
    }, 700);
  }
  function setOpen(open) {
    box.style.display = open ? 'flex' : 'none'; S.open = open; save();
    if (open) { if (!S.greeted) greet(); setTimeout(function () { log.scrollTop = log.scrollHeight; try { inp.focus(); } catch (e) { /* ignore */ } }, 50); }
  }
  btn.addEventListener('click', function () { setOpen(box.style.display !== 'flex'); });
  x.addEventListener('click', function () { setOpen(false); });
  nc.addEventListener('click', function () {
    if (!confirm('Start a new chat? This clears the current conversation.')) return;
    S = { open: true, greeted: false, hist: [], log: [], pending: false }; save(); log.textContent = ''; chips.textContent = ''; chips.style.display = 'flex'; greet();
  });

  // restore the conversation from the previous page
  S.log.forEach(function (m) { bubble(m.w, m.t, m.ts, true); });
  if (S.pending) {
    S.pending = false; if (S.hist.length && S.hist[S.hist.length - 1].role === 'user') S.hist.pop();
    bubble('bot', 'Sorry, I lost your last question when the page changed. Please ask it again.');
  }
  if (S.greeted && S.log.length <= 1) showChips(); else chips.style.display = 'none';
  if (S.open) { box.style.display = 'flex'; setTimeout(function () { log.scrollTop = log.scrollHeight; }, 50); }

  async function go() {
    var t = inp.value.trim(); if (!t || busy) return;
    busy = true; send.disabled = true; chips.style.display = 'none'; inp.value = ''; inp.style.height = 'auto';
    bubble('me', t); S.hist.push({ role: 'user', content: t }); S.pending = true; save();
    var wait = dots();
    try {
      var r = await fetch(URL_, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: S.hist, page: location.pathname }) });
      var d = await r.json();
      if (!d.reply) { var er = new Error('x'); er.detail = d.detail || d.error || ('status ' + r.status); throw er; }
      var text = d.reply.replace(/\*\*/g, '').replace(/^#+\s*/gm, '');
      wait.remove(); S.pending = false; bubble('bot', text); S.hist.push({ role: 'assistant', content: text }); save();
    } catch (e) {
      wait.remove(); S.pending = false; S.hist.pop();
      var det = e && e.detail ? e.detail : 'could not reach the helper. Check the address in js/helpbot-config.js.';
      bubble('bot', 'Sorry, I\'m unavailable right now. Please try again in a minute.' + (window.VYRO_HELP_DEBUG ? '\n\n[Debug: ' + det + ']' : ''));
    }
    busy = false; send.disabled = false;
  }
  send.addEventListener('click', go);
  inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); } });
  inp.addEventListener('input', function () { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 90) + 'px'; });
})();
