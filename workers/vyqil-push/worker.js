// VyqilAssistant phone alerts. Receives each person's upcoming reminders (only after they turn alerts on),
// then sends them as phone notifications at the right time. Sign-in is checked on every request.
import { makeVapid, sendPush } from './webpush.js';

const SUBJECT = 'https://vyrosolutions.dusterman225.workers.dev';
const MAX_ITEMS = 200, MAX_DEVICES = 5, HORIZON_MS = 15 * 86400000;

function origins(env) { return String(env.ALLOWED_ORIGIN || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean); }
function cors(env, origin) {
  const ok = origins(env).indexOf(origin) >= 0;
  return { 'Access-Control-Allow-Origin': ok ? origin : (origins(env)[0] || ''), 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Vary': 'Origin' };
}
function reply(env, origin, obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, cors(env, origin)) });
}

// ---- who is asking: check the Firebase sign-in token (RS256, Google's public keys) ----
let jwks = null, jwksAt = 0;
async function keys() {
  if (jwks && Date.now() - jwksAt < 3600000) return jwks;
  const r = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com', { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!r.ok) throw new Error('keys');
  jwks = (await r.json()).keys || []; jwksAt = Date.now(); return jwks;
}
function d64(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const r = atob(s), o = new Uint8Array(r.length); for (let i = 0; i < r.length; i++) o[i] = r.charCodeAt(i); return o; }
async function whoIs(req, env) {
  const t = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const id = await verify(t, env); return id;
}
async function verify(t, env) {
  const p = t.split('.'); if (p.length !== 3) return null;
  let head, claims;
  try { head = JSON.parse(new TextDecoder().decode(d64(p[0]))); claims = JSON.parse(new TextDecoder().decode(d64(p[1]))); } catch (e) { return null; }
  if (head.alg !== 'RS256' || !head.kid) return null;
  const now = Math.floor(Date.now() / 1000), pid = env.FIREBASE_PROJECT_ID;
  if (claims.aud !== pid || claims.iss !== 'https://securetoken.google.com/' + pid || !claims.sub || claims.exp < now || claims.iat > now + 300) return null;
  const jwk = (await keys()).filter(function (k) { return k.kid === head.kid; })[0]; if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, d64(p[2]), new TextEncoder().encode(p[0] + '.' + p[1]));
  return ok ? { uid: claims.sub, email: String(claims.email || '').toLowerCase(), verified: claims.email_verified === true, token: t } : null;
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    try {
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env, origin) });
      const path = new URL(req.url).pathname;
      const hub = env.HUB.get(env.HUB.idFromName('main'));
      if (req.method === 'GET') {
        if (path === '/vapid') { const r = await hub.fetch('https://hub/vapid'); return reply(env, origin, await r.json()); }
        return reply(env, origin, { ok: true, service: 'vyqil-push' });
      }
      if (req.method !== 'POST') return reply(env, origin, { error: 'POST only' }, 405);
      if (origins(env).indexOf(origin) < 0) return reply(env, origin, { error: 'origin-not-allowed', detail: 'ALLOWED_ORIGIN in wrangler.jsonc must equal your site address. This request came from ' + origin }, 403);
      const who = await whoIs(req, env);
      if (!who) return reply(env, origin, { error: 'signin', detail: 'Please sign in again.' }, 401);
      let body; try { body = await req.json(); } catch (e) { return reply(env, origin, { error: 'bad-json' }, 400); }
      if (['/sync', '/off', '/test', '/join', '/notify', '/community'].indexOf(path) < 0) return reply(env, origin, { error: 'not-found' }, 404);
      if (path === '/join') {
        if (body.as === 'team') {
          const bizId = String(body.bizId || '');
          if (!/^[A-Za-z0-9]{10,40}$/.test(bizId) || !(await fsGet(env, 'businesses/' + bizId + '/members/' + who.uid, who.token))) return reply(env, origin, { error: 'not-allowed', detail: 'You are not on this business team.' }, 403);
          body.biz = bizId;
        } else {
          if (!who.email || !who.verified) return reply(env, origin, { error: 'verify-email', detail: 'Please verify your email address first.' }, 403);
          body.as = 'customer';
        }
      }
      if (path === '/notify') {
        const out = await notify(env, who, body); return reply(env, origin, out.body, out.status);
      }
      if (path === '/community') {
        const out = await community(env, who, body, hub); return reply(env, origin, out.body, out.status);
      }
      const r = await hub.fetch('https://hub' + path, { method: 'POST', headers: { 'x-uid': who.uid, 'x-email': who.email }, body: JSON.stringify(body) });
      return reply(env, origin, await r.json(), r.status);
    } catch (e) {
      return reply(env, origin, { error: 'busy', detail: String(e && e.message || e).slice(0, 80) }, 500);
    }
  }
};


