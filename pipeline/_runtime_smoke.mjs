// _runtime_smoke.mjs — загрузить каждую игру headless, поймать pageerror/console.error,
// пройти menu→play, погонять цикл, проверить freeze-кадры основных сцен.
// Запуск из pipeline/: node _runtime_smoke.mjs [onlyGame]
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const GAMES = path.join(ROOT, 'games');
const only = process.argv[2];

const games = fs.readdirSync(GAMES).filter(n =>
  fs.existsSync(path.join(GAMES, n, 'index.html')) &&
  fs.existsSync(path.join(GAMES, n, 'game', 'main.js')) &&
  (!only || n === only));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--mute-audio', '--hide-scrollbars'] });
let totalIssues = 0;

for (const name of games) {
  const url = 'file:///' + path.join(GAMES, name, 'index.html').replace(/\\/g, '/');
  const issues = [];
  const ctx = await browser.createBrowserContext();
  try {
    const page = await ctx.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    page.on('pageerror', e => issues.push('pageerror: ' + String(e.message).slice(0, 200)));
    page.on('console', m => { if (m.type() === 'error') issues.push('console.error: ' + m.text().slice(0, 200)); });
    page.on('requestfailed', r => issues.push('requestfailed: ' + r.url().slice(0, 120)));

    // 1) plain load → menu
    await page.goto(url + '?lang=ru&mute=1', { waitUntil: 'load', timeout: 20000 });
    const ok = await page.waitForFunction('window.__capture && window.__capture.ready === true', { timeout: 12000 }).then(() => true).catch(() => false);
    if (!ok) { issues.push('capture.ready never became true (menu)'); }
    else {
      // 2) let it run 2s of wall time (rAF loop must not throw)
      await new Promise(r => setTimeout(r, 2000));
      // 3) play scene, run 3s
      await page.goto(url + '?scene=play&seed=7&lang=ru&mute=1', { waitUntil: 'load', timeout: 20000 });
      const ok2 = await page.waitForFunction('window.__capture && window.__capture.ready === true', { timeout: 12000 }).then(() => true).catch(() => false);
      if (!ok2) issues.push('capture.ready never became true (play)');
      else {
        await new Promise(r => setTimeout(r, 3000));
        const st = await page.evaluate('window.__capture.getState && JSON.stringify(window.__capture.getState())').catch(e => null);
        if (!st) issues.push('getState() failed in play');
      }
      // 4) EN locale load
      await page.goto(url + '?scene=play&seed=7&lang=en&mute=1', { waitUntil: 'load', timeout: 20000 });
      await page.waitForFunction('window.__capture && window.__capture.ready === true', { timeout: 12000 }).then(() => true).catch(() => issues.push('capture.ready never became true (play,en)'));
      await new Promise(r => setTimeout(r, 1000));
    }
  } catch (e) {
    issues.push('HARNESS: ' + String(e.message).slice(0, 200));
  }
  await ctx.close().catch(() => {});
  // dedupe
  const uniq = [...new Set(issues)];
  if (uniq.length) {
    totalIssues += uniq.length;
    console.log(`[${name}] ${uniq.length} issues:`);
    for (const i of uniq.slice(0, 8)) console.log('   ' + i);
  } else {
    console.log(`[${name}] OK`);
  }
}
console.log(`\n=== runtime smoke done: ${totalIssues} issues ===`);
await browser.close();
process.exit(0);
