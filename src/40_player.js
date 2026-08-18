/* ================================= PLAYER ================================= */
var keys = {}, mouse = { down:false, rdown:false };
var pointerLocked = false;

var player = {
  isPlayer:true, name:'YOU', team:TEAM.BLUE, alive:false,
  pos:new THREE.Vector3(), vel:new THREE.Vector3(),
  yaw:0, pitch:0, recoilPitch:0, recoilYaw:0, punch:0,
  height:EYE, onGround:true, crouch:false, sprint:false,
  hp:100, maxHp:100, lastHurt:0, regenT:0,
  weapon:'m4', slots:{primary:'m4', secondary:'m9'},
  ammo:{}, reloading:false, reloadT:0, actionT:0, fireT:0, burstShots:0,
  ads:false, adsAmt:0, wantFire:false,
  kills:0, deaths:0, streak:0, bestStreak:0, assists:0, headshots:0,
  grenades:2, nadeT:0,
  streaksReady:{}, streaksUsed:{},
  hitParts:[], op:OPERATORS.ghost,
  shake:0, xpThisMatch:0, damageDealt:0, killer:null, respawnT:0,
  // motion feel: bob phase, landing compression, strafe lean, jump forgiveness
  bobPhase:0, bobAmp:0, landDip:0, lean:0, coyoteT:0, jumpBufT:0, walkPhase:0
};
var actors = [player];

/* ------------------------------- input -----------------------------------
   The pointer lock is an OPTIONAL upgrade, never a requirement. If the page
   can't capture the cursor (embedded viewers and sandboxed iframes refuse it)
   the game stays fully playable: the mouse steers freely, the screen edges
   keep turning you, and the arrow keys work as a precise fallback.
   Nothing here is gated on the lock — firing, aiming and reloading always run.
-------------------------------------------------------------------------- */
var mousePos = { x:0, y:0, has:false };
var lockSupported = !!(document.body.requestPointerLock || document.body.mozRequestPointerLock ||
                       document.body.webkitRequestPointerLock);
var lockDenied = false;

function applyLook(dx, dy){
  if(!dx && !dy) return;
  var s = settings.sens*0.0022*(player.ads? settings.adsSens : 1);
  player.yaw   -= dx*s;
  player.pitch -= dy*s*(settings.invert?-1:1);
  player.pitch = clamp(player.pitch, -1.52, 1.52);
  vm.swayX = clamp(vm.swayX + dx*0.0009, -0.05, 0.05);
  vm.swayY = clamp(vm.swayY - dy*0.0009, -0.05, 0.05);
}

function requestLock(){
  if(!lockSupported || pointerLocked || lockDenied) return;
  var cv = renderer.domElement;
  try {
    var r = (cv.requestPointerLock||cv.mozRequestPointerLock||cv.webkitRequestPointerLock).call(cv);
    if(r && r.catch) r.catch(function(){ lockDenied = true; updateLockHint(); });
  } catch(e){ lockDenied = true; updateLockHint(); }
}
function updateLockHint(){
  var h = $('#lockhint'); if(!h) return;
  var show = state.phase==='play' && !pointerLocked;
  h.classList.toggle('hide', !show);
  h.innerHTML = lockDenied || !lockSupported
    ? 'FREE-AIM MODE &nbsp;·&nbsp; MOVE MOUSE TO LOOK &nbsp;·&nbsp; EDGES KEEP TURNING &nbsp;·&nbsp; ARROW KEYS TO AIM'
    : 'CLICK TO CAPTURE MOUSE';
}

