// pipeline/capture-pizzaspin.mjs — съёмка медиа «Рыжего Побега» для консоли.
// Запуск: node pipeline/capture-pizzaspin.mjs ../games/pizzaspin ../packages/pizzaspin/media [ru,en]
//
// Контракт: wave=N -> УРОВЕНЬ игры, t=SEC -> autopilot-прогон,
//   mode=shop -> кондитерская, mode=over -> победа, mode=dead -> конец игры.
// Белый список, freeze, record-safe, fresh incognito на артефакт — как у чемпиона.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [gameDir, outDir, langsArg] = process.argv.slice(2);
if (!gameDir || !outDir) { console.log('usage: node capture-pizzaspin.mjs <gameDir> <outDir> [ru,en]'); process.exit(1); }
const langs = (langsArg || 'ru,en').split(',');
const gameUrl = 'file:///' + path.resolve(gameDir).replace(/\\/g, '/') + '/index.html';
fs.mkdirSync(outDir, { recursive: true });

const GAMEPLAY_SHOTS = [
  { name: 'catch_early',  q: 'scene=play&seed=11&wave=2&t=6&freeze=1',  expect: { scene: 'play', mode: 'running' } },
  { name: 'catch_mid',    q: 'scene=play&seed=23&wave=5&t=9&freeze=1',  expect: { scene: 'play', mode: 'running' } },
  { name: 'catch_late',   q: 'scene=play&seed=42&wave=8&t=7&freeze=1',  expect: { scene: 'play', mode: 'running' } },
  { name: 'catch_expert', q: 'scene=play&seed=5&wave=11&t=8&freeze=1',  expect: { scene: 'play', mode: 'running' } }
];
const QA_SHOTS = [
  { name: 'menu',     q: 'scene=menu&freeze=1',                                   expect: { scene: 'menu' } },
  { name: 'shop',     q: 'scene=play&seed=23&wave=5&t=30&mode=shop&freeze=1',     expect: { scene: 'play', mode: 'shop' } },
  { name: 'gameover', q: 'scene=play&seed=9&wave=4&mode=dead&score=6&freeze=1',   expect: { scene: 'play', mode: 'dead' } }
];
const GAMEPLAY_PORTRAIT = GAMEPLAY_SHOTS.slice(0, 3);

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--mute-audio', '--hide-scrollbars']
});

function watchConsole(page) {
  page.errors = [];
  page.on('pageerror', e => page.errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() !== 'error') return; page.errors.push('console.error: ' + m.text()); });
  page.on('requestfailed', r => page.errors.push('requestfailed: ' + r.url()));
}
async function gate(page) {
  if (page.errors.length) throw new Error('console gate failed: ' + page.errors.join(' | '));
}
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
    if (st[k] !== expect[k])
      throw new Error(`state mismatch [${label}]: ${k}=${st[k]}, expected ${expect[k]} (full: ${JSON.stringify(st)})`);
  }
}
async function shoot(url, file, w, h, expect, label) {
  const { ctx, page } = await freshPage();
  try {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction('window.__capture && window.__capture.ready === true', { timeout: 15000 });
    await assertState(page, expect, label);
    await page.evaluate('window.__capture.renderOnce()');
    await new Promise(r => setTimeout(r, 300));
    await page.evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
    await page.screenshot({ path: file });
    await gate(page);
    console.log('shot', path.basename(file));
  } finally {
    await ctx.close();
  }
}

for (const lang of langs) {
  for (const s of GAMEPLAY_SHOTS) {
    await shoot(`${gameUrl}?${s.q}&lang=${lang}&mute=1`,
      path.join(outDir, `screenshot_landscape_${s.name}_${lang}.png`), 1280, 720,
      s.expect, `${s.name}/${lang}/landscape`);
  }
  for (const s of GAMEPLAY_PORTRAIT) {
    await shoot(`${gameUrl}?${s.q}&lang=${lang}&mute=1`,
      path.join(outDir, `screenshot_portrait_${s.name}_${lang}.png`), 720, 1280,
      s.expect, `${s.name}/${lang}/portrait`);
  }
  for (const s of QA_SHOTS) {
    await shoot(`${gameUrl}?${s.q}&lang=${lang}&mute=1`,
      path.join(outDir, `qa_${s.name}_${lang}.png`), 1280, 720,
      s.expect, `${s.name}/${lang}/qa`);
  }
}

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

const VARIANT = 17; // <-- конвейер: свой seed на каждую игру
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
await promoShot('what=icon', path.join(outDir, 'icon.png'));
for (const lang of langs) {
  await promoShot(`what=cover&lang=${lang}`, path.join(outDir, `cover.${lang}.png`));
}
await browser.close();
console.log('done');
