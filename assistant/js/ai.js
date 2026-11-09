// VyqilAssistant AI: the Ask chat, the "type or say it" quick add, and the first-use notice.
(function () {
  var VA = window.VA, esc = VA.esc, S = VA.S;
  var AI = VA.ai = { log: [], busy: false, consent: null };
  var NOTICE = 'VyqilAssistant sends a short summary of your household (appointments, bills, tasks, lists, meals and spending totals) to an AI service when you ask it something or use Quick add. It never sends passwords, and it cannot change or pay anything. Answers can be wrong, so check important dates and amounts. It is not a doctor, lawyer, tax or financial advisor. Do not type card numbers, ID numbers or passwords into the chat.';

  function url() { return (window.VYRO_HELP_URL || '').replace(/\/$/, '') + '/life'; }
  function token() { return S.user.getIdToken(); }

  // The text the AI is allowed to see. Totals are worked out here so the AI only has to copy them.
  AI.context = function () {
    var d = S.data, t = VA.today(), L = [], m = VA.money;
    L.push('Household: ' + ((S.hh && S.hh.name) || 'Household') + '. Signed-in person: ' + VA.me() + '. Members: ' + VA.who().join(', ') + '.');
    d.people.forEach(function (p) { L.push('Person: ' + p.name + ' (' + p.role + ')' + (p.birthday ? ', birthday ' + p.birthday : '') + (p.allergies ? ', allergies ' + p.allergies : '') + (p.school ? ', school ' + p.school : '') + (p.doctor ? ', doctor ' + p.doctor : '')); });
    var late = VA.late(); if (late.length) { L.push('LATE / OVERDUE:'); late.slice(0, 25).forEach(function (o) { L.push('- ' + o.kind + ': ' + o.title + ' was due ' + o.date + (o.who ? ' (' + o.who + ')' : '')); }); }
    var up = VA.occ(t, VA.addDays(t, 30)); L.push('COMING UP (next 30 days):');
    up.slice(0, 60).forEach(function (o) { L.push('- ' + o.date + ' (' + VA.dow(o.date) + ')' + (o.time ? ' ' + o.time : '') + ' ' + o.kind + ': ' + o.title + (o.who ? ' [' + o.who + ']' : '')); });
    var due30 = 0, mon = 0; d.bills.forEach(function (b) { if (!b.paid) { var a = b.amount || 0; mon += b.repeat === 'weekly' ? a * 52 / 12 : b.repeat === 'yearly' ? a / 12 : b.repeat === 'once' ? 0 : a; } });
    up.forEach(function (o) { if (o.kind === 'bill') due30 += o.ref.amount || 0; });
    L.push('BILLS AND SUBSCRIPTIONS (' + d.bills.filter(function (b) { return !b.paid; }).length + '). Recurring total about ' + m(Math.round(mon)) + ' per month. Due in next 30 days: ' + m(due30) + '.');
    d.bills.filter(function (b) { return !b.paid; }).slice(0, 40).forEach(function (b) { L.push('- ' + b.name + ' ' + m(b.amount) + ' ' + b.repeat + ', next due ' + b.dueDate + ', category ' + b.category + (b.autopay ? ', autopay' : '') + (b.trialEnds ? ', free trial ends ' + b.trialEnds : '')); });
    var tk = d.tasks.filter(function (x) { return !x.done; }); L.push('OPEN TASKS (' + tk.length + '):'); tk.slice(0, 30).forEach(function (x) { L.push('- ' + x.title + (x.who ? ' [' + x.who + ']' : '') + (x.due ? ' due ' + x.due : '') + (x.repeat && x.repeat !== 'none' ? ' repeats ' + x.repeat : '')); });
    VA.LISTS.forEach(function (n) { var it = d.items.filter(function (x) { return x.list === n && !x.done; }); if (it.length) L.push(n.toUpperCase() + ' LIST: ' + it.slice(0, 40).map(function (x) { return x.text; }).join(', ')); });
    var ws = VA.addDays(t, -((VA.parse(t).getDay() + 6) % 7)), meals = d.meals.filter(function (x) { return x.date >= ws && x.date <= VA.addDays(ws, 13); }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    if (meals.length) { L.push('MEALS:'); meals.forEach(function (x) { L.push('- ' + x.date + ' ' + x.slot + ': ' + x.text); }); }
    function ymSum(ym) { var sp = 0, ea = 0, by = {}; d.txns.forEach(function (x) { if ((x.date || '').slice(0, 7) === ym) { if (x.type === 'income') ea += x.amount || 0; else { sp += x.amount || 0; by[x.category || 'Other'] = (by[x.category || 'Other'] || 0) + (x.amount || 0); } } }); return { sp: sp, ea: ea, by: by }; }
    var cur = ymSum(t.slice(0, 7)), prevYm = VA.addMonths(t.slice(0, 7) + '-01', -1).slice(0, 7), pr = ymSum(prevYm);
    L.push('MONEY this month: spent ' + m(cur.sp) + ', received ' + m(cur.ea) + '. By category: ' + (Object.keys(cur.by).map(function (k) { return k + ' ' + m(cur.by[k]); }).join(', ') || 'none') + '. Last month spent ' + m(pr.sp) + ' (' + Object.keys(pr.by).map(function (k) { return k + ' ' + m(pr.by[k]); }).join(', ') + ').');
    var bu = (S.hh && S.hh.budgets) || {}; if (Object.keys(bu).length) L.push('BUDGETS per month: ' + Object.keys(bu).map(function (k) { return k + ' ' + m(bu[k]); }).join(', '));
    d.goals.forEach(function (g) { L.push('GOAL ' + g.name + ': saved ' + m(g.saved) + ' of ' + m(g.target) + (g.by ? ' by ' + g.by : '')); });
    var hc = d.home.map(function (h) { return { h: h, n: VA.homeNext(h) }; }).filter(function (x) { return x.n && x.n <= VA.addDays(t, 45); }); if (hc.length) { L.push('HOME CARE DUE SOON:'); hc.forEach(function (x) { L.push('- ' + x.h.name + ' next ' + x.n); }); }
    var ex = d.notes.filter(function (n) { return n.expires && n.expires <= VA.addDays(t, 60); }); if (ex.length) { L.push('RECORDS EXPIRING:'); ex.forEach(function (n) { L.push('- ' + n.title + ' ' + n.expires); }); }
    (d.trips || []).filter(function (x) { return (x.end || x.start || '') >= t; }).slice(0, 6).forEach(function (x) { L.push('TRIP ' + x.name + (x.dest ? ' to ' + x.dest : '') + ' ' + x.start + (x.end && x.end !== x.start ? ' to ' + x.end : '') + (x.who ? ' with ' + x.who : '') + (x.budget ? ', budget ' + m(x.budget) : '') + ', costs so far ' + m(VA.trips.total(x)) + ', ' + VA.trips.packLeft(x) + ' packing items left'); });
    var dbt = (d.debts || []); if (dbt.length) { L.push('DEBTS (' + dbt.length + '):'); dbt.slice(0, 12).forEach(function (x) { L.push('- ' + x.name + ' owes ' + m(x.balance) + ', ' + x.apr + '% yearly interest, minimum ' + m(x.minPay)); }); }
    var txt = L.join('\n'); return txt.length > 8800 ? txt.slice(0, 8800) + '\n(summary shortened)' : txt;
  };

  function ensureConsent() {
    return new Promise(function (resolve) {
      if (AI.consent === true) return resolve(true);
      var ref = VA.db().collection('users').doc(S.user.uid).collection('consents').doc('life_v1');
      ref.get().then(function (d) { if (d.exists) { AI.consent = true; return resolve(true); } ask(); }).catch(function () { ask(); });
      function ask() {
        VA.modal('<h3>Before you use the assistant</h3><p style="line-height:1.5">' + esc(NOTICE) + '</p><div class="btns"><button class="btn" id="cOk" type="button">I understand, turn it on</button><button class="btn ghost" id="cNo" type="button">Not now</button></div><p class="hint" id="cErr" style="color:#ff8a8a"></p>', function (s, close) {
          s.querySelector('#cNo').onclick = function () { close(); resolve(false); };
          s.querySelector('#cOk').onclick = function () {
            ref.set({ kind: 'assistant', scope: 'life', version: 1, textHash: 'vqa-life-1', uid: S.user.uid, acceptedAt: firebase.firestore.FieldValue.serverTimestamp() })
              .then(function () { AI.consent = true; close(); resolve(true); })
              .catch(function (e) { s.querySelector('#cErr').textContent = 'Could not save your choice (' + (e && e.code || 'error') + '). Publish the latest firestore.rules.'; });
          };
        });
      }
    });
  }
  function call(body) {
    return ensureConsent().then(function (ok) {
      if (!ok) return { cancelled: true };
      if (!window.VYRO_HELP_URL) return { error: 'The helper address is not set (shared/helpbot-config.js).' };
      return token().then(function (tk) {
        var n = new Date(); body.today = VA.ymd(n); body.weekday = VA.DOW[n.getDay()];
        return fetch(url(), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk }, body: JSON.stringify(body) }).then(function (r) { return r.json().catch(function () { return { error: 'bad answer' }; }).then(function (j) { j._status = r.status; return j; }); });
      }).catch(function (e) { return { error: 'Could not reach the assistant. Check your internet and try again.' }; });
    });
  }
  function why(j) {
    if (j.error === 'limit') return 'You reached today\'s limit for the assistant (' + (j.limit || '') + '). It resets tomorrow.';
    if (j.error === 'consent') { AI.consent = null; return 'Please accept the assistant notice first.'; }
    if (j.error === 'signin') return 'Please sign in again.';
    return (j.detail || j.error || 'The assistant is busy. Try again in a moment.');
  }

  AI.send = function (text, deep) {
    text = String(text || '').trim(); if (!text || AI.busy) return;
    AI.log.push({ role: 'user', content: text }); AI.busy = true; VA.render();
    call({ mode: 'chat', deep: !!deep, messages: AI.log.filter(function (m) { return !m.err; }).slice(-8), context: AI.context() }).then(function (j) {
      AI.busy = false;
      if (j.cancelled) { AI.log.pop(); }
      else if (j.reply) AI.log.push({ role: 'assistant', content: j.reply });
      else AI.log.push({ role: 'assistant', content: why(j), err: true });
      VA.render(); var l = document.querySelector('.chat'); if (l) window.scrollTo(0, document.body.scrollHeight);
    });
  };

  // ---- speech to text (the phone's own recognizer; nothing is recorded or sent by us) ----
  VA.mic = function (input, btn) {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { btn.style.display = 'none'; return; }
    var rec = null, on = false;
    btn.onclick = function () {
      if (on && rec) { rec.stop(); return; }
      rec = new SR(); rec.lang = navigator.language || 'en-US'; rec.interimResults = true; rec.continuous = false;
      var base = input.value ? input.value + ' ' : '';
      rec.onresult = function (e) { var t = ''; for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; input.value = base + t; };
      rec.onend = function () { on = false; btn.textContent = '\u{1F3A4}'; btn.style.background = ''; };
      rec.onerror = function (e) { on = false; btn.textContent = '\u{1F3A4}'; VA.toast(e && e.error === 'not-allowed' ? 'Allow the microphone for this site in your browser settings.' : 'Could not hear that. Try again.'); };
      try { rec.start(); on = true; btn.textContent = '■'; btn.style.background = '#c0392b'; } catch (e) { on = false; }
    };
  };

  // ---------------- ASK screen ----------------
  var CHIPS = ['What do I need to do this week?', 'Which bills are due soon?', 'Where can I save money?', 'What did we spend this month?', 'Suggest dinners for this week', 'Anything I might be forgetting?'];
  VA.views.ask = function (root) {
    var h = '<h2 style="margin-top:6px">Ask VyqilAssistant<small>private to your household</small></h2>';
    if (!AI.log.length) h += '<div class="card"><b>Your life manager, one question away.</b><div class="hint" style="margin:6px 0">It knows your calendar, bills, tasks, lists, meals and spending. Ask in your own words, by typing or tapping the microphone.</div><div class="chips">' + CHIPS.map(function (c) { return '<button data-q="' + esc(c) + '" type="button">' + esc(c) + '</button>'; }).join('') + '</div></div>';
    h += '<div class="chat">' + AI.log.map(function (m) { return '<div class="msg ' + (m.role === 'user' ? 'u' : 'a') + '"' + (m.err ? ' style="color:#ff8a8a"' : '') + '>' + esc(m.content) + '</div>'; }).join('') + (AI.busy ? '<div class="msg a hint">Thinking...</div>' : '') + '</div>';
    var last = AI.log[AI.log.length - 1];
    if (last && last.role === 'assistant' && !last.err && !AI.busy) h += '<div class="chips"><button data-deep="1" type="button">Think harder</button><button data-clear="1" type="button">Start over</button></div>';
    h += '<div class="composer"><textarea id="askIn" placeholder="Ask anything about your week, bills or money..." rows="1"></textarea><button class="ibtn" id="askMic" type="button" aria-label="Speak">\u{1F3A4}</button><button class="btn" id="askGo" type="button"' + (AI.busy ? ' disabled' : '') + '>Send</button></div><p class="hint" style="text-align:center">Answers can be wrong. Check important dates and amounts. This chat is not saved after you close the app.</p>';
    root.innerHTML = h;
    var inp = root.querySelector('#askIn');
    root.querySelector('#askGo').onclick = function () { var v = inp.value; inp.value = ''; AI.send(v); };
    inp.onkeydown = function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); root.querySelector('#askGo').click(); } };
    VA.mic(inp, root.querySelector('#askMic'));
    root.querySelectorAll('[data-q]').forEach(function (b) { b.onclick = function () { AI.send(b.getAttribute('data-q')); }; });
    var dp = root.querySelector('[data-deep]'); if (dp) dp.onclick = function () { var u = AI.log.filter(function (m) { return m.role === 'user'; }).pop(); if (u) { AI.log.pop(); AI.send(u.content, true); } };
    var cl = root.querySelector('[data-clear]'); if (cl) cl.onclick = function () { AI.log = []; VA.render(); };
  };

  // ---------------- Quick add ----------------
  var MAPCOL = { event: 'events', bill: 'bills', txn: 'txns', task: 'tasks', item: 'items', meal: 'meals', home: 'home', note: 'notes' };
  function label(k, d) {
    if (k === 'event') return '\u{1F4C5} ' + d.title + ' · ' + VA.fmtShort(d.date) + (d.time ? ' ' + VA.fmtTime(d.time) : '') + (d.who ? ' · ' + d.who : '');
    if (k === 'bill') return '\u{1F4B2} Bill: ' + d.name + ' ' + VA.money(d.amount) + ' · due ' + VA.fmtShort(d.dueDate) + ' · ' + d.repeat;
    if (k === 'txn') return '\u{1F9FE} ' + (d.type === 'income' ? 'Received ' : 'Spent ') + VA.money(d.amount) + ' · ' + (d.note || d.category);
    if (k === 'task') return '✅ Task: ' + d.title + (d.due ? ' · ' + VA.fmtShort(d.due) : '') + (d.who ? ' · ' + d.who : '');
    if (k === 'item') return '\u{1F6D2} ' + d.list + ': ' + d.text;
    if (k === 'meal') return '\u{1F37D} ' + d.slot + ' ' + VA.fmtShort(d.date) + ': ' + d.text;
    if (k === 'home') return '\u{1F527} ' + d.name + ' every ' + d.everyDays + ' days';
    return '\u{1F4C4} ' + d.title;
  }
  function saveCaptured(k, d) {
    var o = Object.assign({}, d);
    if (k === 'bill') o.paid = false; if (k === 'task' || k === 'item') o.done = false;
    return VA.save(MAPCOL[k], null, o);
  }
  function preview(items) {
    var conv = items.map(VA.fromCapture);
    var html = '<h3>Add these?</h3><div class="hint">Check what is right. Tap a line to fix it first.</div><div id="pv">' + conv.map(function (c, i) { return '<div class="row"><input type="checkbox" data-i="' + i + '" checked><div class="m" data-e="' + i + '" style="cursor:pointer"><b>' + esc(label(c.kind, c.data)) + '</b></div></div>'; }).join('') + '</div><div class="btns"><button class="btn" id="pvOk" type="button">Save selected</button><button class="btn ghost" id="pvNo" type="button">Cancel</button></div>';
    VA.modal(html, function (s, close) {
      s.querySelectorAll('[data-e]').forEach(function (e) { e.onclick = function () {
        var c = conv[+e.getAttribute('data-e')]; var form = { event: 'event', bill: 'bill', txn: 'txn', task: 'task', item: 'item', meal: 'meal', home: 'home', note: 'note' }[c.kind];
        VA.openForm(form, null, c.data).then(function (id) { if (id) { var cb = s.querySelector('[data-i="' + e.getAttribute('data-e') + '"]'); cb.checked = false; e.querySelector('b').style.textDecoration = 'line-through'; e.querySelector('b').textContent = 'Saved: ' + label(c.kind, c.data); cb.disabled = true; } });
      }; });
      s.querySelector('#pvNo').onclick = close;
      s.querySelector('#pvOk').onclick = function () {
        var jobs = []; s.querySelectorAll('input[data-i]').forEach(function (cb) { if (cb.checked && !cb.disabled) { var c = conv[+cb.getAttribute('data-i')]; jobs.push(saveCaptured(c.kind, c.data)); } });
        Promise.all(jobs).then(function () { close(); VA.toast(jobs.length + ' saved'); });
      };
    });
  }
  VA.quickAdd = function () {
    var kinds = [['event', '\u{1F4C5} Appointment'], ['bill', '\u{1F4B2} Bill'], ['task', '✅ Task'], ['txn', '\u{1F9FE} Spending'], ['meal', '\u{1F37D} Meal'], ['person', '\u{1F46A} Person'], ['home', '\u{1F527} Home care'], ['note', '\u{1F4C4} Record']];
    VA.modal('<h3>Quick add</h3><label class="f">Say it or type it. You can add several things at once.</label><textarea id="qa" placeholder="Mia dentist next Tuesday at 3, rent $1450 due the 1st, buy milk and eggs..."></textarea><div class="btns"><button class="btn ghost" id="qaMic" type="button" style="flex:0 0 52px">\u{1F3A4}</button><button class="btn" id="qaGo" type="button">Add with AI</button></div><p class="hint" id="qaMsg"></p><label class="f">Or add by hand</label><div class="chips">' + kinds.map(function (k) { return '<button data-k="' + k[0] + '" type="button">' + k[1] + '</button>'; }).join('') + '</div><div class="btns"><button class="btn ghost" id="qaX" type="button">Close</button></div>', function (s, close) {
      var ta = s.querySelector('#qa'); VA.mic(ta, s.querySelector('#qaMic'));
      s.querySelector('#qaX').onclick = close;
      s.querySelectorAll('[data-k]').forEach(function (b) { b.onclick = function () { close(); VA.openForm(b.getAttribute('data-k')); }; });
      s.querySelector('#qaGo').onclick = function () {
        var v = ta.value.trim(); if (!v) return; var go = s.querySelector('#qaGo'), msg = s.querySelector('#qaMsg'); go.disabled = true; msg.textContent = 'Sorting that out...';
        call({ mode: 'capture', messages: [{ role: 'user', content: v }], people: VA.who().join(', ') }).then(function (j) {
          go.disabled = false;
          if (j.cancelled) { msg.textContent = ''; return; }
          if (j.items && j.items.length) { close(); preview(j.items); } else if (j.items) msg.textContent = 'I did not find anything to add in that. Try adding a date or a name.'; else msg.textContent = why(j);
        });
      };
    });
  };
})();
