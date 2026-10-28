// Solana helpers for Pay with Vyro: payment requests, QR text, and checking the blockchain for a payment.
(function () {
  var CFG = window.VYRO_CHAIN;
  var ALPHA = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

  function b58decode(s) {
    if (!s) return null;
    var bytes = [];
    for (var i = 0; i < s.length; i++) {
      var v = ALPHA.indexOf(s[i]); if (v < 0) return null;
      var carry = v;
      for (var j = 0; j < bytes.length; j++) { carry += bytes[j] * 58; bytes[j] = carry & 255; carry >>= 8; }
      while (carry) { bytes.push(carry & 255); carry >>= 8; }
    }
    for (var k = 0; k < s.length && s[k] === '1'; k++) bytes.push(0);
    return bytes.reverse();
  }
  function b58encode(bytes) {
    var digits = [];
    for (var i = 0; i < bytes.length; i++) {
      var carry = bytes[i];
      for (var j = 0; j < digits.length; j++) { carry += digits[j] << 8; digits[j] = carry % 58; carry = (carry / 58) | 0; }
      while (carry) { digits.push(carry % 58); carry = (carry / 58) | 0; }
    }
    var out = '';
    for (var k = 0; k < bytes.length && bytes[k] === 0; k++) out += '1';
    for (var q = digits.length - 1; q >= 0; q--) out += ALPHA[digits[q]];
    return out;
  }
  function isAddress(s) { var b = b58decode((s || '').trim()); return !!b && b.length === 32; }
  function makeReference() { var a = new Uint8Array(32); crypto.getRandomValues(a); return b58encode(Array.prototype.slice.call(a)); }

  async function rpc(net, method, params) {
    var url = CFG.rpc[net];
    if (!url || /PUT-YOUR/.test(url)) throw { code: 'vyro/no-rpc' };
    var r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: method, params: params }) });
    var j = await r.json();
    if (j.error) throw { code: 'vyro/rpc', message: j.error.message };
    return j.result;
  }

  async function solPriceUsd() {
    var r = await fetch('https://api.coinbase.com/v2/prices/SOL-USD/spot');
    var j = await r.json(); var p = parseFloat(j && j.data && j.data.amount);
    if (!(p > 0)) throw { code: 'vyro/no-price' };
    return p;
  }

  // Works out how much of the coin the customer must send for a US-dollar amount, and the 2% split.
  async function quote(coin, usdCents) {
    var base, dec, price = null;
    if (coin === 'USDC') { dec = 6; base = usdCents * 10000; }
    else if (coin === 'SOL') { dec = 9; price = await solPriceUsd(); base = Math.ceil((usdCents / 100) / price * 1e9); }
    else throw { code: 'vyro/bad-coin' };
    var fee = Math.floor(base * CFG.feeBps / 10000);
    return { amountBase: base, feeBase: fee, bizBase: base - fee, decimals: dec, price: price };
  }

  function uri(req, inv, bizName) {
    var q = new URLSearchParams({ v: '1', net: req.net, coin: req.coin, to: req.wallet, amt: String(req.amountBase), dec: String(req.decimals),
      ref: req.reference, inv: inv.number || '', biz: bizName || '', usd: String(req.usdCents) });
    if (req.mint) q.set('mint', req.mint);
    return 'vyro://pay?' + q.toString();
  }

  function tokenDelta(tx, owner, mint) {
    function sum(list) { var t = 0; (list || []).forEach(function (b) { if (b.owner === owner && b.mint === mint) t += Number(b.uiTokenAmount.amount); }); return t; }
    return sum(tx.meta.postTokenBalances) - sum(tx.meta.preTokenBalances);
  }
  function checkTx(tx, req) {
    if (!tx || !tx.meta || tx.meta.err) return false;
    if (req.coin === 'SOL') {
      var keys = tx.transaction.message.accountKeys.map(function (k) { return k.pubkey || k; });
      var ib = keys.indexOf(req.wallet), ifee = keys.indexOf(req.feeWallet);
      if (ib < 0 || ifee < 0) return false;
      var db = tx.meta.postBalances[ib] - tx.meta.preBalances[ib], df = tx.meta.postBalances[ifee] - tx.meta.preBalances[ifee];
      return db >= req.bizBase && df >= req.feeBase;
    }
    return tokenDelta(tx, req.wallet, req.mint) >= req.bizBase && tokenDelta(tx, req.feeWallet, req.mint) >= req.feeBase;
  }

  // Looks for a finished payment that used this request's reference. Returns {signature} or null.
  async function findPayment(req) {
    var sigs = await rpc(req.net, 'getSignaturesForAddress', [req.reference, { limit: 10, commitment: 'finalized' }]);
    for (var i = 0; i < sigs.length; i++) {
      if (sigs[i].err) continue;
      var tx = await rpc(req.net, 'getTransaction', [sigs[i].signature, { encoding: 'jsonParsed', commitment: 'finalized', maxSupportedTransactionVersion: 0 }]);
      if (checkTx(tx, req)) return { signature: sigs[i].signature, blockTime: tx.blockTime || null };
    }
    return null;
  }

  function explorer(sig, net) { return 'https://explorer.solana.com/tx/' + sig + (net === 'devnet' ? '?cluster=devnet' : ''); }

  // Draws a QR code as inline SVG using the qrcode-generator library (loaded by the page).
  function qrSvg(text) {
    if (!window.qrcode) return null;
    var qr = window.qrcode(0, 'M'); qr.addData(text); qr.make();
    var n = qr.getModuleCount(), m = 4, size = n + m * 2, d = '';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) d += 'M' + (c + m) + ' ' + (r + m) + 'h1v1h-1z';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size + '" width="100%" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
  }

  window.vchain = { cfg: CFG, isAddress: isAddress, makeReference: makeReference, quote: quote, uri: uri, findPayment: findPayment, explorer: explorer, qrSvg: qrSvg };
})();