// ---- reading Firestore as the person who is asking (so the database rules decide what they may see) ----
async function fsGet(env, path, token) {
  const r = await fetch('https://firestore.googleapis.com/v1/projects/' + env.FIREBASE_PROJECT_ID + '/databases/(default)/documents/' + path, { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) return null;
  const j = await r.json(), out = {};
  for (const k in (j.fields || {})) { const f = j.fields[k]; if (f.stringValue !== undefined) out[k] = f.stringValue; }
  return out;
}

// ---- Vyqil community alerts: a new request near you, a reply to your request, you were chosen ----
// Nothing is trusted from the phone. The request, the sender's team membership and the reply are all read back from Firestore as the person asking.
function fv(v) {
  if (v.stringValue !== undefined) return v.stringValue; if (v.integerValue !== undefined) return Number(v.integerValue); if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue; if (v.timestampValue !== undefined) return v.timestampValue;
  if (v.arrayValue) return (v.arrayValue.values || []).map(fv); return null;
}
function fields(j) { const o = {}; for (const k in (j.fields || {})) o[k] = fv(j.fields[k]); return o; }
async function fsDoc(env, path, token) {
  const r = await fetch('https://firestore.googleapis.com/v1/projects/' + env.FIREBASE_PROJECT_ID + '/databases/(default)/documents/' + path, { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) return null; return fields(await r.json());
}
async function directoryNear(env, token, cells) {
  const q = { structuredQuery: { from: [{ collectionId: 'directory' }], limit: 100, where: { compositeFilter: { op: 'AND', filters: [
    { fieldFilter: { field: { fieldPath: 'cell' }, op: 'IN', value: { arrayValue: { values: cells.map(function (c) { return { stringValue: c }; }) } } } },
    { fieldFilter: { field: { fieldPath: 'listed' }, op: 'EQUAL', value: { booleanValue: true } } }] } } } };
  const r = await fetch('https://firestore.googleapis.com/v1/projects/' + env.FIREBASE_PROJECT_ID + '/databases/(default)/documents:runQuery', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(q) });
  if (!r.ok) return [];
  return (await r.json()).filter(function (x) { return x.document; }).map(function (x) { const o = fields(x.document); o.id = x.document.name.split('/').pop(); return o; });
}
function miles(a, b, c, d) { const R = 3958.8, t = Math.PI / 180, dl = (c - a) * t, dg = (d - b) * t, x = Math.sin(dl / 2) ** 2 + Math.cos(a * t) * Math.cos(c * t) * Math.sin(dg / 2) ** 2; return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)); }
function cellsAround(lat, lng, radius) {
  radius = Math.min(100, Math.max(1, radius || 100));
  const dLat = radius / 69, dLng = radius / (69 * Math.max(0.2, Math.cos(lat * Math.PI / 180))), out = [];
  for (let a = Math.floor((lat - dLat + 90) / 2); a <= Math.floor((lat + dLat + 90) / 2); a++) for (let b = Math.floor((lng - dLng + 180) / 2); b <= Math.floor((lng + dLng + 180) / 2); b++) out.push(a + '_' + b);
  return out.slice(0, 30);
}
function appUrl(product) { return product === 'contractor' ? '/contractor/community.html' : '/' + String(product || '').replace(/[^a-z]/g, '') + '/index.html'; }
const PRODUCTS = ['contractor', 'services', 'landlord', 'realtor', 'salon', 'auto', 'photo', 'lessons'];
async function ownerOf(env, biz, who) {
  if (!/^[A-Za-z0-9]{10,40}$/.test(String(biz || ''))) return false;
  const m = await fsGet(env, 'businesses/' + biz + '/members/' + who.uid, who.token); return !!m && (m.role === 'owner' || m.role === 'gm');
}
async function community(env, who, b, hub) {
  const kind = String(b.kind || ''), leadId = String(b.leadId || '');
  if (!/^[A-Za-z0-9]{10,40}$/.test(leadId) || ['lead', 'reply', 'chosen', 'msg'].indexOf(kind) < 0) return { status: 400, body: { error: 'bad-request' } };
  const lead = await fsDoc(env, 'communityLeads/' + leadId, who.token);
  if (!lead || PRODUCTS.indexOf(lead.target) < 0) return { status: 403, body: { error: 'not-allowed' } };
  const send = async function (biz, title, text, product, win) {
    const r = await hub.fetch('https://hub/biz', { method: 'POST', headers: { 'x-uid': who.uid }, body: JSON.stringify({ dup: kind + ':' + leadId + ':' + (b.bizId || '') + (kind === 'msg' ? ':' + String(biz[0]) : ''), win: win, biz: biz, title: String(title).slice(0, 70), body: String(text).slice(0, 120), url: appUrl(product) }) });
    return { status: r.status, body: await r.json() };
  };
  if (kind === 'lead') {
    const age = Date.now() - Date.parse(lead.createdAt || 0);
    if (lead.fromUid !== who.uid || lead.status !== 'open' || !(age > -60000 && age < 20 * 60000) || !(await ownerOf(env, lead.fromBiz, who))) return { status: 403, body: { error: 'not-allowed' } };
    let ids = [];
    if (lead.to) ids = [lead.to];
    else {
      const radius = [25, 50, 100].indexOf(lead.radius) >= 0 ? lead.radius : 100;
      const list = await directoryNear(env, who.token, cellsAround(lead.lat, lead.lng, radius));
      ids = list.filter(function (d) {
        if ((d.product || 'contractor') !== lead.target || d.id === lead.fromBiz) return false;
        const mi = miles(lead.lat, lead.lng, d.lat, d.lng); if (mi > radius || mi > (d.radius || 100)) return false;
        return lead.trade === 'Other' || !(d.trades || []).length || d.trades.indexOf(lead.trade) >= 0;
      }).sort(function (x, y) { return miles(lead.lat, lead.lng, x.lat, x.lng) - miles(lead.lat, lead.lng, y.lat, y.lng); }).map(function (d) { return d.id; });
    }
    ids = ids.filter(function (x) { return /^[A-Za-z0-9]{10,40}$/.test(String(x)); }).slice(0, 30);
    if (!ids.length) return { status: 200, body: { ok: true, sent: 0 } };
    return send(ids, (lead.urgent ? 'Urgent: ' : '') + lead.trade + ' request near you', (lead.city || '') + ' · from ' + (lead.fromName || 'a Vyqil business'), lead.target, 3600000);
  }
  if (kind === 'reply') {
    const bizId = String(b.bizId || ''), offer = await fsDoc(env, 'communityLeads/' + leadId + '/offers/' + bizId, who.token);
    if (!offer || offer.ownerUid !== who.uid || lead.status !== 'open' || !(await ownerOf(env, bizId, who))) return { status: 403, body: { error: 'not-allowed' } };
    return send([lead.fromBiz], 'New reply to your request', (offer.bizName || 'A business') + ' · ' + lead.trade, lead.fromProduct, 60000);
  }
  if (kind === 'msg') {
    // Alert the other side of a reply thread. Only the person who posted or the business that replied may trigger it; the wording is fixed.
    const bizId = String(b.bizId || ''); if (!/^[A-Za-z0-9]{10,40}$/.test(bizId)) return { status: 400, body: { error: 'bad-request' } };
    const offer = await fsDoc(env, 'communityLeads/' + leadId + '/offers/' + bizId, who.token); if (!offer) return { status: 403, body: { error: 'not-allowed' } };
    if (await ownerOf(env, lead.fromBiz, who)) return send([bizId], 'New message', (lead.fromName || 'A business') + ' · ' + lead.trade, lead.target, 60000);
    if (offer.ownerUid === who.uid && (await ownerOf(env, bizId, who))) return send([lead.fromBiz], 'New message', (offer.bizName || 'A business') + ' · ' + lead.trade, lead.fromProduct, 60000);
    return { status: 403, body: { error: 'not-allowed' } };
  }
  // chosen
  if (lead.status !== 'assigned' || !lead.chosen || !(await ownerOf(env, lead.fromBiz, who))) return { status: 403, body: { error: 'not-allowed' } };
  return send([lead.chosen], 'You were chosen', (lead.fromName || 'A business') + ' picked you · ' + lead.trade, lead.target, 3600000);
}
export { community };

