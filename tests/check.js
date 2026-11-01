// Vyro automatic check. Runs on GitHub every time you upload files (see .github/workflows/check.yml).
// A green tick on the commit means: every script parses, every page's script and style files exist, the rules are balanced,
// and the manifests are valid. A red cross means something is broken, and the log says exactly which file.
// Run by hand with:  node tests/check.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const problems = [];
let pages = 0, scripts = 0;
function walk(d, out) {
  fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'tests') return;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  });
  return out;
}
const files = walk(ROOT, []);
const rel = p => path.relative(ROOT, p);
function parses(code, name) {
  try { new vm.Script(code, { filename: name }); return true; }
  catch (e) { problems.push('SYNTAX ' + name + ': ' + e.message); return false; }
}
files.filter(f => /\.js$/.test(f) && !/^workers/.test(rel(f))).forEach(f => { scripts++; parses(fs.readFileSync(f, 'utf8'), rel(f)); });
files.filter(f => /\.html$/.test(f)).forEach(f => {
  pages++;
  const t = fs.readFileSync(f, 'utf8'), name = rel(f);
  let m, i = 0; const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  while ((m = re.exec(t))) { i++; if (m[1].trim()) parses(m[1], name + ' (script ' + i + ')'); }
  const ref = /<(?:script|link)[^>]*?(?:src|href)="([^"#?]+)[^"]*"/gi;
  while ((m = ref.exec(t))) {
    const u = m[1]; if (/^(https?:|data:|mailto:|tel:|\/\/)/.test(u)) continue;
    if (/\.(html)$/.test(u)) continue;
    const target = u.startsWith('/') ? path.join(ROOT, u) : path.join(path.dirname(f), u);
    if (!fs.existsSync(target)) problems.push('MISSING FILE ' + name + ' uses ' + u);
  }
});
// Cloudflare worker files are ES modules: let Node check them as modules.
const cp = require('child_process'), os = require('os');
files.filter(f => /^workers/.test(rel(f)) && /\.js$/.test(f)).forEach(f => {
  const tmp = path.join(os.tmpdir(), 'vyro-check-' + path.basename(f, '.js') + '.mjs');
  fs.writeFileSync(tmp, fs.readFileSync(f, 'utf8'));
  const r = cp.spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
  if (r.status !== 0) problems.push('SYNTAX ' + rel(f) + ': ' + String(r.stderr).split('\n').slice(0, 3).join(' '));
});
files.filter(f => /\.webmanifest$/.test(f)).forEach(f => { try { JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { problems.push('BAD MANIFEST ' + rel(f)); } });
const rules = path.join(ROOT, 'firestore.rules');
if (fs.existsSync(rules)) {
  const r = fs.readFileSync(rules, 'utf8');
  const c = ch => r.split(ch).length - 1;
  if (c('{') !== c('}')) problems.push('RULES braces do not match: { ' + c('{') + ' vs } ' + c('}'));
  if (c('(') !== c(')')) problems.push('RULES brackets do not match: ( ' + c('(') + ' vs ) ' + c(')'));
}
// Every app must have the same shared files its pages call.
['shared/firebase-config.js', 'shared/coupon.js', 'shared/export.js', 'shared/errlog.js'].forEach(f => { if (!fs.existsSync(path.join(ROOT, f))) problems.push('MISSING ' + f); });
console.log('Checked ' + pages + ' pages and ' + scripts + ' script files.');
if (problems.length) { console.log('\nPROBLEMS (' + problems.length + '):'); problems.slice(0, 60).forEach(p => console.log(' - ' + p)); process.exit(1); }
console.log('All good.');
