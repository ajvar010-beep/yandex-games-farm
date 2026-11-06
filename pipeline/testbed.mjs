// pipeline/testbed.mjs — матрица вёрстки/рантайма для игры фермы.
// Проверяет: консоль, canvas, отсутствие скролла, границы кнопок и поля/стакана
// на 8 вьюпортах × DPR 1/2/3. Скриншоты — scratch/testbed/<game>/.
// Запуск: node testbed.mjs ../games/<slug> [--only=viewport]
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const gameDir = process.argv[2];
if (!gameDir) { console.log('usage: node testbed.mjs ../games/<slug>'); process.exit(2); }
const name = path.basename(path.resolve(gameDir));
const gameUrl = 'file:///' + path.resolve(gameDir, 'index.html').replace(/\\/g, '/');
const outDir = path.resolve(import.meta.dirname, '..', 'scratch', 'testbed', name);
fs.mkdirSync(outDir, { recursive: true });

const VIEWPORTS = [
  [320, 568], [360, 640], [390, 844], [430, 932],
  [720, 1280], [844, 390], [1280, 720], [1920, 1080]
];
const DPRS = [1, 2, 3];
const SCENES = [
  { key: 'menu', q: 'scene=menu&freeze=1' },
  { key: 'play', q: 'scene=play&seed=7&wave=5&freeze=1' }
];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--mute-audio', '--hide-scrollbars'] });
const issues = [];

function rectsOf(scene) {
  const out = [];
  const add = (label, b) => { if (b && isFinite(b.x) && isFinite(b.y) && isFinite(b.w) && isFinite(b.h)) out.push({ label, x: b.x, y: b.y, w: b.w, h: b.h }); };
  (scene.buttons || []).forEach((b, i) => add('button[' + i + ']', b));
  (scene.panelButtons || []).forEach((b, i) => add('panel[' + i + ']', b));
  (scene.boosterButtons || []).forEach((b, i) => add('booster[' + i + ']', b));
  (scene.hudButtons || []).forEach((b, i) => add('hud[' + i + ']', b));
  (scene.endButtons || []).forEach((b, i) => add('end[' + i + ']', b));
  if (scene.levelRects) scene.levelRects.forEach((r, i) => add('levelRect[' + i + ']', r));
  if (scene.pauseBtn) add('pause', scene.pauseBtn);
  return out;
}

for (const [w, h] of VIEWPORTS) {
  for (const dpr of DPRS) {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
    page.on('requestfailed', r => errs.push('requestfailed: ' + r.url()));
    await page.setViewport({ width: w, height: h, deviceScaleFactor: dpr });
    for (const sc of SCENES) {
      errs.length = 0;
      await page.goto(gameUrl + '?' + sc.q + '&lang=ru&mute=1', { waitUntil: 'load' });
      await page.waitForFunction('window.__capture && window.__capture.ready === true', { timeout: 15000 });
      await new Promise(r => setTimeout(r, 120));
      const info = await page.evaluate(() => {
        const g = window.Engine.sdk._game, s = g.scene, c = document.getElementById('game');
        const r = c.getBoundingClientRect();
        return {
          inner: [window.innerWidth, window.innerHeight], dpr: window.devicePixelRatio,
          canvas: [c.width, c.height], rect: [r.x, r.y, r.width, r.height],
          view: [g.view.w, g.view.h], mode: s.mode, hudH: s.hudH, inset: (window.Engine.sdk.bannerInsetPx ? window.Engine.sdk.bannerInsetPx() : 0),
          scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
          fps: g.fps,
          rects: (function () {
            const out = [];
            const add = (label, b) => { if (b && isFinite(b.x) && isFinite(b.y) && isFinite(b.w) && isFinite(b.h)) out.push({ label, x: b.x, y: b.y, w: b.w, h: b.h }); };
            (s.buttons || []).forEach((b, i) => add('button[' + i + ']', b));
            (s.panelButtons || []).forEach((b, i) => add('panel[' + i + ']', b));
            (s.boosterButtons || []).forEach((b, i) => add('booster[' + i + ']', b));
            (s.hudButtons || []).forEach((b, i) => add('hud[' + i + ']', b));
            (s.endButtons || []).forEach((b, i) => add('end[' + i + ']', b));
            if (s.levelRects) s.levelRects.forEach((b, i) => add('levelRect[' + i + ']', b));
            if (s.pauseBtn) add('pause', s.pauseBtn);
            return out;
          })(),
          board: s.boardW != null ? { x: s.bx, y: s.by, w: s.boardW, h: s.boardH } : null,
          cup: s.cup || null
        };
      });
      const tag = `${w}x${h}@${dpr}/${sc.key}`;
      if (errs.length) issues.push(`[${tag}] console: ${errs.join(' | ')}`);
      if (info.inner[0] !== w || info.inner[1] !== h) issues.push(`[${tag}] inner ${info.inner} != ${w}x${h}`);
      const effDpr = Math.min(dpr, 2); // движок осознанно капает DPR на 2
      if (info.canvas[0] !== Math.round(w * effDpr) || info.canvas[1] !== Math.round(h * effDpr)) issues.push(`[${tag}] canvas ${info.canvas} != ${w}x${h}@${effDpr}`);
      if (info.rect[0] !== 0 || info.rect[1] !== 0 || Math.abs(info.rect[2] - w) > 1 || Math.abs(info.rect[3] - h) > 1) issues.push(`[${tag}] canvas rect ${info.rect}`);
      if (info.scroll[0] > w + 1 || info.scroll[1] > h + 1) issues.push(`[${tag}] page scroll ${info.scroll} > ${w}x${h}`);
      const availH = h - (info.inset || 0);
      for (const r of info.rects) {
        if (r.x < -1 || r.y < -1 || r.x + r.w > w + 1 || r.y + r.h > availH + 1) {
          issues.push(`[${tag}] ${r.label} out of bounds (${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.w)},${Math.round(r.h)}) availH=${Math.round(availH)}`);
        }
        if (sc.key === 'play' && (r.label.startsWith('button') || r.label.startsWith('panel'))) {
          // меню-кнопки не должны существовать в play; если есть — это не баг сам по себе
        }
      }
      if (info.board) {
        const b = info.board;
        if (b.x < -1 || b.y < -1 || b.x + b.w > w + 1 || b.y + b.h > availH + 1) issues.push(`[${tag}] board out of bounds ${JSON.stringify(b)}`);
      }
      if (info.cup) {
        const c = info.cup;
        if (c.left < -1 || c.right > w + 1 || c.top < -1 || c.bottom > availH + 1) issues.push(`[${tag}] cup out of bounds ${JSON.stringify(c)}`);
      }
      await page.screenshot({ path: path.join(outDir, `${w}x${h}@${dpr}_${sc.key}.png`) });
    }
    await ctx.close();
  }
}
await browser.close();
if (issues.length) {
  console.log('ISSUES', issues.length);
  for (const s of issues) console.log(' -', s);
  process.exitCode = 1;
} else {
  console.log('testbed OK', VIEWPORTS.length * DPRS.length * SCENES.length, 'tests');
}
