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
      const p0 = new URL(req.url).pathname;
      if (p0.indexOf('/pay/') === 0) return payRoute(req, env, p0);
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env, origin) });
      const path = p0;
      const hub = env.HUB.get(env.HUB.idFromName('main'));
      if (req.method === 'GET') {
        if (path === '/vapid') { const r = await hub.fetch('https://hub/vapid'); return reply(env, origin, await r.json()); }
        return reply(env, origin, { ok: true, service: 'vyqil-push' });
      }
      if (req.method !== 'POST') return reply(env, origin, { error: 'POST only' }, 405);
      if (origins(env).indexOf(origin) < 0) return reply(env, origin, { error: 'origin-not-allowed', detail: 'ALLOWED_ORIGIN in wrangler.jsonc must equal your site address. This request came from ' + origin }, 403);
      if (path === '/book') { let bb; try { bb = await req.json(); } catch (e) { return reply(env, origin, { error: 'bad-json' }, 400); } const out = await bookPublic(env, req, bb, hub); return reply(env, origin, out.body, out.status); }
      const who = await whoIs(req, env);
      if (!who) return reply(env, origin, { error: 'signin', detail: 'Please sign in again.' }, 401);
      let body; try { body = await req.json(); } catch (e) { return reply(env, origin, { error: 'bad-json' }, 400); }
      if (['/sync', '/off', '/test', '/join', '/notify', '/community'].indexOf(path) < 0) return reply(env, origin, { error: 'not-found' }, 404);
      if (path === '/join') {
        if (body.as === 'team') {
          const bizId = String(body.bizId || '');
          if (!/^[A-Za-z0-9]{8,40}$/.test(bizId) || !(await fsGet(env, 'businesses/' + bizId + '/members/' + who.uid, who.token))) return reply(env, origin, { error: 'not-allowed', detail: 'You are not on this business team.' }, 403);
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
  if (v.arrayValue) return (v.arrayValue.values || []).map(fv); if (v.mapValue) return fields(v.mapValue); return null;
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
  if (!/^[A-Za-z0-9]{8,40}$/.test(String(biz || ''))) return false;
  const m = await fsGet(env, 'businesses/' + biz + '/members/' + who.uid, who.token); return !!m && (m.role === 'owner' || m.role === 'gm');
}
async function community(env, who, b, hub) {
  const kind = String(b.kind || ''), leadId = String(b.leadId || '');
  if (kind === 'areq' || kind === 'aupd' || kind === 'aresp') return appt(env, who, b, hub, kind);
  if (kind === 'tmsg') {
    // A tenant wrote to the landlord: alert the landlord's business. Wording is fixed; the name comes from the landlord's own portal record.
    const mid = String(b.requestId || ''); if (!/^[A-Za-z0-9]{8,40}$/.test(mid)) return { status: 400, body: { error: 'bad-request' } };
    const mg = await fsDoc(env, 'tenantMsgs/' + mid, who.token); if (!mg || mg.tenantUid !== who.uid || mg.from !== 'tenant') return { status: 403, body: { error: 'not-allowed' } };
    const age = Date.now() - Date.parse(mg.createdAt || 0); if (!(age > -60000 && age < 20 * 60000)) return { status: 403, body: { error: 'not-allowed' } };
    const pt = await fsDoc(env, 'tenantPortals/' + String(mg.portalId || ''), who.token); if (!pt || pt.bizId !== mg.bizId) return { status: 403, body: { error: 'not-allowed' } };
    const r = await hub.fetch('https://hub/biz', { method: 'POST', headers: { 'x-uid': who.uid }, body: JSON.stringify({ dup: 'tmsg:' + String(mg.portalId), win: 600000, biz: [mg.bizId], title: 'Message from ' + String(pt.tenantName || 'a tenant').slice(0, 40), body: 'Open VyqilLandlord to read it', url: appUrl('landlord') }) });
    return { status: r.status, body: await r.json() };
  }
  if (kind === 'trepair') {
    // A tenant sent a repair request: alert the landlord's business. Wording is fixed and the names come from the landlord's own portal record.
    const rid = String(b.requestId || ''); if (!/^[A-Za-z0-9]{8,40}$/.test(rid)) return { status: 400, body: { error: 'bad-request' } };
    const rq = await fsDoc(env, 'tenantRequests/' + rid, who.token); if (!rq || rq.tenantUid !== who.uid) return { status: 403, body: { error: 'not-allowed' } };
    const age = Date.now() - Date.parse(rq.createdAt || 0); if (!(age > -60000 && age < 20 * 60000)) return { status: 403, body: { error: 'not-allowed' } };
    const pt = await fsDoc(env, 'tenantPortals/' + String(rq.portalId || ''), who.token); if (!pt || pt.bizId !== rq.bizId) return { status: 403, body: { error: 'not-allowed' } };
    const r = await hub.fetch('https://hub/biz', { method: 'POST', headers: { 'x-uid': who.uid }, body: JSON.stringify({ dup: 'trepair:' + rid, win: 3600000, biz: [rq.bizId], title: 'Repair request from ' + String(pt.tenantName || 'a tenant').slice(0, 40), body: String(pt.unit || 'Your property').slice(0, 80), url: appUrl('landlord') }) });
    return { status: r.status, body: await r.json() };
  }
  if (!/^[A-Za-z0-9]{8,40}$/.test(leadId) || ['lead', 'reply', 'chosen', 'msg'].indexOf(kind) < 0) return { status: 400, body: { error: 'bad-request' } };
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
    ids = ids.filter(function (x) { return /^[A-Za-z0-9]{8,40}$/.test(String(x)); }).slice(0, 30);
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
    const bizId = String(b.bizId || ''); if (!/^[A-Za-z0-9]{8,40}$/.test(bizId)) return { status: 400, body: { error: 'bad-request' } };
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
  // The gas wallet: made here, kept here. Only its public address is ever shown.
  gasKey() {
    if (this.gasP) return this.gasP;
    this.gasP = (async () => {
      const row = this.sql.exec("SELECT v FROM kv WHERE k='gas'").toArray()[0]; if (row) return JSON.parse(row.v);
      const kp = await edGenerate(), v = { pub: b58enc(new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey))), pkcs8: b64enc(new Uint8Array(await crypto.subtle.exportKey('pkcs8', kp.privateKey))) };
      this.sql.exec("INSERT OR IGNORE INTO kv VALUES ('gas', ?)", JSON.stringify(v));
      return JSON.parse(this.sql.exec("SELECT v FROM kv WHERE k='gas'").toArray()[0].v);
    })();
    return this.gasP;
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
    if (path === '/gas/pub') return this.out({ pub: (await this.gasKey()).pub });
    if (path === '/gas/sign') { const k = await this.gasKey(); return this.out({ sig: b64enc(await edSign(b64dec(k.pkcs8), b64dec(String(b.msg || '')))) }); }
    if (path === '/rate') {
      // Counts uses of a key inside a time window. Used to slow down the public booking form.
      const k = 'rt:' + String(b.k || '').slice(0, 80), now = Date.now(), row = this.sql.exec('SELECT v FROM kv WHERE k=?', k).toArray()[0];
      let st = now, n = 0; if (row) { const p = String(row.v).split('|'); if (now - +p[0] < (+b.win || 3600000)) { st = +p[0]; n = +p[1]; } }
      this.sql.exec("DELETE FROM kv WHERE k LIKE 'rt:%' AND CAST(substr(v, 1, instr(v, '|') - 1) AS INTEGER) < ?", now - 2 * 86400000);
      if (n >= (+b.max || 5)) return this.out({ ok: false });
      this.sql.exec('INSERT OR REPLACE INTO kv VALUES (?, ?)', k, st + '|' + (n + 1)); return this.out({ ok: true });
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


// ---- Appointments ----
// Alerts for appointment requests. Wording is fixed here; names come from the request itself, read back as the person asking.
async function appt(env, who, b, hub, kind) {
  const id = String(b.requestId || ''); if (!/^[A-Za-z0-9]{8,40}$/.test(id)) return { status: 400, body: { error: 'bad-request' } };
  const r = await fsDoc(env, 'apptRequests/' + id, who.token); if (!r || !r.bizId) return { status: 403, body: { error: 'not-allowed' } };
  const pg = (await fsDoc(env, 'bookingPages/' + r.bizId, who.token)) || {}, product = PRODUCTS.indexOf(pg.product) >= 0 ? pg.product : 'contractor';
  const fresh = function (t) { const a = Date.now() - Date.parse(t || 0); return a > -60000 && a < 20 * 60000; };
  const who2 = String(r.name || 'A customer').slice(0, 40) + ' · ' + String(r.typeName || 'Appointment').slice(0, 40);
  const team = async function (title, dup) {
    const x = await hub.fetch('https://hub/biz', { method: 'POST', headers: { 'x-uid': who.uid }, body: JSON.stringify({ dup: 'appt:' + id + ':' + dup, win: 30000, biz: [r.bizId], title: title, body: who2, url: appUrl(product) }) });
    return { status: x.status, body: await x.json() };
  };
  if (kind === 'areq') { if (r.uid !== who.uid || r.status !== 'pending' || !fresh(r.createdAt)) return { status: 403, body: { error: 'not-allowed' } }; return team('Appointment request', 'new'); }
  if (kind === 'aupd') {
    if (!who.email || who.email !== String(r.email || '').toLowerCase() || ['accepted', 'canceled'].indexOf(r.status) < 0 || !fresh(r.updatedAt)) return { status: 403, body: { error: 'not-allowed' } };
    return team(r.status === 'accepted' ? 'Appointment accepted' : 'Appointment canceled', r.status);
  }
  // aresp: someone on the business team answered a request from a signed-in customer
  if (!(await fsGet(env, 'businesses/' + r.bizId + '/members/' + who.uid, who.token))) return { status: 403, body: { error: 'not-allowed' } };
  const text = { accepted: 'Your appointment is confirmed.', declined: 'Your appointment request was declined.', countered: 'The business suggested a new time.', canceled: 'Your appointment was canceled.' }[r.status];
  if (!text || !fresh(r.updatedAt)) return { status: 403, body: { error: 'not-allowed' } };
  if (r.source !== 'portal' || !r.email) return { status: 200, body: { ok: true, sent: 0 } };
  const x = await hub.fetch('https://hub/notify', { method: 'POST', headers: { 'x-uid': who.uid }, body: JSON.stringify({ q: { to: 'customer', email: String(r.email).toLowerCase(), title: String(pg.bizName || 'Your business').slice(0, 60), body: text, url: '/' + product + '/portal.html' }, portalId: id, kind: 'aresp:' + r.status }) });
  return { status: x.status, body: await x.json() };
}

// Open times, the same rule the apps use (see shared/booking.js): inside the weekly hours, after the notice period, not on top of anything taken.
const _dtf = {};
function _parts(tz, ms) {
  const f = _dtf[tz] || (_dtf[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' })), o = {};
  f.formatToParts(new Date(ms)).forEach(function (p) { o[p.type] = p.value; });
  return { y: +o.year, m: +o.month, d: +o.day, h: (+o.hour) % 24, mi: +o.minute };
}
function _offset(tz, ms) { const p = _parts(tz, ms); return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) - Math.floor(ms / 60000) * 60000; }
function _zoned(tz, y, m, d, mins) { const g = Date.UTC(y, m - 1, d, 0, 0) + mins * 60000, o = _offset(tz, g); let r = g - o; const o2 = _offset(tz, r); if (o2 !== o) r = g - o2; return r; }
function slotOk(pg, type, s, e, now) {
  const tz = String(pg.tz || 'America/Los_Angeles'), lead = (+pg.leadHours || 0) * 3600000, horizon = Math.min(90, Math.max(1, +pg.horizonDays || 30)), len = Math.max(15, +type.min || 60), step = Math.max(15, +type.step || len), p0 = _parts(tz, now);
  const busy = Array.isArray(pg.busy) ? pg.busy : [];
  for (let i = 0; i <= horizon; i++) {
    const dt = new Date(Date.UTC(p0.y, p0.m - 1, p0.d + i)), y = dt.getUTCFullYear(), m = dt.getUTCMonth() + 1, d = dt.getUTCDate(), dow = dt.getUTCDay();
    for (const w of (type.windows || [])) {
      if (+w.d !== dow) continue;
      for (let t = +w.s; t + len <= +w.e; t += step) {
        const a = _zoned(tz, y, m, d, t), z = a + len * 60000; if (a !== s || z !== e) continue;
        if (a < now + lead) return false; return !busy.some(function (x) { return a < x.e && z > x.s; });
      }
    }
  }
  return false;
}
let botTok = null;
async function botLogin(env) {
  if (botTok && botTok.exp > Date.now() + 60000) return botTok;
  const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + encodeURIComponent(env.WEB_API_KEY), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: env.BOT_EMAIL, password: env.BOT_PASSWORD, returnSecureToken: true }) });
  if (!r.ok) return null; const j = await r.json(); botTok = { t: j.idToken, uid: j.localId, exp: Date.now() + (+j.expiresIn || 3600) * 1000 }; return botTok;
}
// A request from someone without an account. Checked for spam (Cloudflare Turnstile), for a real open time, and saved by a helper account.
async function bookPublic(env, req, b, hub) {
  const bad = function (code, detail, st) { return { status: st || 400, body: { error: code, detail: detail } }; };
  if (!env.BOT_EMAIL || !env.BOT_PASSWORD || !env.WEB_API_KEY) return bad('not-set-up', 'Online booking is not set up yet. Please call the business.', 503);
  const bizId = String(b.bizId || ''), typeId = String(b.typeId || ''), name = String(b.name || '').trim(), phone = String(b.phone || '').trim(), email = String(b.email || '').trim().toLowerCase(), reason = String(b.reason || '').trim(), token = String(b.token || '');
  const s = +b.start, e = +b.end;
  if (!/^[A-Za-z0-9]{8,40}$/.test(bizId) || !typeId || typeId.length > 40 || !Number.isFinite(s) || !Number.isFinite(e) || e <= s || e - s > 28800000 || !name || name.length > 80 || !phone || phone.length > 30 || email.length > 120 || !reason || reason.length > 300 || !token || token.length > 2100) return bad('bad-request', 'Please check the form and try again.');
  const ip = req.headers.get('CF-Connecting-IP') || 'x', hub0 = async function (k, max, win) { const x = await hub.fetch('https://hub/rate', { method: 'POST', headers: { 'x-uid': 'rate' }, body: JSON.stringify({ k: k, max: max, win: win }) }); return (await x.json()).ok; };
  if (!(await hub0('ip:' + ip, env.TURNSTILE_SECRET ? 6 : 3, 3600000)) || !(await hub0('biz:' + bizId, 60, 86400000))) return bad('slow-down', 'Too many requests. Please try again later.', 429);
  if (env.TURNSTILE_SECRET) {   // optional spam check; without it the stricter per-device limit above is used
    const tv = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip }) });
    if (!tv.ok || !(await tv.json()).success) return bad('spam-check', 'The spam check did not pass. Please try again.', 403);
  }
  const bot = await botLogin(env); if (!bot) return bad('busy', 'Online booking is not available right now. Please call the business.', 503);
  const pg = await fsDoc(env, 'bookingPages/' + bizId, bot.t); if (!pg || pg.enabled !== true || pg.who !== 'anyone') return bad('closed', 'This business is not taking requests here.', 403);
  const type = (Array.isArray(pg.types) ? pg.types : []).filter(function (t) { return t && t.id === typeId; })[0]; if (!type) return bad('bad-request', 'Please choose the appointment type again.');
  if (!slotOk(pg, type, s, e, Date.now())) return bad('taken', 'That time is no longer open. Please pick another.', 409);
  const f = function (v) { return { stringValue: String(v) }; };
  const appFields = {}; if (pg.product === 'landlord' && b.app && typeof b.app === 'object') ['looking', 'moveIn', 'income', 'employer', 'curAddr', 'occupants', 'pets', 'refs'].forEach(function (k) { const v = b.app[k] != null ? String(b.app[k]).trim().slice(0, k === 'refs' ? 300 : 80) : ''; if (v) appFields[k] = f(v); });
  const doc = { fields: { bizId: f(bizId), email: f(email), name: f(name), phone: f(phone), typeId: f(typeId), typeName: f(String(type.name || '').slice(0, 40)), start: { integerValue: String(s) }, end: { integerValue: String(e) }, reason: f(reason), status: f('pending'), source: f('public'), uid: f(bot.uid), createdAt: { timestampValue: new Date().toISOString() } } };
  if (Object.keys(appFields).length) doc.fields.app = { mapValue: { fields: appFields } };
  const r = await fetch('https://firestore.googleapis.com/v1/projects/' + env.FIREBASE_PROJECT_ID + '/databases/(default)/documents/apptRequests', { method: 'POST', headers: { Authorization: 'Bearer ' + bot.t, 'Content-Type': 'application/json' }, body: JSON.stringify(doc) });
  if (!r.ok) return bad('busy', 'Could not save the request. Please try again.', 502);
  const id = String((await r.json()).name || '').split('/').pop();
  try { await hub.fetch('https://hub/biz', { method: 'POST', headers: { 'x-uid': 'book:' + bizId }, body: JSON.stringify({ dup: 'appt:' + id + ':new', win: 30000, biz: [bizId], title: 'Appointment request', body: (name.slice(0, 40) + ' · ' + String(type.name || '').slice(0, 40)), url: appUrl(PRODUCTS.indexOf(pg.product) >= 0 ? pg.product : 'contractor') }) }); } catch (x) { /* the request is saved either way */ }
  return { status: 200, body: { ok: true, id: id } };
}

