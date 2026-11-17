// Time and slot helpers shared by the business apps, the customer portal and the public booking page.
(function (g) {
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], cache = {};
  function dtf(tz) { return cache[tz] || (cache[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' })); }
  function parts(tz, ms) {
    var o = {}; dtf(tz).formatToParts(new Date(ms)).forEach(function (p) { o[p.type] = p.value; });
    return { y: +o.year, m: +o.month, d: +o.day, h: (+o.hour) % 24, mi: +o.minute, dow: DOW.indexOf(o.weekday) };
  }
  function offset(tz, ms) { var p = parts(tz, ms); return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) - Math.floor(ms / 60000) * 60000; }
  // wall-clock time in a time zone (minutes after midnight) -> UTC milliseconds
  function zoned(tz, y, m, d, mins) {
    var guess = Date.UTC(y, m - 1, d, 0, 0) + mins * 60000, off = offset(tz, guess), r = guess - off, off2 = offset(tz, r);
    if (off2 !== off) r = guess - off2; return r;
  }
  function pad(n) { return ('0' + n).slice(-2); }
  function ymd(tz, ms) { var p = parts(tz, ms); return p.y + '-' + pad(p.m) + '-' + pad(p.d); }
  function hm(tz, ms) { var p = parts(tz, ms); return pad(p.h) + ':' + pad(p.mi); }
  function fmtTime(tz, ms) { var p = parts(tz, ms), h = p.h % 12 || 12; return h + (p.mi ? ':' + pad(p.mi) : ':00') + (p.h < 12 ? ' AM' : ' PM'); }
  function fmtDay(tz, ms) { var p = parts(tz, ms); return DOW[p.dow] + ', ' + MON[p.m - 1] + ' ' + p.d; }
  function fmtRange(tz, s, e) { return fmtDay(tz, s) + ' · ' + fmtTime(tz, s) + ' to ' + fmtTime(tz, e); }
  function mins(t) { var m = /^(\d{1,2}):(\d{2})/.exec(t || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; }
  function overlaps(busy, s, e) { for (var i = 0; i < (busy || []).length; i++) if (s < busy[i].e && e > busy[i].s) return true; return false; }
  // Open start times for one appointment type: inside its weekly windows, after the notice period, not on top of anything busy.
  function slots(page, type, nowMs) {
    var tz = page.tz || 'America/Los_Angeles', out = [], lead = (+page.leadHours || 0) * 3600000, horizon = Math.min(90, Math.max(1, +page.horizonDays || 30)), len = Math.max(15, +type.min || 60), step = Math.max(15, +type.step || len), p0 = parts(tz, nowMs);
    for (var i = 0; i <= horizon; i++) {
      var dt = new Date(Date.UTC(p0.y, p0.m - 1, p0.d + i)), y = dt.getUTCFullYear(), m = dt.getUTCMonth() + 1, d = dt.getUTCDate(), dow = dt.getUTCDay();
      (type.windows || []).forEach(function (w) {
        if (+w.d !== dow) return;
        for (var t = +w.s; t + len <= +w.e; t += step) { var s = zoned(tz, y, m, d, t), e = s + len * 60000; if (s < nowMs + lead) continue; if (overlaps(page.busy, s, e)) continue; out.push({ s: s, e: e }); }
      });
    }
    out.sort(function (a, b) { return a.s - b.s; }); return out;
  }
  function validSlot(page, type, s, e, nowMs) { var list = slots(page, type, nowMs); for (var i = 0; i < list.length; i++) if (list[i].s === s && list[i].e === e) return true; return false; }
  g.VQBook = { DOW: DOW, parts: parts, zoned: zoned, ymd: ymd, hm: hm, fmtTime: fmtTime, fmtDay: fmtDay, fmtRange: fmtRange, mins: mins, overlaps: overlaps, slots: slots, validSlot: validSlot,
    TZS: [['America/New_York', 'Eastern'], ['America/Chicago', 'Central'], ['America/Denver', 'Mountain'], ['America/Phoenix', 'Arizona'], ['America/Los_Angeles', 'Pacific'], ['America/Anchorage', 'Alaska'], ['Pacific/Honolulu', 'Hawaii']] };
  if (typeof module !== 'undefined') module.exports = g.VQBook;
})(typeof window !== 'undefined' ? window : globalThis);
