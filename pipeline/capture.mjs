#!/usr/bin/env node
/**
 * capture.mjs — универсальный медиа-захватчик игр фабрики C:\GameFactory.
 * Драйвер — Chrome/Edge headless через CDP (свой WebSocket-клиент, puppeteer не нужен).
 *
 * Контракт capture-хуков, который ОБЯЗАНА давать каждая игра фабрики:
 *   URL: ?lang=ru|en &seed=N &scene=<name> &auto=1 &step=1 &at=<frames> &shot=<id>
 *   window.__CAPTURE = {
 *     ready():bool,               // игра загрузилась и готова к командам
 *     setLang(l), setSeed(n),     // переключить язык/сид детерминированно
 *     setState(scene, opts),      // перейти в конкретное состояние
 *     step(frames):Promise|void,  // детерминированно продвинуть симуляцию на N кадров
 *     startAuto(), stopAuto(),    // attract-режим: игра сама эффектно играет без ввода
 *   }
 *   В standalone (без /sdk.js) игра полностью работает; реклама в заглушке мгновенна.
 *
 * Команды:
 *   node capture.mjs smoke <gameDir>
 *       → загрузка, 0 ошибок консоли (кроме ожидаемого 404 /sdk.js), __CAPTURE.ready()
 *   node capture.mjs shots <gameDir> <outDir> [--langs ru,en] [--seed 42] [--shots a,b,c]
 *       → 1280×720 PNG: shot_<lang>_<id>.png (по умолчанию 4 кадра: menu/gameplay/action/progress)
 *   node capture.mjs video <gameDir> <outDir> [--lang ru] [--seconds 26] [--fps 30] [--portrait]
 *       → покадрово через __CAPTURE.step(1) → ffmpeg → gameplay_<orient>_<lang>.mp4 (≤28с)
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import http from 'node:http';
import net from 'node:net';

const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const IGNORE_CONSOLE = /sdk\.js|Failed to load resource|ERR_FILE_NOT_FOUND/i;

function findBrowser() {
  for (const b of BROWSERS) if (existsSync(b)) return b;
  throw new Error('Chrome/Edge не найден: ' + BROWSERS.join(' | '));
}

// --- минимальный CDP-клиент поверх net (RFC6455, клиентская маска обязательна) ---
class CDPClient {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.onEvent = null; }
  connect() {
    const u = new URL(this.wsUrl);
    const key = randomBytes(16).toString('base64');
    return new Promise((res, rej) => {
      this.sock = net.connect(Number(u.port || 80), u.hostname, () => {
        const path = u.pathname + (u.search || '');
        this.sock.write(
          `GET ${path} HTTP/1.1\r\nHost: ${u.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n` +
          `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
      });
      let handshaked = false, acc = Buffer.alloc(0);
      this.sock.on('data', chunk => {
        acc = Buffer.concat([acc, chunk]);
        if (!handshaked) {
          const idx = acc.indexOf('\r\n\r\n');
          if (idx === -1) return;
          if (!/101/i.test(acc.slice(0, idx).toString())) return rej(new Error('WS handshake failed'));
          acc = acc.slice(idx + 4); handshaked = true; res();
        }
        for (;;) {
          if (acc.length < 2) break;
          const b0 = acc[0], b1 = acc[1];
          let len = b1 & 0x7f, off = 2;
          if (len === 126) { if (acc.length < off + 2) break; len = acc.readUInt16BE(off); off += 2; }
          else if (len === 127) { if (acc.length < off + 8) break; len = Number(acc.readBigUInt64BE(off)); off += 8; }
          if (b1 & 0x80) off += 4;
          if (acc.length < off + len) break;
          const payload = acc.slice(off, off + len); acc = acc.slice(off + len);
          if ((b0 & 0x0f) === 1) this._onMessage(payload.toString('utf8'));
          else if ((b0 & 0x0f) === 8) { this.sock.end(); return; }
        }
      });
      this.sock.on('error', rej);
    });
  }
  _onMessage(text) {
    let m; try { m = JSON.parse(text); } catch { return; }
    if (m.id != null && this.pending.has(m.id)) {
      const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id);
      m.error ? rej(new Error(m.error.message)) : res(m.result);
    } else if (this.onEvent) this.onEvent(m);
  }
  send(method, params = {}) {
    const id = ++this.id;
    const data = Buffer.from(JSON.stringify({ id, method, params }));
    const mask = randomBytes(4);
    let header;
    if (data.length < 126) header = Buffer.from([0x81, 0x80 | data.length]);
    else if (data.length < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 0x80 | 126; header.writeUInt16BE(data.length, 2); }
    else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(data.length), 2); }
    const masked = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i++) masked[i] = data[i] ^ mask[i & 3];
    this.sock.write(Buffer.concat([header, mask, masked]));
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); rej(new Error('CDP timeout: ' + method)); } }, 30000);
    });
  }
  close() { try { this.sock.end(); } catch {} }
}

function httpGetJson(port, path) {
  return new Promise((ok, no) => {
    const req = http.get({ host: '127.0.0.1', port, path }, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => { try { ok(JSON.parse(d)); } catch (e) { no(e); } });
    });
    req.on('error', no); req.setTimeout(1500, () => req.destroy(new Error('timeout')));
  });
}
async function waitForPort(port, timeoutMs = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { return await httpGetJson(port, '/json/version'); } catch { await new Promise(r => setTimeout(r, 400)); }
  }
  throw new Error('CDP-порт не поднялся: ' + port);
}

async function openPage(browserDir, url, { width = 1280, height = 720, mobile = false } = {}) {
  const port = 9222 + Math.floor(Math.random() * 600);
  const proc = spawn(findBrowser(), [
    '--headless=new', `--remote-debugging-port=${port}`,
    `--user-data-dir=${join(browserDir, 'p' + port)}`,
    '--no-first-run', '--no-default-browser-check', '--mute-audio', '--disable-gpu',
    '--hide-scrollbars', '--force-device-scale-factor=1', '--allow-file-access-from-files',
    `--window-size=${width},${height}`, 'about:blank',
  ], { stdio: 'ignore' });
  try {
    await waitForPort(port);
    const tab = await httpGetJson(port, '/json/new?' + encodeURIComponent(url));
    const cdp = new CDPClient(tab.webSocketDebuggerUrl);
    await cdp.connect();
    const consoleErrors = [];
    cdp.onEvent = m => {
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
        consoleErrors.push(m.params.args.map(a => a.value || a.description || '').join(' '));
      else if (m.method === 'Runtime.exceptionThrown')
        consoleErrors.push(m.params.exceptionDetails?.exception?.description || 'exception');
      else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error')
        consoleErrors.push(m.params.entry.text);
    };
    await cdp.send('Runtime.enable'); await cdp.send('Log.enable'); await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
    return { cdp, consoleErrors, proc, close: () => { cdp.close(); proc.kill('SIGKILL'); } };
  } catch (e) { proc.kill('SIGKILL'); throw e; }
}
async function evalIn(cdp, expr) {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval failed');
  return r.result?.value;
}
async function waitReady(cdp, timeoutMs = 25000) {
  const t0 = Date.now();
  for (;;) {
    if (await evalIn(cdp, `!!(window.__CAPTURE&&window.__CAPTURE.ready&&window.__CAPTURE.ready())`).catch(() => false)) return true;
    if (Date.now() - t0 > timeoutMs) return false;
    await new Promise(r => setTimeout(r, 250));
  }
}
async function screenshot(cdp, file) {
  const s = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(file, Buffer.from(s.data, 'base64'));
}

// ---------- CLI ----------
const cmd = process.argv[2];
const gameDir = process.argv[3] ? resolve(process.argv[3]) : null;
const outDir = process.argv[4] ? resolve(process.argv[4]) : null;
const flag = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d; };

if (!cmd || !gameDir) { console.error('usage: capture.mjs <smoke|shots|video> <gameDir> [outDir] [flags]'); process.exit(2); }
const indexHtml = join(gameDir, 'index.html');
if (!existsSync(indexHtml)) { console.error('нет index.html в ' + gameDir); process.exit(2); }
const fileUrl = 'file:///' + indexHtml.replace(/\\/g, '/');
const browserDir = resolve(gameDir, '..', '..', '.capture-tmp');
mkdirSync(browserDir, { recursive: true });

try {
  if (cmd === 'smoke') {
    const { cdp, consoleErrors, close } = await openPage(browserDir, fileUrl);
    try {
      const ready = await waitReady(cdp, 20000);
      await new Promise(r => setTimeout(r, 1500));
      const errs = consoleErrors.filter(e => !IGNORE_CONSOLE.test(e));
      console.log(JSON.stringify({ ok: ready && errs.length === 0, ready, consoleErrors: errs }, null, 2));
      process.exitCode = ready && errs.length === 0 ? 0 : 1;
    } finally { close(); }
  } else if (cmd === 'shots') {
    mkdirSync(outDir, { recursive: true });
    const seed = flag('seed', '42');
    const langs = flag('langs', 'ru,en').split(',');
    const custom = flag('shots', '').split(',').filter(Boolean);
    const plans = custom.length ? custom.map(id => ({ id })) : [
      { id: 'menu', scene: 'menu' },
      { id: 'gameplay', scene: 'game', auto: true, at: 480 },
      { id: 'action', scene: 'game', auto: true, at: 1500 },
      { id: 'progress', scene: 'game', auto: true, at: 3000 },
    ];
    for (const lang of langs) for (const p of plans) {
      const url = `${fileUrl}?lang=${lang}&seed=${seed}&capture=1` +
        (p.scene ? `&scene=${p.scene}` : '') + (p.auto ? '&auto=1' : '') + (p.at ? `&at=${p.at}` : '') + (p.id ? `&shot=${p.id}` : '');
      const { cdp, consoleErrors, close } = await openPage(browserDir, url);
      try {
        if (!await waitReady(cdp)) throw new Error('__CAPTURE не готов для ' + p.id);
        if (p.at) await evalIn(cdp, `(window.__CAPTURE.step?window.__CAPTURE.step(${p.at}):new Promise(r=>setTimeout(r,${Math.round(p.at / 60 * 1000)})))`);
        await new Promise(r => setTimeout(r, 350));
        const out = join(outDir, `shot_${lang}_${p.id}.png`);
        await screenshot(cdp, out);
        const errs = consoleErrors.filter(e => !IGNORE_CONSOLE.test(e));
        console.log(`OK ${out}${errs.length ? '  [errors: ' + errs.join('; ').slice(0, 120) + ']' : ''}`);
      } finally { close(); }
    }
  } else if (cmd === 'video') {
    mkdirSync(outDir, { recursive: true });
    const seconds = Number(flag('seconds', '26')); // ≤28 по спеке Яндекса
    const fps = Number(flag('fps', '30'));
    const lang = flag('lang', 'ru');
    const portrait = process.argv.includes('--portrait');
    const W = portrait ? 720 : 1280, H = portrait ? 1280 : 720;
    const framesDir = join(outDir, 'frames_' + (portrait ? 'v' : 'h'));
    rmSync(framesDir, { recursive: true, force: true }); mkdirSync(framesDir, { recursive: true });
    const url = `${fileUrl}?lang=${lang}&seed=${flag('seed', '7')}&capture=1&scene=game&auto=1&step=1`;
    const { cdp, consoleErrors, close } = await openPage(browserDir, url, { width: W, height: H });
    try {
      if (!await waitReady(cdp)) throw new Error('__CAPTURE не готов');
      const total = seconds * fps;
      for (let f = 0; f < total; f++) {
        await evalIn(cdp, `window.__CAPTURE.step(1)`);
        await screenshot(cdp, join(framesDir, `f_${String(f).padStart(5, '0')}.png`));
        if (f % 90 === 0) console.log(`frame ${f}/${total}`);
      }
      const errs = consoleErrors.filter(e => !IGNORE_CONSOLE.test(e));
      if (errs.length) console.warn('console errors:', errs.slice(0, 3));
    } finally { close(); }
    const outFile = join(outDir, `gameplay_${portrait ? 'portrait' : 'landscape'}_${lang}.mp4`);
    const ff = spawnSync(FFMPEG, ['-y', '-framerate', String(fps), '-i', join(framesDir, 'f_%05d.png'),
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', outFile], { stdio: 'inherit' });
    if (ff.status !== 0) throw new Error('ffmpeg failed');
    rmSync(framesDir, { recursive: true, force: true });
    console.log('OK ' + outFile);
  } else { console.error('неизвестная команда: ' + cmd); process.exit(2); }
} catch (e) { console.error('ERROR:', e.message); process.exit(1); }
