/* ================================= WEAPONS ================================ */
/* part spec: [width,height,depth, x,y,z, colorKey]  (metres, gun-space)      */
var GCOL = { body:0x2b2f34, dark:0x17191c, rail:0x3a4046, mag:0x23262a, wood:0x5a4630,
             tan:0x8b7a5c, glass:0x4fd0ff, accent:0xff8a1f, steel:0x555b61 };

var WEAPONS = {
  m4: { name:'M4A1', cls:'ASSAULT RIFLE', slot:'primary', lvl:1,
    dmg:26, rpm:760, mag:30, reserve:240, reload:2.05, mode:'auto',
    hipSpread:1.75, adsSpread:0.22, recoil:[0.62,0.34], recover:9, adsTime:0.20, adsFov:52,
    range:[38,72], moveMul:1.0, sound:{boom:0.85,lp:1150,crack:520}, muzzle:[0,0.005,-0.55],
    parts:[[0.085,0.10,0.62, 0,0,-0.06,'body'],[0.05,0.05,0.44, 0,0.01,-0.48,'dark'],
           [0.075,0.055,0.12, 0,0.055,-0.20,'rail'],[0.07,0.20,0.12, 0,-0.13,-0.02,'mag'],
           [0.075,0.09,0.26, 0,-0.005,0.30,'body'],[0.06,0.055,0.10, 0,0.075,-0.02,'rail'],
           [0.05,0.10,0.06, 0.0,-0.09,0.10,'dark']],
    desc:'The benchmark. Controllable full-auto, honest damage, forgiving at every range.' },

  mp5: { name:'MP5-K', cls:'SMG', slot:'primary', lvl:1,
    dmg:20, rpm:920, mag:32, reserve:256, reload:1.85, mode:'auto',
    hipSpread:2.05, adsSpread:0.42, recoil:[0.42,0.42], recover:11, adsTime:0.155, adsFov:58,
    range:[20,44], moveMul:1.10, sound:{boom:0.68,lp:1500,crack:640}, muzzle:[0,0.005,-0.42],
    parts:[[0.08,0.10,0.46, 0,0,-0.02,'body'],[0.045,0.045,0.22, 0,0.012,-0.32,'dark'],
           [0.06,0.055,0.16, 0,0.055,-0.12,'rail'],[0.06,0.24,0.08, 0,-0.15,0.02,'mag'],
           [0.055,0.075,0.20, 0,0,0.26,'dark'],[0.05,0.09,0.06, 0,-0.085,0.12,'dark']],
    desc:'Fast, light, brutal indoors. Bleeds damage past medium range — close the gap.' },

  scar: { name:'SCAR-H', cls:'BATTLE RIFLE', slot:'primary', lvl:4,
    dmg:40, rpm:490, mag:20, reserve:160, reload:2.35, mode:'auto',
    hipSpread:2.00, adsSpread:0.20, recoil:[1.15,0.5], recover:7.5, adsTime:0.235, adsFov:48,
    range:[45,90], moveMul:0.95, sound:{boom:1.05,lp:900,crack:430}, muzzle:[0,0.005,-0.60],
    parts:[[0.09,0.11,0.66, 0,0,-0.08,'tan'],[0.052,0.052,0.46, 0,0.012,-0.52,'dark'],
           [0.08,0.05,0.30, 0,0.062,-0.20,'rail'],[0.07,0.22,0.11, 0,-0.14,-0.02,'mag'],
           [0.08,0.10,0.28, 0,0,0.32,'tan'],[0.055,0.10,0.06, 0,-0.09,0.10,'dark'],
           [0.05,0.05,0.12, 0,0.10,-0.16,'dark']],
    desc:'Three-shot kills at any range. Heavy climb — tap it or ride the recoil.' },

  r870: { name:'R-870', cls:'SHOTGUN', slot:'primary', lvl:3,
    dmg:15, pellets:9, rpm:78, mag:6, reserve:48, reload:2.9, mode:'pump',
    hipSpread:5.0, adsSpread:3.4, recoil:[2.0,0.7], recover:6, adsTime:0.24, adsFov:60,
    range:[9,22], moveMul:1.0, sound:{boom:1.35,lp:700,crack:340}, muzzle:[0,0.005,-0.62],
    parts:[[0.085,0.10,0.70, 0,0,-0.10,'body'],[0.055,0.055,0.56, 0,0.015,-0.44,'steel'],
           [0.06,0.06,0.30, 0,-0.06,-0.34,'wood'],[0.085,0.10,0.30, 0,-0.01,0.34,'wood'],
           [0.05,0.10,0.06, 0,-0.085,0.12,'wood']],
    desc:'One-shot inside a doorway, a rumour beyond it. Own the corners.' },

  inter: { name:'INTERVENTION', cls:'SNIPER', slot:'primary', lvl:6,
    dmg:115, rpm:46, mag:7, reserve:42, reload:3.0, mode:'bolt', boltTime:0.95,
    hipSpread:7.0, adsSpread:0.0, recoil:[2.6,0.5], recover:5, adsTime:0.36, adsFov:14,
    range:[120,200], moveMul:0.85, scope:true, sound:{boom:1.5,lp:800,crack:300}, muzzle:[0,0.005,-0.82],
    parts:[[0.075,0.10,0.92, 0,0,-0.12,'dark'],[0.05,0.05,0.78, 0,0.012,-0.66,'steel'],
           [0.07,0.07,0.34, 0,0.10,-0.16,'dark'],[0.055,0.055,0.05, 0,0.10,-0.34,'glass'],
           [0.09,0.12,0.34, 0,-0.02,0.38,'dark'],[0.05,0.10,0.06, 0,-0.085,0.14,'dark'],
           [0.05,0.16,0.10, 0,-0.11,-0.02,'mag']],
    desc:'Anything above the waist dies. Bolt-action — miss and you are a target.' },

  m249: { name:'M249 SAW', cls:'LMG', slot:'primary', lvl:8,
    dmg:25, rpm:700, mag:100, reserve:300, reload:5.6, mode:'auto',
    hipSpread:3.1, adsSpread:0.32, recoil:[0.7,0.6], recover:8, adsTime:0.34, adsFov:55,
    range:[42,80], moveMul:0.82, sound:{boom:1.15,lp:1000,crack:400}, muzzle:[0,0.005,-0.70],
    parts:[[0.10,0.12,0.78, 0,0,-0.10,'body'],[0.05,0.05,0.62, 0,0.02,-0.60,'steel'],
           [0.14,0.20,0.24, 0,-0.13,0.02,'mag'],[0.09,0.11,0.28, 0,-0.01,0.34,'body'],
           [0.06,0.10,0.06, 0,-0.09,0.14,'dark'],[0.07,0.05,0.22, 0,0.075,-0.20,'rail'],
           [0.035,0.16,0.035, 0,-0.12,-0.44,'dark']],
    desc:'A hundred rounds of area denial. Suppress a lane and hold it.' },

  m9: { name:'M9', cls:'PISTOL', slot:'secondary', lvl:1,
    dmg:26, rpm:430, mag:15, reserve:90, reload:1.5, mode:'semi',
    hipSpread:1.7, adsSpread:0.26, recoil:[0.85,0.45], recover:12, adsTime:0.14, adsFov:56,
    range:[24,48], moveMul:1.16, sound:{boom:0.62,lp:1500,crack:700}, muzzle:[0,0.005,-0.26],
    parts:[[0.05,0.075,0.30, 0,0,-0.04,'dark'],[0.035,0.035,0.10, 0,0.005,-0.22,'steel'],
           [0.045,0.16,0.06, 0,-0.11,0.04,'mag'],[0.04,0.03,0.06, 0,0.045,-0.14,'rail']],
    desc:'Sidearm. Faster than a reload when the mag runs dry.' },

  deagle: { name:'DEAGLE .50', cls:'PISTOL', slot:'secondary', lvl:2,
    dmg:62, rpm:250, mag:7, reserve:42, reload:1.8, mode:'semi',
    hipSpread:2.0, adsSpread:0.22, recoil:[2.2,0.8], recover:9, adsTime:0.17, adsFov:52,
    range:[26,52], moveMul:1.12, sound:{boom:1.1,lp:950,crack:520}, muzzle:[0,0.005,-0.30],
    parts:[[0.055,0.09,0.36, 0,0,-0.05,'steel'],[0.04,0.04,0.14, 0,0.008,-0.26,'dark'],
           [0.05,0.17,0.06, 0,-0.12,0.04,'dark'],[0.045,0.03,0.08, 0,0.052,-0.16,'accent']],
    desc:'Two rounds, centre mass, done. If your hand is steady.' },

  knife:{ name:'COMBAT KNIFE', cls:'MELEE', slot:'melee', lvl:1, dmg:150, rpm:120, mag:1, reserve:0,
    reload:0, mode:'melee', hipSpread:0, adsSpread:0, recoil:[0,0], recover:10, adsTime:0.1, adsFov:70,
    range:[2.4,2.4], moveMul:1.2, sound:{boom:0.3,lp:600,crack:300}, muzzle:[0,0,-0.3], parts:[] }
};
var PRIMARIES = ['m4','mp5','r870','scar','inter','m249'];
var SECONDARIES = ['m9','deagle'];

