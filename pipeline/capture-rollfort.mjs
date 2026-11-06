// pipeline/capture-rollfort.mjs — съёмка медиа «Крепости на Колёсах» для консоли.
// Запуск: node capture-rollfort.mjs ../games/rollfort ../packages/rollfort/media [ru,en]
//
// Кадры снимаются из САМОГО canvas (render + toDataURL): в headless-режиме
// page.screenshot иногда отдаёт предыдущий кадр, и на скриншоте оказывалось
// состояние до применения capture-параметров. toDataURL — ровно то, что нарисовано.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const [gameDir, outDir, langsArg] = process.argv.slice(2);
if (!gameDir || !outDir) { console.log('usage: node capture-rollfort.mjs <gameDir> <outDir> [ru,en]'); process.exit(1); }
const langs = (langsArg || 'ru,en').split(',');
const gameUrl = 'file:///' + path.resolve(gameDir).split(path.sep).join('/') + '/index.html';
fs.mkdirSync(outDir, { recursive: true });

const GAMEPLAY_SHOTS = [
  { name: 'convoy_early', q: 'scene=play&wave=2&t=17&freeze=1', expect: { scene: 'play', mode: 'running' } },
  { name: 'convoy_mid', q: 'scene=play&wave=5&t=19&freeze=1', expect: { scene: 'play', mode: 'running' } },
  { name: 'weapons_late', q: 'scene=play&wave=9&t=19&freeze=1', expect: { scene: 'play', mode: 'running' } },
  { name: 'boss_final', q: 'scene=play&wave=12&mode=boss&t=16&freeze=1', expect: { scene: 'play', mode: 'running' } }
];
const QA_SHOTS = [
  { name: 'menu', q: 'scene=menu&freeze=1', expect: { scene: 'menu' } },
  { name: 'shop', q: 'scene=play&wave=5&mode=shop&freeze=1', expect: { scene: 'play', mode: 'shop' } },
  { name: 'win', q: 'scene=play&wave=4&mode=win&freeze=1', expect: { scene: 'play', mode: 'win' } },
  { name: 'gameover', q: 'scene=play&wave=6&mode=over&freeze=1', expect: { scene: 'play', mode: 'over' } }
];
const GAMEPLAY_PORTRAIT = GAMEPLAY_SHOTS.slice(0, 3);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--mute-audio', '--hide-scrollbars', '--allow-file-access-from-files'] });

function watchConsole(page) {
  page.errors = [];
  page.on('pageerror', e => page.errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() !== 'error') return; page.errors.push('console.error: ' + m.text()); });
  page.on('requestfailed', r => page.errors.push('requestfailed: ' + r.url()));
}
async function gate(page) { if (page.errors.length) throw new Error('console gate failed: ' + page.errors.join(' | ')); }
async function freshPage() { const ctx = await browser.createBrowserContext(); const page = await ctx.newPage(); await page.setCacheEnabled(false); watchConsole(page); return { ctx, page }; }
async function assertState(page, expect, label) {
  if (!expect) return;
  const st = await page.evaluate('window.__capture.getState()');
  for (const k of Object.keys(expect)) if (st[k] !== expect[k]) throw new Error(`state mismatch [${label}]: ${k}=${st[k]}, expected ${expect[k]} (${JSON.stringify(st)})`);
}
function flattenPng(file) {
  const flat = file.replace(/\.png$/, '.rgb.png');
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', file, '-pix_fmt', 'rgb24', '-frames:v', '1', flat]);
  fs.renameSync(flat, file);
}
async function canvasPng(page) {
  const data = await page.evaluate(() => {
    const g = window.Engine.sdk._game;
    g.render();
    return document.getElementById('game').toDataURL('image/png');
  });
  return Buffer.from(data.split(',')[1], 'base64');
}
async function shoot(url, file, w, h, expect, label) {
  const { ctx, page } = await freshPage();
  try {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction('window.__capture && window.__capture.ready === true', { timeout: 15000 });
    await assertState(page, expect, label);
    await new Promise(r => setTimeout(r, 220));
    fs.writeFileSync(file, await canvasPng(page));
    flattenPng(file);
    await gate(page);
    console.log('shot', path.basename(file));
  } finally { await ctx.close(); }
}
async function shootMap(lang) {
  const { ctx, page } = await freshPage();
  try {
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    await page.goto(`${gameUrl}?scene=menu&freeze=1&lang=${lang}&mute=1`, { waitUntil: 'load' });
    await page.waitForFunction('window.__capture && window.__capture.ready === true', { timeout: 15000 });
    await page.evaluate("window.__capture.setScene('map', {})");
    await new Promise(r => setTimeout(r, 200));
    const mf = path.join(outDir, `qa_map_${lang}.png`);
    fs.writeFileSync(mf, await canvasPng(page));
    flattenPng(mf);
    await gate(page);
    console.log('shot', `qa_map_${lang}.png`);
  } finally { await ctx.close(); }
}