// Alerts about a customer portal. The wording is fixed here, so nobody can send their own text through this service.
const TO_CUSTOMER = {
  estimate: 'A new estimate is ready for you to review.',
  invoice: 'A new invoice is ready in your customer portal.',
  document: 'A document is ready for you to review.',
  message: 'You have a new message.',
  update: 'There is a new update on your project.'
};
const TO_TEAM = {
  cmessage: 'sent you a message.',
  capprove: 'approved a document.',
  crevise: 'asked for changes to a document.',
  cdecline: 'declined a document.'
};
async function notify(env, who, b) {
  const portalId = String(b.portalId || ''), kind = String(b.kind || '');
  if (!/^[A-Za-z0-9_-]{6,60}$/.test(portalId) || !(kind in TO_CUSTOMER || kind in TO_TEAM)) return { status: 400, body: { error: 'bad-request' } };
  const portal = await fsGet(env, 'portals/' + portalId, who.token);
  if (!portal || !portal.bizId || !portal.customerEmail) return { status: 403, body: { error: 'not-allowed' } };
  const isCustomer = who.email && who.email === String(portal.customerEmail).toLowerCase();
  let q;
  if (isCustomer) {
    if (!(kind in TO_TEAM)) return { status: 403, body: { error: 'not-allowed' } };
    q = { to: 'team', biz: portal.bizId, title: String(portal.customerName || 'A customer').slice(0, 40), body: TO_TEAM[kind], url: kind === 'cmessage' ? '/contractor/messages.html' : '/contractor/app.html', prefix: true };
  } else {
    if (!(kind in TO_CUSTOMER)) return { status: 403, body: { error: 'not-allowed' } };
    if (!(await fsGet(env, 'businesses/' + portal.bizId, who.token))) return { status: 403, body: { error: 'not-allowed' } };
    q = { to: 'customer', email: String(portal.customerEmail).toLowerCase(), title: String(portal.businessName || 'Your contractor').slice(0, 60), body: TO_CUSTOMER[kind], url: '/contractor/portal.html' };
  }
  const hub = env.HUB.get(env.HUB.idFromName('main'));
  const r = await hub.fetch('https://hub/notify', { method: 'POST', headers: { 'x-uid': who.uid }, body: JSON.stringify({ q: q, portalId: portalId, kind: kind }) });
  return { status: r.status, body: await r.json() };
}

