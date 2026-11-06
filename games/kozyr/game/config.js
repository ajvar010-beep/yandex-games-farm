/* game/config.js — данные игры «Козырь». Здесь только данные, никакой логики. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  G.id = 'kozyr';
  G.version = '1.0.0';

  G.config = {
    palette: {
      bg: '#0e1a16',
      felt: '#17402f',
      feltHi: '#1d5138',
      feltDark: '#10301f',
      gold: '#f2c14e',
      goldDim: '#a8862f',
      cream: '#f7f1e3',
      paper: '#fbf7ee',
      red: '#c0392b',
      black: '#20232a',
      blue: '#2e6fd0',
      dim: '#7f9c8f',
      shadow: 'rgba(0,0,0,0.35)'
    },

    suits: ['s', 'h', 'd', 'c'],
    suitRed: { s: false, h: true, d: true, c: false },
    ranks: [6, 7, 8, 9, 10, 11, 12, 13, 14], // 11=J, 12=Q, 13=K, 14=A
    handLimit: 6,
    maxTable: 6,
    maxRounds: 40,

    /* Соперники. aggr — охота подкидывать; thrift — бережёт козыри;
       take — готов взять, лишь бы не тратить козырь; smart — помнит вышедшие карты. */
    rivals: [
      { key: 'tihon',     color: '#7a6a55', aggr: 0.18, thrift: 0.15, take: 0.35, smart: 0.05, mistake: 0.5 },
      { key: 'glasha',    color: '#a8556b', aggr: 0.30, thrift: 0.25, take: 0.40, smart: 0.15, mistake: 0.42 },
      { key: 'kuzma',     color: '#8a5a2b', aggr: 0.45, thrift: 0.20, take: 0.25, smart: 0.20, mistake: 0.34 },
      { key: 'varvara',   color: '#4d6b8a', aggr: 0.35, thrift: 0.45, take: 0.45, smart: 0.45, mistake: 0.28 },
      { key: 'frol',      color: '#6b4d8a', aggr: 0.55, thrift: 0.30, take: 0.30, smart: 0.35, mistake: 0.22 },
      { key: 'agrafena',  color: '#8a4d4d', aggr: 0.40, thrift: 0.70, take: 0.60, smart: 0.40, mistake: 0.17 },
      { key: 'savva',     color: '#3f6b52', aggr: 0.65, thrift: 0.35, take: 0.25, smart: 0.45, mistake: 0.13 },
      { key: 'marfa',     color: '#8a7a3f', aggr: 0.35, thrift: 0.55, take: 0.50, smart: 0.60, mistake: 0.12 },
      { key: 'erofey',    color: '#5a4a3a', aggr: 0.75, thrift: 0.30, take: 0.20, smart: 0.50, mistake: 0.07 },
      { key: 'pelageya',  color: '#7a3f6b', aggr: 0.50, thrift: 0.65, take: 0.55, smart: 0.75, mistake: 0.04 },
      { key: 'pahom',     color: '#3a3a4a', aggr: 0.85, thrift: 0.50, take: 0.30, smart: 0.70, mistake: 0.04 },
      { key: 'akim',      color: '#b8860b', aggr: 0.74, thrift: 0.55, take: 0.20, smart: 0.95, mistake: 0 }
    ],

    /* hint — разовый пассивный перк; swap/peek — расходники: покупаешь заряды. */
    shop: [
      { id: 'hint', price: 120, once: true },
      { id: 'swap', price: 90, charge: 3 },
      { id: 'peek', price: 100, charge: 2 }
    ],

    /* Ставка: бесконечный сток монет — риск на партию. */
    stake: { cost: 50, win: 90 },

    coins: {
      win: 40,
      perRivalCard: 2,
      dryBonus: 25,
      lose: 10
    },

    ads: {
      interstitialEvery: 2   // после каждой второй партии, только на экране итога
    }
  };
})(window.GAME);
