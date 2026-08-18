// Drives the game with real, trusted browser input and asserts every control
// works. Run with --nolock to stub requestPointerLock into failing, which is what
// embedded viewers and sandboxed iframes do: the game must stay fully playable.
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
  const page = await browser.newPage({ viewport:{width:900,height:600} });
  const NOLOCK = process.argv.includes('--nolock');
  if(NOLOCK){
    // simulate an embedded viewer that refuses to capture the cursor
    await page.addInitScript(() => {
      Element.prototype.requestPointerLock = function(){
        setTimeout(()=>document.dispatchEvent(new Event('pointerlockerror')), 0);
        return undefined;
      };
    });
  }
  const errors=[];
  page.on('pageerror', e=>errors.push('PAGEERROR: '+(e.stack||e.message)));
  page.on('console', m=>{ if(m.type()==='error') errors.push(m.text()); });
  await page.goto(TEST_URL);
  await page.waitForTimeout(1800);

  const R = {};
  // --- start the match the way a player does: click DEPLOY
  await page.click('#deploy');
  await page.waitForTimeout(900);
  R.phaseAfterDeploy = await page.evaluate(()=>window.__FIRESTORM.state.phase);
  R.pointerLocked = await page.evaluate(()=>!!(document.pointerLockElement));
  R.lockHintVisible = await page.evaluate(()=>{
    const h=document.getElementById('lockhint');
    return h ? !h.classList.contains('hide') : 'missing';
  });

  // keep the tester alive and out of a wall so control checks aren't confounded
  await page.evaluate(()=>{
    const F=window.__FIRESTORM;
    F.settings.quality=0; F.settings.scale=0.4;   // software renderer: keep the sim near real time
    window.__god = setInterval(()=>{
      F.player.hp = F.player.maxHp = 1e6;
      if(!F.player.alive){ F.player.respawnT = 0.01; }
    }, 50);
  });
  // The software renderer in CI is slow, so poll for a condition instead of
  // sleeping a fixed amount and hoping the simulation got there.
  const waitFor = async (fn, ms = 8000, step = 150) => {
    const end = Date.now() + ms;
    for (;;) {
      const v = await fn();
      if (v) return v;
      if (Date.now() > end) return false;
      await page.waitForTimeout(step);
    }
  };
  const clearAction = () => page.evaluate(()=>{
    const p = window.__FIRESTORM.player;
    p.actionT = 0; p.fireT = 0; p.reloading = false;
  });
  const snap = () => page.evaluate(()=>{
    const F=window.__FIRESTORM, p=F.player;
    return { yaw:+p.yaw.toFixed(4), pitch:+p.pitch.toFixed(4), mag:p.ammo[p.weapon].mag,
             ads:+p.adsAmt.toFixed(2), reloading:p.reloading, alive:p.alive, phase:F.state.phase,
             weapon:p.weapon, nades:p.grenades };
  });

  // --- 1. mouse look with NO pointer lock (real moves)
  let a = await snap();
  await page.mouse.move(450,300);
  await page.waitForTimeout(60);
  for(let i=0;i<8;i++){ await page.mouse.move(450+i*22, 300); await page.waitForTimeout(25); }
  let b = await snap();
  R.lookYawChanged = Math.abs(b.yaw-a.yaw) > 0.02 ? 'YES ('+(b.yaw-a.yaw).toFixed(3)+' rad)' : 'NO';

  await page.mouse.move(450,300); await page.waitForTimeout(50);
  a = await snap();
  for(let i=0;i<8;i++){ await page.mouse.move(450, 300+i*18); await page.waitForTimeout(25); }
  b = await snap();
  R.lookPitchChanged = Math.abs(b.pitch-a.pitch) > 0.02 ? 'YES ('+(b.pitch-a.pitch).toFixed(3)+' rad)' : 'NO';

  // --- 2. edge steering keeps turning when the cursor is pinned at the edge
  await page.mouse.move(890, 300);
  a = await snap();
  await page.waitForTimeout(1200);
  b = await snap();
  R.edgeSteering = Math.abs(b.yaw-a.yaw) > 0.05 ? 'YES ('+(b.yaw-a.yaw).toFixed(3)+' rad)' : 'NO';

  // --- 3. arrow keys look
  await page.mouse.move(450,300); await page.waitForTimeout(120);
  a = await snap();
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(1500); await page.keyboard.up('ArrowLeft');
  b = await snap();
  R.arrowKeyLook = Math.abs(b.yaw-a.yaw) > 0.05 ? 'YES ('+(b.yaw-a.yaw).toFixed(3)+' rad)' : 'NO';

  // --- 4. FIRE with a real left click, no pointer lock
  a = await snap();
  await page.mouse.move(450,300);
  await clearAction();
  await page.mouse.down({button:'left'});
  await page.waitForTimeout(1200);
  await page.mouse.up({button:'left'});
  b = await snap();
  R.firing = b.mag < a.mag ? 'YES ('+(a.mag-b.mag)+' rounds)' : 'NO (mag '+a.mag+'->'+b.mag+')';

  // --- 5. ADS with a real right click
  await clearAction();
  await page.mouse.down({button:'right'});
  const adsOk = await waitFor(async () => (await snap()).ads >= 0.9);
  b = await snap();
  await page.mouse.up({button:'right'});
  R.ads = adsOk ? 'YES (adsAmt '+b.ads+')' : 'NO (adsAmt '+b.ads+')';
  await page.waitForTimeout(400);

  // --- 6. reload on R
  await page.evaluate(()=>{ const F=window.__FIRESTORM; F.player.ammo[F.player.weapon].mag = 4; });
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(120);
  R.reload = (await snap()).reloading ? 'YES' : 'NO';
  R.reloadFinished = await waitFor(async () => (await page.evaluate(()=>{
    const F=window.__FIRESTORM; return F.player.ammo[F.player.weapon].mag;
  })) > 20, 12000) ? 'YES' : 'NO';

  // --- 7. movement, jump, crouch, weapon swap, grenade, melee
  await page.evaluate(()=>{ const p=window.__FIRESTORM.player; p.pos.set(0,0,0); p.yaw=0; p.vel.set(0,0,0); });
  await page.waitForTimeout(200);
  a = await page.evaluate(()=>({x:window.__FIRESTORM.player.pos.x, z:window.__FIRESTORM.player.pos.z}));
  await page.keyboard.down('KeyW');
  const dist = () => page.evaluate(([ax,az]) => {
    const p = window.__FIRESTORM.player;
    return Math.hypot(p.pos.x-ax, p.pos.z-az);
  }, [a.x, a.z]);
  const moved = await waitFor(async () => (await dist()) > 1.5);
  await page.keyboard.up('KeyW');
  R.movement = moved ? 'YES ('+(await dist()).toFixed(1)+'m)' : 'NO ('+(await dist()).toFixed(1)+'m)';

  await clearAction();
  a = await snap();
  await page.keyboard.press('Digit2'); await page.waitForTimeout(1500);
  b = await snap();
  R.weaponSwap = b.weapon !== a.weapon ? 'YES ('+a.weapon+' -> '+b.weapon+')' : 'NO';
  await clearAction();
  await page.keyboard.press('Digit1'); await page.waitForTimeout(1200);

  await clearAction();
  a = await snap();
  await page.keyboard.press('KeyG'); await page.waitForTimeout(1200);
  b = await snap();
  R.grenade = b.nades < a.nades ? 'YES' : 'NO';

  await page.waitForTimeout(700);
  R.melee = await page.evaluate(async ()=>{
    const F=window.__FIRESTORM; F.player.actionT=0;
    const before = F.player.actionT;
    document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyF'}));
    await new Promise(r=>setTimeout(r,60));
    return F.player.actionT > 0 ? 'YES' : 'NO';
  });

  // --- 8. Enter-to-fire fallback
  await page.waitForTimeout(1500);
  await clearAction();
  a = await snap();
  await page.keyboard.down('Enter'); await page.waitForTimeout(1200); await page.keyboard.up('Enter');
  b = await snap();
  R.enterFire = b.mag < a.mag ? 'YES' : 'NO';

  // --- 9. pause / resume does not deadlock the controls
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  R.pauseWorks = (await page.evaluate(()=>window.__FIRESTORM.state.phase)) === 'pause' ? 'YES':'NO';
  await page.click('#pResume'); await page.waitForTimeout(400);
  R.resumeWorks = (await page.evaluate(()=>window.__FIRESTORM.state.phase)) === 'play' ? 'YES':'NO';
  a = await snap();
  for(let i=0;i<6;i++){ await page.mouse.move(400+i*25, 300); await page.waitForTimeout(25); }
  b = await snap();
  R.lookAfterResume = Math.abs(b.yaw-a.yaw) > 0.02 ? 'YES' : 'NO';

  // --- 10. quality presets don't blow up
  R.quality = await page.evaluate(()=>{
    const out=[];
    for(const q of [0,1,2,3]){
      const sel=document.getElementById('sQual'); sel.value=String(q);
      sel.dispatchEvent(new Event('change'));
      out.push(q+':ok');
    }
    document.getElementById('sQual').value='2';
    document.getElementById('sQual').dispatchEvent(new Event('change'));
    return out.join(' ');
  });

  await page.screenshot({ path: NOLOCK ? shot('shot_v2_nolock.png') : shot('shot_v2_play.png') });
  console.log((NOLOCK?'=== POINTER LOCK DENIED ===':'=== POINTER LOCK AVAILABLE ===')+'\n'+JSON.stringify(R,null,1));

  // edgeSteering only applies when the cursor is NOT captured
  const skip = NOLOCK ? [] : ['edgeSteering'];
  const failures = Object.keys(R).filter(k =>
    !skip.includes(k) && typeof R[k] === 'string' && R[k].startsWith('NO'));
  if (errors.length) { console.log('console errors:', errors.length); errors.slice(0,10).forEach(e=>console.log(e)); }
  if (failures.length) console.log('FAILED checks: ' + failures.join(', '));
  else console.log('all control checks passed');

  await browser.close();
  process.exit(failures.length || errors.length ? 1 : 0);
})();
