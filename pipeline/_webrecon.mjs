// _webrecon.mjs — разведка через локальный Chrome, когда WebFetch/WebSearch недоступны.
// Режимы:
//   node _webrecon.mjs search "<query>"   — Bing-выдача: список {title,url,snippet}
//   node _webrecon.mjs fetch "<url>"      — открыть страницу, вытащить заголовок+текст
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const mode = process.argv[2];
const arg = process.argv[3];

async function launch() {
  return puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--mute-audio', '--hide-scrollbars', '--lang=ru-RU'],
  });
}

async function doSearch(q) {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36');
    await page.goto('https://www.bing.com/search?q=' + encodeURIComponent(q) + '&setlang=ru', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('li.b_algo', { timeout: 15000 }).catch(() => {});
    const results = await page.evaluate(() => {
      const out = [];
      const decodeBing = (href) => {
        try {
          const m = href.match(/[?&]u=a1([A-Za-z0-9\-_]+)/);
          if (m) return atob(m[1].replace(/-/g, '+').replace(/_/g, '/'));
        } catch (e) {}
        return href;
      };
      document.querySelectorAll('li.b_algo').forEach(li => {
        const a = li.querySelector('h2 a') || li.querySelector('a');
        const p = li.querySelector('.b_caption p, .b_snippet, .b_algoSlug');
        const cite = li.querySelector('cite');
        if (a) out.push({
          title: (a.innerText || cite && cite.innerText || '').trim(),
          url: decodeBing(a.href || ''),
          snippet: p ? p.innerText.trim().slice(0, 240) : ''
        });
      });
      return out;
    });
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
}

async function doFetch(url) {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));
    const data = await page.evaluate(() => {
      const t = document.title;
      const body = (document.body ? document.body.innerText : '').replace(/\n{3,}/g, '\n\n').slice(0, 3000);
      return { title: t, body };
    });
    console.log('TITLE: ' + data.title + '\n\n' + data.body);
  } finally { await browser.close(); }
}

if (mode === 'search') await doSearch(arg);
else if (mode === 'fetch') await doFetch(arg);
else { console.error('usage: node _webrecon.mjs search "<q>" | fetch "<url>"'); process.exit(2); }
