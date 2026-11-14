// _svg2png.mjs — конвертация SVG (cover/icon паркорта) в RGB PNG нужного размера.
// Использует headless Chrome: рендерит SVG на canvas, снимает PNG, конвертирует в RGB=2.
// Запуск: node _svg2png.mjs <in.svg> <out.png> <width> <height>
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [, , inFile, outFile, wS, hS] = process.argv;
if (!inFile || !outFile) { console.log('usage: node _svg2png.mjs <in.svg> <out.png> <w> <h>'); process.exit(2); }
const W = parseInt(wS || '512', 10), H = parseInt(hS || '512', 10);

const svg = fs.readFileSync(inFile, 'utf8');
const html = `<!doctype html><html><body style="margin:0">
<canvas id="c" width="${W}" height="${H}"></canvas>
<script>
const svg = ${JSON.stringify(svg)};
const img = new Image();
const blob = new Blob([svg], {type: 'image/svg+xml'});
img.onload = () => {
  const ctx = document.getElementById('c').getContext('2d');
  ctx.drawImage(img, 0, 0, ${W}, ${H});
  window.__done = true;
};
img.onerror = (e) => { window.__err = String(e); window.__done = true; };
img.src = URL.createObjectURL(blob);
</script></body></html>`;

const tmp = path.join(path.dirname(outFile), '.' + path.basename(outFile) + '.html');
fs.writeFileSync(tmp, html);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--mute-audio'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.goto('file:///' + path.resolve(tmp).replace(/\\/g, '/'), { waitUntil: 'load' });
  await page.waitForFunction('window.__done === true', { timeout: 15000 });
  const err = await page.evaluate('window.__err');
  if (err) throw new Error('SVG load error: ' + err);
  const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: W, height: H }, omitBackground: false });
  fs.writeFileSync(outFile, buf);
  console.log(`OK ${outFile} (${W}x${H}, ${(buf.length / 1024).toFixed(0)} KB)`);
} finally {
  await browser.close();
  fs.unlinkSync(tmp);
}
