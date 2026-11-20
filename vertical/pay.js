// Pay with Vyqil for every Vyqil business app (USDC on Solana). Customers scan a QR in the Vyqil payments app, the money goes
// straight to the business's wallet, and this page notices the payment on the blockchain and records it. Vyqil's fee is 2%,
// taken out of the payment (the business pays it, the customer pays exactly the amount asked). Vyqil pays the network fee.
// An app turns this on with  VQ_APP.pay = { items: [ { kind, label, show, cents, key, onPaid } ] }.
(function () {
  'use strict';
  var Q = window.Q, A = window.VQ_APP, CFG = window.VYRO_CHAIN;
  if (!Q || !A || !A.pay) return;
  var U = Q.u, el = U.el;
  var ALPHA = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

  // ---------- Solana helpers (same payment code format the Vyqil payments app already understands) ----------
  function b58decode(s) {
    if (!s) return null; var bytes = [];
    for (var i = 0; i < s.length; i++) { var v = ALPHA.indexOf(s[i]); if (v < 0) return null; var carry = v; for (var j = 0; j < bytes.length; j++) { carry += bytes[j] * 58; bytes[j] = carry & 255; carry >>= 8; } while (carry) { bytes.push(carry & 255); carry >>= 8; } }
    for (var k = 0; k < s.length && s[k] === '1'; k++) bytes.push(0);
    return bytes.reverse();
  }
  function b58encode(bytes) {
    var digits = [];
    for (var i = 0; i < bytes.length; i++) { var carry = bytes[i]; for (var j = 0; j < digits.length; j++) { carry += digits[j] << 8; digits[j] = carry % 58; carry = (carry / 58) | 0; } while (carry) { digits.push(carry % 58); carry = (carry / 58) | 0; } }
    var out = ''; for (var k = 0; k < bytes.length && bytes[k] === 0; k++) out += '1'; for (var q = digits.length - 1; q >= 0; q--) out += ALPHA[digits[q]]; return out;
  }
  function isAddress(s) { var b = b58decode((s || '').trim()); return !!b && b.length === 32; }
  function makeReference() { var a = new Uint8Array(32); crypto.getRandomValues(a); return b58encode(Array.prototype.slice.call(a)); }
  async function rpc(net, method, params) {
    var url = CFG.rpc && CFG.rpc[net]; if (!url || /PUT-YOUR/.test(url)) throw { code: 'vyro/no-rpc' };
    var r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: method, params: params }) });
    var j = await r.json(); if (j.error) throw { code: 'vyro/rpc', message: j.error.message }; return j.result;
  }
  function tokenDelta(tx, owner, mint) {
    function sum(list) { var t = 0; (list || []).forEach(function (b) { if (b.owner === owner && b.mint === mint) t += Number(b.uiTokenAmount.amount); }); return t; }
    return sum(tx.meta.postTokenBalances) - sum(tx.meta.preTokenBalances);
  }
  function checkTx(tx, req) {
    if (!tx || !tx.meta || tx.meta.err) return false;
    var STARTUP_MAX = 600000; // a wallet's very first USDC payment also pays a one-time startup fee (about $0.40)
    return tokenDelta(tx, req.wallet, req.mint) >= req.bizBase - STARTUP_MAX && tokenDelta(tx, req.feeWallet, req.mint) >= req.feeBase;
  }
  async function findPayment(req) {
    var sigs = await rpc(req.net, 'getSignaturesForAddress', [req.reference, { limit: 10, commitment: 'finalized' }]);
    for (var i = 0; i < sigs.length; i++) {
      if (sigs[i].err) continue;
      var tx = await rpc(req.net, 'getTransaction', [sigs[i].signature, { encoding: 'jsonParsed', commitment: 'finalized', maxSupportedTransactionVersion: 0 }]);
      if (checkTx(tx, req)) return { signature: sigs[i].signature, blockTime: tx.blockTime || null };
    }
    return null;
  }
  function uri(req, label, bizName) {
    var q = new URLSearchParams({ v: '1', net: req.net, coin: req.coin, to: req.wallet, amt: String(req.amountBase), dec: String(req.decimals), ref: req.reference, inv: label || '', biz: bizName || '', usd: String(req.usdCents) });
    if (req.mint) q.set('mint', req.mint); return 'vyro://pay?' + q.toString();
  }
  function explorer(sig, net) { return 'https://explorer.solana.com/tx/' + sig + (net === 'devnet' ? '?cluster=devnet' : ''); }
  function qrSvg(text) {
    if (!window.qrcode) return null; var qr = window.qrcode(0, 'M'); qr.addData(text); qr.make();
    var n = qr.getModuleCount(), m = 4, size = n + m * 2, d = '';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) d += 'M' + (c + m) + ' ' + (r + m) + 'h1v1h-1z';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size + '" width="100%" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
  }
  function usd(c) { return U.money ? U.money(c) : '$' + (c / 100).toFixed(2); }
  function coinText(base) { return (base / 1e6).toFixed(2) + ' USDC'; }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  function cfgProblem() {
    if (!CFG) return 'Pay with Vyqil is not switched on for this site yet. The file shared/chain-config.js is missing.';
    if (!isAddress(CFG.feeWallet)) return 'The Vyqil fee wallet is not set in shared/chain-config.js yet.';
    if (!CFG.usdcMint || !CFG.usdcMint[CFG.network]) return 'The USDC address for this network is missing in shared/chain-config.js.';
    return '';
  }
  function bizRef() { return Q.db.collection('businesses').doc(Q.S.biz.id); }
  function isOwner() { return Q.S.biz && Q.S.biz.role === 'owner'; }

  // ---------- Pay links: a customer opens the link, sees the amount and the QR / payment code, and the page watches for the payment ----------
  function b64(o) { return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function newReq(cents, wallet) {
    var base = cents * 10000, fee = Math.ceil(base * (CFG.feeBps || 200) / 10000);
    return { reference: makeReference(), net: CFG.network, coin: 'USDC', usdCents: cents, amountBase: base, feeBase: fee, bizBase: base - fee, decimals: 6, wallet: wallet, feeWallet: CFG.feeWallet, mint: CFG.usdcMint[CFG.network], at: Date.now() };
  }
  function pack(q) { return { r: q.reference, u: q.usdCents, a: q.amountBase, f: q.feeBase, n: q.net, w: q.wallet, fw: q.feeWallet, m: q.mint, at: q.at }; }
  function unpack(p) { return { reference: p.r, net: p.n, coin: 'USDC', usdCents: p.u, amountBase: p.a, feeBase: p.f, bizBase: p.a - p.f, decimals: 6, wallet: p.w, feeWallet: p.fw, mint: p.m, at: p.at }; }
  function payLink(q, label) { return location.origin + '/pay.html#' + b64({ v: 1, n: q.net, w: q.wallet, fw: q.feeWallet, m: q.mint, a: q.amountBase, f: q.feeBase, d: 6, r: q.reference, u: q.usdCents, l: label || '', b: (Q.S.biz && Q.S.biz.name) || '' }); }
  function msgText(it, r, q, link) { return 'Hi, here is your payment link for ' + ((it.label && it.label(r)) || 'your balance') + ' (' + usd(q.usdCents) + ') from ' + ((Q.S.biz && Q.S.biz.name) || 'us') + ':\n' + link; }
  function clearReq(it, r) { return Q.recs().doc(r.id).update({ payReq: Q.FV.delete() }).catch(function () { /* ignore */ }); }

  // Share window: send to the portal (when the app has one), copy, text or email the link.
  function share(it, r, q) {
    var link = payLink(q, (it.label && it.label(r)) || ''), text = msgText(it, r, q, link), who = it.contact ? (it.contact(r) || {}) : {};
    Q.modal(function (s, close) {
      s.appendChild(el('h3', '', 'Send the pay link'));
      s.appendChild(el('p', 'hint', 'The customer opens the link, sees ' + usd(q.usdCents) + ' and a QR code, and pays with the Vyqil app. When it is paid, this app records it by itself the next time it checks (it checks every minute while it is open).'));
      function btn(label, fn, cls) { var b = el('button', 'btn' + (cls ? ' ' + cls : ''), label); b.type = 'button'; b.style.cssText = 'display:block;width:100%;margin:8px 0'; b.onclick = fn; s.appendChild(b); return b; }
      if (it.portalSend && (!it.canPortal || it.canPortal(r))) btn('Send to their portal', function () { Promise.resolve(it.portalSend(r, text, link)).then(function () { Q.toast('Sent to the portal.'); close(); }, function (e) { Q.toast(Q.friendly(e)); }); });
      btn('Copy the link only', function () { (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(function () { Q.toast('Link copied.'); }, function () { window.prompt('Copy this link:', link); }); }, 'ghost');
      var ph = String(who.phone || '').replace(/[^0-9+]/g, ''); btn('Text message', function () { location.href = 'sms:' + ph + (/iPhone|iPad|iOS/.test(navigator.userAgent) ? '&' : '?') + 'body=' + encodeURIComponent(text); }, 'ghost');
      btn('Email', function () { location.href = 'mailto:' + (who.email ? String(who.email).replace(/[^\w.@+-]/g, '') : '') + '?subject=' + encodeURIComponent('Payment link: ' + ((it.label && it.label(r)) || '')) + '&body=' + encodeURIComponent(text); }, 'ghost');
      btn('Show the QR code here instead', function () { close(); collect({ key: it.kind + '_' + r.id, title: 'Pay with Vyqil', label: (it.label && it.label(r)) || 'Amount due', cents: q.usdCents, onPaid: function (f, rq) { return it.onPaid(r, f, rq).then(function () { return clearReq(it, r); }); } }); }, 'ghost');
      btn('Close', close, 'ghost');
    });
  }
  function startLink(it, r) {
    var bad = cfgProblem(); if (bad) { Q.toast(bad); return; }
    var wallet = Q.S.biz && Q.S.biz.payWallet; if (!wallet) { Q.toast(isOwner() ? 'Add your wallet address first.' : 'The owner needs to add the business wallet first.'); if (isOwner()) setup(); return; }
    function go(cents) {
      var p = r.payReq, q = (p && p.u === cents && p.w === wallet && p.n === CFG.network && Date.now() - p.at < 14 * 86400000) ? unpack(p) : newReq(cents, wallet);
      Q.recs().doc(r.id).update({ payReq: pack(q), updatedAt: Q.FV.serverTimestamp() }).then(function () { share(it, r, q); }, function (e) { Q.toast(Q.friendly(e)); });
    }
    if (it.editable) {
      Q.modal(function (s, close) {
        s.appendChild(el('h3', '', 'How much should the link ask for?')); var inp = el('input'); inp.type = 'number'; inp.step = '0.01'; inp.min = '0.5'; inp.inputMode = 'decimal'; inp.value = ((it.cents(r) || 0) / 100).toFixed(2); s.appendChild(inp);
        var m = el('div', 'note'), b = el('button', 'btn', 'Make the link'); b.type = 'button'; b.style.cssText = 'display:block;width:100%;margin-top:10px'; s.appendChild(b); s.appendChild(m);
        b.onclick = function () { var c = Math.round(parseFloat(inp.value) * 100); if (!(c >= 50)) { m.className = 'note err'; m.textContent = 'The smallest payment is $0.50.'; return; } close(); go(c); };
      });
    } else go(it.cents(r));
  }

  // Looks for payments on links that were sent out, even when nobody has the QR window open.
  var busy = {};
  function scan() {
    if (!Q.S.biz || document.hidden || cfgProblem()) return; var n = 0;
    (A.pay.items || []).forEach(function (it) {
      Q.byKind(it.kind).forEach(function (r) {
        var p = r.payReq; if (!p || busy[r.id] || n >= 8) return;
        if (Date.now() - (p.at || 0) > 14 * 86400000) { clearReq(it, r); return; }
        n++; busy[r.id] = 1; var q = unpack(p);
        findPayment(q).then(function (found) {
          if (!found) return;
          return it.onPaid(r, found, q).catch(function (e) { if (!(e && e.code === 'vq/already')) throw e; }).then(function () { return clearReq(it, r); }).then(function () { Q.toast('Payment received: ' + usd(q.usdCents) + ' ' + ((it.label && it.label(r)) || '')); });
        }).catch(function () { /* try again next time */ }).then(function () { delete busy[r.id]; });
      });
    });
  }
  setTimeout(scan, 4000); setInterval(scan, 60000);

  // ---------- Setup: where the business gets paid ----------
  function setup() {
    Q.modal(function (s, close) {
      s.appendChild(el('h3', '', 'Pay with Vyqil'));
      s.appendChild(el('p', 'hint', 'Customers scan a QR code. The money goes straight to your wallet. Vyqil pays the network fees and takes 2% out of each payment. Only USDC on Solana (a stable dollar coin).'));
      var bad = cfgProblem(); if (bad) s.appendChild(el('div', 'note err', bad));
      if (CFG && CFG.network !== 'mainnet') s.appendChild(el('div', 'note', 'TEST MODE: no real money.'));
      var inp = el('input'); inp.type = 'text'; inp.maxLength = 60; inp.autocomplete = 'off'; inp.autocapitalize = 'off'; inp.spellcheck = false; inp.value = (Q.S.biz && Q.S.biz.payWallet) || '';
      s.appendChild(el('label', 'f', 'Your wallet address (Solana)')); s.appendChild(inp);
      s.appendChild(el('div', 'note', 'Payments sent to a wrong address cannot be reversed. Copy it straight from your wallet app and double-check it.'));
      var msg = el('div', 'note'), b = el('div', 'btns'), go = el('button', 'btn', 'Save'), x = el('button', 'btn ghost', 'Close'); go.type = x.type = 'button'; b.appendChild(go); b.appendChild(x);
      if (!isOwner()) { inp.disabled = true; go.style.display = 'none'; msg.textContent = 'Only the owner can change payment settings.'; }
      s.appendChild(b); s.appendChild(msg); x.onclick = close;
      go.onclick = function () {
        var w = inp.value.trim();
        if (!isAddress(w)) { msg.className = 'note err'; msg.textContent = 'That does not look like a Solana wallet address. Copy it again from your wallet app.'; return; }
        Q.ask('Customer payments will go to:\n\n' + w + '\n\nIs this exactly your wallet address?', 'Yes, save it', async function () {
          try { await bizRef().update({ payWallet: w, payCoins: ['USDC'] }); Q.S.biz.payWallet = w; Q.S.biz.payCoins = ['USDC']; Q.toast('Wallet saved.'); close(); Q.render(); }
          catch (e) { msg.className = 'note err'; msg.textContent = Q.friendly(e); }
        });
      };
    });
  }

  // ---------- Collect: show the QR, watch the chain, record the payment ----------
  // opts: { key, label, cents, editable, title, onPaid(found, req) }
  function collect(opts) {
    var bad = cfgProblem(); if (bad) { Q.toast(bad); return; }
    var wallet = Q.S.biz && Q.S.biz.payWallet;
    if (!wallet) { Q.toast(isOwner() ? 'Add your wallet address first.' : 'The owner needs to add the business wallet first.'); if (isOwner()) setup(); return; }
    var storeKey = 'vq_payreq_' + Q.S.biz.id + '_' + opts.key;
    Q.modal(function (s, close) {
      var timer = null, working = false, current = null, done = false;
      function stop() { if (timer) { clearInterval(timer); timer = null; } }
      s.appendChild(el('h3', '', opts.title || 'Pay with Vyqil'));
      if (CFG.network !== 'mainnet') s.appendChild(el('div', 'note', 'TEST MODE: no real money.'));
      var body = el('div'); s.appendChild(body);
      function head(cents) { var h = el('div'); var r1 = el('div', 'row'); r1.appendChild(el('span', '', opts.label || 'Amount due')); r1.appendChild(el('b', '', usd(cents))); h.appendChild(r1); return h; }

      function askAmount() {
        body.textContent = ''; var inp = el('input'); inp.type = 'number'; inp.step = '0.01'; inp.min = '0.5'; inp.inputMode = 'decimal'; inp.value = ((opts.cents || 0) / 100).toFixed(2);
        body.appendChild(el('label', 'f', 'Amount to collect (US dollars)')); body.appendChild(inp);
        var go = el('button', 'btn', 'Make the payment code'); go.type = 'button'; go.style.cssText = 'display:block;width:100%;margin-top:10px'; var m = el('div', 'note');
        go.onclick = function () { var c = Math.round(parseFloat(inp.value) * 100); if (!(c >= 50)) { m.className = 'note err'; m.textContent = 'The smallest payment is $0.50.'; return; } make(c); };
        body.appendChild(go); body.appendChild(m);
      }
      function make(cents) {
        var req = newReq(cents, wallet);
        ls(storeKey, JSON.stringify(req)); show(req);
      }
      function show(req) {
        current = req; body.textContent = ''; body.appendChild(head(req.usdCents));
        var text = uri(req, opts.label || '', Q.S.biz.name), svg = qrSvg(text), box = el('div'); box.style.cssText = 'background:#fff;padding:6px;border-radius:10px;max-width:320px;margin:10px auto;color:#111';
        if (svg) box.innerHTML = svg; else box.textContent = 'The QR picture could not load. Use the link below.'; body.appendChild(box);
        body.appendChild(el('div', 'hint', 'Customer: scan this in the Vyqil app.'));
        var r2 = el('div', 'row'); r2.appendChild(el('span', '', 'They send')); r2.appendChild(el('b', '', coinText(req.amountBase))); body.appendChild(r2);
        var r3 = el('div', 'row'); r3.appendChild(el('span', '', 'You receive (after the 2% Vyqil fee)')); r3.appendChild(el('b', '', coinText(req.bizBase))); body.appendChild(r3);
        body.appendChild(el('div', 'note', 'Keep this open. It records the payment by itself.'));
        var st = el('div', 'note'); st.id = 'vqPayMsg'; var chk = el('button', 'btn', 'Check payment now'); chk.type = 'button'; chk.style.cssText = 'display:block;width:100%;margin-top:8px';
        var nw = el('button', 'btn ghost sm', 'Make a new code'); nw.type = 'button'; nw.style.marginTop = '8px'; var lk = el('div', 'note'); lk.style.wordBreak = 'break-all'; lk.textContent = text;
        body.appendChild(chk); body.appendChild(nw); body.appendChild(st); body.appendChild(lk);
        function msg(t, err) { st.className = err ? 'note err' : 'note'; st.textContent = t; }
        async function check() {
          if (working || done) return; if (!document.body.contains(s)) { stop(); return; } working = true;
          try {
            var found = await findPayment(current);
            if (found) {
              stop(); msg('Payment found. Recording...');
              try { await opts.onPaid(found, current); } catch (e) { if (e && e.code === 'vq/already') { /* recorded earlier */ } else throw e; }
              done = true; ls(storeKey, null); body.textContent = ''; body.appendChild(el('h3', '', 'Payment received'));
              body.appendChild(el('p', '', usd(current.usdCents) + ' received in USDC' + (current.net === 'mainnet' ? '' : ' (TEST)') + '. It has been recorded.'));
              var a = el('a', 'btn', 'View on the blockchain explorer'); a.href = explorer(found.signature, current.net); a.target = '_blank'; a.rel = 'noopener'; a.style.cssText = 'display:block;text-align:center;margin:8px 0'; body.appendChild(a);
              var d = el('button', 'btn ghost', 'Done'); d.type = 'button'; d.style.cssText = 'display:block;width:100%'; d.onclick = function () { close(); Q.render(); }; body.appendChild(d); Q.toast('Payment received.');
            } else msg('Waiting for the payment...');
          } catch (e) {
            if (e && e.code === 'vyro/no-rpc') { stop(); msg('The blockchain connection (rpc) is not set in shared/chain-config.js.', true); }
            else msg('Could not check just now. It will retry.');
          }
          working = false;
        }
        chk.onclick = check; nw.onclick = function () { stop(); ls(storeKey, null); if (opts.editable) askAmount(); else make(opts.cents); };
        stop(); timer = setInterval(check, 6000); setTimeout(function () { stop(); }, 600000); check();
      }
      var saved = null; try { saved = JSON.parse(ls(storeKey) || 'null'); } catch (e) { saved = null; }
      if (saved && saved.reference && Date.now() - (saved.at || 0) < 172800000 && saved.wallet === wallet && (opts.editable || saved.usdCents === opts.cents)) show(saved);
      else if (opts.editable) askAmount(); else make(opts.cents);
      var xb = el('button', 'btn ghost', 'Close'); xb.type = 'button'; xb.style.cssText = 'display:block;width:100%;margin-top:10px'; xb.onclick = function () { stop(); close(); }; s.appendChild(xb);
    });
  }

  Q.pay = { setup: setup, collect: collect, isAddress: isAddress, scan: scan };

  // ---------- Hook the "Pay with Vyqil" button into each kind the app lists ----------
  (A.pay.items || []).forEach(function (it) {
    var kd = A.kinds[it.kind]; if (!kd) return; kd.actions = kd.actions || [];
    kd.actions.unshift({ l: it.action || 'Pay with Vyqil (QR code)', show: function (r) { return !it.show || it.show(r); }, run: function (r) {
      collect({ key: it.kind + '_' + r.id, title: 'Pay with Vyqil', label: it.label ? it.label(r) : 'Amount due', cents: it.cents ? it.cents(r) : 0, editable: !!it.editable, onPaid: function (found, req) { return it.onPaid(r, found, req).then(function () { if (r.payReq) return clearReq(it, r); }); } });
    } });
    kd.actions.unshift({ l: it.linkAction || 'Send a pay link to the customer', show: function (r) { return !it.show || it.show(r); }, run: function (r) { startLink(it, r); } });
  });
})();
