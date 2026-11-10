// _png_rgb.mjs — конвертирует все PNG каталога из RGBA (colorType 6) в RGB (colorType 2).
// Яндекс требует RGB=2 для медиа; page.screenshot пишет RGBA. Прогоняет через ffmpeg
// -pix_fmt rgb24 (без альфы). Идемпотентно: уже-RGB пропускает.
//   node _png_rgb.mjs <mediaDir> [...]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';

function colorType(file) {
  const b = fs.readFileSync(file);
  return b.length > 26 ? b[25] : -1; // PNG IHDR byte 25 = color type
}

const dirs = process.argv.slice(2);
if (!dirs.length) { console.log('usage: node _png_rgb.mjs <mediaDir...>'); process.exit(2); }

let converted = 0, already = 0, failed = 0;
for (const d of dirs) {
  if (!fs.existsSync(d)) { console.log('SKIP (нет каталога):', d); continue; }
  for (const f of fs.readdirSync(d)) {
    if (!f.toLowerCase().endsWith('.png')) continue;
    const p = path.join(d, f);
    const ct = colorType(p);
    if (ct === 2) { already++; continue; }
    if (ct !== 6 && ct !== 3) { continue; } // 6=RGBA, 3=palette → конвертим; прочее не трогаем
    const tmp = p + '.rgb.png';
    try {
      execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', p, '-pix_fmt', 'rgb24', tmp]);
      // проверка: результат действительно RGB
      if (colorType(tmp) === 2) { fs.renameSync(tmp, p); converted++; }
      else { fs.unlinkSync(tmp); failed++; console.log('FAIL(не RGB после):', f); }
    } catch (e) { failed++; try { fs.unlinkSync(tmp); } catch (_) {} console.log('FAIL', f, e.message.slice(0, 80)); }
  }
  console.log('RGB:', path.basename(d), `converted=${converted}`);
}
console.log(`\nИТОГО: converted=${converted} already-RGB=${already} failed=${failed}`);
