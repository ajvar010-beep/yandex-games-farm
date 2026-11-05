#!/usr/bin/env node
// gen_levels.cjs — генератор 30 уровней + баланс-симуляция для «Шахтёр Кликер».
// Инварианты (уроки партии-2): каждый уровень проходим разумной стратегией,
// боссы проходимы под активный тап, новая снаряга появляется каждые 1-3 уровня.
const fs = require("fs");
const path = require("path");

// --- каталог (СИНХРОНИЗИРОВАН с game_state.gd GEAR) ---
const GEAR = {
  pick_wood:    { kind: "pick", power: 1,    cost: 15,     mult: 1.6,  unlock: 1,  ban: "",     stack: 10 },
  pick_stone:   { kind: "pick", power: 4,    cost: 90,     mult: 1.65, unlock: 2,  ban: "",     stack: 10 },
  pick_bronze:  { kind: "pick", power: 12,   cost: 420,    mult: 1.7,  unlock: 4,  ban: "",     stack: 10 },
  pick_iron:    { kind: "pick", power: 35,   cost: 1800,   mult: 1.7,  unlock: 6,  ban: "",     stack: 10 },
  pick_steel:   { kind: "pick", power: 100,  cost: 7500,   mult: 1.75, unlock: 9,  ban: "",     stack: 10 },
  pick_gold:    { kind: "pick", power: 280,  cost: 32000,  mult: 1.75, unlock: 13, ban: "gold", stack: 10 },
  pick_diamond: { kind: "pick", power: 800,  cost: 140000, mult: 1.8,  unlock: 17, ban: "",     stack: 10 },
  pick_laser:   { kind: "pick", power: 2400, cost: 600000, mult: 1.85, unlock: 23, ban: "",     stack: 10 },
  helm_bronze:  { kind: "helm", power: 3,    cost: 250,    mult: 1.7,  unlock: 3,  ban: "",     stack: 6 },
  helm_iron:    { kind: "helm", power: 10,   cost: 1100,   mult: 1.7,  unlock: 5,  ban: "",     stack: 6 },
  helm_steel:   { kind: "helm", power: 32,   cost: 5200,   mult: 1.75, unlock: 8,  ban: "",     stack: 6 },
  helm_gold:    { kind: "helm", power: 95,   cost: 24000,  mult: 1.75, unlock: 12, ban: "",     stack: 6 },
  helm_diamond: { kind: "helm", power: 300,  cost: 110000, mult: 1.8,  unlock: 16, ban: "",     stack: 6 },
  helm_lava:    { kind: "helm", power: 1000, cost: 520000, mult: 1.85, unlock: 21, ban: "",     stack: 6 },
  mach_drill:     { kind: "mach", power: 25,   cost: 1500,    mult: 1.75, unlock: 7,  ban: "flood", stack: 4 },
  mach_hammer:    { kind: "mach", power: 80,   cost: 8000,   mult: 1.75, unlock: 10, ban: "flood", stack: 4 },
  mach_laser:     { kind: "mach", power: 260,  cost: 40000,  mult: 1.8,  unlock: 14, ban: "flood", stack: 4 },
  mach_excavator: { kind: "mach", power: 850,  cost: 190000, mult: 1.8,  unlock: 18, ban: "flood", stack: 4 },
  mach_turbodrill:{ kind: "mach", power: 2800, cost: 900000, mult: 1.85, unlock: 22, ban: "flood", stack: 4 },
  mach_coreburn:  { kind: "mach", power: 9500, cost: 4500000,mult: 1.9,  unlock: 25, ban: "",      stack: 4 },
};
// апгрейд tap: +2 к удару/уровень (цены как в game_state)
const TAP_STEP = 2;
const TAP_COSTS = [50, 120, 260, 520, 1000, 1900, 3500, 6500, 12000, 22000];
const CRIT_COSTS = [100, 250, 550, 1100, 2100, 3900, 7200, 13000, 24000, 44000];

