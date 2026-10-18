/* Конвейер: scaffold игры №6 — копия движка (байт-в-байт из mergemon) + заготовка game/. */
import { cpSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = join(ROOT, 'games', 'mergemon');
const DST = join(ROOT, 'games', 'sweettower');

mkdirSync(DST, { recursive: true });
cpSync(join(SRC, 'engine'), join(DST, 'engine'), { recursive: true });
cpSync(join(SRC, 'sdk-stub.js'), join(DST, 'sdk-stub.js'));
cpSync(join(SRC, 'index.html'), join(DST, 'index.html'));
mkdirSync(join(DST, 'game'), { recursive: true });
console.log('scaffold sweettower: engine + sdk-stub + index.html скопированы; game/ пуст');
