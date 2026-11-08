// VyqilAssistant forms: one small engine builds every "add / edit" screen from a field list.
(function () {
  var VA = window.VA, esc = VA.esc;
  var CATS_BILL = ['Housing', 'Utilities', 'Insurance', 'Subscriptions', 'Debt', 'Kids', 'Medical', 'Transport', 'Other'];
  var CATS_TXN = ['Groceries', 'Dining', 'Gas', 'Kids', 'Health', 'Home', 'Fun', 'Bills', 'Shopping', 'Pay', 'Other'];
  var LISTS = ['Grocery', 'Shopping', 'To-do', 'Packing', 'Gift ideas', 'Wishlist'];
  VA.CATS_BILL = CATS_BILL; VA.CATS_TXN = CATS_TXN; VA.LISTS = LISTS;
  var SCHEMA = VA.SCHEMA = {
    event: { col: 'events', name: 'Appointment or event', fields: [
      { k: 'title', l: 'What is it?', t: 'text', req: 1, ph: 'Dentist, soccer practice, school play...' },
      { k: 'date', l: 'Date', t: 'date', req: 1 }, { k: 'time', l: 'Starts', t: 'time' }, { k: 'endTime', l: 'Ends (optional)', t: 'time' },
      { k: 'who', l: 'Who is it for?', t: 'who' },
      { k: 'type', l: 'Kind', t: 'select', o: ['Medical', 'School', 'Activity', 'Birthday', 'Social', 'Work', 'Other'], d: 'Other' },
      { k: 'place', l: 'Where', t: 'text' },
      { k: 'repeat', l: 'Repeats', t: 'select', o: [['none', 'Does not repeat'], ['weekly', 'Every week'], ['monthly', 'Every month'], ['yearly', 'Every year']], d: 'none' },
      { k: 'remind', l: 'Reminder', t: 'select', o: [['0', 'No reminder'], ['60', '1 hour before'], ['1440', '1 day before']], d: '0' },
      { k: 'notes', l: 'Notes', t: 'area' }] },
    bill: { col: 'bills', name: 'Bill or subscription', fields: [
      { k: 'name', l: 'Name', t: 'text', req: 1, ph: 'Electric, rent, Netflix, car insurance...' },
      { k: 'amount', l: 'Amount ($)', t: 'money', req: 1 }, { k: 'dueDate', l: 'Next due date', t: 'date', req: 1 },
      { k: 'repeat', l: 'How often', t: 'select', o: [['monthly', 'Every month'], ['weekly', 'Every week'], ['yearly', 'Every year'], ['once', 'One time']], d: 'monthly' },
      { k: 'category', l: 'Category', t: 'select', o: CATS_BILL, d: 'Other' },
      { k: 'autopay', l: 'It pays automatically', t: 'check' },
      { k: 'trialEnds', l: 'Free trial ends (optional)', t: 'date' },
      { k: 'notes', l: 'Account, website or notes (no passwords)', t: 'area' }] },
    txn: { col: 'txns', name: 'Money in or out', fields: [
      { k: 'type', l: 'Type', t: 'select', o: [['expense', 'Money spent'], ['income', 'Money received']], d: 'expense' },
      { k: 'amount', l: 'Amount ($)', t: 'money', req: 1 }, { k: 'date', l: 'Date', t: 'date', req: 1 },
      { k: 'category', l: 'Category', t: 'select', o: CATS_TXN, d: 'Other' }, { k: 'note', l: 'What for', t: 'text' }] },
    goal: { col: 'goals', name: 'Savings goal', fields: [
      { k: 'name', l: 'Goal', t: 'text', req: 1, ph: 'Vacation, emergency fund, new car...' },
      { k: 'target', l: 'Target ($)', t: 'money', req: 1 }, { k: 'saved', l: 'Saved so far ($)', t: 'money' }, { k: 'by', l: 'Want it by (optional)', t: 'date' }] },
    task: { col: 'tasks', name: 'Task or chore', fields: [
      { k: 'title', l: 'What needs doing?', t: 'text', req: 1 }, { k: 'who', l: 'Who does it?', t: 'who' }, { k: 'due', l: 'Due (optional)', t: 'date' },
      { k: 'repeat', l: 'Repeats', t: 'select', o: [['none', 'Does not repeat'], ['daily', 'Every day'], ['weekly', 'Every week'], ['monthly', 'Every month']], d: 'none' },
      { k: 'rotate', l: 'Take turns (passes to the next person each time)', t: 'check' }, { k: 'notes', l: 'Notes', t: 'area' }] },
    item: { col: 'items', name: 'List item', fields: [
      { k: 'list', l: 'List', t: 'select', o: LISTS, d: 'Grocery' }, { k: 'text', l: 'Item', t: 'text', req: 1 }] },
    meal: { col: 'meals', name: 'Meal', fields: [
      { k: 'date', l: 'Day', t: 'date', req: 1 }, { k: 'slot', l: 'Meal', t: 'select', o: ['Dinner', 'Lunch', 'Breakfast'], d: 'Dinner' },
      { k: 'text', l: 'What are we eating?', t: 'text', req: 1 }, { k: 'ingredients', l: 'Ingredients to buy (one per line)', t: 'area' }] },
    person: { col: 'people', name: 'Family member or pet', fields: [
      { k: 'name', l: 'Name', t: 'text', req: 1 }, { k: 'role', l: 'Who are they?', t: 'select', o: ['Adult', 'Child', 'Pet', 'Other'], d: 'Child' },
      { k: 'birthday', l: 'Birthday', t: 'date' }, { k: 'school', l: 'School or daycare', t: 'text' }, { k: 'teacher', l: 'Teacher or caregiver', t: 'text' },
      { k: 'doctor', l: 'Doctor or vet (name, phone)', t: 'text' }, { k: 'allergies', l: 'Allergies', t: 'text' }, { k: 'meds', l: 'Medicines', t: 'text' },
      { k: 'sizes', l: 'Sizes (clothes, shoes)', t: 'text' }, { k: 'notes', l: 'Other notes (likes, gift ideas...)', t: 'area' }] },
    home: { col: 'home', name: 'Home or car care', fields: [
      { k: 'name', l: 'What', t: 'text', req: 1, ph: 'Change air filter, oil change, flea treatment...' },
      { k: 'category', l: 'Area', t: 'select', o: ['Home', 'Auto', 'Pet', 'Health', 'Appliance', 'Garden'], d: 'Home' },
      { k: 'everyDays', l: 'Repeat every (days)', t: 'num', req: 1 }, { k: 'lastDone', l: 'Last done', t: 'date' }, { k: 'notes', l: 'Notes', t: 'area' }] },
    note: { col: 'notes', name: 'Record', fields: [
      { k: 'title', l: 'Title', t: 'text', req: 1, ph: 'Pediatrician, car insurance policy, dishwasher warranty...' },
      { k: 'category', l: 'Kind', t: 'select', o: ['Contact', 'Medical', 'School', 'Insurance', 'Warranty', 'Account', 'Babysitter', 'Emergency', 'Other'], d: 'Other' },
      { k: 'phone', l: 'Phone', t: 'text' }, { k: 'expires', l: 'Expires or renews (optional)', t: 'date' },
      { k: 'body', l: 'Details (never passwords, card or ID numbers)', t: 'area' }] }
  };
  var MONEY = { amount: 1, target: 1, saved: 1 };

  function field(f, v) {
    var id = 'f_' + f.k, val = v == null ? '' : v, h = '';
    if (f.t === 'check') return '<div class="chk"><input type="checkbox" id="' + id + '"' + (val ? ' checked' : '') + '><label for="' + id + '">' + esc(f.l) + '</label></div>';
    h += '<label class="f" for="' + id + '">' + esc(f.l) + (f.req ? ' *' : '') + '</label>';
    if (f.t === 'area') h += '<textarea id="' + id + '">' + esc(val) + '</textarea>';
    else if (f.t === 'select' || f.t === 'who') {
      var opts = f.t === 'who' ? [['', 'Everyone / not set']].concat(VA.who().map(function (n) { return [n, n]; })) : f.o.map(function (o) { return Array.isArray(o) ? o : [o, o]; });
      if (f.t === 'who' && val && VA.who().indexOf(val) < 0) opts.push([val, val]);
      h += '<select id="' + id + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(val) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
    } else {
      var type = f.t === 'date' ? 'date' : f.t === 'time' ? 'time' : (f.t === 'money' || f.t === 'num') ? 'number' : 'text';
      h += '<input id="' + id + '" type="' + type + '"' + (f.t === 'money' ? ' step="0.01" min="0" inputmode="decimal"' : f.t === 'num' ? ' min="0" inputmode="numeric"' : '') + (f.ph ? ' placeholder="' + esc(f.ph) + '"' : '') + ' value="' + esc(val) + '">';
    }
    return h;
  }

  // openForm('bill', existingItemOrNull, presetValues) -> resolves with the saved id (or null if closed)
  VA.openForm = function (kind, item, preset) {
    var sc = SCHEMA[kind]; if (!sc) return Promise.resolve(null);
    return new Promise(function (resolve) {
      var base = {}; sc.fields.forEach(function (f) { if (f.d != null) base[f.k] = f.d; });
      var v = Object.assign({}, base, preset || {}, item || {});
      if (kind === 'event' && !v.date) v.date = VA.S.sel || VA.today();
      if (kind === 'txn' && !v.date) v.date = VA.today();
      if (kind === 'meal' && !v.date) v.date = VA.S.sel || VA.today();
      var html = '<h3>' + (item ? 'Edit' : 'Add') + ' ' + esc(sc.name.toLowerCase()) + '</h3>' + sc.fields.map(function (f) { return field(f, MONEY[f.k] ? VA.dollars(v[f.k]) : v[f.k]); }).join('') +
        '<p class="hint" id="fErr" style="color:#ff8a8a;margin:10px 0 0"></p><div class="btns"><button class="btn" id="fSave" type="button">Save</button><button class="btn ghost" id="fCancel" type="button">Cancel</button>' +
        (item && item.id ? '<button class="btn danger" id="fDel" type="button">Delete</button>' : '') + '</div>';
      var done = false;
      var close = VA.modal(html, function (s, close) {
        s.querySelector('#fCancel').onclick = function () { close(); finish(null); };
        s.querySelector('#fSave').onclick = function () {
          var out = {}, err = '';
          sc.fields.forEach(function (f) {
            var e = s.querySelector('#f_' + f.k); if (!e) return;
            var x = f.t === 'check' ? e.checked : e.value.trim();
            if (f.req && (x === '' || x === false || (f.t === 'money' && !(VA.cents(x) > 0)) && f.k === 'amount')) { if (!err) err = 'Please fill in: ' + f.l.replace(/ \(.*/, ''); }
            out[f.k] = f.t === 'money' ? VA.cents(x) : f.t === 'num' ? (parseInt(x, 10) || 0) : x;
          });
          if (!err && kind === 'home' && !(out.everyDays > 0)) err = 'Please say how many days between each time.';
          if (err) { s.querySelector('#fErr').textContent = err; return; }
          if (kind === 'person' && out.birthday === '') out.birthday = '';
          if (kind === 'bill') { if (!item) out.paid = false; }
          if (kind === 'task' && !item) { out.done = false; }
          if (kind === 'item' && !item) { out.done = false; }
          s.querySelector('#fSave').disabled = true;
          VA.save(sc.col, item && item.id, out).then(function (id) { close(); VA.toast('Saved'); finish(id); }).catch(function (e) { s.querySelector('#fSave').disabled = false; s.querySelector('#fErr').textContent = 'Could not save (' + (e && e.code || e.message) + ').'; });
        };
        var d = s.querySelector('#fDel');
        if (d) d.onclick = function () { VA.confirm('Delete this?', 'Delete', function () { VA.del(sc.col, item.id).then(function () { close(); VA.toast('Deleted'); finish(null); }); }); };
      });
      function finish(id) { if (!done) { done = true; resolve(id); } }
    });
  };

  // AI "capture" items -> the shapes the forms above use
  VA.fromCapture = function (it) {
    var o = Object.assign({}, it); var kind = o.kind; delete o.kind;
    if (kind === 'bill') { o.amount = VA.cents(o.amountDollars); delete o.amountDollars; o.trialEnds = ''; }
    if (kind === 'txn') { o.amount = VA.cents(o.amountDollars); delete o.amountDollars; if (!o.date) o.date = VA.today(); }
    if (kind === 'task') o.rotate = false;
    return { kind: kind, data: o };
  };

  // ---- actions that change several things at once ----
  function nextDue(d, rep) { return rep === 'weekly' ? VA.addDays(d, 7) : rep === 'yearly' ? VA.addMonths(d, 12) : VA.addMonths(d, 1); }
  VA.nextDue = nextDue;
  VA.payBill = function (b) {
    var prev = { dueDate: b.dueDate, paid: !!b.paid, lastPaid: b.lastPaid || '' };
    VA.save('txns', null, { type: 'expense', amount: b.amount || 0, date: VA.today(), category: 'Bills', note: b.name, billId: b.id }).then(function (tid) {
      var patch = b.repeat === 'once' ? { paid: true, lastPaid: VA.today() } : { dueDate: nextDue(b.dueDate, b.repeat), lastPaid: VA.today() };
      return VA.save('bills', b.id, patch).then(function () {
        VA.toast(b.name + ' marked paid', 'Undo', function () { VA.del('txns', tid); VA.save('bills', b.id, prev); });
      });
    });
  };
  VA.completeTask = function (t) {
    if (!t.repeat || t.repeat === 'none') { VA.save('tasks', t.id, { done: true, doneAt: VA.today() }); VA.toast('Done', 'Undo', function () { VA.save('tasks', t.id, { done: false, doneAt: '' }); }); return; }
    var today = VA.today(), base = t.due && t.due >= today ? t.due : today;
    var next = t.repeat === 'daily' ? VA.addDays(base, 1) : t.repeat === 'weekly' ? VA.addDays(base, 7) : VA.addMonths(base, 1);
    var patch = { due: next, lastDone: today }, prev = { due: t.due || '', who: t.who || '', lastDone: t.lastDone || '' };
    if (t.rotate) { var w = VA.who(), i = w.indexOf(t.who); if (w.length > 1) patch.who = w[(i + 1) % w.length]; }
    VA.save('tasks', t.id, patch); VA.toast('Done. Next: ' + VA.fmtShort(next) + (patch.who ? ' (' + patch.who + ')' : ''), 'Undo', function () { VA.save('tasks', t.id, prev); });
  };
  VA.homeNext = function (h) { return h.lastDone && h.everyDays ? VA.addDays(h.lastDone, h.everyDays) : (h.everyDays ? VA.today() : ''); };
  VA.homeDone = function (h) { var prev = h.lastDone || ''; VA.save('home', h.id, { lastDone: VA.today() }); VA.toast(h.name + ' done', 'Undo', function () { VA.save('home', h.id, { lastDone: prev }); }); };
  VA.addIngredients = function (from, to) {
    var have = {}; VA.S.data.items.forEach(function (i) { if (i.list === 'Grocery' && !i.done) have[String(i.text).toLowerCase()] = 1; });
    var add = [];
    VA.S.data.meals.forEach(function (m) { if (m.date >= from && m.date <= to) String(m.ingredients || '').split('\n').forEach(function (l) { l = l.trim(); if (l && !have[l.toLowerCase()]) { have[l.toLowerCase()] = 1; add.push(l); } }); });
    return Promise.all(add.map(function (t) { return VA.save('items', null, { list: 'Grocery', text: t, done: false, from: 'meal' }); })).then(function () { return add.length; });
  };
})();
