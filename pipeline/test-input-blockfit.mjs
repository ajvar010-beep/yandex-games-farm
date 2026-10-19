// pipeline/test-input-blockfit.mjs — ручная проверка ввода blockfit
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const gameUrl = 'file:///' + path.resolve('games/blockfit').replace(/\\/g, '/') + '/index.html';

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--mute-audio'] });
const page = await browser.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('console', m => console.log('CONSOLE', m.type() + ':', m.text().slice(0, 80)));

await page.setViewport({ width: 1280, height: 720 });
await page.goto(gameUrl + '?scene=play&seed=11&wave=1&freeze=1', { waitUntil: 'load' });
await page.waitForFunction('window.__capture && window.__capture.ready === true', { timeout: 15000 });

const hasDriveInput = await page.evaluate('typeof window.Engine.capture._game.scene.driveInput');
console.log('hasDriveInput:', hasDriveInput);

const stateBefore = await page.evaluate('window.__capture.getState()');
console.log('state before:', JSON.stringify(stateBefore));

// симулируем тап на поле
await page.mouse.move(640, 300);
await page.mouse.down();
await new Promise(r => setTimeout(r, 50));
await page.mouse.up();
await new Promise(r => setTimeout(r, 100));

const stateAfter = await page.evaluate('window.__capture.getState()');
console.log('state after:', JSON.stringify(stateAfter));

// проверим, что update вызывается и pointer.pressed работает
const pointerWorks = await page.evaluate(`
  (function() {
    var E = window.Engine;
    return {
      hasInput: !!E.input,
      hasPointer: !!E.input.pointer,
      pressed: E.input.pointer.pressed,
      down: E.input.pointer.down
    };
  })()
`);
console.log('pointer state:', JSON.stringify(pointerWorks));

await browser.close();
