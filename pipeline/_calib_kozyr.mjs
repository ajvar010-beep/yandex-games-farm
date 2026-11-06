// Калибровка: винрейт ИИ-соперника против базового игрока по каждому из 12 уровней.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const root = path.resolve('../games/kozyr');
const sb = { window: {}, Math, console };
sb.window.Engine = {};
vm.createContext(sb);
for (const f of ['engine/rng.js', 'game/config.js', 'game/logic.js'])
  vm.runInContext(readFileSync(path.join(root, f), 'utf8'), sb, { filename: f });
const E = sb.window.Engine, G = sb.window.GAME, L = G.logic, C = G.config;

const N = 400;
for (let r = 0; r < C.rivals.length; r++) {
  let ai = 0, pl = 0, draw = 0;
  for (let i = 0; i < N; i++) {
    const st = L.newGame(new E.Rng(50000 + i * 13 + r * 977), r, { playerAttacks: (i % 2 === 0) });
    let guard = 0;
    while (st.phase !== 'over' && guard++ < 5000) {
      const p = st.turn, a = L.aiAct(st);
      if (a.type === 'attack') L.attack(st, p, a.card);
      else if (a.type === 'defend') L.defend(st, p, a.card);
      else if (a.type === 'take') L.take(st, p);
      else L.pass(st, p);
    }
    if (st.winner === 1) ai++; else if (st.winner === 0) pl++; else draw++;
  }
  const pct = (ai / N * 100).toFixed(1);
  console.log(`${String(r + 1).padStart(2)} ${C.rivals[r].key.padEnd(9)} ИИ ${pct}%  (игрок ${(pl / N * 100).toFixed(1)}%, ничьи ${draw})`);
}
