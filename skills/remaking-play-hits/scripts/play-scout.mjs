#!/usr/bin/env node
// play-scout.mjs — снимок страницы Google Play для разбора игры.
// Запуск: node scripts/play-scout.mjs <packageId|play-url> [outDir]
// Пишет market/play-<pkg>.md и .json. Числа — снимок на дату, не «истина навсегда».
// Если Play/AppBrain недоступны на уровне сети — честный Bing-fallback со сниппетами
// (помечены как неподтверждённые), а не выдуманные цифры.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let puppeteer = null;
for (const cand of ['puppeteer-core', path.resolve(process.cwd(), 'node_modules/puppeteer-core'), 'C:/GameFactory/node_modules/puppeteer-core']) {
  try { puppeteer = require(cand); if (puppeteer && puppeteer.launch) break; } catch (e) {}
}
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const arg = process.argv[2];
if (!arg) { console.log('usage: node play-scout.mjs <packageId|play-url> [outDir]'); process.exit(2); }
let pkg = arg;
if (arg.includes('id=')) { try { pkg = new URL(arg).searchParams.get('id') || arg; } catch (e) { pkg = arg; } }
const outDir = path.resolve(process.argv[3] || 'market');
const url = `https://play.google.com/store/apps/details?id=${encodeURIComponent(pkg)}&hl=ru&gl=RU`;
const isPkg = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/i.test(arg);
const bingQuery = isPkg ? ('"' + pkg + '" Google Play') : (arg + ' Google Play');

function strip(s) {
  return String(s || '').replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function decodeBing(u) {
  try {
    const url = new URL(String(u).replace(/&amp;/g, '&'), 'https://www.bing.com');
    const b = url.searchParams.get('u');
    if (b && b.startsWith('a1')) {
      const t = b.slice(2).replace(/-/g, '+').replace(/_/g, '/');
      const pad = t + '='.repeat((4 - t.length % 4) % 4);
      return Buffer.from(pad, 'base64').toString('utf8');
    }
    return u;
  } catch (e) { return u; }
}

async function bingSearch(q, limit) {
  const u = 'https://www.bing.com/search?q=' + encodeURIComponent(q);
  try {
    const r = await fetch(u, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8'
      }
    });
    if (!r.ok) return [];
    const html = await r.text();
    const out = [];
    const blocks = html.split('<li class="b_algo"').slice(1);
    for (const block of blocks) {
      if (out.length >= (limit || 8)) break;
      const href = (block.match(/<a[^>]+href="([^"]+)"/) || [])[1] || '';
      const title = strip((block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) || [])[1] || '');
      const para = strip((block.match(/<p[^>]*>([\s\S]*?)<\/p>/) || [])[1] || '');
      if (!href || !title) continue;
      out.push({ url: decodeBing(href), title: title, snippet: para });
    }
    if (!out.length) return out;
    // оставляем только то, что реально про игру: ссылка на Play/APKPure/обзор
    // либо совпадение значимого слова запроса в заголовке/сниппете
    const words = String(q).toLowerCase().replace(/google play|site:play\.google\.com/g, ' ')
      .replace(/[^\p{L}\p{N} ]+/gu, ' ').split(/\s+/).filter(w => w.length > 3);
    const appCtx = /google play|play store|apkpure|appstore|app store|android|game|games|игр|игра|геймплей|gameplay|roblox|mod apk/i;
    const rel = out.filter(r => {
      const u = (r.url || '').toLowerCase();
      const t = ((r.title || '') + ' ' + (r.snippet || '')).toLowerCase();
      if (/play\.google\.com\/store\/apps|apkpure|apkcombo|appbrain|qoo-app|apkmirror/.test(u)) return true;
      return appCtx.test(t) && words.some(w => t.includes(w));
    });
    return rel;
  } catch (e) { return []; }
}

