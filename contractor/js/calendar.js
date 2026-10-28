// Dashboard calendar: job starts and finishes, invoice and bill due dates, lead follow-ups, and the
// team member's own dates. Dates glow in a colour per kind. Tap a day to see its cards.
// "My dates" are saved with the person's id; the database rules let only that person read them.
(function () {
  var TYPES = {
    start:   { label: 'Job start',      color: '#7fe3b0' },
    end:     { label: 'Job finish',     color: '#4B9CD3' },
    invoice: { label: 'Invoice due',    color: '#f0c36d' },
    bill:    { label: 'Bill due',       color: '#ff8a8a' },
    lead:    { label: 'Lead follow-up', color: '#b48cff' },
    sub:     { label: 'Sub licence/insurance', color: '#4fd6d0' },
    mine:    { label: 'My dates',       color: '#ff7ad9' }
  };
  var ORDER = ['invoice', 'bill', 'sub', 'start', 'end', 'lead', 'mine'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function pad(n) { return String(n).padStart(2, '0'); }
  function ymd(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }
  function okDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function nice(s) { var p = s.split('-'); return MONTHS[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0]; }

  async function mount(ctx, box) {
    var staff = ctx.role === 'owner' || ctx.role === 'supervisor';
    var items = {};            // date -> [item]
    var mineCol = ctx.bizRef.collection('events');
    var today = vutil.todayStr(), t = today.split('-');
    var view = { y: +t[0], m: +t[1] - 1 }, selected = today;

    function add(date, type, title, sub, href, extra) {
      if (!okDate(date)) return;
      (items[date] = items[date] || []).push(Object.assign({ type: type, title: title, sub: sub || '', href: href || '' }, extra || {}));
    }

    async function load() {
      items = {};
      var jobs = [
        ctx.bizRef.collection('jobs').get().then(function (s) {
          s.forEach(function (d) {
            var j = d.data(); if (['Not Started', 'In Progress', 'On Hold'].indexOf(j.status) < 0) return;
            var who = j.customerName || 'Job', what = j.title || j.estimateNumber || '';
            add(j.startDate, 'start', who, 'Job starts' + (what ? ' · ' + what : ''), 'job.html?id=' + d.id);
            add(j.targetEndDate, 'end', who, 'Job target finish' + (what ? ' · ' + what : ''), 'job.html?id=' + d.id);
          });
        }),
        ctx.bizRef.collection('leads').get().then(function (s) {
          s.forEach(function (d) {
            var l = d.data(); if (l.status === 'Won' || l.status === 'Lost') return;
            add(l.followUpOn, 'lead', l.name || 'Lead', 'Follow up' + (l.phone ? ' · ' + l.phone : ''), 'leads.html');
          });
        }),
        mineCol.where('ownerUid', '==', ctx.user.uid).get().then(function (s) {
          s.forEach(function (d) { var e = d.data(); add(e.date, 'mine', e.title || 'My date', e.note || '', '', { id: d.id }); });
        })
      ];
      if (staff) {
        jobs.push(ctx.bizRef.collection('invoices').get().then(function (s) {
          s.forEach(function (d) {
            var i = d.data(); if (i.status !== 'Sent' && i.status !== 'Partially Paid') return;
            var bal = (i.totalCents || 0) - (i.paidCents || 0);
            add(i.dueDate, 'invoice', (i.customerName || 'Invoice') + ' · ' + (i.number || ''), vutil.fmt(bal) + ' due' + (i.dueDate < today ? ' (overdue)' : ''), 'invoice.html?id=' + d.id);
          });
        }));
        jobs.push(ctx.bizRef.collection('subs').get().then(function (s) {
          s.forEach(function (d) {
            var x = d.data();
            add(x.licenseExpires, 'sub', (x.name || 'Subcontractor') + ' \u00b7 licence expires', x.trade || '', 'subs.html');
            add(x.insuranceExpires, 'sub', (x.name || 'Subcontractor') + ' \u00b7 insurance expires', x.trade || '', 'subs.html');
          });
        }));
        jobs.push(ctx.bizRef.collection('expenses').where('status', '==', 'Unpaid').get().then(function (s) {
          s.forEach(function (d) {
            var x = d.data();
            add(x.dueDate, 'bill', x.description || 'Bill', vutil.fmt(x.amountCents) + (x.vendor ? ' · ' + x.vendor : '') + (x.dueDate < today ? ' (overdue)' : ''), 'expense.html?id=' + d.id);
          });
        }));
      }
      await Promise.all(jobs.map(function (p) { return p.catch(function () { /* one source failing should not hide the rest */ }); }));
    }

    function glow(types) {
      var shadows = [];
      if (types[0]) shadows.push('0 0 0 2px ' + TYPES[types[0]].color, '0 0 10px 2px ' + TYPES[types[0]].color + '99');
      if (types[1]) shadows.push('inset 0 0 0 2px ' + TYPES[types[1]].color, 'inset 0 0 8px ' + TYPES[types[1]].color + '99');
      return shadows.join(',');
    }

    function render() {
      box.textContent = '';
      var head = el('div', 'cal-head');
      var prev = el('button', 'cal-nav', '‹'), next = el('button', 'cal-nav', '›');
      prev.type = next.type = 'button';
      prev.addEventListener('click', function () { view.m--; if (view.m < 0) { view.m = 11; view.y--; } render(); });
      next.addEventListener('click', function () { view.m++; if (view.m > 11) { view.m = 0; view.y++; } render(); });
      var title = el('button', 'cal-title', MONTHS[view.m] + ' ' + view.y); title.type = 'button';
      title.addEventListener('click', function () { view = { y: +t[0], m: +t[1] - 1 }; selected = today; render(); });
      head.appendChild(prev); head.appendChild(title); head.appendChild(next);
      box.appendChild(head);

      var grid = el('div', 'cal-grid');
      ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(function (d) { grid.appendChild(el('div', 'cal-dow', d)); });
      var first = new Date(view.y, view.m, 1).getDay(), days = new Date(view.y, view.m + 1, 0).getDate();
      for (var b = 0; b < first; b++) grid.appendChild(el('div', 'cal-cell blank'));
      for (var d = 1; d <= days; d++) {
        (function (day) {
          var key = ymd(view.y, view.m, day), list = items[key] || [];
          var kinds = ORDER.filter(function (k) { return list.some(function (i) { return i.type === k; }); });
          var c = el('button', 'cal-cell' + (key === today ? ' today' : '') + (key === selected ? ' sel' : ''));
          c.type = 'button';
          c.appendChild(el('span', 'cal-num', String(day)));
          if (kinds.length) {
            c.style.boxShadow = glow(kinds);
            var dots = el('span', 'cal-dots');
            kinds.forEach(function (k) { var dot = el('i'); dot.style.background = TYPES[k].color; dots.appendChild(dot); });
            c.appendChild(dots);
          }
          c.setAttribute('aria-label', nice(key) + (list.length ? ', ' + list.length + ' item' + (list.length === 1 ? '' : 's') : ''));
          c.addEventListener('click', function () { selected = key; render(); });
          grid.appendChild(c);
        })(d);
      }
      box.appendChild(grid);

      var legend = el('div', 'cal-legend');
      ORDER.forEach(function (k) {
        if (!staff && (k === 'invoice' || k === 'bill' || k === 'sub')) return;
        var l = el('span'); var dot = el('i'); dot.style.background = TYPES[k].color; l.appendChild(dot); l.appendChild(document.createTextNode(TYPES[k].label)); legend.appendChild(l);
      });
      box.appendChild(legend);

      // cards for the selected day
      var cards = el('div', 'cal-cards');
      cards.appendChild(el('h3', '', nice(selected)));
      var list2 = (items[selected] || []).slice().sort(function (a, b) { return ORDER.indexOf(a.type) - ORDER.indexOf(b.type); });
      if (!list2.length) cards.appendChild(el('div', 'note', 'Nothing on this day.'));
      list2.forEach(function (it) {
        var card = el(it.href ? 'a' : 'div', 'cal-card');
        if (it.href) card.href = it.href;
        card.style.borderColor = TYPES[it.type].color; card.style.boxShadow = '0 0 10px ' + TYPES[it.type].color + '55';
        var l = el('div', 'cal-card-l');
        l.appendChild(el('small', '', TYPES[it.type].label));
        l.appendChild(el('b', '', it.title));
        if (it.sub) l.appendChild(el('span', '', it.sub));
        card.appendChild(l);
        if (it.type === 'mine') {
          var del = el('button', 'mini danger', 'Delete'); del.type = 'button';
          del.addEventListener('click', async function (e) {
            e.preventDefault();
            if (!confirm('Delete this date?')) return;
            try { await mineCol.doc(it.id).delete(); await load(); render(); } catch (x) { alert(vyro.friendly(x)); }
          });
          card.appendChild(del);
        }
        cards.appendChild(card);
      });

      var form = el('div', 'cal-form');
      var ti = el('input'); ti.type = 'text'; ti.maxLength = 100; ti.placeholder = 'Add my own date (e.g. Permit inspection)';
      var no = el('input'); no.type = 'text'; no.maxLength = 300; no.placeholder = 'Note (optional)';
      var go = el('button', 'btn ghost', 'Add to my calendar'); go.type = 'button';
      var msg = el('div', 'note');
      go.addEventListener('click', async function () {
        var tt = ti.value.trim(); if (!tt) { msg.textContent = 'Type what the date is for.'; msg.className = 'note err'; return; }
        go.disabled = true;
        try {
          await mineCol.add({ ownerUid: ctx.user.uid, date: selected, title: tt, note: no.value.trim(), createdAt: vyro.stamp() });
          await load(); render();
        } catch (x) { msg.textContent = vyro.friendly(x); msg.className = 'note err'; go.disabled = false; }
      });
      form.appendChild(ti); form.appendChild(no); form.appendChild(go); form.appendChild(msg);
      form.appendChild(el('div', 'note', 'Only you can see "My dates".'));
      cards.appendChild(form);
      box.appendChild(cards);
    }

    try { await load(); } catch (e) { /* show an empty calendar */ }
    render();
  }

  window.vcal = { mount: mount };
})();