function initInput(){
  document.addEventListener('keydown', function(e){
    var k = e.code;
    keys[k]=true;
    if(k==='Tab'){ e.preventDefault(); if(state.phase==='play') $('#board').classList.remove('hide'); }
    if(k==='Space' || k.indexOf('Arrow')===0) e.preventDefault();
    if(k==='Escape'){ if(state.phase==='play') togglePause(true); return; }
    if(state.phase!=='play' || !player.alive) return;
    if(k==='KeyR') startReload();
    if(k==='Digit1') switchWeapon(player.slots.primary);
    if(k==='Digit2') switchWeapon(player.slots.secondary);
    if(k==='KeyQ') switchWeapon(player.weapon===player.slots.primary?player.slots.secondary:player.slots.primary);
    if(k==='KeyG') throwGrenade();
    if(k==='KeyF') meleeAttack();
    if(k==='KeyE') mouse.rdown = !mouse.rdown;          // toggle-aim fallback
    if(k==='Digit4') useStreak('uav');
    if(k==='Digit5') useStreak('strike');
    if(k==='Digit6') useStreak('sentry');
    if(k==='Enter' || k==='NumpadEnter'){ mouse.down=true; player.wantFire=true; }
  });
  document.addEventListener('keyup', function(e){
    keys[e.code]=false;
    if(e.code==='Tab'){ e.preventDefault(); $('#board').classList.add('hide'); }
    if(e.code==='Enter'||e.code==='NumpadEnter') mouse.down=false;
  });
  window.addEventListener('blur', function(){ keys={}; mouse.down=false; mouse.rdown=false; });

  var cv = renderer.domElement;

  // fire / aim always register, lock or no lock
  function down(e){
    if(state.phase!=='play') return;
    if(!pointerLocked) requestLock();          // try to upgrade, but never block
    if(e.button===0){ mouse.down=true; player.wantFire=true; }
    if(e.button===2){ mouse.rdown=true; }
    e.preventDefault();
  }
  cv.addEventListener('mousedown', down);
  $('#hud').addEventListener('mousedown', down);
  document.addEventListener('mouseup', function(e){
    if(e.button===0) mouse.down=false;
    if(e.button===2) mouse.rdown=false;
  });
  document.addEventListener('contextmenu', function(e){ e.preventDefault(); });

  document.addEventListener('mousemove', function(e){
    if(state.phase!=='play') return;
    if(pointerLocked){
      applyLook(e.movementX||0, e.movementY||0);
    } else {
      // free-aim: raw cursor travel turns the view, no button needed
      if(mousePos.has) applyLook(e.clientX-mousePos.x, e.clientY-mousePos.y);
      mousePos.x = e.clientX; mousePos.y = e.clientY; mousePos.has = true;
    }
  });
  document.addEventListener('mouseleave', function(){ mousePos.has=false; });

  document.addEventListener('pointerlockchange', onLockChange);
  document.addEventListener('mozpointerlockchange', onLockChange);
  document.addEventListener('webkitpointerlockchange', onLockChange);
  function onLockChange(){
    var el2 = document.pointerLockElement||document.mozPointerLockElement||document.webkitPointerLockElement;
    pointerLocked = (el2===renderer.domElement);
    if(pointerLocked){ lockDenied=false; mousePos.has=false; }
    updateLockHint();
  }
  function onLockError(){ lockDenied = true; pointerLocked = false; updateLockHint(); }
  document.addEventListener('pointerlockerror', onLockError);
  document.addEventListener('mozpointerlockerror', onLockError);
  document.addEventListener('webkitpointerlockerror', onLockError);

  // wheel swaps weapons
  document.addEventListener('wheel', function(e){
    if(state.phase!=='play'||!player.alive) return;
    switchWeapon(player.weapon===player.slots.primary?player.slots.secondary:player.slots.primary);
  }, {passive:true});
}

/* screen-edge steering + arrow keys, so you can always keep turning */
function updateFallbackLook(dt){
  if(state.phase!=='play') return;
  var rate = 2.4*settings.sens*(player.ads? settings.adsSens+0.3 : 1);
  var ax = (keys['ArrowRight']?1:0) - (keys['ArrowLeft']?1:0);
  var ay = (keys['ArrowDown']?1:0) - (keys['ArrowUp']?1:0);
  if(ax) player.yaw -= ax*rate*dt;
  if(ay){
    player.pitch -= ay*rate*0.62*dt*(settings.invert?-1:1);
    player.pitch = clamp(player.pitch,-1.52,1.52);
  }
  if(pointerLocked || !mousePos.has) return;
  var w = window.innerWidth, h = window.innerHeight;
  var nx = (mousePos.x - w/2)/(w/2), ny = (mousePos.y - h/2)/(h/2);
  var dead = 0.68;
  if(Math.abs(nx)>dead){
    var sx = (Math.abs(nx)-dead)/(1-dead);
    player.yaw -= (nx<0?-1:1)*sx*sx*rate*1.35*dt;
  }
  if(Math.abs(ny)>dead){
    var sy = (Math.abs(ny)-dead)/(1-dead);
    player.pitch -= (ny<0?-1:1)*sy*sy*rate*0.7*dt*(settings.invert?-1:1);
    player.pitch = clamp(player.pitch,-1.52,1.52);
  }
}

