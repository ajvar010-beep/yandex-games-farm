/* game/logic.js — физика-лайт и правила «Гвоздей» без DOM.
   Шары падают с гравитацией, отскакивают от шпилек-отрезков и бортов, попадают в чаши.
   Игрок снимает шпильки — это единственное действие. Ничего случайного: Math.random
   здесь нет вообще, поэтому уровень детерминирован от начала до конца. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var C = G.config;
  var L = {};

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  L.clamp = clamp;

  L.count = function () { return C.levels.length; };

  L.level = function (n) {
    return C.levels[clamp((n | 0) - 1, 0, C.levels.length - 1)];
  };

  /* ---------- создание забега ---------- */
  L.newRun = function (opt) {
    opt = opt || {};
    var n = clamp(opt.level | 0, 1, C.levels.length);
    var lv = L.level(n);
    var st = {
      n: n,
      lv: lv,
      pins: [],
      cups: [],
      balls: [],
      events: [],
      t: 0,
      spawnT: C.drop.first,
      spawnIdx: 0,
      ballsLeft: lv.balls + (opt.extraBalls | 0),
      ballsTotal: lv.balls + (opt.extraBalls | 0),
      phase: 'run',            // run | win | lose
      slowT: 0,
      slowLeft: opt.slow | 0,
      pliersLeft: opt.pliers | 0,
      planIdx: 0,
      pulled: 0,
      landed: 0,
      lost: 0,
      waste: 0,
      lastCup: -1,
      lastPull: -1,
      pullFlash: 0
    };
    for (var i = 0; i < lv.pins.length; i++) {
      var p = lv.pins[i];
      st.pins.push({ x1: p[0], y1: p[1], x2: p[2], y2: p[3], gone: false, hit: 0 });
    }
    for (var c = 0; c < 3; c++) {
      st.cups.push({ need: lv.need[c] | 0, got: 0, pulse: 0, flash: 0 });
    }
    return st;
  };

  /* ---------- геометрия ---------- */
  L.cupAt = function (st, x) {
    for (var i = 0; i < 3; i++) {
      var c = C.cups[i];
      if (x >= c.x1 && x <= c.x2) return i;
    }
    return -1;
  };

  /* Ближайшая шпилька к точке (bx,by) в единицах доски; tol — допуск тапа. */
  L.pinAt = function (st, bx, by, tol) {
    var best = -1, bestD = tol == null ? 5 : tol;
    for (var i = 0; i < st.pins.length; i++) {
      var p = st.pins[i];
      if (p.gone) continue;
      var d = segDist(bx, by, p.x1, p.y1, p.x2, p.y2) - C.board.pinHalf;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  };

  function segDist(px, py, ax, ay, bx, by) {
    var abx = bx - ax, aby = by - ay;
    var l2 = abx * abx + aby * aby;
    var t = l2 > 0 ? ((px - ax) * abx + (py - ay) * aby) / l2 : 0;
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    var dx = px - (ax + abx * t), dy = py - (ay + aby * t);
    return Math.sqrt(dx * dx + dy * dy);
  }
  L.segDist = segDist;

  L.raise = function (st, i) {
    var p = st.pins[i];
    if (!p || p.gone || st.phase !== 'run') return false;
    p.gone = true;
    st.pulled++;
    st.lastPull = i;
    st.pullFlash = 0.45;
    st.events.push({ type: 'pull', i: i, x: (p.x1 + p.x2) / 2, y: (p.y1 + p.y2) / 2 });
    return true;
  };

  /* Тап игрока: снять ближайшую шпильку в допуске. */
  L.tap = function (st, bx, by, tol) {
    var i = L.pinAt(st, bx, by, tol);
    if (i < 0) return -1;
    return L.raise(st, i) ? i : -1;
  };

  /* Клещи: снять следующую по плану шпильку, которая ещё стоит. */
  L.pliers = function (st) {
    if (st.phase !== 'run' || st.pliersLeft <= 0) return -1;
    var plan = st.lv.plan || [];
    for (var k = 0; k < plan.length; k++) {
      var i = plan[k].p;
      if (st.pins[i] && !st.pins[i].gone) {
        if (L.raise(st, i)) { st.pliersLeft--; return i; }
      }
    }
    return -1;
  };

  /* Автопилот: проверяет время плана и снимает шпильки сам. */
  L.autopilot = function (st) {
    var plan = st.lv.plan || [];
    while (st.planIdx < plan.length && st.t >= plan[st.planIdx].at) {
      var i = plan[st.planIdx].p;
      if (st.pins[i] && !st.pins[i].gone) L.raise(st, i);
      st.planIdx++;
    }
  };

  /* Бросок медленного времени (5 с на заряд). */
  L.slow = function (st) {
    if (st.phase !== 'run' || st.slowLeft <= 0 || st.slowT > 0) return false;
    st.slowLeft--;
    st.slowT = 5;
    st.events.push({ type: 'slow' });
    return true;
  };

  /* ---------- физика ---------- */
  var PH = C.phys;
  var BW = C.board.W, BH = C.board.H;

  function collideSeg(b, p) {
    var ax = p.x1, ay = p.y1, bx = p.x2, by = p.y2;
    var abx = bx - ax, aby = by - ay;
    var l2 = abx * abx + aby * aby;
    var t = l2 > 0 ? ((b.x - ax) * abx + (b.y - ay) * aby) / l2 : 0;
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    var cx = ax + abx * t, cy = ay + aby * t;
    var dx = b.x - cx, dy = b.y - cy;
    var d2 = dx * dx + dy * dy;
    var rr = PH.r + C.board.pinHalf;
    if (d2 > rr * rr) return;
    var d = Math.sqrt(d2);
    var nx, ny;
    if (d < 0.0001) {
      var len = Math.sqrt(l2) || 1;
      nx = -aby / len; ny = abx / len;
      if (ny > 0) { nx = -nx; ny = -ny; }
      d = 0;
    } else {
      nx = dx / d; ny = dy / d;
    }
    b.x += nx * (rr - d);
    b.y += ny * (rr - d);
    var vn = b.vx * nx + b.vy * ny;
    if (vn < 0) {
      b.vx -= (1 + PH.rest) * vn * nx;
      b.vy -= (1 + PH.rest) * vn * ny;
      var tx = -ny, ty = nx;
      var vt = b.vx * tx + b.vy * ty;
      b.vx -= vt * PH.fric * tx;
      b.vy -= vt * PH.fric * ty;
      p.hit = 1;
    }
  }

  function stepBall(st, b, h) {
    b.vy += PH.g * h;
    var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    if (sp > PH.maxV) { b.vx *= PH.maxV / sp; b.vy *= PH.maxV / sp; }
    b.x += b.vx * h;
    b.y += b.vy * h;

    var lo = C.board.wall + PH.r, hi = BW - C.board.wall - PH.r;
    if (b.x < lo) { b.x = lo; if (b.vx < 0) b.vx = -b.vx * 0.55; }
    else if (b.x > hi) { b.x = hi; if (b.vx > 0) b.vx = -b.vx * 0.55; }

    for (var i = 0; i < st.pins.length; i++) {
      var p = st.pins[i];
      if (!p.gone) collideSeg(b, p);
    }
    if (b.y > C.board.mouthY - 18) {
      // нижние «рожки» чаш: не дают шару выкатиться из чаши, но не мешают входу
    }
  }

  /* ---------- шаг симуляции (фикс 1/60 снаружи) ---------- */
  L.update = function (st, dt) {
    if (!st || st.phase !== 'run') return;
    var k = st.slowT > 0 ? 0.32 : 1;
    if (st.slowT > 0) st.slowT = Math.max(0, st.slowT - dt);
    var gdt = dt * k;
    st.t += gdt;
    if (st.pullFlash > 0) st.pullFlash = Math.max(0, st.pullFlash - dt);
    for (var c = 0; c < 3; c++) {
      var cu = st.cups[c];
      if (cu.pulse > 0) cu.pulse = Math.max(0, cu.pulse - dt);
      if (cu.flash > 0) cu.flash = Math.max(0, cu.flash - dt);
    }
    for (var q = 0; q < st.pins.length; q++) {
      if (st.pins[q].hit > 0) st.pins[q].hit = Math.max(0, st.pins[q].hit - dt * 5);
    }

    // спавн шаров из бункера
    st.spawnT -= gdt;
    if (st.spawnT <= 0 && st.ballsLeft > 0) {
      var sx = st.lv.spawn && st.lv.spawn.length
        ? st.lv.spawn[st.spawnIdx % st.lv.spawn.length] : 50;
      st.spawnIdx++;
      st.ballsLeft--;
      st.balls.push({ x: sx, y: 8, vx: 0, vy: 0, born: 0, still: 0 });
      st.events.push({ type: 'spawn', x: sx });
      st.spawnT += C.drop.every;
    }

    var h = gdt / PH.sub;
    for (var bi = st.balls.length - 1; bi >= 0; bi--) {
      var b = st.balls[bi];
      b.born += gdt;
      for (var s = 0; s < PH.sub; s++) stepBall(st, b, h);
      // страховка от «залипания»: шар, застрявший на полке, не должен вешать уровень
      var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      b.still = (sp < 4.5 && b.born > 0.6) ? b.still + gdt : 0;
      if (b.still > 1.6 || b.born > 14) {
        st.balls.splice(bi, 1);
        st.lost++;
        st.events.push({ type: 'stuck', x: b.x, y: b.y });
        continue;
      }
      // чаша / слив
      if (b.y > C.board.mouthY + 3.2) {
        var ci = L.cupAt(st, b.x);
        if (ci >= 0) {
          var cup = st.cups[ci];
          st.balls.splice(bi, 1);
          if (cup.got < cup.need) {
            cup.got++;
            cup.pulse = 0.5;
            cup.flash = 0.45;
            st.landed++;
            st.lastCup = ci;
            st.events.push({ type: 'cup', cup: ci, x: b.x, y: C.board.mouthY + 3 });
            if (cup.got >= cup.need) st.events.push({ type: 'filled', cup: ci });
          } else {
            st.waste++;
            st.events.push({ type: 'waste', cup: ci, x: b.x, y: C.board.mouthY + 3 });
          }
          continue;
        }
      }
      if (b.y > C.board.deadY) {
        st.balls.splice(bi, 1);
        st.lost++;
        st.events.push({ type: 'lost', x: b.x, y: C.board.bottomY });
      }
    }

    // победа / поражение
    var full = 0;
    for (var w = 0; w < 3; w++) if (st.cups[w].got >= st.cups[w].need) full++;
    if (full === 3) {
      st.phase = 'win';
      st.events.push({ type: 'win' });
    } else if (st.ballsLeft === 0 && st.balls.length === 0) {
      st.phase = 'lose';
      st.events.push({ type: 'lose' });
    }
  };

  /* Сколько шаров ещё не вышло из бункера. */
  L.ballsLeft = function (st) { return st.ballsLeft + st.balls.length; };

  /* «Оживить» после рекламы: +N шаров и продолжить забег. */
  L.revive = function (st, n) {
    if (st.phase !== 'lose') return false;
    st.phase = 'run';
    st.ballsLeft += Math.max(1, n | 0);
    st.ballsTotal += Math.max(1, n | 0);
    st.spawnT = Math.min(st.spawnT, 0.35);
    st.events.push({ type: 'revive' });
    return true;
  };

  L.takeEvents = function (st) {
    if (!st.events.length) return [];
    var out = st.events;
    st.events = [];
    return out;
  };

  L.maxPins = function () {
    var m = 0;
    for (var i = 0; i < C.levels.length; i++) m = Math.max(m, C.levels[i].pins.length);
    return m;
  };

  G.logic = L;
})(window.GAME);
