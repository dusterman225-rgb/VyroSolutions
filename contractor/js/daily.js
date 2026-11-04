// The daily "to send" pop-up. Vyro cannot send email or texts by itself, so once a day, when the contractor opens
// the dashboard, this lists everything that is waiting to go out, with the message already written.
// Shows once per person per day. "Remind me later" brings it back the next time the dashboard opens.
(function () {
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  var DAY = 86400000;

  var GROUPS = [['invoice-soon', 'Invoices due soon'], ['invoice', 'Payment reminders to send'], ['document', 'Signed documents still to come back'], ['estimate', 'Estimates to follow up on'], ['lead', 'Leads to call back']];

  async function gather(ctx, items) {
    var today = vutil.todayStr(), money = ctx.role === 'owner' || ctx.role === 'supervisor' || ctx.role === 'gm', out = { today: today, groups: [], urgent: false };
    items = (items || await vremind.collect(ctx)).filter(function (i) { return !i.snoozed; });
    GROUPS.forEach(function (g) {
      var rows = items.filter(function (i) { return (g[0] === 'invoice-soon' ? (i.kind === 'invoice' && i.soon) : (i.kind === g[0] && !i.soon)); });
      if (!rows.length) return;
      rows.forEach(function (i) { if (i.urgent) out.urgent = true; });
      out.groups.push({ title: g[1], rows: rows.map(function (i) {
        return { title: i.title, sub: i.sub + (i.days > 0 && !i.soon ? ' · ' + i.days + ' day' + (i.days === 1 ? '' : 's') + ' ' + i.dayWord : '') + (i.msg && i.msg.tone && !i.soon ? ' · ' + i.msg.tone : ''), msg: i.msg, late: !!i.urgent || i.days > 7,
          mark: i.sent, later: i.later, done: i.done, doneLabel: i.doneLabel, open: i.open };
      }) });
    });
    if (money) {
      var drafts = [];
      try { (await ctx.bizRef.collection('invoices').where('status', '==', 'Draft').get()).forEach(function (d) { var x = d.data(); x.id = d.id; if (x.customerName && (x.totalCents || 0) > 0) drafts.push(x); }); } catch (e) { /* optional */ }
      drafts = drafts.slice(0, 8);
      if (drafts.length) out.groups.push({ title: 'Invoices not sent yet', rows: drafts.map(function (i) {
        return { title: (i.customerName || '') + ' · ' + vutil.fmt(i.totalCents || 0), sub: (i.number || 'Draft invoice') + ' · saved but never sent', open: 'invoice.html?id=' + i.id, openLabel: 'Open and send' };
      }) });
    }
    return out;
  }

  function show(ctx, data, onClose) {
    var css = document.createElement('style');
    css.textContent = '#vDaily{position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:14px}' +
      '#vDaily .box{background:#fffbea;color:#1a1500;border-radius:18px;max-width:520px;width:100%;max-height:92vh;overflow-y:auto;box-shadow:0 0 0 4px #ffc400,0 20px 60px rgba(0,0,0,.6)}' +
      '#vDaily .top{background:#ffc400;padding:16px 18px;border-radius:14px 14px 0 0}#vDaily .top h2{margin:0;font-size:1.25rem;color:#1a1500}#vDaily .top p{margin:4px 0 0;font-size:.9rem;color:#3d3200}' +
      '#vDaily .in{padding:6px 16px 18px}#vDaily h3{margin:16px 0 6px;font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;color:#7a5f00}' +
      '#vDaily .r{background:#fff;border:1px solid #e8d98a;border-radius:12px;padding:12px;margin-bottom:10px}#vDaily .r b{display:block;color:#1a1500}#vDaily .r small{display:block;color:#6b5a1a;margin-top:2px}' +
      '#vDaily .r small.late{color:#b3261e!important;font-weight:700}#vDaily .r.done{opacity:.55}' +
      '#vDaily .btn{display:inline-flex!important;align-items:center;justify-content:center;width:auto!important;flex:1 1 30%;margin:0!important;line-height:1.1;text-align:center;background:#1a1500!important;color:#fff!important;border:0!important;min-height:44px;padding:0 14px;box-shadow:none!important}#vDaily .btn.ghost{background:#fff!important;color:#1a1500!important;border:1px solid #1a1500!important}';
    document.head.appendChild(css);
    var ov = el('div'); ov.id = 'vDaily'; var box = el('div', 'box'); ov.appendChild(box);
    var total = 0; data.groups.forEach(function (g) { total += g.rows.length; });
    var top = el('div', 'top'); top.appendChild(el('h2', '', 'Today: ' + total + ' thing' + (total === 1 ? '' : 's') + ' to send'));
    top.appendChild(el('p', '', 'Vyro cannot send these for you, so they are ready here. Tap Email or Text, read it, and send it from your phone.')); box.appendChild(top);
    var inn = el('div', 'in'); box.appendChild(inn);
    data.groups.forEach(function (g) {
      inn.appendChild(el('h3', '', g.title));
      g.rows.forEach(function (r) {
        var row = el('div', 'r'); row.appendChild(el('b', '', r.title)); row.appendChild(el('small', r.late ? 'late' : '', r.sub));
        if (r.msg) {
          var sent = false;
          row.appendChild(vremind.buttons(r.msg, function () { if (sent) return; sent = true; row.classList.add('done'); try { if (r.mark) r.mark().catch(function () { /* optional */ }); } catch (e) { /* optional */ } }));
          var o = el('a', 'btn ghost', 'Open'); o.href = r.open; row.lastChild.appendChild(o);
          if (r.later) { var lb = el('button', 'btn ghost', 'Later'); lb.type = 'button'; lb.addEventListener('click', function () { try { r.later().catch(function () { /* optional */ }); } catch (e) { /* optional */ } row.remove(); }); row.lastChild.appendChild(lb); }
          if (r.done) { var db = el('button', 'btn ghost', r.doneLabel || 'Done'); db.type = 'button'; db.addEventListener('click', async function () { if (!confirm((r.doneLabel || 'Done') + '? This clears the reminder.')) return; try { await r.done(); row.remove(); } catch (e) { db.textContent = 'Try again'; } }); row.lastChild.appendChild(db); }
        } else { var a = el('a', 'btn', r.openLabel || 'Open'); a.href = r.open; a.style.marginTop = '8px'; row.appendChild(a); }
        inn.appendChild(row);
      });
    });
    var done = el('button', 'btn', 'Done for today'); done.type = 'button'; done.style.cssText = 'margin-top:8px;width:100%!important;display:flex!important';
    var later = el('button', 'btn ghost', 'Remind me later'); later.type = 'button'; later.style.cssText = 'margin-top:8px;width:100%!important;display:flex!important';
    done.addEventListener('click', function () { ov.remove(); onClose(true); }); later.addEventListener('click', function () { ov.remove(); onClose(false); });
    inn.appendChild(done); inn.appendChild(later);
    document.body.appendChild(ov);
  }

  window.vdaily = { run: async function (ctx, items) {
    if (!window.vremind || !window.vcompose) return;
    var key = 'vyroDaily_' + ctx.bizId + '_' + ctx.user.uid, today = vutil.todayStr(), shown = false;
    try { shown = localStorage.getItem(key) === today; } catch (e) { shown = false; }
    var data = await gather(ctx, items);
    // Anything more than 7 days late (urgent) keeps coming back every time the dashboard opens until it is settled or put off for today.
    if (shown && !data.urgent) return;
    if (!data.groups.length) { try { localStorage.setItem(key, today); } catch (e) { /* ignore */ } return; }
    show(ctx, data, function (finished) { if (finished) { try { localStorage.setItem(key, today); } catch (e) { /* ignore */ } } });
  } };
})();
