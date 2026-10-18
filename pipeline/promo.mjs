#!/usr/bin/env node
/**
 * promo.mjs — генератор промо-арта для Яндекс Игр (иконка 512×512, обложка 800×470).
 * ВАЖНО (§5.6): иконка/обложка — стилизованный промо-арт, НЕ скриншоты из игры.
 * Пишем чистый 24-битный PNG (без альфы) вручную — без зависимостей, с zlib из Node.
 *
 * Использование:
 *   node promo.mjs icon  <outDir> --palette "#0f1b2d,#f5b942,#e2574c,#3ddc97,#f7f3e8"
 *   node promo.mjs cover <outDir> --palette "..." [--title "ТЕКСТ"]
 *   node promo.mjs both  <outDir> --palette "..." [--title "ТЕКСТ"]
 *
 * Палитра берётся из игры (конфиг движка победителя). Title — только если название
 * помещается крупно и без обрезки (§8.3.1). Детерминировано: одинаковые аргументы →
 * одинаковые байты PNG (сид = хэш палитры), чтобы фабрика была воспроизводимой.
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import zlib from 'node:zlib';

// ---------- детерминированный RNG (mulberry32) ----------
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- минимальный PNG-writer (RGB, 8 бит, без альфы) ----------
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, rgb /* Uint8Array w*h*3 */) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type = truecolor, NO alpha (требование Яндекса для скринов; для иконки/обложки тоже безопасно)
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0; // filter none
    rgb.subarray(y * w * 3, (y + 1) * w * 3).forEach((b, i) => { raw[y * (w * 3 + 1) + 1 + i] = b; });
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- растровый контекст (софтверный рендер) ----------
class Raster {
  constructor(w, h) { this.w = w; this.h = h; this.px = new Uint8Array(w * h * 3); }
  set(x, y, [r, g, b]) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.px[i] = r; this.px[i + 1] = g; this.px[i + 2] = b;
  }
  get(x, y) { const i = (((y | 0) * this.w) + (x | 0)) * 3; return [this.px[i], this.px[i + 1], this.px[i + 2]]; }
  fill([r, g, b]) { for (let i = 0; i < this.w * this.h; i++) { this.px[i * 3] = r; this.px[i * 3 + 1] = g; this.px[i * 3 + 2] = b; } }
  // линейная интерполяция двух цветов
  static mix(c1, c2, t) { return [c1[0] + (c2[0] - c1[0]) * t, c1[1] + (c2[1] - c1[1]) * t, c1[2] + (c2[2] - c1[2]) * t].map(Math.round); }
  // залитый круг
  disc(cx, cy, r, color) {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r2) this.set(x, y, color);
      }
  }
  // кольцо
  ring(cx, cy, r, thick, color) {
    const r2o = r * r, r2i = (r - thick) * (r - thick);
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d2 = dx * dx + dy * dy;
        if (d2 <= r2o && d2 >= r2i) this.set(x, y, color);
      }
  }
  // скруглённый прямоугольник
  roundRect(x0, y0, x1, y1, rad, color) {
    for (let y = y0 | 0; y < (y1 | 0); y++)
      for (let x = x0 | 0; x < (x1 | 0); x++) {
        const cx = Math.max(x0 + rad, Math.min(x, x1 - rad)), cy = Math.max(y0 + rad, Math.min(y, y1 - rad));
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy <= rad * rad || (x >= x0 + rad && x <= x1 - rad) || (y >= y0 + rad && y <= y1 - rad)) {
          if (x >= x0 && x < x1 && y >= y0 && y < y1) this.set(x, y, color);
        }
      }
  }
  rect(x0, y0, x1, y1, color) { for (let y = y0 | 0; y < (y1 | 0); y++) for (let x = x0 | 0; x < (x1 | 0); x++) this.set(x, y, color); }
  // вертикальный градиент
  vgrad(c1, c2) { for (let y = 0; y < this.h; y++) { const c = Raster.mix(c1, c2, y / Math.max(1, this.h - 1)); for (let x = 0; x < this.w; x++) this.set(x, y, c); } }
  // толстая линия (для молний/лучей/подчёркиваний)
  line(x0, y0, x1, y1, thick, color) {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0)) * 2;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      this.disc(x, y, thick / 2, color);
    }
  }
  // текст — встроенный пиксельный шрифт 5×7 (A-Z, 0-9, пробел, -, !, :, ')
  static FONT = {
    'A':'01110,10001,10001,11111,10001,10001,10001','B':'11110,10001,10001,11110,10001,10001,11110',
    'C':'01111,10000,10000,10000,10000,10000,01111','D':'11110,10001,10001,10001,10001,10001,11110',
    'E':'11111,10000,10000,11110,10000,10000,11111','F':'11111,10000,10000,11110,10000,10000,10000',
    'G':'01110,10001,10000,10111,10001,10001,01111','H':'10001,10001,10001,11111,10001,10001,10001',
    'I':'11111,00100,00100,00100,00100,00100,11111','J':'00111,00010,00010,00010,00010,10010,01100',
    'K':'10001,10010,10100,11000,10100,10010,10001','L':'10000,10000,10000,10000,10000,10000,11111',
    'M':'10001,11011,10101,10101,10001,10001,10001','N':'10001,11001,10101,10011,10001,10001,10001',
    'O':'01110,10001,10001,10001,10001,10001,01110','P':'11110,10001,10001,11110,10000,10000,10000',
    'Q':'01110,10001,10001,10001,10101,01110,00011','R':'11110,10001,10001,11110,10100,10010,10001',
    'S':'01111,10000,10000,01110,00001,00001,11110','T':'11111,00100,00100,00100,00100,00100,00100',
    'U':'10001,10001,10001,10001,10001,10001,01110','V':'10001,10001,10001,10001,10001,01010,00100',
    'W':'10001,10001,10001,10101,10101,11011,10001','X':'10001,10001,01010,00100,01010,10001,10001',
    'Y':'10001,10001,01010,00100,00100,00100,00100','Z':'11111,00001,00010,00100,01000,10000,11111',
    '0':'01110,10001,10011,10101,11001,10001,01110','1':'00100,01100,00100,00100,00100,00100,01110',
    '2':'01110,10001,00001,00010,00100,01000,11111','3':'11111,00010,00100,00010,00001,10001,01110',
    '4':'00010,00110,01010,10010,11111,00010,00010','5':'11111,10000,11110,00001,00001,10001,01110',
    '6':'00110,01000,10000,11110,10001,10001,01110','7':'11111,00001,00010,00100,01000,01000,01000',
    '8':'01110,10001,10001,01110,10001,10001,01110','9':'01110,10001,10001,01111,00001,00010,01100',
    ' ':'00000,00000,00000,00000,00000,00000,00000','-':'00000,00000,00000,11111,00000,00000,00000',
    '!':'00100,00100,00100,00100,00100,00000,00100',':':'00000,00100,00000,00000,00000,00100,00000',
    "'":'00100,00100,00000,00000,00000,00000,00000','.':'00000,00000,00000,00000,00000,00000,00100',
    '?':'01110,10001,00001,00110,00100,00000,00100',
    // кириллица — псевдо-латиница для частых букв (промо-арт обычно без кириллицы; если title RU — рендерить латиницей либо пропускать)
  };
  text(str, cx, cy, scale, color, shadow) {
    const s = String(str).toUpperCase();
    const chars = [...s];
    const wTotal = chars.length * 6 * scale - scale;
    let x = Math.round(cx - wTotal / 2), y = Math.round(cy - 3.5 * scale);
    for (const ch of chars) {
      const glyph = Raster.FONT[ch] || Raster.FONT['?'];
      const rows = glyph.split(',');
      if (shadow) {
        for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++)
          if (rows[r][c] === '1') this.rect(x + c * scale + scale, y + r * scale + scale, x + (c + 1) * scale + scale, y + (r + 1) * scale + scale, shadow);
      }
      for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++)
        if (rows[r][c] === '1') this.rect(x + c * scale, y + r * scale, x + (c + 1) * scale, y + (r + 1) * scale, color);
      x += 6 * scale;
    }
  }
  // мягкая виньетка по краям
  vignette(strength = 0.35) {
    const cx = this.w / 2, cy = this.h / 2, maxD = Math.hypot(cx, cy);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const d = Math.hypot(x - cx, y - cy) / maxD;
      const k = 1 - strength * Math.pow(Math.max(0, d - 0.45) / 0.55, 2);
      if (k < 1) { const c = this.get(x, y); this.set(x, y, [c[0] * k, c[1] * k, c[2] * k].map(Math.round)); }
    }
  }
}