/* Health is the player's alone — bots are pinned to 100 HP in createBot, so
   these numbers never buff the enemy. Five rifles firing at one target kills a
   100 HP operator faster than you can break line of sight, which reads as
   dying without ever getting to play; the pool below is set so a caught-out
   push costs you most of a bar instead of the round. */
var OPERATORS = {
  ghost:  { name:'GHOST',  lvl:1,  hp:170, speed:1.00, reloadMul:1.00, adsMul:1.00, dmgMul:1.00, stealth:1.00,
            col:0x2f3a46, perk:'Balanced kit — no weakness, no crutch.' },
  reaper: { name:'REAPER', lvl:2,  hp:220, speed:0.94, reloadMul:1.00, adsMul:1.00, dmgMul:1.00, stealth:1.00,
            col:0x3d2f2f, perk:'+50 max health. Trades a step of speed for survivability.' },
  viper:  { name:'VIPER',  lvl:3,  hp:160, speed:1.14, reloadMul:1.00, adsMul:0.75, dmgMul:1.00, stealth:1.00,
            col:0x2b3a2c, perk:'+14% movement, 25% faster ADS. Wins the first shot.' },
  havoc:  { name:'HAVOC',  lvl:5,  hp:178, speed:0.98, reloadMul:1.25, adsMul:1.10, dmgMul:1.16, stealth:1.00,
            col:0x40332a, perk:'+16% weapon damage, slower reloads. Make the mag count.' },
  nomad:  { name:'NOMAD',  lvl:7,  hp:186, speed:1.04, reloadMul:0.62, adsMul:0.9,  dmgMul:1.00, stealth:1.00,
            col:0x2a3640, perk:'38% faster reloads, +50% reserve ammo. Never dry.' },
  spectre:{ name:'SPECTRE',lvl:10, hp:170, speed:1.10, reloadMul:0.85, adsMul:0.85, dmgMul:1.05, stealth:1.75,
            col:0x1d2126, perk:'Enemies take far longer to spot you. Slips lanes unseen.' }
};

