// _recapture_all.mjs — пересъёмка медиа всех JS-игр (скриншоты+видео+covers RU/EN)
// + конвертация PNG в RGB (Яндекс требует colorType 2). Запускается после правок кода,
// чтобы убрать «медиа старше кода» и RU==EN.
//
// Для игры выбирает: свой capture-<slug>.mjs ИЛИ capture-generic.mjs + capture.json.
//   node _recapture_all.mjs [--only slug1,slug2] [--skip slug1,slug2]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PIPE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(PIPE, '..');

const argOnly = (process.argv.find(a => a.startsWith('--only=')) || '').replace('--only=', '').split(',').filter(Boolean);
const argSkip = (process.argv.find(a => a.startsWith('--skip=')) || '').replace('--skip=', '').split(',').filter(Boolean);

const games = fs.readdirSync(path.join(ROOT, 'games')).filter(d => {
  const p = path.join(ROOT, 'games', d);
  if (!fs.statSync(p).isDirectory()) return false;
  if (!fs.existsSync(path.join(p, 'engine'))) return false; // только JS-игры (не Godot)
  if (argOnly.length && !argOnly.includes(d)) return false;
  if (argSkip.includes(d)) return false;
  return true;
});

console.log(`Пересъёмка ${games.length} игр:`, games.join(' '));
const results = { ok: [], fail: [] };
for (const g of games) {
  const gameDir = path.join(ROOT, 'games', g);
  const outDir = path.join(ROOT, 'packages', g, 'media');
  fs.mkdirSync(outDir, { recursive: true });
  const ownScript = path.join(PIPE, `capture-${g}.mjs`);
  const useOwn = fs.existsSync(ownScript);
  const script = useOwn ? ownScript : path.join(PIPE, 'capture-generic.mjs');
  try {
    console.log(`\n=== ${g} (${useOwn ? 'capture-' + g : 'generic'}) ===`);
    execFileSync('node', [script, gameDir, outDir, 'ru,en'], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000 });
    // конвертация PNG → RGB
    execFileSync('node', [path.join(PIPE, '_png_rgb.mjs'), outDir], { stdio: ['ignore', 'pipe', 'pipe'] });
    console.log(`OK  ${g}`);
    results.ok.push(g);
  } catch (e) {
    console.log(`FAIL ${g}: ${(e.message || '').slice(0, 120)}`);
    results.fail.push(g);
  }
}
console.log(`\nИТОГО: OK=${results.ok.length} FAIL=${results.fail.length}`);
if (results.fail.length) console.log('FAIL:', results.fail.join(', '));
