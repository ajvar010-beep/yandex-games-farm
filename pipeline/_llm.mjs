// pipeline/_llm.mjs — минимальный клиент к OpenAI-совместимому прокси для консилиума.
// Использование: import { chat } from './_llm.mjs'
import fs from 'node:fs';

const KEY = process.env.PX_KEY || 'px_live_gsrKysbb68tW1NvKw8K6UH98IXKGmW_9';
const BASE = process.env.PX_BASE || 'https://novaproxy.duckdns.org/v1';

export async function chat(model, messages, { maxTokens = 4000, temperature = 0.2, timeoutMs = 240000, extra = {} } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const body = { model, messages, max_tokens: maxTokens, temperature, ...extra };
    const r = await fetch(BASE + '/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + (await r.text()).slice(0, 300));
    const j = await r.json();
    const msg = j.choices?.[0]?.message;
    return (msg?.content ?? '').trim();
  } finally { clearTimeout(t); }
}

// Собрать код игры в один компактный бандл для ревью (без engine/, без данных).
export function bundleGame(gameDir, { maxPerFile = 20000, maxTotal = 100000 } = {}) {
  const skip = /(^|[\\/])(engine|node_modules|scratch|export|assets|media)([\\/]|$)/;
  const keep = /\.(js|html|css|json)$/;
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = d + '/' + e.name;
      if (e.isDirectory()) { if (!skip.test(p)) walk(p); continue; }
      if (skip.test(p) || !keep.test(e.name)) continue;
      files.push(p);
    }
  };
  walk(gameDir);
  // Большие файлы первыми — они важнее, чем крошечные конфиги
  const sized = files.map(f => [f, fs.statSync(f).size]).sort((a, b) => b[1] - a[1]);
  let out = '';
  for (const [f] of sized) {
    let src = fs.readFileSync(f, 'utf8');
    if (src.length > maxPerFile) src = src.slice(0, maxPerFile) + `\n// ... [truncated ${src.length - maxPerFile} chars]`;
    const rel = f.replace(gameDir + '/', '');
    const block = `\n// ===== FILE: ${rel} =====\n` + src;
    if (out.length + block.length > maxTotal) { out += `\n// ... [${files.length} files total, ${sized.length - out.split('===== FILE:').length + 1} omitted by size]`; break; }
    out += block;
  }
  return out;
}

export function extractJSON(text) {
  // Достать JSON из ответа: сначала пробуем целиком, потом по fenced-блоку, потом по скобкам.
  const t = text.trim();
  try { return JSON.parse(t); } catch {}
  const fence = t.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (fence) { try { return JSON.parse(fence[1]); } catch {} }
  const i = t.indexOf('{'), j2 = t.lastIndexOf('}');
  if (i >= 0 && j2 > i) { try { return JSON.parse(t.slice(i, j2 + 1)); } catch {} }
  const ai = t.indexOf('['), aj = t.lastIndexOf(']');
  if (ai >= 0 && aj > ai) { try { return JSON.parse(t.slice(ai, aj + 1)); } catch {} }
  throw new Error('no JSON in response: ' + t.slice(0, 200));
}
