// Web Push for Cloudflare Workers: VAPID (RFC 8292) signing and aes128gcm message encryption (RFC 8291).
const enc = new TextEncoder();

export function b64u(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unb64u(s) {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  const r = atob(s), o = new Uint8Array(r.length); for (let i = 0; i < r.length; i++) o[i] = r.charCodeAt(i); return o;
}
function cat() {
  let n = 0; for (const a of arguments) n += a.length;
  const o = new Uint8Array(n); let p = 0; for (const a of arguments) { o.set(a, p); p += a.length; } return o;
}
async function hkdf(salt, ikm, info, len) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt, info: info }, k, len * 8));
}

// A new VAPID key pair: { pub: base64url of the 65-byte public point, jwk: private key }.
export async function makeVapid() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
  return { pub: b64u(await crypto.subtle.exportKey('raw', kp.publicKey)), jwk: await crypto.subtle.exportKey('jwk', kp.privateKey) };
}

async function vapidHeader(vapid, endpoint, subject) {
  const aud = new URL(endpoint).origin;
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(enc.encode(JSON.stringify({ aud: aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const key = await crypto.subtle.importKey('jwk', vapid.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(head + '.' + body)));
  return 'vapid t=' + head + '.' + body + '.' + b64u(sig) + ', k=' + vapid.pub;
}

// Encrypts `text` for one browser subscription (p256dh = its public key, auth = its secret).
export async function encryptPayload(text, p256dh, auth, fixed) {
  const ua = unb64u(p256dh), authSecret = unb64u(auth);
  const asKeys = fixed ? fixed.keys : await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', ua, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256));
  const salt = fixed ? fixed.salt : crypto.getRandomValues(new Uint8Array(16));
  const prk = await hkdf(authSecret, shared, cat(enc.encode('WebPush: info\0'), ua, asPub), 32);
  const cek = await hkdf(salt, prk, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, prk, enc.encode('Content-Encoding: nonce\0'), 12);
  const plain = cat(enc.encode(text), new Uint8Array([2]));      // 0x02 marks the last (only) record
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, plain));
  const rs = new Uint8Array([0, 0, 0x10, 0]);                    // record size 4096
  return cat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}

// Sends one push. Returns the HTTP status (201 = accepted; 404/410 = the browser unsubscribed).
export async function sendPush(sub, payload, vapid, subject, opts) {
  const body = await encryptPayload(JSON.stringify(payload), sub.keys.p256dh, sub.keys.auth);
  const r = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': await vapidHeader(vapid, sub.endpoint, subject),
      'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream',
      'TTL': String((opts && opts.ttl) || 3600), 'Urgency': (opts && opts.urgency) || 'high'
    },
    body: body
  });
  return r.status;
}
