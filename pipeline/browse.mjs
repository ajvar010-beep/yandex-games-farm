// pipeline/browse.mjs — открыть страницу в ВИДИМОМ Chrome, дать человеку пройти капчу,
// дождаться результата и сохранить текст+ссылки в файл.
//
//   node browse.mjs "<url>" [outBase] [waitSeconds=600]
//
// Пишет: scratch/browse.json  { url, title, text, links:[{t, href}] }
//        scratch/browse.png   скриншот итоговой страницы
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const url = process.argv[2];
const outBase = process.argv[3] || 'browse';
const waitSec = parseInt(process.argv[4] || '600', 10);
if (!url) { console.log('usage: node browse.mjs <url> [outBase] [waitSeconds]'); process.exit(2); }

const outDir = path.resolve('../scratch');
fs.mkdirSync(outDir, { recursive: true });
const profile = path.join(outDir, 'chrome-profile');

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,                       // ВИДИМОЕ окно: капчу проходит человек
  userDataDir: profile,                  // куки и «доверие» живут между запусками
  defaultViewport: null,
  args: ['--start-maximized', '--disable-blink-features=AutomationControlled', '--mute-audio']
});
const page = (await browser.pages())[0] || await browser.newPage();

console.log('[browse] открываю:', url);
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(e => console.log('[browse] goto:', e.message));
console.log('[browse] если видишь капчу — пройди её в окне Chrome. Жду до', waitSec, 'сек.');

const CAPTCHA = /captcha|challenge|verify you are human|unusual traffic|are you a robot|подтвердите, что вы не робот/i;

async function snapshot() {
  return page.evaluate(() => {
    const body = document.body ? document.body.innerText : '';
    const links = Array.from(document.querySelectorAll('a[href]'))
      .map(a => ({ t: (a.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 120), href: a.href }))
      .filter(l => l.t && /^https?:/.test(l.href))
      .slice(0, 400);
    return { title: document.title, text: body.slice(0, 60000), links };
  });
}

let ok = null, waited = 0;
while (waited < waitSec) {
  const s = await snapshot();
  const captcha = CAPTCHA.test(s.title || '') || CAPTCHA.test((s.text || '').slice(0, 4000));
  const rich = (s.text || '').length > 600;
  if (!captcha && rich) { ok = s; break; }
  await new Promise(r => setTimeout(r, 2000));
  waited += 2;
  if (waited % 30 === 0) console.log('[browse] жду…', waited, 'с, title =', s.title);
}

const finalState = ok || await snapshot();
const out = {
  url: page.url(),
  title: finalState.title,
  text: finalState.text,
  links: finalState.links,
  solved: !!ok
};
const jf = path.join(outDir, outBase + '.json');
fs.writeFileSync(jf, JSON.stringify(out, null, 1));
await page.screenshot({ path: path.join(outDir, outBase + '.png') }).catch(() => {});
console.log('[browse] сохранено:', jf, '| solved =', out.solved, '| links =', out.links.length);
await browser.close();
