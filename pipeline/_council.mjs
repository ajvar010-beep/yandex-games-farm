// pipeline/_council.mjs — LLM-консилиум баг-ревью кода игр.
// Запуск: node _council.mjs [slug ...]   (без аргументов — все игры с game/*.js)
// Результаты: scratch/council/<slug>.<model>.json
import fs from 'node:fs';
import path from 'node:path';
import { chat, bundleGame, extractJSON } from './_llm.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'scratch', 'council');
fs.mkdirSync(OUT, { recursive: true });

const MODELS = [
  { id: 'qwen-plus', tag: 'qwenp', extra: {}, timeoutMs: 180000, maxTokens: 12000 },
  { id: 'deepseek-v4.1-flash', tag: 'ds', extra: { reasoning_effort: 'minimal' }, timeoutMs: 240000, maxTokens: 16000 },
  { id: 'qwen3.8-max', tag: 'qwen', extra: { enable_thinking: false }, timeoutMs: 240000, maxTokens: 12000 },
];

const PROMPT = `Ты — баг-хантер для HTML5 canvas-игр на чистом JS. Перед тобой ПОЛНЫЙ код одной игры (без движка engine/, он общий и отлажен).

Твоя задача — найти РЕАЛЬНЫЕ баги, не стилистику. Ищи:
1. Крэши: TypeError, ReferenceError, обращение к undefined/null, выход за границы массива.
2. Логические баги: условия, которые никогда/всегда истинны; неправильный подсчёт очков; битые состояния (menu/play/over); незакрытые пути в switch.
3. Состояние: мутации после game over, утечки слушателей событий, setInterval/setTimeout без очистки, двойная инициализация.
4. Ввод: клик/тап обрабатывается когда игра на паузе/over; координаты canvas не масштабируются на DPR.
5. Сохранения: localStorage без try/catch, JSON.parse без fallback.
6. i18n: ключи, которые запрашиваются, но отсутствуют в словаре; строки на неправильном языке.
7. UI: текст, который переполнит плашку; кнопки вне экрана на узком вьюпорте (320px).

НЕ сообщай: стиль, нейминг, «можно лучше», теоретические проблемы без конкретного сценария.

Ответь СТРОГО в JSON (без пояснений до/после):
{
  "game": "<slug>",
  "bugs": [
    {"file": "<file>", "line": <номер или null>, "severity": "P0|P1|P2", "title": "<коротко>", "detail": "<сценарий воспроизведения: вход → ожидание → факт>", "confidence": "high|medium|low"}
  ],
  "clean": false
}
severity: P0=крэш/неиграбельно, P1=заметный баг, P2=мелочь. Если багов нет — "bugs": [], "clean": true.
Максимум 10 самых важных багов. Каждый баг — только если ты видишь конкретный сценарий поломки в коде.`;

async function reviewOne(slug, model) {
  const gameDir = path.join(ROOT, 'games', slug);
  const bundle = bundleGame(gameDir);
  if (bundle.length < 200) return { skipped: true, reason: 'no code' };
  const messages = [
    { role: 'system', content: PROMPT },
    { role: 'user', content: `Игра: ${slug}\n\n${bundle}` },
  ];
  const text = await chat(model.id, messages, {
    maxTokens: model.maxTokens, temperature: 0.1,
    timeoutMs: model.timeoutMs, extra: model.extra,
  });
  try {
    const parsed = extractJSON(text);
    parsed._model = model.tag;
    parsed._bundleKB = Math.round(bundle.length / 1024);
    return parsed;
  } catch (e) {
    return { error: 'parse: ' + e.message, raw: text.slice(0, 800), rawLen: text.length, _model: model.tag };
  }
}

async function reviewGame(slug) {
  const results = await Promise.all(MODELS.map(m =>
    reviewOne(slug, m).catch(e => ({ error: String(e).slice(0, 300), _model: m.tag }))
  ));
  results.forEach((r, i) => {
    if (!r) return;
    fs.writeFileSync(path.join(OUT, `${slug}.${MODELS[i].tag}.json`), JSON.stringify(r, null, 2));
  });
  const bugs = results.flatMap(r => (r.bugs || []).map(b => ({ ...b, by: r._model })));
  const p0 = bugs.filter(b => b.severity === 'P0').length;
  const p1 = bugs.filter(b => b.severity === 'P1').length;
  console.log(`${slug}: ${bugs.length} bugs (P0:${p0} P1:${p1}) [${results.map(r => r._model + (r.error ? '!' : '')).join('+')}]`);
  return { slug, results, bugs };
}

// --- main ---
const args = process.argv.slice(2);
const gamesDir = path.join(ROOT, 'games');
const slugs = args.length ? args
  : fs.readdirSync(gamesDir).filter(d => {
      const g = path.join(gamesDir, d);
      return fs.statSync(g).isDirectory() && fs.existsSync(path.join(g, 'game'));
    }).sort();

console.log(`Council: ${slugs.length} games × ${MODELS.length} models`);
const CONCURRENCY = 4;
const all = [];
for (let i = 0; i < slugs.length; i += CONCURRENCY) {
  const batch = slugs.slice(i, i + CONCURRENCY);
  const rs = await Promise.all(batch.map(s => reviewGame(s).catch(e => {
    console.log(`${s}: ERROR ${e.message}`);
    return { slug: s, error: String(e) };
  })));
  all.push(...rs);
}
fs.writeFileSync(path.join(OUT, '_summary.json'), JSON.stringify(all.map(r => ({
  slug: r.slug, bugs: r.bugs || [], error: r.error
})), null, 2));
const total = all.reduce((n, r) => n + (r.bugs?.length || 0), 0);
console.log(`\nDONE: ${total} total bug reports across ${all.length} games → scratch/council/`);
