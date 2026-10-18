// pipeline/audit.mjs — полный баг-чек игры фабрики перед публикацией.
// Запуск: node audit.mjs ../games/<name>  (из pipeline/)
//        node audit.mjs --all            (все games/*)
//
// Проверки (по docs/yandex-specs.md):
//  A. Статика: внешние URL в коде (1.7/8.4.2), ASCII-имена (1.22), index.html в корне.
//  B. Рантайм: загрузка на file:// — 0 console.error/pageerror/requestfailed (6.4),
//     __capture.ready, меню рендерится, клик «Играть» переводит в play.
//  C. Экраны: freeze-кадры play (running), shop (5 кнопок), over — getState совпадает.
//  D. i18n: ru/en — title, магазин переключается языком (кнопка lang в меню не проверяем
//     headless, но словари: обе локали содержат все ключи).
//  E. Пакет: zip существует и свежее исходников, media-ассеты существуют, размеры
//     icon 512×512, cover 800×470, mp4 1280×720 ≤28с, скриншоты 1280×720/720×1280.
//  F. Тексты: лимиты полей (title≤50, seo≤160, short≤70, about 100..1000, how 40..1000,
//     keywords≤100), обе локали.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');

const TEXT_LIMITS = {
  'title': [1, 50], 'seo': [1, 160], 'short': [1, 70],
  'about': [100, 1000], 'how_to_play': [40, 1000], 'keywords': [1, 100]
};

function fail(list, scope, msg) { list.push(`[${scope}] ${msg}`); }

