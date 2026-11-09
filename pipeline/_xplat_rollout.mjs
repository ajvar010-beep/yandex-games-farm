// _xplat_rollout.mjs — правит index.html всех JS-игр под кросс-платформенный слой.
// Заменяет блок «(function(){...document.write('<script src="/sdk.js">')...})()»
// на: <script src="engine/platform.js"> + sdk-stub + адаптеры vk/gamemonetize.
// Идемпотентно: если platform.js уже вставлен — пропускает.
import fs from 'node:fs';
import path from 'node:path';

const gamesDir = path.resolve(process.argv[2] || '../games');
const dirs = fs.readdirSync(gamesDir).filter(d => {
  const p = path.join(gamesDir, d);
  return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'index.html')) && fs.existsSync(path.join(p, 'engine', 'platform.js'));
});

let changed = 0, skipped = 0;
for (const d of dirs) {
  const f = path.join(gamesDir, d, 'index.html');
  let s = fs.readFileSync(f, 'utf8');
  if (s.includes('engine/platform.js')) { skipped++; continue; } // уже

  // Убираем IIFE с document.write('/sdk.js') (platform.js теперь инжектит сам).
  // Паттерн: <script>(function(){var p=location.protocol; if(p!=='file:'...){document.write(...)}})();</script>
  const iifeRe = /<script>\s*\(function\s*\(\)\s*\{[\s\S]*?document\.write\('<script src="\/sdk\.js"><\\\/script>'\);[\s\S]*?\}\)\(\);\s*<\/script>/;
  const repl = '<script src="engine/platform.js"></script>';
  let ns = s.replace(iifeRe, repl);

  // После sdk-stub.js вставляем адаптеры (если их ещё нет).
  if (ns.includes('sdk-stub.js') && !ns.includes('engine/platform/vk.js')) {
    ns = ns.replace(
      /(<script src="sdk-stub\.js"><\/script>)/,
      '$1\n<script src="engine/platform/vk.js"></script>\n<script src="engine/platform/gamemonetize.js"></script>'
    );
  }

  if (ns !== s) { fs.writeFileSync(f, ns, 'utf8'); changed++; console.log('OK  ', d); }
  else { console.log('SKIP(нет паттерна)', d); }
}
console.log(`\nchanged=${changed} skipped=${skipped} of ${dirs.length}`);
