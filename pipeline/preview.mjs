// pipeline/preview.mjs — быстрый скриншот одной сцены для визуального чека.
// Запуск: node preview.mjs <gameDir> <query> <out.png>
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [gameDir, query, out] = process.argv.slice(2);
const gameUrl = 'file:///' + path.resolve(gameDir).replace(/\\/g, '/') + '/index.html?' + query;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--mute-audio', '--hide-scrollbars'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
await page.goto(gameUrl + '&mute=1', { waitUntil: 'load' });
await page.waitForFunction('window.__capture && window.__capture.ready === true', { timeout: 15000 });
await page.evaluate('window.__capture.renderOnce()');
await new Promise(r => setTimeout(r, 300));
await page.evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
await page.screenshot({ path: out });
if (errors.length) { console.error('GATE: ' + errors.join(' | ')); process.exit(1); }
console.log('preview', path.basename(out));
await browser.close();
