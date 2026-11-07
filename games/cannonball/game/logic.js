/* game/logic.js — чистая баллистика «Ядра»: мир 1000×1000, ядро, гравитация, отскоки
   от стальных блоков и бортов, цели-круги (часть — качается). Никакого DOM, никакого
   Math.random: вся случайность — только у сцены для искр, и тоже через E.Rng.
   Один и тот же шаг (L.update) и предиктор (L.trace) гоняют ОДНУ функцию ballStep,
   поэтому автопилот, подсказка траектории и живой полёт совпадают до пикселя. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  var C = G.config;
  var P = C.physics;
  var W = C.world;
  var L = {};
  var STEP = 1 / 60;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  L.clamp = clamp;

  L.levelCount = function () { return C.levels.length; };
  L.level = function (i) { return C.levels[clamp(i | 0, 0, C.levels.length - 1)]; };

  /* Позиция цели в момент t: часть целей качается по синусу — детерминированно. */
  function tpos(tg, t) {
    if (!tg.mv) return { x: tg.x, y: tg.y };
    var s = Math.sin(t * tg.sp + tg.ph);
    return { x: tg.x + tg.mx * s, y: tg.y + tg.my * s };
  }
  L.tpos = tpos;

  /* ---------- состояние уровня ---------- */
  L.newLevel = function (idx, opts) {
    opts = opts || {};
    var i = clamp(idx | 0, 0, C.levels.length - 1);
    var def = C.levels[i];
    var targets = [];
    for (var k = 0; k < def.targets.length; k++) {
      var d = def.targets[k];
      var mx = d.mx || 0, my = d.my || 0;
      targets.push({
        x: d.x, y: d.y, r: d.r,
        mx: mx, my: my, sp: d.sp || 1, ph: d.ph || 0,
        mv: !!(mx || my),
        alive: true, hitT: -1
      });
    }
    return {
      idx: i, def: def, number: def.n,
      t: 0,
      shots: def.shots + (opts.extraShots | 0),
      maxShots: def.shots + (opts.extraShots | 0),
      targets: targets,
      balls: [],
      events: [],
      phase: 'aim',            // aim | fly | win | over
      fired: 0, hits: 0, perfect: true,
      recordSafe: false
    };
  };

  L.aliveCount = function (st) {
    var n = 0;
    for (var i = 0; i < st.targets.length; i++) if (st.targets[i].alive) n++;
    return n;
  };
  L.allDead = function (st) { return L.aliveCount(st) === 0; };

  /* ---------- скорость / дуло ---------- */
  L.speedFor = function (power) {
    var p = clamp(power, 0, 1);
    return P.speedMin + (P.speedMax - P.speedMin) * p;
  };
  L.muzzle = function (angle) {
    return { x: C.cannon.x + Math.cos(angle) * C.cannon.len,
             y: C.cannon.y + Math.sin(angle) * C.cannon.len };
  };
  /* Наводка по точке мира: направление — на палец, сила — по расстоянию. */
  L.aim = function (wx, wy) {
    var dx = wx - C.cannon.x, dy = wy - C.cannon.y;
    if (dx < 24) return null;
    var ang = Math.atan2(dy, dx);
    var power = clamp(Math.sqrt(dx * dx + dy * dy) / P.dragMax, 0, 1);
    return { angle: clamp(ang, P.angleMin, P.angleMax), power: power };
  };

  /* ---------- один подшаг ядра ---------- */
  function subSteps(b) {
    var v = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    var n = Math.ceil(v * STEP / 8);
    return n < 1 ? 1 : (n > 4 ? 4 : n);
  }

  function ballStep(b, walls, targets, t, h, ev) {
    b.x += b.vx * h;
    b.y += b.vy * h;
    var i, w, ex, ey, ew, eh, dl, dr, dtp, db, m;
    for (i = 0; i < walls.length; i++) {
      w = walls[i];
      ex = w.x - P.ballR; ey = w.y - P.ballR;
      ew = w.w + P.ballR * 2; eh = w.h + P.ballR * 2;
      if (b.x > ex && b.x < ex + ew && b.y > ey && b.y < ey + eh) {
        dl = b.x - ex; dr = ex + ew - b.x; dtp = b.y - ey; db = ey + eh - b.y;
        m = Math.min(dl, dr, dtp, db);
        if (m === dl) { b.x = ex; if (b.vx > 0) b.vx = -b.vx * P.restitution; b.vy *= P.friction; }
        else if (m === dr) { b.x = ex + ew; if (b.vx < 0) b.vx = -b.vx * P.restitution; b.vy *= P.friction; }
        else if (m === dtp) { b.y = ey; if (b.vy > 0) b.vy = -b.vy * P.restitution; b.vx *= P.friction; }
        else { b.y = ey + eh; if (b.vy < 0) b.vy = -b.vy * P.restitution; b.vx *= P.friction; }
        b.bounces++;
        if (ev) ev.push({ type: 'bounce', x: b.x, y: b.y });
      }
    }
    for (i = 0; i < targets.length; i++) {
      var tg = targets[i];
      if (!tg.alive) continue;
      var p = tpos(tg, t);
      var dx = b.x - p.x, dy = b.y - p.y, rr = tg.r + P.ballR;
      if (dx * dx + dy * dy <= rr * rr) {
        tg.alive = false; tg.hitT = 0;
        b.vx *= 0.94; b.vy *= 0.94;
        if (ev) ev.push({ type: 'hit', idx: i, x: p.x, y: p.y, r: tg.r });
      }
    }
    // борта арены и земля
    if (b.x < P.ballR) { b.x = P.ballR; if (b.vx < 0) b.vx = -b.vx * P.restitution; b.vy *= P.friction; b.bounces++; }
    else if (b.x > W.w - P.ballR) { b.x = W.w - P.ballR; if (b.vx > 0) b.vx = -b.vx * P.restitution; b.vy *= P.friction; b.bounces++; }
    if (b.y < P.ballR) { b.y = P.ballR; if (b.vy < 0) b.vy = -b.vy * P.restitution; b.vx *= P.friction; b.bounces++; }
    else if (b.y > W.ground - P.ballR) {
      b.y = W.ground - P.ballR;
      if (b.vy > 0) b.vy = -b.vy * P.restitution;
      b.vx *= 0.92; b.bounces++;
    }
  }

  /* ---------- выстрел ---------- */
  L.fire = function (st, angle, power) {
    if (st.phase !== 'aim' || st.shots <= 0) return false;
    var ang = clamp(angle, P.angleMin, P.angleMax);
    var pw = clamp(power, 0.06, 1);
    var sp = L.speedFor(pw);
    var m = L.muzzle(ang);
    st.balls.push({
      x: m.x, y: m.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
      age: 0, bounces: 0, dead: false, power: pw,
      trail: [{ x: m.x, y: m.y }]
    });
    st.shots--; st.fired++;
    st.phase = 'fly';
    st.events.push({ type: 'fire', angle: ang, power: pw, x: m.x, y: m.y });
    return true;
  };

  /* ---------- шаг мира ---------- */
  function settle(st) {
    if (st.phase !== 'aim' && st.phase !== 'fly') return;
    var i;
    if (L.allDead(st)) {
      st.phase = 'win';
      st.events.push({ type: 'win' });
      return;
    }
    if (st.phase === 'fly') {
      for (i = 0; i < st.balls.length; i++) if (!st.balls[i].dead) return;
      if (st.shots > 0) {
        st.phase = 'aim';
        st.events.push({ type: 'ready' });
      } else {
        st.phase = 'over';
        st.events.push({ type: 'over' });
      }
    }
  }

  L.update = function (st, dt) {
    st.t += dt;
    var i, j, b;
    for (i = 0; i < st.targets.length; i++) {
      var tg = st.targets[i];
      if (!tg.alive && tg.hitT >= 0) tg.hitT += dt;
    }
    for (i = 0; i < st.balls.length; i++) {
      b = st.balls[i];
      if (b.dead) continue;
      b.age += dt;
      var n = subSteps(b);
      var h = dt / n;
      for (j = 0; j < n; j++) ballStep(b, st.def.walls, st.targets, st.t, h, st.events);
      if (b.age >= P.maxTime) b.dead = true;
      var sp2 = b.vx * b.vx + b.vy * b.vy;
      if (b.y >= W.ground - P.ballR - 2 && sp2 < 110 * 110) b.dead = true;
      if (!b.dead) {
        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > 70) b.trail.shift();
      } else {
        st.events.push({ type: 'land', x: b.x, y: b.y });
      }
    }
    // выпавшие ядра убираем (после снятия событий сцены)
    for (i = st.balls.length - 1; i >= 0; i--) if (st.balls[i].dead) st.balls.splice(i, 1);
    settle(st);
    return st;
  };

  L.takeEvents = function (st) { var e = st.events; st.events = []; return e; };

  /* ---------- предиктор траектории (подсказка + автопилот) ----------
     Гоняет те же ballStep с шагом 1/60, что и живой полёт. opts.pts=false — не копить
     точки (для перебора), maxT — сколько секунд считать. */
  L.trace = function (st, angle, power, opts) {
    opts = opts || {};
    var wantPts = opts.pts !== false;
    var maxT = opts.maxT || 4.2;
    var ang = clamp(angle, P.angleMin, P.angleMax);
    var sp = L.speedFor(clamp(power, 0.06, 1));
    var m = L.muzzle(ang);
    var b = { x: m.x, y: m.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
              age: 0, bounces: 0, dead: false };
    var targets = [];
    for (var i = 0; i < st.targets.length; i++) {
      var tg = st.targets[i];
      targets.push({ x: tg.x, y: tg.y, r: tg.r, mx: tg.mx, my: tg.my, sp: tg.sp, ph: tg.ph,
                     mv: tg.mv, alive: tg.alive });
    }
    var pts = [{ x: b.x, y: b.y }];
    var hits = [], ev = [];
    var t = st.t;
    var steps = Math.round(maxT * 60);
    for (var k = 0; k < steps; k++) {
      t += STEP;
      var n = subSteps(b), h = STEP / n;
      ev.length = 0;
      for (var s = 0; s < n; s++) ballStep(b, st.def.walls, targets, t, h, ev);
      for (var q = 0; q < ev.length; q++) {
        if (ev[q].type === 'hit') hits.push({ idx: ev[q].idx, step: k, x: ev[q].x, y: ev[q].y, r: ev[q].r });
      }
      if (wantPts) pts.push({ x: b.x, y: b.y });
      var sp2 = b.vx * b.vx + b.vy * b.vy;
      if (b.y >= W.ground - P.ballR - 2 && sp2 < 110 * 110) break;
      if (L.allDeadTargets(targets)) break;
    }
    return { pts: pts, hits: hits, bounces: b.bounces, endX: b.x, endY: b.y };
  };

  L.allDeadTargets = function (arr) {
    for (var i = 0; i < arr.length; i++) if (arr[i].alive) return false;
    return true;
  };

  /* ---------- автопилот: перебор углов и сил ---------- */
  L.solve = function (st) {
    if (st.phase !== 'aim' || st.shots <= 0) return null;
    var alive = L.aliveCount(st);
    if (!alive) return null;
    var best = null;
    var a0 = -1.5, a1 = 0.13;
    var NA = 23, NP = 8;
    for (var ai = 0; ai <= NA; ai++) {
      var ang = a0 + (a1 - a0) * ai / NA;
      for (var pi = NP; pi >= 2; pi--) {
        var pw = pi / NP;
        var tr = L.trace(st, ang, pw, { pts: false });
        var n = 0, firstStep = 999;
        for (var h = 0; h < tr.hits.length; h++) {
          n++;
          if (tr.hits[h].step < firstStep) firstStep = tr.hits[h].step;
        }
        if (n <= 0) continue;
        if (!best || n > best.n || (n === best.n && tr.bounces < best.bounces)) {
          best = { n: n, angle: ang, power: pw, bounces: tr.bounces, firstStep: firstStep };
        }
      }
    }
    return best ? { angle: best.angle, power: best.power, count: best.n } : null;
  };

  /* ---------- демо-кадр для скриншота: ядро в полёте по найденному решению ---------- */
  L.demo = function (st, frac) {
    var sol = L.solve(st);
    if (!sol) return false;
    var tr = L.trace(st, sol.angle, sol.power, { pts: true, maxT: 3.4 });
    var n = tr.pts.length;
    if (n < 4) return false;
    var idx = Math.round(clamp(frac, 0.12, 0.9) * (n - 1));
    if (idx < 3) idx = 3;
    var p0 = tr.pts[idx], p1 = tr.pts[Math.min(idx + 1, n - 1)];
    var vx = (p1.x - p0.x) * 60, vy = (p1.y - p0.y) * 60;
    // цели, которые ядро уже разбило до этой точки
    var killed = [];
    for (var i = 0; i < tr.hits.length; i++) if (tr.hits[i].step < idx) killed.push(tr.hits[i].idx);
    if (killed.length >= st.targets.length) killed.pop();
    for (var k = 0; k < killed.length; k++) {
      var tg = st.targets[killed[k]];
      tg.alive = false; tg.hitT = 0.25;
    }
    var trail = tr.pts.slice(Math.max(0, idx - 46), idx + 1);
    st.balls.push({ x: p0.x, y: p0.y, vx: vx, vy: vy, age: 0.3, bounces: 0, dead: false,
                    power: sol.power, trail: trail });
    st.shots = Math.max(1, st.shots - 1);
    st.fired = 1;
    st.phase = L.allDead(st) ? 'win' : 'fly';
    return { angle: sol.angle, power: sol.power, count: sol.count };
  };

  L.simulate = function (st, sec) {
    var n = Math.max(0, Math.round(sec * 60));
    for (var i = 0; i < n; i++) L.update(st, STEP);
    return st;
  };

  G.logic = L;
})(window.GAME);