// ---------- парсинг аргументов ----------
function parsePalette(str) {
  const cols = String(str || '').split(',').map(s => s.trim()).filter(Boolean);
  const out = [];
  for (const c of cols) {
    const m = /^#?([0-9a-f]{6})$/i.exec(c);
    if (!m) throw new Error('плохой цвет в --palette: ' + c);
    const n = parseInt(m[1], 16);
    out.push([(n >> 16) & 255, (n >> 8) & 255, n & 255]);
  }
  if (out.length < 3) throw new Error('--palette: нужно ≥3 цветов');
  return out;
}
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d; };
const cmd = process.argv[2];
const outDir = process.argv[3] ? resolve(process.argv[3]) : null;
if (!cmd || !outDir || !['icon', 'cover', 'both'].includes(cmd)) {
  console.error('usage: promo.mjs <icon|cover|both> <outDir> --palette "#rrggbb,..." [--title "TEXT"]');
  process.exit(2);
}
const pal = parsePalette(arg('palette', '#0f1b2d,#f5b942,#e2574c,#3ddc97,#f7f3e8'));
const title = arg('title', '');
const [bg0, accent1, accent2, accent3, light] = [pal[0], pal[1], pal[2 % pal.length], pal[3 % pal.length], pal[pal.length - 1]];
mkdirSync(outDir, { recursive: true });

