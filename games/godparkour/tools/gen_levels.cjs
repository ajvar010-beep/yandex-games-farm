// Генератор уровней «Про Паркур» — 20 JSON с нарастающей сложностью.
// node tools/gen_levels.js
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'levels');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const snap = (v) => Math.round(v * 2) / 2;

function genLevel(n) {
  const r = rng(1000 + n * 77);
  // Уровень 1 = тутор: прямая дорожка, большие платформы, монеты в ряд
  if (n === 1) {
    return {
      name: 'Обучение',
      start: [0, 2, 0],
      platforms: [
        { x: 0, y: 0, z: 0, sx: 8, sy: 1, sz: 8, mat: 'grass' },
        { x: 0, y: 0, z: -6, sx: 5, sy: 1, sz: 5, mat: 'grass' },
        { x: 0, y: 0.2, z: -12, sx: 4.5, sy: 1, sz: 4.5, mat: 'stone' },
        { x: 0, y: 0.4, z: -18, sx: 4, sy: 1, sz: 4, mat: 'stone' },
        { x: 0, y: 0.6, z: -24, sx: 4, sy: 1, sz: 4, mat: 'wood' },
        { x: 0, y: 0.8, z: -30, sx: 5, sy: 1, sz: 5, mat: 'gold' },
      ],
      coins: [[0, 1, -6], [0, 1.2, -12], [0, 1.4, -18], [0, 1.6, -24]],
      checkpoints: [[0, 0.5, -15]],
      finish: [0, 1.8, -30],
      lava_y: -6.0, lava_size: 260.0
    };
  }
  const platforms = [{ x: 0, y: 0, z: 0, sx: 7, sy: 1, sz: 7, mat: 'grass' }];
  const coins = [];
  const checkpoints = [];
  const mats = ['grass', 'stone', 'wood', 'sand', 'ice'];
  let pos = { x: 0, y: 0, z: 0 };
  let dir = 1;
  const steps = 10 + Math.floor(n * 1.2);
  // gap компенсирует ужатие платформ: чем уже платформа, тем меньше gap
  const wMax = 3.0 - Math.min(n * 0.06, 1.6);
  const gap = Math.min(1.4 + n * 0.06, wMax * 1.9);
  for (let i = 1; i <= steps; i++) {
    const nx = pos.x + (r() * 2.4 - 1.2) * dir;
    const nz = pos.z - (2.0 + gap + r() * 0.6);
    const ny = pos.y + (r() * 1.1 - 0.25);
    const w = Math.max(1.2, wMax - r() * 0.5);
    const p = {
      x: snap(nx), y: snap(ny), z: snap(nz),
      sx: snap(w), sy: 0.8, sz: snap(w),
      mat: pick(r, mats)
    };
    // ловушки с 3 уровня
    if (n >= 3 && r() < 0.16 + n * 0.008) {
      p.move = { axis: r() < 0.5 ? 'x' : 'z', range: 1.5 + r() * 2, speed: 1.2 + r() * 1.5 };
    }
    platforms.push(p);
    pos = { x: p.x, y: p.y, z: p.z };
    if (i % 3 === 0) coins.push([snap(pos.x), snap(pos.y + 1.0), snap(pos.z)]);
    if (i === Math.floor(steps / 2) || i === Math.floor(steps * 0.75))
      checkpoints.push([snap(pos.x), snap(pos.y + 0.6), snap(pos.z)]);
    dir = -dir;
  }
  // финишная большая платформа
  platforms.push({ x: snap(pos.x), y: snap(pos.y + 0.5), z: snap(pos.z - 3.5), sx: 6, sy: 1, sz: 6, mat: 'gold' });
  return {
    name: `Уровень ${n}`,
    start: [0, 2, 0],
    platforms, coins, checkpoints,
    finish: [snap(pos.x), snap(pos.y + 1.6), snap(pos.z - 3.5)],
    lava_y: -6.0, lava_size: 260.0
  };
}

for (let n = 1; n <= 20; n++) {
  const def = genLevel(n);
  const file = path.join(OUT, String(n).padStart(2, '0') + '.json');
  fs.writeFileSync(file, JSON.stringify(def, null, 0));
}

// Уровень 21 — «ХАКЕР»: тёмная неоновая тема, матричные платформы
(function genHackerLevel() {
  const r = rng(777);
  const platforms = [{ x: 0, y: 0, z: 0, sx: 7, sy: 1, sz: 7, mat: 'neon' }];
  const coins = [];
  const checkpoints = [];
  let pos = { x: 0, y: 0, z: 0 };
  let dir = 1;
  const steps = 22;
  const gap = 1.6;
  const mats = ['neon', 'dark', 'stone'];
  for (let i = 1; i <= steps; i++) {
    const nx = pos.x + (r() * 2.2 - 1.1) * dir;
    const nz = pos.z - (2.2 + gap + r() * 0.5);
    const ny = pos.y + (r() * 1.0 - 0.3);
    const w = 2.2 + r() * 0.8;
    const p = {
      x: snap(nx), y: snap(ny), z: snap(nz),
      sx: snap(w), sy: 0.6, sz: snap(w),
      mat: mats[i % 3]
    };
    if (i % 4 === 0) p.move = { axis: r() < 0.5 ? 'x' : 'y', range: 1.8, speed: 1.4 + r() * 1.4 };
    platforms.push(p);
    pos = { x: p.x, y: p.y, z: p.z };
    if (i % 2 === 0) coins.push([snap(pos.x), snap(pos.y + 1.0), snap(pos.z)]);
    if (i === 11) checkpoints.push([snap(pos.x), snap(pos.y + 0.6), snap(pos.z)]);
    dir = -dir;
  }
  platforms.push({ x: snap(pos.x), y: snap(pos.y + 0.5), z: snap(pos.z - 3.2), sx: 5, sy: 1, sz: 5, mat: 'gold' });
  const def = {
    name: 'ХАКЕР',
    theme: 'hacker',
    start: [0, 2, 0],
    platforms, coins, checkpoints,
    finish: [snap(pos.x), snap(pos.y + 1.6), snap(pos.z - 3.2)],
    lava_y: -6.0, lava_size: 300.0
  };
  fs.writeFileSync(path.join(OUT, '21.json'), JSON.stringify(def, null, 0));
  console.log('Hacker level (21) generated');
})();

console.log('Generated 21 levels into', OUT);
