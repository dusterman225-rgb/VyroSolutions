// Runs a chain of models in order through OpenRouter. Returns the first answer that passes `accept`.
import { chainFor, PRICES } from './ai-config.js';

async function callOne(env, step, messages, note) {
  if (!env.OPENROUTER_KEY) { note.why = 'key-not-set (add the OPENROUTER_KEY secret in Cloudflare)'; return null; }
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), step.timeoutMs || 45000);
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', signal: ctl.signal,
      headers: { 'Authorization': 'Bearer ' + env.OPENROUTER_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: step.model, max_tokens: step.maxTokens || 800, temperature: step.temperature == null ? 0.2 : step.temperature, messages: messages })
    });
    if (!r.ok) {
      let m = ''; try { const e = await r.json(); m = (e && e.error && e.error.message) || ''; } catch (x) { /* ignore */ }
      note.why = step.model + ' ' + r.status + (m ? ': ' + String(m).slice(0, 120) : ''); return null;
    }
    const d = await r.json();
    const c = d && d.choices && d.choices[0];
    const text = c && c.message && c.message.content;
    if (!text) { note.why = step.model + ' gave an empty answer'; return null; }
    const u = d.usage || {}, p = PRICES[step.model];
    const cost = p ? ((u.prompt_tokens || 0) * p[0] + (u.completion_tokens || 0) * p[1]) / 1e6 : 0;
    return { text: String(text).trim(), finish: c.finish_reason, model: step.model, usage: u, cost: cost };
  } catch (e) {
    note.why = step.model + (e && e.name === 'AbortError' ? ' took too long' : ' could not be reached'); return null;
  } finally { clearTimeout(timer); }
}

// accept(result) -> true/false. A false answer sends the question to the next model in the chain.
export async function runChain(env, name, messages, accept) {
  const steps = chainFor(env, name), note = { why: '' }, tried = [];
  for (const step of steps) {
    if (!step || !step.model || /PUT-THE/.test(step.model)) continue;
    const res = await callOne(env, step, messages, note);
    tried.push(step.model);
    if (res && (!accept || accept(res))) { res.tried = tried; return { ok: true, res: res, why: '' }; }
    if (res && accept) note.why = step.model + ' answer failed the checks';
  }
  return { ok: false, why: note.why || 'no models are set for ' + name, tried: tried };
}

// ---- Bring your own AI ----
// Only these addresses can ever be called, so nobody can use the helper to reach other servers.
// All speak the common "OpenAI style" chat format. Anything else (Claude, Llama, etc.) works through OpenRouter.
export const BYO_PROVIDERS = {
  openai: 'https://api.openai.com/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  mistral: 'https://api.mistral.ai/v1/chat/completions',
  together: 'https://api.together.xyz/v1/chat/completions'
};
export function checkByo(b) {
  if (!b || typeof b !== 'object') return null;
  const url = Object.prototype.hasOwnProperty.call(BYO_PROVIDERS, b.provider) ? BYO_PROVIDERS[b.provider] : null;
  const model = String(b.model || ''), key = String(b.key || '');
  if (!url || !/^[\w.:\/-]{1,100}$/.test(model) || !/^[\w.\-]{10,300}$/.test(key)) return null;
  return { url, model, key };
}
// The key is used for this one request and then forgotten. It is never saved or written to any log.
export async function callByo(byo, messages) {
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 60000);
  try {
    const r = await fetch(byo.url, { method: 'POST', signal: ctl.signal, redirect: 'error',
      headers: { 'Authorization': 'Bearer ' + byo.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: byo.model, max_tokens: 1200, temperature: 0.2, messages: messages }) });
    if (r.status === 401 || r.status === 403) return { ok: false, why: 'Your AI service did not accept the key (status ' + r.status + '). Check the key and that it has credit.' };
    if (r.status === 404) return { ok: false, why: 'Your AI service does not know that model name. Check the model name.' };
    if (r.status === 429) return { ok: false, why: 'Your AI service says you are going too fast or are out of credit.' };
    if (!r.ok) return { ok: false, why: 'Your AI service returned an error (status ' + r.status + ').' };
    const d = await r.json(); const c = d && d.choices && d.choices[0]; const text = c && c.message && c.message.content;
    if (!text) return { ok: false, why: 'Your AI service gave an empty answer.' };
    return { ok: true, res: { text: String(text).trim(), finish: c.finish_reason } };
  } catch (e) {
    return { ok: false, why: e && e.name === 'AbortError' ? 'Your AI service took too long.' : 'Could not reach your AI service.' };
  } finally { clearTimeout(timer); }
}
