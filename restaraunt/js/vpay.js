/* Pay with Vyro for the restaurant: the customer scans a QR in the Vyro app, and the page finds the payment on the blockchain. */
(function () {
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  function enabled(ctx) { return !!(window.vchain && window.VYRO_CHAIN && ctx.biz && ctx.biz.payWallet && (ctx.biz.payCoins || []).length); }
  function coinText(base, coin, dec) { return (base / Math.pow(10, dec)).toFixed(coin === 'USDC' ? 2 : 4) + ' ' + coin; }
  async function makeReq(ctx, coin, usdCents) {
    var CFG = vchain.cfg, q = await vchain.quote(coin, usdCents);
    return { reference: vchain.makeReference(), net: CFG.network, coin: coin, usdCents: usdCents, amountBase: q.amountBase, feeBase: 0, bizBase: q.bizBase, decimals: q.decimals,
      wallet: ctx.biz.payWallet, feeWallet: '', mint: coin === 'USDC' ? CFG.usdcMint[CFG.network] : null, usdPrice: q.price || null, madeAt: Date.now() };
  }
  function uri(req, number, ctx) { return vchain.uri(req, { number: number || '' }, ctx.biz.name || ''); }
  function qr(req, number, ctx) { return vchain.qrSvg(uri(req, number, ctx)); }
  function watch(req, onFound, ms) {
    var busy = false, stopped = false, t = setInterval(async function () {
      if (busy || stopped) return; busy = true;
      try { var f = await vchain.findPayment(req); if (f && !stopped) { stopped = true; clearInterval(t); onFound(f); } } catch (e) {}
      busy = false;
    }, ms || 6000);
    return function () { stopped = true; clearInterval(t); };
  }
  var bg = null, box = null;
  function ensure() { if (bg) return; bg = el('div', 'modal-bg'); box = el('div', 'modal'); bg.appendChild(box); document.body.appendChild(bg); }
  function pickCoin(ctx, cb, onCancel) {
    var coins = ctx.biz.payCoins || []; if (coins.length === 1) { cb(coins[0]); return; }
    ensure(); box.textContent = ''; box.appendChild(el('h2', '', 'Pay with which coin?'));
    coins.forEach(function (c) { var b = el('button', 'btn', c); b.type = 'button'; b.addEventListener('click', function () { bg.classList.remove('open'); cb(c); }); box.appendChild(b); });
    var x = el('button', 'btn ghost', 'Cancel'); x.type = 'button'; x.addEventListener('click', function () { bg.classList.remove('open'); if (onCancel) onCancel(); }); box.appendChild(x); bg.classList.add('open');
  }
  // Shows the QR and waits. onPaid(found) when the payment is found; onCancel() if closed.
  function qrModal(ctx, req, number, onPaid, onCancel, extraNote) {
    ensure(); box.textContent = ''; box.appendChild(el('h2', '', 'Scan with the Vyro app'));
    if (req.net !== 'mainnet') { var tb = el('div', 'note', 'TEST MODE: no real money'); tb.style.color = '#d4af37'; box.appendChild(tb); }
    var q = el('div'); q.style.cssText = 'background:#fff;padding:6px;border-radius:10px;max-width:300px;margin:8px auto'; var svg = qr(req, number, ctx); if (svg) q.innerHTML = svg; else q.textContent = 'The QR picture could not load.'; box.appendChild(q);
    var r1 = el('div', 'row'); r1.appendChild(el('span', '', 'Customer sends')); r1.appendChild(el('b', '', coinText(req.amountBase, req.coin, req.decimals) + ' (' + vutil.fmt(req.usdCents) + ')')); box.appendChild(r1);
    box.appendChild(el('div', 'note', 'The customer also pays Vyro a small 1% fee inside the app. The restaurant receives the full amount.' + (extraNote ? ' ' + extraNote : '')));
    var st = el('div', 'note', 'Waiting for the payment...'); box.appendChild(st);
    var stop = watch(req, function (f) { bg.classList.remove('open'); onPaid(f); }, 6000);
    var chk = el('button', 'btn ghost', 'Check now'); chk.type = 'button'; chk.addEventListener('click', async function () { st.textContent = 'Checking...'; try { var f = await vchain.findPayment(req); if (f) { stop(); bg.classList.remove('open'); onPaid(f); } else st.textContent = 'Not found yet. Waiting...'; } catch (e) { st.textContent = 'Could not check just now. Will retry.'; } });
    var cx = el('button', 'btn ghost', 'Cancel'); cx.type = 'button'; cx.addEventListener('click', function () { stop(); bg.classList.remove('open'); if (onCancel) onCancel(); });
    box.appendChild(chk); box.appendChild(cx); bg.classList.add('open');
    return function () { stop(); bg.classList.remove('open'); };
  }
  // Marks an order paid after a payment was found (staff devices).
  async function markPaid(ctx, orderId, o, found, who) {
    var tip = o.tipCents || 0, total = (o.totalCents || 0) + tip, u = { status: 'Paid', method: 'Pay with Vyro', payments: [{ method: 'Pay with Vyro', amountCents: total }], tipCents: tip, changeCents: 0,
      paidAt: vyro.stamp(), paidBy: who || 'Vyro', txSignature: found.signature, payCoin: o.payReq ? o.payReq.coin : '', payNet: o.payReq ? o.payReq.net : '', updatedAt: vyro.stamp() };
    if (o.kitchenStatus === 'Hold') u.kitchenStatus = 'New';
    await ctx.bizRef.collection('orders').doc(orderId).update(u);
    if (o.tableId) { try { await ctx.bizRef.collection('tables').doc(o.tableId).update({ status: 'Needs cleaning', updatedAt: vyro.stamp() }); } catch (e) {} }
  }
  window.vrpay = { enabled: enabled, makeReq: makeReq, uri: uri, qr: qr, watch: watch, pickCoin: pickCoin, qrModal: qrModal, markPaid: markPaid, coinText: coinText };
})();
