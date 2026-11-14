/* Node-симуляция генерации wordgrid: 12 уровней x ru/en, 40 сидов на уровень.
   Проверяет: раунд никогда не пуст, слова влезают, найденные пути валидны,
   reshuffle сохраняет найденные слова и даёт новые пути ненайденным. */
'use strict';
const fs = require('fs');
const path = require('path');

global.window = {};
const root = path.join(__dirname, '..', 'games', 'wordgrid');
function load(p) { eval(fs.readFileSync(path.join(root, p), 'utf8')); }
load('game/config.js');
load('engine/rng.js');
load('game/logic.js');

const G = global.window.GAME;
const E = global.window.Engine;
const L = G.logic;

let bad = 0, total = 0, fallback4 = 0, minWords = 99, maxWords = 0;
const report = [];

for (let lvl = 1; lvl <= 12; lvl++) {
  for (const lang of ['ru', 'en']) {
    let okCnt = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const rng = new E.Rng((seed * 2654435761) >>> 0);
      const st = L.newRound(lvl, lang, rng);
      total++;
      minWords = Math.min(minWords, st.words.length);
      maxWords = Math.max(maxWords, st.words.length);
      // 1) раунд не пуст
      if (!st.words.length) { bad++; console.log('EMPTY', lvl, lang, seed); continue; }
      // 2) каждый путь валиден: буквы на сетке совпадают со словом
      let valid = true;
      for (const w of st.words) {
        if (!w.path || w.path.length !== w.text.length) { valid = false; break; }
        const txt = L.pathText(st, w.path);
        if (txt !== w.text) { valid = false; break; }
        // путь — прямая линия из 8 направлений
        const n = st.size;
        const x0 = w.path[0] % n, y0 = Math.floor(w.path[0] / n);
        if (w.path.length > 1) {
          const dx = (w.path[1] % n) - x0, dy = Math.floor(w.path[1] / n) - y0;
          if (Math.abs(dx) > 1 || Math.abs(dy) > 1 || (dx === 0 && dy === 0)) { valid = false; break; }
          for (let i = 2; i < w.path.length; i++) {
            const px = w.path[i-1] % n, py = Math.floor(w.path[i-1] / n);
            const cx = w.path[i] % n, cy = Math.floor(w.path[i] / n);
            if (cx - px !== dx || cy - py !== dy) { valid = false; break; }
          }
        }
      }
      if (!valid) { bad++; console.log('BADPATH', lvl, lang, seed); continue; }
      // 3) findWord/обратное чтение
      const w0 = st.words[0];
      const rev = w0.text.split('').reverse().join('');
      if (L.findWord(st, w0.text) !== w0 || L.findWord(st, rev) !== w0) { bad++; console.log('FIND', lvl, lang, seed); continue; }
      if (st.words.length < 4) fallback4++;
      // 4) reshuffle после части находок
      st.words[0].found = true;
      if (st.words.length > 1) {
        const r2 = new E.Rng((seed ^ 0x9e3779b9) >>> 0);
        const before = L.pathText(st, st.words[0].path);
        L.reshuffle(st, r2);
        if (L.pathText(st, st.words[0].path) !== st.words[0].text && L.pathText(st, st.words[0].path) !== before) {
          // найденное слово не должно переехать и исказиться
          bad++; console.log('RESH-FOUND-MOVED', lvl, lang, seed); continue;
        }
        for (const w of st.words) {
          if (w.found) continue;
          if (L.pathText(st, w.path) !== w.text) { bad++; console.log('RESH-BAD', lvl, lang, seed); valid = false; break; }
        }
        if (!valid) continue;
      }
      okCnt++;
    }
    report.push(`lvl ${String(lvl).padStart(2)} ${lang}: ${okCnt}/40 ok, size=${G.config.levels[lvl-1].size}`);
  }
}
console.log(report.join('\n'));
console.log(`TOTAL ${total}, bad=${bad}, fallback4=${fallback4}, words range ${minWords}..${maxWords}`);
console.log('ru pool sizes:', Object.keys(G.config.themes).map(t => L.pool(1, 'ru').length ? '' : '').join(''));
for (let lvl = 1; lvl <= 12; lvl++) {
  const cfg = G.config.levels[lvl];
  for (const lang of ['ru', 'en']) {
    const p = L.pool(lvl, lang);
    if (p.length < cfg.words) console.log('POOL SMALL', lvl, lang, cfg.theme, p.length, 'need', cfg.words);
  }
}
console.log(bad === 0 ? 'SIM OK' : 'SIM FAIL');
