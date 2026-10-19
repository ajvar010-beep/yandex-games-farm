// pipeline/debug-mahjongpair.mjs — отладка загрузки mahjongpair
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const gameUrl = 'file:///' + path.resolve('games/mahjongpair').replace(/\\/g, '/') + '/index.html';

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--mute-audio'] });
const page = await browser.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('console', m => console.log('CONSOLE', m.type() + ':', m.text()));
page.on('requestfailed', r => console.log('REQFAIL:', r.url()));

await page.goto(gameUrl + '?scene=menu&freeze=1', { waitUntil: 'load' });
await new Promise(r => setTimeout(r, 5000));
const hasCapture = await page.evaluate('typeof window.__capture');
const hasGame = await page.evaluate('typeof window.GAME');
const hasEngine = await page.evaluate('typeof window.Engine');
console.log('capture:', hasCapture, 'game:', hasGame, 'engine:', hasEngine);
if (hasGame !== 'undefined') {
  console.log('G.config:', await page.evaluate('typeof window.GAME.config'));
  console.log('G.scenes:', await page.evaluate('typeof window.GAME.scenes'));
  console.log('G.art:', await page.evaluate('typeof window.GAME.art'));
}
await browser.close();
