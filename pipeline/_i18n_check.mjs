// _i18n_check.mjs — i18n key parity: t('key') usages vs dictionaries, per game.
// Handles BOTH dict styles: G.i18n = {ru:{...},en:{...}}  и  G.i18n = {dicts:{ru,en}, ...}.
// Run from pipeline/: node _i18n_check.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const GAMES = path.join(ROOT, 'games');

let totalIssues = 0;
for (const name of fs.readdirSync(GAMES)) {
  const gdir = path.join(GAMES, name);
  const i18nFile = path.join(gdir, 'game', 'i18n.js');
  if (!fs.existsSync(i18nFile)) continue;

  const sandbox = { window: { GAME: {} } };
  vm.createContext(sandbox);
  try {
    vm.runInContext(fs.readFileSync(i18nFile, 'utf8'), sandbox, { filename: i18nFile });
  } catch (e) {
    console.log(`[${name}] i18n.js THROWS on load: ${e.message}`);
    totalIssues++;
    continue;
  }
  let raw = sandbox.window.GAME.i18n || {};
  // нормализация: если есть .dicts — берём их; иначе фильтруем только object-значения (ru/en)
  let dict = raw.dicts && typeof raw.dicts === 'object' ? raw.dicts : raw;
  const langs = Object.keys(dict).filter(l => dict[l] && typeof dict[l] === 'object' && !Array.isArray(dict[l]));
  if (!langs.length) { console.log(`[${name}] no usable i18n dict`); totalIssues++; continue; }

  const issues = [];
  const base = langs[0];
  for (const other of langs.slice(1)) {
    for (const k of Object.keys(dict[base])) if (!(k in dict[other])) issues.push(`key '${k}' in ${base} missing in ${other}`);
    for (const k of Object.keys(dict[other])) if (!(k in dict[base])) issues.push(`key '${k}' in ${other} missing in ${base}`);
  }

  const used = new Set();
  const gamedir = path.join(gdir, 'game');
  for (const f of fs.readdirSync(gamedir)) {
    if (!f.endsWith('.js')) continue;
    const src = fs.readFileSync(path.join(gamedir, f), 'utf8');
    for (const m of src.matchAll(/\bt\(\s*['"]([\w.:-]+)['"]/g)) used.add(m[1]);
  }
  for (const k of used) for (const l of langs) if (!(k in dict[l])) issues.push(`t('${k}') used but missing in dict.${l}`);

  for (const l of langs) for (const [k, v] of Object.entries(dict[l]))
    if (typeof v === 'string' && /\bundefined\b|\[object Object\]|NaN/.test(v)) issues.push(`dict.${l}.${k} contains suspicious literal`);

  if (issues.length) { totalIssues += issues.length; console.log(`[${name}] ${issues.length} issues:`); for (const i of issues.slice(0, 12)) console.log('   ' + i); if (issues.length > 12) console.log(`   ... +${issues.length - 12} more`); }
}
console.log(`\n=== i18n check done: ${totalIssues} issues ===`);