/* ------------------------------ loadout ---------------------------------- */
function resetLoadout(){
  player.slots.primary = profile.primary;
  player.slots.secondary = profile.secondary;
  player.op = OPERATORS[profile.operator]||OPERATORS.ghost;
  player.maxHp = player.op.hp;
  player.ammo = {};
  [player.slots.primary, player.slots.secondary].forEach(function(id){
    var w = WEAPONS[id];
    player.ammo[id] = { mag: w.mag, reserve: Math.round(w.reserve*(profile.operator==='nomad'?1.5:1)) };
  });
  player.weapon = player.slots.primary;
  for(var k in vm.models) vm.group.remove(vm.models[k]);
  vm.models = {};
  setViewWeapon(player.weapon);
  tintPlayerBody();
  $('#opname').innerHTML = 'OPERATOR <b>'+player.op.name+'</b>';
}

function switchWeapon(id){
  if(id===player.weapon || player.actionT>0) return;
  player.reloading=false; player.reloadT=0;
  player.weapon=id; player.actionT=0.45; vm.reloadT=0;
  setViewWeapon(id);
  sfx('swap');
  updateAmmoHud();
}

function startReload(){
  var w = WEAPONS[player.weapon], a = player.ammo[player.weapon];
  if(!a || player.reloading || player.actionT>0) return;
  if(a.mag>=w.mag || a.reserve<=0) return;
  player.reloading=true;
  player.reloadT = w.reload*player.op.reloadMul;
  player.actionT = player.reloadT;
  sfx('magout');
  setTimeout(function(){ if(player.reloading) sfx('magin'); }, Math.max(60,player.reloadT*450));
  $('#reloadhint').classList.remove('on');
}
function finishReload(){
  var w = WEAPONS[player.weapon], a = player.ammo[player.weapon];
  var need = w.mag - a.mag;
  var take = Math.min(need, a.reserve);
  a.mag += take; a.reserve -= take;
  player.reloading=false;
  sfx('bolt');
  updateAmmoHud();
}

/* ------------------------------- firing ---------------------------------- */
function canFire(){
  var w = WEAPONS[player.weapon], a = player.ammo[player.weapon];
  return player.alive && !player.reloading && player.actionT<=0 && player.fireT<=0 && a && a.mag>0 && vm.sprintT<0.45;
}
function tryFire(dt){
  var w = WEAPONS[player.weapon];
  if(designating){
    if(player.wantFire){ player.wantFire=false; confirmStrike(); }
    return;
  }
  var wantsHold = mouse.down;
  var trigger = (w.mode==='auto') ? wantsHold : player.wantFire;
  player.wantFire = false;
  if(!trigger) return;
  var a = player.ammo[player.weapon];
  if(player.alive && a && a.mag<=0 && player.actionT<=0 && !player.reloading){
    if(w.mode!=='auto'||wantsHold){ sfx('empty'); player.fireT=0.25; startReload(); }
    return;
  }
  if(!canFire()) return;
  fireWeapon();
}
function fireWeapon(){
  var w = WEAPONS[player.weapon], a = player.ammo[player.weapon];
  a.mag--;
  player.fireT = 60/w.rpm;
  if(w.mode==='bolt') player.actionT = w.boltTime||0.9;
  if(w.mode==='pump') player.actionT = 0.62;

  var origin = camera.position.clone();
  var dir = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  var spreadDeg = lerp(w.hipSpread, w.adsSpread, player.adsAmt);
  spreadDeg *= (1 + (player.vel.length()>2?0.32:0) + (player.onGround?0:0.9));
  if(player.crouch) spreadDeg *= 0.72;

  var pellets = w.pellets||1;
  var anyHit=false, anyHead=false, killed=false;
  for(var i=0;i<pellets;i++){
    var d = spreadDir(dir, spreadDeg).clone();
    var res = traceBullet(origin, d, player, w.dmg*player.op.dmgMul, w.range, 0xffe0a0);
    if(res.hit){ anyHit=true; if(res.head) anyHead=true; if(res.actor && !res.actor.alive) killed=true; }
  }
  if(anyHit) showHitmarker(killed, anyHead);

  // recoil
  var rc = w.recoil;
  var mul = (player.ads?0.72:1) * (player.crouch?0.82:1);
  player.recoilPitch += rc[0]*0.016*mul*rnd(0.85,1.15);
  player.recoilYaw   += rc[1]*0.016*mul*rnd(-1,1);
  vm.kick = Math.min(1.6, vm.kick + 0.55*mul);
  vm.kickRot = Math.min(1.2, vm.kickRot + rc[0]*0.28*mul);
  player.shake = Math.min(0.9, player.shake + 0.1*mul);
  flashMuzzle();
  shotAt(null, w.sound, true);
  spawnPuff(camera.position.clone().addScaledVector(dir,0.9), 0.5, 0x8a8378, 0.28);
  updateAmmoHud();
  if(a.mag===0) $('#reloadhint').classList.add('on');
}