// ---- one small database that remembers phones and upcoming reminders, and wakes itself when one is due ----
export class Hub {
  constructor(state, env) {
    this.state = state; this.env = env; this.sql = state.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS devices (endpoint TEXT PRIMARY KEY, uid TEXT, sub TEXT, updated INTEGER, kind TEXT, email TEXT, biz TEXT)');
    for (const c of ['kind TEXT', 'email TEXT', 'biz TEXT']) { try { this.sql.exec('ALTER TABLE devices ADD COLUMN ' + c); } catch (e) { /* already there */ } }
    this.sql.exec('CREATE TABLE IF NOT EXISTS rem (endpoint TEXT, rid TEXT, at INTEGER, title TEXT, body TEXT, PRIMARY KEY (endpoint, rid))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS sent (endpoint TEXT, rid TEXT, at INTEGER, PRIMARY KEY (endpoint, rid))');
  }
  async vapid() {
    const row = this.sql.exec("SELECT v FROM kv WHERE k='vapid'").toArray()[0];
    if (row) return JSON.parse(row.v);
    const v = await makeVapid();
    this.sql.exec("INSERT OR REPLACE INTO kv VALUES ('vapid', ?)", JSON.stringify(v));
    return v;
  }
  out(obj, status) { return new Response(JSON.stringify(obj), { status: status || 200 }); }

