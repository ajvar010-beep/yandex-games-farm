// make_media.cjs — иконка 512 и обложка 800x470 для «Шахтёр Кликер». SVG -> Chrome -> PNG.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const OUT = path.join(__dirname, '..', 'media');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// блочная текстура камня с крапинками
function rockBlock(x, y, w, h, base, speck, seed, crack) {
  const r = rng(seed);
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${base}"/>`;
  s += `<rect x="${x}" y="${y}" width="${w}" height="${Math.max(4, h * 0.15)}" fill="rgba(255,255,255,0.10)"/>`;
  const n = Math.floor((w * h) / 600);
  for (let i = 0; i < n; i++) {
    const px = x + r() * (w - 8), py = y + 6 + r() * (h - 12), sz = 3 + r() * 7;
    s += `<rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${sz.toFixed(1)}" height="${sz.toFixed(1)}" fill="${speck}" opacity="0.5"/>`;
  }
  if (crack) {
    for (let i = 0; i < crack; i++) {
      const cx = x + r() * w, cy = y + r() * h;
      s += `<rect x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" width="${(2 + r() * 3).toFixed(1)}" height="${(14 + r() * 20).toFixed(1)}" fill="rgba(0,0,0,0.55)" transform="rotate(${(r() * 60 - 30).toFixed(0)} ${cx.toFixed(0)} ${cy.toFixed(0)})"/>`;
    }
  }
  s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="rgba(0,0,0,0.4)" stroke-width="2"/>`;
  return s;
}

// кирка
function pickaxe(cx, cy, sc, rot, metalColor) {
  return `<g transform="translate(${cx} ${cy}) rotate(${rot}) scale(${sc})">
    <rect x="-4" y="-40" width="8" height="80" fill="#7a5230" rx="2"/>
    <rect x="-30" y="-48" width="60" height="14" fill="${metalColor}" rx="4"/>
    <rect x="-30" y="-48" width="60" height="5" fill="rgba(255,255,255,0.25)"/>
  </g>`;
}

function mineBg(w, h, warm) {
  const top = warm ? '#1a1410' : '#0a0e18', bot = warm ? '#33241a' : '#141a28';
  let s = `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bot}"/></linearGradient></defs>`;
  s += `<rect width="${w}" height="${h}" fill="url(#bg)"/>`;
  return s;
}

// ------- ICON 512 -------
function iconSVG() {
  const W = 512, H = 512;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`;
  s += mineBg(W, W, true);
  // лучи света из «луба»
  s += `<ellipse cx="256" cy="150" rx="200" ry="70" fill="rgba(255,190,80,0.14)"/>`;
  // большой камень по центру-низу
  s += rockBlock(96, 190, 320, 260, '#8d8d94', '#6f6f76', 7, 4);
  // золотая вставка (жила)
  s += `<rect x="150" y="260" width="60" height="30" fill="#e8b422" opacity="0.85" transform="rotate(-8 180 275)"/>`;
  s += `<rect x="290" y="330" width="50" height="24" fill="#e8b422" opacity="0.85" transform="rotate(6 315 342)"/>`;
  // кирка, воткнувшаяся в камень
  s += pickaxe(300, 190, 1.9, -32, '#b8c4d8');
  // монетки
  const r = rng(21);
  for (let i = 0; i < 7; i++) {
    const x = 120 + r() * 280, y = 60 + r() * 130, rr = 12 + r() * 10;
    s += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${rr.toFixed(0)}" fill="#ffd24a" stroke="#c2921a" stroke-width="3"/>`;
    s += `<rect x="${(x - rr * 0.3).toFixed(0)}" y="${(y - rr * 0.5).toFixed(0)}" width="${(rr * 0.6).toFixed(0)}" height="${(rr * 1.0).toFixed(0)}" fill="#c2921a" opacity="0.5"/>`;
  }
  s += `</svg>`;
  return s;
}