// =====================================================================================================
// Pay with Vyqil: Vyqil pays the Solana network fee (and opens the receiver's USDC account).
// USDC on Solana only. The customer's wallet signs; this worker checks the payment is exactly what Vyqil allows,
// adds the gas wallet's signature as fee payer, and sends it. The gas wallet's key is made inside the Durable Object
// and never leaves it (nobody, including Vyqil staff, can read it).
//   GET  /pay/info    -> gas wallet address + balance (fund this address with a little SOL)
//   POST /pay/quote   -> { to }: is there a USDC account for this wallet yet, and what the one-time startup fee is
//   POST /pay/send    -> { tx, mode }: check, co-sign and send a payment ("person" = 1% on top, "biz" = 2% from the payment)
// =====================================================================================================
const PAY = {
  FEE_WALLET: 'HeGjhmZESYB17wcErsq82GcrAhwKyzQL8SZEqd8D6uQV',
  TOKEN: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', ATA: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', SYS: '11111111111111111111111111111111',
  MINT: { mainnet: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', devnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU' },
  BPS: { person: 100, biz: 200 },
  MIN_TOTAL: 500000,      // $0.50: below this the fee would not cover the network fee
  MIN_RECEIVE: 100000,    // the receiver must be left with at least $0.10 after the startup fee
  ACCOUNT_SIZE: 165
};
const B58A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58enc(u8) {
  let n = 0n; for (let i = 0; i < u8.length; i++) n = (n << 8n) | BigInt(u8[i]);
  let s = ''; while (n > 0n) { s = B58A[Number(n % 58n)] + s; n /= 58n; }
  let z = 0; while (z < u8.length && u8[z] === 0) z++; return '1'.repeat(z) + s;
}
function b58dec(str) {
  let n = 0n; for (let i = 0; i < str.length; i++) { const v = B58A.indexOf(str[i]); if (v < 0) throw new Error('bad-base58'); n = n * 58n + BigInt(v); }
  const out = []; while (n > 0n) { out.unshift(Number(n & 255n)); n >>= 8n; }
  let z = 0; while (z < str.length && str[z] === '1') z++; return Uint8Array.from(new Array(z).fill(0).concat(out));
}
function b64dec(s) { const bin = atob(s), o = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i); return o; }
function b64enc(u8) { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); }
function catBytes(list) { let n = 0; list.forEach(function (a) { n += a.length; }); const o = new Uint8Array(n); let p = 0; list.forEach(function (a) { o.set(a, p); p += a.length; }); return o; }