// ---------- ICON 512×512: крупная центральная эмблема, контраст, без рамок/скруглений (§5.6, §8.3.3) ----------
function drawIcon() {
  const W = 512, H = 512;
  const r = mulberry32(hashStr('icon|' + pal.map(c => c.join('')).join('|')));
  const R = new Raster(W, H);
  // фон: радиальный-ish градиент из двух цветов + лучи от центра
  R.vgrad(Raster.mix(bg0, accent3, 0.25), bg0);
  const cx = W / 2, cy = H / 2 + 10;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + r() * 0.1;
    const col = Raster.mix(bg0, accent1, 0.18 + 0.1 * r());
    R.line(cx, cy, cx + Math.cos(a) * 420, cy + Math.sin(a) * 420, 10 + 8 * r(), col);
  }
  // центральная эмблема: кольцо + диск + «звезда» из треугольных лучей
  R.disc(cx, cy, 175, Raster.mix(accent1, light, 0.15));
  R.ring(cx, cy, 175, 26, accent2);
  R.disc(cx, cy, 120, bg0);
  // звезда
  const spikes = 5, R1 = 105, R2 = 46;
  const pts = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / spikes;
    const rr = i % 2 === 0 ? R1 : R2;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  for (let y = cy - R1; y <= cy + R1; y++) for (let x = cx - R1; x <= cx + R1; x++) {
    if (inPoly(x, y, pts)) R.set(x, y, light);
  }
  // блики и мелкие звёздочки вокруг
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2, d = 200 + r() * 52;
    R.disc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 2 + r() * 5, i % 2 ? light : accent1);
  }
  R.ring(cx - 55, cy - 60, 40, 12, Raster.mix(light, accent1, 0.5)); // блик
  R.vignette(0.3);
  const f = join(outDir, 'icon.png');
  writeFileSync(f, encodePNG(W, H, R.px));
  console.log('OK ' + f + ' 512x512');
}

// ---------- COVER 800×470: композиция «герой слева, название справа», читаемый текст, без обрезки ----------
function drawCover() {
  const W = 800, H = 470;
  const r = mulberry32(hashStr('cover|' + pal.map(c => c.join('')).join('|')));
  const R = new Raster(W, H);
  R.vgrad(Raster.mix(bg0, accent3, 0.35), bg0);
  // холмы/волны на фоне
  for (let layer = 0; layer < 3; layer++) {
    const base = H - 60 - layer * 55, amp = 26 + layer * 10, col = Raster.mix(bg0, accent3, 0.25 + layer * 0.12);
    for (let x = 0; x < W; x++) {
      const y = base + Math.sin(x * 0.012 + layer * 2.1) * amp + Math.sin(x * 0.031 + layer) * amp * 0.4;
      for (let yy = y | 0; yy < H; yy++) R.set(x, yy, col);
    }
  }
  // «солнце»/акцентный круг справа сверху
  R.disc(640, 90, 60, accent1);
  R.ring(640, 90, 78, 8, accent2);
  // герой слева: стилизованная фигура (диск + звезда) на постаменте
  const hx = 170, hy = 235;
  R.roundRect(hx - 110, hy - 120, hx + 110, hy + 130, 26, Raster.mix(bg0, light, 0.12));
  R.disc(hx, hy - 10, 78, accent1);
  R.ring(hx, hy - 10, 78, 14, accent2);
  const pts = [];
  const cx = hx, cy = hy - 10, R1 = 48, R2 = 20;
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 === 0 ? R1 : R2;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  for (let y = cy - R1; y <= cy + R1; y++) for (let x = cx - R1; x <= cx + R1; x++) if (inPoly(x, y, pts)) R.set(x, y, light);
  // искры
  for (let i = 0; i < 40; i++) R.disc(40 + r() * 720, 30 + r() * 260, 1.5 + r() * 3, i % 3 ? light : accent3);
  // название (если задано и латиница/кириллица→латиница) — крупно, с тенью, гарантированно вписано
  if (title) {
    const t = title.replace(/[^A-Za-z0-9 !'?:.\-]/g, '').trim(); // промо-арт: только ASCII-глифы шрифта
    if (t) {
      let scale = Math.min(7, Math.floor((W * 0.86) / (t.length * 6)));
      scale = Math.max(3, scale);
      const cx2 = W / 2 + 130, cy2 = H - 96;
      // подложка-плашка для читаемости (§8.3.1 — без обрезанного текста)
      const tw = t.length * 6 * scale, th = 7 * scale;
      R.roundRect(cx2 - tw / 2 - 18, cy2 - th / 2 - 12, cx2 + tw / 2 + 18, cy2 + th / 2 + 12, 16, Raster.mix(bg0, [0, 0, 0], 0.35));
      R.text(t, cx2, cy2, scale, light, Raster.mix(bg0, [0, 0, 0], 0.6));
    }
  }
  // рамка-акцент по краю НО без скругления самого изображения (§8.3.3 — края без рамок/скруглений: не рисуем внешнюю рамку!)
  R.vignette(0.28);
  const f = join(outDir, 'cover.png');
  writeFileSync(f, encodePNG(W, H, R.px));
  console.log('OK ' + f + ' 800x470');
}

// точка в многоугольнике (для звезды)
function inPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

if (cmd === 'icon' || cmd === 'both') drawIcon();
if (cmd === 'cover' || cmd === 'both') drawCover();
