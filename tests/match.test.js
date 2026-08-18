const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const GAME = path.join(ROOT, 'index.html');
const TMP  = path.join(ROOT, 'tmp');
fs.mkdirSync(TMP, { recursive: true });
const TEST_FILE = path.join(TMP, '_test.html');
const TEST_URL  = pathToFileURL(TEST_FILE).href;

// Playwright finds its own chromium unless CHROMIUM_PATH points somewhere else.
const LAUNCH = {
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']
};
if (process.env.CHROMIUM_PATH) LAUNCH.executablePath = process.env.CHROMIUM_PATH;
const shot = (name) => path.join(TMP, name);

(async () => {
  fs.copyFileSync(GAME, TEST_FILE);

  const browser = await chromium.launch(LAUNCH);
  const shots = process.argv.includes('--shots');
  const page = await browser.newPage({ viewport: shots?{width:1280,height:720}:{width:420,height:280} });
  const errors = [];
  page.on('console', m => { if(m.type()==='error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + (e.stack||e.message)));

  await page.goto(TEST_URL);
  await page.waitForTimeout(2000);

  const errBox = await page.evaluate(() => {
    const e = document.getElementById('err');
    return e && !e.classList.contains('hide') ? e.textContent : null;
  });
  if (errBox) { console.log('### STARTUP ERROR ###\n'+errBox); await browser.close(); process.exit(1); }
  console.log('boot:', JSON.stringify(await page.evaluate(()=>({phase:window.__FIRESTORM.state.phase, actors:window.__FIRESTORM.actors.length}))));
  if (shots) await page.screenshot({ path: shot('shot_menu.png') });

  await page.evaluate((lo) => {
    const F = window.__FIRESTORM;
    if(!lo){ F.settings.shadows=false; F.settings.scale=0.5; }
    F.settings.diff = 2;
    F.startMatch();
  }, shots);
  await page.waitForTimeout(1000);

  // AI-ish driver: look toward nearest visible enemy, hold trigger, move
  await page.evaluate(() => {
    const F = window.__FIRESTORM;
    window.__ev = (code,down)=>document.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code}));
    window.__sim = setInterval(() => {
      const p = F.player;
      if(!p.alive){ F.mouse.down=false; return; }
      let best=null, bd=1e9;
      for(const a of F.actors){ if(a===p||!a.alive||a.team===p.team) continue;
        const d=Math.hypot(a.pos.x-p.pos.x,a.pos.z-p.pos.z); if(d<bd){bd=d;best=a;} }
      if(best){
        p.yaw = Math.atan2(-(best.pos.x-p.pos.x), -(best.pos.z-p.pos.z));
        p.pitch = Math.atan2((best.pos.y+1.15)-(p.pos.y+p.height), bd);
        const eye = {x:p.pos.x, y:p.pos.y+p.height, z:p.pos.z};
        const los = F.hasLOS(new (p.pos.constructor)(eye.x,eye.y,eye.z), F.chestOf(best));
        F.mouse.down = bd < 45 && los;
        F.player.wantFire = F.mouse.down;
      } else { F.mouse.down=false; }
      __ev('KeyW', true);
      if(Math.random()<0.15){ __ev('KeyA',true); setTimeout(()=>__ev('KeyA',false),300); }
      if(Math.random()<0.08){ __ev('Space',true); setTimeout(()=>__ev('Space',false),120); }
      if(Math.random()<0.05){ __ev('KeyG',true); setTimeout(()=>__ev('KeyG',false),40); }
      if(Math.random()<0.05){ __ev('KeyF',true); setTimeout(()=>__ev('KeyF',false),40); }
      if(Math.random()<0.03){ __ev('Digit2',true); setTimeout(()=>__ev('Digit2',false),40); }
      if(Math.random()<0.03){ __ev('Digit1',true); setTimeout(()=>__ev('Digit1',false),40); }
      // fire killstreaks whenever ready
      for(const k of ['Digit4','Digit6']){ if(Math.random()<0.5){ __ev(k,true); setTimeout(()=>__ev(k,false),40);} }
      if(Math.random()<0.3){ __ev('Digit5',true); setTimeout(()=>__ev('Digit5',false),40); }
      F.mouse.rdown = Math.random()<0.35;
    }, 90);
  });

  const rounds = shots ? 4 : 16;
  for (let i=0;i<rounds;i++){
    await page.waitForTimeout(3000);
    const s = await page.evaluate(() => {
      const F = window.__FIRESTORM;
      const bots = F.actors.filter(a=>!a.isPlayer);
      return { gt:Math.round(600-F.state.time), score:F.state.score.join('-'),
               alive:F.actors.filter(a=>a.alive).length,
               oob:F.actors.filter(a=>a.alive&&(isNaN(a.pos.x)||Math.abs(a.pos.x)>120||Math.abs(a.pos.z)>120)).length,
               k:F.player.kills, d:F.player.deaths, hp:Math.round(F.player.hp),
               botK:bots.reduce((n,b)=>n+b.kills,0), botD:bots.reduce((n,b)=>n+b.deaths,0),
               lvl:F.profile.level, xp:F.profile.xp, sentries:F.sentries.length, nades:F.grenades.length,
               feed:document.querySelectorAll('#feed .fe').length, phase:F.state.phase };
    });
    console.log('sample '+(i+1), JSON.stringify(s));
    if(s.phase!=='play') break;
  }
  if (shots) {
    await page.screenshot({ path: shot('shot_play.png') });
    await page.evaluate(()=>{ document.dispatchEvent(new KeyboardEvent('keydown',{code:'Tab'})); });
    await page.waitForTimeout(400);
    await page.screenshot({ path: shot('shot_board.png') });
    await page.evaluate(()=>{ document.dispatchEvent(new KeyboardEvent('keyup',{code:'Tab'})); });
  }

  // end-of-match path
  await page.evaluate(()=>{ clearInterval(window.__sim); window.__FIRESTORM.mouse.down=false;
    window.__FIRESTORM.state.score[0] = window.__FIRESTORM.settings.scoreLimit-1; });
  await page.waitForTimeout(500);
  await page.evaluate(()=>{ window.__FIRESTORM.state.time = 0.2; });
  await page.waitForTimeout(4000);
  const after = await page.evaluate(()=>({ phase:window.__FIRESTORM.state.phase,
    results: !document.getElementById('results').classList.contains('hide'),
    title: document.getElementById('resTitle').textContent }));
  console.log('after end:', JSON.stringify(after));
  if (shots) await page.screenshot({ path: shot('shot_results.png') });

  console.log('--- errors ('+errors.length+') ---');
  errors.slice(0,20).forEach(e=>console.log(e));
  await browser.close();
  process.exit(errors.length?2:0);
})();
