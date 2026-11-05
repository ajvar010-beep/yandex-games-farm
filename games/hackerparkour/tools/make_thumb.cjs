// Генератор превьюшек в стиле майнкрафт-тамбнейлов: НУБ / ПРО / ЧИТЕР / БОГ.
// SVG -> Chrome headless -> PNG. node tools/make_thumb.cjs
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'media');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// детерминированный рандом для «пиксельных» крапинок
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// ---------- блочные текстуры ----------
function block(x, y, w, h, pal, seed) {
  const r = rng(seed);
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${pal.base}"/>`;
  s += `<rect x="${x}" y="${y}" width="${w}" height="${Math.max(6, h * 0.18)}" fill="${pal.top}"/>`;
  const n = Math.floor((w * h) / 900);
  for (let i = 0; i < n; i++) {
    const px = x + r() * (w - 10), py = y + 6 + r() * (h - 14), sz = 4 + r() * 8;
    s += `<rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${sz.toFixed(1)}" height="${sz.toFixed(1)}" fill="${pal.speck}" opacity="0.55"/>`;
  }
  s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="2"/>`;
  return s;
}
const PAL = {
  grass: { base: '#8a5a32', top: '#5cb04a', speck: '#6d4526' },
  dirt: { base: '#8a5a32', top: '#9a6a3e', speck: '#6d4526' },
  stone: { base: '#8d8d94', top: '#a5a5ad', speck: '#6f6f76' },
  ice: { base: '#7fd4e8', top: '#b8ecf7', speck: '#5fb8d0' },
  gold: { base: '#e8b422', top: '#ffd95e', speck: '#c2921a' },
  neon: { base: '#062812', top: '#0aff5e', speck: '#0a7a35' },
  dark: { base: '#23232b', top: '#3a3a45', speck: '#15151b' },
  lava: { base: '#e04a06', top: '#ff8c1a', speck: '#ffb347' },
};

// ---------- персонажи (блочные, фронтально) ----------
// c: {hair, skin, shirt, pants, shoes, eye, beard?}
function character(cx, cy, u, c, glow) {
  const W = 10 * u, H = 17 * u;
  const x0 = cx - W / 2, y0 = cy - H;
  let s = `<g style="filter: drop-shadow(0 0 ${u * 0.9}px ${glow}) drop-shadow(0 0 ${u * 0.35}px ${glow})">`;
  // ноги
  s += `<rect x="${x0 + 2 * u}" y="${y0 + 12 * u}" width="${2.9 * u}" height="${5 * u}" fill="${c.pants}"/>`;
  s += `<rect x="${x0 + 5.1 * u}" y="${y0 + 12 * u}" width="${2.9 * u}" height="${5 * u}" fill="${c.pants}"/>`;
  s += `<rect x="${x0 + 2 * u}" y="${y0 + 16 * u}" width="${2.9 * u}" height="${1 * u}" fill="${c.shoes}"/>`;
  s += `<rect x="${x0 + 5.1 * u}" y="${y0 + 16 * u}" width="${2.9 * u}" height="${1 * u}" fill="${c.shoes}"/>`;
  // руки
  s += `<rect x="${x0}" y="${y0 + 6 * u}" width="${2 * u}" height="${7 * u}" fill="${c.skin}"/>`;
  s += `<rect x="${x0}" y="${y0 + 6 * u}" width="${2 * u}" height="${3 * u}" fill="${c.shirt}"/>`;
  s += `<rect x="${x0 + 8 * u}" y="${y0 + 6 * u}" width="${2 * u}" height="${7 * u}" fill="${c.skin}"/>`;
  s += `<rect x="${x0 + 8 * u}" y="${y0 + 6 * u}" width="${2 * u}" height="${3 * u}" fill="${c.shirt}"/>`;
  // торс
  s += `<rect x="${x0 + 2 * u}" y="${y0 + 6 * u}" width="${6 * u}" height="${6 * u}" fill="${c.shirt}"/>`;
  // голова
  s += `<rect x="${x0 + 2 * u}" y="${y0}" width="${6 * u}" height="${6 * u}" fill="${c.skin}"/>`;
  s += `<rect x="${x0 + 2 * u}" y="${y0}" width="${6 * u}" height="${1.6 * u}" fill="${c.hair}"/>`;
  // глаза
  s += `<rect x="${x0 + 3 * u}" y="${y0 + 2.6 * u}" width="${1.1 * u}" height="${1.1 * u}" fill="${c.eye}"/>`;
  s += `<rect x="${x0 + 5.9 * u}" y="${y0 + 2.6 * u}" width="${1.1 * u}" height="${1.1 * u}" fill="${c.eye}"/>`;
  // рот / борода
  if (c.beard) {
    s += `<rect x="${x0 + 2.6 * u}" y="${y0 + 4.2 * u}" width="${4.8 * u}" height="${1.8 * u}" fill="${c.beard}"/>`;
  } else {
    s += `<rect x="${x0 + 4.2 * u}" y="${y0 + 4.4 * u}" width="${1.6 * u}" height="${0.7 * u}" fill="${c.mouth || '#5a3a2a'}"/>`;
  }
  s += `</g>`;
  return s;
}
const SKINS = {
  nub: { hair: '#4a2f1b', skin: '#c98d5e', shirt: '#20b6b0', pants: '#3b46a8', shoes: '#555', eye: '#3b2bd8', glow: '#ff2a2a' },
  pro: { hair: '#5fe8f2', skin: '#39c8dc', shirt: '#2ad4e8', pants: '#1899b0', shoes: '#0d6d80', eye: '#083b46', glow: '#7ff6ff' },
  cheater: { hair: '#111', skin: '#f2f2f2', shirt: '#161616', pants: '#0d0d0d', shoes: '#000', eye: '#111', glow: '#39ff5e' },
  god: { hair: '#fff6e0', skin: '#e8c39a', shirt: '#fdfdf5', pants: '#f2e6c8', shoes: '#d8b45a', eye: '#2a6bd8', beard: '#ffffff', glow: '#ffd93a' },
};

// ---------- сцены по панелям ----------
function sceneNoob(x, y, w, h) {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#sky)"/>`;
  s += block(x + 10, y + h - 150, 90, 150, PAL.grass, 11);
  s += block(x + 120, y + h - 110, 70, 110, PAL.dirt, 12);
  s += block(x + 210, y + h - 70, 60, 70, PAL.grass, 13);
  // лава
  s += `<rect x="${x}" y="${y + h - 26}" width="${w}" height="26" fill="${PAL.lava.base}"/>`;
  s += `<rect x="${x}" y="${y + h - 26}" width="${w}" height="8" fill="${PAL.lava.top}"/>`;
  return s;
}
function scenePro(x, y, w, h) {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#sky)"/>`;
  // ледяная петля
  s += `<circle cx="${x + w / 2}" cy="${y + h / 2 - 20}" r="72" fill="none" stroke="${PAL.ice.base}" stroke-width="26"/>`;
  s += `<circle cx="${x + w / 2}" cy="${y + h / 2 - 20}" r="72" fill="none" stroke="${PAL.ice.top}" stroke-width="8"/>`;
  s += block(x + 8, y + h - 90, 80, 90, PAL.ice, 21);
  s += block(x + w - 88, y + h - 90, 80, 90, PAL.ice, 22);
  s += `<rect x="${x}" y="${y + h - 22}" width="${w}" height="22" fill="#2a7a2a"/>`;
  return s;
}
function sceneCheater(x, y, w, h) {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#020803"/>`;
  // матричная сетка
  for (let gx = 0; gx < w; gx += 26) s += `<line x1="${x + gx}" y1="${y}" x2="${x + gx}" y2="${y + h}" stroke="#0a3a18" stroke-width="1.5"/>`;
  for (let gy = 0; gy < h; gy += 26) s += `<line x1="${x}" y1="${y + gy}" x2="${x + w}" y2="${y + gy}" stroke="#0a3a18" stroke-width="1.5"/>`;
  // падающие символы
  const r = rng(77);
  for (let i = 0; i < 26; i++) {
    const gx = x + r() * w, gy = y + r() * h;
    s += `<text x="${gx.toFixed(0)}" y="${gy.toFixed(0)}" font-family="monospace" font-size="${10 + r() * 10}" fill="#19ff6a" opacity="${(0.25 + r() * 0.6).toFixed(2)}">${r() > 0.5 ? '1' : '0'}</text>`;
  }
  s += `<g style="filter: drop-shadow(0 0 8px #19ff6a)">`;
  s += block(x + 20, y + h - 100, 80, 26, PAL.neon, 31);
  s += block(x + 130, y + h - 150, 80, 26, PAL.neon, 32);
  s += block(x + 230, y + h - 90, 70, 26, PAL.neon, 33);
  s += `</g>`;
  return s;
}
function sceneGod(x, y, w, h) {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#skyGod)"/>`;
  // земной шар из блоков
  s += `<circle cx="${x + w / 2}" cy="${y + 120}" r="70" fill="#2a6bd8"/>`;
  s += `<circle cx="${x + w / 2 - 20}" cy="${y + 105}" r="26" fill="#3fae4a"/>`;
  s += `<circle cx="${x + w / 2 + 26}" cy="${y + 135}" r="20" fill="#3fae4a"/>`;
  s += `<circle cx="${x + w / 2}" cy="${y + 120}" r="70" fill="none" stroke="#ffd93a" stroke-width="5" style="filter: drop-shadow(0 0 10px #ffd93a)"/>`;
  // золотая дорога и лава
  s += block(x + 30, y + h - 120, 70, 120, PAL.gold, 41);
  s += block(x + 125, y + h - 80, 70, 80, PAL.gold, 42);
  s += block(x + 220, y + h - 140, 70, 140, PAL.gold, 43);
  s += `<rect x="${x}" y="${y + h - 20}" width="${w}" height="20" fill="${PAL.lava.base}"/>`;
  s += `<rect x="${x}" y="${y + h - 20}" width="${w}" height="7" fill="${PAL.lava.top}"/>`;
  return s;
}

