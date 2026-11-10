import fs from 'node:fs';
const games = ['mahjongpair','merge2048','solitairekl','sudokulite'];
for (const g of games) {
  const f = `../games/${g}/game/i18n.js`;
  let s = fs.readFileSync(f, 'utf8');
  if (s.includes('ru: STR.ru')) { console.log('уже:', g); continue; }
  // вставить словари сразу после "G.i18n = {"
  const out = s.replace(/(G\.i18n\s*=\s*\{)/, "$1\n    ru: STR.ru,\n    en: STR.en,");
  if (out === s) { console.log('НЕ НАЙДЕН паттерн:', g); continue; }
  fs.writeFileSync(f, out, 'utf8');
  console.log('OK:', g);
}
