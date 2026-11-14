const fs = require('fs'), crypto = require('crypto'), path = require('path'), os = require('os');
function md5(p) { return crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex'); }
const zd = path.join(os.tmpdir(), 'wg_zt');
const files = ['index.html', 'game/scenes.js', 'game/config.js', 'game/i18n.js', 'game/logic.js',
  'game/art.js', 'game/main.js', 'engine/sdk.js', 'engine/core.js', 'engine/storage.js',
  'engine/platform.js', 'engine/input.js', 'engine/audio.js', 'engine/i18n.js', 'engine/fx.js',
  'engine/ui.js', 'engine/rng.js', 'engine/capture.js', 'sdk-stub.js',
  'engine/platform/vk.js', 'engine/platform/gamemonetize.js'];
let diff = 0, missing = 0;
for (const f of files) {
  const a = path.join(zd, f), b = 'C:/GameFactory/games/wordgrid/' + f;
  if (!fs.existsSync(a)) { diff++; missing++; console.log('MISSING IN ZIP:', f); continue; }
  if (md5(a) !== md5(b)) { diff++; console.log('DIFF:', f); }
}
console.log(diff === 0 ? 'ZIP == TREE (все 21 файлы совпали)' : 'ZIP ОТСТАЁТ: ' + diff + ' файлов');
