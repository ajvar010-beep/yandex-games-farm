// pipeline/release-check.mjs — строгий релиз-гейт.
// Ловит то, что audit.mjs не видит:
//  - zip: содержимое (hash) против билда, а не только mtime;
//  - медиа: свежесть, RGB, битые/пустые/одинаковые RU==EN кадры (fail-closed);
//  - manifest ↔ код (leaderboards/IAP), manifest обязателен;
//  - i18n: паритет и мёртвые ключи (парсер не теряет ключи на одной строке);
//  - SDK: /sdk.js, LoadingAPI/GameplayAPI, loadingReady;
//  - runtime: реальный клик «Играть», пауза→Resume, Escape, магазин, пустой canvas;
//  - Godot-билды (export/web) тоже проверяются.
// Запуск: node release-check.mjs ../games/<slug> [...] | --all
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PYTHON = process.env.PYTHON || 'python';
const ROOT = path.resolve(import.meta.dirname, '..');
const TEXT_LIMITS = { title: [1, 50], seo: [1, 160], short: [1, 70], about: [100, 1000], how_to_play: [40, 1000], keywords: [1, 100] };

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) return e.name === '.git' ? [] : walk(p);
  return [p];
});
const sha1 = (b) => crypto.createHash('sha1').update(b).digest('hex');
const read = (f) => fs.readFileSync(f, 'utf8');
const exists = (f) => fs.existsSync(f);
function fail(list, scope, msg) { list.push(`[${scope}] ${msg}`); }

function buildDirOf(gameDir) {
  const web = path.join(gameDir, 'export', 'web');
  return exists(path.join(web, 'index.html')) ? web : gameDir;
}

function checkStatic(game, issues) {
  const src = buildDirOf(game.dir);
  const index = path.join(src, 'index.html');
  if (!exists(index)) { fail(issues, 'static', 'нет index.html в билде'); return; }
  const html = read(index);
  if (!/sdk\.js/.test(html)) fail(issues, 'sdk', 'index.html не подключает sdk.js');
  const main = [path.join(game.dir, 'game', 'main.js'), path.join(src, 'game', 'main.js')].find(exists);
  if (main && !/loadingReady\s*\(/.test(read(main))) fail(issues, 'sdk', 'main.js не вызывает loadingReady()');
  const sdk = [path.join(game.dir, 'engine', 'sdk.js'), path.join(src, 'engine', 'sdk.js')].find(exists);
  if (sdk) {
    const s = read(sdk);
    if (!/LoadingAPI/.test(s)) fail(issues, 'sdk', 'sdk.js без LoadingAPI');
    if (!/GameplayAPI/.test(s)) fail(issues, 'sdk', 'sdk.js без GameplayAPI');
  }
}

function checkZip(game, issues) {
  const pkg = path.join(ROOT, 'packages', game.name);
  const zip = path.join(pkg, 'game.zip');
  if (!exists(zip)) { fail(issues, 'zip', 'нет game.zip'); return; }
  const src = buildDirOf(game.dir);
  const py = [
    'import zipfile,hashlib,os,sys',
    'z=zipfile.ZipFile(sys.argv[1]); src=sys.argv[2]; names=set(z.namelist()); bad=[]',
    'for n in sorted(names):',
    '  if n.endswith("/"): continue',
    '  p=os.path.join(src,n.replace("/",os.sep))',
    '  if not os.path.exists(p): bad.append("нет исходника для "+n); continue',
    '  a=hashlib.sha1(z.read(n)).hexdigest(); b=hashlib.sha1(open(p,"rb").read()).hexdigest()',
    '  if a!=b: bad.append("расходится "+n)',
    'for root,dirs,files in os.walk(src):',
    '  for f in files:',
    '    rel=os.path.relpath(os.path.join(root,f),src).replace(os.sep,"/")',
    '    if rel not in names: bad.append("нет в zip "+rel)',
    'print("\\n".join(bad))'
  ].join('\n');
  try {
    const out = execFileSync(PYTHON, ['-c', py, zip, src], { encoding: 'utf8' }).trim();
    for (const line of out.split('\n').filter(Boolean)) fail(issues, 'zip', line);
  } catch (e) { fail(issues, 'zip', 'hash-compare упал: ' + String(e.message).split('\n')[0]); }
}

function pngMeta(f) {
  const b = fs.readFileSync(f);
  if (b.length < 33 || b.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), colorType: b[25] };
}
function imageStdDev(f) {
  const py = 'from PIL import Image,ImageStat\nimport sys\nim=Image.open(sys.argv[1]).convert("RGB")\nprint(min(ImageStat.Stat(im).stddev))';
  try { return parseFloat(execFileSync(PYTHON, ['-c', py, f], { encoding: 'utf8' }).trim()); }
  catch (e) { return null; }
}

