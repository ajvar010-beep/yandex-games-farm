/* game/config.js — данные «Крепости на Колёсах»: сетка, оружие, зомби, главы.
   Здесь только данные, никакой логики и никаких обращений к Engine. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  G.id = 'rollfort';
  G.version = '1.0.0';

  G.config = {
    palette: {
      bg: '#10141b',
      bg2: '#181e27',
      sky1: '#1b1722',
      sky2: '#3a2a2c',
      moon: '#efe3c4',
      road: '#242930',
      roadHi: '#2f353e',
      roadDark: '#171b21',
      line: '#c9a94a',
      steel: '#56606e',
      steelHi: '#8a97a8',
      steelDark: '#333b45',
      rust: '#b85a33',
      rustHi: '#e0834f',
      rustDark: '#6e3220',
      hazard: '#f0c14b',
      hazardDark: '#7d6418',
      toxic: '#9ef05c',
      toxicDark: '#4f8f2d',
      blood: '#b23a2e',
      cream: '#f1e9d8',
      dim: '#8d96a3',
      gold: '#f2c14e'
    },

    grid: { rows: 6, lanes: 3 },

    hp: { chassis: 60, block: 40 },
    blockCost: 25,
    weaponPrice: 60,
    upgradePrice: [150, 320],
    repairRate: 0.25,          // монет за 1 HP ремонта
    buildTime: 12,
    firstBuildTime: 26,

    economy: {
      startCoins: 180,
      hit: 2,                  // +2 монеты за каждое попадание
      kill: 3,                 // +3 за обычного зомби
      boss: 25,                // +25 за босса
      noDamage: 30,            // бонус за волну без потери HP
      chapter: 90              // базовая награда за главу (+10 за номер)
    },

    /* rows — разрешённые ряды (1 — нос, 6 — корма). range — дальность в клетках
       вперёд от носа крепости. mode — способ поражения. air — достаёт летунов. */
    weapons: [
      { id: 'saw', name: 'w_saw', desc: 'd_saw', rows: [1, 2], range: 1.3, cd: 0.30, dmg: 1.0,
        mode: 'saw', air: false, unlock: 1, color: '#d3dbe6', price: 60 },
      { id: 'shock', name: 'w_shock', desc: 'd_shock', rows: [1, 2], range: 2.0, cd: 0.85, dmg: 1.0,
        mode: 'chain', chain: 3, air: false, unlock: 2, color: '#6fd3ff', price: 60 },
      { id: 'flame', name: 'w_flame', desc: 'd_flame', rows: [2, 4], range: 3.0, cd: 0.35, dmg: 0.65,
        mode: 'cone', air: true, unlock: 3, color: '#ff8a3d', price: 60 },
      { id: 'laser', name: 'w_laser', desc: 'd_laser', rows: [3, 5], range: 4.0, cd: 0.75, dmg: 1.8,
        mode: 'line', air: true, unlock: 4, color: '#ff4d6d', price: 60 },
      { id: 'mg', name: 'w_mg', desc: 'd_mg', rows: [4, 6], range: 8.0, cd: 0.22, dmg: 1.0,
        mode: 'single', air: true, unlock: 5, color: '#ffd166', price: 60 },
      { id: 'grenade', name: 'w_grenade', desc: 'd_grenade', rows: [5, 6], range: 7.0, cd: 1.5, dmg: 3.0,
        mode: 'splash', air: true, unlock: 6, color: '#b8e06a', price: 60 }
    ],

    /* level — множитель урона, а не отдельная сущность */
    levelMult: [1, 1.8, 3],

    zombies: {
      walker: { name: 'z_walker', hp: 3, speed: 0.55, dmg: 3, atkCd: 1.4, r: 0.56, air: false, eye: '#9ef05c' },
      runner: { name: 'z_runner', hp: 2, speed: 1.15, dmg: 2, atkCd: 1.0, r: 0.50, air: false, eye: '#ffb84d' },
      brute: { name: 'z_brute', hp: 12, speed: 0.42, dmg: 8, atkCd: 1.8, r: 0.82, air: false, eye: '#ff5c4d' },
      flyer: { name: 'z_flyer', hp: 5, speed: 1.35, dmg: 4, atkCd: 1.2, r: 0.54, air: true, eye: '#a26bff' }
    },

    bosses: {
      brute: { id: 'brute', name: 'boss_brute', tag: 'boss_brute_tag', type: 'brute', hp: 340, shield: 0,
        speed: 0.16, dmg: 20, atkCd: 6, r: 1.50, lane: 1 },
      matka: { id: 'matka', name: 'boss_matka', tag: 'boss_matka_tag', type: 'brute', hp: 520, shield: 0,
        speed: 0.20, dmg: 9, atkCd: 2.2, spawnEvery: 3.2, r: 1.36, lane: 1 },
      shield: { id: 'shield', name: 'boss_shield', tag: 'boss_shield_tag', type: 'brute', hp: 680, shield: 180,
        speed: 0.22, dmg: 16, atkCd: 3.0, r: 1.52, lane: 1 },
      /* Элита — босс улиц, у которых нет именного босса: каждая глава
         заканчивается боссом, как и обещают правила. HP растёт с номером главы. */
      elite: { id: 'elite', name: 'boss_elite', tag: 'boss_elite_tag', type: 'brute', hp: 190, shield: 0,
        speed: 0.24, dmg: 12, atkCd: 4.0, r: 1.18, lane: 1 }
    },

    chapters: [
      { n: 1, name: 'ch_1_name', weapon: 'saw' },
      { n: 2, name: 'ch_2_name', weapon: 'shock' },
      { n: 3, name: 'ch_3_name', weapon: 'flame' },
      { n: 4, name: 'ch_4_name', weapon: 'laser', boss: 'brute' },
      { n: 5, name: 'ch_5_name', weapon: 'mg' },
      { n: 6, name: 'ch_6_name', weapon: 'grenade' },
      { n: 7, name: 'ch_7_name' },
      { n: 8, name: 'ch_8_name', boss: 'matka' },
      { n: 9, name: 'ch_9_name' },
      { n: 10, name: 'ch_10_name' },
      { n: 11, name: 'ch_11_name' },
      { n: 12, name: 'ch_12_name', boss: 'shield' }
    ],

    waves: 5,                   // обычных волн в главе, шестая — босс

    ads: {
      interstitialEvery: 2,     // после каждой второй пройденной главы
      rewardedCoins: 150
    }
  };
})(window.GAME);
