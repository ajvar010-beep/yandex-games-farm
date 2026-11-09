// Быстрый тест каждой модели: короткий запрос, смотрим формат ответа.
import { chat } from './_llm.mjs';

const MODELS = [
  { id: 'claude-fable-5.1', extra: {}, maxTokens: 2000 },
  { id: 'deepseek-v4.1-flash', extra: { reasoning_effort: 'low' }, maxTokens: 2000 },
  { id: 'qwen3.8-max', extra: {}, maxTokens: 2000 },
  { id: 'glm-5.3', extra: {}, maxTokens: 2000 },
  { id: 'qwen-plus', extra: {}, maxTokens: 2000 },
];

const PROMPT = `Ты баг-хантер. Найди баги в этом коде игры:

\`\`\`js
let score = 0;
function addPoint() { score++; localStorage.setItem('s', score); }
function reset() { score = 0; }
function render() { document.getElementById('s').textContent = score; }
setInterval(render, 16);
window.addEventListener('click', () => { addPoint(); });
\`\`\`

Ответь СТРОГО в JSON без пояснений:
{"bugs":[{"file":"<file>","severity":"P0|P1|P2","title":"...","detail":"...","confidence":"high|medium|low"}],"clean":false}`;

for (const m of MODELS) {
  const t0 = Date.now();
  try {
    const out = await chat(m.id, [{ role: 'user', content: PROMPT }], {
      maxTokens: m.maxTokens, temperature: 0, timeoutMs: 120000, extra: m.extra,
    });
    console.log(`\n=== ${m.id} (${Date.now() - t0}ms, ${out.length} chars) ===`);
    console.log(out.slice(0, 500));
  } catch (e) {
    console.log(`\n=== ${m.id} ERROR (${Date.now() - t0}ms): ${e.message} ===`);
  }
}
