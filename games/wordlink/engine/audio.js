/* engine/audio.js — процедурный звук без единого аудиофайла.
   AudioContext создаётся ТОЛЬКО по первому жесту пользователя (unlock) — ноль autoplay-варнингов.
   suspend() на потере фокуса и на время рекламы (4.7, 1.3). Кнопка mute (6.2). */
window.Engine = window.Engine || {};
(function (E) {
  'use strict';
  var ctx = null, master = null, musicGain = null;
  var muted = false, adSuspended = false;
  var musicName = null, musicTimer = 0, nextNoteTime = 0, noteIdx = 0;
  var A = {};

  function createCtx() {
    if (ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 1;
      musicGain.connect(master);
    } catch (e) { ctx = null; return false; }
    return true;
  }

  A.unlock = function () { // вызывать только из обработчика жеста
    if (!createCtx()) return;
    if (ctx.state === 'suspended' && !adSuspended) ctx.resume().catch(function () {});
    if (musicName && !musicTimer) startMusicTimer();
  };
  A.setMuted = function (m) { muted = !!m; if (master) master.gain.value = muted ? 0 : 0.5; };
  A.isMuted = function () { return muted; };
  A.suspend = function () {
    adSuspended = true;
    stopMusicTimer();
    if (ctx && ctx.state === 'running') ctx.suspend().catch(function () {});
  };
  A.resume = function () {
    adSuspended = false;
    if (ctx && !muted && ctx.state === 'suspended') ctx.resume().catch(function () {});
    if (musicName && ctx) startMusicTimer();
  };

  function tone(o) {
    if (muted || adSuspended || !ctx || ctx.state !== 'running') return;
    var t0 = ctx.currentTime + (o.delay || 0);
    var osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(Math.max(1, o.f0), t0);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t0 + o.dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.2, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + o.dur + 0.05);
  }

  function noise(o) {
    if (muted || adSuspended || !ctx || ctx.state !== 'running') return;
    var dur = o.dur || 0.2, t0 = ctx.currentTime + (o.delay || 0);
    var len = Math.max(1, (dur * ctx.sampleRate) | 0);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    var s = 22222; // детерминированный LCG-шум, не Math.random
    for (var i = 0; i < len; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = (s / 4294967296) * 2 - 1; }
    var src = ctx.createBufferSource(); src.buffer = buf;
    var f = ctx.createBiquadFilter();
    f.type = o.hp ? 'highpass' : 'lowpass';
    f.frequency.value = o.hp ? o.hp : (o.lp || 4000);
    var g = ctx.createGain();
    g.gain.setValueAtTime(o.vol || 0.25, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  var SFX = {
    click:   function () { tone({ f0: 660, f1: 880, dur: 0.07, type: 'square', vol: 0.10 }); },
    shoot:   function () { tone({ f0: 880, f1: 220, dur: 0.09, type: 'sawtooth', vol: 0.06 }); },
    hit:     function () { noise({ dur: 0.08, vol: 0.12, lp: 3000 }); },
    explode: function () { noise({ dur: 0.30, vol: 0.26, lp: 1200 }); tone({ f0: 160, f1: 40, dur: 0.30, vol: 0.18 }); },
    coin:    function () { tone({ f0: 990, dur: 0.06, type: 'square', vol: 0.08 }); tone({ f0: 1320, dur: 0.10, type: 'square', vol: 0.08, delay: 0.06 }); },
    pulse:   function () { tone({ f0: 220, f1: 990, dur: 0.25, type: 'sine', vol: 0.20 }); noise({ dur: 0.2, vol: 0.10, hp: 800 }); },
    core:    function () { tone({ f0: 300, f1: 60, dur: 0.5, type: 'sawtooth', vol: 0.28 }); noise({ dur: 0.4, vol: 0.28, lp: 900 }); },
    wave:    function () { tone({ f0: 440, dur: 0.12, type: 'triangle', vol: 0.14 }); tone({ f0: 660, dur: 0.16, type: 'triangle', vol: 0.14, delay: 0.12 }); },
    buy:     function () { tone({ f0: 520, dur: 0.08, type: 'square', vol: 0.11 }); tone({ f0: 780, dur: 0.12, type: 'square', vol: 0.11, delay: 0.08 }); },
    deny:    function () { tone({ f0: 200, f1: 140, dur: 0.15, type: 'square', vol: 0.11 }); },
    revive:  function () { tone({ f0: 330, f1: 990, dur: 0.4, type: 'triangle', vol: 0.22 }); },
    over:    function () { tone({ f0: 440, f1: 110, dur: 0.9, type: 'sawtooth', vol: 0.22 }); }
  };
  A.sfx = function (name) { var f = SFX[name]; if (f) { try { f(); } catch (e) {} } };

  /* Процедурная фоновая музыка: пентатонический арпеджио, детерминированная партия. */
  var SCALE = [0, 3, 5, 7, 10, 12, 15];
  var PATTERNS = {
    menu: { bpm: 72, base: 220.0, steps: [0, 2, 4, 2, 5, 4, 2, 1], wave: 'sine', vol: 0.09 },
    play: { bpm: 96, base: 196.0, steps: [0, 0, 3, 2, 0, 4, 3, 2], wave: 'triangle', vol: 0.07 }
  };
  function scheduleMusic() {
    if (!ctx || !musicName || muted || adSuspended || ctx.state !== 'running') return;
    var p = PATTERNS[musicName]; if (!p) return;
    var spb = 60 / p.bpm / 2;
    while (nextNoteTime < ctx.currentTime + 0.25) {
      var deg = p.steps[noteIdx % p.steps.length];
      var semis = SCALE[deg % SCALE.length] + 12 * Math.floor(deg / SCALE.length);
      var freq = p.base * Math.pow(2, semis / 12);
      var t0 = Math.max(nextNoteTime, ctx.currentTime + 0.01);
      var osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = p.wave; osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(p.vol, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + spb * 0.95);
      osc.connect(g); g.connect(musicGain);
      osc.start(t0); osc.stop(t0 + spb);
      nextNoteTime += spb; noteIdx++;
    }
  }
  function startMusicTimer() {
    stopMusicTimer();
    if (!ctx || !musicName) return;
    nextNoteTime = ctx.currentTime + 0.1;
    musicTimer = setInterval(scheduleMusic, 120);
  }
  function stopMusicTimer() { if (musicTimer) { clearInterval(musicTimer); musicTimer = 0; } }

  A.music = function (name) {
    if (musicName === name) return;
    musicName = name; noteIdx = 0;
    stopMusicTimer();
    if (name && ctx && !adSuspended) startMusicTimer();
  };
  E.audio = A;
})(window.Engine);