function title(x, w, text, color, stroke) {
  return `<text x="${x + w / 2}" y="92" text-anchor="middle" font-family="Impact, 'Arial Black', sans-serif" font-size="76" font-weight="900" fill="${color}" stroke="${stroke}" stroke-width="10" paint-order="stroke" transform="rotate(-2 ${x + w / 2} 92)" style="letter-spacing:2px">${text}</text>`;
}

// ---------- 4-панельный thumbnail ----------
function fourPanel(W, H) {
  const pw = W / 4;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  s += `<defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6ec6f2"/><stop offset="1" stop-color="#bfe8ff"/></linearGradient>
    <linearGradient id="skyGod" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1a4a"/><stop offset="1" stop-color="#8a4ad8"/></linearGradient>
  </defs>`;
  const panels = [
    { t: 'НУБ', c: '#ff2a2a', st: '#ffffff', sc: sceneNoob, ch: SKINS.nub },
    { t: 'ПРО', c: '#39e6ff', st: '#003a4a', sc: scenePro, ch: SKINS.pro },
    { t: 'ЧИТЕР', c: '#39ff5e', st: '#003a10', sc: sceneCheater, ch: SKINS.cheater },
    { t: 'БОГ', c: '#ffd93a', st: '#5a3a00', sc: sceneGod, ch: SKINS.god },
  ];
  panels.forEach((p, i) => {
    const x = i * pw;
    s += `<g>`;
    s += p.sc(x, 0, pw, H);
    s += character(x + pw * 0.32, H - 18, Math.min(pw, H) / 24, p.ch, p.ch.glow);
    s += title(x, pw, p.t, p.c, p.st);
    s += `</g>`;
    if (i > 0) s += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#ffffff" stroke-width="5"/>`;
  });
  s += `</svg>`;
  return s;
}