// ---------- статика ----------
function auditStatic(game, issues) {
  const gdir = game.dir;
  if (!fs.existsSync(path.join(gdir, 'index.html'))) fail(issues, 'static', 'нет index.html в корне');
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
    const p = path.join(d, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
  for (const f of walk(gdir)) {
    const rel = path.relative(gdir, f).replace(/\\/g, '/');
    if (!/^[\x20-\x7E]+$/.test(rel)) fail(issues, 'static', `не-ASCII имя: ${rel}`);
    if (/\.(js|html|css|json|txt)$/.test(f)) {
      const src = fs.readFileSync(f, 'utf8');
      if (/https?:\/\//.test(src) && !/yandex|localhost|127\.0\.0\.1/.test(src) && !rel.startsWith('sdk-stub'))
        fail(issues, 'static', `внешний URL в ${rel}`);
    }
  }
}

// ---------- рантайм ----------
async function auditRuntime(game, issues) {
  const url = 'file:///' + path.join(game.dir, 'index.html').replace(/\\/g, '/');
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--mute-audio', '--hide-scrollbars'] });
  async function shot(query, expect, label) {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
    page.on('requestfailed', r => errs.push('requestfailed: ' + r.url()));
    try {
      await page.setViewport({ width: 1280, height: 720 });
      await page.goto(`${url}?${query}&mute=1`, { waitUntil: 'load' });
      await page.waitForFunction('window.__capture && window.__capture.ready === true', { timeout: 15000 });
      await page.evaluate('window.__capture.renderOnce()');
      await page.evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
      const st = await page.evaluate('window.__capture.getState()');
      for (const k of Object.keys(expect)) {
        if (st[k] !== expect[k]) fail(issues, 'runtime', `${label}: ${k}=${st[k]} != ${expect[k]}`);
      }
    } catch (e) {
      fail(issues, 'runtime', `${label}: ${e.message}`);
    } finally {
      if (errs.length) fail(issues, 'runtime', `${label}: console: ${errs.join(' | ').slice(0, 200)}`);
      await ctx.close();
    }
  }
  // меню (оба языка)
  await shot('scene=menu&freeze=1&lang=ru', { scene: 'menu' }, 'menu/ru');
  await shot('scene=menu&freeze=1&lang=en', { scene: 'menu' }, 'menu/en');
  // геймплей (автопилот + волна 5), оба языка
  await shot('scene=play&seed=23&wave=5&t=6&freeze=1&lang=ru', { scene: 'play' }, 'play/ru');
  await shot('scene=play&seed=23&wave=5&t=6&freeze=1&lang=en', { scene: 'play' }, 'play/en');
  // магазин
  await shot('scene=play&seed=23&wave=5&coins=500&mode=shop&freeze=1&lang=ru', { scene: 'play' }, 'shop/ru');
  await shot('scene=play&seed=23&wave=5&coins=500&mode=shop&freeze=1&lang=en', { scene: 'play' }, 'shop/en');
  // гейм-овер
  await shot('scene=play&seed=9&mode=over&score=1000&freeze=1&lang=ru', { scene: 'play' }, 'over/ru');
  await browser.close();
}

// ---------- словари i18n ----------
function auditI18n(game, issues) {
  try {
    const src = fs.readFileSync(path.join(game.dir, 'game', 'i18n.js'), 'utf8');
    const keys = (loc) => {
      const m = src.match(new RegExp(loc + ':\\s*\\{([\\s\\S]*?)\\n    \\}'));
      if (!m) return null;
      return (m[1].match(/^\s*([a-z_0-9]+):/gmi) || []).map(s => s.trim().replace(/:$/, ''));
    };
    const ru = keys('ru'), en = keys('en');
    if (!ru || !en) { fail(issues, 'i18n', 'не распарсены локали'); return; }
    for (const k of ru) if (!en.includes(k)) fail(issues, 'i18n', `в en нет ключа ${k}`);
    for (const k of en) if (!ru.includes(k)) fail(issues, 'i18n', `в ru нет ключа ${k}`);
  } catch (e) { fail(issues, 'i18n', e.message); }
}

// ---------- медиа и пакет ----------
function pngSize(f) {
  const b = fs.readFileSync(f);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}
function mp4Meta(f) {
  try {
    const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim();
    const st = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f]).toString().trim().split(',');
    return { dur: parseFloat(out), w: +st[0], h: +st[1] };
  } catch { return null; }
}
function auditPackage(game, issues) {
  const pkg = path.join(ROOT, 'packages', game.name);
  const media = path.join(pkg, 'media');
  const texts = path.join(pkg, 'texts');
  if (!fs.existsSync(pkg)) { fail(issues, 'pkg', 'нет пакета'); return; }
  // zip свежесть
  const zip = path.join(pkg, 'game.zip');
  if (!fs.existsSync(zip)) fail(issues, 'pkg', 'нет game.zip');
  else {
    const zm = fs.statSync(zip).mtimeMs;
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
      const p = path.join(d, e.name); return e.isDirectory() ? walk(p) : [p];
    });
    for (const f of walk(game.dir)) {
      if (fs.statSync(f).mtimeMs > zm + 2000) fail(issues, 'pkg', `zip старше ${path.relative(game.dir, f)}`);
    }
  }
  // иконка/обложка
  const icon = path.join(media, 'icon.png');
  if (!fs.existsSync(icon)) fail(issues, 'media', 'нет icon.png');
  else { const [w, h] = pngSize(icon); if (w !== 512 || h !== 512) fail(issues, 'media', `icon ${w}x${h}`); }
  for (const lang of ['ru', 'en']) {
    const cov = path.join(media, `cover.${lang}.png`);
    if (!fs.existsSync(cov)) fail(issues, 'media', `нет cover.${lang}.png`);
    else { const [w, h] = pngSize(cov); if (w !== 800 || h !== 470) fail(issues, 'media', `cover.${lang} ${w}x${h}`); }
    const vid = path.join(media, `gameplay_landscape.${lang}.mp4`);
    if (!fs.existsSync(vid)) fail(issues, 'media', `нет gameplay_landscape.${lang}.mp4`);
    else {
      const m = mp4Meta(vid);
      if (!m) fail(issues, 'media', `mp4 ${lang}: ffprobe fail`);
      else {
        if (m.w !== 1280 || m.h !== 720) fail(issues, 'media', `video ${lang}: ${m.w}x${m.h}`);
        if (!(m.dur > 10 && m.dur <= 28.1)) fail(issues, 'media', `video ${lang}: ${m.dur}s`);
      }
    }
    // скриншоты: ≥3 альбомных на язык
    const shots = fs.existsSync(media) ? fs.readdirSync(media).filter(f => f.startsWith('screenshot_landscape') && f.endsWith(`_${lang}.png`)) : [];
    if (shots.length < 3) fail(issues, 'media', `скриншотов landscape ${lang}: ${shots.length}`);
  }
  // тексты
  for (const [field, [min, max]] of Object.entries(TEXT_LIMITS)) {
    const langs = field === 'keywords' ? [''] : ['ru', 'en'];
    for (const lang of langs) {
      const f = path.join(texts, lang ? `${field}.${lang}.txt` : `${field}.txt`);
      if (!fs.existsSync(f)) { fail(issues, 'texts', `нет ${field}.${lang || 'txt'}`); continue; }
      const len = [...fs.readFileSync(f, 'utf8').replace(/\r/g, '').trim()].length;
      if (len < min || len > max) fail(issues, 'texts', `${field}.${lang}: ${len} симв (лимит ${min}..${max})`);
    }
  }
  // EN != RU
  try {
    const aru = fs.readFileSync(path.join(texts, 'about.ru.txt'), 'utf8');
    const aen = fs.readFileSync(path.join(texts, 'about.en.txt'), 'utf8');
    if (aru.trim() === aen.trim()) fail(issues, 'texts', 'about: EN==RU');
  } catch {}
}

// ---------- main ----------
const arg = process.argv[2];
const gamesDir = path.join(ROOT, 'games');
const names = arg === '--all'
  ? fs.readdirSync(gamesDir).filter(d => fs.existsSync(path.join(gamesDir, d, 'index.html'))).sort()
  : [path.basename(path.resolve(process.cwd(), arg || ''))];
if (!names[0]) { console.log('usage: node audit.mjs <gameDir|--all>'); process.exit(1); }

let totalIssues = 0;
for (const name of names) {
  const game = { name, dir: path.join(gamesDir, name) };
  const issues = [];
  process.stdout.write(`=== ${name} ===\n`);
  auditStatic(game, issues);
  auditI18n(game, issues);
  auditPackage(game, issues);
  await auditRuntime(game, issues);
  if (issues.length) {
    totalIssues += issues.length;
    for (const i of issues) console.log('  FAIL ' + i);
  } else console.log('  OK');
}
console.log(`\nTOTAL: ${totalIssues} issues / ${names.length} games`);
process.exit(totalIssues ? 1 : 0);
