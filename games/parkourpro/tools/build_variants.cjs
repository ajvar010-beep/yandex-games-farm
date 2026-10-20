// Сборка серии: Нубик / Про / Бог — меняем variant.gd и пересобираем
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VARIANT_GD = path.join(ROOT, 'scripts', 'variant.gd');
const ORIG = fs.readFileSync(VARIANT_GD, 'utf8');

const variants = [
  { id: 'nub',  title: 'НУБИК ПАРКУР', sub: 'Учись прыгать! Лёгкие уровни для новичков.', diff: 0.8, color: 'Color(0.35,0.75,0.35)' },
  { id: 'pro',  title: 'ПРО ПАРКУР',   sub: 'Прыгай по блокам. Не упади в лаву. Дойди до финиша.', diff: 1.0, color: 'Color(0.25,0.45,0.95)' },
  { id: 'god',  title: 'БОГ ПАРКУРА',  sub: 'Только для избранных. Узкие платформы, злые ловушки.', diff: 1.35, color: 'Color(1.0,0.85,0.2)' },
];

for (const v of variants) {
  console.log('=== building variant:', v.id, '===');
  let content = ORIG
    .replace(/@export var id := ".*?"/, `@export var id := "${v.id}"`)
    .replace(/@export var title := ".*?"/, `@export var title := "${v.title}"`)
    .replace(/@export var subtitle := ".*?"/, `@export var subtitle := "${v.sub}"`)
    .replace(/@export var difficulty := [\d.]+/, `@export var difficulty := ${v.diff}`);
  fs.writeFileSync(VARIANT_GD, content);
  const outDir = `export/web_${v.id}`;
  execSync(`"${process.env.GODOT}" --headless --export-release "Web" "${outDir}/index.html"`, { stdio: 'pipe' });
  console.log('built', outDir);
}
// restore
fs.writeFileSync(VARIANT_GD, ORIG);
console.log('done all variants');
