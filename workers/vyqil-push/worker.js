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
  const p = t.split('.'); if (p.length !== 3) return null;
  let head, claims;
  try { head = JSON.parse(new TextDecoder().decode(d64(p[0]))); claims = JSON.parse(new TextDecoder().decode(d64(p[1]))); } catch (e) { return null; }
  if (head.alg !== 'RS256' || !head.kid) return null;
  const now = Math.floor(Date.now() / 1000), pid = env.FIREBASE_PROJECT_ID;
  if (claims.aud !== pid || claims.iss !== 'https://securetoken.google.com/' + pid || !claims.sub || claims.exp < now || claims.iat > now + 300) return null;
  const jwk = (await keys()).filter(function (k) { return k.kid === head.kid; })[0]; if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, d64(p[2]), new TextEncoder().encode(p[0] + '.' + p[1]));
  return ok ? claims.sub : null;
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
      const uid = await whoIs(req, env);
      if (!uid) return reply(env, origin, { error: 'signin', detail: 'Please sign in again.' }, 401);
      let body; try { body = await req.json(); } catch (e) { return reply(env, origin, { error: 'bad-json' }, 400); }
      if (['/sync', '/off', '/test'].indexOf(path) < 0) return reply(env, origin, { error: 'not-found' }, 404);
      const r = await hub.fetch('https://hub' + path, { method: 'POST', headers: { 'x-uid': uid }, body: JSON.stringify(body) });
      return reply(env, origin, await r.json(), r.status);
    } catch (e) {
      return reply(env, origin, { error: 'busy', detail: String(e && e.message || e).slice(0, 80) }, 500);
    }
  }
};

// ---- one small database that remembers phones and upcoming reminders, and wakes itself when one is due ----
export class Hub {
  constructor(state, env) {
    this.state = state; this.env = env; this.sql = state.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS devices (endpoint TEXT PRIMARY KEY, uid TEXT, sub TEXT, updated INTEGER)');
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
    const sub = b.sub;
    if (!sub || typeof sub.endpoint !== 'string' || sub.endpoint.length > 700 || !/^https:\/\//.test(sub.endpoint) || !sub.keys || typeof sub.keys.p256dh !== 'string' || typeof sub.keys.auth !== 'string' || sub.keys.p256dh.length > 200 || sub.keys.auth.length > 60)
      return this.out({ error: 'bad-subscription' }, 400);
    const own = this.sql.exec('SELECT uid FROM devices WHERE endpoint=?', sub.endpoint).toArray()[0];
    if (own && own.uid !== uid) return this.out({ error: 'taken' }, 403);

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
    this.sql.exec('INSERT OR REPLACE INTO devices VALUES (?, ?, ?, ?)', sub.endpoint, uid, JSON.stringify({ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }), now);
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