// ---- is this 32-byte value a point on the ed25519 curve? (A program address must NOT be.) ----
const P25519 = (1n << 255n) - 19n;
function fmod(a) { const r = a % P25519; return r >= 0n ? r : r + P25519; }
function fpow(b, e) { let r = 1n; b = fmod(b); while (e > 0n) { if (e & 1n) r = fmod(r * b); b = fmod(b * b); e >>= 1n; } return r; }
function finv(a) { return fpow(a, P25519 - 2n); }
const D25519 = fmod(-121665n * finv(121666n));
function onCurve(bytes) {
  let y = 0n; for (let i = 31; i >= 0; i--) y = (y << 8n) | BigInt(i === 31 ? bytes[i] & 127 : bytes[i]);
  if (y >= P25519) return false;
  const y2 = fmod(y * y), u = fmod(y2 - 1n), v = fmod(D25519 * y2 + 1n), x2 = fmod(u * finv(v));
  if (x2 === 0n) return true; return fpow(x2, (P25519 - 1n) / 2n) === 1n;
}
async function sha256(u8) { return new Uint8Array(await crypto.subtle.digest('SHA-256', u8)); }
async function findPda(seeds, programB58) {
  const prog = b58dec(programB58), tag = new TextEncoder().encode('ProgramDerivedAddress');
  for (let bump = 255; bump >= 0; bump--) { const h = await sha256(catBytes(seeds.concat([Uint8Array.of(bump), prog, tag]))); if (!onCurve(h)) return h; }
  throw new Error('no-pda');
}
async function ataOf(ownerB58, mintB58) { return b58enc(await findPda([b58dec(ownerB58), b58dec(PAY.TOKEN), b58dec(mintB58)], PAY.ATA)); }