  async fetch(req) {
    const path = new URL(req.url).pathname;
    if (path === '/vapid') return this.out({ key: (await this.vapid()).pub });
    const uid = req.headers.get('x-uid'); const b = await req.json();
    if (path === '/off') {
      const ep = String(b.endpoint || '');
      this.sql.exec('DELETE FROM rem WHERE endpoint IN (SELECT endpoint FROM devices WHERE endpoint=? AND uid=?)', ep, uid);
      this.sql.exec('DELETE FROM sent WHERE endpoint IN (SELECT endpoint FROM devices WHERE endpoint=? AND uid=?)', ep, uid);
      this.sql.exec('DELETE FROM devices WHERE endpoint=? AND uid=?', ep, uid);
      return this.out({ ok: true });
    }
    if (path === '/notify') return this.notify(uid, b);
    if (path === '/biz') return this.bizPush(uid, b);
    const sub = b.sub;
    if (!sub || typeof sub.endpoint !== 'string' || sub.endpoint.length > 700 || !/^https:\/\//.test(sub.endpoint) || !sub.keys || typeof sub.keys.p256dh !== 'string' || typeof sub.keys.auth !== 'string' || sub.keys.p256dh.length > 200 || sub.keys.auth.length > 60)
      return this.out({ error: 'bad-subscription' }, 400);

    if (path === '/join') {
      const n = this.sql.exec('SELECT COUNT(*) c FROM devices WHERE uid=? AND endpoint<>?', uid, sub.endpoint).toArray()[0].c;
      if (n >= MAX_DEVICES) return this.out({ error: 'too-many-devices', detail: 'This account already has ' + MAX_DEVICES + ' phones or browsers with alerts on. Turn alerts off on one first.' }, 400);
      this.putDevice(uid, sub, Date.now(), b.as === 'team' ? { kind: 'team', biz: String(b.biz || ''), email: '' } : { kind: 'customer', email: req.headers.get('x-email') || '', biz: '' });
      return this.out({ ok: true });
    }
    if (path === '/test') {
      const last = this.sql.exec("SELECT v FROM kv WHERE k=?", 'test:' + uid).toArray()[0];
      if (last && Date.now() - +last.v < 15000) return this.out({ error: 'wait', detail: 'Please wait a few seconds.' }, 429);
      this.sql.exec('INSERT OR REPLACE INTO kv VALUES (?, ?)', 'test:' + uid, String(Date.now()));
      const st = await sendPush({ endpoint: sub.endpoint, keys: sub.keys }, { t: 'VyqilAssistant alerts are on', b: 'You will get reminders like this, even when the app is closed.' }, await this.vapid(), SUBJECT, { ttl: 300 });
      if (st === 404 || st === 410) this.drop(sub.endpoint);
      return this.out({ status: st, ok: st >= 200 && st < 300 });
    }

    // /sync: remember this phone and replace its list of upcoming reminders
    const count = this.sql.exec('SELECT COUNT(*) c FROM devices WHERE uid=? AND endpoint<>?', uid, sub.endpoint).toArray()[0].c;
    if (count >= MAX_DEVICES) return this.out({ error: 'too-many-devices', detail: 'This account already has ' + MAX_DEVICES + ' phones or browsers with alerts on. Turn alerts off on one first.' }, 400);
    const now = Date.now(), items = Array.isArray(b.items) ? b.items.slice(0, MAX_ITEMS) : [];
    this.putDevice(uid, sub, now, null);
    this.sql.exec('DELETE FROM rem WHERE endpoint=?', sub.endpoint);
    let n = 0;
    for (const it of items) {
      if (!it || typeof it.id !== 'string' || it.id.length > 80 || typeof it.at !== 'number' || !isFinite(it.at)) continue;
      if (it.at < now - 60000 || it.at > now + HORIZON_MS) continue;
      if (this.sql.exec('SELECT 1 FROM sent WHERE endpoint=? AND rid=?', sub.endpoint, it.id).toArray().length) continue;
      this.sql.exec('INSERT OR REPLACE INTO rem VALUES (?, ?, ?, ?, ?)', sub.endpoint, it.id, Math.floor(it.at), String(it.title || '').slice(0, 80), String(it.body || '').slice(0, 160));
      n++;
    }
    this.sql.exec('DELETE FROM sent WHERE at < ?', now - 20 * 86400000);
    await this.plan();
    return this.out({ ok: true, queued: n });
  }

  // Remember a phone. A given kind/email/biz replaces the old one; null keeps what was there.
  putDevice(uid, sub, now, extra) {
    const json = JSON.stringify({ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } });
    const old = this.sql.exec('SELECT kind, email, biz FROM devices WHERE endpoint=?', sub.endpoint).toArray()[0] || {};
    const k = extra ? extra.kind : (old.kind || 'self'), e = extra ? extra.email : (old.email || ''), z = extra ? extra.biz : (old.biz || '');
    this.sql.exec('INSERT OR REPLACE INTO devices (endpoint, uid, sub, updated, kind, email, biz) VALUES (?, ?, ?, ?, ?, ?, ?)', sub.endpoint, uid, json, now, k, e, z);
  }