/* ---------------------------- gun model builder -------------------------- */
var _boxGeo = new THREE.BoxGeometry(1,1,1);
var _gunMats = {};
function gunMat(k){
  if(!_gunMats[k]){
    var c = GCOL[k]||0x888888;
    _gunMats[k] = (k==='glass')
      ? new THREE.MeshBasicMaterial({color:c, transparent:true, opacity:0.8})
      : new THREE.MeshPhongMaterial({ color:c, shininess:(k==='steel'?52:26),
          specular:(k==='steel'?0x555555:0x1e2124) });
  }
  return _gunMats[k];
}
function buildGunModel(w, gloveCol){
  var g = new THREE.Group();
  for(var i=0;i<w.parts.length;i++){
    var p = w.parts[i];
    var m = new THREE.Mesh(_boxGeo, gunMat(p[6]));
    m.scale.set(p[0],p[1],p[2]); m.position.set(p[3],p[4],p[5]);
    g.add(m);
  }
  // hands — gloves on the weapon, forearms angling back toward the shoulder
  var gm = new THREE.MeshPhongMaterial({color: gloveCol||0x23282d, shininess:7, specular:0x121416});
  var cuff = new THREE.MeshPhongMaterial({color: 0x1d2219, shininess:6, specular:0x0a0b09});
  function hand(x,y,z,rz,rx){
    var h = new THREE.Group();
    var pm = new THREE.Mesh(_boxGeo, gm); pm.scale.set(0.068,0.086,0.118); h.add(pm);
    var th = new THREE.Mesh(_boxGeo, gm); th.scale.set(0.032,0.05,0.062);
    th.position.set(rz>0?0.03:-0.03, 0.052, -0.022); h.add(th);
    var cf = new THREE.Mesh(_boxGeo, cuff); cf.scale.set(0.079,0.089,0.055); cf.position.z=0.084; h.add(cf);
    var kn = new THREE.Mesh(_boxGeo, gm); kn.scale.set(0.07,0.03,0.06); kn.position.set(0,0.043,-0.03); h.add(kn);
    h.position.set(x,y,z); h.rotation.z=rz||0; h.rotation.x=rx||0;
    return h;
  }
  var fw = (w.parts.length? -0.24 : -0.09);
  if(w.slot!=='melee'){
    g.add(hand(-0.038,-0.078, fw, 0.26, -0.16));    // support hand on the handguard
    g.add(hand( 0.048,-0.104, 0.10, -0.18, -0.44)); // trigger hand at the grip
  }
  g.traverse(function(o){ o.frustumCulled=false; });
  return g;
}

