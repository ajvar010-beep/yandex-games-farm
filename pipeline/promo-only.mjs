// pipeline/promo-only.mjs — доснять только icon.png и cover.{ru,en}.png для игры.
// Запуск: node promo-only.mjs <gameDir> <outDir> <variant>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [gameDir, outDir, variant] = process.argv.slice(2);
const langs = ['ru', 'en'];
const promoUrl = 'file:///' + path.resolve(__dirname, 'promo.html').replace(/\\/g, '/');
const rootRel = path.relative(__dirname, path.resolve(gameDir)).replace(/\\/g, '/');
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--mute-audio'] });
async function promoShot(query, file) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
  try {
    await page.goto(`${promoUrl}?root=${encodeURIComponent(rootRel)}&variant=${variant}&${query}`, { waitUntil: 'load' });
    await page.waitForFunction('window.__promo && window.__promo.ready === true', { timeout: 15000 });
    const promo = await page.evaluate('window.__promo');
    const data = query.indexOf('what=icon') >= 0 ? promo.iconPng : promo.coverPng;
    if (!data || data === 'data:') throw new Error('empty promo data: ' + (promo.error || '?'));
    fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
    if (errors.length) throw new Error('promo gate: ' + errors.join(' | '));
    console.log('promo', path.basename(file));
  } finally { await ctx.close(); }
}
await promoShot('what=icon', path.join(outDir, 'icon.png'));
for (const lang of langs) await promoShot(`what=cover&lang=${lang}`, path.join(outDir, `cover.${lang}.png`));
await browser.close();
console.log('promo-only done');
