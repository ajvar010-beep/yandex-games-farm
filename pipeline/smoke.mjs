// pipeline/smoke.mjs — быстрый smoke с АССЕРТАМИ сцен/режимов.
// Запуск: node smoke.mjs <gameDir>
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const gameDir = process.argv[2];
if (!gameDir) { console.log('usage: node smoke.mjs <gameDir>'); process.exit(2); }
const gameUrl = 'file:///' + path.resolve(gameDir).split(path.sep).join('/') + '/index.html';

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--mute-audio'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
page.on('requestfailed', r => errors.push('requestfailed: ' + r.url()));

const issues = [];
async function check(q, label, expect) {
  await page.goto(gameUrl + '?' + q + '&lang=ru&mute=1', { waitUntil: 'load' });
  await page.waitForFunction('window.__capture && window.__capture.ready === true', { timeout: 15000 });
  const st = await page.evaluate('window.__capture.getState()');
  console.log(label, JSON.stringify(st));
  for (const k of Object.keys(expect || {})) if (st[k] !== expect[k]) issues.push(`${label}: ${k}=${st[k]} != ${expect[k]}`);
  return st;
}

await page.setViewport({ width: 1280, height: 720 });
await check('scene=menu&freeze=1', 'menu', { scene: 'menu' });
await check('scene=play&seed=11&wave=2&freeze=1', 'play', { scene: 'play', mode: 'running' });
{
  const st = await check('scene=play&seed=9&mode=over&freeze=1', 'over', { scene: 'play' });
  if (st.mode !== 'over') console.log('over skipped (no over capture mode)');
}
{
  const st = await check('scene=play&seed=11&wave=4&mode=win&freeze=1', 'win', { scene: 'play' });
  if (st.mode !== 'win') console.log('win skipped (endless game, no win mode)');
}
// магазин: у игр с openShop проверяем, что он реально открывается
{
  const st = await check('scene=play&seed=23&wave=5&freeze=1', 'shop-base', { scene: 'play' });
  const opened = await page.evaluate(() => {
    const g = window.Engine.sdk._game, s = g.scene;
    if (!s.openShop) return null;
    g.resume('capture');
    s.openShop(g);
    return { mode: s.mode, panel: s.panel };
  });
  if (opened === null) console.log('shop skipped (no openShop)');
  else {
    console.log('shop', JSON.stringify(opened));
    if (!(opened.mode === 'shop' || opened.panel === 'shop')) issues.push('shop: openShop не открыл магазин');
  }
}

if (errors.length) console.error('CONSOLE ERRORS:\n' + errors.join('\n'));
if (issues.length) { console.error('ASSERT FAILS:\n' + issues.join('\n')); process.exitCode = 1; }
else if (!errors.length) console.log('smoke OK');
await browser.close();
