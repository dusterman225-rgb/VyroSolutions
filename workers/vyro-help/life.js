// VyqilAssistant (personal life manager) AI route. Two jobs:
//   chat    - answer questions about the person's OWN household summary that their phone sends along (it cannot change anything)
//   capture - turn a sentence like "dentist for Mia next Tuesday 3pm" into items the person confirms before anything is saved
// Only paid models are used (no free models), because this is private family information. Nothing is stored by this worker.
import { runChain, checkByo, callByo } from './ai.js';
import { LIMITS } from './ai-config.js';

function fsBase(env) { return 'https://firestore.googleapis.com/v1/projects/' + env.FIREBASE_PROJECT + '/databases/(default)/documents'; }
function uidFromToken(token) {
  try { const p = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'); const j = JSON.parse(atob(p + '='.repeat((4 - p.length % 4) % 4))); return j.user_id || j.sub || null; } catch (e) { return null; }
}
async function getDoc(env, token, path) {
  const r = await fetch(fsBase(env) + '/' + path, { headers: { Authorization: 'Bearer ' + token } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('fs ' + r.status);
  const d = await r.json(); return d.fields || {};
}
async function countUse(env, token, uid, id, limit) {
  const path = 'users/' + uid + '/lifeUse/' + id;
  const cur = await getDoc(env, token, path);
  const n = cur && cur.n && cur.n.integerValue ? Number(cur.n.integerValue) : 0;
  if (n >= limit) return { ok: false, limit: limit };
  const body = JSON.stringify({ fields: { n: { integerValue: String(n + 1) } } });
  const h = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  const r = cur ? await fetch(fsBase(env) + '/' + path + '?updateMask.fieldPaths=n', { method: 'PATCH', headers: h, body: body })
                : await fetch(fsBase(env) + '/users/' + uid + '/lifeUse?documentId=' + id, { method: 'POST', headers: h, body: body });
  if (!r.ok) throw new Error('usage ' + r.status);
  return { ok: true };
}

const RULES = [
  'You are VyqilAssistant, a warm, practical life manager for a busy household (a parent, a family, or one person).',
  'You are given a SUMMARY of the household: appointments, bills, tasks, lists, meals, money and home-care. Use ONLY that summary for facts about their life. If something is not in it, say you do not see it.',
  'Totals and dates in the summary are already worked out. Copy them; do not do your own arithmetic or guess dates.',
  'You cannot change, add, pay or send anything. When they want to add something, tell them to use the + Quick add button (they can type or speak it).',
  'Be brief and kind: short sentences, simple words, a short list when it helps. Lead with the answer. Offer one next step.',
  'Money tips: you cannot see live prices or other companies\' offers. Suggest concrete things to check (shop insurance yearly, ask for a lower rate, cancel unused subscriptions, use cheaper plans, compare store brands) and name which of THEIR bills to look at first. Never promise a saving amount.',
  'You are not a doctor, lawyer, tax professional or financial advisor. For medical, legal, tax or investment questions give general information and suggest a professional. For anything urgent or dangerous, tell them to call their local emergency number.',
  'Never ask for or repeat passwords, card numbers, bank account numbers or ID numbers.'
].join('\n');

const CAPTURE_SCHEMAS = [
  'event {"kind":"event","title":"","date":"YYYY-MM-DD","time":"HH:MM or empty","endTime":"HH:MM or empty","who":"a person from PEOPLE or empty","type":"Medical|School|Activity|Birthday|Social|Work|Other","place":"","repeat":"none|weekly|monthly|yearly","remind":"0|60|1440","notes":""}',
  'bill {"kind":"bill","name":"","amountDollars":0,"dueDate":"YYYY-MM-DD next due date","repeat":"once|weekly|monthly|yearly","autopay":false,"category":"Housing|Utilities|Insurance|Subscriptions|Debt|Kids|Medical|Transport|Other","notes":""}',
  'task {"kind":"task","title":"","who":"a person from PEOPLE or empty","due":"YYYY-MM-DD or empty","repeat":"none|daily|weekly|monthly","notes":""}',
  'item {"kind":"item","list":"Grocery|Shopping|To-do|Packing|Gift ideas|Wishlist","text":""}',
  'txn {"kind":"txn","type":"expense|income","amountDollars":0,"date":"YYYY-MM-DD","category":"Groceries|Dining|Gas|Kids|Health|Home|Fun|Bills|Shopping|Pay|Other","note":""}',
  'meal {"kind":"meal","date":"YYYY-MM-DD","slot":"Breakfast|Lunch|Dinner","text":"","ingredients":"one per line"}',
  'home {"kind":"home","name":"","category":"Home|Auto|Pet|Health|Appliance|Garden","everyDays":0,"lastDone":"YYYY-MM-DD or empty"}',
  'note {"kind":"note","title":"","category":"Contact|Medical|School|Insurance|Warranty|Account|Babysitter|Emergency|Other","body":"","phone":"","expires":"YYYY-MM-DD or empty"}'
];
const CAPTURE_RULES = [
  'You turn what the person said into items for their household organizer.',
  'Reply with ONLY a JSON array (no words, no code fences) of 1 to 5 objects using these shapes:',
  CAPTURE_SCHEMAS.join('\n'),
  'Use TODAY to turn words like tomorrow, next Tuesday or the 5th into real YYYY-MM-DD dates (a weekday name means the NEXT one after today). If no year is given use the next such date.',
  'Use the closest category. Put anything unclear in notes or leave it empty; never invent phone numbers, amounts or dates the person did not say.',
  'Groceries or things to buy go in item with list Grocery or Shopping. Money paid goes in txn; things that come due go in bill.',
  'If the text is not something to save, reply with [].'
].join('\n');

const str = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
const dateOk = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '';
const timeOk = v => /^\d{2}:\d{2}$/.test(String(v || '')) ? String(v) : '';
const num = v => { const n = Number(String(v == null ? '' : v).replace(/[$,]/g, '')); return isFinite(n) && n >= 0 && n <= 1e7 ? Math.round(n * 100) / 100 : 0; };
const pick = (v, list, d) => list.indexOf(v) > -1 ? v : d;
export function normalize(o) {
  if (!o || typeof o !== 'object') return null;
  switch (o.kind) {
    case 'event': return { kind: 'event', title: str(o.title, 120), date: dateOk(o.date), time: timeOk(o.time), endTime: timeOk(o.endTime), who: str(o.who, 40), type: pick(o.type, ['Medical', 'School', 'Activity', 'Birthday', 'Social', 'Work', 'Other'], 'Other'), place: str(o.place, 160), repeat: pick(o.repeat, ['none', 'weekly', 'monthly', 'yearly'], 'none'), remind: pick(String(o.remind), ['0', '60', '1440'], '0'), notes: str(o.notes, 400) };
    case 'bill': return { kind: 'bill', name: str(o.name, 100), amountDollars: num(o.amountDollars), dueDate: dateOk(o.dueDate), repeat: pick(o.repeat, ['once', 'weekly', 'monthly', 'yearly'], 'monthly'), autopay: o.autopay === true, category: pick(o.category, ['Housing', 'Utilities', 'Insurance', 'Subscriptions', 'Debt', 'Kids', 'Medical', 'Transport', 'Other'], 'Other'), notes: str(o.notes, 300) };
    case 'task': return { kind: 'task', title: str(o.title, 140), who: str(o.who, 40), due: dateOk(o.due), repeat: pick(o.repeat, ['none', 'daily', 'weekly', 'monthly'], 'none'), notes: str(o.notes, 300) };
    case 'item': return { kind: 'item', list: pick(o.list, ['Grocery', 'Shopping', 'To-do', 'Packing', 'Gift ideas', 'Wishlist'], 'To-do'), text: str(o.text, 140) };
    case 'txn': return { kind: 'txn', type: o.type === 'income' ? 'income' : 'expense', amountDollars: num(o.amountDollars), date: dateOk(o.date), category: pick(o.category, ['Groceries', 'Dining', 'Gas', 'Kids', 'Health', 'Home', 'Fun', 'Bills', 'Shopping', 'Pay', 'Other'], 'Other'), note: str(o.note, 160) };
    case 'meal': return { kind: 'meal', date: dateOk(o.date), slot: pick(o.slot, ['Breakfast', 'Lunch', 'Dinner'], 'Dinner'), text: str(o.text, 140), ingredients: String(o.ingredients || '').split('\n').map(x => str(x, 80)).filter(Boolean).slice(0, 30).join('\n') };
    case 'home': return { kind: 'home', name: str(o.name, 120), category: pick(o.category, ['Home', 'Auto', 'Pet', 'Health', 'Appliance', 'Garden'], 'Home'), everyDays: Math.max(0, Math.min(3650, parseInt(o.everyDays, 10) || 0)), lastDone: dateOk(o.lastDone) };
    case 'note': return { kind: 'note', title: str(o.title, 120), category: pick(o.category, ['Contact', 'Medical', 'School', 'Insurance', 'Warranty', 'Account', 'Babysitter', 'Emergency', 'Other'], 'Other'), body: str(o.body, 1200), phone: str(o.phone, 40), expires: dateOk(o.expires) };
    default: return null;
  }
}
export function parseItems(text) {
  let t = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const a = t.indexOf('['), b = t.lastIndexOf(']');
  if (a < 0 || b < a) return null;
  let arr; try { arr = JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; }
  if (!Array.isArray(arr)) return null;
  return arr.slice(0, 5).map(normalize).filter(Boolean);
}
function tidyCut(t, finish) {
  if (finish !== 'length') return t;
  const cut = Math.max(t.lastIndexOf('\n'), t.lastIndexOf('. '), t.lastIndexOf('! '), t.lastIndexOf('? '));
  return (cut > 40 ? t.slice(0, cut + 1) : t).trim() + '\n\n(Ask me to continue if you want more.)';
}

export async function handleLife(req, env, body) {
  try { return await inner(req, env, body); }
  catch (e) { return { status: 500, data: { error: 'busy', detail: 'the assistant had an unexpected problem (' + String(e && e.message || e).slice(0, 80) + ')' } }; }
}
async function inner(req, env, body) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const uid = token ? uidFromToken(token) : null;
  if (!uid) return { status: 401, data: { error: 'signin' } };
  let consent = null;
  try { consent = await getDoc(env, token, 'users/' + uid + '/consents/life_v1'); }
  catch (e) { return { status: 403, data: { error: 'access', detail: 'could not check the accepted notice (' + String(e && e.message || e).slice(0, 60) + '). Publish the latest firestore.rules.' } }; }
  if (body.status === true) return { status: 200, data: { consent: !!consent } };
  if (!consent) return { status: 403, data: { error: 'consent', detail: 'The assistant notice has not been accepted yet.' } };

  const today = /^\d{4}-\d{2}-\d{2}$/.test(String(body.today || '')) ? body.today : new Date().toISOString().slice(0, 10);
  const weekday = String(body.weekday || '').slice(0, 12);
  const context = String(body.context || '').slice(0, 9000);
  const mode = body.mode === 'capture' ? 'capture' : 'chat';
  let msgs = Array.isArray(body.messages) ? body.messages.slice(-8) : [];
  msgs = msgs.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').map(m => ({ role: m.role, content: m.content.slice(0, 1500) }));
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return { status: 400, data: { error: 'bad' } };

  const day = today.replace(/-/g, '');
  const deep = mode === 'chat' && body.deep === true;
  try {
    const u = await countUse(env, token, uid, deep ? 'd' + day : day, deep ? LIMITS.deep : LIMITS.chat);
    if (!u.ok) return { status: 429, data: { error: 'limit', limit: u.limit } };
  } catch (e) { return { status: 502, data: { error: 'busy', detail: 'could not update the daily counter (' + String(e && e.message || e).slice(0, 60) + '). Publish the latest firestore.rules.' } }; }

  const head = 'TODAY: ' + today + (weekday ? ' (' + weekday + ')' : '') + '\n';
  const system = mode === 'capture'
    ? CAPTURE_RULES + '\n\n' + head + 'PEOPLE: ' + str(body.people, 400)
    : RULES + (deep ? '\nTHINK HARDER MODE: work through the summary step by step and double-check every date and total before answering.' : '') + '\n\n' + head + 'HOUSEHOLD SUMMARY:\n' + context;
  const messages = [{ role: 'system', content: system }].concat(msgs);

  const byoIn = body.byo && typeof body.byo === 'object' ? body.byo : null;
  if (byoIn) {
    const byo = checkByo(byoIn);
    if (!byo) return { status: 400, data: { error: 'byo', detail: 'The AI service details look wrong.' } };
    const o = await callByo(byo, messages);
    if (!o.ok) return { status: 502, data: { error: 'busy', detail: o.why } };
    if (mode === 'capture') { const it = parseItems(o.res.text); return it ? { status: 200, data: { items: it } } : { status: 502, data: { error: 'busy', detail: 'The AI did not return something I could read. Try saying it again.' } }; }
    return { status: 200, data: { reply: tidyCut(o.res.text, o.res.finish) } };
  }
  if (mode === 'capture') {
    const out = await runChain(env, 'assistant', messages, res => !!parseItems(res.text));
    if (!out.ok) return { status: 502, data: { error: 'busy', detail: out.why } };
    return { status: 200, data: { items: parseItems(out.res.text) } };
  }
  const out = await runChain(env, deep ? 'deep' : 'assistant', messages, null);
  if (!out.ok) return { status: 502, data: { error: 'busy', detail: out.why } };
  return { status: 200, data: { reply: tidyCut(out.res.text, out.res.finish) } };
}
