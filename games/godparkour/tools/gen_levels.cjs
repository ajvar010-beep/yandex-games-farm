// Генератор уровней «Про Паркур» — 21 JSON, АРХЕТИПЫ маршрутов (v8):
//   climb    — классический зигзаг-подъём
//   descent  — спуск лестницей (прыжки вниз с контролем падения)
//   serpentine — U-повороты (±z), камера разворачивается за игроком
//   ice      — скользкий мир (низкий accel, короткие разрывы)
//   crumble  — мост из крошащихся платформ (crumble: 0.7с после касания)
//   shaft    — вертикальная шахта (подъём dy~1.2-1.5, малые разрывы)
//   gauntlet — коридор с hazard-блоками (красные, касание = смерть)
//   movers   — лабиринт движущихся платформ
//   mixed    — микс архетипов (финальные уровни)
// Ограничения (smoke_test god-физика): edge_gap ≤ 4.4, подъём dy ≤ 1.75.
// node tools/gen_levels.cjs
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

// сегмент маршрута: len шагов в направлении dir(±1) с профилем высоты
function addSegment(st, r, cfg) {
  const { len, dir, prof, mats, wBase, gapBase, moverP, crumbleP, hazardP } = cfg;
  // направление задаём В НАЧАЛЕ сегмента (иначе поворот применяется с опозданием на сегмент)
  if (dir !== undefined) st.dir = dir;
  for (let i = 0; i < len; i++) {
    const t = i / Math.max(1, len - 1);
    let dy;
    switch (prof) {
      case 'climb':   dy = 0.35 + r() * 0.55; break;
      case 'descent': dy = -(0.55 + r() * 0.45); break;
      case 'flat':    dy = r() * 0.5 - 0.25; break;
      case 'shaft':   dy = 1.2 + r() * 0.3; break;
    }
    dy = Math.max(-1.2, Math.min(1.5, dy));
    // разрыв по оси движения: shaft — компактные, descent — средние, ice — короткие
    const gap = gapBase + r() * 0.6;
    const fwd = prof === 'shaft' ? gap * 0.6 : gap;
    const nz = st.pos.z + st.dir * (fwd + 2.0);
    const nx = st.pos.x + (r() * 2.0 - 1.0) * (prof === 'shaft' ? 0.5 : 1);
    const ny = st.pos.y + dy;
    // ограничения мира: y ∈ [-4, 8], |x| ≤ 9
    const y = Math.max(-4, Math.min(8, ny));
    const x = Math.max(-9, Math.min(9, nx));
    const w = Math.max(1.3, wBase - r() * 0.5);
    const p = {
      x: snap(x), y: snap(y), z: snap(nz),
      sx: snap(w), sy: 0.8, sz: snap(w),
      mat: pick(r, mats)
    };
    if (moverP && r() < moverP) {
      p.move = { axis: r() < 0.6 ? 'x' : 'z', range: 1.2 + r() * 1.8, speed: 1.1 + r() * 1.4 };
    }
    if (crumbleP && r() < crumbleP && !p.move) p.crumble = 0.7;
    st.plats.push(p);
    st.pos = { x: p.x, y: p.y, z: p.z };
    st.i++;
    // монеты: каждая 3-я платформа; 25% — на боковых уступах (риск/награда)
    if (st.i % 3 === 0) {
      const side = r() < 0.25 ? (r() < 0.5 ? -1 : 1) * (1.4 + r() * 0.6) : 0;
      st.coins.push([snap(p.x + side), snap(p.y + 1.0), snap(p.z)]);
    }
    // hazard-блоки: рядом с путём, нужно обходить (не на самой платформе!)
    if (hazardP && r() < hazardP) {
      const off = (r() < 0.5 ? -1 : 1) * (w * 0.5 + 0.9);
      st.hazards.push({
        x: snap(p.x + off), y: snap(p.y + 0.9), z: snap(p.z),
        sx: 1, sy: 1.6, sz: 1
      });
    }
    // чекпоинты на 50% и 75% общего пути
    if (st.i === st.cp1 || st.i === st.cp2) {
      st.checkpoints.push([snap(p.x), snap(p.y + 0.6), snap(p.z)]);
    }
  }
  st.dir = dir !== undefined ? dir : st.dir;
}

