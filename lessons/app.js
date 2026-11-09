window.VQ_APP = {
  id: 'lessons', name: 'VyqilLessons', who: 'For tutors, music teachers and small daycares', tag: 'Students, schedule, attendance and billing.', alertText: 'lessons and unpaid balances',
  tabKinds: ['lesson', 'student', 'bill'],
  kinds: {
    student: { label: 'Student', plural: 'Students', icon: '🎓', stage: 'status', closed: function (r) { return r.status === 'Former'; },
      fields: [{ k: 'name', l: 'Student name', t: 'text', req: 1 }, { k: 'status', l: 'Status', t: 'select', o: ['Active', 'Waitlist', 'Former'], req: 1 }, { k: 'guardian', l: 'Parent / guardian', t: 'text' }, { k: 'phone', l: 'Phone', t: 'tel' }, { k: 'email', l: 'Email', t: 'email' }, { k: 'subject', l: 'Subject or instrument', t: 'text' }, { k: 'rate', l: 'Rate per lesson', t: 'money' }, { k: 'birthday', l: 'Birthday', t: 'date', cal: 1, yearly: 1, alert: { hour: 9 }, lbl: 'Birthday' }, { k: 'notes', l: 'Notes (allergies, pickup, goals)', t: 'area' }],
      sub: function (r, rs) { var owed = 0; rs.forEach(function (b) { if (b.kind === 'bill' && b.student === r.id && b.status === 'Unpaid') owed += b.amount || 0; }); return [r.subject, owed ? 'Owes ' + Q.u.money(owed) : ''].filter(Boolean).join(' · '); } },
    lesson: { label: 'Lesson', plural: 'Lessons', icon: '📚', stage: 'status', closed: function (r) { return r.status !== 'Scheduled'; }, sort: function (a, b) { return ((a.date || '') + (a.time || '')) < ((b.date || '') + (b.time || '')) ? 1 : -1; },
      title: function (r) { return (r.student ? Q.title(Q.get(r.student)) : 'Lesson') + (r.topic ? ' · ' + r.topic : ''); },
      fields: [{ k: 'student', l: 'Student', t: 'link', to: 'student', req: 1 }, { k: 'date', l: 'Date', t: 'date', req: 1, cal: 1, alert: { before: 60 }, timeField: 'time', lbl: 'Lesson' }, { k: 'time', l: 'Time', t: 'time', req: 1 }, { k: 'status', l: 'Status', t: 'select', o: ['Scheduled', 'Attended', 'Missed', 'Cancelled'], req: 1 }, { k: 'topic', l: 'Topic', t: 'text' }, { k: 'price', l: 'Price', t: 'money' }, { k: 'notes', l: 'Notes / homework', t: 'area' }],
      sub: function (r) { return Q.u.fmtDate(r.date) + ' ' + Q.u.fmtTime(r.time); }, amount: function (r) { return r.price || ''; } },
    bill: { label: 'Bill', plural: 'Billing', icon: '💵', stage: 'status', closed: function (r) { return r.status === 'Paid' || r.status === 'Void'; }, sort: function (a, b) { return (a.date || '') < (b.date || '') ? 1 : -1; },
      title: function (r) { return (r.student ? Q.title(Q.get(r.student)) : 'Bill') + (r.period ? ' · ' + r.period : ''); },
      fields: [{ k: 'student', l: 'Student', t: 'link', to: 'student', req: 1 }, { k: 'period', l: 'For', t: 'text', h: 'November' }, { k: 'date', l: 'Date', t: 'date', req: 1 }, { k: 'amount', l: 'Amount', t: 'money', req: 1 }, { k: 'due', l: 'Due', t: 'date', cal: 1, alert: { hour: 9 }, lbl: 'Bill due' }, { k: 'status', l: 'Status', t: 'select', o: ['Unpaid', 'Paid', 'Void'], req: 1 }],
      amount: function (r) { return r.amount || 0; }, sub: function (r) { return r.due ? 'Due ' + Q.u.fmtDate(r.due) : ''; } }
  },
  stats: [{ l: 'Lessons today', fn: function (rs, t) { return rs.filter(function (r) { return r.kind === 'lesson' && r.date === t && r.status === 'Scheduled'; }).length; } },
    { l: 'Active students', fn: function (rs) { return rs.filter(function (r) { return r.kind === 'student' && r.status === 'Active'; }).length; } },
    { l: 'Unpaid', fn: function (rs) { var s = 0; rs.forEach(function (r) { if (r.kind === 'bill' && r.status === 'Unpaid') s += r.amount || 0; }); return Q.u.money(s); } }],
  watch: [{ l: 'Lessons to mark attended or missed', fn: function (rs, t) { return rs.filter(function (r) { return r.kind === 'lesson' && r.status === 'Scheduled' && r.date < t; }); }, sub: function (r) { return Q.u.fmtDate(r.date); } }]
};
