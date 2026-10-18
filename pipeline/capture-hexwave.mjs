// pipeline/capture.mjs — съёмка медиа для консоли Яндекс Игр через capture-хуки движка.
// Запуск: node pipeline/capture.mjs ../games/hexwave ../packages/hexwave/media [ru,en]
//
// Ключевые свойства:
// - Каждый артефакт снимается в СВЕЖЕМ incognito-контексте браузера: никакого
//   shared localStorage между кадрами и языками. Скриншот зависит только от URL.
// - После загрузки скрипт сверяет фактический режим игры (__capture.getState)
//   с ожидаемым из GAMEPLAY_SHOTS/QA_SHOTS — если capture-симуляция соскочила
//   (например, волна зачищена раньше t= и открылся магазин), съёмка падает
//   с ошибкой, а не молча сохраняет неправильный кадр.
// - Падает при ЛЮБОМ console.error и при любом провалившемся сетевом запросе:
//   whitelist'ов нет (index.html на file:// не запрашивает /sdk.js вовсе).
// - В сабмишн-глобы screenshot_landscape/portrait_*_*.png попадают ТОЛЬКО кадры
//   реального геймплея (5.1.1.2 ≥70% кадра); не-геймплейные референсы пишутся
//   в qa_*.png, которые под сабмишн-маску не подходят.
// - Иконка 512×512 и обложка 800×470 рисуются промо-рендерером pipeline/promo.html
//   из палитры и словаря САМОЙ игры (5.6: не скриншоты), VARIANT уникален на игру (5.1.1.1).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [gameDir, outDir, langsArg] = process.argv.slice(2);
if (!gameDir || !outDir) { console.log('usage: node capture.mjs <gameDir> <outDir> [ru,en]'); process.exit(1); }
const langs = (langsArg || 'ru,en').split(',');
const gameUrl = 'file:///' + path.resolve(gameDir).replace(/\\/g, '/') + '/index.html';
fs.mkdirSync(outDir, { recursive: true });

// Детерминированные состояния: seed + wave + t (симуляция autopilot'ом) + freeze.
// expect — обязательная проверка режима после загрузки (снимок без неё запрещён).
//
// ВАЖНО (5.1.1.2): в сабмишн-глобы `screenshot_landscape_*_*.png` и
// `screenshot_portrait_*_*.png` кладём ТОЛЬКО кадры РЕАЛЬНОГО геймплея (mode=running,
// живой бой). Всё, что не является активным геймплеем (меню, магазин-оверлей, экран
// game-over), пишется в файлы `qa_*_<lang>.png` — они НЕ совпадают с сабмишн-глобом,
// поэтому «залить всё по маске» физически не может отправить не-геймплейный кадр в консоль.
// GAMEPLAY_SHOTS идут в сабмишн; QA_SHOTS — справочные кадры для оператора/ревью.
const GAMEPLAY_SHOTS = [
  { name: 'combat_wave2',  q: 'scene=play&seed=11&wave=2&t=6&freeze=1',            expect: { scene: 'play', mode: 'running' } },
  { name: 'combat_wave5',  q: 'scene=play&seed=23&wave=5&t=9&freeze=1',            expect: { scene: 'play', mode: 'running' } },
  { name: 'combat_wave8',  q: 'scene=play&seed=42&wave=8&t=7&freeze=1',            expect: { scene: 'play', mode: 'running' } },
  { name: 'boss_wave10',   q: 'scene=play&seed=5&wave=10&t=5&freeze=1',            expect: { scene: 'play', mode: 'running' } }
];
const QA_SHOTS = [
  // freeze=1 обязателен и для меню: без него MenuScene.t анимируется (вращение колец,
  // мерцание звёзд) и кадр «плывёт» от запуска к запуску. manual-режим глушит update,
  // this.t остаётся 0 — кадр детерминирован.
  { name: 'menu',       q: 'scene=menu&freeze=1',                                     expect: { scene: 'menu' } },
  { name: 'shop',       q: 'scene=play&seed=23&wave=4&t=40&mode=shop&freeze=1',       expect: { scene: 'play', mode: 'shop' } },
  { name: 'gameover',   q: 'scene=play&seed=9&wave=3&mode=over&score=1240&freeze=1',  expect: { scene: 'play', mode: 'over' } }
];
// Портретные сабмишн-слоты — тоже только реальный геймплей (маска portrait_*_* глобальная).
const GAMEPLAY_PORTRAIT = GAMEPLAY_SHOTS.slice(0, 3);

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--mute-audio', '--hide-scrollbars']
});

function watchConsole(page) {
  page.errors = [];
  page.on('pageerror', e => page.errors.push('pageerror: ' + e.message));
  // НУЛЕВАЯ терпимость к console.error. index.html на file:// не запрашивает /sdk.js
  // вовсе (document.write только на не-локальных протоколах), поэтому whitelist не нужен:
  // любой error роняет съёмку — это и есть проверка требования 6.4 в CI фабрики.
  page.on('console', m => {
    if (m.type() !== 'error') return;
    page.errors.push('console.error: ' + m.text());
  });
  // Заодно ловим сетевые сбои ресурсов (не должно быть НИ ОДНОГО запроса наружу, 1.7).
  page.on('requestfailed', r => page.errors.push('requestfailed: ' + r.url()));
}
async function gate(page) {
  if (page.errors.length) throw new Error('console gate failed: ' + page.errors.join(' | '));
}

// Каждый снимок — свой incognito-контекст: чистый localStorage, никаких
// протечек best/run/tutorialSeen между артефактами и языками.
async function freshPage() {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  watchConsole(page);
  return { ctx, page };
}

