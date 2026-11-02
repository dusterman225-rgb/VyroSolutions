// Privacy filter for the public help bot. The website already runs the same filter before sending;
// this second pass is the safety net in case someone calls the helper directly.
// Keep in step with shared/aiconsent.js. It cannot recognise names; the notice tells people not to type them.
const RULES = [
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
export function redact(text) {
  let out = String(text == null ? '' : text), changed = false;
  for (const r of RULES) { const next = out.replace(r[0], r[1]); if (next !== out) changed = true; out = next; }
  return { text: out, changed };
}