function meleeAttack(){
  if(player.actionT>0 || vm.meleeT>0) return;
  vm.meleeT = 1; player.actionT = 0.55; sfx('melee');
  var origin = camera.position.clone();
  var dir = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  shootRay.set(origin, dir); shootRay.far = 2.6;
  var hits = shootRay.intersectObjects(shootables,false);
  for(var i=0;i<hits.length;i++){
    var ud = hits[i].object.userData;
    if(ud && ud.actor && ud.actor!==player){
      if(ud.actor.team===player.team) return;
      applyDamage(ud.actor, 200, player, false, 'knife');
      spawnSparks(hits[i].point, 8, dir, true);
      showHitmarker(true,false);
      return;
    }
    if(!ud || !ud.actor) return;
  }
}

/* ------------------------------ grenades --------------------------------- */
var grenades = [];
var nadeGeo = new THREE.SphereGeometry(0.12,10,8);
var nadeMat = new THREE.MeshLambertMaterial({color:0x39452f});
function throwGrenade(){
  if(player.grenades<=0 || player.actionT>0) return;
  player.grenades--; player.actionT=0.55; vm.meleeT=0.85;
  sfx('pin');
  var dir = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  var m = new THREE.Mesh(nadeGeo, nadeMat); m.castShadow=true;
  m.position.copy(camera.position).addScaledVector(dir,0.6);
  scene.add(m);
  grenades.push({ mesh:m, v:dir.clone().multiplyScalar(21).add(new THREE.Vector3(0,4.4,0)), t:2.6, owner:player });
  updateAmmoHud();
}
function botGrenade(bot, target){
  var m = new THREE.Mesh(nadeGeo, nadeMat); m.castShadow=true;
  var from = bot.pos.clone(); from.y += 1.3;
  m.position.copy(from);
  var to = target.clone();
  var d = to.clone().sub(from); var dist = Math.sqrt(d.x*d.x+d.z*d.z);
  d.y = 0; d.normalize();
  var speed = clamp(dist*1.35, 8, 24);
  scene.add(m);
  grenades.push({ mesh:m, v:d.multiplyScalar(speed).add(new THREE.Vector3(0,dist*0.30+2.5,0)), t:2.4, owner:bot });
  sfx('pin');
}
function updateGrenades(dt){
  for(var i=grenades.length-1;i>=0;i--){
    var g = grenades[i];
    g.t -= dt;
    g.v.y -= GRAV*dt;
    var p = g.mesh.position;
    var prevY = p.y;
    p.addScaledVector(g.v, dt);
    // floor / crate tops
    var gh = groundAt(p.x,p.z);
    if(p.y < gh+0.12){
      p.y = gh+0.12;
      if(Math.abs(g.v.y)>1.2){ g.v.y = -g.v.y*0.34; noise(0.05,0.09,'bandpass',600,3,0,0.05); }
      else g.v.y = 0;
      g.v.x*=0.7; g.v.z*=0.7;
    }
    // walls
    var before = TMP.copy(p);
    collide(p, 0.14);
    if(p.distanceToSquared(before)>0.0001){ g.v.x*=-0.42; g.v.z*=-0.42; }
    g.mesh.rotation.x += dt*8; g.mesh.rotation.z += dt*5;
    if(g.t<=0){
      explode(p.clone(), 7.2, 165, g.owner);
      scene.remove(g.mesh); grenades.splice(i,1);
    }
  }
}
function explode(pos, radius, dmg, owner){
  boomAt(pos, 1);
  spawnPuff(pos, radius*0.85, 0xffaa44, 0.42);
  spawnPuff(pos.clone().setY(pos.y+0.6), radius*0.9, 0x6b6257, 1.1);
  spawnRing(pos, radius, 0xffbb66);
  spawnSparks(pos, 22, null);
  var L = new THREE.PointLight(0xffa040, 8, radius*3.4, 2); L.position.copy(pos); scene.add(L);
  setTimeout(function(){ scene.remove(L); }, 130);
  for(var i=0;i<actors.length;i++){
    var a = actors[i]; if(!a.alive) continue;
    var c = a.pos.clone(); c.y += 0.9;
    var d = c.distanceTo(pos);
    if(d>radius) continue;
    if(!hasLOS(pos.clone().setY(pos.y+0.25), c)) continue;
    var f = Math.pow(1 - d/radius, 1.25);
    applyDamage(a, dmg*f, owner||player, false, 'frag');
  }
  for(var s=0;s<sentries.length;s++){
    var st=sentries[s]; if(!st.alive) continue;
    if(st.pos.distanceTo(pos)<radius) damageSentry(st, dmg*0.6);
  }
  if(pos.distanceTo(camera.position) < radius*2.2){
    player.shake = Math.min(2.2, player.shake + 1.8*(1-clamp(pos.distanceTo(camera.position)/(radius*2.2),0,1)));
    flashScreen(0.35*(1-clamp(pos.distanceTo(camera.position)/(radius*2.4),0,1)));
  }
}