async function assertState(page, expect, label) {
  if (!expect) return;
  const st = await page.evaluate('window.__capture.getState()');
  for (const k of Object.keys(expect)) {
    if (st[k] !== expect[k]) {
      throw new Error(`state mismatch [${label}]: ${k}=${st[k]}, expected ${expect[k]} (full: ${JSON.stringify(st)})`);
    }
  }
}

async function shoot(url, file, w, h, expect, label) {
  const { ctx, page } = await freshPage();
  try {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction('window.__capture && window.__capture.ready === true', { timeout: 15000 });
    await assertState(page, expect, label);
    // freeze/manual: render уже сделан markReady, но вызовем renderOnce + дождёмся двух RAF —
    // гарантирует, что последний кадр попал в compositor перед снимком
    await page.evaluate('window.__capture.renderOnce()');
    await new Promise(r => setTimeout(r, 300));
    await page.evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
    await page.screenshot({ path: file });
    await gate(page);
    console.log('shot', path.basename(file));
  } finally {
    await ctx.close(); // контекст умирает вместе со своим localStorage
  }
}

for (const lang of langs) {
  // САБМИШН: только реальный геймплей, только файлы под глобом screenshot_landscape_*_*.png
  for (const s of GAMEPLAY_SHOTS) {
    await shoot(`${gameUrl}?${s.q}&lang=${lang}&mute=1`,
      path.join(outDir, `screenshot_landscape_${s.name}_${lang}.png`), 1280, 720,
      s.expect, `${s.name}/${lang}/landscape`);
  }
  for (const s of GAMEPLAY_PORTRAIT) { // мобильные портретные слоты — тоже только геймплей
    await shoot(`${gameUrl}?${s.q}&lang=${lang}&mute=1`,
      path.join(outDir, `screenshot_portrait_${s.name}_${lang}.png`), 720, 1280,
      s.expect, `${s.name}/${lang}/portrait`);
  }
  // QA-референсы (меню/магазин/гейм-овер): НЕ совпадают с сабмишн-глобом по имени.
  // Это служебные кадры для ревью раскладки/текстов — в консоль по маске не попадают.
  for (const s of QA_SHOTS) {
    await shoot(`${gameUrl}?${s.q}&lang=${lang}&mute=1`,
      path.join(outDir, `qa_${s.name}_${lang}.png`), 1280, 720,
      s.expect, `${s.name}/${lang}/qa`);
  }
}

// Видео: autopilot играет сам; record-режим core привязывает игровое время к wall-clock,
// поэтому ровно 28 реальных секунд записываются на любом мониторе (60/90/120 Гц).
// Record-safe режим: ядро неуязвимо, сложность ограничена — клип на ≥95% живой геймплей.
// НЕ использовать --virtual-time-budget: видео пишется в реальном времени.
for (const lang of langs) {
  const { ctx, page } = await freshPage();
  try {
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    await page.goto(`${gameUrl}?autoplay=1&record=28&seed=31&lang=${lang}&mute=1`, { waitUntil: 'load' });
    await page.waitForFunction('window.__capture && window.__capture.ready === true', { timeout: 15000 });
    await page.waitForFunction('window.__capture && window.__capture.video', { timeout: 90000 });
    const v = await page.evaluate('window.__capture.video');
    const webm = path.join(outDir, `gameplay_landscape.${lang}.webm`);
    fs.writeFileSync(webm, Buffer.from(v.base64, 'base64'));
    execFileSync('ffmpeg', ['-y', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
      '-crf', '20', '-t', '28', '-r', '30', path.join(outDir, `gameplay_landscape.${lang}.mp4`)]);
    await gate(page);
    console.log('video', `gameplay_landscape.${lang}.mp4`);
  } finally {
    await ctx.close();
  }
}

// Промо-ассеты (5.6 — НЕ скриншоты): рисует pipeline/promo.html из палитры и словаря
// самой игры. VARIANT — seed композиции, УНИКАЛЬНЫЙ для каждой игры фабрики (5.1.1.1:
// промоматериалы разных игр не одинаковы). Размеры гарантированы размерами canvas
// (ровно 512×512 и 800×470), формат PNG.
const VARIANT = 7; // <-- конвейер: свой seed на каждую игру
const promoUrl = 'file:///' + path.resolve(__dirname, 'promo.html').replace(/\\/g, '/');
const rootRel = path.relative(__dirname, path.resolve(gameDir)).replace(/\\/g, '/');
async function promoShot(query, file) {
  const { ctx, page } = await freshPage();
  try {
    await page.goto(`${promoUrl}?root=${encodeURIComponent(rootRel)}&variant=${VARIANT}&${query}`, { waitUntil: 'load' });
    await page.waitForFunction('window.__promo && window.__promo.ready === true', { timeout: 15000 });
    const promo = await page.evaluate('window.__promo');
    const dataUrl = query.indexOf('what=icon') >= 0 ? promo.iconPng : promo.coverPng;
    fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
    await gate(page);
    console.log('promo', path.basename(file));
  } finally {
    await ctx.close();
  }
}
// иконка без текста — одна на игру
await promoShot('what=icon', path.join(outDir, 'icon.png'));                    // ровно 512×512
// обложка с локализованным названием — на каждый язык
for (const lang of langs) {
  await promoShot(`what=cover&lang=${lang}`, path.join(outDir, `cover.${lang}.png`)); // ровно 800×470
}
await browser.close();
console.log('done');