function checkMedia(game, issues) {
  const pkg = path.join(ROOT, 'packages', game.name);
  const media = path.join(pkg, 'media');
  if (!exists(media)) { fail(issues, 'media', 'нет media'); return; }
  // свежесть сравниваем с кодом игры, а не с движком (engine-патчи картинку не меняют)
  const src = buildDirOf(game.dir);
  const codeFiles = [path.join(src, 'index.html'), ...(exists(path.join(src, 'game')) ? walk(path.join(src, 'game')) : [])];
  const newest = Math.max(...codeFiles.filter(exists).map(f => fs.statSync(f).mtimeMs));
  for (const n of ['icon.png', 'cover.ru.png', 'cover.en.png']) {
    const f = path.join(media, n);
    if (!exists(f)) { fail(issues, 'media', 'нет ' + n); continue; }
    const m = pngMeta(f);
    if (!m) { fail(issues, 'media', `${n}: битый PNG`); continue; }
    if (m.colorType !== 2) fail(issues, 'media', `${n}: colorType ${m.colorType} (нужен RGB=2)`);
    if (fs.statSync(f).mtimeMs + 2000 < newest) fail(issues, 'media', `${n} старше кода игры`);
  }
  const pairs = {};
  for (const lang of ['ru', 'en']) {
    const vid = path.join(media, `gameplay_landscape.${lang}.mp4`);
    if (!exists(vid)) fail(issues, 'media', 'нет видео ' + lang);
    else if (fs.statSync(vid).mtimeMs + 2000 < newest) fail(issues, 'media', `видео ${lang} старше кода игры`);
    const shots = fs.readdirSync(media).filter(f => /^screenshot_(landscape|portrait)_.+_/.test(f) && f.endsWith(`_${lang}.png`));
    const landscape = shots.filter(f => f.startsWith('screenshot_landscape'));
    if (landscape.length < 3) fail(issues, 'media', `landscape-скриншотов ${lang}: ${landscape.length} <3`);
    for (const s of shots) {
      const f = path.join(media, s);
      if (fs.statSync(f).mtimeMs + 2000 < newest) fail(issues, 'media', `${s} старше кода игры`);
      const sd = imageStdDev(f);
      if (sd == null) fail(issues, 'media', `${s}: не удалось проверить пустоту (нет PIL?)`);
      else if (sd < 2) fail(issues, 'media', `${s}: почти однотонный (stddev ${sd})`);
      const key = s.replace(`_${lang}.png`, '');
      pairs[key] = pairs[key] || {};
      pairs[key][lang] = sha1(fs.readFileSync(f));
    }
  }
  for (const k of Object.keys(pairs)) {
    if (pairs[k].ru && pairs[k].en && pairs[k].ru === pairs[k].en) fail(issues, 'media', `${k}: RU==EN (язык не переключился)`);
  }
  // тексты
  const texts = path.join(pkg, 'texts');
  for (const [field, [min, max]] of Object.entries(TEXT_LIMITS)) {
    for (const lang of (field === 'keywords' ? [''] : ['ru', 'en'])) {
      const f = path.join(texts, lang ? `${field}.${lang}.txt` : `${field}.txt`);
      if (!exists(f)) { fail(issues, 'texts', 'нет ' + (lang ? `${field}.${lang}` : 'keywords')); continue; }
      const len = [...read(f).replace(/\r/g, '').trim()].length;
      if (len < min || len > max) fail(issues, 'texts', `${field}.${lang}: ${len} (${min}..${max})`);
    }
  }
}

