// pipeline/scaffold-fireflygrove.mjs — каркас игры №9 «Ламповый Сад».
// Копирует движок + sdk-stub + index.html из pizzaspin (последний эталон).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'games', 'pizzaspin');
const DST = path.join(ROOT, 'games', 'fireflygrove');

if (fs.existsSync(DST)) {
  console.error('games/fireflygrove уже существует — отменяю');
  process.exit(1);
}

const copy = (rel) => {
  const from = path.join(SRC, rel);
  const to = path.join(DST, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  console.log('copy', rel);
};

for (const f of fs.readdirSync(path.join(SRC, 'engine'))) copy(path.join('engine', f));
copy('sdk-stub.js');
copy('index.html');
console.log('scaffold fireflygrove OK');
