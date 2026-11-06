// pipeline/capture-parkingescape.mjs — съёмка медиа «Побег с Парковки» для консоли.
// Запуск: node pipeline/capture-parkingescape.mjs ../games/parkingescape ../packages/parkingescape/media [ru,en]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FFMPEG = process.env.FFMPEG_PATH || 'C:/Users/Администратор/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.2-full_build/bin/ffmpeg';
const [gameDir, outDir, langsArg] = process.argv.slice(2);
if (!gameDir || !outDir) { console.log('usage: node capture-parkingescape.mjs <gameDir> <outDir> [ru,en]'); process.exit(1); }
const langs = (langsArg || 'ru,en').split(',');
const gameUrl = 'file:///' + path.resolve(gameDir).replace(/\\/g, '/') + '/index.html';
fs.mkdirSync(outDir, { recursive: true });

const GAMEPLAY_SHOTS = [
  { name: 'board_early', q: 'scene=play&seed=7&wave=2&freeze=1',   expect: { scene: 'play', mode: 'running' } },
  { name: 'chain_mid',   q: 'scene=play&seed=23&wave=9&t=2&freeze=1',  expect: { scene: 'play', mode: 'running' } },
  { name: 'chain_late',  q: 'scene=play&seed=42&wave=18&t=2&freeze=1', expect: { scene: 'play', mode: 'running' } },
  { name: 'expert',      q: 'scene=play&seed=5&wave=27&t=2&freeze=1',  expect: { scene: 'play', mode: 'running' } }
];
const QA_SHOTS = [
  { name: 'menu',     q: 'scene=menu&freeze=1',                    expect: { scene: 'menu' } },
  { name: 'win',      q: 'scene=play&seed=11&wave=4&mode=win&freeze=1',  expect: { scene: 'play', mode: 'win' } },
  { name: 'gameover', q: 'scene=play&seed=9&wave=6&mode=over&freeze=1',  expect: { scene: 'play', mode: 'over' } }
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
async function freshPage() { const ctx = await browser.createBrowserContext(); const page = await ctx.newPage(); watchConsole(page); return { ctx, page }; }
async function assertState(page, expect, label) {
  if (!expect) return;
  const st = await page.evaluate('window.__capture.getState()');
  for (const k of Object.keys(expect)) if (st[k] !== expect[k]) throw new Error(`state mismatch [${label}]: ${k}=${st[k]}, expected ${expect[k]} (${JSON.stringify(st)})`);
}
async function shoot(url, file, w, h, expect, label) {
  const { ctx, page } = await freshPage();
  try {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction('window.__capture && window.__capture.ready === true', { timeout: 15000 });
    await assertState(page, expect, label);
    await page.evaluate('window.__capture.renderOnce()');
    await new Promise(r => setTimeout(r, 250));
    await page.evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
    await page.screenshot({ path: file });
    await gate(page);
    console.log('shot', path.basename(file));
  } finally { await ctx.close(); }
}

for (const lang of langs) {
  for (const s of GAMEPLAY_SHOTS) await shoot(`${gameUrl}?${s.q}&lang=${lang}&mute=1`, path.join(outDir, `screenshot_landscape_${s.name}_${lang}.png`), 1280, 720, s.expect, `${s.name}/${lang}/landscape`);
  for (const s of GAMEPLAY_PORTRAIT) await shoot(`${gameUrl}?${s.q}&lang=${lang}&mute=1`, path.join(outDir, `screenshot_portrait_${s.name}_${lang}.png`), 720, 1280, s.expect, `${s.name}/${lang}/portrait`);
  for (const s of QA_SHOTS) await shoot(`${gameUrl}?${s.q}&lang=${lang}&mute=1`, path.join(outDir, `qa_${s.name}_${lang}.png`), 1280, 720, s.expect, `${s.name}/${lang}/qa`);
}

// видео: autopilot, record=26с wall-clock
for (const lang of langs) {
  const { ctx, page } = await freshPage();
  try {
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    await page.goto(`${gameUrl}?autoplay=1&record=26&seed=31&lang=${lang}&mute=1`, { waitUntil: 'load' });
    await page.waitForFunction('window.__capture && window.__capture.ready === true', { timeout: 15000 });
    await page.waitForFunction('window.__capture && window.__capture.video', { timeout: 90000 });
    const v = await page.evaluate('window.__capture.video');
    const webm = path.join(outDir, `gameplay_landscape.${lang}.webm`);
    fs.writeFileSync(webm, Buffer.from(v.base64, 'base64'));
    execFileSync(FFMPEG, ['-y', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-t', '26', '-r', '30', path.join(outDir, `gameplay_landscape.${lang}.mp4`)]);
    fs.unlinkSync(webm);
    await gate(page);
    console.log('video', `gameplay_landscape.${lang}.mp4`);
  } finally { await ctx.close(); }
}

// промо: icon + cover
const VARIANT = 31;
const promoUrl = 'file:///' + path.resolve(__dirname, 'promo.html').replace(/\\/g, '/');
const rootRel = path.relative(__dirname, path.resolve(gameDir)).replace(/\\/g, '/');
async function promoShot(query, file) {
  const { ctx, page } = await freshPage();
  try {
    await page.goto(`${promoUrl}?root=${encodeURIComponent(rootRel)}&variant=${VARIANT}&${query}`, { waitUntil: 'load' });
    await page.waitForFunction('window.__promo && window.__promo.ready === true', { timeout: 15000 });
    const promo = await page.evaluate('window.__promo');
    const dataUrl = query.indexOf('what=icon') >= 0 ? promo.iconPng : promo.coverPng;
    if (!dataUrl || dataUrl === 'data:') throw new Error('empty promo data: ' + (promo.error || '?'));
    fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
    await gate(page);
    console.log('promo', path.basename(file));
  } finally { await ctx.close(); }
}
await promoShot('what=icon', path.join(outDir, 'icon.png'));
for (const lang of langs) await promoShot(`what=cover&lang=${lang}`, path.join(outDir, `cover.${lang}.png`));

await browser.close();
console.log('done');