/* ------------------------------ viewmodel state -------------------------- */
var vm = {
  group: new THREE.Group(),
  models: {},
  cur: null,
  basePos: new THREE.Vector3(0.185,-0.155,-0.62),
  adsPos:  new THREE.Vector3(0.0,-0.038,-0.50),
  pos: new THREE.Vector3(), rot: new THREE.Vector3(),
  swayX:0, swayY:0, bob:0, kick:0, kickRot:0, sprintT:0, reloadT:0, meleeT:0, drawT:0
};
var muzzleFlash, muzzleLight, scopeOverlay;

/* --------------------------- ads sight picture ---------------------------
   These weapons carry solid blocks for sights, not an aperture you can look
   through, so aiming down them used to park the receiver squarely over the
   crosshair — you lost the target at the exact moment you aimed at it.
   The sight picture is therefore "look over the top": at full ADS the gun is
   dropped until its highest corner sits just BELOW the centre of the screen.
   The drop is solved from the weapon's own parts list rather than hand-tuned,
   so every gun — and any gun added later — clears the crosshair by itself.
-------------------------------------------------------------------------- */
var VM_FOV_HIP = 70, VM_FOV_ADS = 64;   // gun-camera fov; ADS no longer zooms
var ADS_TOP_NDC = -0.055;               // where the top of the gun lands, in NDC
var _adsPos = {};
function adsPosFor(id){
  if(_adsPos[id]) return _adsPos[id];
  var w = WEAPONS[id], s = vm.group.scale.y || 0.5, z = vm.adsPos.z;
  var tanHalf = Math.tan(VM_FOV_ADS*Math.PI/360);
  var y = Infinity;
  for(var i=0;i<w.parts.length;i++){
    var p = w.parts[i];
    // the near-top corner of each box projects highest, so it sets the limit
    var zView = z + (p[5]+p[2]*0.5)*s;
    if(zView > -0.02) continue;                       // at or behind the eye
    var need = ADS_TOP_NDC*(-zView)*tanHalf - (p[4]+p[1]*0.5)*s;
    if(need < y) y = need;
  }
  if(!isFinite(y)) y = vm.adsPos.y;                   // melee has no parts
  _adsPos[id] = new THREE.Vector3(vm.adsPos.x, y, z);
  return _adsPos[id];
}

