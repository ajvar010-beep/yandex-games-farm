// pipeline/smoke.mjs — быстрый smoke-прогон игры: загрузка, сцены, console gate.
// Запуск: node smoke.mjs <gameDir>
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const gameDir = process.argv[2];
const gameUrl = 'file:///' + path.resolve(gameDir).replace(/\\/g, '/') + '/index.html';

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--mute-audio'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
page.on('requestfailed', r => errors.push('requestfailed: ' + r.url()));

async function check(url, label) {
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction('window.__capture && window.__capture.ready === true', { timeout: 15000 });
  const st = await page.evaluate('window.__capture.getState()');
  console.log(label, JSON.stringify(st));
}

await page.setViewport({ width: 1280, height: 720 });
await check(gameUrl + '?scene=menu&freeze=1', 'menu');
await check(gameUrl + '?scene=play&seed=11&wave=2&t=4&freeze=1', 'play-lv2');
await check(gameUrl + '?scene=play&seed=23&wave=5&coins=300&mode=shop&freeze=1', 'shop');
await check(gameUrl + '?scene=play&seed=9&mode=over&freeze=1', 'over');
await check(gameUrl + '?scene=play&seed=9&mode=fail&freeze=1', 'fail');

if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('smoke OK');
await browser.close();