// ---------- обложка одной игры (hero-панель) ----------
function cover(W, H, game) {
  const cfg = {
    nubik: { t: 'НУБИК ПАРКУР', ch: SKINS.nub, sc: sceneNoob, c: '#5cb04a' },
    pro: { t: 'ПРО ПАРКУР', ch: SKINS.pro, sc: scenePro, c: '#2ad4e8' },
    god: { t: 'БОГ ПАРКУРА', ch: SKINS.god, sc: sceneGod, c: '#ffd93a' },
  }[game];
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  s += `<defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6ec6f2"/><stop offset="1" stop-color="#bfe8ff"/></linearGradient>
    <linearGradient id="skyGod" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1a4a"/><stop offset="1" stop-color="#8a4ad8"/></linearGradient>
  </defs>`;
  s += cfg.sc(0, 0, W, H);
  // большой персонаж справа
  s += character(W * 0.74, H - 14, H / 15, cfg.ch, cfg.ch.glow);
  // маленький персонаж-«цель» слева на платформе
  s += character(W * 0.16, H - 150, H / 26, cfg.ch, '#ffffff');
  // заголовок
  s += `<text x="${W / 2}" y="${H * 0.24}" text-anchor="middle" font-family="Impact, 'Arial Black', sans-serif" font-size="${H * 0.17}" font-weight="900" fill="${cfg.c}" stroke="#000" stroke-width="${H * 0.02}" paint-order="stroke" transform="rotate(-2 ${W / 2} ${H * 0.24})">${cfg.t}</text>`;
  s += `<text x="${W / 2}" y="${H * 0.38}" text-anchor="middle" font-family="Impact, 'Arial Black', sans-serif" font-size="${H * 0.075}" fill="#ffffff" stroke="#000" stroke-width="${H * 0.012}" paint-order="stroke">ПРЫГАЙ • НЕ УПАДИ В ЛАВУ • СТАНЬ БОГОМ</text>`;
  s += `</svg>`;
  return s;
}