// ------- COVER 800x470 -------
function coverSVG(lang) {
  const W = 800, H = 470;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`;
  s += mineBg(W, H, false);
  s += `<ellipse cx="400" cy="120" rx="330" ry="80" fill="rgba(255,190,80,0.12)"/>`;
  // камни слева
  s += rockBlock(40, 180, 240, 220, '#8d8d94', '#6f6f76', 11, 3);
  s += rockBlock(60, 120, 180, 130, '#7d7d85', '#5f5f66', 12, 1);
  // кирки-веер
  s += pickaxe(150, 130, 1.2, -50, '#b8c4d8');
  s += pickaxe(235, 150, 1.0, 20, '#e8b422');
  // монетки
  const r = rng(33);
  for (let i = 0; i < 9; i++) {
    const x = 60 + r() * 260, y = 50 + r() * 160, rr = 10 + r() * 9;
    s += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${rr.toFixed(0)}" fill="#ffd24a" stroke="#c2921a" stroke-width="2.5"/>`;
  }
  // шахтёр справа (блочный)
  const mX = 600, mY = 330, u = 14;
  s += `<g transform="translate(${mX} ${mY})">`;
  // ноги
  s += `<rect x="${-3 * u}" y="0" width="${2.4 * u}" height="${4 * u}" fill="#4a4038"/>`;
  s += `<rect x="${0.6 * u}" y="${0} width="${2.4 * u}" height="${4 * u}" fill="#4a4038"/>`;
  // тело
  s += `<rect x="${-3 * u}" y="${-6 * u}" width="${6 * u}" height="${6 * u}" fill="#d88f1e"/>`;
  // руки
  s += `<rect x="${-5 * u}" y="${-6 * u}" width="${2 * u}" height="${5 * u}" fill="#f0c8a0"/>`;
  s += `<rect x="${3 * u}" y="${-6 * u}" width="${2 * u}" height="${5 * u}" fill="#f0c8a0"/>`;
  // голова
  s += `<rect x="${-3 * u}" y="${-12 * u}" width="${6 * u}" height="${6 * u}" fill="#f0c8a0"/>`;
  // каска с лампой (светится)
  s += `<rect x="${-3.4 * u}" y="${-12.6 * u}" width="${6.8 * u}" height="${2 * u}" fill="#ffd24a"/>`;
  s += `<circle cx="0" cy="${-11.4 * u}" r="${0.9 * u}" fill="#fff8d0" style="filter:drop-shadow(0 0 ${u}px #ffe89a)"/>`;
  // глаза
  s += `<rect x="${-1.8 * u}" y="${-9.4 * u}" width="${1.1 * u}" height="${1.1 * u}" fill="#202028"/>`;
  s += `<rect x="${0.7 * u}" y="${-9.4 * u}" width="${1.1 * u}" height="${1.1 * u}" fill="#202028"/>`;
  s += `</g>`;
  // луч лампы
  s += `<polygon points="${mX},${mY - 11.4 * u} ${mX - 160},${mY - 200} ${mX + 30},${mY - 210}" fill="rgba(255,240,180,0.10)"/>`;
  // название
  const title = lang === 'ru' ? 'ШАХТЁР КЛИКЕР' : 'MINER CLICKER';
  const tag = lang === 'ru' ? 'Кликай. Нанимай. Спускайся.' : 'Tap. Hire. Dig deeper.';
  s += `<text x="400" y="110" font-family="Arial Black, Arial, sans-serif" font-size="72" font-weight="900" fill="#ffd24a" stroke="#3a2a10" stroke-width="3" text-anchor="middle" style="paint-order:stroke">${title}</text>`;
  s += `<text x="400" y="158" font-family="Arial, sans-serif" font-size="30" fill="#f0e6d2" text-anchor="middle">${tag}</text>`;
  // бейджи
  const b1 = lang === 'ru' ? '⛏ 30 уровней' : '⛏ 30 levels';
  const b2 = lang === 'ru' ? '🔥 боссы-плиты' : '🔥 boss slabs';
  s += `<rect x="70" y="400" width="300" height="44" rx="10" fill="rgba(0,0,0,0.5)"/>`;
  s += `<text x="220" y="430" font-family="Arial, sans-serif" font-size="24" fill="#ffd24a" text-anchor="middle">${b1}</text>`;
  s += `<rect x="420" y="400" width="300" height="44" rx="10" fill="rgba(0,0,0,0.5)"/>`;
  s += `<text x="570" y="430" font-family="Arial, sans-serif" font-size="24" fill="#ffd24a" text-anchor="middle">${b2}</text>`;
  s += `</svg>`;
  return s;
}

function render(svg, outPng, w, h) {
  const htmlPath = outPng.replace(/\.png$/, '.html');
  fs.writeFileSync(htmlPath, `<!doctype html><html><body style="margin:0">${svg}</body></html>`);
  execFileSync(CHROME, ['--headless', '--disable-gpu', `--window-size=${w},${h}`, '--screenshot=' + outPng, 'file:///' + htmlPath.replace(/\\/g, '/')], { stdio: 'pipe' });
  fs.unlinkSync(htmlPath);
  console.log('rendered', outPng);
}

render(iconSVG(), path.join(OUT, 'icon.png'), 512, 512);
render(coverSVG('ru'), path.join(OUT, 'cover.ru.png'), 800, 470);
render(coverSVG('en'), path.join(OUT, 'cover.en.png'), 800, 470);
console.log('media done');
