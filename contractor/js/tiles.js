// Small coloured tiles at the top of the dashboard: one per invoice, estimate, unreturned document or lead that needs a nudge.
// A tile stays until the contractor settles it (Paid / Got it back / answered). "Later" hides it for today only; it is back tomorrow.
(function () {
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }

  var CSS = '#vTiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:14px 0 4px}' +
    '@media(min-width:620px){#vTiles{grid-template-columns:repeat(3,minmax(0,1fr))}}' +
    '#vTiles .vt{border:2px solid var(--c);background:linear-gradient(180deg,color-mix(in srgb,var(--c) 22%,#0a0e14),#0a0e14);border-radius:16px;padding:10px 11px;display:flex;flex-direction:column;gap:3px;min-width:0}' +
    '#vTiles .vt.urgent{box-shadow:0 0 0 2px #ff5a5a,0 0 16px rgba(255,90,90,.55)}' +
    '#vTiles .k{font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;color:var(--c);font-weight:800}' +
    '#vTiles .n{font-weight:700;font-size:.92rem;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '#vTiles .d{color:var(--c);font-size:.8rem}#vTiles .d b{font-size:1.7rem;line-height:1;margin-right:4px}' +
    '#vTiles .s{font-size:.7rem;color:#d8dde6;opacity:.85}' +
    '#vTiles .row{display:flex;gap:6px;margin-top:6px}' +
    '#vTiles .b{flex:1 1 0;display:inline-flex;align-items:center;justify-content:center;min-height:36px;padding:0 6px;border-radius:10px;border:1px solid var(--c);background:var(--c);color:#06090d;font:700 .74rem system-ui,Arial,sans-serif;text-decoration:none;cursor:pointer;text-align:center}' +
    '#vTiles .b.g{background:transparent;color:var(--c)}' +
    '#vTiles .vt.did .s{color:#7fe3b0;opacity:1}';

  function render(ctx, box, items) {
    if (!document.getElementById('vTilesCss')) { var st = document.createElement('style'); st.id = 'vTilesCss'; st.textContent = CSS; document.head.appendChild(st); }
    box.textContent = '';
    var shown = items.filter(function (i) { return !i.soon && !i.snoozed && i.days >= (i.kind === 'lead' ? 0 : 1); });
    box.style.display = shown.length ? 'grid' : 'none';
    shown.forEach(function (i) {
      var t = el('div', 'vt' + (i.urgent ? ' urgent' : '') + (i.remindedToday ? ' did' : ''));
      t.style.setProperty('--c', i.color);
      t.appendChild(el('div', 'k', i.label + (i.urgent ? ' · URGENT' : '')));
      t.appendChild(el('div', 'n', i.customer || i.title));
      var d = el('div', 'd'); d.appendChild(el('b', '', i.kind === 'lead' && i.days < 1 ? '0' : String(i.days))); d.appendChild(document.createTextNode(i.kind === 'lead' && i.days < 1 ? ' days (due today)' : ' day' + (i.days === 1 ? '' : 's') + ' ' + i.dayWord)); t.appendChild(d);
      t.appendChild(el('div', 's', i.remindedToday ? 'Reminder sent today ✓' : (i.msg && i.msg.tone ? i.msg.tone : i.sub)));
      var r1 = el('div', 'row');
      var send;
      if (i.msg && (i.msg.to || !i.msg.phone)) { send = el('a', 'b', i.remindedToday ? 'Send again' : 'Send reminder'); send.href = vcompose.href(i.msg); send.addEventListener('click', function () { this.href = vcompose.href(i.msg); mark(); }); }
      else if (i.msg && i.msg.phone) { send = el('a', 'b', i.remindedToday ? 'Text again' : 'Text reminder'); send.href = 'sms:' + String(i.msg.phone).replace(/[^0-9+]/g, '') + '?&body=' + encodeURIComponent(i.msg.body.replace(/\n\n/g, '\n')); send.addEventListener('click', mark); }
      if (send) r1.appendChild(send);
      if (i.msg && i.msg.to && i.msg.phone) { var tx = el('a', 'b g', 'Text'); tx.href = 'sms:' + String(i.msg.phone).replace(/[^0-9+]/g, '') + '?&body=' + encodeURIComponent(i.msg.body.replace(/\n\n/g, '\n')); tx.addEventListener('click', mark); r1.appendChild(tx); }
      var r2 = el('div', 'row');
      var lt = el('button', 'b g', 'Later'); lt.type = 'button';
      lt.addEventListener('click', function () { t.remove(); i.snoozed = true; try { i.later().catch(function () { /* optional */ }); } catch (e) { /* optional */ } if (!box.children.length) box.style.display = 'none'; });
      r2.appendChild(lt);
      var dn;
      if (i.done) { dn = el('button', 'b g', i.doneLabel); dn.type = 'button'; dn.addEventListener('click', async function () { if (!confirm(i.doneLabel + '? This clears the reminder.')) return; try { await i.done(); t.remove(); if (!box.children.length) box.style.display = 'none'; } catch (e) { dn.textContent = 'Try again'; } }); }
      else { dn = el('a', 'b g', i.doneLabel || 'Open'); dn.href = i.open; }
      r2.appendChild(dn);
      t.appendChild(r1); t.appendChild(r2); box.appendChild(t);
      var did = false;
      function mark() { if (did) return; did = true; t.classList.add('did'); try { i.sent().catch(function () { /* optional */ }); } catch (e) { /* optional */ } }
    });
  }

  window.vtiles = { mount: async function (ctx, box, items) { try { render(ctx, box, items || await vremind.collect(ctx)); } catch (e) { box.style.display = 'none'; } } };
})();