// ---- read a normal ("legacy") Solana transaction ----
function readCompact(buf, o) { let v = 0, s = 0; for (;;) { if (o >= buf.length) throw new Error('short'); const b = buf[o++]; v |= (b & 127) << s; if (!(b & 128)) break; s += 7; if (s > 14) throw new Error('bad-length'); } return [v, o]; }
function parseTx(raw) {
  let o = 0, n; [n, o] = readCompact(raw, o); if (n < 1 || n > 4) throw new Error('bad-signatures');
  const sigs = []; for (let i = 0; i < n; i++) { sigs.push(raw.slice(o, o + 64)); o += 64; }
  const start = o; if (raw[o] & 128) throw new Error('versioned');
  const nReq = raw[o], nRoSigned = raw[o + 1], nRoUnsigned = raw[o + 2]; o += 3;
  let nk; [nk, o] = readCompact(raw, o); if (nk < 2 || nk > 40) throw new Error('bad-keys');
  const keys = []; for (let i = 0; i < nk; i++) { keys.push(b58enc(raw.slice(o, o + 32))); o += 32; }
  o += 32; // recent blockhash
  let ni; [ni, o] = readCompact(raw, o); if (ni < 1 || ni > 8) throw new Error('bad-instructions');
  const ixs = []; for (let i = 0; i < ni; i++) {
    const pid = raw[o++]; let na; [na, o] = readCompact(raw, o); const accts = []; for (let j = 0; j < na; j++) accts.push(raw[o++]);
    let dl; [dl, o] = readCompact(raw, o); const data = raw.slice(o, o + dl); o += dl; ixs.push({ pid: pid, accts: accts, data: data });
  }
  if (o !== raw.length) throw new Error('trailing-bytes');
  return { sigs: sigs, msg: raw.slice(start), nReq: nReq, nRoSigned: nRoSigned, nRoUnsigned: nRoUnsigned, keys: keys, ixs: ixs };
}
function isSigner(t, i) { return i < t.nReq; }
function isWritable(t, i) { return i < t.nReq - t.nRoSigned || (i >= t.nReq && i < t.keys.length - t.nRoUnsigned); }
function u64le(d, o) { let v = 0n; for (let i = 7; i >= 0; i--) v = (v << 8n) | BigInt(d[o + i]); return v; }
function ceilDiv(a, b) { return (a + b - 1n) / b; }

