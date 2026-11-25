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
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  // Plain text for emails and messages.
  function text(list) {
    var L = clean(list); if (!L.length) return '';
    return 'How to pay:\n' + L.map(function (m) { return '- ' + nameOf(m.t) + (m.v ? ': ' + m.v : '') + (m.n ? ' (' + m.n + ')' : ''); }).join('\n');
  }
  // What the customer sees.
  function view(host, list, opts) {
    var L = clean(list); if (!L.length) return null; opts = opts || {};
    var box = el('div', opts.cls || 'card'); box.appendChild(el('h2', '', opts.title || 'How to pay'));
    var intro = el('div', 'hint', 'Pay your contractor directly with any of these. Then they mark your invoice paid.'); if (opts.intro) intro.textContent = opts.intro; box.appendChild(intro);
    L.forEach(function (m) {
      var row = el('div', 'row'), left = el('div', 'm'); left.appendChild(el('b', '', nameOf(m.t)));
      if (m.v && !isLink(m.v)) left.appendChild(el('span', '', m.v)); if (m.n) left.appendChild(el('span', '', m.n));
      row.appendChild(left);
      if (isLink(m.v)) { var a = el('a', 'btn sm', 'Pay now'); a.href = m.v; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.style.cssText = 'text-decoration:none;white-space:nowrap'; row.appendChild(a); }
      else if (m.v) { var c = el('button', 'btn ghost sm', 'Copy'); c.type = 'button'; c.onclick = function () { try { navigator.clipboard.writeText(m.v); c.textContent = 'Copied'; setTimeout(function () { c.textContent = 'Copy'; }, 1500); } catch (e) { /* ignore */ } }; row.appendChild(c); }
      box.appendChild(row);
    });
    host.appendChild(box); return box;
  }
  // Editor for the business owner. onSave(list) returns a promise. Returns the element.
  function editor(host, initial, onSave) {
    var list = clean(initial), box = el('div', 'card'), rows = el('div'), msg = el('div', 'note');
    box.appendChild(el('h2', '', 'How customers pay you'));
    box.appendChild(el('div', 'hint', 'List the ways you already get paid. Customers see these on their invoices and portal. They pay you directly (Vyqil never touches this money), then you mark the invoice paid. Up to 6.'));
    box.appendChild(rows);
    function draw() {
      rows.textContent = '';
      list.forEach(function (m, i) {
        var r = el('div'); r.style.cssText = 'border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:10px;margin:10px 0';
        var sel = el('select'); TYPES.forEach(function (t) { var o = el('option', '', t[1]); o.value = t[0]; sel.appendChild(o); }); sel.value = m.t;
        var v = el('input'); v.value = m.v; v.maxLength = 200; v.placeholder = 'Link, handle, email or phone'; var n = el('input'); n.value = m.n; n.maxLength = 160; n.placeholder = 'Note (optional)';
        var h = el('div', 'note', hintOf(m.t));
        sel.onchange = function () { m.t = sel.value; h.textContent = hintOf(m.t); }; v.oninput = function () { m.v = v.value; }; n.oninput = function () { m.n = n.value; };
        var rm = el('button', 'btn ghost sm', 'Remove'); rm.type = 'button'; rm.onclick = function () { list.splice(i, 1); draw(); };
        [sel, h, v, n, rm].forEach(function (x) { x.style.marginTop = '6px'; r.appendChild(x); }); rows.appendChild(r);
      });
    }
    draw();
    var add = el('button', 'btn ghost', 'Add a payment method'); add.type = 'button'; add.onclick = function () { if (list.length >= 6) { msg.textContent = 'You can list up to 6.'; return; } list.push({ t: 'link', v: '', n: '' }); draw(); };
    var save = el('button', 'btn', 'Save'); save.type = 'button'; save.style.marginLeft = '8px';
    save.onclick = function () {
      var bad = list.filter(function (m) { return m.t === 'link' && m.v.trim() && !isLink(m.v.trim()); });
      if (bad.length) { msg.textContent = 'A payment link must start with https://'; msg.className = 'note err'; return; }
      var c = clean(list); save.disabled = true; msg.className = 'note'; msg.textContent = 'Saving...';
      Promise.resolve(onSave(c)).then(function () { list = clean(c); draw(); msg.textContent = 'Saved. Customers will see this after their next refresh.'; save.disabled = false; }, function (e) { msg.className = 'note err'; msg.textContent = 'Could not save: ' + ((e && e.message) || 'try again'); save.disabled = false; });
    };
    var br = el('div'); br.style.marginTop = '10px'; br.appendChild(add); br.appendChild(save); box.appendChild(br); box.appendChild(msg);
    host.appendChild(box); return box;
  }
  window.VQPayMethods = { TYPES: TYPES, clean: clean, text: text, view: view, editor: editor, isLink: isLink };
})();