for (const lang of langs) {
  for (const s of GAMEPLAY_SHOTS) await shoot(`${gameUrl}?${s.q}&lang=${lang}&mute=1`, path.join(outDir, `screenshot_landscape_${s.name}_${lang}.png`), 1280, 720, s.expect, `${s.name}/${lang}/landscape`);
  for (const s of GAMEPLAY_PORTRAIT) await shoot(`${gameUrl}?${s.q}&lang=${lang}&mute=1`, path.join(outDir, `screenshot_portrait_${s.name}_${lang}.png`), 720, 1280, s.expect, `${s.name}/${lang}/portrait`);
  for (const s of QA_SHOTS) await shoot(`${gameUrl}?${s.q}&lang=${lang}&mute=1`, path.join(outDir, `qa_${s.name}_${lang}.png`), 1280, 720, s.expect, `${s.name}/${lang}/qa`);
  await shootMap(lang);
}

// видео: автопилот, record=26с wall-clock
for (const lang of langs) {
  const { ctx, page } = await freshPage();
  try {
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    await page.goto(`${gameUrl}?autoplay=1&record=26&wave=6&seed=31&lang=${lang}&mute=1`, { waitUntil: 'load' });
    await page.waitForFunction('window.__capture && window.__capture.ready === true', { timeout: 15000 });
    await page.waitForFunction('window.__capture && window.__capture.video', { timeout: 90000 });
    const v = await page.evaluate('window.__capture.video');
    const webm = path.join(outDir, `gameplay_landscape.${lang}.webm`);
    fs.writeFileSync(webm, Buffer.from(v.base64, 'base64'));
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-t', '26', '-r', '30', path.join(outDir, `gameplay_landscape.${lang}.mp4`)]);
    fs.unlinkSync(webm);
    await gate(page);
    console.log('video', `gameplay_landscape.${lang}.mp4`);
  } finally { await ctx.close(); }
}

// промо: иконка 512 и обложки 800×470
const VARIANT = 51;
const promoUrl = 'file:///' + path.resolve(__dirname, 'promo.html').split(path.sep).join('/');
const rootRel = path.relative(__dirname, path.resolve(gameDir)).split(path.sep).join('/');
async function promoShot(query, file) {
  const { ctx, page } = await freshPage();
  try {
    await page.goto(`${promoUrl}?root=${encodeURIComponent(rootRel)}&variant=${VARIANT}&${query}`, { waitUntil: 'load' });
    await page.waitForFunction('window.__promo && window.__promo.ready === true', { timeout: 15000 });
    const promo = await page.evaluate('window.__promo');
    const dataUrl = query.indexOf('what=icon') >= 0 ? promo.iconPng : promo.coverPng;
    if (!dataUrl || dataUrl === 'data:') throw new Error('empty promo data: ' + (promo.error || '?'));
    fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
    const flat = file.replace(/\.png$/, '.rgb.png');
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', file, '-pix_fmt', 'rgb24', '-frames:v', '1', flat]);
    fs.renameSync(flat, file);
    await gate(page);
    console.log('promo', path.basename(file));
  } finally { await ctx.close(); }
}
await promoShot('what=icon', path.join(outDir, 'icon.png'));
for (const lang of langs) await promoShot(`what=cover&lang=${lang}`, path.join(outDir, `cover.${lang}.png`));

await browser.close();
console.log('done');
