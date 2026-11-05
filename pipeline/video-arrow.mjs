// pipeline/video-arrow.mjs — доснять только gameplay-видео и промо для arrowescape.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FFMPEG = process.env.FFMPEG_PATH || 'C:/Users/Администратор/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.2-full_build/bin/ffmpeg';
const [gameDir, outDir, langsArg] = process.argv.slice(2);
const langs = (langsArg || 'ru,en').split(',');
const gameUrl = 'file:///' + path.resolve(gameDir).replace(/\\/g, '/') + '/index.html';
fs.mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--mute-audio', '--hide-scrollbars'] });
function watchConsole(page) {
  page.errors = [];
  page.on('pageerror', e => page.errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() !== 'error') return; page.errors.push('console.error: ' + m.text()); });
  page.on('requestfailed', r => page.errors.push('requestfailed: ' + r.url()));
}
async function gate(page) { if (page.errors.length) throw new Error('console gate failed: ' + page.errors.join(' | ')); }

for (const lang of langs) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage(); watchConsole(page);
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
    console.log('video', lang);
  } finally { await ctx.close(); }
}

const VARIANT = 21;
const promoUrl = 'file:///' + path.resolve(__dirname, 'promo.html').replace(/\\/g, '/');
const rootRel = path.relative(__dirname, path.resolve(gameDir)).replace(/\\/g, '/');
async function promoShot(query, file) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage(); watchConsole(page);
  try {
    await page.goto(`${promoUrl}?root=${encodeURIComponent(rootRel)}&variant=${VARIANT}&${query}`, { waitUntil: 'load' });
    await page.waitForFunction('window.__promo && window.__promo.ready === true', { timeout: 15000 });
    const promo = await page.evaluate('window.__promo');
    const dataUrl = query.indexOf('what=icon') >= 0 ? promo.iconPng : promo.coverPng;
    if (!dataUrl || dataUrl === 'data:') throw new Error('empty promo: ' + (promo.error || '?'));
    fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
    await gate(page);
    console.log('promo', path.basename(file));
  } finally { await ctx.close(); }
}
await promoShot('what=icon', path.join(outDir, 'icon.png'));
for (const lang of langs) await promoShot(`what=cover&lang=${lang}`, path.join(outDir, `cover.${lang}.png`));
await browser.close();
console.log('done');
