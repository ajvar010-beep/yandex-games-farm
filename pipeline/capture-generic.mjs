// pipeline/capture-generic.mjs — универсальная съёмка медиа по games/<slug>/capture.json.
// Запуск: node capture-generic.mjs ../games/<slug> ../packages/<slug>/media [ru,en]
//
// capture.json:
// {
//   "variant": 101,
//   "landscape": [ { "name": "level_early", "q": "scene=play&wave=1&freeze=1", "expect": {"scene":"play","mode":"running"} } ],
//   "portrait":  [ ... ],            // по умолчанию первые 3 landscape
//   "qa":        [ {"name":"menu","q":"scene=menu&freeze=1","expect":{"scene":"menu"}} ],
//   "video":     { "q": "autoplay=1&record=26&wave=5&seed=31", "seconds": 26 }
// }
// Кадры берутся из canvas через render+toDataURL (в headless page.screenshot иногда
// отдаёт предыдущий кадр), PNG сплющиваются в RGB — этого требует pack.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const [gameDir, outDir, langsArg] = process.argv.slice(2);
if (!gameDir || !outDir) { console.log('usage: node capture-generic.mjs <gameDir> <outDir> [ru,en]'); process.exit(1); }
const langs = (langsArg || 'ru,en').split(',');
const gameUrl = 'file:///' + path.resolve(gameDir).split(path.sep).join('/') + '/index.html';
const cfgPath = path.join(path.resolve(gameDir), 'capture.json');
if (!fs.existsSync(cfgPath)) { console.log('FAIL: нет ' + cfgPath); process.exit(1); }
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const landscape = cfg.landscape || [];
const portrait = cfg.portrait || landscape.slice(0, 3);
const qa = cfg.qa || [];
if (!landscape.length) { console.log('FAIL: capture.json без landscape'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });

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
  for (const k of Object.keys(expect)) {
    if (st[k] !== expect[k]) throw new Error(`state mismatch [${label}]: ${k}=${st[k]}, expected ${expect[k]} (${JSON.stringify(st)})`);
  }
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
async function shoot(q, file, w, h, expect, label) {
  const { ctx, page } = await freshPage();
  try {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.goto(`${gameUrl}?${q}&lang=${label.split('/')[1] || 'ru'}&mute=1`, { waitUntil: 'load' });
    await page.waitForFunction('window.__capture && window.__capture.ready === true', { timeout: 15000 });
    await assertState(page, expect, label);
    await new Promise(r => setTimeout(r, 650));
    fs.writeFileSync(file, await canvasPng(page));
    flattenPng(file);
    await gate(page);
    console.log('shot', path.basename(file));
  } finally { await ctx.close(); }
}

for (const lang of langs) {
  for (const s of landscape) {
    await shoot(s.q, path.join(outDir, `screenshot_landscape_${s.name}_${lang}.png`), 1280, 720, s.expect, `${s.name}/${lang}/landscape`);
  }
  for (const s of portrait) {
    await shoot(s.q, path.join(outDir, `screenshot_portrait_${s.name}_${lang}.png`), 720, 1280, s.expect, `${s.name}/${lang}/portrait`);
  }
  for (const s of qa) {
    await shoot(s.q, path.join(outDir, `qa_${s.name}_${lang}.png`), 1280, 720, s.expect, `${s.name}/${lang}/qa`);
  }
}

// видео: autopilot + record
const vcfg = cfg.video || { q: 'autoplay=1&record=26&seed=31', seconds: 26 };
const vsec = Math.max(10, Math.min(26, vcfg.seconds || 26));
for (const lang of langs) {
  const { ctx, page } = await freshPage();
  try {
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    let vq = vcfg.q;
    if (!/record=/.test(vq)) vq += '&record=' + vsec;
    await page.goto(`${gameUrl}?${vq}&lang=${lang}&mute=1`, { waitUntil: 'load' });
    await page.waitForFunction('window.__capture && window.__capture.ready === true', { timeout: 15000 });
    await page.waitForFunction('window.__capture && window.__capture.video', { timeout: 120000 });
    const v = await page.evaluate('window.__capture.video');
    const webm = path.join(outDir, `gameplay_landscape.${lang}.webm`);
    fs.writeFileSync(webm, Buffer.from(v.base64, 'base64'));
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-t', String(vsec), '-r', '30', path.join(outDir, `gameplay_landscape.${lang}.mp4`)]);
    fs.unlinkSync(webm);
    await gate(page);
    console.log('video', `gameplay_landscape.${lang}.mp4`);
  } finally { await ctx.close(); }
}

// промо: icon 512 + covers 800×470
const variant = (cfg.variant | 0) || 101;
const promoUrl = 'file:///' + path.resolve(__dirname, 'promo.html').split(path.sep).join('/');
const rootRel = path.relative(__dirname, path.resolve(gameDir)).split(path.sep).join('/');
async function promoShot(query, file) {
  const { ctx, page } = await freshPage();
  try {
    await page.goto(`${promoUrl}?root=${encodeURIComponent(rootRel)}&variant=${variant}&${query}`, { waitUntil: 'load' });
    await page.waitForFunction('window.__promo && window.__promo.ready === true', { timeout: 15000 });
    const promo = await page.evaluate('window.__promo');
    const dataUrl = query.indexOf('what=icon') >= 0 ? promo.iconPng : promo.coverPng;
    if (!dataUrl || dataUrl === 'data:') throw new Error('empty promo data: ' + (promo.error || '?'));
    fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
    flattenPng(file);
    await gate(page);
    console.log('promo', path.basename(file));
  } finally { await ctx.close(); }
}
await promoShot('what=icon', path.join(outDir, 'icon.png'));
for (const lang of langs) await promoShot(`what=cover&lang=${lang}`, path.join(outDir, `cover.${lang}.png`));

await browser.close();
console.log('done');
