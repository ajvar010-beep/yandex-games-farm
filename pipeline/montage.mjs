// pipeline/montage.mjs — смонтированное gameplay-видео (≤28 с) для консоли.
// Запуск: node pipeline/montage.mjs <gameDir> <outDir> <lang>
//
// Структура ролика (~27.8 с, 30 fps, 1280x720, yuv420p):
//   [карточка cover 2.2с] → [ранняя игра 6с] → [средняя 6с] → [поздний хаос 6с]
//   → [магазин 6с] → [финал: иконка 2.6с], кроссфейды 0.4с между блоками.
// Каждый игровой сегмент — отдельная autopilot+record запись (record-safe в движке),
// свежая страница на сегмент. Браузер пользователя не трогаем (headless).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [gameDir, outDir, lang = 'ru'] = process.argv.slice(2);
if (!gameDir || !outDir) { console.log('usage: node montage.mjs <gameDir> <outDir> [lang]'); process.exit(1); }
const gameUrl = 'file:///' + path.resolve(gameDir).replace(/\\/g, '/') + '/index.html';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'montage-'));

const FADE = 0.4, FPS = 30, W = 1280, H = 720;
// сегменты: q — capture-параметры, sim — секунды autopilot до нужного состояния,
// dur — длина сегмента в монтаже. Запись идёт record=sim+dur (движок считает
// update-тики 60/с wall-clock, поэтому запись ровно покрывает прогон+сегмент).
const SEGS = [
  { name: 'early', q: 'seed=11&wave=2',  dur: 6 },
  { name: 'mid',   q: 'seed=23&wave=6',  dur: 6 },
  { name: 'late',  q: 'seed=42&wave=10', dur: 6 },
  { name: 'shop',  q: 'seed=23&wave=6',  dur: 6, shop: true }
];

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--mute-audio', '--hide-scrollbars']
});

function watchConsole(page) {
  page.errors = [];
  page.on('pageerror', e => page.errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') page.errors.push('console.error: ' + m.text()); });
  page.on('requestfailed', r => page.errors.push('requestfailed: ' + r.url()));
}

async function recordSegment(seg, i) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  watchConsole(page);
  try {
    await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
    await page.goto(`${gameUrl}?autoplay=1&record=${seg.dur}&${seg.q}&lang=${lang}&mute=1`, { waitUntil: 'load' });
    await page.waitForFunction('window.__capture && window.__capture.ready === true', { timeout: 15000 });
    if (seg.shop) await page.evaluate(`window.__capture.setState({ mode: 'shop' })`);
    await page.waitForFunction('window.__capture && window.__capture.video', { timeout: 90000 });
    const v = await page.evaluate('window.__capture.video');
    const file = path.join(tmp, `seg${i}.webm`);
    fs.writeFileSync(file, Buffer.from(v.base64, 'base64'));
    if (page.errors.length) throw new Error(`console gate [${seg.name}]: ` + page.errors.join(' | '));
    console.log('segment', seg.name);
    return file;
  } finally {
    await ctx.close();
  }
}

const segFiles = [];
for (let i = 0; i < SEGS.length; i++) segFiles.push(await recordSegment(SEGS[i], i));
await browser.close();

const cover = path.join(outDir, `cover.${lang}.png`);
const icon = path.join(outDir, 'icon.png');
if (!fs.existsSync(cover) || !fs.existsSync(icon)) throw new Error('need cover/icon in outDir — run capture first');

// конвертируем сегменты в унифицированные mp4 чанки (запись ровно dur, обрезка не нужна)
const chunks = [];
for (let i = 0; i < segFiles.length; i++) {
  const out = path.join(tmp, `c${i}.mp4`);
  execFileSync('ffmpeg', ['-y', '-i', segFiles[i], '-vf',
    `scale=${W}:${H},fps=${FPS}`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', out], { stdio: 'pipe' });
  chunks.push(out);
}
// карточки из статичных картинок
function card(img, dur, out, zoom) {
  const vf = zoom === 'in'
    ? `scale=${W * 4}:${H * 4},zoompan=z='min(zoom+0.0009,1.15)':d=${Math.round(dur * FPS)}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS}`
    : `scale=${W}:${H},fps=${FPS}`;
  execFileSync('ffmpeg', ['-y', '-loop', '1', '-i', img, '-t', String(dur), '-vf', vf,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', out], { stdio: 'pipe' });
  return out;
}
const cCover = card(cover, 2.2, path.join(tmp, 'cover.mp4'), 'in');
const cIcon = card(icon, 2.6, path.join(tmp, 'icon.mp4'), 'in');

// склейка с кроссфейдами: cover + 4 чанка + icon.
// offsets — из РЕАЛЬНЫХ длительностей частей (ffprobe), не из заявленных.
const parts = [cCover, ...chunks, cIcon];
function probeDur(f) {
  return parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=nw=1:nk=1', f]).toString().trim());
}
const durs = parts.map(probeDur);
let filter = '';
let prev = '[0:v]', acc = durs[0];
for (let i = 1; i < parts.length; i++) {
  const off = Math.max(0, acc - FADE).toFixed(3);
  const lbl = `[x${i}]`;
  filter += `${prev}[${i}:v]xfade=transition=fade:duration=${FADE}:offset=${off}${lbl};`;
  prev = lbl;
  acc += durs[i] - FADE;
}
filter = filter.slice(0, -1);
const inputs = [];
for (const p of parts) inputs.push('-i', p);
const outMp4 = path.join(outDir, `gameplay_landscape.${lang}.mp4`);
execFileSync('ffmpeg', ['-y', ...inputs, '-filter_complex', filter, '-map', `[x${parts.length - 1}]`,
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-r', String(FPS), '-t', '28', outMp4], { stdio: 'pipe' });

fs.rmSync(tmp, { recursive: true, force: true });
console.log('montage', path.basename(outMp4));
