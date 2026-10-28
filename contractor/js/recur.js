// Recurring bills: when staff open the dashboard, any bill due within 14 days becomes an Unpaid expense.
// Each bill gets a fixed id (recurringId + due date), so it can never be created twice.
(function () {
  function pad(n) { return String(n).padStart(2, '0'); }
  function addPeriod(date, every, anchor) {
    var p = date.split('-'), y = +p[0], m = +p[1] - 1;
    m += every === 'year' ? 12 : every === 'quarter' ? 3 : 1;
    y += Math.floor(m / 12); m = m % 12;
    var last = new Date(y, m + 1, 0).getDate();
    return y + '-' + pad(m + 1) + '-' + pad(Math.min(anchor || +p[2], last));
  }
  function plus(days) {
    var d = new Date(); d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  async function run(ctx) {
    if (ctx.role !== 'owner' && ctx.role !== 'supervisor') return 0;
    var db = vyro.db, limit = plus(14), made = 0;
    var snap = await ctx.bizRef.collection('recurring').get();
    for (var i = 0; i < snap.docs.length; i++) {
      var rd = snap.docs[i], r = rd.data(), next = r.nextDue, guard = 0;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(next || '')) continue;
      while (next <= limit && guard++ < 24) {
        var xref = ctx.bizRef.collection('expenses').doc(rd.id + '_' + next), due = next;
        await db.runTransaction(async function (tx) {
          var ex = await tx.get(xref);
          if (ex.exists) return;
          tx.set(xref, {
            description: r.description, vendor: r.vendor || '', category: 'Other', amountCents: r.amountCents,
            date: due, reference: 'Recurring', jobId: '', jobLabel: '', status: 'Unpaid', dueDate: due,
            paidOn: '', method: '', notes: 'Created automatically from a recurring bill.', recurringId: rd.id, updatedAt: vyro.stamp()
          });
          made++;
        });
        next = addPeriod(next, r.every, r.anchorDay);
      }
      if (next !== r.nextDue) await rd.ref.update({ nextDue: next });
    }
    return made;
  }
  window.vrecur = { run: run };
})();