function genLevel(n) {
  const r = rng(1000 + n * 77);
  // --- Уровень 1 = тутор (не меняем) ---
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

  // --- архетип по номеру уровня (кривая обучения); индекс = номер уровня ---
  const ARCHS = [
    null, null,                   // 0 не используется, 1 тутор
    'climb', 'climb',             // 2-3
    'descent', 'serpentine',      // 4-5
    'ice', 'climb',               // 6-7
    'crumble', 'serpentine',      // 8-9
    'shaft', 'gauntlet',          // 10-11
    'descent', 'movers',          // 12-13
    'ice', 'crumble',             // 14-15
    'mixed', 'gauntlet',          // 16-17
    'movers', 'mixed',            // 18-19
    'mixed',                      // 20 финал
  ];
  const arch = ARCHS[Math.min(n, ARCHS.length - 1)];

  const steps = 10 + Math.floor(n * 1.2);
  const st = {
    plats: [{ x: 0, y: 0, z: 0, sx: 7, sy: 1, sz: 7, mat: 'grass' }],
    coins: [], checkpoints: [], hazards: [],
    pos: { x: 0, y: 0, z: 0 }, dir: -1, i: 0,
    cp1: Math.floor(steps / 2), cp2: Math.floor(steps * 0.75),
  };

  const wBase = 3.0 - Math.min(n * 0.06, 1.4);   // 3.0 → 1.6
  const gapBase = Math.min(1.3 + n * 0.05, 2.6); // разрыв растёт с уровнем
  const moverP = n >= 3 ? 0.14 + n * 0.006 : 0;
  const GRASS = ['grass', 'stone', 'wood', 'sand'];

  const seg = (len, cfg) => addSegment(st, r, Object.assign({
    len, mats: GRASS, wBase, gapBase, moverP,
  }, cfg));

  switch (arch) {
    case 'climb':
      seg(steps, { dir: -1, prof: 'climb' });
      break;
    case 'descent': {
      // СНАЧАЛА набираем высоту (иначе спуск с y=0 упирается в кламп -4 и «плоскает»).
      // Затем настоящий длинный спуск и короткий подъём к финишу.
      const up = Math.max(4, Math.floor(steps * 0.3));
      const down = Math.floor(steps * 0.5);
      seg(up, { dir: -1, prof: 'climb' });
      seg(down, { dir: -1, prof: 'descent', gapBase: gapBase * 0.85 });
      seg(steps - up - down, { dir: -1, prof: 'climb' });
      break;
    }
    case 'serpentine': {
      // U-повороты: 3-4 колена чередуют направление ±z
      const legs = 4;
      const per = Math.ceil(steps / legs);
      for (let L = 0; L < legs; L++) {
        const len = Math.min(per, steps - L * per);
        if (len <= 0) break;
        seg(len, { dir: L % 2 === 0 ? -1 : 1, prof: L % 2 === 0 ? 'climb' : 'flat' });
      }
      break;
    }
    case 'ice':
      seg(steps, { dir: -1, prof: 'flat', mats: ['ice', 'ice', 'stone'], gapBase: gapBase * 0.7, wBase: wBase + 0.4 });
      break;
    case 'crumble':
      seg(steps, { dir: -1, prof: 'climb', mats: ['wood', 'wood', 'stone'], crumbleP: 0.45, gapBase: gapBase * 0.85 });
      break;
    case 'shaft':
      seg(steps, { dir: -1, prof: 'shaft', gapBase: 1.1, wBase: wBase + 0.2, moverP: moverP * 0.5 });
      break;
    case 'gauntlet':
      seg(steps, { dir: -1, prof: 'flat', hazardP: 0.3, gapBase: gapBase * 0.8 });
      break;
    case 'movers':
      seg(steps, { dir: -1, prof: 'climb', moverP: 0.5, gapBase: gapBase * 0.75 });
      break;
    case 'mixed': {
      const a = Math.floor(steps * 0.4), b = Math.floor(steps * 0.3);
      seg(a, { dir: -1, prof: 'climb', moverP });
      seg(b, { dir: 1, prof: 'flat', mats: ['ice', 'stone'], gapBase: gapBase * 0.7 });
      seg(steps - a - b, { dir: -1, prof: 'climb', crumbleP: 0.25, hazardP: 0.15 });
      break;
    }
    default:
      seg(steps, { dir: -1, prof: 'climb' });
  }

  // финишная платформа
  const fp = st.pos;
  st.plats.push({ x: snap(fp.x), y: snap(fp.y + 0.5), z: snap(fp.z + st.dir * 3.5), sx: 6, sy: 1, sz: 6, mat: 'gold' });
  return {
    name: `Уровень ${n}`,
    archetype: arch,
    start: [0, 2, 0],
    platforms: st.plats, coins: st.coins, checkpoints: st.checkpoints,
    hazards: st.hazards,
    finish: [snap(fp.x), snap(fp.y + 1.6), snap(fp.z + st.dir * 3.5)],
    lava_y: -6.0, lava_size: 320.0
  };
}

