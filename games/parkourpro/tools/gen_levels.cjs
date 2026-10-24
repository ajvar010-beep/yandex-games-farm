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

// v8.2 (крит): СОФТЛОК НАВИСАНИЯ. Верхний ярус серпантина/mixed вставал над нижним
// с просветом 0.7м < капсулы игрока 1.4м → lvl 5/9/16/19/20/21 непроходимы.
// smoke_test v8 проверял только gap/dy СОСЕДНИХ платформ и это пропускал.
// Инвариант: для любой пары НЕсоседних платформ (|i-j|≥2) с XZ-перекрытием >0.3м
// просвет ≥1.9м (1.4 капсула + 0.5 запас на прыжок под нависанием). Нарушение →
// поднять верхнюю платформу И весь хвост маршрута (dy между ними сохраняется,
// плавность маршрута не ломается). Мутирует plats in-place; ВОЗВРАЩАЕТ lift[i] —
// суммарный подъём платформы i, чтобы вызывающий сдвинул монеты/чекпоинты/hazard.
function fixOverhangs(plats) {
  const CLEARANCE = 1.9;
  const lift = new Array(plats.length).fill(0);
  // Полный проход за раз (без раннего break): за проход чиним ВСЕ пары. Подъём
  // монотонный (только +y) и применяется к хвосту маршрута от hiI, поэтому
  // конфликт «нижняя раньше, верхняя позже» разрешается поднятием «позже».
  // При равных y верхняя = с БОЛЬШИМ индексом (дальше по маршруту).
  for (let pass = 0; pass < 80; pass++) {
    let changed = false;
    for (let i = 0; i < plats.length; i++) {
      for (let j = i + 1; j < plats.length; j++) {
        if (j - i < 2) continue;
        const a = plats[i], b = plats[j];
        const ox = (a.sx + b.sx) / 2 - Math.abs(a.x - b.x);
        const oz = (a.sz + b.sz) / 2 - Math.abs(a.z - b.z);
        if (ox <= 0.3 || oz <= 0.3) continue;
        // hi = платформа с большим y (при равенстве — с большим индексом = позже)
        const hiIsB = (b.y > a.y) || (b.y === a.y);
        const lo = hiIsB ? a : b, hi = hiIsB ? b : a;
        const hiI = hiIsB ? j : i;
        const clearance = (hi.y - hi.sy / 2) - (lo.y + lo.sy / 2);
        if (clearance < CLEARANCE) {
          const d = Math.ceil((CLEARANCE - clearance) * 2) / 2; // snap 0.5
          for (let k = hiI; k < plats.length; k++) { plats[k].y = snap(plats[k].y + d); lift[k] += d; }
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  return lift;
}

// применить подъём платформ к декорациям (монеты/чекпоинты/hazard), привязанным
// к индексу платформы _pi (см. addSegment). Сдвигает y на lift[_pi].
function liftDecorations(arr, lift, yGet, ySet) {
  for (const d of arr) {
    const li = lift[d._pi];
    if (li) ySet(d, snap(yGet(d) + li));
  }
}

// сегмент маршрута: len шагов в направлении dir(±1) с профилем высоты
function addSegment(st, r, cfg) {
  const { len, dir, prof, mats, wBase, gapBase, moverP, crumbleP, hazardP } = cfg;
  // направление задаём В НАЧАЛЕ сегмента (иначе поворот применяется с опозданием на сегмент)
  if (dir !== undefined) {
    // v8.2 (крит): U-ПОВОРОТ = СЛЕДУЮЩАЯ БОКОВАЯ ДОРОЖКА (x-lane, монотонно +4.5).
    // Возвратное колено идёт РЯДОМ с исходящим, а не НАД ним: вертикальный зазор
    // требовал бы +2.7м за один шаг (просвет 1.9 + sy 0.8), а предел прыжка god
    // 1.75м — стекинг колен был физически непроходим (софтлок lvl 5/9/16/19/20/21).
    // Шаг дорожки 4.5: соседние колена НЕ перекрываются по XZ даже при джиттере ±0.5
    // (worst dx 3.5 > (w1+w2)/2 − 0.3 ≈ 2.7), а шпилька-поворот worst dx 5.5 +
    // fwd ~4 → edge_gap ~3.7 ≤ 4.4 — проходима двойным прыжком.
    if (st.dir !== undefined && dir !== st.dir) {
      st.flipN += 1;
      // ВЕРШИНА ШПИЛЬКИ: переходная платформа МЕЖДУ дорожками — диагональный
      // прыжок 4.5x+4z (edge_gap ~5.1) не берётся даже двойным (лимит 4.4),
      // через apex — два прыжка ~2.6м каждый.
      const tz = st.pos.z + st.dir * ((cfg.gapBase || 1.6) + 2.0);
      st.plats.push({
        x: snap(st.xBase + 2.25), y: snap(st.pos.y + 0.35), z: snap(tz),
        sx: 2.2, sy: 0.8, sz: 2.2, mat: 'stone'
      });
      st.pos = { x: st.plats[st.plats.length - 1].x, y: st.plats[st.plats.length - 1].y, z: tz };
      st.xBase = st.flipN * 4.5;
    }
    st.dir = dir;
  }
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
    // x — вокруг БАЗЫ дорожки колена (v8.2). НЕ random-walk: дрейф возвращал колено
    // в зону перекрытия с нижним ярусом. Разброс ±0.5 (shaft ±0.4 — компактная колонна).
    const nx = st.xBase + (r() * 2.0 - 1.0) * (prof === 'shaft' ? 0.4 : 0.5);
    const ny = st.pos.y + dy;
    // ограничения мира: y ∈ [-4, yMax], |x| ≤ 16 (v8.2: расширено — дорожки колен).
    // v8.1 (консилиум v8 #1): yMax ПО АРХЕТИПУ — плоская шапка 8 превращала
    // climb/shaft/movers/mixed в плоские коридоры наверху (22 шага shaft × dy 1.35
    // ≈ 30м подъёма упиралось в 8 к 6-му шагу) — вертикальность, главная фишка
    // архетипов, терялась. Нижний кламп -4 общий (лава на -6).
    const y = Math.max(-4, Math.min(st.yMax, ny));
    const x = Math.max(-16, Math.min(16, nx));
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
    const _pi = st.plats.length - 1;  // индекс платформы — для liftDecorations (v8.2)
    st.pos = { x: p.x, y: p.y, z: p.z };
    st.i++;
    // монеты: каждая 3-я платформа; 25% — на боковых уступах (риск/награда)
    const hasCoin = st.i % 3 === 0;
    if (hasCoin) {
      const side = r() < 0.25 ? (r() < 0.5 ? -1 : 1) * (1.4 + r() * 0.6) : 0;
      const c = [snap(p.x + side), snap(p.y + 1.0), snap(p.z)];
      c._pi = _pi;
      st.coins.push(c);
    }
    // hazard-блоки: v8.1 (консилиум v8 #2) — НА пути, а не сбоку. Раньше off = w*0.5+0.9
    // ставил блок ЗА край платформы: бегущий прямо игрок его не задевал → «косметика».
    // Теперь: низкий блок (sy 0.45) в ЦЕНТРЕ прохода, верх kill-зоны p.y+0.95 →
    // подъём ног 0.55м — перепрыгивается даже god (apex 0.88м, double 1.76м);
    // на широких (w ≥ 2.6) можно и оббежать сбоку (дорожка ≥ 0.8м). Настоящий gauntlet.
    // Guards: НЕ на платформе с монетой (смерть при сборе) и НЕ перед чекпоинтом (см. ниже).
    if (hazardP && r() < hazardP && !hasCoin && !p.crumble && !p.move) {
      st.hazards.push({
        x: snap(p.x), y: snap(p.y + 0.625), z: snap(p.z),
        sx: 0.9, sy: 0.45, sz: 0.9, _pi
      });
      st._hazI = st.i;  // чекпоинт на этой платформе НЕ ставить (респавн в kill-зону)
    }
    // чекпоинты на 50% и 75% общего пути.
    // v8.1 (консилиум v8 #10): чекпоинт ТОЛЬКО на стабильной платформе (без move/crumble).
    // Раньше он ставился ровно на индексе cp1/cp2, который мог быть mover'ом — платформа
    // уезжала, а респавн телепортировал игрока в СТАТИЧНУЮ (пустую) точку (L19: 75% падений).
    // Теперь цель — «первая стабильная платформа НЕ РАНЬШЕ cpN», т.е. флаг может чуть
    // сместиться вперёд, но всегда стоит на твёрдой земле.
    // v8.1 (#2): и НЕ на платформе с hazard — иначе респавн/revive телепортирует
    // прямо в kill-зону (бесконечный луп смертей на месте).
    const stable = !p.move && !p.crumble && st.i !== st._hazI;
    if (stable && !st._cp1done && st.i >= st.cp1) {
      const cp = [snap(p.x), snap(p.y + 0.6), snap(p.z)]; cp._pi = _pi;
      st.checkpoints.push(cp);
      st._cp1done = true;
    } else if (stable && !st._cp2done && st.i >= st.cp2) {
      const cp = [snap(p.x), snap(p.y + 0.6), snap(p.z)]; cp._pi = _pi;
      st.checkpoints.push(cp);
      st._cp2done = true;
    }
  }
  st.dir = dir !== undefined ? dir : st.dir;
}

function genLevel(n) {
  const r = rng(1000 + n * 77);
  // --- Уровень 1 = тутор ---
  // v8.1 (консилиум v8 minor): предпоследняя платформа ПОДНЯТА на +1.4 — одиночный
  // прыжок её не берёт ни в одном варианте (apex: nub 1.34, pro 1.14, god 0.84),
  // а двойной берёт с запасом (2×apex ≥ 1.68) — тутор ЧЕСТНО тренирует двойной
  // прыжок (38% hop'ов god-серии требуют его, раньше lvl1 об этом не учил).
  // Чекпоинт ПЕРЕНЕСЁН на платформу z=-18: старый [0,0.5,-15] висел в ПРОРЫХЕ
  // между платформами — респавн после смерти ронял игрока в лаву (луп смертей).
  if (n === 1) {
    return {
      name: 'Обучение',
      start: [0, 2, 0],
      platforms: [
        { x: 0, y: 0, z: 0, sx: 8, sy: 1, sz: 8, mat: 'grass' },
        { x: 0, y: 0, z: -6, sx: 5, sy: 1, sz: 5, mat: 'grass' },
        { x: 0, y: 0.2, z: -12, sx: 4.5, sy: 1, sz: 4.5, mat: 'stone' },
        { x: 0, y: 0.4, z: -18, sx: 4, sy: 1, sz: 4, mat: 'stone' },
        { x: 0, y: 1.8, z: -24, sx: 4, sy: 1, sz: 4, mat: 'wood' },
        { x: 0, y: 2.2, z: -30, sx: 5, sy: 1, sz: 5, mat: 'gold' },
      ],
      coins: [[0, 1, -6], [0, 1.2, -12], [0, 1.4, -18], [0, 2.6, -24]],
      checkpoints: [[0, 1.0, -18]],
      finish: [0, 3.2, -30],
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

  // v8.1 (#1): потолок высоты ПО АРХЕТИПУ. Подъём = steps × средний dy, поэтому
  // «вертикальным» архетипам нужна большая шапка, иначе они сплющивались на y=8:
  //   shaft (dy~1.35 × 22 шага ≈ 30м), movers/climb (~28м), crumble/mixed (~24м).
  // Плоские/спускные (ice/gauntlet/descent/serpentine) остаются низкими — им 8 хватает.
  // Нижняя граница -4 общая (лава на -6, падение = смерть на любой высоте).
  const YMAX_BY_ARCH = {
    climb: 18, shaft: 34, crumble: 26, movers: 28, mixed: 24,
    descent: 12, serpentine: 14, ice: 8, gauntlet: 10,
  };
  const yMax = YMAX_BY_ARCH[arch] || 12;

  const steps = 10 + Math.floor(n * 1.2);
  const st = {
    plats: [{ x: 0, y: 0, z: 0, sx: 7, sy: 1, sz: 7, mat: 'grass' }],
    coins: [], checkpoints: [], hazards: [],
    pos: { x: 0, y: 0, z: 0 }, dir: -1, i: 0,
    xBase: 0, flipN: 0,  // v8.2: боковая дорожка колена (U-поворот → новая lane)
    cp1: Math.floor(steps / 2), cp2: Math.floor(steps * 0.75),
    _cp1done: false, _cp2done: false,  // v8.1 (#10): чекпоинты на стабильных платформах
    _hazI: -1,  // v8.1 (#2): индекс платформы с hazard — чекпоинт на ней не ставить
    yMax: yMax,  // v8.1 (#1): потолок высоты ПО АРХЕТИПУ (см. YMAX_BY_ARCH)
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
      // v8.1 (minor): лёд скользит по-настоящему (accel 0.25×), но скольжение было
      // ничем не наказуемо. Низкие hazard-блоки НА пути: на льду нельзя резко
      // затормозить/свернуть — проезд требует ЗАРАНЕЕ прыгать. Механика + угроза.
      seg(steps, { dir: -1, prof: 'flat', mats: ['ice', 'ice', 'stone'], gapBase: gapBase * 0.7, wBase: wBase + 0.4, hazardP: 0.14 });
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

  // финишная платформа (по последней платформе маршрута)
  const fp = st.plats[st.plats.length - 1];
  st.plats.push({ x: snap(fp.x), y: snap(fp.y + 0.5), z: snap(fp.z + st.dir * 3.5), sx: 6, sy: 1, sz: 6, mat: 'gold' });

  // v8.2 (крит): софтлок нависаний — ПОСЛЕ финиша (финиш 6×6 тоже может нависнуть).
  // Подъём платформ синхронно сдвигает монеты/чекпоинты/hazard (привязаны по _pi).
  const lift = fixOverhangs(st.plats);
  liftDecorations(st.coins, lift, (d) => d[1], (d, v) => { d[1] = v; });
  liftDecorations(st.checkpoints, lift, (d) => d[1], (d, v) => { d[1] = v; });
  liftDecorations(st.hazards, lift, (d) => d.y, (d, v) => { d.y = v; });
  const fp2 = st.plats[st.plats.length - 1];  // финишная платформа (после подъёмов)
  return {
    name: `Уровень ${n}`,
    archetype: arch,
    start: [0, 2, 0],
    platforms: st.plats, coins: st.coins, checkpoints: st.checkpoints,
    hazards: st.hazards.map(({ _pi, ...h }) => h),  // _pi — служебное, в JSON не идёт
    finish: [snap(fp2.x), snap(fp2.y + 1.1), snap(fp2.z)],  // точка-триггер над верхом платформы
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
  let cpDone = false;
  const steps = 24;
  const mats = ['neon', 'dark', 'stone'];
  let xBase = 0, flipN = 0;  // v8.2: дорожки колен (см. addSegment)
  for (let i = 1; i <= steps; i++) {
    // два колена: вперёд и назад (серпантин в матрице)
    if (i === 9 || i === 17) {
      dir = -dir;
      flipN += 1;
      xBase = flipN * 4.5;
    }
    // v8.2: x вокруг дорожки колена (не random-walk) — иначе возвратное колено
    // ложилось НАД исходящим с просветом -0.8м (софтлок, lvl21 был непроходим)
    const nx = xBase + (r() * 2.0 - 1.0) * 0.5;
    const nz = pos.z + dir * (2.2 + 1.6 + r() * 0.5);
    const ny = pos.y + (i % 3 === 0 ? -(0.4 + r() * 0.5) : (r() * 0.9 - 0.2));
    const w = 2.2 + r() * 0.8;
    const p = {
      x: snap(Math.max(-16, Math.min(16, nx))), y: snap(Math.max(-4, Math.min(8, ny))), z: snap(nz),
      sx: snap(w), sy: 0.6, sz: snap(w),
      mat: mats[i % 3]
    };
    if (i % 4 === 0) p.move = { axis: r() < 0.5 ? 'x' : 'y', range: 1.8, speed: 1.4 + r() * 1.4 };
    platforms.push(p);
    const _pi = platforms.length - 1;  // индекс платформы — для liftDecorations (v8.2)
    pos = { x: p.x, y: p.y, z: p.z };
    if (i % 2 === 0) {
      const c = [snap(pos.x), snap(pos.y + 1.0), snap(pos.z)];
      c._pi = _pi;
      coins.push(c);
    }
    // v8.1 (#10): чекпоинт на ПЕРВОЙ стабильной платформе не раньше i=12 (без move) —
    // раньше он стоял ровно на i=12, а это mover (i%4===0) → респавн в пустоту.
    if (!cpDone && i >= 12 && !p.move) {
      const cp = [snap(pos.x), snap(pos.y + 0.6), snap(pos.z)]; cp._pi = _pi;
      checkpoints.push(cp);
      cpDone = true;
    }
  }
  platforms.push({ x: snap(pos.x), y: snap(pos.y + 0.5), z: snap(pos.z + dir * 3.2), sx: 5, sy: 1, sz: 5, mat: 'gold' });
  // v8.2 (крит): софтлок нависаний (lvl21: старт 7×7 и plat15 перекрывались с
  // просветом -0.8м — уровень был непроходим). Подъём синхронит декорации.
  const lift = fixOverhangs(platforms);
  liftDecorations(coins, lift, (d) => d[1], (d, v) => { d[1] = v; });
  liftDecorations(checkpoints, lift, (d) => d[1], (d, v) => { d[1] = v; });
  const fp = platforms[platforms.length - 1];
  const def = {
    name: 'ХАКЕР',
    theme: 'hacker',
    archetype: 'serpentine',
    start: [0, 2, 0],
    platforms, coins, checkpoints,
    finish: [snap(fp.x), snap(fp.y + 1.0), snap(fp.z)],  // над верхом финишной платформы
    lava_y: -6.0, lava_size: 320.0
  };
  fs.writeFileSync(path.join(OUT, '21.json'), JSON.stringify(def, null, 0));
  console.log('Hacker level (21) generated');
})();

console.log('Generated 21 levels into', OUT);
