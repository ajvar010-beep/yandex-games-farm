// pipeline/_sim_rollfort.mjs — быстрый баланс-прогон логики rollfort без браузера.
// Запуск: node _sim_rollfort.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const ctx = { window: { GAME: {} }, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'games/rollfort/game/config.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'games/rollfort/game/logic.js'), 'utf8'), ctx);
const G = ctx.window.GAME;
const L = G.logic, C = G.config;

function Rng(seed) {
  let a = seed >>> 0;
  this.float = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  this.range = (a2, b2) => a2 + (b2 - a2) * this.float();
  this.int = (a2, b2) => Math.floor(this.range(a2, b2 + 1));
}

function playChapter(chapter, layout, coins, seed) {
  const st = L.newBattle({ chapter, layout, coins, rng: new Rng(seed), first: false });
  let guard = 0;
  while (st.phase !== 'win' && st.phase !== 'over' && guard++ < 60000) {
    if (st.phase === 'build') {
      L.autoBuild(st, { level: chapter >= 9 ? 2 : 1, blocks: 4 });
      if (L.repairCost(st) > 0 && st.coins >= L.repairCost(st)) L.repair(st);
      if (st.perkChoices && st.perkChoices.length) L.applyPerk(st, st.perkChoices[0]);
      L.startWave(st);
    } else if (st.phase === 'clear') {
      L.nextWave(st);
    }
    L.update(st, 1 / 60);
  }
  return { win: st.phase === 'win', coins: st.coins, hp: st.hp, maxHp: st.maxHp, t: st.t,
           layout: st.layout, kills: st.kills, boss: st.bossRef ? Math.round(st.bossRef.hp) : null };
}

let totalWin = 0, totalTries = 0;
for (let ch = 1; ch <= 12; ch++) {
  let layout = null, coins = C.economy.startCoins, wins = 0, tries = 0, times = [];
  const hpLeft = [];
  for (let seed = 1; seed <= 6; seed++) {
    // кампания: стартуем с накопленного состояния, ретраи внутри главы сохраняют блоки
    let lay = layout, coin = coins, result = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      result = playChapter(ch, lay, coin, seed * 7919 + ch * 131 + attempt);
      lay = result.layout;
      coin = result.coins;
      if (result.win) break;
    }
    tries += 1;
    if (result.win) { wins++; coin += C.economy.chapter + ch * 10; }
    coins = Math.min(coin, 3000);
    layout = lay;
    times.push(+result.t.toFixed(0));
    hpLeft.push(Math.round(100 * result.hp / Math.max(1, result.maxHp)));
  }
  totalWin += wins; totalTries += tries;
  console.log(`ch${String(ch).padStart(2)} win ${wins}/6  t~${Math.round(times.reduce((a, b) => a + b, 0) / times.length)}s  hp ${hpLeft.join(',')}%  coins ${coins}`);
}
console.log(`TOTAL ${totalWin}/${totalTries}`);
