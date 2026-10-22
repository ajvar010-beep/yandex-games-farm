#!/usr/bin/env node
/**
 * pack.mjs — сборка публикации игры для Яндекс Игр.
 *
 *   node pack.mjs <gameDir>            → packages/<game>/game.zip (index.html в корне, ASCII-имена)
 *   node pack.mjs <gameDir> --check    → только валидация пакета и медиа по docs/yandex-specs.md
 *
 * Ожидает структуру:
 *   games/<name>/...            — билд игры (index.html в корне)
 *   games/<name>/export/web/    — ИЛИ Web-билд Godot (index.html + index.pck/wasm), берётся автоматически
 *   packages/<name>/media/      — icon.png, cover.png, shot_ru_*.png, shot_en_*.png, gameplay_*.mp4
 *   packages/<name>/texts/      — title.ru.txt, seo.ru.txt, short.ru.txt, about.ru.txt, how_to_play.ru.txt (+ .en.)
 *   packages/<name>/CHECKLIST.md — генерируется автоматически
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..');
const gameDir = process.argv[2] ? resolve(process.argv[2]) : null;
const checkOnly = process.argv.includes('--check');
if (!gameDir) { console.error('usage: pack.mjs <gameDir> [--check]'); process.exit(2); }
const name = gameDir.split(/[\\/]/).pop();
const pkgDir = join(ROOT, 'packages', name);
const mediaDir = join(pkgDir, 'media');
const textsDir = join(pkgDir, 'texts');

const errors = [], warnings = [];
function e(m) { errors.push(m); } function w(m) { warnings.push(m); }

// ---------- 1. валидация текстов (лимиты из docs/yandex-specs.md §2) ----------
const TEXT_LIMITS = {
  title: { max: 50 }, seo: { max: 160 }, short: { max: 70 },
  about: { min: 100, max: 1000 }, how_to_play: { min: 40, max: 1000 },
};
function checkTexts() {
  if (!existsSync(textsDir)) { e('нет packages/' + name + '/texts/'); return null; }
  const out = {};
  for (const lang of ['ru', 'en']) {
    out[lang] = {};
    for (const [field, lim] of Object.entries(TEXT_LIMITS)) {
      const f = join(textsDir, `${field}.${lang}.txt`);
      if (!existsSync(f)) { e(`текст: нет ${field}.${lang}.txt`); continue; }
      const t = readFileSync(f, 'utf8').replace(/\r/g, '').trim();
      out[lang][field] = t;
      if (!t) { e(`текст: ${field}.${lang}.txt пуст`); continue; }
      if (lim.max && [...t].length > lim.max) e(`текст: ${field}.${lang}.txt ${[...t].length} > ${lim.max}`);
      if (lim.min && [...t].length < lim.min) e(`текст: ${field}.${lang}.txt ${[...t].length} < ${lim.min}`);
      if (/(.)\1{4,}/.test(t)) w(`текст: ${field}.${lang}.txt — повторяющиеся символы (правило 5.11)`);
    }
  }
  // 6.5: название без слов «игра»/«game»; EN != RU (реальный перевод)
  for (const lang of ['ru', 'en']) {
    const t = out[lang]?.title;
    if (t) {
      if (/\b(игра|game)\b/i.test(t)) w(`title.${lang}: содержит «игра»/«game» (6.5) — проверить, что это неотъемлемая часть`);
      if (t.length > 50) e(`title.${lang}: >50`);
    }
  }
  if (out.ru?.title && out.en?.title && out.ru.title === out.en.title)
    w('title RU == title EN — допустимо только для имени собственного; иначе EN-карта должна быть переводом');
  for (const f of ['about', 'how_to_play', 'short', 'seo'])
    if (out.ru?.[f] && out.en?.[f] && out.ru[f] === out.en[f]) e(`${f}: EN идентичен RU — нужен реальный перевод (валидатор консоли это отклоняет)`);
  return out;
}

// ---------- 2. валидация медиа (§1) ----------
function pngSize(file) {
  const b = readFileSync(file);
  if (b.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), hasAlpha: b[25] === 6 };
}
function jpegSize(file) {
  const b = readFileSync(file); let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) break;
    const m = b[i + 1];
    if (m === 0xc0 || m === 0xc2) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5), hasAlpha: false };
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}
function imgSize(f) { return f.endsWith('.png') ? pngSize(f) : jpegSize(f); }
function ffprobeDuration(f) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' });
  return r.status === 0 ? parseFloat(r.stdout.trim()) : null;
}
function checkMedia() {
  if (!existsSync(mediaDir)) { e('нет packages/' + name + '/media/'); return; }
  const files = readdirSync(mediaDir);
  // иконка
  const icon = files.find(f => /^icon\.(png|jpe?g)$/i.test(f));
  if (!icon) e('media: нет icon.png (512×512)');
  else {
    const s = imgSize(join(mediaDir, icon));
    if (!s || s.w !== 512 || s.h !== 512) e(`media: icon должен быть ровно 512×512, есть ${s ? s.w + '×' + s.h : '?'}`);
    if (statSync(join(mediaDir, icon)).size > 1048576) e('media: icon >1 МБ');
  }
  // обложка: одна на язык (cover.ru.png + cover.en.png) либо общая cover.png
  const covers = files.filter(f => /^cover(\.(ru|en))?\.(png|jpe?g)$/i.test(f));
  if (!covers.length) e('media: нет cover.png / cover.ru.png+cover.en.png (800×470)');
  for (const cover of covers) {
    const s = imgSize(join(mediaDir, cover));
    if (!s || s.w !== 800 || s.h !== 470) e(`media: ${cover} должен быть ровно 800×470, есть ${s ? s.w + '×' + s.h : '?'}`);
    if (statSync(join(mediaDir, cover)).size > 2097152) e(`media: ${cover} >2 МБ`);
  }
  // скриншоты (контракт конвейера-чемпиона): сабмишн-глобы screenshot_landscape_*_<lang>
  // (десктоп, 16:9) и screenshot_portrait_*_<lang> (мобильные, 9:16); qa_* — не сабмишн.
  // ≥3 десктопных на язык; длинная сторона 1280–2560; 24-бит PNG без альфы или JPEG; ≤5 МБ.
  const checkShots = (list, ratio, label) => {
    for (const f of list) {
      const p = join(mediaDir, f);
      const s = imgSize(p);
      if (!s) { e(`media: ${f} — не PNG/JPEG`); continue; }
      const long = Math.max(s.w, s.h), short = Math.min(s.w, s.h);
      if (Math.abs(long / short - ratio) > 0.02) e(`media: ${f} ${s.w}×${s.h} — не ${label}`);
      if (long < 1280 || long > 2560) e(`media: ${f} длинная сторона ${long} вне 1280–2560`);
      if (s.hasAlpha) e(`media: ${f} — PNG с альфа-каналом (нужен 24-бит без альфы)`);
      if (statSync(p).size > 5242880) e(`media: ${f} >5 МБ`);
    }
    // идентичные скрины консоль отклоняет
    const hashes = list.map(f => execFileSync('certutil', ['-hashfile', join(mediaDir, f), 'SHA256'], { encoding: 'utf8' }).split('\n')[1]?.trim());
    if (new Set(hashes.filter(Boolean)).size !== hashes.filter(Boolean).length) e(`media: ${list[0]?.split('_').slice(0, 2).join('_')}_* содержат идентичные файлы (консоль отклоняет)`);
  };
  for (const lang of ['ru', 'en']) {
    const desk = files.filter(f => new RegExp(`^screenshot_landscape_.+_${lang}\\.(png|jpe?g)$`, 'i').test(f));
    if (desk.length < 3) e(`media: десктоп-скриншотов ${lang} ${desk.length} < 3`);
    checkShots(desk, 16 / 9, '16:9');
    const port = files.filter(f => new RegExp(`^screenshot_portrait_.+_${lang}\\.(png|jpe?g)$`, 'i').test(f));
    if (port.length) checkShots(port, 16 / 9, '9:16'); // long:short всегда 16:9 (портрет = 720×1280)
  }
  // видео: горизонтальное ОБЯЗАТЕЛЬНО, ≤28с, ≤100 МБ
  const vids = files.filter(f => /^gameplay_.*\.mp4$/i.test(f));
  const horiz = vids.find(f => f.includes('landscape'));
  if (!horiz) e('media: нет обязательного gameplay_landscape*.mp4');
  for (const v of vids) {
    const p = join(mediaDir, v);
    if (statSync(p).size > 104857600) e(`media: ${v} >100 МБ`);
    const d = ffprobeDuration(p);
    if (d == null) w(`media: ${v} — ffprobe не смог прочитать длительность`);
    else if (d > 28) e(`media: ${v} ${d.toFixed(1)}с > 28с`);
    else if (d < 5) w(`media: ${v} всего ${d.toFixed(1)}с — лучше 15–28с`);
  }
}

// ---------- 3. валидация билда + zip (§4) ----------
// Godot-проекты (parkour-серия): билд лежит в <gameDir>/export/web/, а не в корне.
// buildDir определяет, что идёт в zip и откуда читать index.html.
const buildDir = existsSync(join(gameDir, 'index.html')) ? gameDir
  : existsSync(join(gameDir, 'export', 'web', 'index.html')) ? join(gameDir, 'export', 'web')
  : gameDir;
function walk(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(d =>
    d.isDirectory() ? walk(join(dir, d.name), base) : [relative(base, join(dir, d.name))]);
}
function checkBuild() {
  if (!existsSync(join(buildDir, 'index.html'))) { e('билд: нет index.html ни в корне ' + gameDir + ', ни в export/web/'); return null; }
  const files = walk(buildDir);
  let total = 0;
  for (const rel of files) {
    if (/[^\x20-\x7e]/.test(rel) || /\s/.test(rel)) e(`билд: не-ASCII/пробел в имени: ${rel} (1.22)`);
    total += statSync(join(buildDir, rel)).size;
  }
  if (total > 100 * 1024 * 1024) e(`билд: ${Math.round(total / 1048576)} МБ > 100 МБ (1.21)`);
  const html = readFileSync(join(buildDir, 'index.html'), 'utf8');
  if (!/\/sdk\.js|sdk\.js/.test(html)) w('билд: index.html не ссылается на sdk.js — проверить подключение SDK (1.1)');
  return files;
}

// ---------- 4. сборка zip ----------
function makeZip(files) {
  mkdirDir(pkgDir);
  const zipPath = join(pkgDir, 'game.zip');
  rmSync(zipPath, { force: true });
  // КРИТИЧНО (урок прошлой модерации, yandex-skill-dungeon §18): zip собирается Python'ом,
  // НЕ PowerShell Compress-Archive — тот пишет backslash-разделители (assets\x.js),
  // из-за чего Yandex (Linux) отдаёт 404 на все ресурсы кроме index.html.
  const py = `
import zipfile, os, sys
src, out = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, fs in os.walk(src):
        for f in fs:
            p = os.path.join(root, f)
            zf.write(p, os.path.relpath(p, src).replace(os.sep, '/'))
print('zipped')
`;
  const r = spawnSync('python', ['-c', py, buildDir, zipPath], { encoding: 'utf8' });
  if (r.status !== 0 || !existsSync(zipPath)) { e('zip: python-zip failed: ' + (r.stderr || r.stdout)); return null; }
  // проверка: index.html в КОРНЕ архива, пути только с forward slash
  const verify = spawnSync('python', ['-c',
    `import zipfile,sys; [print(n) for n in zipfile.ZipFile(sys.argv[1]).namelist()]`, zipPath], { encoding: 'utf8' });
  const entries = (verify.stdout || '').split(/\r?\n/).filter(Boolean);
  if (!entries.includes('index.html')) e('zip: index.html НЕ в корне архива: ' + entries.slice(0, 5).join(', '));
  const bad = entries.filter(n => n.includes('\\'));
  if (bad.length) e('zip: backslash в путях (404 на Yandex Linux): ' + bad.slice(0, 3).join(', '));
  return zipPath;
}
function mkdirDir(p) { mkdirSync(p, { recursive: true }); }

// ---------- 5. чеклист ручной загрузки (§7) ----------
function writeChecklist(texts, zipPath) {
  const zipSize = zipPath && existsSync(zipPath) ? (statSync(zipPath).size / 1048576).toFixed(1) + ' МБ' : '?';
  const md = `# Чеклист загрузки «${texts?.ru?.title || name}» в Яндекс Игры

Готово к копипасту в консоль: https://yandex.com/games/developer

## Общее (вкладка «Общее»)
- [ ] Версия: 0.0.0.1
- [ ] Платформы: Десктопные + Мобильные
- [ ] Ориентация: как в игре (проверить!)
- [ ] Языки: Русский (основной), Английский
- [ ] Возраст: 6+
- [ ] Категории: 1–2; Теги: 3–5; Ключевые слова ≤100 симв.
- [ ] Облачные сохранения: ДА (игра использует player.setData/getData)
- [ ] Комментарий разработчика ≤2048: SDK v2 (LoadingAPI.ready, GameplayAPI.start/stop),
      fullscreen с кулдауном 60с в логических паузах, rewarded по кнопке, стики-баннер вне
      геймплея, i18n автоопределение, звук на паузе при blur, относительные пути, 0 внешних запросов.
- [ ] Email для обратной связи

## Русский (вкладка «Русский») — из packages/${name}/texts/*.ru.txt
- [ ] Название: ${texts?.ru?.title || '—'}
- [ ] SEO / Короткое / Об игре / Как играть — скопировать из файлов

## English (вкладка «English») — из packages/${name}/texts/*.en.txt
- [ ] Title: ${texts?.en?.title || '—'}
- [ ] SEO / Short / About / How to play — скопировать из файлов

## Медиа (packages/${name}/media/)
- [ ] Иконка: icon.png (512×512, RGB без альфы)
- [ ] Обложка RU: cover.ru.png (800×470) / EN: cover.en.png
- [ ] Скриншоты десктоп RU: screenshot_landscape_*_ru.png (≥3, 16:9, реальный геймплей)
- [ ] Скриншоты десктоп EN: screenshot_landscape_*_en.png (интерфейс на EN!)
- [ ] Скриншоты мобильные (если заявлены): screenshot_portrait_*_{ru,en}.png (9:16)
- [ ] Видео горизонтальное (ОБЯЗАТЕЛЬНО): gameplay_landscape.ru.mp4 (+ .en)
- [ ] qa_*.png — служебные, в консоль НЕ загружать

## Архив
- [ ] game.zip (${zipSize}) — index.html в корне, <100 МБ

## Перед отправкой
- [ ] RSYA-контракт подписан в консоли (без него SUBMIT недоступен)
- [ ] Черновик → «Отправить на модерацию»
`;
  writeFileSync(join(pkgDir, 'CHECKLIST.md'), md);
}

// ---------- main ----------
const texts = checkTexts();
checkMedia();
const buildFiles = checkBuild();
let zipPath = null;
if (!checkOnly && errors.length === 0) zipPath = makeZip(buildFiles);
writeChecklist(texts, zipPath);

console.log(`\n=== ${name} ===`);
for (const x of errors) console.log('ERROR: ' + x);
for (const x of warnings) console.log('WARN : ' + x);
if (!errors.length) console.log(zipPath ? 'OK zip: ' + zipPath : 'OK check');
console.log('checklist: ' + join(pkgDir, 'CHECKLIST.md'));
process.exit(errors.length ? 1 : 0);