// ---- the rules. Returns { ok, error, ... } ----
// `startup` is the one-time fee (USDC base units) for opening a receiver's USDC account, worked out fresh from the current rent and SOL price.
async function checkPayment(t, ctx) {
  const bad = function (m) { return { ok: false, error: m }; };
  if (t.nReq !== 2 || t.sigs.length !== 2) return bad('This payment is not shaped the way Vyqil sends payments.');
  if (t.keys[0] !== ctx.gas) return bad('The network fee payer is not Vyqil.');
  const sender = t.keys[1], mint = ctx.mint;
  if (sender === ctx.gas || sender === PAY.FEE_WALLET) return bad('That wallet cannot send this payment.');
  const feeAta = await ataOf(PAY.FEE_WALLET, mint), senderAta = await ataOf(sender, mint);
  const creates = [], moves = [];
  for (const ix of t.ixs) {
    const prog = t.keys[ix.pid], a = ix.accts.map(function (i) { return t.keys[i]; });
    if (prog === PAY.ATA) {
      if (a.length !== 6 || ix.data.length !== 1 || ix.data[0] !== 1) return bad('Unexpected account step.');
      if (a[0] !== ctx.gas || a[3] !== mint || a[4] !== PAY.SYS || a[5] !== PAY.TOKEN) return bad('Unexpected account step.');
      if (a[1] !== await ataOf(a[2], mint)) return bad('Unexpected account step.');
      creates.push({ ata: a[1], owner: a[2] });
    } else if (prog === PAY.TOKEN) {
      if (ix.data.length !== 10 || ix.data[0] !== 12 || ix.data[9] !== 6 || a.length < 4 || a.length > 6) return bad('Unexpected transfer step.');
      if (a[1] !== mint || a[3] !== sender || ix.accts[3] !== 1 || a[0] !== senderAta) return bad('Unexpected transfer step.');
      for (let j = 4; j < ix.accts.length; j++) if (isSigner(t, ix.accts[j]) || isWritable(t, ix.accts[j])) return bad('Unexpected transfer step.');
      moves.push({ dest: a[2], amt: u64le(ix.data, 1) });
    } else return bad('This payment contains a step Vyqil does not allow.');
  }
  let F = 0n, R = 0n, recipientAta = '';
  for (const m of moves) {
    if (m.amt <= 0n) return bad('Zero-amount step.');
    if (m.dest === feeAta) F += m.amt;
    else { if (recipientAta && recipientAta !== m.dest) return bad('A payment can only go to one receiver.'); recipientAta = m.dest; R += m.amt; }
  }
  if (!recipientAta || R <= 0n) return bad('No receiver in this payment.');
  if (recipientAta === senderAta || recipientAta === feeAta) return bad('That receiver is not allowed.');
  let startupApplies = false;
  for (const c of creates) {
    if (c.ata === recipientAta) { if (startupApplies) return bad('Unexpected account step.'); startupApplies = true; }
    else if (c.ata === feeAta && c.owner === PAY.FEE_WALLET) { /* Vyqil opening its own USDC account, once */ }
    else return bad('Vyqil will only open the receiver\'s USDC account.');
  }
  const S = startupApplies ? ctx.startup : 0n, bps = BigInt(PAY.BPS[ctx.mode] || 0);
  if (!bps) return bad('Unknown payment type.');
  // gross: what the receiver is meant to get before any startup fee (person) or what the payer pays in total (business)
  const gross = ctx.mode === 'person' ? R + S : R + F;
  if (gross < BigInt(PAY.MIN_TOTAL)) return bad('The smallest payment is $0.50.');
  if (R < BigInt(PAY.MIN_RECEIVE)) return bad('This payment is too small to cover the one-time account startup fee. Send a little more.');
  const need = ceilDiv(gross * bps, 10000n), slack = S / 4n;
  const got = F - S;
  if (got < need - slack || got > need + slack + 2n) return bad('The Vyqil service fee in this payment is not correct. Please start the payment again.');
  return { ok: true, sender: sender, recipientAta: recipientAta, recipientNew: startupApplies, R: R, F: F, startup: S, gross: gross };
}

