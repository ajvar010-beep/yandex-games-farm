// _i18n_prune.mjs — удаляет мёртвые i18n-ключи из game/i18n.js.
// Мёртвый = ключ есть в словаре, но не встречается (в кавычках) ни в одном .js игры,
// кроме самого i18n.js. Критерий = release-check.mjs, чтобы гейт позеленел после правки.
// Динамические (title, sweets, skins, boost_*, skin_*) НЕ трогаем.
//
// Парсинг — строко-ориентированный, устойчив к «несколько ключей на одной строке»:
// каждый `key: value,` (value в одинарных кавычках) удаляется точечно, а строка
// склеивается. Пустые строки после удаления подчищаются.
//
//   node _i18n_prune.mjs --dry-run <gameDir...>   — показать, что удалит
//   node _i18n_prune.mjs <gameDir...>             — применить
import fs from 'node:fs';
import path from 'node:path';

function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
    const p = path.join(d, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

const dynamic = new Set(['title', 'sweets', 'skins']);
const DRY = process.argv[2] === '--dry-run';
const args = process.argv.slice(DRY ? 3 : 2);
if (!args.length) { console.log('usage: node _i18n_prune.mjs [--dry-run] <gameDir...>'); process.exit(2); }

// все ключи `key: '...'` в словаре (в кавычках — только строковые значения i18n)
function dictKeys(src) {
  const keys = new Set();
  for (const m of src.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:\s*'(?:\\.|[^'\\])*'/g)) keys.add(m[1]);
  return [...keys];
}

let totalRemoved = 0, totalGames = 0;
for (const dir of args) {
  const i18nFile = path.join(dir, 'game', 'i18n.js');
  if (!fs.existsSync(i18nFile)) { console.log('SKIP (нет i18n.js):', path.basename(dir)); continue; }
  const src = fs.readFileSync(i18nFile, 'utf8');
  const other = walk(dir)
    .filter(f => f.endsWith('.js') && path.resolve(f) !== path.resolve(i18nFile))
    .map(f => fs.readFileSync(f, 'utf8')).join('\n');

  // Префиксы динамической конкатенации: t('item_' + x), t('ch_' + i + '_name') и т.п.
  // Если ключ начинается с такого префикса — он используется динамически, НЕ мёртвый.
  const dynPrefixes = new Set();
  for (const m of other.matchAll(/\.t\(\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]\s*\+/g)) dynPrefixes.add(m[1]);
  for (const m of other.matchAll(/i18n\.t\(\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]\s*\+/g)) dynPrefixes.add(m[1]);
  // также голый строковый литерал-префикс: 'item_' + id  (без .t(), передаётся дальше)
  for (const m of other.matchAll(/['"]([A-Za-z_][A-Za-z0-9_]*_)['"]\s*\+/g)) dynPrefixes.add(m[1]);

  const dead = dictKeys(src).filter(k => {
    if (dynamic.has(k) || /^(boost|skin)_/.test(k)) return false;
    // динамический префикс? ключ вида `<prefix><что-то>` или `<prefix><что-то>_d`
    for (const p of dynPrefixes) {
      if (k.startsWith(p)) return false;                    // item_ + id
      if (k.startsWith(p.replace(/_$/, '') + '_')) return false; // ch_N_name при префиксе 'ch_'
    }
    const re = new RegExp(`['"]${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`);
    return !re.test(other);
  });

  if (!dead.length) { console.log('OK  ', path.basename(dir), '(мёртвых нет)'); continue; }
  totalGames++;
  totalRemoved += dead.length;
  console.log((DRY ? 'DRY ' : 'PRUN'), path.basename(dir), `-${dead.length}:`, dead.join(','));

  if (!DRY) {
    let out = src;
    for (const k of dead) {
      // удалить `key: 'value',` (с последующей запятой) ИЛИ `, key: 'value'` (без хвостовой) —
      // точечно, в кавычках, не трогая соседние ключи на строке.
      const esc = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const withComma = new RegExp(`\\s*${esc}\\s*:\\s*'(?:\\\\.|[^'\\\\])*'\\s*,`, 'g');
      const noComma = new RegExp(`,\\s*${esc}\\s*:\\s*'(?:\\\\.|[^'\\\\])*'`, 'g');
      out = out.replace(withComma, ' ').replace(noComma, '');
    }
    // подчистить: строки, ставшие пустыми (только пробелы) → удалить; многопустые → одна
    out = out.split('\n').filter(l => l.trim() !== '' || false).join('\n');
    out = out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
    // не оставить висячую запятую перед закрывающей скобкой блока (могла образоваться)
    out = out.replace(/,(\s*\n\s*\})/g, '$1');
    fs.writeFileSync(i18nFile, out, 'utf8');
  }
}
console.log(`\nИТОГО: ${DRY ? 'нашёл' : 'удалил'} ${totalRemoved} мёртвых ключей в ${totalGames} играх`);
