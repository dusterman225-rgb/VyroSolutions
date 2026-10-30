// Vyro AI chains. Each chain is tried IN ORDER: if a model is busy, out of free tokens, or gives an answer
// that fails the checks, the next one is tried. Cheapest/free first, stronger and pricier last.
// To change models later, edit this file (or set an AI_CHAINS variable holding the same JSON in Cloudflare).
// Every "model" is an OpenRouter model ID, so one OPENROUTER_KEY secret covers all of them.
export const CHAINS = {
  // Help bubble: free first.
  help: [
    { model: 'nvidia/nemotron-3-ultra-550b-a55b:free', maxTokens: 800 },
    { model: 'inclusionai/ling-3.0-flash', maxTokens: 800 },
    { model: 'google/gemini-3.1-flash-lite', maxTokens: 800 }
  ],
  // Business assistant: it sees a business's own records, so it uses paid models only (cheap first).
  // No free model here on purpose: free providers may log prompts. Add one at the end only if you accept that.
  assistant: [
    { model: 'inclusionai/ling-3.0-flash', maxTokens: 1000 },
    { model: 'google/gemini-3.1-flash-lite', maxTokens: 1000 }
  ],
  // "Think harder": the same question again on a stronger, pricier model (about 6x the cost of the everyday ones).
  deep: [
    { model: 'google/gemini-3.5-flash', maxTokens: 1500, timeoutMs: 60000 },
    { model: 'google/gemini-3.1-flash-lite', maxTokens: 1500 }
  ],
  // Photos of receipts and invoices. Cheap vision model first; the answer must pass the math checks,
  // otherwise the stronger one reads the photo again.
  vision: [
    { model: 'inclusionai/ling-3.0-flash-vl', maxTokens: 1500 },
    { model: 'google/gemini-3.1-flash-lite', maxTokens: 1500 }
  ]
};

// Per business, per day. Photos cost more than chat, so they get their own small allowance.
// vision = everyone; visionPlus = businesses with the $5/month Photo Plus (set in aiPlans, see firestore.rules).
export const LIMITS = { chat: 40, vision: 15, visionPlus: 50, deep: 10 };

// Dollars per million tokens [in, out]. Used only to log a rough cost line; not billing.
export const PRICES = {
  'inclusionai/ling-3.0-flash': [0.021, 0.063],
  'inclusionai/ling-3.0-flash-vl': [0.06, 0.18],
  'google/gemini-3.1-flash-lite': [0.25, 1.5],
  'google/gemini-3.5-flash': [1.5, 9]
};

export function chainFor(env, name) {
  try { if (env.AI_CHAINS) { const o = JSON.parse(env.AI_CHAINS); if (Array.isArray(o[name]) && o[name].length) return o[name]; } } catch (e) { /* use built-in */ }
  return CHAINS[name] || [];
}