/* ------------------------------ movement --------------------------------- */
function updatePlayer(dt){
  var w = WEAPONS[player.weapon];

  // timers
  if(player.fireT>0) player.fireT-=dt;
  if(player.actionT>0){
    player.actionT-=dt;
    if(player.reloading){ vm.reloadT = 1 - clamp(player.actionT/(w.reload*player.op.reloadMul),0,1); }
    if(player.actionT<=0 && player.reloading) finishReload();
  } else { vm.reloadT=0; }

  updateFallbackLook(dt);

  if(!player.alive){
    player.respawnT -= dt;
    $('#respawn').textContent = Math.max(1,Math.ceil(player.respawnT));
    if(player.respawnT<=0) respawnPlayer();
    // spectate: slow orbit look
    player.yaw += dt*0.12;
    applyCamera(dt);
    return;
  }

  // wish direction
  var fx2=0, fz=0;
  if(keys['KeyW']) fz+=1;
  if(keys['KeyS']) fz-=1;
  if(keys['KeyA']) fx2-=1;
  if(keys['KeyD']) fx2+=1;
  var moving = (fx2||fz);
  player.crouch = !!(keys['ControlLeft']||keys['ControlRight']||keys['KeyC']);
  player.sprint = !!(keys['ShiftLeft']||keys['ShiftRight']) && fz>0 && !player.crouch && !player.ads && !player.reloading;

  // ads
  var wantAds = mouse.rdown && !player.sprint && player.actionT<=0.02;
  player.ads = wantAds;
  var adsSpeed = 1/(w.adsTime*player.op.adsMul);
  player.adsAmt = clamp(player.adsAmt + (player.ads?1:-1)*dt*adsSpeed, 0, 1);

  var base = 5.6*player.op.speed;
  var speed = base;
  if(player.sprint) speed = base*1.5;
  else if(player.crouch) speed = base*0.52;
  else if(player.adsAmt>0.2) speed = base*lerp(1,0.55,player.adsAmt);
  speed *= w.moveMul;
  if(player.reloading) speed*=0.94;

  var yaw = player.yaw;
  var wish = TMP.set(
    Math.sin(yaw)*-fz + Math.cos(yaw)*fx2,
    0,
    Math.cos(yaw)*-fz - Math.sin(yaw)*fx2
  );
  if(wish.lengthSq()>0) wish.normalize();

  /* Separate accelerate and brake rates: you reach top speed quickly but stop
     even quicker, which is what makes strafing feel sharp instead of skated.
     In the air the rate stays low, so a jump commits you to your arc but still
     allows a little steering. */
  var accel = player.onGround ? (moving? 21 : 27) : 3.4;
  player.vel.x = damp(player.vel.x, wish.x*speed, accel, dt);
  player.vel.z = damp(player.vel.z, wish.z*speed, accel, dt);

  /* Jump forgiveness — coyote time lets you jump just after walking off an
     edge, and a buffered press fires the moment you land instead of being
     swallowed. Both are invisible when you get the timing right and rescue the
     jump when you don't. */
  player.coyoteT = player.onGround ? 0.12 : Math.max(0, player.coyoteT-dt);
  player.jumpBufT = keys['Space'] ? 0.15 : Math.max(0, player.jumpBufT-dt);
  if(player.jumpBufT>0 && player.coyoteT>0){
    player.vel.y = 7.4; player.onGround=false;
    player.coyoteT = 0; player.jumpBufT = 0;
    noise(0.06,0.06,'lowpass',400,1,0,0.06);
  }
  player.vel.y -= GRAV*dt;

  player.pos.x += player.vel.x*dt;
  player.pos.z += player.vel.z*dt;
  player.pos.y += player.vel.y*dt;

  collide(player.pos, P_RAD);
  var gh = groundAt(player.pos.x, player.pos.z);
  var wasAir = !player.onGround;
  if(player.pos.y <= gh){
    if(wasAir && player.vel.y<-3){
      // compress the view on landing, hard drops harder
      player.landDip = Math.min(0.085, player.landDip + (-player.vel.y)*0.0055);
      if(player.vel.y<-9) noise(0.08,0.10,'lowpass',300,1,0,0.08);
    }
    player.pos.y = gh; player.vel.y=0; player.onGround=true;
  } else player.onGround = (player.pos.y<=gh+0.02);

  // head bob — amplitude reads straight off current speed, so it is exactly
  // zero at a standstill and never leaves a residue on the camera
  var hspd = Math.sqrt(player.vel.x*player.vel.x+player.vel.z*player.vel.z);
  if(player.onGround) vm.bob += dt*hspd*1.35;
  player.bobAmp = player.onGround ? clamp(hspd/(5.6*player.op.speed),0,1.35) : 0;
  player.bobPhase += dt*hspd*1.35;
  player.walkPhase = player.bobPhase;
  vm.sprintT = damp(vm.sprintT, player.sprint?1:0, 11, dt);

  // strafe lean — roll the view slightly into the direction you are sliding
  var leanT = -fx2*(player.ads?0.34:1)*0.022;
  player.lean = damp(player.lean, leanT, 7, dt);
  player.landDip = damp(player.landDip, 0, 9, dt);

  // height / crouch
  var targetH = player.crouch? EYE_CROUCH : EYE;
  player.height = damp(player.height, targetH, 14, dt);

  // camera must be current BEFORE we trace bullets, or shots follow the
  // previous frame's aim (very visible during fast flicks)
  applyCamera(dt);

  // firing
  tryFire(dt);

  /* Health regen. The rate is a fraction of the pool rather than a flat number,
     so a bigger operator does not mean a longer wait staring at a wall — every
     operator takes about the same time to top up. The delay is what makes a
     fight dangerous; the rate is only what makes the next one possible. */
  player.regenT += dt;
  if(player.regenT>3.2 && player.hp<player.maxHp){
    player.hp = Math.min(player.maxHp, player.hp + player.maxHp*0.30*dt);
    updateHealthHud();
  }
}

