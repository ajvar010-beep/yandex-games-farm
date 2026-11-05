import path from 'node:path';
import puppeteer from 'puppeteer-core';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const gameUrl = 'file:///' + path.resolve('../games/arrowescape/index.html').replace(/\\/g, '/');
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--mute-audio', '--hide-scrollbars'] });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
page.on('requestfailed', r => errs.push('requestfailed: ' + r.url()));

async function shot(q, file, w = 1280, h = 720) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.goto(`${gameUrl}?${q}&lang=ru&mute=1`, { waitUntil: 'load' });
  await page.waitForFunction('window.__capture && window.__capture.ready === true', { timeout: 15000 });
  await page.evaluate('window.__capture.renderOnce()');
  await new Promise(r => setTimeout(r, 200));
  const st = await page.evaluate('window.__capture.getState()');
  console.log(q, JSON.stringify(st));
  if (file) await page.screenshot({ path: file });
}

const qs = [
  ['scene=menu&freeze=1', '../scratch/arrow_menu.png'],
  ['scene=play&seed=7&wave=2&freeze=1', '../scratch/arrow_early.png'],
  ['scene=play&seed=23&wave=9&t=2&freeze=1', '../scratch/arrow_mid.png'],
  ['scene=play&seed=42&wave=18&t=2&freeze=1', '../scratch/arrow_late.png'],
  ['scene=play&seed=5&wave=27&t=2&freeze=1', '../scratch/arrow_expert.png'],
  ['scene=play&seed=11&wave=4&mode=win&freeze=1', '../scratch/arrow_win.png'],
  ['scene=play&seed=9&wave=6&mode=over&freeze=1', '../scratch/arrow_over.png'],
  ['scene=play&seed=7&wave=2&freeze=1', '../scratch/arrow_portrait.png', 720, 1280]
];
for (const [q, f, w, h] of qs) await shot(q, f, w, h);
if (errs.length) console.log('ERRORS', errs.join(' | '));
await browser.close();
