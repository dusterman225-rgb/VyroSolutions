// Vyqil Assistant for the shared engine: chat (with memory), full reports, saved documents, credits, and Scan a document by photo.
// Every app has its OWN assistant, memory, saved documents and credit balance, tied to that app's records only.
(function () {
  'use strict';
  // ===== The only settings you may need to change =====
  var SETTINGS = {
    price: '$7/month',          // the price shown to customers (includes $3 of credits every month)
    workerUrl: ''               // leave empty unless your worker address is not https://vyqil-assistant.dusterman225.workers.dev
  };
  function start() {
    var Q = window.Q, C = window.VQ_APP; if (!Q || !C || Q.assistant) return; Q.assistant = true;
    var S = Q.S;
    function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
    function base() { return String(window.VYQIL_ASSISTANT_URL || SETTINGS.workerUrl || 'https://vyqil-assistant.dusterman225.workers.dev').replace(/\/$/, ''); }
    function kindsAll() { return Object.keys(C.kinds).filter(function (k) { return !C.kinds[k].hidden || k === 'mydate'; }); }
    function scanAll() { return Object.keys(C.scanKinds || C.kinds).filter(function (k) { return k !== 'mydate' && (!C.kinds[k].hidden); }); }
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
          .then(function (r) {
            return r.json().catch(function () { return {}; }).then(function (j) {
              if (!r.ok) {
                var fr = '', det = j.detail || j.error || ('status ' + r.status);
                if (r.status === 402) { fr = 'The Vyqil Assistant is a ' + priceText() + ' add-on. Add it to start using it.'; det = ''; }
                else if (r.status === 429 && (j.error === 'credits' || j.error === 'limit')) { fr = 'You are out of Assistant credits for this month' + (j.credits && j.credits.renews ? ' (they renew ' + j.credits.renews + ')' : '') + '. You can add credits any time.'; det = ''; if (j.credits) setCredits(j.credits); }
                else if (r.status === 401 || r.status === 403) { if (j.detail && /Reports are for/.test(j.detail)) { fr = j.detail; det = ''; } else fr = 'I could not open your records. Please sign out and back in, then try again.'; }
                throw { friendly: fr, detail: det };
              }
              if (j && j.credits) setCredits(j.credits);
              if (j && j.dev) showDev(j.dev);
              return j;
            });
          }, function () { throw { friendly: '', detail: 'could not reach the assistant. Check your connection.' }; });
      });
    }
    // Test info, only the server sends this and only for a Vyqil admin account: which model answered and what it cost.
    function showDev(d) {
      var p = document.getElementById('astdev'); if (!p) { p = el('div'); p.id = 'astdev'; p.style.cssText = 'position:fixed;left:8px;bottom:8px;max-width:calc(100% - 16px);z-index:150;background:#1a1f29;color:#9fe3b0;border:1px solid #2f4a68;border-radius:10px;padding:6px 10px;font:12px/1.3 monospace;opacity:.95'; p.onclick = function () { p.remove(); }; document.body.appendChild(p); }
      p.textContent = 'ADMIN TEST  model: ' + d.model + ' (level ' + d.tier + ')  cost: $' + (Number(d.usd) || 0).toFixed(5) + (d.wasted > 0 ? '  retries: $' + Number(d.wasted).toFixed(5) : '') + '   (tap to hide)';
    }
    var lastCredits = null, meterEl = null;
    function usd(n) { return '$' + (Math.floor((n || 0) * 100) / 100).toFixed(2); }
    function setCredits(c) { lastCredits = c; paintMeter(); }
    function paintMeter() {
      if (!meterEl || !meterEl.isConnected) return; var c = lastCredits; if (!c) return;
      var t = meterEl.querySelector('span'); if (!t) { t = document.createElement('span'); meterEl.insertBefore(t, meterEl.firstChild); }
      t.textContent = 'Credits left: ' + usd(c.left) + (c.topup > 0 ? ' (includes ' + usd(c.topup) + ' bought)' : '') + '  ·  monthly allowance ' + usd(c.allowanceLeft) + ' of ' + usd(c.allowance) + ', renews ' + c.renews;
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
    var st2 = document.createElement('style'); st2.textContent =
      '.asttabs{display:flex;gap:6px;margin:8px 0 12px;overflow-x:auto}.asttabs button{flex:1;white-space:nowrap;border:1px solid var(--line,#2f4a68);background:transparent;color:inherit;border-radius:999px;padding:9px 14px;font-size:.86rem}.asttabs button.on{background:var(--blue,#2b7bd8);border-color:transparent;color:#fff}' +
      '.astmeter{font-size:.76rem;opacity:.8;text-align:center;margin:2px 0 6px}.astchoice{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;align-items:center}' +
      '.doc{background:#fff;color:#1a1f29;border-radius:12px;padding:16px 18px;line-height:1.55;font-size:.95rem;max-height:62vh;overflow:auto}.doc h1{font-size:1.25rem;margin:0 0 10px}.doc h2{font-size:1.05rem;margin:16px 0 6px;color:#1b4f8f}.doc h3{font-size:.98rem;margin:12px 0 4px}.doc p{margin:6px 0}.doc ul,.doc ol{margin:6px 0 6px 20px;padding:0}.doc table{border-collapse:collapse;width:100%;margin:8px 0;font-size:.86rem}.doc th,.doc td{border:1px solid #cdd6e3;padding:5px 7px;text-align:left}.doc th{background:#eef3fa}' +
      '.astrow{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--line,#1c2530)}.astrow .m{min-width:0}.astrow .m b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.astrow .m span{font-size:.76rem;opacity:.65}' +
      '.astnote{display:flex;gap:8px;align-items:flex-start;padding:7px 0;border-bottom:1px solid var(--line,#1c2530);font-size:.9rem}.astnote span{flex:1}.astnote button{background:none;border:0;color:inherit;opacity:.6;font-size:1.1rem}';
    document.head.appendChild(st2);

    // ---------- small helpers: saved documents, memory, markdown ----------
    function bizRef() { return Q.db.collection('businesses').doc(S.biz.id); }
    function today() { return new Date().toISOString().slice(0, 10); }
    function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    function inline(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>'); }
    function mdHtml(md) { // small safe markdown to HTML: headings, bullets, numbers, tables, bold
      var lines = String(md).split('\n'), out = [], i = 0, list = null;
      function close() { if (list) { out.push('</' + list + '>'); list = null; } }
      function cells(l) { return l.trim().replace(/^\||\|$/g, '').split('|'); }
      while (i < lines.length) {
        var l = lines[i], m;
        if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
          close(); var h = '<table><tr>' + cells(l).map(function (c) { return '<th>' + inline(c.trim()) + '</th>'; }).join('') + '</tr>'; i += 2;
          while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { h += '<tr>' + cells(lines[i]).map(function (c) { return '<td>' + inline(c.trim()) + '</td>'; }).join('') + '</tr>'; i++; }
          out.push(h + '</table>'); continue;
        }
        if ((m = /^(#{1,3})\s+(.*)$/.exec(l))) { close(); out.push('<h' + m[1].length + '>' + inline(m[2]) + '</h' + m[1].length + '>'); }
        else if ((m = /^\s*[-*•]\s+(.*)$/.exec(l))) { if (list !== 'ul') { close(); out.push('<ul>'); list = 'ul'; } out.push('<li>' + inline(m[1]) + '</li>'); }
        else if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(l))) { if (list !== 'ol') { close(); out.push('<ol>'); list = 'ol'; } out.push('<li>' + inline(m[1]) + '</li>'); }
        else if (!l.trim()) close();
        else { close(); out.push('<p>' + inline(l) + '</p>'); }
        i++;
      }
      close(); return out.join('\n');
    }
    function saveDoc(title, body, kind, meta) {
      return bizRef().collection('aiDocs').add({ app: C.id, title: String(title || 'Untitled').slice(0, 120), body: String(body).slice(0, 55000), kind: kind || 'report', period: (meta && meta.period) || '', by: ((firebase.auth().currentUser && firebase.auth().currentUser.email) || '').toLowerCase().slice(0, 80), createdAt: Q.FV.serverTimestamp() })
        .then(function () { Q.toast('Saved. Find it under Saved.'); }, function () { Q.toast('Could not save. Only owners and managers can save documents.'); });
    }
    function memDoc() { return bizRef().collection('aiMemory').doc(C.id); }
    function addNote(text) {
      text = String(text).replace(/\s+/g, ' ').trim().slice(0, 300); if (!text) return;
      return memDoc().get().then(function (d) { var n = (d.exists && d.data().notes) || []; if (n.indexOf(text) >= 0) return; n = n.concat([text]).slice(-60); return memDoc().set({ notes: n, updatedAt: Q.FV.serverTimestamp() }, { merge: true }).then(function () { Q.toast('Remembered.'); }); }).catch(function () { });
    }
    function docView(doc) { // a finished report or saved document: read it, save it, print it, send it
      Q.modal(function (s, close) {
        var box = el('div', 'doc'); box.innerHTML = mdHtml(doc.body); s.appendChild(box);
        if (doc.period) s.appendChild(el('p', 'hint', 'Period: ' + doc.period + '. Figures come from your records; check them before sharing.'));
        var bw = el('div'); bw.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-top:10px';
        function b(t, cls, fn) { var x = el('button', 'btn ' + (cls || ''), t); x.type = 'button'; x.onclick = fn; bw.appendChild(x); return x; }
        if (!doc.id) { var sv = b('Save', '', function () { saveDoc(doc.title, doc.body, doc.kind || 'report', doc).then(function () { sv.disabled = true; sv.textContent = 'Saved'; }); }); }
        b('Print / PDF', 'ghost', function () { var w = window.open('', '_blank'); if (!w) { Q.toast('Your browser blocked the print window. Use Download Word.'); return; } w.document.write('<!doctype html><title>' + esc(doc.title) + '</title><style>body{font:14px/1.55 Georgia,serif;max-width:760px;margin:30px auto;padding:0 18px;color:#111}h1{font-size:22px}h2{font-size:16px;color:#1b4f8f;margin-top:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:5px 7px;text-align:left;font-size:13px}th{background:#eee}</style>' + mdHtml(doc.body)); w.document.close(); setTimeout(function () { try { w.focus(); w.print(); } catch (e) { } }, 400); });
        b('Download Word', 'ghost', function () { var h = '<html><head><meta charset="utf-8"><title>' + esc(doc.title) + '</title></head><body>' + mdHtml(doc.body) + '</body></html>'; var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + h], { type: 'application/msword' })); a.download = String(doc.title || 'report').replace(/[^\w -]+/g, '').trim().replace(/\s+/g, '-') + '.doc'; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 500); });
        b('Copy', 'ghost', function () { try { navigator.clipboard.writeText(doc.body); Q.toast('Copied.'); } catch (e) { Q.toast('Could not copy.'); } });
        if (doc.id) b('Delete', 'ghost', function () { bizRef().collection('aiDocs').doc(doc.id).delete().then(function () { close(); Q.toast('Deleted.'); Q.render(); }, function () { Q.toast('Only owners and managers can delete.'); }); });
        b('Close', 'ghost', close); s.appendChild(bw);
      });
    }

    // ---------- plan and credits ----------
    function priceText() { return String(window.VYQIL_ASSISTANT_PRICE || SETTINGS.price); }
    function pay(kind) { // opens secure Stripe checkout for the plan or a credit top-up, then returns here
      var u = firebase.auth().currentUser; Q.toast('Opening PayPal...');
      api(kind === 'topup5' || kind === 'topup1' || kind === 'topup' ? '/pp/topup' : '/pp/subscribe', { app: C.id, appName: C.name || 'Vyqil', bizId: S.biz.id, kind: (kind === 'plan' ? 'assistant' : kind), pack: kind, email: (u && u.email) || '', returnUrl: location.href.split('#')[0] })
        .then(function (d) { if (d && d.url) location.href = d.url; else Q.toast('Could not open checkout. Please try again.'); }, function (e) { Q.toast((e && (e.detail || e.friendly)) || 'Could not open checkout. Please try again.'); });
    }
    function manage() {
      if (!confirm('Cancel the AI Assistant add-on? It stays active until the end of the paid period.')) return; api('/pp/cancel', { app: C.id, bizId: S.biz.id, kind: 'assistant' }).then(function () { Q.toast('Assistant subscription cancelled.'); Q.render(); }, function (e) { Q.toast((e && (e.detail || e.friendly)) || 'Could not cancel.'); });
    }
    function buy() { pay('plan'); }
    function addCredits() {
      Q.modal(function (s, close) {
        s.appendChild(el('h3', '', 'Add credits'));
        s.appendChild(el('p', 'hint', 'Your ' + priceText() + ' plan includes $3.00 of credits every month. They renew each month, and unused allowance does not carry over. Extra credits are used after your monthly allowance.'));
        [['$1', '$0.25 in credits', 'top1'], ['$5', '$2.50 in credits', 'top5']].forEach(function (o) {
          var b = el('button', 'btn', 'Add ' + o[1] + ' for ' + o[0]); b.type = 'button'; b.style.cssText = 'display:block;width:100%;margin:8px 0'; b.onclick = function () { pay(o[2]); }; s.appendChild(b);
        });
        var x = el('button', 'btn ghost', 'Close'); x.type = 'button'; x.onclick = close; s.appendChild(x);
      });
    }
    function planCard(v, headline) {
      var c = el('div', 'card'); c.style.textAlign = 'center';
      c.appendChild(el('h3', '', 'Vyqil Assistant')); var p = el('div', 'amt', priceText()); p.style.fontSize = '1.6rem'; c.appendChild(p);
      c.appendChild(el('p', 'hint', headline));
      ['Acts as your CEO, COO and CFO, and sees your whole business', 'Answers questions and writes full reports, proposals and plans you can save, print or send', 'Remembers your business, goals and preferences', 'Scan any contract, invoice or bill by photo and it fills in the form', '$3.00 of credits included every month; add more any time'].forEach(function (t) { var d = el('div', 'hint', '✓ ' + t); d.style.margin = '4px 0'; c.appendChild(d); });
      var b = el('button', 'btn', 'Add the Assistant'); b.type = 'button'; b.style.marginTop = '12px'; b.onclick = buy; c.appendChild(b); v.appendChild(c);
    }

    // ---------- the Assistant page ----------
    var BIG = /\b(analy[sz]e|analysis|report|forecast|strategy|strategic|compare|comparison|trend|trends|breakdown|overview|review my|how am i doing|how is my business|how are we doing|losing|lose money|leak|leaking|wasting|waste|profit|profitable|margin|cash ?flow|biggest|worst|best way|improve|grow|growth|should i (raise|hire|cut|drop|focus)|where (am|are|is|do|can)|why (am|are|is|did|do))\b/i;
    function isBig(t) { return t.length > 14 && BIG.test(t) && !/^\s*(write|draft|reply|send|remember|translate)\b/i.test(t); }
    var TYPES = [['overview', 'Business overview'], ['cashflow', 'Cash flow and money owed'], ['period', 'Period summary'], ['customers', 'Customer and sales analysis'], ['marketing', 'Marketing plan'], ['operations', 'Operations review'], ['proposal', 'Proposal for a customer'], ['custom', 'Something else (describe it)']];
    var PERIODS = [['month', 'This month'], ['lastmonth', 'Last month'], ['quarter', 'Last 3 months'], ['ytd', 'Year so far'], ['year', 'Last 12 months'], ['all', 'All time']];
    function runReport(type, period, custom) {
      return api('/report', { app: C.id, appName: C.name || 'Vyqil', bizId: S.biz.id, col: S.biz.col || 'records', schema: schema(), type: type, period: period, custom: custom || '', today: today() });
    }
    function errText(e) { return ((e && e.friendly) || 'Sorry, I could not finish that. Please try again in a minute.') + (e && e.detail ? '\n\n[Reason: ' + e.detail + ']' : ''); }
    var tab = 'chat', busy = false;
    function chatView(v) {
      v.appendChild(el('h2', '', 'Vyqil Assistant'));
      var holder = el('div'); holder.appendChild(el('p', 'hint', 'Checking your plan...')); v.appendChild(holder);
      api('/status', { app: C.id, bizId: S.biz.id, today: today() }).then(function (st) {
        holder.innerHTML = '';
        var justPaid = /[?&]paid=1/.test(location.search); if (!st.ok && justPaid && (window.__astRetry = (window.__astRetry || 0) + 1) <= 6) { holder.appendChild(el('p', 'hint', 'Thank you! Activating your plan... this takes a few seconds.')); setTimeout(function () { Q.render(); }, 3000); return; }
        if (!st.ok) { planCard(holder, 'The Assistant is an optional add-on. It is not part of the free beta trial of the apps.'); return; }
        lastCredits = st.credits || null;
        if (st.why === 'admin') { var ad = el('div', 'hint', 'Owner testing mode: the Assistant is free for you and uses no credits.'); ad.style.cssText = 'text-align:center;margin-bottom:6px'; holder.appendChild(ad); }
        else if (st.why === 'bonus') { var n = el('div', 'hint', 'Free Assistant time from Vyqil: ' + st.daysLeft + ' day' + (st.daysLeft === 1 ? '' : 's') + ' left. After that it is ' + priceText() + '.'); n.style.cssText = 'text-align:center;margin-bottom:6px'; var a = el('a', '', ' Add it now'); a.href = '#'; a.onclick = function (e) { e.preventDefault(); buy(); }; n.appendChild(a); holder.appendChild(n); }
        if (lastCredits) { meterEl = el('div', 'astmeter'); holder.appendChild(meterEl); var ac = el('a', '', ' Add credits'); ac.href = '#'; ac.onclick = function (e) { e.preventDefault(); addCredits(); }; meterEl.appendChild(ac); if (st.managed) { var mg = el('a', '', ' · Manage subscription'); mg.href = '#'; mg.onclick = function (e) { e.preventDefault(); manage(); }; meterEl.appendChild(mg); } paintMeter(); }
        var keys = ['chat', 'reports', 'saved', 'memory'], tabs = el('div', 'asttabs'), body = el('div');
        [['chat', 'Chat'], ['reports', 'Reports'], ['saved', 'Saved'], ['memory', 'Memory']].forEach(function (t) { var b = el('button', t[0] === tab ? 'on' : '', t[1]); b.type = 'button'; b.onclick = function () { tab = t[0]; [].forEach.call(tabs.children, function (x, i) { x.className = keys[i] === tab ? 'on' : ''; }); draw(); }; tabs.appendChild(b); });
        holder.appendChild(tabs); holder.appendChild(body);
        function draw() { body.innerHTML = ''; ({ chat: chatTab, reports: reportsTab, saved: savedTab, memory: memoryTab })[tab](body, st); }
        draw();
      }, function (e) { holder.innerHTML = ''; holder.appendChild(el('p', 'hint', errText(e))); });
    }
    function hkey() { return 'vq_asst_' + C.id + '_' + (S.biz && S.biz.id); }
    function loadH() { try { return JSON.parse(localStorage.getItem(hkey()) || '[]'); } catch (e) { return []; } }
    function saveH(h) { try { localStorage.setItem(hkey(), JSON.stringify(h.slice(-30))); } catch (e) { } }
    function chatTab(v) {
      var name = C.name || 'Vyqil', hist = loadH();
      var w = el('div', 'asst'), log = el('div', 'log'), chips = el('div', 'chips'); w.appendChild(log); w.appendChild(chips);
      function bubble(who, text) {
        var b = el('div', 'b ' + who, text);
        if (who === 'bot' && text.length > 80) {
          b.appendChild(el('br')); var cp = el('a', '', 'Copy'); cp.href = '#'; cp.onclick = function (e) { e.preventDefault(); try { navigator.clipboard.writeText(text); cp.textContent = 'Copied'; } catch (x) { cp.textContent = 'Could not copy'; } }; b.appendChild(cp);
          var sv = el('a', '', 'Save'); sv.href = '#'; sv.onclick = function (e) { e.preventDefault(); saveDoc(text.split('\n')[0].slice(0, 60), text, 'answer'); sv.textContent = 'Saved'; }; b.appendChild(sv);
        }
        log.appendChild(b); try { b.scrollIntoView({ block: 'nearest' }); } catch (e) { } return b;
      }
      if (!hist.length) bubble('bot', 'Hi, I am your ' + name + ' assistant. I can see your whole business: customers, work, money, dates and notes, and I remember what you tell me about it. Ask me anything, or open Reports for a full written report or proposal. I can read everything, but I cannot change anything.');
      hist.forEach(function (m) { bubble(m.role === 'user' ? 'me' : 'bot', m.content); });
      ['What needs my attention today?', 'Who owes me money?', 'Where am I losing the most money?', 'What am I forgetting?', 'How is my business doing?'].forEach(function (t) { var b = el('button', '', t); b.type = 'button'; b.onclick = function () { send(t); }; chips.appendChild(b); });
      var comp = el('div', 'comp'), ta = el('textarea'); ta.rows = 1; ta.maxLength = 800; ta.placeholder = 'Ask anything about your business...';
      var sb = el('button', 'btn', 'Send'); sb.type = 'button'; comp.appendChild(ta); comp.appendChild(sb); w.appendChild(comp);
      w.appendChild(el('div', 'fine', 'AI can make mistakes. Check amounts before relying on them. This assistant only knows this app.'));
      v.appendChild(w);
      var clr = el('button', 'btn ghost sm', 'Clear this chat'); clr.type = 'button'; clr.style.marginTop = '8px'; clr.onclick = function () { saveH([]); Q.render(); }; v.appendChild(clr);
      function done() { busy = false; sb.disabled = false; }
      function ask(t) {
        busy = true; sb.disabled = true; chips.style.display = 'none';
        var wait = el('div', 'b bot'); wait.innerHTML = '<span class="dots"><span></span><span></span><span></span></span>'; log.appendChild(wait); try { wait.scrollIntoView({ block: 'nearest' }); } catch (e) { }
        hist.push({ role: 'user', content: t });
        api('/chat', { app: C.id, appName: name, bizId: S.biz.id, col: S.biz.col || 'records', schema: schema(), messages: hist, today: today() }).then(function (d) {
          wait.remove(); var raw = String(d.reply || ''), notes = []; raw = raw.replace(/\[\[REMEMBER:\s*([^\]]+)\]\]/g, function (m, x) { notes.push(x); return ''; });
          var text = raw.replace(/\*\*/g, '').replace(/^#+\s*/gm, '').trim(); if (!text) throw { detail: 'empty answer' };
          hist.push({ role: 'assistant', content: text }); saveH(hist); bubble('bot', text); notes.slice(0, 2).forEach(addNote);
        }).catch(function (e) { wait.remove(); hist.pop(); bubble('bot', errText(e)); }).then(done);
      }
      function offer(t) { // a big "why / where / how am I doing" question: the owner chooses a simple answer or a full report
        busy = true; sb.disabled = true; chips.style.display = 'none';
        var b = el('div', 'b bot', 'That is a big question. Would you like a simple answer, or a full report?');
        var row = el('div', 'astchoice'), q = el('button', 'btn sm', 'Simple answer'), r = el('button', 'btn sm ghost', 'Full report'), ps = el('select'); ps.style.cssText = 'width:auto;margin:0;padding:6px 8px';
        PERIODS.forEach(function (p) { var o = el('option', '', p[1]); o.value = p[0]; ps.appendChild(o); }); ps.value = 'year';
        q.type = r.type = 'button'; row.appendChild(q); row.appendChild(r); row.appendChild(ps); b.appendChild(row); log.appendChild(b); try { b.scrollIntoView({ block: 'nearest' }); } catch (e) { }
        q.onclick = function () { b.remove(); ask(t); };
        r.onclick = function () {
          q.disabled = r.disabled = ps.disabled = true; r.textContent = 'Writing (up to a minute)...';
          runReport('custom', ps.value, t).then(function (d) {
            b.remove(); var doc = { title: d.title, body: d.body, kind: 'report', period: d.period }, note = 'I wrote a full report: "' + d.title + '".';
            hist.push({ role: 'user', content: t }); hist.push({ role: 'assistant', content: note }); saveH(hist);
            var m = bubble('bot', note), o = el('button', 'btn sm', 'Open the report'); o.type = 'button'; o.style.cssText = 'display:block;margin-top:8px'; o.onclick = function () { docView(doc); }; m.appendChild(o); docView(doc); done();
          }, function (e) { b.remove(); bubble('bot', errText(e)); done(); });
        };
      }
      function send(t) {
        t = (t || ta.value).trim(); if (!t || busy) return; ta.value = ''; bubble('me', t);
        if (/^remember\b[:,]?\s+/i.test(t)) { addNote(t.replace(/^remember\b[:,]?\s+(that\s+)?/i, '')); hist.push({ role: 'user', content: t }); hist.push({ role: 'assistant', content: 'Got it. I will remember that.' }); saveH(hist); bubble('bot', 'Got it. I will remember that. You can see or remove it under Memory.'); return; }
        if (isBig(t)) offer(t); else ask(t);
      }
      sb.onclick = function () { send(); };
      ta.onkeydown = function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
    }
    function reportsTab(v) {
      var c = el('div', 'card'); c.appendChild(el('h3', '', 'Create a report'));
      c.appendChild(el('p', 'hint', 'A full written document built from your real records: reports, plans and proposals you can save, print or download.'));
      function sel(label, opts) { var s = el('select'); opts.forEach(function (o) { var x = el('option', '', o[1]); x.value = o[0]; s.appendChild(x); }); var l = el('label', 'f', label); l.appendChild(s); c.appendChild(l); return s; }
      var ty = sel('What do you need?', TYPES), pe = sel('Time period', PERIODS), ta = el('textarea'); ta.rows = 3; ta.maxLength = 600; c.appendChild(ta);
      function sync() { var need = ty.value === 'proposal' || ty.value === 'custom'; ta.style.display = need ? '' : 'none'; ta.placeholder = ty.value === 'proposal' ? 'Who is it for, and what is the job? Add anything to include (scope, timeline, price).' : 'Describe what the report should cover.'; }
      ty.onchange = sync; sync(); var msg = el('p', 'hint'); c.appendChild(msg);
      var go = el('button', 'btn', 'Create report'); go.type = 'button'; c.appendChild(go); v.appendChild(c);
      go.onclick = function () {
        if (busy) return; busy = true; go.disabled = true; msg.textContent = 'Writing your report... this takes up to a minute.';
        runReport(ty.value, pe.value, ta.value).then(function (d) { busy = false; go.disabled = false; msg.textContent = ''; docView({ title: d.title, body: d.body, kind: ty.value === 'proposal' ? 'proposal' : 'report', period: d.period }); },
          function (e) { busy = false; go.disabled = false; msg.textContent = errText(e); });
      };
    }
    function savedTab(v) {
      v.appendChild(el('p', 'hint', 'Reports, proposals and answers you saved for this app.')); var list = el('div'); list.appendChild(el('p', 'hint', 'Loading...')); v.appendChild(list);
      bizRef().collection('aiDocs').where('app', '==', C.id).get().then(function (q) {
        var rows = []; q.forEach(function (d) { var x = d.data(); x.id = d.id; rows.push(x); }); rows.sort(function (a, b) { return ((b.createdAt && b.createdAt.seconds) || 0) - ((a.createdAt && a.createdAt.seconds) || 0); });
        list.innerHTML = ''; if (!rows.length) { list.appendChild(el('p', 'hint', 'Nothing saved yet. Save a report or an answer and it will appear here.')); return; }
        rows.slice(0, 60).forEach(function (d) { var r = el('div', 'astrow'), m = el('div', 'm'); m.appendChild(el('b', '', d.title)); m.appendChild(el('span', '', (d.kind || '') + (d.createdAt && d.createdAt.seconds ? ' · ' + new Date(d.createdAt.seconds * 1000).toLocaleDateString() : ''))); r.appendChild(m); var o = el('button', 'btn sm ghost', 'Open'); o.type = 'button'; o.onclick = function () { docView(d); }; r.appendChild(o); list.appendChild(r); });
      }, function () { list.innerHTML = ''; list.appendChild(el('p', 'hint', 'Could not load saved documents.')); });
    }
    function memoryTab(v) {
      v.appendChild(el('p', 'hint', 'This is what your assistant remembers about this business. It uses it in every chat and report. Only this app’s assistant sees it.'));
      var c = el('div', 'card'); c.appendChild(el('h3', '', 'About my business'));
      var pt = el('textarea'); pt.rows = 6; pt.maxLength = 3000; pt.placeholder = 'Describe your business: what you do, who your customers are, your prices and rules, your goals this year, and how you like things written (friendly, formal...).'; c.appendChild(pt);
      var sv = el('button', 'btn sm', 'Save'); sv.type = 'button'; sv.style.marginTop = '8px'; c.appendChild(sv); v.appendChild(c);
      var nc = el('div', 'card'); nc.appendChild(el('h3', '', 'Things I remember')); var nl = el('div'); nc.appendChild(nl);
      var ni = el('input'); ni.placeholder = 'Add something for me to remember...'; ni.maxLength = 300; nc.appendChild(ni); var na = el('button', 'btn sm ghost', 'Add'); na.type = 'button'; na.style.marginTop = '8px'; nc.appendChild(na); v.appendChild(nc);
      var notes = [];
      function drawNotes() {
        nl.innerHTML = ''; if (!notes.length) nl.appendChild(el('p', 'hint', 'Nothing yet. Tell the assistant "remember that..." in the chat, or add a note here.'));
        notes.forEach(function (n, i) { var r = el('div', 'astnote'); r.appendChild(el('span', '', n)); var x = el('button', '', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Forget this'); x.onclick = function () { var keep = notes.slice(); notes.splice(i, 1); memDoc().set({ notes: notes, updatedAt: Q.FV.serverTimestamp() }, { merge: true }).then(drawNotes, function () { notes = keep; Q.toast('Only owners and managers can change memory.'); }); }; r.appendChild(x); nl.appendChild(r); });
      }
      memDoc().get().then(function (d) { var x = d.exists ? d.data() : {}; pt.value = x.profile || ''; notes = (x.notes || []).slice(); drawNotes(); }, function () { drawNotes(); });
      sv.onclick = function () { memDoc().set({ profile: pt.value.slice(0, 3000), updatedAt: Q.FV.serverTimestamp() }, { merge: true }).then(function () { Q.toast('Saved. The assistant will use it from now on.'); }, function () { Q.toast('Only owners and managers can change memory.'); }); };
      na.onclick = function () { var t = ni.value.trim(); if (!t) return; notes.push(t.slice(0, 300)); memDoc().set({ notes: notes.slice(-60), updatedAt: Q.FV.serverTimestamp() }, { merge: true }).then(function () { ni.value = ''; drawNotes(); }, function () { notes.pop(); Q.toast('Only owners and managers can change memory.'); }); };
    }
    Q.views.assistant = chatView;
    Q.assistantBuy = buy; Q.assistantCredits = addCredits;

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
    // Opens the phone camera right inside the app (works even where the file picker ignores "take a photo").
    function liveCamera(onShot, fallback) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { fallback(); return; }
      navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1920 } }, audio: false }).then(function (stream) {
        var bg = el('div'); bg.style.cssText = 'position:fixed;inset:0;background:#000;z-index:200;display:flex;flex-direction:column';
        var v = document.createElement('video'); v.setAttribute('playsinline', ''); v.muted = true; v.autoplay = true; v.srcObject = stream; v.style.cssText = 'flex:1;min-height:0;width:100%;object-fit:contain;background:#000';
        var bar = el('div'); bar.style.cssText = 'display:flex;gap:10px;justify-content:center;align-items:center;padding:14px 12px calc(14px + env(safe-area-inset-bottom));background:#000';
        function stop() { try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { } bg.remove(); }
        var snap = el('button', 'btn', 'Take photo'), cn = el('button', 'btn ghost', 'Cancel'), up = el('button', 'btn ghost', 'Use a file instead');
        [snap, cn, up].forEach(function (b) { b.type = 'button'; bar.appendChild(b); });
        cn.onclick = stop; up.onclick = function () { stop(); fallback(); };
        snap.onclick = function () {
          if (!v.videoWidth) return; var c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0);
          c.toBlob(function (b) { stop(); if (b) onShot(new File([b], 'photo.jpg', { type: 'image/jpeg' })); else fallback(); }, 'image/jpeg', 0.92);
        };
        bg.appendChild(v); bg.appendChild(bar); document.body.appendChild(bg); v.play && v.play().catch(function () { });
      }, function () { fallback(); });
    }
    function scanFlow(prefer, closeForm) {
      Q.modal(function (s, close) {
        s.appendChild(el('h3', '', 'Scan a document'));
        s.appendChild(el('p', 'hint', 'Take a clear, straight-on photo of a contract, lease, invoice, estimate, receipt or bill. Vyqil reads it and fills in the form. Anything it cannot read is left blank for you to complete.'));
        var sel = el('select'); var a = el('option', '', 'Let Vyqil decide what it is'); a.value = ''; sel.appendChild(a);
        scanAll().forEach(function (k) { var o = el('option', '', C.kinds[k].label); o.value = k; sel.appendChild(o); }); if (prefer) sel.value = prefer;
        var lab = el('label', 'f', 'This is a'); lab.appendChild(sel); s.appendChild(lab);
        var msg = el('div', 'hint'); msg.style.margin = '8px 0';
        function pick(cam) {
          function fileInput(capture) { var i = document.createElement('input'); i.type = 'file'; i.accept = 'image/jpeg,image/png,image/webp,image/heic,image/*'; if (capture) i.setAttribute('capture', 'environment'); i.style.cssText = 'position:fixed;left:-9999px;opacity:0'; document.body.appendChild(i); i.onchange = function () { var f = i.files && i.files[0]; i.remove(); if (f) run(f); }; i.click(); }
          if (!cam) { fileInput(false); return; }
          liveCamera(function (file) { run(file); }, function () { fileInput(true); });
        }
        var b1 = el('button', 'btn', 'Take a photo'), b2 = el('button', 'btn ghost', 'Choose a photo'), cn = el('button', 'btn ghost', 'Cancel');
        [b1, b2, cn].forEach(function (b) { b.type = 'button'; b.style.margin = '4px 6px 4px 0'; }); b1.onclick = function () { pick(true); }; b2.onclick = function () { pick(false); }; cn.onclick = close;
        var bw = el('div'); bw.appendChild(b1); bw.appendChild(b2); bw.appendChild(cn); s.appendChild(msg); s.appendChild(bw);
        function run(file) {
          bw.style.display = 'none'; msg.textContent = 'Reading your document... this can take up to a minute.';
          shrink(file).then(function (img) { return api('/scan', { app: C.id, bizId: S.biz.id, schema: schema(scanAll()), image: img, today: new Date().toISOString().slice(0, 10), hint: sel.value ? C.kinds[sel.value].label : '' }); })
            .then(function (d) { close(); if (closeForm) closeForm(); review(d.result, sel.value); })
            .catch(function (e) { msg.textContent = (e && (e.message || e.friendly)) ? (e.message || e.friendly) + (e.detail ? ' [' + e.detail + ']' : '') : 'Sorry, that did not work. ' + ((e && e.detail) || ''); bw.style.display = ''; });
        }
      });
    }
    function review(res, prefer) {
      var kind = C.kinds[res.kind] ? res.kind : (prefer && C.kinds[prefer] ? prefer : scanAll()[0]);
      Q.modal(function (s, close) {
        s.appendChild(el('h3', '', 'Here is what I found'));
        if (res.title) s.appendChild(el('p', 'hint', res.title));
        var sel = el('select'); scanAll().forEach(function (k) { var o = el('option', '', C.kinds[k].label); o.value = k; sel.appendChild(o); }); sel.value = kind;
        var lab = el('label', 'f', 'Save it as'); lab.appendChild(sel); s.appendChild(lab);
        var box = el('div'), picks = {}; s.appendChild(box);
        function draw() {
          box.innerHTML = ''; var kd = C.kinds[sel.value], pr = preset(sel.value, res), shown = 0;
          kd.fields.forEach(function (f) { if (pr.p[f.k] == null || f.t === 'area') return; var v = pr.p[f.k]; if (f.t === 'money') v = Q.tools && Q.tools.cents ? '$' + (v / 100).toFixed(2) : v; if (f.t === 'link') v = Q.title(Q.get(v)); var r = el('div', 'scanrow'); r.appendChild(el('span', '', f.l)); r.appendChild(el('b', '', String(v))); box.appendChild(r); shown++; });
          if (!shown) box.appendChild(el('p', 'hint', 'I could not read specific fields, but I saved the text of the document so you can copy from it.'));
          // Which job / property / client / group does this belong to? Let the person pick it right here.
          picks = {}; kd.fields.forEach(function (f) {
            if (f.t !== 'link' || !f.to || !C.kinds[f.to]) return; var list = Q.byKind(f.to).slice().sort(function (x, y) { return String(Q.title(x)).localeCompare(String(Q.title(y))); }); if (!list.length) return;
            var ls = el('select'), o0 = el('option', '', 'None / not sure'); o0.value = ''; ls.appendChild(o0);
            list.slice(0, 300).forEach(function (r) { var o = el('option', '', Q.title(r)); o.value = r.id; ls.appendChild(o); });
            ls.value = pr.p[f.k] || ''; picks[f.k] = ls; var ll = el('label', 'f', 'Belongs to: ' + f.l.toLowerCase()); ll.appendChild(ls); ll.style.display = 'block'; ll.style.marginTop = '10px'; box.appendChild(ll);
          });
          pr.notes = pr.notes.filter(function (n) { return !/^Pick the /.test(n); });
          var miss = (res.missing || []).concat(pr.notes); if (miss.length) { var m = el('p', 'hint', 'Still needed from you: ' + miss.join('; ') + '.'); m.style.marginTop = '10px'; box.appendChild(m); }
          if (res.note) box.appendChild(el('p', 'hint', res.note));
        }
        sel.onchange = draw; draw();
        s.appendChild(el('p', 'hint', 'Check everything against the original before saving. The form opens next so you can fix or finish anything.'));
        var go = el('button', 'btn', 'Open the form'), cn = el('button', 'btn ghost', 'Cancel'); go.type = cn.type = 'button'; go.style.marginRight = '8px';
        go.onclick = function () { var pp = preset(sel.value, res).p; Object.keys(picks).forEach(function (k) { if (picks[k].value) pp[k] = picks[k].value; else delete pp[k]; }); close(); Q.openForm(sel.value, null, pp); }; cn.onclick = close;
        var bw = el('div'); bw.appendChild(go); bw.appendChild(cn); s.appendChild(bw);
      });
    }
    Q.scanFlow = scanFlow;
    Q.scanButton = function (kind, closeForm) { var b = el('button', 'btn ghost sm', '📷 Fill from a photo'); b.type = 'button'; b.style.margin = '0 0 10px'; b.onclick = function () { scanFlow(kind, closeForm); }; return b; };
    Q.assistantMenu = function () { return [{ l: 'Vyqil Assistant', tab: 'assistant' }, { l: 'Scan a document', run: function () { scanFlow(''); } }]; };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 0); }); else setTimeout(start, 0);
})();