function checkIds(game, issues) {
  const pkg = path.join(ROOT, 'packages', game.name);
  const mf = path.join(pkg, 'manifest.json');
  if (!exists(mf)) { fail(issues, 'manifest', 'нет manifest.json (обязателен)'); return; }
  let man = {};
  try { man = JSON.parse(read(mf)); } catch { fail(issues, 'manifest', 'битый manifest.json'); return; }
  // JS-игры: game/*.js. Godot-игры: scripts/*.gd — без .gd-скана все объявленные
  // ID у Godot всегда помечались «заявлен, но не используется» (FP 2026-11-13).
  const gd = walk(game.dir).filter(f => f.endsWith('.gd')).map(read).join('\n');
  const js = walk(game.dir).filter(f => f.endsWith('.js') && f.includes(`${path.sep}game${path.sep}`)).map(read).join('\n');
  const code = js + '\n' + gd;
  // JS: submitScore('x') / purchase('x'); GDScript: submit_score("x") / purchase("x").
  // Плюс ID внутри строковых литералов кода (mineridle вызывает purchase(pk[0]),
  // где pk = ["coins_5000", ...] — прямой аргумент-литерал не матчится).
  const lb = [...code.matchAll(/(?:submitScore|getLeaderboard|submit_score|get_leaderboard)\s*[(']\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
  const iap = [...code.matchAll(/purchase\s*[(']\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
  // строковые литералы, похожие на IAP/leaderboard id (только для манifest-проверки
  // «заявлен, но не используется»: заявленный ID в коде как строка = используется)
  const literals = new Set([...code.matchAll(/['"]([a-z0-9_]{3,40})['"]/g)].map(m => m[1]));
  const sets = {
    leaderboards: new Set([...lb, ...(man.leaderboards || []).filter(id => literals.has(id))]),
    iap: new Set([...iap, ...(man.iap || []).filter(id => literals.has(id))])
  };
  for (const k of ['leaderboards', 'iap']) {
    const declared = new Set(man[k] || []);
    for (const id of declared) if (!sets[k].has(id)) fail(issues, 'manifest', `${k}: '${id}' заявлен, но не используется`);
    for (const id of sets[k]) if (!declared.has(id)) fail(issues, 'manifest', `${k}: код использует '${id}', нет в manifest`);
  }
}

function parseI18n(src) {
  // Depth-aware поиск блока `loc: { ... }`: наивная регулярка `(loc:\s*\{[\s\S]*?\n\s*\})`
  // останавливалась на ПЕРВОМ `\n}` — а внутри ru-блока бывают вложенные объекты,
  // из-за чего «en: {» находился внутри ru, и `в en нет en` давало ложный FAIL
  // (кейс fishpond, 2026-11-13).
  const block = (loc) => {
    const start = src.search(new RegExp(loc + '\\s*:\\s*\\{'));
    if (start < 0) return null;
    const open = src.indexOf('{', start);
    let depth = 0;
    let inStr = null;
    for (let i = open; i < src.length; i++) {
      const ch = src[i];
      if (inStr) {
        if (ch === '\\') { i++; continue; }
        if (ch === inStr) inStr = null;
        continue;
      }
      if (ch === "'" || ch === '"') { inStr = ch; continue; }
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) return src.slice(open + 1, i); }
    }
    return null;
  };
  const keysOf = (txt) => {
    if (!txt) return null;
    // убираем строковые значения, чтобы не принять их за ключи (и не терять ключи на одной строке)
    const clean = txt.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g, '""');
    return [...clean.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:/g)].map(m => m[1]);
  };
  return { ru: keysOf(block('ru')), en: keysOf(block('en')) };
}

function checkI18n(game, issues) {
  const i18nFile = path.join(game.dir, 'game', 'i18n.js');
  if (!exists(i18nFile)) return; // Godot / движок без JS-словаря — пропускаем
  const src = read(i18nFile);
  const { ru, en } = parseI18n(src);
  if (!ru || !en) { fail(issues, 'i18n', 'не распарсены локали'); return; }
  for (const k of ru) if (!en.includes(k)) fail(issues, 'i18n', 'в en нет ' + k);
  for (const k of en) if (!ru.includes(k)) fail(issues, 'i18n', 'в ru нет ' + k);
  const other = walk(game.dir).filter(f => f.endsWith('.js') && f !== i18nFile).map(read).join('\n');
  const dynamic = new Set(['title', 'sweets', 'skins']);
  // Динамическая конкатенация t('item_'+id): если код собирает ключ из префикса,
  // все ключи с этим префиксом живые (иначе FP на hexwave/mergemon/skyblocks).
  // Прямые вызовы t('item_'+id), вызовы через алиас (t.t('goal_'+k)) и сборка
  // ключа в переменную (var key = 'goal_'+kind; ... T(key)) — все ключи с таким
  // префиксом считаем живыми (иначе FP на hexwave/mergemon/skyblocks).
  const dynPrefixes = [...other.matchAll(/['"]([A-Za-z0-9]+_)['"]\s*\+\s*\w/g)].map(m => m[1]);
  for (const k of ru) {
    if (dynamic.has(k) || /^(boost|skin)_/.test(k)) continue;
    if (dynPrefixes.some(p => k.startsWith(p))) continue;
    const re = new RegExp(`['"]${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`);
    if (!re.test(other)) fail(issues, 'i18n', `мёртвый ключ '${k}'`);
  }
}

async function canvasVariance(page) {
  const buf = await page.screenshot({ type: 'png' });
  const tmp = path.join(ROOT, 'scratch', '.live-shot.png');
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  fs.writeFileSync(tmp, buf);
  return imageStdDev(tmp);
}

async function checkRuntime(game, issues) {
  const src = buildDirOf(game.dir);
  const gameUrl = 'file:///' + path.join(src, 'index.html').replace(/\\/g, '/');
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--mute-audio', '--hide-scrollbars'] });
  // Открытие страницы с retry: под нагрузкой (пакетный --all, холодный Chrome) тяжёлая
  // игра может не успеть выставить __capture.ready за 15с и падала каскадом, убивая
  // весь прогон. Делаем до 3 попыток с нарастающим таймаутом (15/25/35с) и прогревом;
  // при полном провале возвращаем страницу с флагом notReady — чек запишет issue и
  // пойдёт дальше, а не уронит весь пакет.
  async function open(w, h, q) {
    const errs = [];
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const ctx = await browser.createBrowserContext();
      const page = await ctx.newPage();
      page.on('pageerror', e => errs.push('pageerror: ' + e.message));
      page.on('console', m => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
      page.on('requestfailed', r => errs.push('requestfailed: ' + r.url()));
      try {
        await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
        await page.goto(`${gameUrl}?${q}`, { waitUntil: 'load' });
        await page.waitForFunction('window.__capture && window.__capture.ready === true', { timeout: 15000 + attempt * 10000 });
        return { ctx, page, errs, notReady: false };
      } catch (e) {
        lastErr = e;
        try { await ctx.close(); } catch (_) {}
        if (attempt < 2) await new Promise(r => setTimeout(r, 800)); // прогрев между попытками
      }
    }
    // все попытки исчерпаны — возвращаем нефатально, чтобы гейт записал issue
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 }).catch(() => {});
    try { await page.goto(`${gameUrl}?${q}`, { waitUntil: 'load' }); } catch (_) {}
    errs.push('runtime-not-ready: __capture.ready не выставился за 3 попытки (' + (lastErr && lastErr.message) + ')');
    return { ctx, page, errs, notReady: true };
  }
  const wait = async (page, expr, ms) => {
    try { await page.waitForFunction(expr, { timeout: ms || 3000 }); return true; } catch { return false; }
  };
  const tapButton = async (page, expr) => {
    const r = await page.evaluate(expr);
    if (!r) return false;
    await page.mouse.click(r[0], r[1]);
    return true;
  };

  // 1. Меню → реальный клик «Играть» → play
  {
    const { ctx, page, errs, notReady } = await open(1280, 720, 'lang=ru&mute=1');
    if (notReady) fail(issues, 'runtime', 'страница не стала ready (menu): см. console-ошибки ниже');
    const inMenu = !notReady && await page.evaluate(() => window.Engine.sdk._game.sceneName === 'menu').catch(() => false);
    if (inMenu) {
      const clicked = await tapButton(page, `(() => { const s = window.Engine.sdk._game.scene; const b = s.buttons && s.buttons[0]; return b ? [b.x + b.w/2, b.y + b.h/2] : null; })()`);
      if (!clicked) fail(issues, 'runtime', 'в меню нет кнопки «Играть»');
      else if (!(await wait(page, `window.Engine.sdk._game.sceneName === 'play'`, 4000))) fail(issues, 'runtime', 'клик по «Играть» не открывает play (мёртвая кнопка)');
      else {
        await new Promise(r => setTimeout(r, 220));
        const sd = await canvasVariance(page);
        if (sd == null) fail(issues, 'runtime', 'не удалось проверить пустоту canvas (нет PIL?)');
        else if (sd < 2) fail(issues, 'runtime', 'canvas почти однотонный (0.5с после старта)');
      }
    }
    if (errs.length) fail(issues, 'runtime', 'menu→play console: ' + errs.join(' | ').slice(0, 240));
    await ctx.close();
  }

  // 2. Пауза → Resume (кнопка и Escape)
  {
    const { ctx, page, errs, notReady } = await open(1280, 720, 'scene=play&seed=5&wave=2&lang=ru&mute=1');
    if (notReady) fail(issues, 'runtime', 'страница не стала ready (pause)');
    await new Promise(r => setTimeout(r, 220));
    const hasPause = !notReady && await page.evaluate(() => !!(window.Engine.sdk._game.scene && window.Engine.sdk._game.scene.pauseBtn)).catch(() => false);
    const mode = () => page.evaluate(() => window.Engine.sdk._game.scene.mode);
    if (hasPause) {
      await page.evaluate(() => { const s = window.Engine.sdk._game.scene; s.pauseBtn.tap(); });
      if (!(await wait(page, `window.Engine.sdk._game.scene.mode === 'paused'`, 2000))) fail(issues, 'runtime', 'кнопка паузы не ставит paused');
      const resumed = await tapButton(page, `(() => { const s = window.Engine.sdk._game.scene; const b = (s.endButtons || [])[0]; return b ? [b.x+b.w/2, b.y+b.h/2] : null; })()`);
      if (!resumed) fail(issues, 'runtime', 'в паузе нет кнопки «Продолжить»');
      else if (!(await wait(page, `window.Engine.sdk._game.scene.mode === 'running'`, 2500))) fail(issues, 'runtime', '«Продолжить» не выводит из паузы (кирпич)');
      // Escape
      await page.keyboard.press('Escape');
      if (!(await wait(page, `window.Engine.sdk._game.scene.mode === 'paused'`, 2500))) fail(issues, 'runtime', 'Escape не ставит паузу');
      await page.keyboard.press('Escape');
      if (!(await wait(page, `window.Engine.sdk._game.scene.mode === 'running'`, 2500))) fail(issues, 'runtime', 'Escape не снимает паузу');
    }
    if (errs.length) fail(issues, 'runtime', 'pause console: ' + errs.join(' | ').slice(0, 240));
    await ctx.close();
  }

  // 3. Магазин (если есть метод openShop)
  {
    const { ctx, page, errs, notReady } = await open(390, 844, 'scene=play&seed=5&wave=2&lang=ru&mute=1');
    if (notReady) fail(issues, 'runtime', 'страница не стала ready (shop)');
    const can = !notReady && await page.evaluate(() => !!(window.Engine.sdk._game.scene && window.Engine.sdk._game.scene.openShop)).catch(() => false);
    if (can) {
      await page.evaluate(() => { const g = window.Engine.sdk._game; g.scene.openShop(g); });
      const ok = await wait(page, `(() => { const s = window.Engine.sdk._game.scene; return s.mode === 'shop' || s.panel === 'shop'; })()`, 2500);
      if (!ok) fail(issues, 'runtime', 'openShop не открывает магазин');
    }
    if (errs.length) fail(issues, 'runtime', 'shop console: ' + errs.join(' | ').slice(0, 240));
    await ctx.close();
  }

  await browser.close();
}

const args = process.argv.slice(2);
const gamesRoot = path.join(ROOT, 'games');
const names = args[0] === '--all'
  ? fs.readdirSync(gamesRoot).filter(d => exists(path.join(gamesRoot, d, 'index.html')) || exists(path.join(gamesRoot, d, 'export', 'web', 'index.html'))).sort()
  : args.map(a => path.basename(path.resolve(a)));
if (!names.length) { console.log('usage: node release-check.mjs <gameDir...> | --all'); process.exit(2); }

let total = 0;
for (const name of names) {
  const game = { name, dir: path.join(gamesRoot, name) };
  const issues = [];
  checkStatic(game, issues);
  checkZip(game, issues);
  checkMedia(game, issues);
  checkIds(game, issues);
  checkI18n(game, issues);
  await checkRuntime(game, issues);
  console.log(`=== ${name} ===`);
  if (issues.length) { total += issues.length; issues.forEach(i => console.log('  FAIL ' + i)); }
  else console.log('  OK');
}
console.log(`\nTOTAL: ${total} issues / ${names.length} games`);
process.exit(total ? 1 : 0);
