// VyqilAssistant screens: Today, Calendar, Money, Household.
(function () {
  var VA = window.VA, esc = VA.esc, S = VA.S, D = function () { return S.data; };
  var COLORS = { event: '#62B6F5', bill: '#f0c36d', task: '#7fe3b0', bday: '#b48cff', home: '#ff9f6b', note: '#8a9bb0', trial: '#f0c36d', trip: '#62B6F5' };
  var ICON = { event: '\u{1F4C5}', bill: '\u{1F4B2}', task: '\u2705', bday: '\u{1F382}', home: '\u{1F527}', note: '\u{1F4C4}', trial: '\u23F0', trip: '\u2708\uFE0F' };
  VA.COLORS = COLORS;
  S.cal = S.cal || { y: new Date().getFullYear(), m: new Date().getMonth() };
  S.mon = S.mon || { y: new Date().getFullYear(), m: new Date().getMonth() };
  S.wk = S.wk || null;

  function mk(kind, date, ref, extra) {
    var o = { kind: kind, date: date, ref: ref, time: ref.time || '', who: ref.who || '', color: COLORS[kind], icon: ICON[kind] };
    return Object.assign(o, extra || {});
  }
  // Every dated thing in a range: appointments (with repeats), bills, tasks, birthdays, home care, expiries.
  VA.occ = function (from, to) {
    var out = [], d = D();
    d.events.forEach(function (e) {
      if (!e.date) return;
      var rep = e.repeat || 'none';
      if (rep === 'none') { if (e.date >= from && e.date <= to) out.push(mk('event', e.date, e, { title: e.title })); return; }
      for (var i = 0; i < 900; i++) {
        var x = rep === 'weekly' ? VA.addDays(e.date, 7 * i) : VA.addMonths(e.date, rep === 'yearly' ? 12 * i : i);
        if (x > to) break; if (x >= from) out.push(mk('event', x, e, { title: e.title }));
      }
    });
    d.bills.forEach(function (b) {
      if (!b.dueDate || b.paid) return;
      var rep = b.repeat || 'monthly';
      for (var i = 0; i < (rep === 'once' ? 1 : 60); i++) {
        var x = rep === 'weekly' ? VA.addDays(b.dueDate, 7 * i) : VA.addMonths(b.dueDate, rep === 'yearly' ? 12 * i : i);
        if (x > to) break; if (x >= from || (i === 0 && x < from && from === VA.today() && false)) out.push(mk('bill', x, b, { title: b.name + ' \u00B7 ' + VA.money(b.amount), first: i === 0 }));
      }
      if (b.trialEnds && b.trialEnds >= from && b.trialEnds <= to) out.push(mk('trial', b.trialEnds, b, { title: b.name + ' free trial ends' }));
    });
    d.tasks.forEach(function (t) { if (!t.done && t.due && t.due >= from && t.due <= to) out.push(mk('task', t.due, t, { title: t.title })); });
    d.people.forEach(function (p) {
      var m = /^\d{4}-(\d{2}-\d{2})$/.exec(p.birthday || ''); if (!m) return;
      var y0 = +from.slice(0, 4), y1 = +to.slice(0, 4);
      for (var y = y0; y <= y1; y++) { var x = y + '-' + m[1]; if (x >= from && x <= to) { var age = y - +p.birthday.slice(0, 4); out.push(mk('bday', x, p, { title: p.name + "'s birthday" + (age > 0 && age < 120 ? ' (' + age + ')' : ''), who: p.name })); } }
    });
    d.home.forEach(function (h) { var n = VA.homeNext(h); if (n && n >= from && n <= to) out.push(mk('home', n, h, { title: h.name })); });
    d.notes.forEach(function (n) { if (n.expires && n.expires >= from && n.expires <= to) out.push(mk('note', n.expires, n, { title: n.title + ' expires' })); });
    if (VA.trips) out = out.concat(VA.trips.occ(from, to));
    out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time || '99') < (b.time || '99') ? -1 : 1; });
    return out;
  };
  // Things already late (not in the future) that still need action.
  VA.late = function () {
    var t = VA.today(), d = D(), out = [];
    d.bills.forEach(function (b) { if (!b.paid && b.dueDate && b.dueDate < t) out.push(mk('bill', b.dueDate, b, { title: b.name + ' \u00B7 ' + VA.money(b.amount), first: true })); });
    d.tasks.forEach(function (x) { if (!x.done && x.due && x.due < t) out.push(mk('task', x.due, x, { title: x.title })); });
    d.home.forEach(function (h) { var n = VA.homeNext(h); if (n && n < t) out.push(mk('home', n, h, { title: h.name })); });
    out.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    return out;
  };
  function openRef(o) { var m = { event: 'event', bill: 'bill', task: 'task', bday: 'person', home: 'home', note: 'note', trial: 'bill', trip: 'trip' }[o.kind]; if (o.kind === 'trip' && VA.trips) { VA.trips.open(o.ref.id); return; } VA.openForm(m, o.ref); }
  function whoPill(w) { return w ? '<span class="pill">' + esc(w) + '</span>' : ''; }
  function when(o) {
    var n = VA.diff(VA.today(), o.date), s = n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n < 0 ? Math.abs(n) + ' day' + (n === -1 ? '' : 's') + ' late' : VA.fmtDate(o.date);
    return s + (o.time ? ' \u00B7 ' + VA.fmtTime(o.time) : '');
  }
  function occRow(o, ix) {
    var late = VA.diff(VA.today(), o.date) < 0 && (o.kind === 'bill' || o.kind === 'task' || o.kind === 'home');
    var act = '';
    if (o.kind === 'bill' && o.first) act = '<button class="btn sm" data-a="pay" data-id="' + esc(o.ref.id) + '" type="button">Paid</button>';
    else if (o.kind === 'task') act = '<button class="btn sm" data-a="task" data-id="' + esc(o.ref.id) + '" type="button">Done</button>';
    else if (o.kind === 'home') act = '<button class="btn sm" data-a="home" data-id="' + esc(o.ref.id) + '" type="button">Done</button>';
    return '<div class="row" data-a="open" data-ix="' + ix + '" style="cursor:pointer"><span style="font-size:1.2rem">' + o.icon + '</span><div class="m"><b>' + esc(o.title) + '</b><span style="' + (late ? 'color:#ff8a8a' : '') + '">' + esc(when(o)) + ' ' + whoPill(o.who) + (o.kind === 'bill' && o.ref.autopay ? '<span class="pill ok">autopay</span>' : '') + '</span></div>' + act + '</div>';
  }
  var LAST = [];
  function rows(list) { var h = ''; list.forEach(function (o) { LAST.push(o); h += occRow(o, LAST.length - 1); }); return h; }
  function wire(root) {
    root.onclick = function (e) {
      var t = e.target.closest('[data-a]'); if (!t || !root.contains(t)) return;
      if (t.tagName === 'A') e.preventDefault();
      var a = t.getAttribute('data-a'), id = t.getAttribute('data-id');
      if (a === 'open') { if (e.target.closest('button')) return; openRef(LAST[+t.getAttribute('data-ix')]); return; }
      e.stopPropagation();
      if (a === 'pay') VA.payBill(VA.get('bills', id));
      else if (a === 'task') VA.completeTask(VA.get('tasks', id));
      else if (a === 'home') VA.homeDone(VA.get('home', id));
      else if (VA.act && VA.act[a]) VA.act[a](t, id);
    };
  }
  VA.act = {};
  function section(title, right, body) { return '<h2>' + esc(title) + (right ? '<small>' + right + '</small>' : '') + '</h2>' + body; }

  // ---------------- TODAY ----------------
  function greeting() { var h = new Date().getHours(); return (h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening') + ', ' + VA.me(); }
  VA.views = {};
  VA.views.today = function (root) {
    LAST = []; var t = VA.today(), d = D(), end7 = VA.addDays(t, 7), late = VA.late();
    var soon = VA.occ(t, VA.addDays(t, 14)).filter(function (o) { return (o.kind === 'bill' && o.first && VA.diff(t, o.date) <= 3) || (o.kind === 'trial' && VA.diff(t, o.date) <= 7) || (o.kind === 'note' && VA.diff(t, o.date) <= 30); });
    var notesSoon = VA.occ(t, VA.addDays(t, 30)).filter(function (o) { return o.kind === 'note'; });
    var tiles = late.concat(soon.filter(function (o) { return o.kind !== 'note'; })).concat(notesSoon);
    var h = '<h2 style="margin-top:6px">' + esc(greeting()) + '<small>' + esc(VA.fmtDate(t)) + '</small></h2>';
    if (tiles.length) {
      h += section('Needs you', tiles.length + ' item' + (tiles.length === 1 ? '' : 's'), '<div class="hscroll">' + tiles.map(function (o) {
        LAST.push(o); var n = VA.diff(t, o.date), over = n < 0;
        var btn = o.kind === 'bill' && o.first ? '<button class="btn sm" style="margin-top:6px;width:100%" data-a="pay" data-id="' + esc(o.ref.id) + '" type="button">Mark paid</button>' : o.kind === 'task' ? '<button class="btn sm" style="margin-top:6px;width:100%" data-a="task" data-id="' + esc(o.ref.id) + '" type="button">Done</button>' : o.kind === 'home' ? '<button class="btn sm" style="margin-top:6px;width:100%" data-a="home" data-id="' + esc(o.ref.id) + '" type="button">Done today</button>' : '';
        return '<div class="tile' + (over ? ' over' : '') + '" style="--c:' + o.color + '"><div class="k">' + esc({ bill: 'Bill', task: 'Task', home: 'Home care', trial: 'Free trial', note: 'Renewal', event: 'Event' }[o.kind] || '') + '</div><div class="n" data-a="open" data-ix="' + (LAST.length - 1) + '" style="cursor:pointer">' + esc(o.title) + '</div><div class="d" style="' + (over ? 'color:#ff8a8a' : '') + '">' + (over ? Math.abs(n) + ' day' + (n === -1 ? '' : 's') + ' overdue' : n === 0 ? 'Due today' : 'Due ' + VA.rel(o.date)) + '</div>' + btn + '</div>';
      }).join('') + '</div>');
    }
    var todayList = VA.occ(t, t).filter(function (o) { return o.kind !== 'note'; });
    var meal = d.meals.filter(function (m) { return m.date === t; });
    h += section('Today', '', '<div class="card">' + (todayList.length || meal.length ? rows(todayList) + meal.map(function (m) { return '<div class="row"><span style="font-size:1.2rem">\u{1F37D}</span><div class="m"><b>' + esc(m.text) + '</b><span>' + esc(m.slot) + '</span></div></div>'; }).join('') : '<div class="empty">Nothing scheduled today. Tap + Quick add to add something.</div>') + '</div>');
    var up = VA.occ(VA.addDays(t, 1), end7).filter(function (o) { return o.kind !== 'note'; });
    h += section('Next 7 days', '', '<div class="card">' + (up.length ? rows(up) : '<div class="empty">A clear week.</div>') + '</div>');
    // this month at a glance
    var ym = t.slice(0, 7), spent = 0, earned = 0;
    d.txns.forEach(function (x) { if ((x.date || '').slice(0, 7) === ym) { if (x.type === 'income') earned += x.amount || 0; else spent += x.amount || 0; } });
    var due30 = 0; VA.occ(t, VA.addDays(t, 30)).forEach(function (o) { if (o.kind === 'bill') due30 += o.ref.amount || 0; });
    h += section('This month', '<a href="#" data-a="goMoney">Open money</a>', '<div class="stat"><div><b>' + VA.money(spent) + '</b><span>spent</span></div><div><b>' + VA.money(earned) + '</b><span>received</span></div><div><b>' + VA.money(due30) + '</b><span>bills in 30 days</span></div></div>');
    if (!d.events.length && !d.bills.length && !d.tasks.length && !d.people.length) {
      h += '<div class="card"><b>Welcome! Start here:</b><div class="hint" style="margin:6px 0 10px">Tap + Quick add and type or say things like "Mia dentist next Tuesday at 3, rent $1450 due the 1st, buy milk and eggs". The assistant sorts it for you. Or add your family first.</div><div class="btns"><button class="btn" data-a="goPeople" type="button">Add my family</button><button class="btn ghost" data-a="goBill" type="button">Add a bill</button></div></div>';
    }
    root.innerHTML = h; wire(root);
  };
  VA.act.goMoney = function () { VA.go('money'); };
  VA.act.goPeople = function () { VA.go('house', 'people'); };
  VA.act.goBill = function () { VA.openForm('bill'); };

  // ---------------- CALENDAR ----------------
  function icsEsc(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
  function dt(s) { return s.replace(/-/g, ''); }
  VA.makeICS = function () {
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//VyqilAssistant//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:' + icsEsc((S.hh && S.hh.name) || 'Household')], d = D(), stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    function ev(uid, summary, date, o) {
      o = o || {};
      L.push('BEGIN:VEVENT', 'UID:' + uid + '@vyqil', 'DTSTAMP:' + stamp, 'SUMMARY:' + icsEsc(summary));
      if (o.time) { var e = o.end || (function () { var m = /^(\d+):(\d+)/.exec(o.time), h = (+m[1] + 1) % 24; return (h < 10 ? '0' : '') + h + ':' + m[2]; })(); L.push('DTSTART:' + dt(date) + 'T' + o.time.replace(':', '') + '00', 'DTEND:' + dt(date) + 'T' + e.replace(':', '') + '00'); }
      else L.push('DTSTART;VALUE=DATE:' + dt(date), 'DTEND;VALUE=DATE:' + dt(VA.addDays(o.endDate || date, 1)));
      if (o.rrule) L.push('RRULE:' + o.rrule);
      if (o.place) L.push('LOCATION:' + icsEsc(o.place));
      if (o.notes) L.push('DESCRIPTION:' + icsEsc(o.notes));
      if (o.alarm) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(summary), 'TRIGGER:-PT' + o.alarm + 'M', 'END:VALARM');
      L.push('END:VEVENT');
    }
    var R = { weekly: 'FREQ=WEEKLY', monthly: 'FREQ=MONTHLY', yearly: 'FREQ=YEARLY' };
    d.events.forEach(function (e) { if (e.date) ev(e.id, (e.who ? e.who + ': ' : '') + e.title, e.date, { time: e.time, end: e.endTime, place: e.place, notes: e.notes, rrule: R[e.repeat], alarm: +e.remind || 0 }); });
    d.bills.forEach(function (b) { if (b.dueDate && !b.paid) ev(b.id, 'Bill due: ' + b.name + ' ' + VA.money(b.amount), b.dueDate, { rrule: R[b.repeat] || (b.repeat === 'once' ? '' : 'FREQ=MONTHLY'), alarm: 1440 }); });
    d.people.forEach(function (p) { if (/^\d{4}-\d{2}-\d{2}$/.test(p.birthday || '')) ev('b' + p.id, p.name + "'s birthday", p.birthday, { rrule: 'FREQ=YEARLY', alarm: 1440 }); });
    d.tasks.forEach(function (t) { if (!t.done && t.due) ev(t.id, 'Task: ' + t.title + (t.who ? ' (' + t.who + ')' : ''), t.due, {}); });
    d.home.forEach(function (h) { var n = VA.homeNext(h); if (n) ev(h.id, 'Home care: ' + h.name, n, { rrule: h.everyDays % 365 === 0 ? 'FREQ=YEARLY;INTERVAL=' + (h.everyDays / 365) : h.everyDays % 7 === 0 ? 'FREQ=WEEKLY;INTERVAL=' + (h.everyDays / 7) : 'FREQ=DAILY;INTERVAL=' + h.everyDays }); });
    (d.trips || []).forEach(function (t) { if (t.start) ev('trip' + t.id, 'Trip: ' + t.name, t.start, { endDate: t.end || t.start, place: t.dest, notes: t.notes }); });
    L.push('END:VCALENDAR'); return L.join('\r\n');
  };
  VA.views.calendar = function (root) {
    LAST = []; var c = S.cal, t = VA.today(), first = new Date(c.y, c.m, 1, 12), start = new Date(c.y, c.m, 1 - first.getDay(), 12);
    var gridFrom = VA.ymd(start), gridTo = VA.addDays(gridFrom, 41), items = VA.occ(gridFrom, gridTo).concat(VA.late().filter(function (o) { return o.date >= gridFrom; }));
    var by = {}; items.forEach(function (o) { (by[o.date] = by[o.date] || []).push(o); });
    var h = '<div class="row" style="border:0"><button class="ibtn" data-a="calPrev" type="button">&lsaquo;</button><div class="m" style="text-align:center"><b>' + VA.MON[c.m] + ' ' + c.y + '</b></div><button class="ibtn" data-a="calNext" type="button">&rsaquo;</button></div><div class="cal">';
    VA.DOW.forEach(function (n) { h += '<div class="h">' + n[0] + '</div>'; });
    for (var i = 0; i < 42; i++) {
      var ds = VA.addDays(gridFrom, i), dd = VA.parse(ds), kinds = {}; (by[ds] || []).forEach(function (o) { kinds[o.kind === 'bill' || o.kind === 'trial' ? 'b' : o.kind === 'task' ? 't' : o.kind === 'bday' ? 'p' : 'e'] = 1; });
      h += '<button data-a="calDay" data-id="' + ds + '" class="' + (dd.getMonth() !== c.m ? 'other ' : '') + (ds === t ? 'today ' : '') + (ds === S.sel ? 'sel' : '') + '" type="button">' + dd.getDate() + '<em>' + Object.keys(kinds).map(function (k) { return '<s class="' + (k === 'e' ? '' : k) + '"></s>'; }).join('') + '</em></button>';
    }
    h += '</div>';
    var sel = S.sel || t;
    h += section(VA.fmtDate(sel), '<a href="#" data-a="addEvt">+ Add</a>', '<div class="card">' + ((by[sel] || []).length ? rows(by[sel]) : '<div class="empty">Nothing on this day.</div>') + '</div>');
    var nxt = VA.occ(t, VA.addDays(t, 30)).filter(function (o) { return o.kind !== 'note'; });
    h += section('Next 30 days', nxt.length + '', '<div class="card">' + (nxt.length ? rows(nxt.slice(0, 40)) : '<div class="empty">Nothing coming up.</div>') + '</div>');
    h += '<div class="card"><b>Get reminders on your phone</b><div class="hint" style="margin:4px 0 10px">Download your calendar and open it with your phone\'s calendar app. Appointments, bills and birthdays then ring even when VyqilAssistant is closed. Do this again after big changes.</div><button class="btn ghost" data-a="ics" type="button">Download calendar file (.ics)</button></div>';
    root.innerHTML = h; wire(root);
  };
  VA.act.calPrev = function () { S.cal.m--; if (S.cal.m < 0) { S.cal.m = 11; S.cal.y--; } VA.render(); };
  VA.act.calNext = function () { S.cal.m++; if (S.cal.m > 11) { S.cal.m = 0; S.cal.y++; } VA.render(); };
  VA.act.calDay = function (t, id) { S.sel = id; VA.render(); };
  VA.act.addEvt = function () { VA.openForm('event', null, { date: S.sel || VA.today() }); };
  VA.act.ics = function () { VA.download('vyqil-calendar.ics', VA.makeICS(), 'text/calendar'); VA.toast('Calendar file downloaded. Open it to add it to your phone calendar.'); };

  // ---------------- MONEY ----------------
  function monthly(b) { var a = b.amount || 0; return b.repeat === 'weekly' ? a * 52 / 12 : b.repeat === 'yearly' ? a / 12 : b.repeat === 'once' ? 0 : a; }
  VA.views.money = function (root) {
    LAST = []; var sub = S.sub.money || 'bills', d = D(), t = VA.today();
    var h = '<div class="subs">' + [['bills', 'Bills'], ['spend', 'Spending'], ['goals', 'Goals'], ['debts', 'Debts'], ['subs', 'Subscriptions']].map(function (x) { return '<button data-a="sub" data-id="money:' + x[0] + '" class="' + (sub === x[0] ? 'on' : '') + '" type="button">' + x[1] + '</button>'; }).join('') + '</div>';
    if (sub === 'bills') {
      var open = d.bills.filter(function (b) { return !b.paid; }).sort(function (a, b) { return (a.dueDate || '') < (b.dueDate || '') ? -1 : 1; });
      var mon = 0; open.forEach(function (b) { mon += monthly(b); });
      var cat = S.billCat || 'All', cats = ['All'].concat(VA.CATS_BILL.filter(function (c) { return open.some(function (b) { return b.category === c; }); }));
      var shown = open.filter(function (b) { return cat === 'All' || b.category === cat; });
      h += '<div class="stat"><div><b>' + VA.money(Math.round(mon)) + '</b><span>per month (approx.)</span></div><div><b>' + open.length + '</b><span>bills and subscriptions</span></div></div>';
      h += '<div class="btns"><button class="btn" data-a="addBill" type="button">+ Add bill</button><button class="btn ghost" data-a="saveTips" type="button">Ways to save</button></div>';
      if (cats.length > 2) h += '<div class="subs" style="margin-top:8px">' + cats.map(function (c) { return '<button data-a="billCat" data-id="' + esc(c) + '" class="' + (cat === c ? 'on' : '') + '" type="button">' + esc(c) + '</button>'; }).join('') + '</div>';
      h += '<div class="card">' + (shown.length ? shown.map(function (b) {
        var n = VA.diff(t, b.dueDate), late = n < 0, trial = b.trialEnds && VA.diff(t, b.trialEnds) >= 0 && VA.diff(t, b.trialEnds) <= 14;
        return '<div class="row' + '" data-a="editBill" data-id="' + esc(b.id) + '" style="cursor:pointer;' + (late ? 'border:2px solid #ff4d4d;border-radius:12px;padding:8px;margin:4px 0;box-shadow:0 0 14px rgba(255,77,77,.6)' : '') + '"><div class="m"><b>' + esc(b.name) + '</b><span style="' + (late ? 'color:#ff8a8a' : '') + '">' + (late ? Math.abs(n) + ' day' + (n === -1 ? '' : 's') + ' overdue' : 'Due ' + esc(VA.fmtShort(b.dueDate)) + ' (' + VA.rel(b.dueDate) + ')') + ' <span class="pill">' + esc(b.repeat === 'once' ? 'one time' : b.repeat) + '</span>' + (b.autopay ? '<span class="pill ok">autopay</span>' : '') + (trial ? '<span class="pill warn">trial ends ' + esc(VA.fmtShort(b.trialEnds)) + '</span>' : '') + '</span></div><span class="amt">' + VA.money(b.amount) + '</span><button class="btn sm" data-a="pay" data-id="' + esc(b.id) + '" type="button">Paid</button></div>';
      }).join('') : '<div class="empty">No bills yet. Add rent, utilities, insurance and subscriptions and VyqilAssistant will remind you.</div>') + '</div>';
    } else if (sub === 'spend') {
      var m = S.mon, ym = m.y + '-' + (m.m + 1 < 10 ? '0' : '') + (m.m + 1);
      var tx = d.txns.filter(function (x) { return (x.date || '').slice(0, 7) === ym; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
      var spent = 0, earned = 0, bycat = {}; tx.forEach(function (x) { if (x.type === 'income') earned += x.amount || 0; else { spent += x.amount || 0; bycat[x.category || 'Other'] = (bycat[x.category || 'Other'] || 0) + (x.amount || 0); } });
      var budgets = (S.hh && S.hh.budgets) || {};
      h += '<div class="row" style="border:0"><button class="ibtn" data-a="monPrev" type="button">&lsaquo;</button><div class="m" style="text-align:center"><b>' + VA.MON[m.m] + ' ' + m.y + '</b></div><button class="ibtn" data-a="monNext" type="button">&rsaquo;</button></div>';
      h += '<div class="stat"><div><b>' + VA.money(spent) + '</b><span>spent</span></div><div><b>' + VA.money(earned) + '</b><span>received</span></div><div><b>' + VA.money(earned - spent) + '</b><span>left over</span></div></div>';
      h += '<div class="btns"><button class="btn" data-a="addTxn" type="button">+ Add</button><button class="btn ghost" data-a="budgets" type="button">Set budgets</button><button class="btn ghost" data-a="importCsv" type="button">Import bank file</button><button class="btn ghost" data-a="csv" type="button">Export</button></div>';
      h += VA.mx.compareHtml(ym);
      var cl = Object.keys(bycat).sort(function (a, b) { return bycat[b] - bycat[a]; });
      if (cl.length) h += '<div class="card">' + cl.map(function (c) { var bu = (budgets[c] || 0), pct = bu ? Math.min(100, Math.round(bycat[c] * 100 / bu)) : Math.round(bycat[c] * 100 / Math.max(1, spent)); return '<div style="margin:8px 0"><div style="display:flex;justify-content:space-between"><span>' + esc(c) + '</span><span><b>' + VA.money(bycat[c]) + '</b>' + (bu ? ' <span class="hint">of ' + VA.money(bu) + '</span>' : '') + '</span></div><div class="bar' + (bu && bycat[c] > bu ? ' over' : '') + '"><i style="width:' + pct + '%"></i></div></div>'; }).join('') + '</div>';
      h += '<div class="card">' + (tx.length ? tx.map(function (x) { return '<div class="row" data-a="editTxn" data-id="' + esc(x.id) + '" style="cursor:pointer"><div class="m"><b>' + esc(x.note || x.category || 'Entry') + '</b><span>' + esc(VA.fmtShort(x.date)) + ' \u00B7 ' + esc(x.category || '') + '</span></div><span class="amt" style="color:' + (x.type === 'income' ? '#7fe3b0' : '#fff') + '">' + (x.type === 'income' ? '+' : '') + VA.money(x.amount) + '</span></div>'; }).join('') : '<div class="empty">Nothing recorded this month. Paying a bill with the Paid button adds it here automatically.</div>') + '</div>';
    } else if (sub === 'debts') {
      h += VA.mx.debtHtml();
    } else if (sub === 'subs') {
      h += VA.mx.subsHtml();
    } else {
      h += '<div class="btns"><button class="btn" data-a="addGoal" type="button">+ Savings goal</button></div><div class="card">' + (d.goals.length ? d.goals.map(function (g) {
        var pct = g.target ? Math.min(100, Math.round((g.saved || 0) * 100 / g.target)) : 0;
        return '<div style="margin:10px 0"><div style="display:flex;justify-content:space-between;gap:8px"><b data-a="editGoal" data-id="' + esc(g.id) + '" style="cursor:pointer">' + esc(g.name) + '</b><span>' + VA.money(g.saved) + ' <span class="hint">of ' + VA.money(g.target) + '</span></span></div><div class="bar"><i style="width:' + pct + '%"></i></div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px"><span class="hint">' + pct + '%' + (g.by ? ' \u00B7 by ' + esc(VA.fmtShort(g.by)) : '') + '</span><button class="btn sm ghost" data-a="addSaved" data-id="' + esc(g.id) + '" type="button">+ Add money</button></div></div>';
      }).join('') : '<div class="empty">Set a goal like an emergency fund or a trip, and add money as you save.</div>') + '</div>';
    }
    root.innerHTML = h; wire(root); if (VA.mx && VA.mx.afterRender) VA.mx.afterRender(root);
  };
  VA.act.sub = function (t, id) { var p = id.split(':'); S.sub[p[0]] = p[1]; VA.render(); };
  VA.act.addBill = function () { VA.openForm('bill'); };
  VA.act.editBill = function (t, id) { VA.openForm('bill', VA.get('bills', id)); };
  VA.act.billCat = function (t, id) { S.billCat = id; VA.render(); };
  VA.act.saveTips = function () { VA.go('ask'); VA.ai.send('Look at my bills and subscriptions. Which ones should I check first to save money, and what exactly should I do for each?'); };
  VA.act.addTxn = function () { VA.openForm('txn'); };
  VA.act.editTxn = function (t, id) { VA.openForm('txn', VA.get('txns', id)); };
  VA.act.monPrev = function () { S.mon.m--; if (S.mon.m < 0) { S.mon.m = 11; S.mon.y--; } VA.render(); };
  VA.act.monNext = function () { S.mon.m++; if (S.mon.m > 11) { S.mon.m = 0; S.mon.y++; } VA.render(); };
  VA.act.addGoal = function () { VA.openForm('goal'); };
  VA.act.editGoal = function (t, id) { VA.openForm('goal', VA.get('goals', id)); };
  VA.act.addSaved = function (t, id) {
    var g = VA.get('goals', id);
    VA.modal('<h3>Add to ' + esc(g.name) + '</h3><label class="f">Amount ($)</label><input id="gAmt" type="number" step="0.01" min="0" inputmode="decimal"><div class="btns"><button class="btn" id="gOk" type="button">Add</button><button class="btn ghost" id="gNo" type="button">Cancel</button></div>', function (s, close) {
      s.querySelector('#gNo').onclick = close; s.querySelector('#gOk').onclick = function () { var c = VA.cents(s.querySelector('#gAmt').value); if (c > 0) { VA.save('goals', id, { saved: (g.saved || 0) + c }); close(); VA.toast('Added ' + VA.money(c)); } };
    });
  };
  VA.act.budgets = function () {
    var b = (S.hh && S.hh.budgets) || {};
    VA.modal('<h3>Monthly budgets</h3><div class="hint">Leave a box empty for no budget. Bars turn red when you go over.</div>' + VA.CATS_TXN.filter(function (c) { return c !== 'Pay'; }).map(function (c) { return '<label class="f">' + esc(c) + ' ($)</label><input data-c="' + esc(c) + '" type="number" min="0" step="1" inputmode="numeric" value="' + (b[c] ? Math.round(b[c] / 100) : '') + '">'; }).join('') + '<div class="btns"><button class="btn" id="bOk" type="button">Save</button><button class="btn ghost" id="bNo" type="button">Cancel</button></div>', function (s, close) {
      s.querySelector('#bNo').onclick = close;
      s.querySelector('#bOk').onclick = function () { var o = {}; s.querySelectorAll('input[data-c]').forEach(function (i) { var c = VA.cents(i.value); if (c > 0) o[i.getAttribute('data-c')] = c; }); VA.db().collection('households').doc(S.hid).set({ budgets: o }, { merge: true }).then(function () { close(); VA.toast('Budgets saved'); }); };
    });
  };
  VA.act.csv = function () {
    var rows = [['Date', 'Type', 'Category', 'Note', 'Amount']]; S.data.txns.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).forEach(function (x) { rows.push([x.date, x.type, x.category, x.note, ((x.amount || 0) / 100).toFixed(2)]); });
    VA.download('vyqil-money.csv', rows.map(function (r) { return r.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(','); }).join('\n'), 'text/csv');
  };

  // ---------------- HOUSEHOLD ----------------
  var HOMEIDEAS = [['Change air filter', 'Home', 90], ['Test smoke and CO alarms', 'Home', 180], ['Clean dryer vent', 'Appliance', 365], ['Flush water heater', 'Appliance', 365], ['Oil change', 'Auto', 180], ['Rotate tires', 'Auto', 180], ['Renew car registration', 'Auto', 365], ['Flea and tick treatment', 'Pet', 30], ['Dentist checkups', 'Health', 180], ['Check fire extinguisher', 'Home', 365]];
  VA.views.house = function (root) {
    LAST = []; var sub = S.sub.house || 'tasks', d = D(), t = VA.today();
    var tabs = [['tasks', 'Tasks'], ['lists', 'Lists'], ['meals', 'Meals'], ['home', 'Home care'], ['people', 'People'], ['trips', 'Trips'], ['vault', 'Records']];
    var h = '<div class="subs">' + tabs.map(function (x) { return '<button data-a="sub" data-id="house:' + x[0] + '" class="' + (sub === x[0] ? 'on' : '') + '" type="button">' + x[1] + '</button>'; }).join('') + '</div>';
    if (sub === 'tasks') {
      var wf = S.taskWho || 'All', who = ['All'].concat(VA.who());
      var open = d.tasks.filter(function (x) { return !x.done && (wf === 'All' || x.who === wf); }).sort(function (a, b) { return (a.due || '9999') < (b.due || '9999') ? -1 : 1; });
      var done = d.tasks.filter(function (x) { return x.done; }).sort(function (a, b) { return (a.doneAt || '') < (b.doneAt || '') ? 1 : -1; }).slice(0, 8);
      if (who.length > 2) h += '<div class="subs">' + who.map(function (w) { return '<button data-a="taskWho" data-id="' + esc(w) + '" class="' + (wf === w ? 'on' : '') + '" type="button">' + esc(w) + '</button>'; }).join('') + '</div>';
      h += '<div class="btns" style="margin-top:0"><button class="btn" data-a="addTask" type="button">+ Add task or chore</button></div><div class="card">' + (open.length ? open.map(function (x) {
        var n = x.due ? VA.diff(t, x.due) : null;
        return '<div class="row"><input type="checkbox" data-a="task" data-id="' + esc(x.id) + '" aria-label="Done"><div class="m" data-a="editTask" data-id="' + esc(x.id) + '" style="cursor:pointer"><b>' + esc(x.title) + '</b><span style="' + (n !== null && n < 0 ? 'color:#ff8a8a' : '') + '">' + (x.due ? (n < 0 ? Math.abs(n) + ' day' + (n === -1 ? '' : 's') + ' late' : VA.fmtDate(x.due)) : 'No due date') + (x.repeat && x.repeat !== 'none' ? ' <span class="pill">' + esc(x.repeat) + '</span>' : '') + (x.rotate ? '<span class="pill">turns</span>' : '') + whoPill(x.who) + '</span></div></div>';
      }).join('') : '<div class="empty">No open tasks. Add chores, errands and forms to sign.</div>') + '</div>';
      if (done.length) h += section('Done recently', '<a href="#" data-a="clearDone">Clear</a>', '<div class="card">' + done.map(function (x) { return '<div class="row"><input type="checkbox" checked data-a="undoTask" data-id="' + esc(x.id) + '" aria-label="Undo"><div class="m"><b style="text-decoration:line-through;opacity:.7">' + esc(x.title) + '</b><span>' + esc(VA.fmtShort(x.doneAt)) + whoPill(x.who) + '</span></div></div>'; }).join('') + '</div>');
    } else if (sub === 'trips') {
      h += VA.trips.html();
    } else if (sub === 'lists') {
      var ln = S.listName || 'Grocery', it = d.items.filter(function (x) { return x.list === ln; }).sort(function (a, b) { return (a.done ? 1 : 0) - (b.done ? 1 : 0) || (a.text || '').localeCompare(b.text || ''); });
      h += '<div class="subs">' + VA.LISTS.map(function (n) { var c = d.items.filter(function (x) { return x.list === n && !x.done; }).length; return '<button data-a="listName" data-id="' + esc(n) + '" class="' + (ln === n ? 'on' : '') + '" type="button">' + esc(n) + (c ? ' (' + c + ')' : '') + '</button>'; }).join('') + '</div>';
      h += '<div class="row" style="border:0;padding:4px 0"><input id="newItem" placeholder="Add to ' + esc(ln) + '..." maxlength="140" style="flex:1"><button class="btn" data-a="addItem" type="button">Add</button></div>';
      h += '<div class="card">' + (it.length ? it.map(function (x) { return '<div class="row"><input type="checkbox" data-a="toggleItem" data-id="' + esc(x.id) + '"' + (x.done ? ' checked' : '') + ' aria-label="Check"><div class="m"><b style="' + (x.done ? 'text-decoration:line-through;opacity:.55' : '') + '">' + esc(x.text) + '</b></div></div>'; }).join('') : '<div class="empty">This list is empty.</div>') + '</div>';
      h += '<div class="btns"><button class="btn ghost" data-a="clearChecked" type="button">Clear checked</button><button class="btn ghost" data-a="shareList" type="button">Share list</button></div>';
    } else if (sub === 'meals') {
      var ws = S.wk || (function () { var n = VA.parse(t), off = (n.getDay() + 6) % 7; return VA.addDays(t, -off); })(); S.wk = ws; var we = VA.addDays(ws, 6);
      h += '<div class="row" style="border:0"><button class="ibtn" data-a="wkPrev" type="button">&lsaquo;</button><div class="m" style="text-align:center"><b>' + esc(VA.fmtShort(ws)) + ' - ' + esc(VA.fmtShort(we)) + '</b></div><button class="ibtn" data-a="wkNext" type="button">&rsaquo;</button></div>';
      for (var i = 0; i < 7; i++) {
        var ds = VA.addDays(ws, i), ms = d.meals.filter(function (m) { return m.date === ds; }).sort(function (a, b) { return ['Breakfast', 'Lunch', 'Dinner'].indexOf(a.slot) - ['Breakfast', 'Lunch', 'Dinner'].indexOf(b.slot); });
        h += '<div class="card" style="' + (ds === t ? 'border-color:#62B6F5' : '') + '"><div style="display:flex;justify-content:space-between;align-items:center"><b>' + esc(VA.fmtDate(ds)) + '</b><button class="btn sm ghost" data-a="addMeal" data-id="' + ds + '" type="button">+ Meal</button></div>' + ms.map(function (m) { return '<div class="row" data-a="editMeal" data-id="' + esc(m.id) + '" style="cursor:pointer"><div class="m"><b>' + esc(m.text) + '</b><span>' + esc(m.slot) + '</span></div></div>'; }).join('') + '</div>';
      }
      h += '<div class="btns"><button class="btn" data-a="mealsToGrocery" type="button">Add this week\'s ingredients to Grocery</button><button class="btn ghost" data-a="planMeals" type="button">Ask for dinner ideas</button></div>';
    } else if (sub === 'home') {
      var hs = d.home.slice().sort(function (a, b) { return (VA.homeNext(a) || '9999') < (VA.homeNext(b) || '9999') ? -1 : 1; });
      h += '<div class="btns" style="margin-top:0"><button class="btn" data-a="addHome" type="button">+ Add home or car care</button></div><div class="card">' + (hs.length ? hs.map(function (x) {
        var n = VA.homeNext(x), late = n && n < t;
        return '<div class="row" style="' + (late ? 'border:2px solid #ff4d4d;border-radius:12px;padding:8px;margin:4px 0;box-shadow:0 0 14px rgba(255,77,77,.6)' : '') + '"><div class="m" data-a="editHome" data-id="' + esc(x.id) + '" style="cursor:pointer"><b>' + esc(x.name) + '</b><span>' + esc(x.category) + ' \u00B7 every ' + x.everyDays + ' days \u00B7 ' + (x.lastDone ? 'last ' + esc(VA.fmtShort(x.lastDone)) : 'never done') + ' \u00B7 <span style="' + (late ? 'color:#ff8a8a' : '') + '">next ' + esc(VA.rel(n)) + '</span></span></div><button class="btn sm" data-a="home" data-id="' + esc(x.id) + '" type="button">Done</button></div>';
      }).join('') : '<div class="empty">Track the things you keep forgetting: filters, oil changes, pet treatments, checkups.</div>') + '</div>';
      var have = {}; d.home.forEach(function (x) { have[x.name.toLowerCase()] = 1; });
      var ideas = HOMEIDEAS.filter(function (i) { return !have[i[0].toLowerCase()]; });
      if (ideas.length) h += section('Ideas', '', '<div class="chips">' + ideas.map(function (i, ix) { return '<button data-a="homeIdea" data-id="' + HOMEIDEAS.indexOf(i) + '" type="button">+ ' + esc(i[0]) + '</button>'; }).join('') + '</div>');
    } else if (sub === 'people') {
      h += '<div class="btns" style="margin-top:0"><button class="btn" data-a="addPerson" type="button">+ Add person or pet</button><button class="btn ghost" data-a="sitter" type="button">Babysitter sheet</button></div>';
      h += d.people.length ? d.people.map(function (p) {
        var bits = [p.school && 'School: ' + p.school, p.teacher && 'Teacher: ' + p.teacher, p.doctor && (p.role === 'Pet' ? 'Vet: ' : 'Doctor: ') + p.doctor, p.allergies && 'Allergies: ' + p.allergies, p.meds && 'Medicines: ' + p.meds, p.sizes && 'Sizes: ' + p.sizes].filter(Boolean);
        return '<div class="card" data-a="editPerson" data-id="' + esc(p.id) + '" style="cursor:pointer"><div style="display:flex;gap:10px;align-items:center"><span class="av">' + esc((p.name || '?').charAt(0).toUpperCase()) + '</span><div class="m"><b>' + esc(p.name) + ' <span class="pill">' + esc(p.role) + '</span></b>' + (p.birthday ? '<span class="hint">Birthday ' + esc(VA.fmtShort(p.birthday)) + '</span>' : '') + '</div></div>' + (bits.length ? '<div class="hint" style="margin-top:8px;line-height:1.6">' + bits.map(esc).join('<br>') + '</div>' : '') + '</div>';
      }).join('') : '<div class="card empty">Add your kids, your partner and your pets. Their birthdays, doctors, allergies and sizes live here.</div>';
    } else {
      var q = (S.vaultQ || '').toLowerCase(), ns = d.notes.filter(function (n) { return !q || (n.title + ' ' + n.body + ' ' + n.category + ' ' + n.phone).toLowerCase().indexOf(q) > -1; });
      var groups = {}; ns.forEach(function (n) { (groups[n.category || 'Other'] = groups[n.category || 'Other'] || []).push(n); });
      h += '<div class="row" style="border:0;padding:0 0 6px"><input id="vq" placeholder="Search records..." value="' + esc(S.vaultQ || '') + '" style="flex:1"><button class="btn" data-a="addNote" type="button">+ Add</button></div><div class="hint" style="margin-bottom:6px">Keep doctors, insurance policies, warranties, school info and emergency contacts here. Do not store passwords, card numbers or ID numbers.</div>';
      var keys = Object.keys(groups).sort(); h += keys.length ? keys.map(function (k) { return '<h2>' + esc(k) + '</h2><div class="card">' + groups[k].map(function (n) { var e = n.expires ? VA.diff(t, n.expires) : null; return '<div class="row" data-a="editNote" data-id="' + esc(n.id) + '" style="cursor:pointer"><div class="m"><b>' + esc(n.title) + '</b><span>' + esc([n.phone, (n.body || '').slice(0, 80)].filter(Boolean).join(' \u00B7 ')) + (n.expires ? ' <span class="pill ' + (e < 0 ? 'bad' : e <= 30 ? 'warn' : '') + '">' + (e < 0 ? 'expired' : 'until ' + esc(VA.fmtShort(n.expires))) + '</span>' : '') + '</span></div></div>'; }).join('') + '</div>'; }).join('') : '<div class="card empty">Nothing saved yet.</div>';
    }
    root.innerHTML = h; wire(root);
    var vq = root.querySelector('#vq'); if (vq) vq.oninput = function () { S.vaultQ = vq.value; var pos = vq.selectionStart; VA.render(); var n = document.getElementById('vq'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } } };
    var ni = root.querySelector('#newItem'); if (ni) ni.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); VA.act.addItem(); } };
  };
  VA.act.taskWho = function (t, id) { S.taskWho = id; VA.render(); };
  VA.act.addTask = function () { VA.openForm('task', null, { who: S.taskWho && S.taskWho !== 'All' ? S.taskWho : '' }); };
  VA.act.editTask = function (t, id) { VA.openForm('task', VA.get('tasks', id)); };
  VA.act.undoTask = function (t, id) { VA.save('tasks', id, { done: false, doneAt: '' }); };
  VA.act.clearDone = function () { S.data.tasks.filter(function (x) { return x.done; }).forEach(function (x) { VA.del('tasks', x.id); }); };
  VA.act.listName = function (t, id) { S.listName = id; VA.render(); };
  VA.act.addItem = function () { var i = document.getElementById('newItem'), v = i && i.value.trim(); if (!v) return; i.value = ''; VA.save('items', null, { list: S.listName || 'Grocery', text: v, done: false }); };
  VA.act.toggleItem = function (t, id) { VA.save('items', id, { done: t.checked }); };
  VA.act.clearChecked = function () { S.data.items.filter(function (x) { return x.list === (S.listName || 'Grocery') && x.done; }).forEach(function (x) { VA.del('items', x.id); }); };
  VA.act.shareList = function () {
    var ln = S.listName || 'Grocery', txt = ln + ':\n' + S.data.items.filter(function (x) { return x.list === ln && !x.done; }).map(function (x) { return '- ' + x.text; }).join('\n');
    if (navigator.share) navigator.share({ text: txt }).catch(function () { /* cancelled */ }); else if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { VA.toast('List copied'); });
  };
  VA.act.wkPrev = function () { S.wk = VA.addDays(S.wk, -7); VA.render(); };
  VA.act.wkNext = function () { S.wk = VA.addDays(S.wk, 7); VA.render(); };
  VA.act.addMeal = function (t, id) { VA.openForm('meal', null, { date: id }); };
  VA.act.editMeal = function (t, id) { VA.openForm('meal', VA.get('meals', id)); };
  VA.act.mealsToGrocery = function () { VA.addIngredients(S.wk, VA.addDays(S.wk, 6)).then(function (n) { VA.toast(n ? n + ' item' + (n === 1 ? '' : 's') + ' added to Grocery' : 'Nothing new to add. Add ingredients to your meals first.'); }); };
  VA.act.planMeals = function () { VA.go('ask'); VA.ai.send('Suggest 5 easy family dinners for this week and a short grocery list. Keep it simple and budget friendly.'); };
  VA.act.addHome = function () { VA.openForm('home'); };
  VA.act.editHome = function (t, id) { VA.openForm('home', VA.get('home', id)); };
  VA.act.homeIdea = function (t, id) { var i = HOMEIDEAS[+id]; VA.save('home', null, { name: i[0], category: i[1], everyDays: i[2], lastDone: '' }).then(function () { VA.toast(i[0] + ' added'); }); };
  VA.act.addPerson = function () { VA.openForm('person'); };
  VA.act.editPerson = function (t, id) { VA.openForm('person', VA.get('people', id)); };
  VA.act.addNote = function () { VA.openForm('note'); };
  VA.act.editNote = function (t, id) { VA.openForm('note', VA.get('notes', id)); };
  VA.act.sitter = function () {
    var d = D(), L = ['BABYSITTER / CAREGIVER SHEET - ' + ((S.hh && S.hh.name) || 'Our home'), ''];
    var kids = d.people.filter(function (p) { return p.role === 'Child' || p.role === 'Pet'; });
    kids.forEach(function (p) { L.push(p.name.toUpperCase() + ' (' + p.role + (p.birthday ? ', born ' + p.birthday : '') + ')'); ['allergies:Allergies', 'meds:Medicines', 'doctor:Doctor/Vet', 'school:School', 'notes:Notes'].forEach(function (f) { var k = f.split(':'); if (p[k[0]]) L.push('  ' + k[1] + ': ' + p[k[0]]); }); L.push(''); });
    var em = d.notes.filter(function (n) { return n.category === 'Emergency' || n.category === 'Babysitter' || n.category === 'Medical'; });
    if (em.length) { L.push('IMPORTANT CONTACTS AND INFO'); em.forEach(function (n) { L.push('  ' + n.title + (n.phone ? ': ' + n.phone : '') + (n.body ? ' - ' + n.body : '')); }); L.push(''); }
    if (!kids.length && !em.length) L.push('Add your children or pets under People and emergency contacts under Records (kind: Emergency or Babysitter) and they appear here.');
    L.push('In an emergency call your local emergency number first.');
    var txt = L.join('\n');
    VA.modal('<h3>Babysitter sheet</h3><pre style="white-space:pre-wrap;font:14px/1.5 Arial,sans-serif;margin:0">' + esc(txt) + '</pre><div class="btns"><button class="btn" id="sC" type="button">Copy / share</button><button class="btn ghost" id="sP" type="button">Print</button><button class="btn ghost" id="sX" type="button">Close</button></div>', function (s, close) {
      s.querySelector('#sX').onclick = close; s.querySelector('#sP').onclick = function () { window.print(); };
      s.querySelector('#sC').onclick = function () { if (navigator.share) navigator.share({ text: txt }).catch(function () { /* cancelled */ }); else if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { VA.toast('Copied'); }); };
    });
  };
})();
