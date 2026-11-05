// Small coloured tiles at the top of the dashboard: one per invoice, estimate, unreturned document or lead that needs a nudge.
// A tile stays until the contractor settles it (Paid / Got it back / answered). "Later" hides it for today only; it is back tomorrow.
(function () {
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }

  var CSS = '#vTiles{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;margin:10px -6px 4px;padding:10px 8px 14px;scrollbar-width:thin}' +
    '#vTiles::-webkit-scrollbar{height:5px}#vTiles::-webkit-scrollbar-thumb{background:#2a3a4d;border-radius:4px}' +
    '#vTiles .vt{flex:0 0 min(76%,250px);scroll-snap-align:start;border:2px solid var(--c);background:linear-gradient(180deg,color-mix(in srgb,var(--c) 22%,#0a0e14),#0a0e14);border-radius:16px;padding:10px 11px;display:flex;flex-direction:column;gap:3px;min-width:0}' +
    '#vTiles .vt.urgent{box-shadow:0 0 0 2px #ff5a5a,0 0 16px rgba(255,90,90,.55)}' +
    '#vTiles .vt.over{border:4px solid #ff3030;box-shadow:0 0 0 2px rgba(255,48,48,.55),0 0 22px 4px rgba(255,48,48,.8)}' +
    '#vTiles .k{font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;color:var(--c);font-weight:800}' +
    '#vTiles .n{font-weight:700;font-size:.92rem;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '#vTiles .d{color:var(--c);font-size:.8rem}#vTiles .d b{font-size:1.7rem;line-height:1;margin-right:4px}' +
    '#vTiles .s{font-size:.7rem;color:#d8dde6;opacity:.85;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '#vTiles .row{display:flex;gap:6px;margin-top:6px}' +
    '#vTiles .b{flex:1 1 0;display:inline-flex;align-items:center;justify-content:center;min-height:36px;padding:0 6px;border-radius:10px;border:1px solid var(--c);background:var(--c);color:#06090d;font:700 .74rem Arial,system-ui,sans-serif;text-decoration:none;cursor:pointer;text-align:center}' +
    '#vTiles .b.g{background:transparent;color:var(--c)}' +
    '#vTiles .vt.did .s{color:#7fe3b0;opacity:1}' +
    '.vtPop{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:16px}' +
    '.vtPop .bx{background:#0C1117;border:2px solid var(--c);border-radius:16px;padding:18px;max-width:340px;width:100%;color:#fff;font-family:Arial,system-ui,sans-serif;box-shadow:0 0 24px color-mix(in srgb,var(--c) 45%,transparent)}' +
    '.vtPop h3{margin:0 0 8px;font-size:1.05rem}.vtPop p{margin:0 0 14px;color:#cdd6e2;font-size:.9rem;line-height:1.45}' +
    '.vtPop .b{display:flex;align-items:center;justify-content:center;width:100%;min-height:42px;border-radius:10px;border:1px solid var(--c);background:var(--c);color:#06090d;font:700 .85rem Arial,sans-serif;text-decoration:none;margin-top:8px;cursor:pointer}' +
    '.vtPop .b.g{background:transparent;color:var(--c)}';

  // Pop-up after "Send reminder": it went to the customer's portal; offer to email as well.
  function popup(i, res, mark) {
    var ov = el('div', 'vtPop'); ov.style.setProperty('--c', i.color);
    var bx = el('div', 'bx'); ov.appendChild(bx);
    bx.appendChild(el('h3', '', res.ok ? 'Reminder sent to portal' : 'Could not reach the portal'));
    bx.appendChild(el('p', '', res.ok ? (i.customer || 'The customer') + ' will see it in their customer portal messages. You can also email it to them.' : (i.customer || 'This customer') + ' does not have a portal for this yet. You can email the reminder instead.'));
    if (i.msg && (i.msg.to || !i.msg.phone)) { var em = el('a', 'b', res.ok ? 'Also email it' : 'Email it'); em.href = vcompose.href(i.msg); em.addEventListener('click', function () { this.href = vcompose.href(i.msg); mark(); ov.remove(); }); bx.appendChild(em); }
    var ok = el('button', 'b g', 'Close'); ok.type = 'button'; ok.addEventListener('click', function () { ov.remove(); }); bx.appendChild(ok);
    document.body.appendChild(ov);
  }

  function render(ctx, box, items) {
    if (!document.getElementById('vTilesCss')) { var st = document.createElement('style'); st.id = 'vTilesCss'; st.textContent = CSS; document.head.appendChild(st); }
    box.textContent = '';
    var shown = items.filter(function (i) { return !i.snoozed && (i.countdown || i.days >= (i.kind === 'lead' ? 0 : 1) || i.overdue); });
    box.style.display = shown.length ? 'flex' : 'none';
    shown.forEach(function (i) {
      var t = el('div', 'vt' + (i.urgent ? ' urgent' : '') + (i.overdue ? ' over' : '') + (i.remindedToday ? ' did' : ''));
      t.style.setProperty('--c', i.color);
      t.appendChild(el('div', 'k', i.label + (i.urgent ? ' · URGENT' : i.overdue ? ' · PAST DUE' : '')));
      t.appendChild(el('div', 'n', i.customer || i.title));
      var d = el('div', 'd'); d.appendChild(el('b', '', i.kind === 'lead' && i.days < 1 || i.days === 0 ? '0' : String(i.days))); d.appendChild(document.createTextNode(i.kind === 'lead' && i.days < 1 ? ' days (due today)' : i.days === 0 ? ' ' + i.dayWord : ' day' + (i.days === 1 ? '' : 's') + ' ' + i.dayWord)); t.appendChild(d);
      t.appendChild(el('div', 's', i.remindedToday ? 'Reminder sent today ✓' : (i.msg && i.msg.tone ? i.msg.tone : i.sub)));
      var r1 = el('div', 'row');
      var send;
      if (i.msg && i.portalId && window.vflow) {
        send = el('button', 'b', i.remindedToday ? 'Send again' : 'Send reminder'); send.type = 'button';
        send.addEventListener('click', async function () { send.disabled = true; var r = await vflow.reminderToPortal(ctx, i); send.disabled = false; if (r.ok) mark(); popup(i, r, mark); });
      }
      else if (i.msg && (i.msg.to || !i.msg.phone)) { send = el('a', 'b', i.remindedToday ? 'Send again' : 'Send reminder'); send.href = vcompose.href(i.msg); send.addEventListener('click', function () { this.href = vcompose.href(i.msg); mark(); }); }
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

  window.vtiles = { mount: async function (ctx, box, items) { try { render(ctx, box, items || await vremind.collect(ctx)); } catch (e) { box.style.display = 'none'; throw e; } } };
})();
