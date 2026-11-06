import path from 'node:path';
import puppeteer from 'puppeteer-core';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const gameUrl = 'file:///' + path.resolve('../games/arrowescape/index.html').replace(/\\/g, '/');
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--mute-audio'] });
const page = await browser.newPage();
await page.setViewport({ width: 720, height: 1280, deviceScaleFactor: 1 });
const rows = [];
for (let lv = 1; lv <= 30; lv++) {
  await page.goto(`${gameUrl}?scene=play&wave=${lv}&seed=101&freeze=1&lang=ru&mute=1`, { waitUntil: 'load' });
  await page.waitForFunction('window.__capture && window.__capture.ready === true', { timeout: 15000 });
  const s = await page.evaluate(() => {
    const sc = window.Engine.sdk._game.scene;
    return { lv: sc.level, cols: sc.cols, rows: sc.rows, arrows: sc.total, optimal: sc.optimal, limit: sc.tapLimit, crates: sc.crateTotal, frozen: sc.frozenTotal };
  });
  rows.push(s);
  console.log([s.lv, s.cols+'x'+s.rows, 'arrows='+s.arrows, 'crates='+s.crates, 'frozen='+s.frozen, 'optimal='+s.optimal, 'limit='+s.limit, 'ratio='+(s.optimal/s.arrows).toFixed(2)].join('	'));
}
const avg = rows.reduce((a, r) => a + r.optimal / r.arrows, 0) / rows.length;
console.log('avg optimal/arrows', avg.toFixed(3));
await browser.close();
