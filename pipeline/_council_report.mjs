// pipeline/_council_report.mjs — свести находки консилиума в читабельный отчёт.
// Дедупликация по (нормализованный title) + подсчёт голосов моделей.
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(import.meta.dirname, '..', 'scratch', 'council');
const files = fs.readdirSync(OUT).filter(f => f.endsWith('.json') && f !== '_summary.json');

const byGame = new Map();
for (const f of files) {
  const [slug, model] = f.replace('.json', '').split('.');
  const j = JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'));
  if (j.error || !j.bugs) continue;
  if (!byGame.has(slug)) byGame.set(slug, []);
  for (const b of j.bugs) byGame.get(slug).push({ ...b, by: model });
}

// Нормализуем title для кластеризации похожих находок
function norm(t) {
  return (t || '').toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, ' ')
    .split(/\s+/).filter(w => w.length > 3).sort().join(' ');
}

function cluster(bugs) {
  const seen = new Map(); // normTitle → cluster
  const clusters = [];
  for (const b of bugs) {
    const key = norm(b.title);
    let found = null;
    for (const [k, c] of seen) {
      // совпадение по пересечению слов ≥60%
      const a = new Set(k.split(' ')), bb = new Set(key.split(' '));
      const inter = [...a].filter(x => bb.has(x)).length;
      if (inter / Math.max(a.size, bb.size, 1) >= 0.5) { found = c; break; }
    }
    if (!found) { found = { title: b.title, items: [], severity: b.severity }; seen.set(key, found); clusters.push(found); }
    found.items.push(b);
    if (b.severity === 'P0') found.severity = 'P0';
    else if (b.severity === 'P1' && found.severity !== 'P0') found.severity = 'P1';
  }
  return clusters.sort((a, b) => {
    const ord = { P0: 0, P1: 1, P2: 2 };
    return ord[a.severity] - ord[b.severity] || b.items.length - a.items.length;
  });
}

const report = [];
for (const [slug, bugs] of [...byGame.entries()].sort()) {
  const clusters = cluster(bugs);
  const p0 = clusters.filter(c => c.severity === 'P0').length;
  const p1 = clusters.filter(c => c.severity === 'P1').length;
  report.push({ slug, total: bugs.length, clusterCount: clusters.length, P0: p0, P1: p1, clusters });
}

// Топ-P0
console.log('=== P0 КЛАСТЕРЫ (по играм) ===');
for (const r of report.filter(r => r.P0 > 0).sort((a, b) => b.P0 - a.P0)) {
  console.log(`\n${r.slug} [P0:${r.P0} P1:${r.P1} total:${r.total}]`);
  for (const c of r.clusters.filter(c => c.severity === 'P0')) {
    const voters = [...new Set(c.items.map(i => i.by))].join('+');
    console.log(`  [P0×${c.items.length}:${voters}] ${c.title.slice(0, 100)}`);
    console.log(`      ${c.items[0].detail?.slice(0, 140) || ''}`);
  }
}
console.log('\n=== СВОДКА ===');
for (const r of report) console.log(`${r.slug}: clusters=${r.clusterCount} P0=${r.P0} P1=${r.P1} raw=${r.total}`);
fs.writeFileSync(path.join(OUT, '_report.json'), JSON.stringify(report, null, 2));
console.log('\n→ scratch/council/_report.json');
