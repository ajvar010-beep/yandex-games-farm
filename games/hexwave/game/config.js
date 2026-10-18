/* game/config.js — ВЕСЬ контентный конфиг игры: палитра, баланс, композитор волн, магазин.
   Конвейер меняет этот файл + i18n + entities/scenes, ядро не трогает. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  G.id = 'hexwave';
  G.version = '1.1.0';

  G.config = {
    palette: {
      bg: '#0b0e1a', bg2: '#111631',
      core: '#7df9ff', coreHurt: '#ff5d73',
      defender: '#ffe066', bullet: '#ffe066',
      enemy: { drifter: '#ff6b9d', dart: '#ffa94d', tank: '#c77dff', splitter: '#69f0ae', warden: '#ff8787', lancer: '#4dd2ff' },
      coin: '#ffd43b', text: '#e8f6ff', dim: '#8ea0c9',
      panel: 'rgba(13,17,38,0.94)', panelBorder: '#3d7fe0',
      accent: '#3d7fe0', good: '#51cf66', bad: '#ff5d73', aegis: '#74c0fc'
    },
    arena: { coreRadius: 34, orbit: 80, fieldFactor: 0.46 },
    defender: { rate: 2.2, dmg: 1, bulletSpeed: 430, multi: 1,
                pulseCd: 6, pulseDmg: 3, pulseR: 100, magnet: 280, rotateSpeed: 3.4 },
    core: { hp: 3, hpMaxCap: 6 },
    waves: { baseCount: 5, countPerWave: 1.6, hpPerWave: 0.14, speedPerWave: 0.025,
             interval: 1.05, firstDelay: 0.8, bossEvery: 10,
             lancerFrom: 5,        // копейщики появляются с 5-й волны
             hpPerWaveLate: 0.20, lateFrom: 15 }, // поздние волны толще (1.1 контент)
    economy: { rvCoins: 75 },
    record: { waveCap: 6, coreHpFloor: 999 }, // record-safe режим (?record/?autoplay и capture-симуляции)
    shop: [
      { id: 'dmg',   max: 10, base: 30, growth: 1.55 },
      { id: 'rate',  max: 8,  base: 35, growth: 1.60 },
      { id: 'multi', max: 3,  base: 90, growth: 2.20 },
      { id: 'core',  max: 3,  base: 60, growth: 1.80 },
      { id: 'pulse', max: 5,  base: 40, growth: 1.60 },
      { id: 'slow',  max: 4,  base: 45, growth: 1.70 },
      { id: 'aegis', max: 2,  base: 80, growth: 2.00 } // Эгида: блокирует первые N попаданий по ядру за волну
    ]
  };

  /* Композитор волны: детерминирован по (seed, wave) — переданный rng уже под-seeded. */
  G.config.waveSpec = function (wave, rng) {
    var W = G.config.waves;
    var list = [];
    var n = Math.round(W.baseCount + wave * W.countPerWave);
    var late = wave >= W.lateFrom;
    var hpScale = 1 + (wave - 1) * (late ? W.hpPerWaveLate : W.hpPerWave);
    var spScale = 1 + (wave - 1) * W.speedPerWave;
    var at = W.firstDelay;
    for (var i = 0; i < n; i++) {
      var r = rng.float(), type = 'drifter';
      if (wave >= W.lancerFrom && r >= 0.62 && r < 0.80) type = 'lancer'; // 18% с 5-й волны
      else if (wave >= 4 && r < 0.16) type = 'tank';
      else if (wave >= 3 && r < 0.30) type = 'splitter';
      else if (wave >= 2 && r < 0.48) type = 'dart';
      list.push({ type: type, at: at, angle: rng.angle(),
                  hpMul: hpScale, spMul: spScale * rng.range(0.9, 1.1) });
      at += W.interval * rng.range(0.7, 1.2);
    }
    if (wave % W.bossEvery === 0) {
      list.push({ type: 'warden', at: W.firstDelay + 2.5, angle: rng.angle(),
                  hpMul: 1 + wave * 0.25, spMul: 1 });
    }
    list.sort(function (a, b) { return a.at - b.at; });
    return list;
  };

  G.config.shopCost = function (item, lvl) {
    return Math.round(item.base * Math.pow(item.growth, lvl));
  };
})(window.GAME);