let data = { pkg, url, ok: false, error: '' };
if (isPkg && puppeteer && puppeteer.launch) {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: 'new',
      args: ['--no-sandbox', '--lang=ru-RU', '--disable-blink-features=AutomationControlled']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8' });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await new Promise(r => setTimeout(r, 2500));
    data = await page.evaluate((pkgArg) => {
      const txt = (document.body && document.body.innerText) || '';
      const meta = (name) => {
        const m = document.querySelector('meta[name="' + name + '"]') || document.querySelector('meta[property="' + name + '"]');
        return m ? (m.getAttribute('content') || '') : '';
      };
      const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
      const firstText = (sel) => { const e = document.querySelector(sel); return e ? clean(e.textContent) : ''; };
      const rating = (txt.match(/([0-5][.,]\d)\s*(?:звезд|звёзд|star)/i) || [])[1] || '';
      const reviews = (txt.match(/([\d\s.,]+)\s*(?:отзыв|reviews?)/i) || [])[1] || '';
      const installs = (txt.match(/([\d\s.,]+\s*(?:тыс\.|млн|млрд|K|M|B)?\+?)\s*(?:Загрузки|загрузок|Downloads)/i) || [])[1] || '';
      const shots = Array.from(document.querySelectorAll('img'))
        .map(i => i.src || '')
        .filter(s => s.includes('googleusercontent.com'))
        .filter((s, i, a) => a.indexOf(s) === i)
        .slice(0, 10);
      const similar = Array.from(document.querySelectorAll('a[href*="/store/apps/details?id="]'))
        .map(a => a.getAttribute('href') || '')
        .map(h => { try { return new URL('https://play.google.com' + h).searchParams.get('id'); } catch (e) { return ''; } })
        .filter(id => id && id !== pkgArg)
        .filter((id, i, a) => a.indexOf(id) === i)
        .slice(0, 12);
      const aboutIdx = txt.indexOf('Об этой игре');
      const about = aboutIdx >= 0 ? clean(txt.slice(aboutIdx + 12, aboutIdx + 1200)) : '';
      return {
        pkg: pkgArg, url: location.href, ok: true, error: '',
        title: firstText('h1') || clean(document.title).replace(/\s*[-–—].*$/, ''),
        developer: firstText('a[href*="/store/apps/dev?id="]'),
        rating: clean(rating), reviews: clean(reviews), installs: clean(installs),
        genre: firstText('a[href*="/store/apps/category/"]') || firstText('a[href*="/store/apps/collection/"]'),
        description: clean(meta('description')),
        about: about, screenshots: shots, similar: similar,
        textLen: txt.length, fetchedAt: new Date().toISOString()
      };
    }, pkg);
  } catch (e) {
    data.error = String(e && e.message ? e.message : e);
  } finally {
    if (browser) { try { await browser.close(); } catch (e) {} }
  }
}

// Play закрыт → ищем в Bing по package id и по названию, если оно уже известно.
let bing = [];
if (!data.ok) {
  bing = await bingSearch(bingQuery);
  if (!bing.length && data.title) bing = await bingSearch('"' + data.title + '" Google Play');
}

if (!data.ok && !bing.length) {
  console.log('FAIL: ' + (data.error || 'Play недоступен') + ' и Bing ничего не вернул.');
  console.log('Fallback: pipeline/browse.mjs с видимым Chrome (человек проходит капчу) или web-research вручную.');
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
const base = 'play-' + pkg.replace(/[^a-z0-9._-]/gi, '-');
if (data.ok) {
  fs.writeFileSync(path.join(outDir, base + '.json'), JSON.stringify(data, null, 2));
}
const md = [
  '# PLAY-SCOUT: ' + (data.title || pkg),
  '',
  '- package: `' + (isPkg ? pkg : '—') + '`',
  '- Play URL: ' + url,
  '- Снимок: ' + new Date().toISOString(),
  '- Источник: ' + (data.ok ? 'Play (страница)' : 'Bing-сниппеты (Play недоступен в сети)'),
  ''
];
if (data.ok) {
  md.push(
    '- Рейтинг: ' + (data.rating || 'не найдено') + (data.reviews ? ' (' + data.reviews + ' отзывов)' : ''),
    '- Установки: ' + (data.installs || 'не найдено'),
    '- Жанр: ' + (data.genre || 'не найдено'),
    '- Разработчик: ' + (data.developer || 'не найдено'),
    '',
    '## Описание из meta',
    data.description || '—',
    '',
    '## Об этой игре (выжимка)',
    data.about || '—',
    '',
    '## Скриншоты',
    ...(data.screenshots.length ? data.screenshots.map((s, i) => (i + 1) + '. ' + s) : ['—']),
    '',
    '## Похожие',
    ...(data.similar.length ? data.similar.map(s => '- `' + s + '`') : ['—'])
  );
} else {
  md.push(
    '> Play отдал ошибку: ' + (data.error || 'недоступен') + '. Ниже — сниппеты Bing. **Цифры не подтверждены**, пока не открыта страница/обзор.',
    '',
    '## Bing',
    ...bing.map((b, i) => (i + 1) + '. [' + b.title + '](' + b.url + ')\n   ' + b.snippet)
  );
}
md.push('', '> Числа — снимок на дату. Перед решением сверь с чартом и отзывами; пустые поля не выдумывай.');
fs.writeFileSync(path.join(outDir, base + '.md'), md.join('\n'));
console.log(path.join(outDir, base + '.md'));
console.log(JSON.stringify({
  source: data.ok ? 'play' : 'bing', title: data.title || '', rating: data.rating || '',
  installs: data.installs || '', shots: data.screenshots ? data.screenshots.length : 0,
  similar: data.similar ? data.similar.length : 0, bing: bing.length
}));