// ---- one-time startup fee: the rent for a new USDC account, in USDC ----
let rentCache = null, priceCache = null;
async function rpcCall(env, method, params) {
  const r = await fetch(env.SOLANA_RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: method, params: params }) });
  const j = await r.json(); if (j.error) throw new Error(j.error.message || 'rpc'); return j.result;
}
// Opening a receiver's USDC account is paid by Vyqil's payment wallet (sponsored), so the receiver gets the full amount.
async function startupUnits(env) { return 0n; }
async function accountExists(env, addr) { const r = await rpcCall(env, 'getAccountInfo', [addr, { encoding: 'base64', commitment: 'confirmed' }]); return !!(r && r.value); }
async function edImport(kind, fmt, bytes, usage) {
  try { return await crypto.subtle.importKey(fmt, bytes, { name: 'Ed25519' }, true, [usage]); }
  catch (e) { return await crypto.subtle.importKey(fmt, bytes, { name: 'NODE-ED25519', namedCurve: 'NODE-ED25519' }, true, [usage]); }
}
async function verifySig(pubB58, msg, sig) {
  try { const k = await edImport('pub', 'raw', b58dec(pubB58), 'verify'); let ok; try { ok = await crypto.subtle.verify({ name: 'Ed25519' }, k, sig, msg); } catch (e) { ok = await crypto.subtle.verify('NODE-ED25519', k, sig, msg); } return ok; } catch (e) { return false; }
}
async function edGenerate() {
  try { return await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']); }
  catch (e) { return await crypto.subtle.generateKey({ name: 'NODE-ED25519', namedCurve: 'NODE-ED25519' }, true, ['sign', 'verify']); }
}
async function edSign(pkcs8, msg) {
  const k = await edImport('priv', 'pkcs8', pkcs8, 'sign'); try { return new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, k, msg)); } catch (e) { return new Uint8Array(await crypto.subtle.sign('NODE-ED25519', k, msg)); }
}