  // Send a fixed-wording alert about a portal to the other side's phones.
  async notify(uid, b) {
    const q = b.q || {}, now = Date.now(), hour = Math.floor(now / 3600000);
    this.sql.exec("DELETE FROM kv WHERE k LIKE 'rl:%' AND k NOT LIKE ?", 'rl:%:' + hour);
    const rk = 'rl:' + uid + ':' + hour, c = +((this.sql.exec('SELECT v FROM kv WHERE k=?', rk).toArray()[0] || {}).v || 0);
    if (c >= 60) return this.out({ error: 'slow-down', detail: 'Too many alerts this hour.' }, 429);
    const dk = 'dup:' + b.portalId + ':' + b.kind, last = +((this.sql.exec('SELECT v FROM kv WHERE k=?', dk).toArray()[0] || {}).v || 0);
    if (now - last < 20000) return this.out({ ok: true, sent: 0, skipped: 'recent' });
    this.sql.exec('INSERT OR REPLACE INTO kv VALUES (?, ?)', rk, String(c + 1));
    this.sql.exec('INSERT OR REPLACE INTO kv VALUES (?, ?)', dk, String(now));
    const rows = q.to === 'team'
      ? this.sql.exec("SELECT endpoint, sub FROM devices WHERE kind='team' AND biz=? LIMIT 12", String(q.biz || '')).toArray()
      : this.sql.exec("SELECT endpoint, sub FROM devices WHERE kind='customer' AND email=? LIMIT 8", String(q.email || '')).toArray();
    const vapid = rows.length ? await this.vapid() : null;
    const body = q.prefix ? { t: q.title + ' ' + q.body, b: 'Open VyqilContractor to see it.', u: q.url } : { t: q.title, b: q.body, u: q.url };
    let sent = 0;
    for (const r of rows) {
      let st = 0;
      try { st = await sendPush(JSON.parse(r.sub), body, vapid, SUBJECT, { ttl: 86400, urgency: 'normal' }); } catch (e) { st = 0; }
      if (st >= 200 && st < 300) sent++; else if (st === 404 || st === 410) this.drop(r.endpoint);
    }
    return this.out({ ok: true, sent: sent });
  }

