import path from 'node:path';
import puppeteer from 'puppeteer-core';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const gameUrl = 'file:///' + path.resolve('../games/arrowescape/index.html').replace(/\\/g, '/');
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--mute-audio'] });
const page = await browser.newPage();
await page.setViewport({ width: 720, height: 1280, deviceScaleFactor: 1 });
for (const seed of [5, 11, 23, 31, 42, 101]) {
  let line = 'seed ' + seed + ': ';
  for (const lv of [12, 18, 27]) {
    await page.goto(`${gameUrl}?scene=play&wave=${lv}&seed=${seed}&freeze=1&lang=ru&mute=1`, { waitUntil: 'load' });
    await page.waitForFunction('window.__capture && window.__capture.ready === true', { timeout: 15000 });
    const s = await page.evaluate(() => {
      const sc = window.Engine.sdk._game.scene;
      return { a: sc.total, o: sc.optimal, l: sc.tapLimit };
    });
    line += `L${lv} ${s.o}/${s.a} (lim ${s.l})  `;
  }
  console.log(line);
}
await browser.close();