// ---------- иконка 512 ----------
function icon(game) {
  const cfg = {
    nubik: { ch: SKINS.nub, bg: '#5cb04a', t: 'НУБ' },
    pro: { ch: SKINS.pro, bg: '#2ad4e8', t: 'ПРО' },
    god: { ch: SKINS.god, bg: '#ffd93a', t: 'БОГ' },
  }[game];
  const W = 512, H = 512;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  s += `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6ec6f2"/><stop offset="1" stop-color="#bfe8ff"/></linearGradient>
  <linearGradient id="skyGod" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1a4a"/><stop offset="1" stop-color="#8a4ad8"/></linearGradient></defs>`;
  s += `<rect width="${W}" height="${H}" fill="url(#sky)"/>`;
  // блоки-ступени
  s += block(20, 330, 140, 160, PAL.grass, 51);
  s += block(180, 260, 140, 230, PAL.stone, 52);
  s += block(340, 190, 150, 300, PAL.gold, 53);
  s += `<rect x="0" y="486" width="512" height="26" fill="${PAL.lava.base}"/>`;
  s += `<rect x="0" y="486" width="512" height="9" fill="${PAL.lava.top}"/>`;
  // персонаж крупно по центру
  s += character(256, 470, 26, cfg.ch, cfg.ch.glow);
  // бейдж
  s += `<text x="256" y="86" text-anchor="middle" font-family="Impact, 'Arial Black', sans-serif" font-size="88" font-weight="900" fill="${cfg.bg}" stroke="#000" stroke-width="14" paint-order="stroke" transform="rotate(-3 256 86)">${cfg.t}</text>`;
  s += `</svg>`;
  return s;
}

fs.writeFileSync(path.join(OUT, 'thumb_series.svg'), fourPanel(1280, 720));
fs.writeFileSync(path.join(OUT, 'cover_parkourpro.svg'), cover(800, 470, 'pro'));
fs.writeFileSync(path.join(OUT, 'cover_nubikparkour.svg'), cover(800, 470, 'nubik'));
fs.writeFileSync(path.join(OUT, 'cover_godparkour.svg'), cover(800, 470, 'god'));
fs.writeFileSync(path.join(OUT, 'icon_parkourpro.svg'), icon('pro'));
fs.writeFileSync(path.join(OUT, 'icon_nubikparkour.svg'), icon('nubik'));
fs.writeFileSync(path.join(OUT, 'icon_godparkour.svg'), icon('god'));
console.log('SVG previews generated into', OUT);
