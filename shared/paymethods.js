// "How customers can pay you": the business lists the payment methods it already uses (PayPal, Venmo, Cash App, Zelle, a Square or
// Stripe payment link, check, cash...). Vyqil shows them to the customer on invoices and portals. Vyqil does not touch this money:
// the customer pays the business directly, and the business marks the invoice paid.
(function () {
  var TYPES = [
    ['link', 'Card or online payment link', 'Paste the link (starts with https://). Square, Stripe, PayPal, QuickBooks and others all give you one.'],
    ['paypal', 'PayPal', 'Your PayPal link (https://paypal.me/yourname) or the email on your PayPal.'],
    ['venmo', 'Venmo', 'Your Venmo name (like @yourname) or link.'],
    ['cashapp', 'Cash App', 'Your $cashtag or link.'],
    ['zelle', 'Zelle', 'The email or phone number your Zelle is under.'],
    ['ach', 'Bank transfer', 'Say how to send it (for example: ask us for our bank details).'],
    ['check', 'Check', 'Who to make it out to and where to mail it.'],
    ['cash', 'Cash', 'For example: cash accepted in person.'],
    ['other', 'Other', 'Tell customers how to pay.']
  ];
  function nameOf(t) { for (var i = 0; i < TYPES.length; i++) if (TYPES[i][0] === t) return TYPES[i][1]; return 'Other'; }
  function hintOf(t) { for (var i = 0; i < TYPES.length; i++) if (TYPES[i][0] === t) return TYPES[i][2]; return ''; }
  function isLink(v) { return /^https:\/\/[^\s]+$/i.test(String(v || '')); }
  function clean(list) {
    var out = []; (Array.isArray(list) ? list : []).slice(0, 6).forEach(function (m) {
      if (!m || typeof m !== 'object') return; var t = String(m.t || 'other'); if (!TYPES.some(function (x) { return x[0] === t; })) t = 'other';
      var v = String(m.v || '').trim().slice(0, 200), n = String(m.n || '').trim().slice(0, 160);
      if (t === 'link' && v && !isLink(v)) return; if (!v && !n) return;
      out.push({ t: t, v: v, n: n });
    }); return out;
  }
  var BRAND = { link: ['#2b7bd8', 'Card'], paypal: ['#0070e0', 'PayPal'], venmo: ['#3d95ce', 'Venmo'], cashapp: ['#00b82b', 'Cash App'], zelle: ['#6d1ed4', 'Zelle'], ach: ['#5b6b7c', 'Bank'], check: ['#8a7a4a', 'Check'], cash: ['#4a8a5c', 'Cash'], other: ['#5b6b7c', 'Other'] };
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  // Plain text for emails and messages.
  function text(list) {
    var L = clean(list); if (!L.length) return '';
    return 'How to pay:\n' + L.map(function (m) { return '- ' + nameOf(m.t) + (m.v ? ': ' + m.v : '') + (m.n ? ' (' + m.n + ')' : ''); }).join('\n');
  }

  var st = document.createElement('style');
  st.textContent = '.vqpm{background:#0C1117;border:1px solid rgba(201,209,217,.14);border-radius:16px;padding:16px;margin:14px 0;color:#C9D1D9;font:15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;text-align:left}' +
    '.vqpm h2{margin:0 0 4px;color:#fff;font-size:.95rem;letter-spacing:.08em;text-transform:uppercase}.vqpm .vqh{color:#8B96A3;font-size:.84rem;margin:0 0 12px}' +
    '.vqpm .vqm{display:flex;align-items:center;gap:12px;background:rgba(5,7,10,.55);border:1px solid rgba(201,209,217,.14);border-radius:14px;padding:12px;margin:10px 0}' +
    '.vqpm .vqb{flex:0 0 auto;min-width:46px;height:46px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:.7rem;letter-spacing:.02em;text-align:center;padding:0 4px;box-sizing:border-box}' +
    '.vqpm .vqt{flex:1;min-width:0}.vqpm .vqt b{display:block;color:#fff;font-size:.95rem}.vqpm .vqt span{display:block;color:#8B96A3;font-size:.8rem;word-break:break-word}' +
    '.vqpm .vqgo{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 16px;border-radius:12px;border:1px solid transparent;color:#fff;font:700 .82rem system-ui,sans-serif;text-decoration:none;cursor:pointer;white-space:nowrap}' +
    '.vqpm .vqgo.ghost{background:transparent;border-color:rgba(201,209,217,.3);color:#C9D1D9}' +
    '.vqpm .vqtip{color:#8B96A3;font-size:.78rem;margin:2px 0 0}' +
    '.vqpm label{display:block;margin:10px 0 4px;color:#8B96A3;font-size:.72rem;font-weight:600;letter-spacing:.12em;text-transform:uppercase}' +
    '.vqpm select,.vqpm input{width:100%;box-sizing:border-box;background:rgba(5,7,10,.7);border:1px solid rgba(201,209,217,.14);color:#fff;border-radius:12px;padding:12px;font:16px system-ui,sans-serif;min-height:44px;outline:none;color-scheme:dark}' +
    '.vqpm select:focus,.vqpm input:focus{border-color:#4B9CD3;box-shadow:0 0 14px rgba(75,156,211,.45)}' +
    '.vqpm .vqed{border:1px solid rgba(201,209,217,.14);border-radius:14px;padding:12px;margin:10px 0;background:rgba(5,7,10,.4)}' +
    '.vqpm .vqbtn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 18px;border-radius:12px;border:1px solid #4B9CD3;background:linear-gradient(180deg,rgba(75,156,211,.25),rgba(75,156,211,.08));color:#fff;font:700 .8rem system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;margin:8px 8px 0 0}' +
    '.vqpm .vqbtn.ghost{background:transparent;border-color:rgba(201,209,217,.3);color:#C9D1D9}.vqpm .vqbtn:disabled{opacity:.5}' +
    '.vqpm .vqmsg{margin-top:10px;font-size:.84rem;color:#8B96A3}.vqpm .vqmsg.err{color:#ff8a8a}';
  document.head.appendChild(st);
  function enc(x) { return encodeURIComponent(x); }
  function amt(c) { c = Math.round(Number(c) || 0); return c > 0 ? (c / 100).toFixed(2) : ''; }
  // Where the "Open ..." button goes. Cash App, Venmo and PayPal open straight to the person with the amount filled in.
  // Zelle has no web link that works for everyone, so it copies the address and tells the customer where to paste it.
  function target(m, o) {
    var v = String(m.v || '').trim(), a = amt(o && o.amountCents), note = (o && o.note) || '';
    if (m.t === 'link' && isLink(v)) return { href: v, label: 'Pay by card' };
    if (m.t === 'cashapp') {
      if (isLink(v)) return { href: v, label: 'Open Cash App' };
      var tag = v.replace(/^\$/, '').replace(/[^A-Za-z0-9_]/g, ''); if (!tag) return null;
      return { href: 'https://cash.app/$' + tag + (a ? '/' + a : ''), label: 'Open Cash App' };
    }
    if (m.t === 'venmo') {
      if (isLink(v)) return { href: v, label: 'Open Venmo' };
      var u = v.replace(/^@/, '').replace(/[^A-Za-z0-9_-]/g, ''); if (!u) return null;
      return { href: 'https://venmo.com/u/' + u + '?txn=pay' + (a ? '&amount=' + a : '') + (note ? '&note=' + enc(note) : ''), label: 'Open Venmo' };
    }
    if (m.t === 'paypal') {
      if (isLink(v)) { var pm = /^https:\/\/(www\.)?paypal\.me\/([A-Za-z0-9._-]+)\/?$/i.exec(v); return { href: pm && a ? 'https://www.paypal.me/' + pm[2] + '/' + a + 'USD' : v, label: 'Open PayPal' }; }
      if (/^[A-Za-z0-9._-]+$/.test(v)) return { href: 'https://www.paypal.me/' + v + (a ? '/' + a + 'USD' : ''), label: 'Open PayPal' };
      return null;
    }
    return null;
  }
  function copy(btn, text, done) { try { navigator.clipboard.writeText(text).then(function () { btn.textContent = done; setTimeout(function () { btn.textContent = 'Copy'; }, 1800); }); } catch (e) { /* ignore */ } }
  // What the customer sees. opts: title, intro, cls (ignored), amountCents (fills the amount in), note.
  function view(host, list, opts) {
    var L = clean(list); if (!L.length) return null; opts = opts || {};
    var box = el('div', 'vqpm'); box.appendChild(el('h2', '', opts.title || 'Pay now'));
    box.appendChild(el('div', 'vqh', opts.intro || 'Choose how you would like to pay. It opens right to the payment, then they mark your invoice paid.'));
    L.forEach(function (m) {
      var br = BRAND[m.t] || BRAND.other, row = el('div', 'vqm'), badge = el('div', 'vqb', br[1]); badge.style.background = br[0]; row.appendChild(badge);
      var left = el('div', 'vqt'); left.appendChild(el('b', '', nameOf(m.t)));
      var tg = target(m, opts);
      if (m.v && !isLink(m.v)) left.appendChild(el('span', '', m.t === 'cashapp' || m.t === 'venmo' || m.t === 'paypal' || m.t === 'zelle' ? m.v : m.v));
      if (m.n) left.appendChild(el('span', '', m.n));
      if (m.t === 'zelle' && m.v) left.appendChild(el('div', 'vqtip', 'Tap Copy, then open your bank app, choose Zelle, and paste.'));
      row.appendChild(left);
      if (tg) { var a = el('a', 'vqgo', tg.label); a.href = tg.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.style.background = br[0]; row.appendChild(a); }
      else if (m.v) { var c = el('button', 'vqgo' + (m.t === 'zelle' ? '' : ' ghost'), 'Copy'); c.type = 'button'; if (m.t === 'zelle') c.style.background = br[0]; c.onclick = function () { copy(c, m.v, 'Copied'); }; row.appendChild(c); }
      box.appendChild(row);
    });
    host.appendChild(box); return box;
  }
  // Editor for the business owner. onSave(list) returns a promise. Returns the element.
  function editor(host, initial, onSave) {
    var list = clean(initial), box = el('div', 'vqpm'), rows = el('div'), msg = el('div', 'vqmsg');
    box.appendChild(el('h2', '', 'How customers pay you'));
    box.appendChild(el('div', 'vqh', 'List the ways you already get paid. Customers get a button for each (Open Cash App, Open Venmo, Open PayPal, Pay by card...). They pay you directly. Vyqil never touches this money. Then you mark the invoice paid. Up to 6.'));
    box.appendChild(rows);
    function draw() {
      rows.textContent = '';
      list.forEach(function (m, i) {
        var r = el('div', 'vqed');
        var l1 = el('label', '', 'Type'), sel = el('select'); TYPES.forEach(function (t) { var o = el('option', '', t[1]); o.value = t[0]; sel.appendChild(o); }); sel.value = m.t;
        var l2 = el('label', '', 'Link, handle, email or phone'), v = el('input'); v.value = m.v; v.maxLength = 200; v.placeholder = 'Link, handle, email or phone';
        var l3 = el('label', '', 'Note (optional)'), n = el('input'); n.value = m.n; n.maxLength = 160; n.placeholder = 'Note (optional)';
        var h = el('div', 'vqtip', hintOf(m.t));
        sel.onchange = function () { m.t = sel.value; h.textContent = hintOf(m.t); }; v.oninput = function () { m.v = v.value; }; n.oninput = function () { m.n = n.value; };
        var rm = el('button', 'vqbtn ghost', 'Remove'); rm.type = 'button'; rm.onclick = function () { list.splice(i, 1); draw(); };
        [l1, sel, h, l2, v, l3, n, rm].forEach(function (x) { r.appendChild(x); }); rows.appendChild(r);
      });
    }
    draw();
    var add = el('button', 'vqbtn ghost', 'Add a payment method'); add.type = 'button'; add.onclick = function () { if (list.length >= 6) { msg.textContent = 'You can list up to 6.'; return; } list.push({ t: 'link', v: '', n: '' }); draw(); };
    var save = el('button', 'vqbtn', 'Save'); save.type = 'button';
    save.onclick = function () {
      var bad = list.filter(function (m) { return m.t === 'link' && m.v.trim() && !isLink(m.v.trim()); });
      if (bad.length) { msg.textContent = 'A payment link must start with https://'; msg.className = 'vqmsg err'; return; }
      var c = clean(list); save.disabled = true; msg.className = 'vqmsg'; msg.textContent = 'Saving...';
      Promise.resolve(onSave(c)).then(function () { list = clean(c); draw(); msg.textContent = 'Saved. Customers will see this after their next refresh.'; save.disabled = false; }, function (e) { msg.className = 'vqmsg err'; msg.textContent = 'Could not save: ' + ((e && (e.code || e.message)) || 'try again'); save.disabled = false; });
    };
    var br = el('div'); br.appendChild(add); br.appendChild(save); box.appendChild(br); box.appendChild(msg);
    host.appendChild(box); return box;
  }
  window.VQPayMethods = { TYPES: TYPES, clean: clean, text: text, view: view, editor: editor, isLink: isLink, target: target };
})();