for (let n = 1; n <= 20; n++) {
  const def = genLevel(n);
  const file = path.join(OUT, String(n).padStart(2, '0') + '.json');
  fs.writeFileSync(file, JSON.stringify(def, null, 0));
}

// Уровень 21 — «ХАКЕР»: неоновая матрица (теперь с U-поворотами и mover'ами)
(function genHackerLevel() {
  const r = rng(777);
  const platforms = [{ x: 0, y: 0, z: 0, sx: 7, sy: 1, sz: 7, mat: 'neon' }];
  const coins = [];
  const checkpoints = [];
  let pos = { x: 0, y: 0, z: 0 };
  let dir = -1;
  const steps = 24;
  const mats = ['neon', 'dark', 'stone'];
  for (let i = 1; i <= steps; i++) {
    // два колена: вперёд и назад (серпантин в матрице)
    if (i === 9 || i === 17) dir = -dir;
    const nx = pos.x + (r() * 2.2 - 1.1);
    const nz = pos.z + dir * (2.2 + 1.6 + r() * 0.5);
    const ny = pos.y + (i % 3 === 0 ? -(0.4 + r() * 0.5) : (r() * 0.9 - 0.2));
    const w = 2.2 + r() * 0.8;
    const p = {
      x: snap(Math.max(-9, Math.min(9, nx))), y: snap(Math.max(-4, Math.min(8, ny))), z: snap(nz),
      sx: snap(w), sy: 0.6, sz: snap(w),
      mat: mats[i % 3]
    };
    if (i % 4 === 0) p.move = { axis: r() < 0.5 ? 'x' : 'y', range: 1.8, speed: 1.4 + r() * 1.4 };
    platforms.push(p);
    pos = { x: p.x, y: p.y, z: p.z };
    if (i % 2 === 0) coins.push([snap(pos.x), snap(pos.y + 1.0), snap(pos.z)]);
    if (i === 12) checkpoints.push([snap(pos.x), snap(pos.y + 0.6), snap(pos.z)]);
  }
  platforms.push({ x: snap(pos.x), y: snap(pos.y + 0.5), z: snap(pos.z + dir * 3.2), sx: 5, sy: 1, sz: 5, mat: 'gold' });
  const def = {
    name: 'ХАКЕР',
    theme: 'hacker',
    archetype: 'serpentine',
    start: [0, 2, 0],
    platforms, coins, checkpoints,
    finish: [snap(pos.x), snap(pos.y + 1.6), snap(pos.z + dir * 3.2)],
    lava_y: -6.0, lava_size: 320.0
  };
  fs.writeFileSync(path.join(OUT, '21.json'), JSON.stringify(def, null, 0));
  console.log('Hacker level (21) generated');
})();

console.log('Generated 21 levels into', OUT);