function initViewmodel(){
  vm.group.scale.setScalar(0.50);
  gunScene.add(vm.group);
  var mfMat = new THREE.MeshBasicMaterial({ color:0xffd08a, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide });
  muzzleFlash = new THREE.Mesh(new THREE.PlaneGeometry(0.30,0.30), mfMat);
  muzzleFlash.frustumCulled=false;
  vm.group.add(muzzleFlash);
  var mf2 = new THREE.Mesh(new THREE.ConeGeometry(0.055,0.22,6), mfMat.clone());
  mf2.rotation.x = -Math.PI/2; mf2.frustumCulled=false;
  muzzleFlash.userData.cone = mf2; vm.group.add(mf2);

  muzzleLight = new THREE.PointLight(0xffbb66, 0, 16, 2);
  scene.add(muzzleLight);

  // sniper scope overlay (DOM)
  scopeOverlay = el('div');
  scopeOverlay.style.cssText='position:fixed;inset:0;z-index:12;pointer-events:none;opacity:0;transition:opacity .09s;'+
    'background:radial-gradient(circle at 50% 50%, transparent 0, transparent 26vh, #000 26.4vh, #000 100%)';
  var sc = el('div');
  sc.style.cssText='position:absolute;left:50%;top:50%;width:52vh;height:52vh;transform:translate(-50%,-50%);'+
    'border-radius:50%;box-shadow:inset 0 0 60px rgba(0,0,0,.9)';
  sc.innerHTML='<svg viewBox="0 0 100 100" style="width:100%;height:100%">'+
    '<line x1="50" y1="0" x2="50" y2="42" stroke="#0d0f10" stroke-width="0.5"/>'+
    '<line x1="50" y1="58" x2="50" y2="100" stroke="#0d0f10" stroke-width="0.5"/>'+
    '<line x1="0" y1="50" x2="42" y2="50" stroke="#0d0f10" stroke-width="0.5"/>'+
    '<line x1="58" y1="50" x2="100" y2="50" stroke="#0d0f10" stroke-width="0.5"/>'+
    '<line x1="50" y1="44" x2="50" y2="56" stroke="#0d0f10" stroke-width="0.35"/>'+
    '<line x1="44" y1="50" x2="56" y2="50" stroke="#0d0f10" stroke-width="0.35"/>'+
    '<circle cx="50" cy="50" r="0.7" fill="#0d0f10"/></svg>';
  scopeOverlay.appendChild(sc);
  document.body.appendChild(scopeOverlay);
}

function setViewWeapon(id){
  var w = WEAPONS[id];
  if(!vm.models[id]){
    var op = OPERATORS[profile.operator]||OPERATORS.ghost;
    vm.models[id] = buildGunModel(w, op.col);
    vm.group.add(vm.models[id]);
  }
  for(var k in vm.models) vm.models[k].visible = (k===id);
  vm.cur = id;
  vm.drawT = 0.42;
}