const ROUNDS = 10;            // камней на уровень
const REWARD_FRacT = 0.55;    // доля HP, возвращаемая монетами за разбитие
const BOSS_TIME = 30;         // базовый таймер босса
const TAPS_PER_SEC = 5;       // разумный активный тап
const GOLDEN_PROB = 0.12;     // шанс золотой жилы (камень ×3 награды)

// --- кривая HP ---
function rockHP(level) {
  const h = 20 * Math.pow(1.32, level - 1) + 5 * level;
  return Math.round(h / 5) * 5;
}

// --- особые уровни ---
function levelDef(level) {
  const boss = level % 5 === 0;
  let ban = "";
  if ([9, 14, 19, 24, 28].includes(level)) ban = "machines";   // затопленные — без машин
  if (level === 16) ban = "no_gold";                            // «честный труд» — без золотой кирки
  const hp = rockHP(level);
  return {
    n: level,
    depth: level * 10,                 // метры
    // босс = ОДНА большая плита (HP×4, награда×4) под таймером, не 10 камней
    rock_hp: boss ? hp * 4 : hp,
    rocks: boss ? 1 : ROUNDS,
    reward: Math.round(hp * REWARD_FRacT) * (boss ? 4 : 1),
    boss,
    boss_time: boss ? BOSS_TIME : 0,
    ban,
    golden_prob: GOLDEN_PROB,
  };
}

// --- симуляция: «разумный» игрок ---
// Правило покупок: тратим монеты, когда хватает, приоритет: tap-апгрейд → дешёвая доступная кирка → каска → машина.
// Копим не больше 2× цены следующей кирки (иначе idle-игрок бы и копил, но для баланса берём активного).
function simulate(levels) {
  let coins = 0;
  const owned = {};
  let tapLv = 0, critLv = 0;
  const rows = [];
  const gearIds = Object.keys(GEAR);

  const tapPower = () => 1 + tapLv * TAP_STEP +
    gearIds.filter(id => GEAR[id].kind === "pick").reduce((s, id) => s + (owned[id] || 0) * GEAR[id].power, 0);
  const dps = (lvl) => gearIds
    .filter(id => (GEAR[id].kind === "helm" || GEAR[id].kind === "mach"))
    .filter(id => !(GEAR[id].kind === "mach" && GEAR[id].ban === "flood" && lvl.ban === "machines"))
    .filter(id => !(lvl.ban === "no_gold" && GEAR[id].ban === "gold"))
    .reduce((s, id) => s + (owned[id] || 0) * GEAR[id].power, 0);

  const avail = (level) => gearIds.filter(id =>
    (owned[id] || 0) < GEAR[id].stack && level >= GEAR[id].unlock);
  const cost = (id) => Math.round(GEAR[id].cost * Math.pow(GEAR[id].mult, owned[id] || 0));

  for (const lvl of levels) {
    let lvlCoins = 0;
    let totalSec = 0;
    let bannedFails = 0;
    // на уровне несколько камней; перед каждым — возможность купить
    for (let r = 0; r < lvl.rocks; r++) {
      // покупки: пока хватает на самую дешёвую доступную улучшалку — берём
      for (;;) {
        const cands = avail(lvl.n).map(id => ({ id, c: cost(id) }));
        // tap-апгрейд как кандидат
        if (tapLv < TAP_COSTS.length) cands.push({ id: "@tap", c: TAP_COSTS[tapLv] });
        if (critLv < CRIT_COSTS.length) cands.push({ id: "@crit", c: CRIT_COSTS[critLv] });
        cands.sort((a, b) => a.c - b.c);
        const best = cands[0];
        if (!best || coins < best.c) break;
        // не покупаем запрещённое на ЭТОМ уровне
        if (best.id !== "@tap" && best.id !== "@crit") {
          const g = GEAR[best.id];
          const banned = (lvl.ban === "machines" && g.ban === "flood") || (lvl.ban === "no_gold" && g.ban === "gold");
          if (banned) { bannedFails++; break; }
          owned[best.id] = (owned[best.id] || 0) + 1;
        } else if (best.id === "@tap") tapLv++;
        else critLv++;
        coins -= best.c;
      }
      // время на камень: hp / (tapPower*TAPS_PER_SEC*(1+crit*2) + dps)
      const critChance = Math.min(0.20, 0.02 * critLv);
      const effTap = tapPower() * TAPS_PER_SEC * (1 + critChance * 2);
      const rate = effTap + dps(lvl);
      if (rate <= 0) return { ok: false, failAt: lvl.n, why: "rate=0" };
      const golden = Math.random() < lvl.golden_prob ? 3 : 1;
      const sec = lvl.rock_hp / rate;
      totalSec += sec;
      lvlCoins += Math.round(lvl.reward * golden);
    }
    coins += lvlCoins;
    const perRock = totalSec / lvl.rocks;
    // босс-проверка: весь уровень за boss_time?
    const bossOK = !lvl.boss || totalSec <= (lvl.boss_time + 0); // боссы без бомб-апгрейда в симуляции
    rows.push({ n: lvl.n, hp: lvl.rock_hp, ban: lvl.ban, boss: lvl.boss,
      perRock: +perRock.toFixed(1), total: +totalSec.toFixed(1),
      tap: tapPower(), dps: dps(lvl), coins, bossOK, bannedFails });
  }
  return { ok: true, rows };
}

