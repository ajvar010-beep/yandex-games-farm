import puppeteer from 'puppeteer-core';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const GAMES = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--mute-audio'] });
for (const name of GAMES) {
  const url = 'file:///C:/GameFactory/games/' + name + '/index.html';
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message).slice(0,150)));
  page.on('console', m => { if (m.type()==='error') errs.push('console: ' + m.text().slice(0,150)); });
  await page.goto(url + '?lang=ru&mute=1', { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction('window.__capture && window.__capture.ready === true', { timeout: 12000 }).catch(()=>errs.push('no capture.ready'));
  await new Promise(r=>setTimeout(r,500));
  const probe = await page.evaluate(() => {
    const out = {};
    out.title = document.title;
    try { out.t_title = Engine.i18n.t('title'); } catch(e){ out.t_title = 'ERR '+e.message; }
    const sc = Engine.sdk._game && Engine.sdk._game.scene;
    out.sceneName = Engine.sdk._game ? Engine.sdk._game.sceneName : '?';
    const btns = sc && sc.buttons;
    out.btnCount = btns ? btns.length : -1;
    out.btnTexts = btns ? btns.map(b=>String(b.text)).slice(0,6) : [];
    if (btns && btns.length) {
      const b = btns.find(x=>x.id==='play') || btns[0];
      out.clicked = b.id;
      if (sc.handleButton) { try { sc.handleButton(b.id); out.tap='handleButton ok'; } catch(e){ out.tap='handleButton THREW: '+e.message.slice(0,120); } }
      else out.tap='no handleButton';
      out.sceneAfter = Engine.sdk._game.sceneName;
    }
    return out;
  });
  await new Promise(r=>setTimeout(r,400));
  console.log('['+name+']', JSON.stringify(probe));
  if (errs.length) console.log('   ERRORS:', JSON.stringify(errs.slice(0,5)));
  await ctx.close();
}
await browser.close();
