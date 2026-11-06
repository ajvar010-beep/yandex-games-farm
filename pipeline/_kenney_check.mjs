import path from 'node:path';
import puppeteer from 'puppeteer-core';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const u = 'file:///' + path.resolve('../games/parkingescape/index.html').replace(/\\/g, '/');
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--mute-audio'] });
const p = await b.newPage();
p.on('pageerror', e => console.log('PE', e.message));
await p.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
await p.goto(u + '?scene=play&seed=23&wave=9&freeze=1&lang=ru&mute=1', { waitUntil: 'load' });
await p.waitForFunction('window.__capture && window.__capture.ready === true', { timeout: 15000 });
const info = await p.evaluate(async () => {
  window.GAME.art.init();
  await window.GAME.art.preload();
  return {
    counts: window.GAME.art.cars.map(r => r.map(im => im.naturalWidth + 'x' + im.naturalHeight)),
    state: window.__capture.getState()
  };
});
console.log(JSON.stringify(info));
await p.evaluate('window.__capture.renderOnce()');
await new Promise(r => setTimeout(r, 200));
await p.screenshot({ path: '../scratch/parking_kenney.png' });
await b.close();
