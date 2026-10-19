// pipeline/scaffold-mahjongpair.mjs — каркас игры №4 партии-2 «Парный Маджонг» (mahjongpair).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'games', 'wordlink');
const DST = path.join(ROOT, 'games', 'mahjongpair');

if (fs.existsSync(DST)) {
  console.error('games/mahjongpair уже существует — отменяю');
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
console.log('scaffold mahjongpair OK');
