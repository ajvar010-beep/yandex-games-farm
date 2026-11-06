// Проверка правил «Козыря» без браузера: 300 партий ИИ против ИИ + инварианты.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const root = path.resolve('../games/kozyr');
const sandbox = { window: {}, Math, Date, console };
sandbox.window.Engine = {};
vm.createContext(sandbox);
for (const f of ['engine/rng.js', 'game/config.js', 'game/logic.js']) {
  vm.runInContext(readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
}
const E = sandbox.window.Engine, G = sandbox.window.GAME, L = G.logic, C = G.config;

let matches = 0, wins = { 0: 0, 1: 0, 2: 0 }, maxRounds = 0, problems = [];
const seen = new Set();

function inHand(h, c) { return h.some(x => x.s === c.s && x.r === c.r); }

function invariant(st, tag) {
  const all = [];
  for (const h of st.hands) for (const c of h) all.push(c.s + c.r);
  for (const p of st.table) { all.push(p.a.s + p.a.r); if (p.d) all.push(p.d.s + p.d.r); }
  for (const c of st.deck) all.push(c.s + c.r);
  if (new Set(all).size !== all.length) problems.push(tag + ': дубликат карты в состоянии');
  for (const h of st.hands) if (h.length > 24) problems.push(tag + ': рука > 24 карт');
  for (const p of st.table) if (p.d && !L.beats(p.d, p.a, st.trump)) problems.push(tag + ': нелегальный отбой на столе');
  if (st.table.length > C.maxTable) problems.push(tag + ': на столе > 6 атак');
}

for (let i = 0; i < 300; i++) {
  const st = L.newGame(new E.Rng(1000 + i), i % C.rivals.length, {});
  let guard = 0;
  while (st.phase !== 'over' && guard++ < 4000) {
    const p = st.turn;
    const act = L.aiAct(st);
    let ok = false;
    if (act.type === 'attack') ok = L.attack(st, p, act.card);
    else if (act.type === 'defend') ok = L.defend(st, p, act.card);
    else if (act.type === 'take') ok = L.take(st, p);
    else ok = L.pass(st, p);
    if (!ok) { problems.push(`партия ${i}: ИИ предложил нелегальный ход ${act.type} (phase=${st.phase}, turn=${p}, table=${st.table.length})`); break; }
    invariant(st, `партия ${i} ход ${guard}`);
    if (problems.length > 5) break;
  }
  if (st.phase !== 'over') { problems.push(`партия ${i}: не завершилась за 4000 ходов`); continue; }
  matches++;
  wins[st.winner] = (wins[st.winner] || 0) + 1;
  maxRounds = Math.max(maxRounds, st.rounds);
  seen.add(L.key(st.trumpCard));
}

console.log('матчей:', matches, '| победы сторон (0 игрок, 1 ИИ, 2 ничья):', JSON.stringify(wins));
console.log('макс раундов:', maxRounds, '| разных козырей:', seen.size);
console.log(problems.length ? 'ПРОБЛЕМЫ:\n' + problems.slice(0, 10).join('\n') : 'ИНВАРИАНТЫ OK');
process.exitCode = problems.length ? 1 : 0;