function applyCamera(dt){
  // recoil recovery
  var w = WEAPONS[player.weapon];
  player.recoilPitch = damp(player.recoilPitch, 0, w.recover, dt);
  player.recoilYaw   = damp(player.recoilYaw, 0, w.recover*0.85, dt);
  player.shake = damp(player.shake, 0, 6, dt);

  /* Bob, lean and the landing dip are camera-only. Roll happens about the view
     axis and the offsets are translations, so the forward vector — and with it
     every shot fired this frame — is exactly where the crosshair points. */
  var vb = player.alive ? settings.viewBob : 0;
  var bobUp = 0, bobSide = 0;
  if(vb>0){
    bobUp   = Math.abs(Math.cos(player.bobPhase))*0.019*player.bobAmp*vb;
    bobSide = Math.sin(player.bobPhase)*0.026*player.bobAmp*vb;
  }
  var yaw = player.yaw + player.recoilYaw;
  camera.position.set(player.pos.x, player.pos.y + player.height + bobUp - player.landDip, player.pos.z);
  camera.position.x += Math.cos(yaw)*bobSide;
  camera.position.z += -Math.sin(yaw)*bobSide;
  if(player.shake>0.01){
    camera.position.x += rnd(-1,1)*player.shake*0.055;
    camera.position.y += rnd(-1,1)*player.shake*0.055;
    camera.position.z += rnd(-1,1)*player.shake*0.055;
  }
  var pitch = player.pitch + player.recoilPitch;
  var roll = vb>0 ? player.lean + Math.sin(player.bobPhase)*0.006*player.bobAmp*vb : player.lean;
  camera.rotation.order = 'YXZ';
  camera.rotation.set(clamp(pitch,-1.54,1.54), yaw, roll);
  if(!player.alive && player.killer && player.killer.alive){
    // look toward killer while dead
    TMP.copy(player.killer.pos).setY(player.killer.pos.y+1.4).sub(camera.position);
    var ty = Math.atan2(-TMP.x,-TMP.z);
    var tp = Math.atan2(TMP.y, Math.sqrt(TMP.x*TMP.x+TMP.z*TMP.z));
    camera.rotation.set(tp, ty, 0);
  }
  // fov
  var w2 = WEAPONS[player.weapon];
  var targetFov = lerp(settings.fov, w2.adsFov, player.adsAmt);
  if(player.sprint) targetFov += 5*vm.sprintT;
  camera.fov = damp(camera.fov, targetFov, 14, dt);
  camera.updateProjectionMatrix();
  gunCam.fov = damp(gunCam.fov, lerp(VM_FOV_HIP, VM_FOV_ADS, player.adsAmt), 14, dt);
  gunCam.updateProjectionMatrix();
}

