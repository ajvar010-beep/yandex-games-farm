// make_media.cjs — иконка 512 и обложки 800x470 для «Хакер Паркур» (неоновая матрица).
// SVG -> Chrome headless -> PNG.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const OUT = path.join(__dirname, '..', 'media');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// неоновый блок-платформа
function neonBlock(x, y, w, h, seed) {
  const r = rng(seed);
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#062812"/>`;
  s += `<rect x="${x}" y="${y}" width="${w}" height="${Math.max(3, h * 0.2)}" fill="#0aff5e"/>`;
  const n = Math.floor((w * h) / 700);
  for (let i = 0; i < n; i++) {
    const px = x + r() * (w - 6), py = y + 4 + r() * (h - 8), sz = 2 + r() * 5;
    s += `<rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${sz.toFixed(1)}" height="${sz.toFixed(1)}" fill="#0a7a35" opacity="0.6"/>`;
  }
  s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#0aff5e" stroke-width="2" opacity="0.8"/>`;
  return s;
}
// падающие символы (матрица)
function matrixRain(x, y, w, h, seed) {
  const r = rng(seed);
  let s = '';
  for (let i = 0; i < 40; i++) {
    const gx = x + r() * w, gy = y + r() * h, sz = 9 + r() * 14, op = 0.15 + r() * 0.55;
    s += `<text x="${gx.toFixed(0)}" y="${gy.toFixed(0)}" font-family="monospace" font-weight="bold" font-size="${sz.toFixed(0)}" fill="#19ff6a" opacity="${op.toFixed(2)}">${r() > 0.5 ? '1' : '0'}</text>`;
  }
  return s;
}
// блочный хакер (тёмный, зелёные глаза)
function hacker(cx, cy, u) {
  let s = `<g style="filter: drop-shadow(0 0 ${u * 1.1}px #19ff6a)">`;
  s += `<rect x="${cx - 3 * u}" y="${cy - 5 * u}" width="${2.4 * u}" height="${5 * u}" fill="#0a140c"/>`;
  s += `<rect x="${cx + 0.6 * u}" y="${cy - 5 * u}" width="${2.4 * u}" height="${4 * u}" fill="#0a140c"/>`;
  s += `<rect x="${cx - 3 * u}" y="${cy - 11 * u}" width="${6 * u}" height="${6 * u}" fill="#0d1a10"/>`;   // худи-торс
  s += `<rect x="${cx - 5 * u}" y="${cy - 11 * u}" width="${2 * u}" height="${5 * u}" fill="#0d1a10"/>`;   // рука
  s += `<rect x="${cx + 3 * u}" y="${cy - 11 * u}" width="${2 * u}" height="${5 * u}" fill="#0d1a10"/>`;
  s += `<rect x="${cx - 3 * u}" y="${cy - 17 * u}" width="${6 * u}" height="${6 * u}" fill="#12240f"/>`;   // голова (капюшон)
  s += `<rect x="${cx - 1.8 * u}" y="${cy - 14.4 * u}" width="${1.2 * u}" height="${1.2 * u}" fill="#39ff5e"/>`; // глаза неон
  s += `<rect x="${cx + 0.7 * u}" y="${cy - 14.4 * u}" width="${1.2 * u}" height="${1.2 * u}" fill="#39ff5e"/>`;
  s += `</g>`;
  return s;
}

function matrixBg(W, H) {
  let s = `<rect width="${W}" height="${H}" fill="#020803"/>`;
  // сетка
  for (let gx = 0; gx < W; gx += 34) s += `<line x1="${gx}" y1="0" x2="${gx}" y2="${H}" stroke="#0a3a18" stroke-width="1"/>`;
  for (let gy = 0; gy < H; gy += 34) s += `<line x1="0" y1="${gy}" x2="${W}" y2="${gy}" stroke="#0a3a18" stroke-width="1"/>`;
  s += matrixRain(0, 0, W, H, 7);
  return s;
}

// ------- ICON 512 -------
function iconSVG() {
  const W = 512, H = 512;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`;
  s += matrixBg(W, H);
  // неоновые платформы-ступени вверх
  s += `<g style="filter: drop-shadow(0 0 10px #0aff5e)">`;
  s += neonBlock(60, 400, 150, 30, 3);
  s += neonBlock(230, 340, 150, 30, 4);
  s += neonBlock(120, 250, 150, 30, 5);
  s += neonBlock(300, 170, 150, 30, 6);
  s += `</g>`;
  // хакер прыгает на верхнюю
  s += hacker(360, 170, 13);
  // свечение цели
  s += `<circle cx="390" cy="120" r="46" fill="none" stroke="#39ff5e" stroke-width="5" opacity="0.9" style="filter:drop-shadow(0 0 14px #39ff5e)"/>`;
  s += `</svg>`;
  return s;
}

// ------- COVER 800x470 -------
function coverSVG(lang) {
  const W = 800, H = 470;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`;
  s += matrixBg(W, H);
  // платформы-маршрут слева направо вверх
  s += `<g style="filter: drop-shadow(0 0 12px #0aff5e)">`;
  s += neonBlock(30, 380, 180, 30, 11);
  s += neonBlock(240, 320, 160, 30, 12);
  s += neonBlock(120, 240, 160, 30, 13);
  s += neonBlock(330, 170, 170, 30, 14);
  s += neonBlock(560, 120, 170, 30, 15);
  s += `</g>`;
  // лава-данные внизу
  s += `<rect x="0" y="${H - 26}" width="${W}" height="26" fill="#0a3a10"/>`;
  s += `<rect x="0" y="${H - 26}" width="${W}" height="7" fill="#19ff6a" opacity="0.8"/>`;
  // хакер
  s += hacker(610, 120, 15);
  // заголовок
  const title = lang === 'ru' ? 'ХАКЕР ПАРКУР' : 'HACKER PARKOUR';
  const tag = lang === 'ru' ? 'ВЗЛОМАЙ МАТРИЦУ • 9 НЕОНОВЫХ УРОВНЕЙ' : 'HACK THE MATRIX • 9 NEON LEVELS';
  s += `<text x="300" y="90" text-anchor="middle" font-family="Impact, 'Arial Black', sans-serif" font-size="74" font-weight="900" fill="#19ff6a" stroke="#001504" stroke-width="8" paint-order="stroke" transform="rotate(-2 300 90)" style="letter-spacing:3px">${title}</text>`;
  s += `<text x="300" y="140" text-anchor="middle" font-family="'Courier New', monospace" font-size="26" font-weight="bold" fill="#bfffdd" stroke="#001504" stroke-width="2" paint-order="stroke">${tag}</text>`;
  s += `</svg>`;
  return s;
}

function render(svg, outPng, w, h) {
  const htmlPath = outPng.replace(/\.png$/, '.html');
  fs.writeFileSync(htmlPath, `<!doctype html><html><body style="margin:0">${svg}</body></html>`);
  execFileSync(CHROME, ['--headless', '--disable-gpu', `--window-size=${w},${h}`, '--screenshot=' + outPng, 'file:///' + htmlPath.replace(/\\/g, '/')], { stdio: 'pipe' });
  fs.unlinkSync(htmlPath);
  console.log('rendered', path.basename(outPng));
}

render(iconSVG(), path.join(OUT, 'icon.png'), 512, 512);
render(coverSVG('ru'), path.join(OUT, 'cover.ru.png'), 800, 470);
render(coverSVG('en'), path.join(OUT, 'cover.en.png'), 800, 470);
console.log('media done');
