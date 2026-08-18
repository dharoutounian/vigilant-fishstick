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
  const page = await browser.newPage({ viewport:{width:360,height:240} });
  const errors=[];
  page.on('pageerror', e=>errors.push('PAGEERROR: '+(e.stack||e.message)));
  page.on('console', m=>{ if(m.type()==='error') errors.push(m.text()); });
  await page.goto(TEST_URL);
  await page.waitForTimeout(1500);

  const out = await page.evaluate(async () => {
    const F = window.__FIRESTORM;
    const R = {};
    F.settings.shadows=false; F.settings.scale=0.35; F.settings.diff=1;
    F.startMatch();
    const frame = () => new Promise(r=>requestAnimationFrame(r));
    await new Promise(r=>setTimeout(r,400));
    const p = F.player;
    const bots = F.actors.filter(a=>!a.isPlayer);
    const enemy = bots.filter(b=>b.team!==p.team);
    const target = enemy[0], spare = enemy[1];

    // park everyone out of the way
    for(const b of bots){ b.alive=false; b.mesh.visible=false; b.respawnT=1e9; }

    // pin the target: called every frame so bot AI can't drift it
    let pin = null;
    function pinTarget(x,z){ pin = {x,z}; }
    const origUpdate = null;
    (function keepPinned(){
      requestAnimationFrame(keepPinned);
      if(!pin) return;
      target.pos.set(pin.x, 0, pin.z); target.vel.set(0,0,0);
      target.mesh.position.copy(target.pos);
      target.mesh.rotation.set(0,0,0);
      target.mesh.updateMatrixWorld(true);
      target.reactT = 1e9; target.fireT = 1e9; target.nadeCd = 1e9;
    })();

    async function rebuild(){
      // respawnBot() is the public path that refreshes the raycast list
      spare.alive=false; spare.respawnT=0.0001;
      await frame(); await frame();
      spare.alive=false; spare.mesh.visible=false; spare.respawnT=1e9;
      target.alive=true; target.mesh.visible=true;
      spare.respawnT=0.0001; await frame(); await frame();
      spare.alive=false; spare.mesh.visible=false; spare.respawnT=1e9;
    }

    async function volley(dist, ads, aimHead, weapon, shotsWanted){
      p.pos.set(0,0,0); p.vel.set(0,0,0); p.alive=true; p.hp=1e6; p.maxHp=1e6;
      p.yaw=0; p.pitch=0; p.reloading=false; p.actionT=0; p.fireT=0; p.shake=0;
      if(weapon){ p.slots.primary=weapon; p.weapon=weapon; p.ammo[weapon]={mag:F.WEAPONS[weapon].mag,reserve:600}; }
      pinTarget(0, -dist);
      target.alive=true; target.mesh.visible=true; target.hp=1e6; target.maxHp=1e6;
      await rebuild();
      target.hp=1e6;
      const aimY = aimHead ? 1.61 : 1.15;
      p.pitch = Math.atan2(aimY - (p.pos.y+p.height), dist);
      F.mouse.rdown = !!ads; p.adsAmt = ads?1:0;
      await frame(); await frame();
      const los = F.hasLOS(new (p.pos.constructor)(0,p.height,0), F.chestOf(target));
      const before = target.hp;
      let shots = 0;
      const N = shotsWanted||20;
      for(let i=0;i<N;i++){
        p.fireT=0; p.actionT=0; p.recoilPitch=0; p.recoilYaw=0; p.shake=0;
        p.adsAmt = ads?1:0; p.pitch = Math.atan2(aimY - (p.pos.y+p.height), dist);
        const w = F.WEAPONS[p.weapon];
        if(p.ammo[p.weapon].mag < 3) p.ammo[p.weapon].mag = w.mag;
        F.mouse.down = true; p.wantFire = true;
        const magBefore = p.ammo[p.weapon].mag;
        await frame();
        if(p.ammo[p.weapon].mag < magBefore) shots++;
      }
      F.mouse.down=false; F.mouse.rdown=false;
      const w = F.WEAPONS[p.weapon];
      const perShot = w.dmg * (w.pellets||1);
      const dmg = before - target.hp;
      return { los, shots, dmg:Math.round(dmg),
               pct: shots? +((dmg/perShot)/shots*100).toFixed(0) : 0 };
    }

    R.ads_10m = await volley(10, true);
    R.ads_20m = await volley(20, true);
    R.ads_28m = await volley(28, true);
    R.hip_8m  = await volley(8, false);
    R.hip_20m = await volley(20, false);
    R.head_14m= await volley(14, true, true);

    R.weapons = {};
    for(const id of ['m4','mp5','scar','r870','inter','m249','m9','deagle']){
      const v = await volley(id==='r870'?7:12, true, false, id, 12);
      R.weapons[id] = (v.dmg>0? 'OK':'NO DAMAGE') + ' ' + v.pct + '% · ' + v.shots + ' shots';
    }
    p.slots.primary='m4'; p.weapon='m4'; p.ammo.m4={mag:30,reserve:200}; p.maxHp=100; p.hp=100;

    // melee
    { pinTarget(0,-2.0); target.alive=true; target.mesh.visible=true; target.hp=100; target.maxHp=100;
      await rebuild(); target.hp=100;
      p.pos.set(0,0,0); p.yaw=0; p.pitch=0; p.actionT=0; await frame();
      document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyF'}));
      await frame(); await frame();
      R.melee = target.alive? ('FAILED hp='+Math.round(target.hp)) : 'KILL'; }

    // grenade
    { pinTarget(0,-6); target.alive=true; target.mesh.visible=true; target.hp=500; target.maxHp=500;
      await rebuild(); target.hp=500;
      p.pos.set(0,0,0); p.yaw=0; p.pitch=0.14; p.grenades=2; p.actionT=0;
      document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyG'}));
      const t0=performance.now(); while(performance.now()-t0<7000) await frame();
      R.grenade = target.hp<500 ? ('DAMAGE '+Math.round(500-target.hp)) : 'NO DAMAGE'; }

    // sentry kills an enemy
    { pin=null;
      p.pos.set(0,0,0); p.alive=true; p.streaksReady={uav:true,strike:true,sentry:true};
      document.dispatchEvent(new KeyboardEvent('keydown',{code:'Digit4'}));
      R.uav = F.state.uav[p.team]>0 ? 'ON':'FAILED';
      document.dispatchEvent(new KeyboardEvent('keydown',{code:'Digit6'}));
      await frame();
      R.sentryDeployed = F.sentries.length>0 ? 'YES':'NO';
      pinTarget(0,-9); target.alive=true; target.mesh.visible=true; target.hp=200; target.maxHp=200;
      await rebuild(); target.hp=200;
      const t1=performance.now(); while(performance.now()-t1<4000) await frame();
      R.sentryShoots = target.hp<200 || !target.alive ? 'HITS':'NO DAMAGE'; }

    // airstrike
    { pin=null; p.streaksReady.strike=true; p.pitch=-0.35; p.yaw=0; p.alive=true;
      document.dispatchEvent(new KeyboardEvent('keydown',{code:'Digit5'}));
      await frame(); await frame();
      F.mouse.down=true; p.wantFire=true; await frame(); F.mouse.down=false;
      const t2=performance.now(); while(performance.now()-t2<5000) await frame();
      R.airstrike = 'RAN'; }

    // free-for-all sanity: bots roam without getting stuck outside the map
    for(const b of bots){ b.respawnT=0.01; b.alive=false; b.mesh.visible=false; }
    let t3=performance.now(); while(performance.now()-t3<2000) await frame();
    const snap = bots.map(b=>({x:b.pos.x,z:b.pos.z}));
    t3=performance.now(); while(performance.now()-t3<5000) await frame();
    R.botsMoved = bots.filter((b,i)=>Math.hypot(b.pos.x-snap[i].x,b.pos.z-snap[i].z)>0.8).length+'/'+bots.length;
    R.outOfBounds = bots.filter(b=>b.alive&&(Math.abs(b.pos.x)>58||Math.abs(b.pos.z)>58)).length;
    R.insideWall = bots.filter(b=>{
      const cx=Math.floor(b.pos.x/3.5+16), cy=Math.floor(b.pos.z/3.5+16);
      return b.alive && (cx<0||cy<0||cx>31||cy>31);
    }).length;
    return R;
  });
  console.log(JSON.stringify(out,null,1));
  console.log('errors:', errors.length); errors.slice(0,10).forEach(e=>console.log(e));
  await browser.close();
})();