/* ------------------------------- spawning -------------------------------- */
function pickSpawn(team){
  var list = spawns[team];
  var best=null, bestScore=-1e9;
  for(var i=0;i<list.length;i++){
    var p = list[i];
    var score = rnd(0,3);
    for(var j=0;j<actors.length;j++){
      var a = actors[j]; if(!a.alive) continue;
      var d = a.pos.distanceTo(p);
      if(a.team!==team) score += Math.min(d,45)*0.9; else score += Math.min(d,20)*0.12;
    }
    if(score>bestScore){ bestScore=score; best=p; }
  }
  return (best||list[0]||new THREE.Vector3()).clone();
}
function respawnPlayer(){
  var p = pickSpawn(player.team);
  player.pos.copy(p); player.pos.y=0; player.vel.set(0,0,0);
  player.hp = player.maxHp; player.alive=true; player.streak=0;
  player.grenades=2; player.regenT=0; player.killer=null;
  player.yaw = Math.atan2(-(0-p.x), -(0-p.z)) + Math.PI; // face the middle
  player.pitch=0; player.recoilPitch=0; player.recoilYaw=0;
  player.reloading=false; player.actionT=0; player.adsAmt=0;
  // full mags on respawn
  for(var k in player.ammo){ player.ammo[k].mag = WEAPONS[k].mag; }
  switchWeapon(player.slots.primary); player.actionT=0;
  $('#dead').classList.add('hide');
  $('#vig').style.opacity=0;
  sfx('spawn');
  updateHealthHud(); updateAmmoHud(); rebuildShootables();
}
