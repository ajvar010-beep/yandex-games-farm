// pipeline/debug-mahjongpair2.mjs — отладка ошибки createLinearGradient
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const gameUrl = 'file:///' + path.resolve('games/mahjongpair').replace(/\\/g, '/') + '/index.html';

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--mute-audio'] });
const page = await browser.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message, '\n  stack:', e.stack ? e.stack.split('\n').slice(0, 5).join('\n  ') : 'no stack'));

await page.goto(gameUrl + '?scene=play&seed=11&wave=2&t=4&freeze=1', { waitUntil: 'load' });
await new Promise(r => setTimeout(r, 3000));
await browser.close();