// --- main ---
const levels = Array.from({ length: 30 }, (_, i) => levelDef(i + 1));

const OUT = path.join(__dirname, "..", "levels");
fs.mkdirSync(OUT, { recursive: true });

const report = simulate(levels);
if (!report.ok) {
  console.error("BALANCE FAIL at level", report.failAt, report.why);
  process.exit(1);
}

// проверки баланса
const problems = [];
for (const r of report.rows) {
  if (r.perRock > 25) problems.push(`L${r.n}: камень ${r.perRock}с > 25с (долго)`);
  if (r.boss && !r.bossOK) problems.push(`L${r.n}: БОСС не проходится за ${30}с (нужно ${r.total}с)`);
  if (r.perRock < 0.05 && r.n < 15) problems.push(`L${r.n}: камень ${r.perRock}с — слишком быстро на раннем уровне`);
}
// покрытие открытий: новая снаряга минимум каждые 3 уровня
const unlocks = Object.entries(GEAR).map(([id, g]) => g.unlock).sort((a, b) => a - b);
for (let i = 1; i < unlocks.length; i++)
  if (unlocks[i] - unlocks[i - 1] > 3) problems.push(`провал открытий: ур ${unlocks[i - 1]}→${unlocks[i]} (>3)`);

fs.writeFileSync(path.join(OUT, "levels.json"), JSON.stringify({ levels }, null, 1));
console.log("levels.json: 30 уровней, HP L1=" + levels[0].rock_hp + " L30=" + levels[29].rock_hp);
console.log("--- симуляция (per-rock с / всего / tap / dps / монеты) ---");
for (const r of report.rows)
  console.log(`L${String(r.n).padStart(2)}${r.boss ? " B" : "  "}${r.ban ? " [" + r.ban + "]" : ""}  ${String(r.perRock).padStart(5)}с ${String(r.total).padStart(6)}с  tap=${String(r.tap).padStart(5)} dps=${String(r.dps).padStart(6)} ◈=${r.coins}${r.boss ? (r.bossOK ? " ✓" : " ✗БОСС") : ""}`);
if (problems.length) {
  console.log("--- ПРОБЛЕМЫ ---");
  for (const p of problems) console.log(" ! " + p);
  process.exitCode = 2;
} else {
  console.log("--- OK: все уровни проходимы, боссы в таймере, открытия без провалов ---");
}
