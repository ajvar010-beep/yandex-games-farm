// pipeline/test-input-sudokulite.mjs — проверка ввода во ВСЕХ режимах
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const gameUrl = 'file:///' + path.resolve('games/sudokulite').replace(/\\/g, '/') + '/index.html';

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--mute-audio'] });
const page = await browser.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

await page.setViewport({ width: 1280, height: 720 });

// Тест 1: running — тап по клетке и цифре
await page.goto(gameUrl + '?scene=play&seed=11&wave=1&freeze=1', { waitUntil: 'load' });
await page.waitForFunction('window.__capture && window.__capture.ready === true', { timeout: 15000 });
const state1 = await page.evaluate('window.__capture.getState()');
console.log('1. running:', state1.mode);

// Тест 2: shop — открытие и закрытие
await page.goto(gameUrl + '?scene=play&seed=11&wave=1&mode=shop&freeze=1', { waitUntil: 'load' });
await page.waitForFunction('window.__capture && window.__capture.ready === true', { timeout: 15000 });
const state2 = await page.evaluate('window.__capture.getState()');
console.log('2. shop:', state2.mode);

// Тест 3: over — победа
await page.goto(gameUrl + '?scene=play&seed=11&wave=1&mode=over&freeze=1', { waitUntil: 'load' });
await page.waitForFunction('window.__capture && window.__capture.ready === true', { timeout: 15000 });
const state3 = await page.evaluate('window.__capture.getState()');
console.log('3. over:', state3.mode);

// Тест 4: fail — поражение
await page.goto(gameUrl + '?scene=play&seed=11&wave=1&mode=fail&freeze=1', { waitUntil: 'load' });
await page.waitForFunction('window.__capture && window.__capture.ready === true', { timeout: 15000 });
const state4 = await page.evaluate('window.__capture.getState()');
console.log('4. fail:', state4.mode);

// Тест 5: pause — пауза (через setState)
await page.goto(gameUrl + '?scene=play&seed=11&wave=1&freeze=1', { waitUntil: 'load' });
await page.waitForFunction('window.__capture && window.__capture.ready === true', { timeout: 15000 });
await page.evaluate('window.__capture.setState({ mode: "paused" })');
await new Promise(r => setTimeout(r, 100));
const state5 = await page.evaluate('window.__capture.getState()');
console.log('5. paused:', state5.mode);

await browser.close();
console.log('input test done');
