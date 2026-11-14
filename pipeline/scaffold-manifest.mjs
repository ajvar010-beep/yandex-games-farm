// pipeline/scaffold-manifest.mjs — генерирует packages/<id>/manifest.json
// для игр, у которых он отсутствует. Шаблон — manifest wordgrid.
// Запуск: node scaffold-manifest.mjs            (все недостающие)
//        node scaffold-manifest.mjs <id> [...]  (конкретные)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const GAMES = path.join(ROOT, 'games');
const PKGS = path.join(ROOT, 'packages');

// id → категории (по жанру игры; можно поправить вручную после генерации)
const CATEGORIES = {
  bubblebay: ['arcade', 'casual'],
  bubblepop: ['arcade', 'casual'],
  cloudherder: ['arcade', 'casual'],
  fireflygrove: ['arcade', 'casual'],
  fishpond: ['arcade', 'casual'],
  gingerdash: ['arcade', 'runner'],
  hexwave: ['arcade', 'action'],
  mahjongpair: ['puzzle', 'board'],
  matchcandy: ['puzzle', 'match3'],
  merge2048: ['puzzle', 'casual'],
  mergemon: ['puzzle', 'casual'],
  pizzaspin: ['arcade', 'casual'],
  skyblocks: ['idle', 'clicker'],
  solitairekl: ['card', 'solitaire'],
  starfall: ['arcade', 'casual'],
  sudokulite: ['puzzle', 'logic'],
  sweettower: ['arcade', 'casual'],
  watersort: ['puzzle', 'sorting'],
  wordlink: ['word', 'puzzle']
};

// IAP no_ads: есть у игр, где код делает purchase('no_ads')
function hasNoAds(dir) {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
    const p = path.join(d, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
  for (const f of walk(path.join(dir, 'game'))) {
    if (!f.endsWith('.js')) continue;
    if (/purchase\s*\(\s*'no_ads'/.test(fs.readFileSync(f, 'utf8'))) return true;
  }
  return false;
}

// кол-во уровней: maxLevel из config.js, иначе уровневые ключи lv_N/lvl_N из i18n
function countLevels(id) {
  try {
    const cfg = fs.readFileSync(path.join(GAMES, id, 'game', 'config.js'), 'utf8');
    const m = cfg.match(/maxLevel\s*:\s*(\d+)/);
    if (m) return +m[1];
  } catch {}
  try {
    const src = fs.readFileSync(path.join(GAMES, id, 'game', 'i18n.js'), 'utf8');
    const nums = [...src.matchAll(/\b(?:lv|lvl)_(\d+)\s*:/g)].map(m => +m[1]);
    if (nums.length) return Math.max(...nums);
  } catch {}
  return 0;
}

function readVersion(id) {
  try {
    const src = fs.readFileSync(path.join(GAMES, id, 'game', 'config.js'), 'utf8');
    const m = src.match(/G\.version\s*=\s*'([^']+)'/);
    if (m) return m[1];
  } catch {}
  return '1.0.0';
}

function readTitle(id) {
  try {
    const src = fs.readFileSync(path.join(GAMES, id, 'game', 'i18n.js'), 'utf8');
    const m = src.match(/title:\s*'([^']+)'/);
    if (m) return m[1];
  } catch {}
  return id;
}

function hasLeaderboard(id) {
  try {
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
      const p = path.join(d, e.name);
      return e.isDirectory() ? walk(p) : [p];
    });
    for (const f of walk(path.join(GAMES, id, 'game'))) {
      if (!f.endsWith('.js')) continue;
      const src = fs.readFileSync(f, 'utf8');
      const m = [...src.matchAll(/(?:submitScore|getLeaderboard)\s*\(\s*'([^']+)'/g)];
      if (m.length) return [...new Set(m.map(x => x[1]))];
    }
  } catch {}
  return [];
}

const names = process.argv.slice(2);
const all = fs.readdirSync(GAMES).filter(d => {
  const js = fs.existsSync(path.join(GAMES, d, 'game', 'main.js'));
  const mf = fs.existsSync(path.join(PKGS, d, 'manifest.json'));
  return js && !mf;
}).sort();

const targets = names.length ? names : all;
let created = 0;
for (const id of targets) {
  const pkg = path.join(PKGS, id);
  if (fs.existsSync(path.join(pkg, 'manifest.json'))) { console.log(`${id}: manifest уже есть — пропускаю`); continue; }
  if (!fs.existsSync(pkg)) fs.mkdirSync(pkg, { recursive: true });
  const noAds = hasNoAds(path.join(GAMES, id));
  const lb = hasLeaderboard(id);
  const man = {
    id,
    engine: 'html5-canvas',
    version: readVersion(id),
    orientation: 'any',
    touch: true,
    languages: ['ru', 'en'],
    age: '6+',
    categories: CATEGORIES[id] || ['casual'],
    monetization: ['rewarded_video', 'interstitial', 'banner'],
    iap: noAds ? ['no_ads'] : [],
    leaderboards: lb,
    cloud_saves: true,
    levels: countLevels(id)
  };
  fs.writeFileSync(path.join(pkg, 'manifest.json'), JSON.stringify(man, null, 2) + '\n');
  created++;
  console.log(`${id}: manifest создан (iap=${man.iap.join(',') || '—'}, lb=${man.leaderboards.join(',') || '—'}, levels=${man.levels})`);
}
console.log(`\nИтого: ${created} manifest-ов создано`);