function updateViewmodel(dt){
  var w = WEAPONS[player.weapon];
  var adsF = player.adsAmt;
  // target position
  var tp = TMP.copy(vm.basePos).lerp(adsPosFor(player.weapon), adsF);
  // sprint offset
  var sp = clamp(vm.sprintT,0,1);
  tp.x += 0.07*sp; tp.y -= 0.045*sp; tp.z += 0.03*sp;
  // reload dip
  if(vm.reloadT>0){
    var rp = 1 - Math.abs(vm.reloadT*2-1);
    tp.y -= 0.20*rp; tp.z += 0.05*rp;
  }
  if(vm.drawT>0){ tp.y -= 0.28*vm.drawT; }
  // recoil kick
  tp.z += vm.kick*0.09;
  tp.y += vm.kick*0.012;
  // sway
  tp.x += vm.swayX*(1-adsF*0.8);
  tp.y += vm.swayY*(1-adsF*0.8);
  // bob
  var bobAmt = (1-adsF*0.85);
  tp.x += Math.sin(vm.bob)*0.016*bobAmt;
  tp.y += Math.abs(Math.cos(vm.bob))*0.013*bobAmt - 0.006*bobAmt;

  vm.group.position.lerp(tp, 1-Math.exp(-24*dt));

  var tr = TMP2.set(
    -vm.kickRot*0.9 + vm.swayY*1.6 + (vm.reloadT>0? Math.sin(vm.reloadT*Math.PI)*0.5 : 0),
    -vm.swayX*2.0 + sp*0.55 + (vm.drawT>0? vm.drawT*0.8:0),
    sp*0.35 + Math.sin(vm.bob)*0.02*bobAmt + (vm.reloadT>0? Math.sin(vm.reloadT*Math.PI*2)*0.22:0)
  );
  if(vm.meleeT>0){
    var mt = 1-vm.meleeT;
    tr.x -= Math.sin(mt*Math.PI)*1.2; tr.y += Math.sin(mt*Math.PI)*0.7;
  }
  vm.group.rotation.x = damp(vm.group.rotation.x, tr.x, 22, dt);
  vm.group.rotation.y = damp(vm.group.rotation.y, tr.y, 22, dt);
  vm.group.rotation.z = damp(vm.group.rotation.z, tr.z, 22, dt);

  // decay
  vm.kick = damp(vm.kick, 0, 13, dt);
  vm.kickRot = damp(vm.kickRot, 0, 13, dt);
  vm.swayX = damp(vm.swayX, 0, 9, dt);
  vm.swayY = damp(vm.swayY, 0, 9, dt);
  if(vm.drawT>0) vm.drawT = Math.max(0, vm.drawT-dt*2.6);
  if(vm.meleeT>0) vm.meleeT = Math.max(0, vm.meleeT-dt*3.2);

  // muzzle position follows the current weapon
  if(muzzleFlash){
    var mz = w.muzzle;
    muzzleFlash.position.set(mz[0], mz[1], mz[2]-0.05);
    muzzleFlash.userData.cone.position.copy(muzzleFlash.position);
    muzzleFlash.material.opacity = damp(muzzleFlash.material.opacity, 0, 40, dt);
    muzzleFlash.userData.cone.material.opacity = muzzleFlash.material.opacity*0.9;
    muzzleFlash.rotation.z += dt*20;
    muzzleFlash.visible = muzzleFlash.material.opacity>0.02;
    muzzleFlash.userData.cone.visible = muzzleFlash.visible;
  }
  muzzleLight.intensity = damp(muzzleLight.intensity, 0, 26, dt);

  // hide the gun while dead
  vm.group.visible = player.alive;
  // scope
  var scoped = w.scope && adsF>0.72 && player.alive;
  scopeOverlay.style.opacity = scoped ? 1 : 0;
  if(vm.models[vm.cur]) vm.models[vm.cur].visible = !scoped;
  $('#xhair').style.opacity = scoped ? 0 : 1;
}

function flashMuzzle(){
  if(!muzzleFlash) return;
  muzzleFlash.material.opacity = 0.95;
  muzzleFlash.userData.cone.material.opacity = 0.9;
  muzzleFlash.rotation.z = Math.random()*6.28;
  muzzleFlash.scale.setScalar(rnd(0.75,1.35));
  muzzleLight.position.copy(camera.position);
  muzzleLight.intensity = 2.4;
}

/* ------------------------------- effects --------------------------------- */
var fx = { tracers:[], sparks:[], puffs:[], decals:[], rings:[] };
var tracerGeo = new THREE.CylinderGeometry(0.016,0.016,1,5);
tracerGeo.translate(0,0.5,0);
tracerGeo.rotateX(Math.PI/2);
var tracerMat = new THREE.MeshBasicMaterial({ color:0xffd58a, transparent:true, opacity:0.9, blending:THREE.AdditiveBlending, depthWrite:false });
var sparkGeo = new THREE.BoxGeometry(0.05,0.05,0.05);
var sparkMat = new THREE.MeshBasicMaterial({ color:0xffc070 });
var bloodMat = new THREE.MeshBasicMaterial({ color:0xb01010 });
var puffGeo = new THREE.SphereGeometry(1,8,6);

