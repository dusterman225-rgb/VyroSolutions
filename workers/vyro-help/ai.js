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