async function payRoute(req, env, path) {
  const H = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };
  const out = function (o, s) { return new Response(JSON.stringify(o), { status: s || 200, headers: H }); };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: H });
  const net = env.SOLANA_NET === 'mainnet' ? 'mainnet' : 'devnet', mint = PAY.MINT[net];
  const hub = env.HUB.get(env.HUB.idFromName('main'));
  const hcall = async function (p, b, uid) { const r = await hub.fetch('https://hub' + p, { method: 'POST', headers: { 'x-uid': uid || 'pay' }, body: JSON.stringify(b || {}) }); return r.json(); };
  try {
    const gas = (await hcall('/gas/pub')).pub;
    if (path === '/pay/info') {
      let lamports = null; if (env.SOLANA_RPC) { try { lamports = await rpcCall(env, 'getBalance', [gas, { commitment: 'confirmed' }]).then(function (r) { return r.value; }); } catch (e) { /* shown as unknown */ } }
      return out({ ok: true, network: net, gasWallet: gas, gasLamports: lamports, feeWallet: PAY.FEE_WALLET, mint: mint, ready: !!env.SOLANA_RPC && lamports != null && lamports >= 10000000 });
    }
    if (req.method !== 'POST') return out({ error: 'POST only' }, 405);
    if (!env.SOLANA_RPC) return out({ error: 'not-set-up', detail: 'Payments are not set up yet.' }, 503);
    let b; try { b = await req.json(); } catch (e) { return out({ error: 'bad-json' }, 400); }
    const ip = req.headers.get('CF-Connecting-IP') || 'x';
    if (path === '/pay/quote') {
      const to = String(b.to || ''); let ownerOk = false; try { ownerOk = b58dec(to).length === 32; } catch (e) { /* invalid */ }
      if (!ownerOk) return out({ error: 'bad-address', detail: 'That is not a Solana wallet address.' }, 400);
      if (!(await hcall('/rate', { k: 'q:' + ip, max: 120, win: 3600000 })).ok) return out({ error: 'slow-down' }, 429);
      const ata = await ataOf(to, mint), exists = await accountExists(env, ata);
      let su = 0n; if (!exists) su = await startupUnits(env);
      return out({ ok: true, network: net, gasWallet: gas, feeWallet: PAY.FEE_WALLET, recipientAta: ata, newAccount: !exists, startupUnits: su.toString() });
    }
    if (path === '/pay/send') {
      const mode = b.mode === 'biz' ? 'biz' : 'person';
      let raw; try { raw = b64dec(String(b.tx || '')); } catch (e) { return out({ error: 'bad-tx' }, 400); }
      if (raw.length > 1232) return out({ error: 'bad-tx' }, 400);
      let t; try { t = parseTx(raw); } catch (e) { return out({ error: 'bad-tx', detail: 'This payment could not be read. Please start again.' }, 400); }
      const sender = t.keys[1];
      if (!(await hcall('/rate', { k: 'si:' + ip, max: 40, win: 3600000 })).ok || !(await hcall('/rate', { k: 'ss:' + sender, max: 30, win: 3600000 })).ok) return out({ error: 'slow-down', detail: 'Too many payments from this device. Try again later.' }, 429);
      let startup = 0n; try { startup = await startupUnits(env); } catch (e) { return out({ error: 'busy', detail: 'Could not work out the one-time startup fee. Please try again.' }, 503); }
      const chk = await checkPayment(t, { gas: gas, mint: mint, mode: mode, startup: startup });
      if (!chk.ok) return out({ error: 'rejected', detail: chk.error }, 400);
      if (!(await verifySig(sender, t.msg, t.sigs[1]))) return out({ error: 'unsigned', detail: 'Your wallet\'s approval is missing or not valid. Please try again.' }, 400);
      // Make sure it would succeed before Vyqil puts its name on it.
      const sim = await rpcCall(env, 'simulateTransaction', [b64enc(raw), { encoding: 'base64', sigVerify: false, replaceRecentBlockhash: false, commitment: 'confirmed' }]);
      if (sim && sim.value && sim.value.err) {
        const logs = (sim.value.logs || []).join(' '), low = /insufficient funds|custom program error: 0x1\b/i.test(logs); const errTxt = JSON.stringify(sim.value.err).slice(0, 120), gasMissing = /AccountNotFound/i.test(errTxt) || /Attempt to debit an account but found no record/i.test(logs), stale = /BlockhashNotFound/i.test(errTxt);
        return out({ error: 'would-fail', detail: gasMissing ? 'Vyqil\'s payment wallet has no SOL yet, so it cannot cover the network fee. Nothing was sent.' : stale ? 'This payment took too long to approve. Please start it again. Nothing was sent.' : low ? 'Not enough USDC in this wallet for the payment and the Vyqil fee.' : 'The network says this payment would not go through (' + errTxt + '). Nothing was sent.' }, 400);
      }
      const bal = await rpcCall(env, 'getBalance', [gas, { commitment: 'confirmed' }]);
      if (!bal || bal.value < 5000000) return out({ error: 'busy', detail: 'Payments are paused for a moment. Please try again later.' }, 503);
      const g = await hcall('/gas/sign', { msg: b64enc(t.msg) }); if (!g.sig) return out({ error: 'busy' }, 503);
      const full = raw.slice(); full.set(b64dec(g.sig), 1);   // signature slot 0 (after the 1-byte count)
      const sig = await rpcCall(env, 'sendTransaction', [b64enc(full), { encoding: 'base64', skipPreflight: true, maxRetries: 5 }]);
      return out({ ok: true, signature: sig, recipientNew: chk.recipientNew, startupUnits: chk.startup.toString() });
    }
    return out({ error: 'not-found' }, 404);
  } catch (e) {
    return out({ error: 'busy', detail: 'Could not reach the Solana network. Please try again.' }, 502);
  }
}
