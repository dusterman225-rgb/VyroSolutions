// AI notices, consent records and the privacy filter. Used by the help bubble and the assistants.
//
// Accepting a notice is saved two ways:
//  1. on this phone (so the notice is not shown again), and
//  2. if the person is signed in, as a permanent record in your database that cannot be edited or deleted:
//       users/{uid}/consents/{kind}_{version}              (the person's own copy)
//       businesses/{bizId}/consents/{uid}_{kind}_{version} (the owner can see who accepted, for assistants)
//     The record holds the date and a fingerprint (SHA-256) of the exact words shown, so you can prove
//     what the person agreed to. Visitors who are not signed in only get the phone copy.
// To change the wording later: edit the text AND raise the version number, so everyone is asked again.
(function () {
  if (window.VyroConsent) return;
  var NOTICES = {
    help: { version: 1, title: 'Before you chat',
      text: 'Be mindful that this bot is hosted by a third-party vendor and Vyqil is not responsible for any information you put into this bot. Please do not type your name, phone number, email, address, passwords, card numbers or any other personal details. This helper cannot see your account or your business records. Answers can be wrong.',
      button: 'I understand, accept' },
    assistant: { version: 1, title: 'Before you use the assistant',
      text: 'Be mindful that this assistant is run by a third-party AI vendor and Vyqil is not responsible for any information that is processed by it. To answer, it is sent a summary of your business records (such as invoices, orders, stock and customer names). Vyqil does not control what the vendor does with it after that. Do not use it if you are not comfortable sharing that information. It is read-only, it cannot change anything, and answers can be wrong, so check amounts before you rely on them.',
      button: 'I understand, accept' },
    byo: { version: 1, title: 'Using your own AI service',
      text: 'You are choosing to send your business summary to an AI service that you picked and pay for yourself. Your key is kept only on this phone. When you ask a question, it passes through Vyqil\'s server for a moment so it can reach your provider; Vyqil does not save it. That provider\'s own terms and privacy rules apply, and Vyqil is not responsible for what it does with your information.',
      button: 'I understand, accept' }
  };

  function key(kind) { return kind + '_v' + NOTICES[kind].version; }
  function lsGet(k) { try { return localStorage.getItem('vyroConsent_' + k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem('vyroConsent_' + k, v); } catch (e) { /* storage blocked */ } }
  function fb() { try { return window.firebase && firebase.apps && firebase.apps.length ? firebase : null; } catch (e) { return null; } }
  function me() { var f = fb(); try { var u = f && f.auth().currentUser; return u && !u.isAnonymous ? u : null; } catch (e) { return null; } }

  async function sha256(s) {
    try {
      var b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
      return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    } catch (e) { return ''; }
  }

  // The notice is shown again at every new login (and every new visit): the "accepted" mark lives in this tab's
  // session memory and is wiped on sign-out. Every acceptance is also written to the database as its own permanent record.
  function sessKey(kind) { var u = me(); return 'vyroConsentS_' + key(kind) + '_' + (u ? u.uid : 'visitor'); }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* storage blocked: the notice just shows again */ } }
  function clearSession() { try { Object.keys(sessionStorage).forEach(function (k) { if (k.indexOf('vyroConsentS_') === 0) sessionStorage.removeItem(k); }); } catch (e) { /* ignore */ } }

  async function has(kind) { return ssGet(sessKey(kind)) === '1'; }

  // Saves the acceptance. opts.bizId (assistants) also writes the business copy. Never throws.
  // Returns { saved: 'account' } when the permanent records were written, or { saved: 'phone', error } when they were not.
  async function accept(kind, opts) {
    opts = opts || {};
    var k = key(kind), n = NOTICES[kind];
    var u = me();
    if (!u) { ssSet(sessKey(kind), '1'); return { saved: 'phone' }; }
    try {
      var fs = fb().firestore(), ts = fb().firestore.FieldValue.serverTimestamp();
      var hash = await sha256(n.text), stamp = Date.now() + '_' + Math.floor(Math.random() * 1000);
      var base = { kind: kind, version: n.version, textHash: hash, acceptedAt: ts, page: String(location.pathname).slice(0, 80), bizId: opts.bizId || '' };
      var col = fs.collection('users').doc(u.uid).collection('consents');
      // The first-ever acceptance of this wording (the server looks for this one) ...
      var first = col.doc(k), ex = await first.get();
      if (!ex.exists) await first.set(base);
      // ... plus one record for THIS login, kept forever.
      await col.doc(k + '_' + stamp).set(base);
      if (opts.bizId) {
        await fs.collection('businesses').doc(opts.bizId).collection('consents').doc(u.uid + '_' + k + '_' + stamp).set({ uid: u.uid, name: String(opts.name || u.email || '').slice(0, 80), kind: kind, version: n.version, textHash: hash, acceptedAt: ts });
      }
      ssSet(sessKey(kind), '1');
      return { saved: 'account' };
    } catch (e) { return { saved: 'phone', error: String(e && (e.code || e.message) || e).slice(0, 80) }; }
  }

  // Privacy filter: removes things that look like personal or secret details BEFORE text leaves the phone.
  // It cannot recognise names, so the notice still tells people not to type them. Keep in step with
  // workers/vyro-help/redact.js (the server runs the same filter again).
  var RULES = [
    [/\b(password|passcode|passphrase|pin|secret|api[ -]?key|seed phrase|recovery phrase|security code|cvv|cvc)\b\s*(?:is|are|=|:)?\s*\S+/gi, '$1 [removed]'],
    [/\b(?:sk|pk|rk|ghp|xox[a-z]|AIza)[-_A-Za-z0-9]{16,}\b/g, '[key removed]'],
    [/\b0x[a-fA-F0-9]{40}\b/g, '[wallet removed]'],
    [/\b[a-fA-F0-9]{32,}\b/g, '[code removed]'],
    [/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g, '[wallet removed]'],
    [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email removed]'],
    [/\b\d{3}-\d{2}-\d{4}\b/g, '[id number removed]'],
    [/\b(?:\d[ -]?){13,19}\b/g, '[number removed]'],
    [/(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/g, '[phone removed]'],
    [/\b\d{1,6}\s+(?:[A-Za-z0-9.]+\s+){1,4}(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|way|place|pl|circle|cir|highway|hwy)\b\.?/gi, '[address removed]']
  ];
  function redact(text) {
    var out = String(text == null ? '' : text), changed = false;
    RULES.forEach(function (r) { var next = out.replace(r[0], r[1]); if (next !== out) changed = true; out = next; });
    return { text: out, changed: changed };
  }

  // Draws the notice into `host` and calls onAccept() when the button is tapped.
  function show(kind, host, onAccept) {
    var n = NOTICES[kind];
    var box = document.createElement('div');
    box.className = 'vyroConsent';
    box.setAttribute('role', 'region'); box.setAttribute('aria-label', n.title);
    box.style.cssText = 'background:#101a26;border:1px solid #2f4a68;border-radius:14px;padding:14px;margin:10px;color:#e8eef6;font-size:.88rem;line-height:1.45';
    var h = document.createElement('b'); h.textContent = n.title; h.style.cssText = 'display:block;margin-bottom:6px;font-size:.95rem';
    var p = document.createElement('div'); p.textContent = n.text;
    var b = document.createElement('button'); b.type = 'button'; b.textContent = n.button;
    b.style.cssText = 'margin-top:12px;width:100%;border:0;border-radius:999px;padding:11px 14px;background:#2b7bd8;color:#fff;font-weight:700;font-size:.92rem';
    b.addEventListener('click', async function () {
      b.disabled = true; b.textContent = 'Saving...';
      var res = await accept(kind, show.opts);
      box.remove(); onAccept(res);
    });
    box.appendChild(h); box.appendChild(p); box.appendChild(b); host.appendChild(box);
    return box;
  }
  show.opts = {};

  window.VyroConsent = { NOTICES: NOTICES, has: has, accept: accept, clearSession: clearSession, show: function (kind, host, opts, cb) { show.opts = opts || {}; return show(kind, host, cb); }, redact: redact, sha256: sha256, key: key };
})();
