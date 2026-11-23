// Vyqil Assistant for the shared engine: (1) Assistant chat that sees the whole business, (2) Scan a document by photo.
// Every app has its own assistant: the chat and its history are tied to this app's own records only.
(function () {
  'use strict';
  // ===== The only settings you may need to change =====
  var SETTINGS = {
    buyUrl: '',                 // paste your payment link here (for example a Stripe Payment Link) to turn on the Add the Assistant button
    price: '$5/month',          // the price shown to customers
    workerUrl: ''               // leave empty unless your worker address is not https://vyqil-assistant.dusterman225.workers.dev
  };
  function start() {
    var Q = window.Q, C = window.VQ_APP; if (!Q || !C || Q.assistant) return; Q.assistant = true;
    var S = Q.S;
    function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
    function base() { return String(window.VYQIL_ASSISTANT_URL || SETTINGS.workerUrl || 'https://vyqil-assistant.dusterman225.workers.dev').replace(/\/$/, ''); }
    function kindsAll() { return Object.keys(C.kinds).filter(function (k) { return !C.kinds[k].hidden || k === 'mydate'; }); }
    function schema(only) {
      var o = {}; (only || kindsAll()).forEach(function (k) {
        var kd = C.kinds[k]; if (!kd) return;
        o[k] = { label: kd.label, plural: kd.plural || kd.label + 's', fields: kd.fields.map(function (f) { return { k: f.k, l: f.l, t: f.t, req: f.req ? 1 : 0, o: Array.isArray(f.o) ? f.o : undefined }; }) };
      }); return o;
    }
    function api(path, body) {
      var u = firebase.auth().currentUser; if (!u) return Promise.reject({ friendly: 'Please sign in again.' });
      return u.getIdToken().then(function (tok) {
        return fetch(base() + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify(body) })
          .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw { friendly: r.status === 402 ? 'The Vyqil Assistant is an add-on, and your free trial has ended. Ask about adding it to keep using it.' : r.status === 429 && j.error === 'limit' ? 'You have used this month\'s Assistant allowance. It renews next month.' : r.status === 401 || r.status === 403 ? 'I could not open your records. Please sign out and back in, then try again.' : '', detail: r.status === 402 || (r.status === 429 && j.error === 'limit') ? '' : (j.detail || j.error || ('status ' + r.status)) }; return j; }); }, function () { throw { friendly: '', detail: 'could not reach the assistant. Check your connection.' }; });
      });
    }
    var st = document.createElement('style'); st.textContent =
      '.asst{display:flex;flex-direction:column;gap:10px}.asst .log{display:flex;flex-direction:column;gap:10px;min-height:42vh}' +
      '.asst .b{max-width:86%;padding:10px 13px;border-radius:18px;white-space:pre-wrap;word-break:break-word;line-height:1.45;font-size:.95rem}' +
      '.asst .b.bot{background:var(--card2,#161d27);color:var(--text,#fff);border:1px solid var(--line,#1c2530);border-bottom-left-radius:5px;align-self:flex-start}' +
      '.asst .b.me{background:var(--blue,#2b7bd8);color:#fff;border-bottom-right-radius:5px;align-self:flex-end}' +
      '.asst .b a{display:inline-block;margin-top:6px;font-size:.75rem;opacity:.7;color:inherit;margin-right:10px}' +
      '.asst .chips{display:flex;flex-wrap:wrap;gap:8px}.asst .chips button{border:1px solid var(--line,#2f4a68);background:transparent;color:var(--text,#cfe6ff);border-radius:999px;padding:8px 13px;font-size:.84rem}' +
      '.asst .comp{position:sticky;bottom:0;display:flex;gap:8px;align-items:flex-end;padding:10px 0;background:var(--bg,#05070A)}.asst .comp textarea{flex:1;resize:none;max-height:120px;min-height:44px;margin:0}' +
      '.asst .fine{font-size:.72rem;opacity:.65;text-align:center}.asst .dots span{display:inline-block;width:7px;height:7px;margin-right:4px;border-radius:50%;background:currentColor;opacity:.4;animation:asb 1.2s infinite}.asst .dots span:nth-child(2){animation-delay:.2s}.asst .dots span:nth-child(3){animation-delay:.4s}@keyframes asb{50%{opacity:1}}' +
      '.scanrow{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--line,#1c2530);font-size:.92rem}.scanrow b{max-width:55%;text-align:right;word-break:break-word}';
    document.head.appendChild(st);

    // ---------- Assistant chat ----------
    function hkey() { return 'vq_asst_' + C.id + '_' + (S.biz && S.biz.id); }
    function loadH() { try { return JSON.parse(localStorage.getItem(hkey()) || '[]'); } catch (e) { return []; } }
    function saveH(h) { try { localStorage.setItem(hkey(), JSON.stringify(h.slice(-30))); } catch (e) { } }
    var busy = false;
    function priceText() { return String(window.VYQIL_ASSISTANT_PRICE || SETTINGS.price); }
    function buy() {
      var url = String(window.VYQIL_ASSISTANT_BUY_URL || SETTINGS.buyUrl);
      if (!url) { Q.toast('Buying the Assistant opens very soon. We will let you know.'); return; }
      var em = (firebase.auth().currentUser && firebase.auth().currentUser.email) || '';
      window.open(url + (url.indexOf('?') < 0 ? '?' : '&') + 'client_reference_id=' + encodeURIComponent(S.biz.id) + '&prefilled_email=' + encodeURIComponent(em), '_blank');
    }
    function planCard(v, headline) {
      var c = el('div', 'card'); c.style.textAlign = 'center';
      c.appendChild(el('h3', '', 'Vyqil Assistant')); var p = el('div', 'amt', priceText()); p.style.fontSize = '1.6rem'; c.appendChild(p);
      c.appendChild(el('p', 'hint', headline));
      ['Acts as your CEO, COO and CFO, and sees your whole business', 'Tells you what needs attention, who owes you and what you are forgetting', 'Scan any contract, invoice or bill by photo and it fills in the form', 'Writes messages, reminders and notes for you'].forEach(function (t) { var d = el('div', 'hint', '\u2713 ' + t); d.style.margin = '4px 0'; c.appendChild(d); });
      var b = el('button', 'btn', 'Add the Assistant'); b.type = 'button'; b.style.marginTop = '12px'; b.onclick = buy; c.appendChild(b); v.appendChild(c);
    }
    function chatView(v) {
      v.appendChild(el('h2', '', 'Vyqil Assistant'));
      var holder = el('div'); holder.appendChild(el('p', 'hint', 'Checking your plan...')); v.appendChild(holder);
      api('/status', { bizId: S.biz.id, today: new Date().toISOString().slice(0, 10) }).then(function (st) {
        holder.innerHTML = '';
        if (!st.ok) { planCard(holder, 'Your free trial has ended. Add the Assistant to keep using it.'); return; }
        if (st.why === 'trial' || st.why === 'bonus') { var n = el('div', 'hint', 'Free trial: ' + st.daysLeft + ' day' + (st.daysLeft === 1 ? '' : 's') + ' left. After that it is ' + priceText() + '.'); n.style.cssText = 'text-align:center;margin-bottom:8px'; var a = el('a', '', ' Add it now'); a.href = '#'; a.onclick = function (e) { e.preventDefault(); buy(); }; n.appendChild(a); holder.appendChild(n); }
        chatBody(holder);
      }, function () { holder.innerHTML = ''; chatBody(holder); });
    }
    function chatBody(v) {
      var name = C.name || 'Vyqil'; var hist = loadH();
      var w = el('div', 'asst'), log = el('div', 'log'), chips = el('div', 'chips'); w.appendChild(log); w.appendChild(chips);
      function bubble(who, text) {
        var b = el('div', 'b ' + who, text);
        if (who === 'bot') { var cp = el('a', '', 'Copy'); cp.href = '#'; cp.onclick = function (e) { e.preventDefault(); try { navigator.clipboard.writeText(text); cp.textContent = 'Copied'; } catch (x) { cp.textContent = 'Could not copy'; } }; b.appendChild(el('br')); b.appendChild(cp); }
        log.appendChild(b); try { b.scrollIntoView({ block: 'nearest' }); } catch (e) { } return b;
      }
      if (!hist.length) bubble('bot', 'Hi, I am your ' + name + ' assistant. I can see your whole business here: customers, work, money, dates and notes. Ask me what needs attention, who owes you, how the month is going, or have me write a message. I can read everything but I cannot change anything.');
      hist.forEach(function (m) { bubble(m.role === 'user' ? 'me' : 'bot', m.content); });
      ['What needs my attention today?', 'Who owes me money?', 'How is my business doing?', 'What am I forgetting?', 'Write a payment reminder'].forEach(function (t) {
        var b = el('button', '', t); b.type = 'button'; b.onclick = function () { send(t === 'Write a payment reminder' ? 'Write a polite payment reminder for the person who owes me the most.' : t); }; chips.appendChild(b);
      });
      var comp = el('div', 'comp'), ta = el('textarea'); ta.rows = 1; ta.maxLength = 800; ta.placeholder = 'Ask anything about your business...';
      var sb = el('button', 'btn', 'Send'); sb.type = 'button'; comp.appendChild(ta); comp.appendChild(sb); w.appendChild(comp);
      w.appendChild(el('div', 'fine', 'AI can make mistakes. Check amounts before relying on them. This assistant only knows this app.'));
      v.appendChild(w);
      var clr = el('button', 'btn ghost sm', 'Clear this chat'); clr.type = 'button'; clr.style.marginTop = '8px'; clr.onclick = function () { saveH([]); Q.render(); }; v.appendChild(clr);
      function send(t) {
        t = (t || ta.value).trim(); if (!t || busy) return; busy = true; sb.disabled = true; chips.style.display = 'none'; ta.value = '';
        bubble('me', t); hist.push({ role: 'user', content: t });
        var wait = el('div', 'b bot'); wait.innerHTML = '<span class="dots"><span></span><span></span><span></span></span>'; log.appendChild(wait); try { wait.scrollIntoView({ block: 'nearest' }); } catch (e) { }
        api('/chat', { app: C.id, appName: name, bizId: S.biz.id, col: S.biz.col || 'records', schema: schema(), messages: hist, today: new Date().toISOString().slice(0, 10) }).then(function (d) {
          wait.remove(); var text = String(d.reply || '').replace(/\*\*/g, '').replace(/^#+\s*/gm, ''); if (!text) throw { detail: 'empty answer' };
          hist.push({ role: 'assistant', content: text }); saveH(hist); bubble('bot', text);
        }).catch(function (e) { wait.remove(); hist.pop(); bubble('bot', ((e && e.friendly) || 'Sorry, I am unavailable right now. Please try again in a minute.') + (e && e.detail ? '\n\n[Reason: ' + e.detail + ']' : '')); })
          .then(function () { busy = false; sb.disabled = false; ta.focus(); });
      }
      sb.onclick = function () { send(); };
      ta.onkeydown = function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
    }
    Q.views.assistant = chatView;

    // ---------- Scan a document ----------
    function shrink(file) {
      return new Promise(function (res, rej) {
        var fr = new FileReader(); fr.onerror = function () { rej(new Error('Could not read that photo.')); };
        fr.onload = function () {
          var im = new Image(); im.onerror = function () { rej(new Error('That file is not a photo. Use a picture (JPG or PNG).')); };
          im.onload = function () { var m = 1800, s = Math.min(1, m / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.85)); };
          im.src = fr.result;
        }; fr.readAsDataURL(file);
      });
    }
    function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
    function preset(kind, res) {
      var kd = C.kinds[kind], p = {}, notes = [], F = res.fields || {};
      kd.fields.forEach(function (f) {
        var v = F[f.k]; if (v == null || v === '') return;
        if (f.t === 'money') { var n = parseFloat(String(v).replace(/[$,\s]/g, '')); if (isFinite(n)) p[f.k] = Math.round(n * 100); }
        else if (f.t === 'number') { var m = parseFloat(v); if (isFinite(m)) p[f.k] = m; }
        else if (f.t === 'date') { if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) p[f.k] = String(v); }
        else if (f.t === 'select') { var o = (f.o || []).filter(function (x) { return norm(x) === norm(v); })[0]; if (o) p[f.k] = o; }
        else if (f.t === 'link') { var hit = Q.byKind(f.to).filter(function (r) { return norm(Q.title(r)) === norm(v); })[0] || Q.byKind(f.to).filter(function (r) { var a = norm(Q.title(r)), b = norm(v); return a && b && (a.indexOf(b) >= 0 || b.indexOf(a) >= 0); })[0]; if (hit) p[f.k] = hit.id; else notes.push('Pick the ' + f.l.toLowerCase() + ' (the document says "' + v + '")'); }
        else if (f.t === 'check') p[f.k] = !!v;
        else p[f.k] = String(v).slice(0, f.t === 'area' ? 1400 : 200);
      });
      var nf = kd.fields.filter(function (f) { return f.k === 'notes' && f.t === 'area'; })[0] || kd.fields.filter(function (f) { return f.t === 'area'; })[0];
      if (nf && res.text) { var head = 'Scanned from a photo of the original document:\n'; p[nf.k] = ((p[nf.k] ? p[nf.k] + '\n\n' : '') + head + res.text).slice(0, 1480); }
      return { p: p, notes: notes };
    }
    function scanFlow(prefer, closeForm) {
      Q.modal(function (s, close) {
        s.appendChild(el('h3', '', 'Scan a document'));
        s.appendChild(el('p', 'hint', 'Take a clear, straight-on photo of a contract, lease, invoice, estimate, receipt or bill. Vyqil reads it and fills in the form. Anything it cannot read is left blank for you to complete.'));
        var sel = el('select'); var a = el('option', '', 'Let Vyqil decide what it is'); a.value = ''; sel.appendChild(a);
        kindsAll().filter(function (k) { return k !== 'mydate'; }).forEach(function (k) { var o = el('option', '', C.kinds[k].label); o.value = k; sel.appendChild(o); }); if (prefer) sel.value = prefer;
        var lab = el('label', 'f', 'This is a'); lab.appendChild(sel); s.appendChild(lab);
        var msg = el('div', 'hint'); msg.style.margin = '8px 0';
        function pick(cam) { var i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; if (cam) i.setAttribute('capture', 'environment'); i.onchange = function () { if (i.files && i.files[0]) run(i.files[0]); }; i.click(); }
        var b1 = el('button', 'btn', 'Take a photo'), b2 = el('button', 'btn ghost', 'Choose a photo'), cn = el('button', 'btn ghost', 'Cancel');
        [b1, b2, cn].forEach(function (b) { b.type = 'button'; b.style.margin = '4px 6px 4px 0'; }); b1.onclick = function () { pick(true); }; b2.onclick = function () { pick(false); }; cn.onclick = close;
        var bw = el('div'); bw.appendChild(b1); bw.appendChild(b2); bw.appendChild(cn); s.appendChild(msg); s.appendChild(bw);
        function run(file) {
          bw.style.display = 'none'; msg.textContent = 'Reading your document... this can take up to a minute.';
          shrink(file).then(function (img) { return api('/scan', { app: C.id, bizId: S.biz.id, schema: schema(kindsAll().filter(function (k) { return k !== 'mydate'; })), image: img, today: new Date().toISOString().slice(0, 10), hint: sel.value ? C.kinds[sel.value].label : '' }); })
            .then(function (d) { close(); if (closeForm) closeForm(); review(d.result, sel.value); })
            .catch(function (e) { msg.textContent = (e && (e.message || e.friendly)) ? (e.message || e.friendly) + (e.detail ? ' [' + e.detail + ']' : '') : 'Sorry, that did not work. ' + ((e && e.detail) || ''); bw.style.display = ''; });
        }
      });
    }
    function review(res, prefer) {
      var kind = C.kinds[res.kind] ? res.kind : (prefer && C.kinds[prefer] ? prefer : kindsAll().filter(function (k) { return k !== 'mydate'; })[0]);
      Q.modal(function (s, close) {
        s.appendChild(el('h3', '', 'Here is what I found'));
        if (res.title) s.appendChild(el('p', 'hint', res.title));
        var sel = el('select'); kindsAll().filter(function (k) { return k !== 'mydate'; }).forEach(function (k) { var o = el('option', '', C.kinds[k].label); o.value = k; sel.appendChild(o); }); sel.value = kind;
        var lab = el('label', 'f', 'Save it as'); lab.appendChild(sel); s.appendChild(lab);
        var box = el('div'); s.appendChild(box);
        function draw() {
          box.innerHTML = ''; var kd = C.kinds[sel.value], pr = preset(sel.value, res), shown = 0;
          kd.fields.forEach(function (f) { if (pr.p[f.k] == null || f.t === 'area') return; var v = pr.p[f.k]; if (f.t === 'money') v = Q.tools && Q.tools.cents ? '$' + (v / 100).toFixed(2) : v; if (f.t === 'link') v = Q.title(Q.get(v)); var r = el('div', 'scanrow'); r.appendChild(el('span', '', f.l)); r.appendChild(el('b', '', String(v))); box.appendChild(r); shown++; });
          if (!shown) box.appendChild(el('p', 'hint', 'I could not read specific fields, but I saved the text of the document so you can copy from it.'));
          var miss = (res.missing || []).concat(pr.notes); if (miss.length) { var m = el('p', 'hint', 'Still needed from you: ' + miss.join('; ') + '.'); m.style.marginTop = '10px'; box.appendChild(m); }
          if (res.note) box.appendChild(el('p', 'hint', res.note));
        }
        sel.onchange = draw; draw();
        s.appendChild(el('p', 'hint', 'Check everything against the original before saving. The form opens next so you can fix or finish anything.'));
        var go = el('button', 'btn', 'Open the form'), cn = el('button', 'btn ghost', 'Cancel'); go.type = cn.type = 'button'; go.style.marginRight = '8px';
        go.onclick = function () { close(); Q.openForm(sel.value, null, preset(sel.value, res).p); }; cn.onclick = close;
        var bw = el('div'); bw.appendChild(go); bw.appendChild(cn); s.appendChild(bw);
      });
    }
    Q.scanFlow = scanFlow;
    Q.scanButton = function (kind, closeForm) { var b = el('button', 'btn ghost sm', '📷 Fill from a photo'); b.type = 'button'; b.style.margin = '0 0 10px'; b.onclick = function () { scanFlow(kind, closeForm); }; return b; };
    Q.assistantBuy = buy;
    Q.assistantMenu = function () { return [{ l: 'Vyqil Assistant', tab: 'assistant' }, { l: 'Scan a document', run: function () { scanFlow(''); } }]; };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 0); }); else setTimeout(start, 0);
})();