  // Community alert to the team phones of one or more businesses. Fixed titles, once per request, and limited per person per hour.
  async bizPush(uid, b) {
    const now = Date.now(), hour = Math.floor(now / 3600000);
    this.sql.exec("DELETE FROM kv WHERE k LIKE 'cm:%' AND k NOT LIKE ?", 'cm:%:' + hour);
    const rk = 'cm:' + uid + ':' + hour, c = +((this.sql.exec('SELECT v FROM kv WHERE k=?', rk).toArray()[0] || {}).v || 0);
    if (c >= 30) return this.out({ error: 'slow-down', detail: 'Too many alerts this hour.' }, 429);
    const dk = 'dup:' + String(b.dup || ''), last = +((this.sql.exec('SELECT v FROM kv WHERE k=?', dk).toArray()[0] || {}).v || 0);
    if (now - last < (+b.win || 60000)) return this.out({ ok: true, sent: 0, skipped: 'recent' });
    this.sql.exec('INSERT OR REPLACE INTO kv VALUES (?, ?)', rk, String(c + 1)); this.sql.exec('INSERT OR REPLACE INTO kv VALUES (?, ?)', dk, String(now));
    const ids = (Array.isArray(b.biz) ? b.biz : []).slice(0, 30).map(String); if (!ids.length) return this.out({ ok: true, sent: 0 });
    const rows = this.sql.exec("SELECT endpoint, sub FROM devices WHERE kind='team' AND biz IN (" + ids.map(function () { return '?'; }).join(',') + ') LIMIT 40', ...ids).toArray();
    const vapid = rows.length ? await this.vapid() : null, payload = { t: String(b.title || 'Vyqil'), b: String(b.body || ''), u: String(b.url || '') };
    let sent = 0;
    for (const r of rows) {
      let st = 0;
      try { st = await sendPush(JSON.parse(r.sub), payload, vapid, SUBJECT, { ttl: 86400, urgency: 'normal' }); } catch (e) { st = 0; }
      if (st >= 200 && st < 300) sent++; else if (st === 404 || st === 410) this.drop(r.endpoint);
    }
    return this.out({ ok: true, sent: sent, devices: rows.length });
  }

  drop(endpoint) {
    this.sql.exec('DELETE FROM rem WHERE endpoint=?', endpoint); this.sql.exec('DELETE FROM sent WHERE endpoint=?', endpoint); this.sql.exec('DELETE FROM devices WHERE endpoint=?', endpoint);
  }
  // Wake up at the next reminder that is due.
  async plan(soon) {
    const next = this.sql.exec('SELECT MIN(at) a FROM rem').toArray()[0].a;
    if (next == null) return;
    const when = soon ? Date.now() + 1500 : Math.max(next, Date.now() + 1000);
    const cur = await this.state.storage.getAlarm();
    if (cur == null || when < cur || cur < Date.now()) await this.state.storage.setAlarm(when);
  }
  async alarm() {
    const now = Date.now();
    this.sql.exec('DELETE FROM rem WHERE at < ?', now - 6 * 3600000);        // too late to be useful
    const due = this.sql.exec('SELECT endpoint, rid, at, title, body FROM rem WHERE at <= ? ORDER BY at LIMIT 40', now + 5000).toArray();
    let vapid = null; if (due.length) vapid = await this.vapid();
    let retry = false;
    for (const r of due) {
      const dev = this.sql.exec('SELECT sub FROM devices WHERE endpoint=?', r.endpoint).toArray()[0];
      if (!dev) { this.sql.exec('DELETE FROM rem WHERE endpoint=?', r.endpoint); continue; }
      let st = 0;
      try { st = await sendPush(JSON.parse(dev.sub), { t: r.title, b: r.body }, vapid, SUBJECT, { ttl: 6 * 3600 }); } catch (e) { st = 0; }
      if (st >= 200 && st < 300) { this.sql.exec('INSERT OR REPLACE INTO sent VALUES (?, ?, ?)', r.endpoint, r.rid, now); this.sql.exec('DELETE FROM rem WHERE endpoint=? AND rid=?', r.endpoint, r.rid); }
      else if (st === 404 || st === 410) this.drop(r.endpoint);
      else if (st === 400 || st === 401 || st === 403 || st === 413) this.sql.exec('DELETE FROM rem WHERE endpoint=? AND rid=?', r.endpoint, r.rid);   // will never work
      else retry = true;                                                    // busy or offline: try again shortly
    }
    const left = this.sql.exec('SELECT COUNT(*) c FROM rem WHERE at <= ?', Date.now() + 5000).toArray()[0].c;
    if (left && retry) { await this.state.storage.setAlarm(Date.now() + 60000); return; }
    await this.plan(left > 0);
  }
}