function spawnTracer(a,b,col){
  var m;
  for(var i=0;i<fx.tracers.length;i++) if(!fx.tracers[i].visible){ m=fx.tracers[i]; break; }
  if(!m){
    if(fx.tracers.length>44) return;
    m = new THREE.Mesh(tracerGeo, tracerMat.clone()); scene.add(m); fx.tracers.push(m);
  }
  m.visible=true; m.position.copy(a); m.lookAt(b);
  m.scale.set(1,1, a.distanceTo(b));
  m.material.opacity = 0.85; m.material.color.setHex(col||0xffd58a);
  m.userData.life = 0.055;
}
function spawnSparks(p, n, dirN, blood){
  for(var i=0;i<n;i++){
    var m;
    for(var j=0;j<fx.sparks.length;j++) if(!fx.sparks[j].visible){ m=fx.sparks[j]; break; }
    if(!m){
      if(fx.sparks.length>150) return;
      m = new THREE.Mesh(sparkGeo, blood?bloodMat:sparkMat); scene.add(m); fx.sparks.push(m);
    }
    m.material = blood?bloodMat:sparkMat;
    m.visible=true; m.position.copy(p);
    m.scale.setScalar(rnd(0.4,1.3));
    m.userData.v = new THREE.Vector3(rnd(-1,1),rnd(0.2,1.6),rnd(-1,1)).normalize()
      .multiplyScalar(rnd(2.5,7)).add(dirN? TMP2.copy(dirN).multiplyScalar(2.4):TMP2.set(0,0,0));
    m.userData.life = rnd(0.22,0.55);
  }
}
function spawnPuff(p, size, col, life){
  var m;
  for(var i=0;i<fx.puffs.length;i++) if(!fx.puffs[i].visible){ m=fx.puffs[i]; break; }
  if(!m){
    if(fx.puffs.length>40) return;
    m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({transparent:true, depthWrite:false}));
    scene.add(m); fx.puffs.push(m);
  }
  m.visible=true; m.position.copy(p); m.scale.setScalar(size*0.4);
  m.material.color.setHex(col===undefined?0xb0a89a:col);
  m.material.opacity = 0.55; m.material.blending = (col===0xffaa44)?THREE.AdditiveBlending:THREE.NormalBlending;
  m.userData.size=size; m.userData.life=life||0.5; m.userData.max=life||0.5;
}
function spawnRing(p, maxR, col){
  var m;
  for(var i=0;i<fx.rings.length;i++) if(!fx.rings[i].visible){ m=fx.rings[i]; break; }
  if(!m){
    if(fx.rings.length>10) return;
    m = new THREE.Mesh(new THREE.RingGeometry(0.8,1,26),
      new THREE.MeshBasicMaterial({transparent:true, side:THREE.DoubleSide, depthWrite:false, blending:THREE.AdditiveBlending}));
    m.rotation.x=-Math.PI/2; scene.add(m); fx.rings.push(m);
  }
  m.visible=true; m.position.copy(p); m.position.y+=0.1; m.scale.setScalar(0.4);
  m.material.color.setHex(col||0xffaa55); m.material.opacity=0.8;
  m.userData.max=maxR; m.userData.life=0.55; m.userData.t=0.55;
}
function bulletHole(point, normal){
  var m;
  if(fx.decals.length>=70){ m = fx.decals.shift(); scene.remove(m); }
  m = new THREE.Mesh(new THREE.CircleGeometry(rnd(0.045,0.075),7),
    new THREE.MeshBasicMaterial({color:0x14100c, transparent:true, opacity:0.85, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-4}));
  m.position.copy(point).addScaledVector(normal, 0.012);
  m.lookAt(TMP.copy(point).add(normal));
  scene.add(m); fx.decals.push(m);
}
function updateFx(dt){
  var i,m;
  for(i=0;i<fx.tracers.length;i++){ m=fx.tracers[i]; if(!m.visible) continue;
    m.userData.life-=dt; m.material.opacity = Math.max(0,m.userData.life/0.055)*0.85;
    if(m.userData.life<=0) m.visible=false; }
  for(i=0;i<fx.sparks.length;i++){ m=fx.sparks[i]; if(!m.visible) continue;
    m.userData.life-=dt; m.userData.v.y -= 20*dt;
    m.position.addScaledVector(m.userData.v, dt);
    m.scale.multiplyScalar(1-2.2*dt);
    if(m.userData.life<=0||m.position.y<0.01) m.visible=false; }
  for(i=0;i<fx.puffs.length;i++){ m=fx.puffs[i]; if(!m.visible) continue;
    m.userData.life-=dt;
    var t = 1-m.userData.life/m.userData.max;
    m.scale.setScalar(m.userData.size*(0.35+t*0.9));
    m.material.opacity = 0.5*(1-t);
    m.position.y += dt*0.55;
    if(m.userData.life<=0) m.visible=false; }
  for(i=0;i<fx.rings.length;i++){ m=fx.rings[i]; if(!m.visible) continue;
    m.userData.t-=dt; var tt=1-m.userData.t/m.userData.life;
    m.scale.setScalar(0.4+m.userData.max*tt);
    m.material.opacity = 0.8*(1-tt);
    if(m.userData.t<=0) m.visible=false; }
}

