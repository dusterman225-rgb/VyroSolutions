// The assistant chat page, shared by VyroContractor, VyroRestaurant, VyroTakeout and VyroRetail.
// Each app's assistant.html only sets the name and the example questions, then calls VyroAssistantUI.mount.
(function () {
  var PROVIDERS = [['openai', 'OpenAI'], ['openrouter', 'OpenRouter (also reaches Claude, Llama and more)'], ['gemini', 'Google Gemini'], ['groq', 'Groq'], ['mistral', 'Mistral'], ['together', 'Together AI']];
  var $ = function (id) { return document.getElementById(id); };
  function clock() { return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }

  window.VyroAssistantUI = { mount: function (ctx, o) {
    var NAME = o.name || 'Vyro Assistant', biz = ctx.biz.name || 'your business', bizId = ctx.bizId || (ctx.bizRef && ctx.bizRef.id) || '';
    $('hName').textContent = NAME; $('hSub').textContent = 'AI assistant for ' + biz + ' · Online'; $('hAv').firstChild.nodeValue = NAME.charAt(0);
    var base = (window.VYRO_HELP_URL || '').replace(/\/+$/, '');
    var hist = [], busy = false, ready = false;
    var BYO_KEY = 'vyroByo_' + bizId;

    function bubble(who, text) {
      var row = vyro.el('div', 'row2 ' + who);
      if (who === 'bot') row.appendChild(vyro.el('div', 'avatar', NAME.charAt(0)));
      var b = vyro.el('div', 'bub'); b.appendChild(document.createTextNode(text));
      var ts = vyro.el('span', 'ts', clock()); b.appendChild(ts);
      row.appendChild(b); $('log').appendChild(row); $('log').scrollTop = $('log').scrollHeight;
      return { row: row, bub: b, ts: ts };
    }
    function typing() {
      var row = vyro.el('div', 'row2 bot typing'); row.appendChild(vyro.el('div', 'avatar', NAME.charAt(0)));
      var b = vyro.el('div', 'bub'); b.appendChild(vyro.el('span')); b.appendChild(vyro.el('span')); b.appendChild(vyro.el('span'));
      row.appendChild(b); $('log').appendChild(row); $('log').scrollTop = $('log').scrollHeight; return row;
    }
    function lock(on) { $('q').disabled = on; $('send').disabled = on; $('q').placeholder = on ? 'Accept the notice above to start' : 'Type your question...'; }

    // ---- your own AI (optional, kept on this phone only) ----
    function getByo() { try { var v = JSON.parse(localStorage.getItem(BYO_KEY) || 'null'); return v && v.provider && v.model && v.key ? v : null; } catch (e) { return null; } }
    function drawByo() {
      var b = getByo();
      $('byoState').textContent = b ? 'On: using your ' + b.provider + ' key (' + b.model + '). Your key stays on this phone.' : 'Off: Vyro\'s AI is used.';
      $('byoSum').textContent = b ? 'Using your own AI' : 'Use your own AI (optional)';
      $('byoRemove').style.display = b ? 'block' : 'none';
      $('hSub').textContent = 'AI assistant for ' + biz + ' · ' + (b ? 'your own AI' : 'Online');
    }
    var sel = $('byoProv'); PROVIDERS.forEach(function (p) { var op = document.createElement('option'); op.value = p[0]; op.textContent = p[1]; sel.appendChild(op); });
    var cur = getByo(); if (cur) { sel.value = cur.provider; $('byoModel').value = cur.model; }
    $('byoSave').addEventListener('click', async function () {
      var prov = sel.value, model = $('byoModel').value.trim(), key = $('byoKey').value.trim() || (getByo() && getByo().key) || '';
      if (!/^[\w.:\/-]{1,100}$/.test(model)) { $('byoMsg').textContent = 'Type the model name exactly as your AI service lists it.'; return; }
      if (!/^[\w.\-]{10,300}$/.test(key)) { $('byoMsg').textContent = 'Paste your key (letters, numbers, dashes only).'; return; }
      if (!(await VyroConsent.has('byo'))) {
        var host = $('byoNotice'); host.textContent = '';
        VyroConsent.show('byo', host, { bizId: bizId, name: vyro.who ? vyro.who(ctx) : '' }, function () { store(prov, model, key); });
        return;
      }
      store(prov, model, key);
    });
    function store(prov, model, key) {
      try { localStorage.setItem(BYO_KEY, JSON.stringify({ provider: prov, model: model, key: key })); $('byoKey').value = ''; $('byoMsg').textContent = 'Saved on this phone. Ask a question to try it.'; }
      catch (e) { $('byoMsg').textContent = 'This browser would not save it. Turn off private browsing and try again.'; }
      drawByo();
    }
    $('byoRemove').addEventListener('click', function () { try { localStorage.removeItem(BYO_KEY); } catch (e) { /* ignore */ } $('byoKey').value = ''; $('byoMsg').textContent = 'Removed from this phone.'; drawByo(); });
    drawByo();

    function greet() {
      var t0 = typing();
      setTimeout(function () {
        t0.remove();
        bubble('bot', 'Hi! My name is ' + NAME + ', the AI assistant for ' + biz + '. How can I help you today?');
        (o.tips || []).forEach(function (t) {
          var x = vyro.el('button', '', t.label || t); x.type = 'button';
          x.addEventListener('click', function () { $('q').value = t.text || t; go(); });
          $('chips').appendChild(x);
        });
      }, 700);
    }

    if (!base || /PUT-YOUR/.test(base)) { $('err').textContent = 'The assistant is not connected yet (shared/helpbot-config.js).'; lock(true); return; }
    if (o.blocked) { bubble('bot', o.blocked); lock(true); return; }

    // The notice must be accepted first. Without it the server also refuses to answer.
    lock(true);
    (async function () {
      if (await VyroConsent.has('assistant')) { ready = true; lock(false); greet(); return; }
      VyroConsent.show('assistant', $('log'), { bizId: bizId, name: vyro.who ? vyro.who(ctx) : '' }, function () { ready = true; lock(false); greet(); });
    })();

    async function go(deepArg) {
      var again = deepArg === true, saved = null, t = again ? 'again' : $('q').value.trim(); if (!t || busy || !ready) return;
      if (again) { if (!hist.length || hist[hist.length - 1].role !== 'assistant') return; saved = hist.pop(); }
      var byo = getByo();
      busy = true; $('send').disabled = true; $('chips').style.display = 'none'; $('err').textContent = '';
      if (!again) { $('q').value = ''; $('q').style.height = 'auto'; bubble('me', t); hist.push({ role: 'user', content: t }); }
      var wait = typing();
      try {
        var token = await vyro.auth.currentUser.getIdToken();
        var payload = { messages: hist, today: vutil.todayStr(), deep: again && !byo };
        if (byo) payload.byo = byo;
        var r = await fetch(base + '/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify(payload) });
        var d = await r.json();
        if (r.status === 429) throw { friendly: byo ? 'You have reached the daily limit for your own AI on this business. It resets tomorrow.' : again ? 'You have used today\'s Think harder answers for your business. They reset tomorrow.' : 'You have reached today\'s assistant limit for your business. It resets tomorrow.' };
        if (d.error === 'consent') { ready = false; lock(true); throw { friendly: 'Please accept the notice first. Reload this page to see it again.', reason: d.detail }; }
        if (r.status === 401 || r.status === 403) throw { friendly: 'I could not open your records. Please sign out and back in, then try again.', reason: d.detail || d.error || ('status ' + r.status) };
        if (!d.reply) throw { detail: d.detail || d.error || ('status ' + r.status), friendly: byo ? d.detail : '' };
        var text = d.reply.replace(/\*\*/g, '').replace(/^#+\s*/gm, '');
        wait.remove();
        var m = bubble('bot', text); hist.push({ role: 'assistant', content: text });
        var a = vyro.el('a', '', 'Copy'); a.href = '#';
        a.addEventListener('click', function (e) { e.preventDefault(); try { navigator.clipboard.writeText(text); a.textContent = 'Copied'; } catch (x) { a.textContent = 'Could not copy'; } });
        m.ts.appendChild(a);
        if (again) { m.ts.insertBefore(document.createTextNode('Think harder answer · '), m.ts.firstChild); }
        else if (!byo) {
          var th = vyro.el('a', '', 'Think harder'); th.href = '#'; th.style.marginLeft = '10px';
          th.addEventListener('click', function (e) { e.preventDefault(); if (hist[hist.length - 1] && hist[hist.length - 1].content === text) { th.remove(); go(true); } });
          m.ts.appendChild(th);
        }
      } catch (e) {
        wait.remove(); if (again) { if (saved) hist.push(saved); } else hist.pop();
        var why = (e && e.reason) || (e && e.detail) || (e && e.friendly ? '' : 'could not reach the helper. Check the address in shared/helpbot-config.js.');
        bubble('bot', ((e && e.friendly) || 'Sorry, I\'m unavailable right now. Please try again in a minute.') + (why && !(e && e.friendly === why) ? '\n\n[Reason: ' + why + ']' : ''));
      }
      busy = false; $('send').disabled = !ready; if (ready) $('q').focus();
    }
    $('send').addEventListener('click', function () { go(); });
    $('q').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); } });
    $('q').addEventListener('input', function () { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 120) + 'px'; });
  } };
})();