/* --------------------------- shooting / hitscan --------------------------- */
var shootRay = new THREE.Raycaster();
var shootables = [];
var _traceEnd = new THREE.Vector3();
function rebuildShootables(){
  shootables = collidables.slice();
  for(var i=0;i<actors.length;i++){
    if(!actors[i].alive || actors[i].isPlayer) continue;
    for(var j=0;j<actors[i].hitParts.length;j++) shootables.push(actors[i].hitParts[j]);
  }
  for(var s=0;s<sentries.length;s++) if(sentries[s].alive) shootables.push(sentries[s].hitBox);
}

// fire one bullet from origin along dir. shooter = actor. returns hit info
function traceBullet(origin, dir, shooter, dmg, range, tracerCol){
  shootRay.set(origin, dir); shootRay.far = 260;
  var hits = shootRay.intersectObjects(shootables, false);
  var end = _traceEnd.copy(origin).addScaledVector(dir, 120);
  for(var i=0;i<hits.length;i++){
    var h = hits[i];
    var ud = h.object.userData;
    if(ud && ud.actor){
      if(ud.actor===shooter) continue;                      // never self
      if(ud.actor.team===shooter.team) { end.copy(h.point); break; }  // friendly blocks the shot
      var mult = ud.part==='head'?2.6:(ud.part==='limb'?0.82:1.0);
      var dist = h.distance;
      var fall = 1;
      if(range){ fall = dist<=range[0]?1:(dist>=range[1]?0.55:lerp(1,0.55,(dist-range[0])/(range[1]-range[0]))); }
      var out = dmg*mult*fall;
      spawnSparks(h.point, ud.part==='head'?7:4, dir, true);
      applyDamage(ud.actor, out, shooter, ud.part==='head');
      end.copy(h.point);
      spawnTracer(origin, end, tracerCol); return { hit:true, actor:ud.actor, head:ud.part==='head' };
    }
    // world geometry
    end.copy(h.point);
    spawnSparks(h.point, 3, h.face? h.face.normal : dir);
    spawnPuff(h.point, 0.45, 0xa89f92, 0.35);
    if(h.face && h.object.name!=='ground') bulletHole(h.point, h.face.normal.clone().transformDirection(h.object.matrixWorld));
    spawnTracer(origin, end, tracerCol);
    return { hit:false, point:h.point.clone() };
  }
  spawnTracer(origin, end, tracerCol);
  return { hit:false };
}

// spread cone helper
var _sd = new THREE.Vector3();
function spreadDir(dir, degrees){
  if(degrees<=0.001) return _sd.copy(dir);
  var a = Math.random()*Math.PI*2;
  var r = Math.sqrt(Math.random())*degrees*Math.PI/180;
  var up = TMP.set(0,1,0);
  if(Math.abs(dir.y)>0.95) up.set(1,0,0);
  var right = new THREE.Vector3().crossVectors(dir, up).normalize();
  var realUp = new THREE.Vector3().crossVectors(right, dir).normalize();
  return _sd.copy(dir)
    .addScaledVector(right, Math.cos(a)*Math.tan(r))
    .addScaledVector(realUp, Math.sin(a)*Math.tan(r))
    .normalize();
}
