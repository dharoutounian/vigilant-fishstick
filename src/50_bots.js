/* ================================== BOTS ================================== */
var CALLSIGNS_BLUE = ['SOAP','PRICE','ROACH','GAZ','WOLF','DUST','ECHO-2','MAVERICK','TALON','HAWKEYE'];
var CALLSIGNS_RED  = ['VOLK','KRUZ','BORIS','SHTORM','VIKTOR','LEBED','ZUBOV','ORLOV','MIKHAIL','SOKOL'];
var BOT_LOADOUTS = ['m4','mp5','scar','m4','mp5','r870','m249','inter','m4','scar'];

var actorMat = {};
function amat(hex, shine){
  var key = hex+'_'+(shine||0);
  if(!actorMat[key]) actorMat[key] = new THREE.MeshPhongMaterial({
    color:hex, shininess: shine||9, specular:0x1a1c1e });
  return actorMat[key];
}

/* rounded limb stock — cylinders and spheres read far smoother than boxes.
   _limbGeo hangs from its origin so limbs can swing from a real joint.       */
var _cylGeo  = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
var _limbGeo = new THREE.CylinderGeometry(0.5, 0.44, 1, 12); _limbGeo.translate(0,-0.5,0);
var _sphGeo  = new THREE.SphereGeometry(0.5, 16, 12);

function buildSoldier(team, weaponId){
  var g = new THREE.Group();
  var uni = team===TEAM.BLUE ? 0x3d4c3b : 0x4c3b3b;
  var uni2= team===TEAM.BLUE ? 0x2d382f : 0x3a2b2b;
  var vest= team===TEAM.BLUE ? 0x28323c : 0x3c2828;
  var skin= 0x9c7b5e;
  var helm= team===TEAM.BLUE ? 0x2c3a48 : 0x452c2c;
  function piece(geo,w,h,d,x,y,z,mat,part){
    var m = new THREE.Mesh(geo, mat);
    m.scale.set(w,h,d); m.position.set(x,y,z);
    m.castShadow=true; m.receiveShadow=true;
    m.userData.part = part||'limb';
    g.add(m); return m;
  }
  var parts = { hit:[] };
  // legs swing from the hip (0.85), boots at the ankle
  parts.legL = piece(_limbGeo, 0.20,0.85,0.20, -0.115,0.85,0, amat(uni2),'limb');
  parts.legR = piece(_limbGeo, 0.20,0.85,0.20,  0.115,0.85,0, amat(uni2),'limb');
  parts.hips = piece(_cylGeo,  0.40,0.24,0.30, 0,0.88,0, amat(uni2),'body');
  // torso + plate carrier
  parts.torso = piece(_cylGeo, 0.44,0.58,0.31, 0,1.15,0, amat(uni),'body');
  parts.vest  = piece(_boxGeo, 0.45,0.40,0.35, 0,1.18,0, amat(vest,16),'body');
  parts.pouch = piece(_boxGeo, 0.30,0.12,0.13, 0,0.99,0.17, amat(uni2,14),'body');
  // shoulders + arms, arms swing from the shoulder (1.36)
  parts.shoL = piece(_sphGeo, 0.21,0.21,0.21, -0.255,1.36,0, amat(uni),'limb');
  parts.shoR = piece(_sphGeo, 0.21,0.21,0.21,  0.255,1.36,0, amat(uni),'limb');
  parts.armL = piece(_limbGeo, 0.145,0.50,0.145, -0.255,1.36,0, amat(uni),'limb');
  parts.armR = piece(_limbGeo, 0.145,0.50,0.145,  0.255,1.36,0, amat(uni),'limb');
  // head
  parts.neck = piece(_cylGeo, 0.135,0.10,0.135, 0,1.46,0, amat(skin,4),'head');
  parts.head = piece(_sphGeo, 0.235,0.28,0.255, 0,1.58,0.01, amat(skin,4),'head');
  parts.helm = piece(_sphGeo, 0.275,0.26,0.29, 0,1.62,-0.005, amat(helm,20),'head');
  // team light so you can ID a silhouette at range
  var tl = piece(_sphGeo, 0.075,0.075,0.075, 0,1.775,0,
    new THREE.MeshBasicMaterial({color:TEAM_COL[team]}),'head');
  tl.castShadow=false;
  parts.light = tl;
  // gun
  var gun = new THREE.Group();
  var wsp = WEAPONS[weaponId];
  for(var i=0;i<wsp.parts.length;i++){
    var p = wsp.parts[i];
    var m2 = new THREE.Mesh(_boxGeo, gunMat(p[6]));
    m2.scale.set(p[0],p[1],p[2]); m2.position.set(p[3],p[4],p[5]);
    m2.castShadow=true; gun.add(m2);
  }
  gun.position.set(0.20,1.21,-0.30); g.add(gun);
  parts.gun = gun;

  parts.hit = [parts.torso, parts.vest, parts.hips, parts.head, parts.helm, parts.neck,
               parts.legL, parts.legR, parts.armL, parts.armR, parts.shoL, parts.shoR];
  g.userData.parts = parts;
  return { group:g, parts:parts };
}

/* --------------------------- first-person body ---------------------------
   Your own legs and torso, drawn in the world scene so they take real light
   and cast a real shadow. Everything from the neck up is left off: the camera
   sits where the head would be, and the arms belong to the viewmodel, which
   renders over this on a cleared depth buffer. Nothing here is ever added to
   `shootables`, so your own body can never block or absorb your own bullets.
-------------------------------------------------------------------------- */
var pbody = null;
function buildPlayerBody(){
  var g = new THREE.Group();
  var uni = 0x3d4c3b, uni2 = 0x2d382f;
  var parts = {};
  function piece(geo,w,h,d,x,y,z,mat){
    var m = new THREE.Mesh(geo, mat);
    m.scale.set(w,h,d); m.position.set(x,y,z);
    m.castShadow=true; m.receiveShadow=true;
    g.add(m); return m;
  }
  /* This is not the soldier silhouette with the head sawn off. A full chest
     sits directly under the chin and, looked down at, becomes a wall that hides
     the legs behind it. So the chest is cut down and set back from the eye,
     and the shoulders are left to the viewmodel arms — what remains is what you
     would actually see of yourself: chest, hips, thighs, boots. */
  /* Waist-down, and deliberately so. A chest modelled up to the collarbone ends
     up 35 cm from the eye, where an 85-degree lens turns it into a featureless
     slab that fills the screen and hides the legs behind it. Cutting the body
     at the belt puts the nearest surface 60 cm away, which reads as a body
     instead of a wall and leaves the thighs and boots in clear view. The gap
     above the belt is exactly where the viewmodel's arms and weapon sit, so
     nothing looks missing.
     -z is forward, so the legs are set slightly ahead of the hips to keep them
     from being occluded when you look straight down. */
  parts.legL = piece(_limbGeo, 0.20,0.86,0.20, -0.115,0.86,-0.11, amat(uni2));
  parts.legR = piece(_limbGeo, 0.20,0.86,0.20,  0.115,0.86,-0.11, amat(uni2));
  parts.hips = piece(_cylGeo,  0.38,0.24,0.24, 0,0.90,0.08, amat(uni2));
  // own material instance — the operator tint must not leak onto the bots
  parts.vestMat = new THREE.MeshPhongMaterial({ color:0x28323c, shininess:16, specular:0x1a1c1e });
  parts.belt = piece(_boxGeo, 0.40,0.09,0.26, 0,1.00,0.08, parts.vestMat);
  parts.pouch= piece(_boxGeo, 0.20,0.09,0.10, 0,0.94,-0.20, amat(uni2,14));
  g.visible = false;
  scene.add(g);
  pbody = { group:g, parts:parts };
  tintPlayerBody();
}
function tintPlayerBody(){
  if(!pbody) return;
  var op = OPERATORS[profile.operator] || OPERATORS.ghost;
  pbody.parts.vestMat.color.setHex(op.col);
}
function updatePlayerBody(dt){
  if(!pbody) return;
  var show = settings.showBody && player.alive && state.phase==='play';
  pbody.group.visible = show;
  if(!show) return;
  var P = pbody.parts, g = pbody.group;
  g.position.set(player.pos.x, player.pos.y, player.pos.z);
  g.rotation.y = player.yaw;
  // The body compresses with the eye, crouch and landing dip alike, so the
  // camera keeps the same clearance over the shoulders however far it drops —
  // and the legs visibly absorb a landing instead of the view sinking through
  // a body that stayed rigid.
  g.scale.y = (player.height - player.landDip)/EYE;

  var sw = Math.sin(player.walkPhase)*clamp(player.bobAmp,0,1);
  P.legL.rotation.x = damp(P.legL.rotation.x,  sw*0.55, 18, dt);
  P.legR.rotation.x = damp(P.legR.rotation.x, -sw*0.55, 18, dt);
  // hips tip forward into a sprint and rock a little with each stride
  var hipTip = vm.sprintT*0.13 + Math.cos(player.walkPhase)*0.04*clamp(player.bobAmp,0,1);
  P.hips.rotation.x = damp(P.hips.rotation.x, hipTip, 12, dt);
  P.belt.rotation.x = P.hips.rotation.x;
}

var botIdSeq = 0;
function createBot(team, idx){
  var wid = BOT_LOADOUTS[(idx + (team?5:0)) % BOT_LOADOUTS.length];
  var built = buildSoldier(team, wid);
  var bot = {
    isPlayer:false, id:++botIdSeq,
    name: (team===TEAM.BLUE?CALLSIGNS_BLUE:CALLSIGNS_RED)[idx%10],
    team: team, weapon: wid, alive:false,
    pos:new THREE.Vector3(), vel:new THREE.Vector3(), yaw:0, aimPitch:0,
    hp:100, maxHp:100,
    mesh: built.group, parts: built.parts, hitParts: built.parts.hit,
    mag: WEAPONS[wid].mag, reloadT:0, fireT:0, burst:0, burstPause:0,
    target:null, seenT:0, reactT:0, losT:0, lastSeen:new THREE.Vector3(), hasLastSeen:false,
    path:null, pathI:0, repathT:0, strafe: Math.random()<0.5?1:-1, strafeT:0,
    kills:0, deaths:0, streak:0, bestStreak:0, respawnT:0, deathT:0, mmPing:0,
    nadeCd: rnd(8,26), walkPhase:0, wander:null, killer:null, hurtT:0
  };
  for(var i=0;i<bot.hitParts.length;i++) bot.hitParts[i].userData.actor = bot;
  bot.mesh.visible=false;
  scene.add(bot.mesh);
  actors.push(bot);
  return bot;
}

function respawnBot(b){
  var p = pickSpawn(b.team);
  b.pos.copy(p); b.pos.y=0; b.vel.set(0,0,0);
  b.hp = b.maxHp = 100; b.alive=true; b.streak=0;
  b.mag = WEAPONS[b.weapon].mag; b.reloadT=0; b.fireT=0.4;
  b.target=null; b.path=null; b.repathT=0; b.hasLastSeen=false;
  b.mesh.visible=true; b.mesh.rotation.set(0,0,0);
  b.mesh.position.copy(b.pos);
  b.deathT=0; b.nadeCd=rnd(10,30);
  rebuildShootables();
}

/* --------------------------------- AI ------------------------------------ */
var _v1=new THREE.Vector3(), _v2=new THREE.Vector3(), _v3=new THREE.Vector3();
function eyeOf(a){ return _v3.copy(a.pos).setY(a.pos.y + (a.isPlayer? a.height*0.94 : 1.5)); }
function chestOf(a){ return new THREE.Vector3(a.pos.x, a.pos.y + (a.isPlayer? a.height*0.7 : 1.14), a.pos.z); }

function updateBot(b, dt){
  if(!b.alive){
    b.deathT += dt;
    // death slump
    if(b.deathT<1.1){
      b.mesh.rotation.x = Math.min(Math.PI/2*0.92, b.mesh.rotation.x + dt*3.4);
      b.mesh.position.y = Math.max(0, b.mesh.position.y - dt*0.35);
    } else if(b.deathT>2.6){ b.mesh.visible=false; }
    b.respawnT -= dt;
    if(b.respawnT<=0 && state.phase==='play') respawnBot(b);
    return;
  }
  var D = DIFF[settings.diff];
  var W2 = WEAPONS[b.weapon];

  // ---- target acquisition
  b.seenT -= dt;
  if(b.seenT<=0){
    b.seenT = 0.14 + Math.random()*0.1;
    var best=null, bestD=1e9;
    for(var i=0;i<actors.length;i++){
      var a = actors[i];
      if(a===b || !a.alive || a.team===b.team) continue;
      var d = b.pos.distanceTo(a.pos);
      if(d>78) continue;
      // facing cone (wider when close)
      _v1.copy(a.pos).sub(b.pos).setY(0).normalize();
      var fwd = _v2.set(-Math.sin(b.yaw),0,-Math.cos(b.yaw));
      var dot = _v1.dot(fwd);
      if(d>7 && dot < 0.10) continue;
      if(!hasLOS(eyeOf(b).clone(), chestOf(a))) continue;
      var score = d * (a.isPlayer? 0.85/(a.op?a.op.stealth:1) : 1);
      if(score<bestD){ bestD=score; best=a; }
    }
    if(best){
      if(b.target!==best){
        b.reactT = rnd(D.react[0], D.react[1]) * (best.isPlayer? (best.op?best.op.stealth:1) : 1);
      }
      b.target = best; b.hasLastSeen=true; b.lastSeen.copy(best.pos);
      b.losT = 0.9;
    } else {
      b.losT = (b.losT||0) - 0.24;
      if(b.losT<=0) b.target=null;
    }
  }

  var tgt = b.target;
  var visible = !!tgt && tgt.alive;
  if(visible) b.reactT -= dt;

  // ---- reload
  if(b.reloadT>0){
    b.reloadT -= dt;
    if(b.reloadT<=0){ b.mag = W2.mag; }
  } else if(b.mag<=0){
    b.reloadT = W2.reload*rnd(0.9,1.15);
    if(b.pos.distanceTo(camera.position)<26) sfx('magin');
  }

  // ---- movement goal
  var goal=null, engaging=false;
  if(visible){
    var dist = b.pos.distanceTo(tgt.pos);
    var ideal = W2.range? (W2.pellets? 7 : clamp(W2.range[0]*0.55, 10, 30)) : 16;
    engaging = true;
    // strafe around the ideal distance
    b.strafeT -= dt;
    if(b.strafeT<=0){ b.strafeT = rnd(0.7,1.7); if(Math.random()<0.45) b.strafe*=-1; }
    _v1.copy(tgt.pos).sub(b.pos).setY(0).normalize();
    var side = _v2.set(-_v1.z,0,_v1.x).multiplyScalar(b.strafe);
    var toward = (dist > ideal*1.25) ? 1 : (dist < ideal*0.6 ? -1 : 0);
    goal = _v1.clone().multiplyScalar(toward*1.0).add(side.multiplyScalar(0.85));
    if(goal.lengthSq()<0.01) goal = side.clone();
    goal.normalize();
    b.path=null;
  } else if(b.hasLastSeen){
    goal = pathStep(b, b.lastSeen, dt);
    if(b.pos.distanceTo(b.lastSeen)<3.5){ b.hasLastSeen=false; b.wander=null; }
  } else {
    // hunt: head toward the nearest live enemy, or roam
    var near=null, nd=1e9;
    for(var k=0;k<actors.length;k++){
      var a2=actors[k]; if(!a2.alive||a2.team===b.team||a2===b) continue;
      var dd=b.pos.distanceTo(a2.pos); if(dd<nd){nd=dd;near=a2;}
    }
    var dest;
    if(near && Math.random()<D.aggro){ dest = near.pos; }
    else {
      if(!b.wander || b.pos.distanceTo(b.wander)<3.5){
        var c = pick(openCells); b.wander = cellCenter(c[0],c[1]);
      }
      dest = b.wander;
    }
    goal = pathStep(b, dest, dt);
  }

  // separation from teammates
  for(var s=0;s<actors.length;s++){
    var o=actors[s]; if(o===b||!o.alive||o.team!==b.team) continue;
    var dsq = b.pos.distanceToSquared(o.pos);
    if(dsq<2.4 && dsq>0.0001){
      _v1.copy(b.pos).sub(o.pos).setY(0).normalize().multiplyScalar(0.7);
      if(goal) goal.add(_v1).normalize(); else goal=_v1;
    }
  }

  // ---- apply movement
  var spd = 4.6*(engaging?1.0:1.16);
  if(b.reloadT>0) spd*=0.8;
  if(goal){
    b.vel.x = damp(b.vel.x, goal.x*spd, 12, dt);
    b.vel.z = damp(b.vel.z, goal.z*spd, 12, dt);
  } else { b.vel.x=damp(b.vel.x,0,12,dt); b.vel.z=damp(b.vel.z,0,12,dt); }
  b.vel.y -= GRAV*dt;
  b.pos.x += b.vel.x*dt; b.pos.z += b.vel.z*dt; b.pos.y += b.vel.y*dt;
  collide(b.pos, P_RAD);
  var gh2 = groundAt(b.pos.x,b.pos.z);
  if(b.pos.y<=gh2){ b.pos.y=gh2; b.vel.y=0; }

  // ---- aim
  var lookAt = null;
  if(visible) lookAt = chestOf(tgt);
  else if(b.hasLastSeen) lookAt = _v1.copy(b.lastSeen).setY(1.2);
  else if(goal) lookAt = _v1.copy(b.pos).add(goal).setY(b.pos.y+1.2);
  if(lookAt){
    var wantYaw = Math.atan2(-(lookAt.x-b.pos.x), -(lookAt.z-b.pos.z));
    var diff2 = ((wantYaw - b.yaw + Math.PI*3) % (Math.PI*2)) - Math.PI;
    var turn = (visible? 9 : 4.5)*dt;
    b.yaw += clamp(diff2, -turn, turn);
    var dxz = Math.sqrt(Math.pow(lookAt.x-b.pos.x,2)+Math.pow(lookAt.z-b.pos.z,2));
    var wantPitch = Math.atan2(lookAt.y-(b.pos.y+1.45), Math.max(0.2,dxz));
    b.aimPitch = damp(b.aimPitch, wantPitch, 9, dt);
  }

  // ---- shooting
  b.fireT -= dt;
  b.burstPause -= dt;
  if(visible && b.reactT<=0 && b.reloadT<=0 && b.mag>0 && b.fireT<=0 && b.burstPause<=0){
    var dist2 = b.pos.distanceTo(tgt.pos);
    var maxR = W2.pellets? 26 : (W2.range? W2.range[1]*0.9 : 60);
    var aimed = Math.abs(((Math.atan2(-(tgt.pos.x-b.pos.x), -(tgt.pos.z-b.pos.z)) - b.yaw + Math.PI*3)%(Math.PI*2))-Math.PI);
    if(dist2<maxR && aimed<0.30){
      botFire(b, tgt, dist2, D, W2);
    }
  }

  // ---- grenades
  b.nadeCd -= dt;
  if(b.nadeCd<=0){
    b.nadeCd = rnd(16,42);
    if(visible && b.pos.distanceTo(tgt.pos)>10 && b.pos.distanceTo(tgt.pos)<32 && Math.random()<0.5){
      botGrenade(b, chestOf(tgt));
    }
  }

  // ---- mesh transform + walk anim
  b.mesh.position.copy(b.pos);
  b.mesh.rotation.y = b.yaw;
  var hs = Math.sqrt(b.vel.x*b.vel.x+b.vel.z*b.vel.z);
  b.walkPhase += dt*hs*2.0;
  var gait = clamp(hs/4.6,0,1);
  var sw = Math.sin(b.walkPhase)*gait;
  var P = b.parts;
  // limbs swing from their joints — smoothed so it never snaps when speed changes
  P.legL.rotation.x = damp(P.legL.rotation.x,  sw*0.62, 18, dt);
  P.legR.rotation.x = damp(P.legR.rotation.x, -sw*0.62, 18, dt);
  P.armL.rotation.x = damp(P.armL.rotation.x, -sw*0.44 - 0.12, 16, dt);
  P.armR.rotation.x = damp(P.armR.rotation.x, -0.95 - b.aimPitch*0.55, 14, dt);
  P.armR.rotation.z = damp(P.armR.rotation.z, -0.18, 12, dt);
  var bobY = Math.abs(Math.cos(b.walkPhase))*0.028*gait;
  P.torso.position.y = 1.15 + bobY;
  P.vest.position.y  = 1.18 + bobY;
  P.hips.position.y  = 0.88 + bobY*0.6;
  P.head.position.y  = 1.58 + bobY;
  P.helm.position.y  = 1.62 + bobY;
  P.neck.position.y  = 1.46 + bobY;
  P.light.position.y = 1.775 + bobY;
  P.shoL.position.y = P.armL.position.y = 1.36 + bobY;
  P.shoR.position.y = P.armR.position.y = 1.36 + bobY;
  P.head.rotation.x = P.helm.rotation.x = -b.aimPitch*0.55;
  P.gun.rotation.x = -b.aimPitch;
  P.gun.position.y = 1.21 + bobY;
  if(b.hurtT>0){ b.hurtT-=dt; }
  if(b.mmPing>0) b.mmPing-=dt;
  // keep hit boxes in sync for raycasts made later this frame
  b.mesh.updateMatrixWorld(true);
}

function pathStep(b, dest, dt){
  b.repathT -= dt;
  var sc = worldToCell(b.pos), tc = worldToCell(dest);
  if(b.repathT<=0 || !b.path || b.pathI>=b.path.length){
    b.repathT = rnd(0.55,0.95);
    // straight shot? then no path needed
    if(hasLOS(_v1.copy(b.pos).setY(0.9), _v2.copy(dest).setY(0.9))){
      b.path=null;
      return _v1.copy(dest).sub(b.pos).setY(0).normalize().clone();
    }
    b.path = findPath(sc[0],sc[1],tc[0],tc[1]); b.pathI=0;
  }
  if(!b.path || !b.path.length){
    return _v1.copy(dest).sub(b.pos).setY(0).normalize().clone();
  }
  // advance along the path, skipping nodes we can already see past
  var look = Math.min(b.pathI+4, b.path.length-1);
  for(var i=look;i>b.pathI;i--){
    var c = b.path[i]; var p = cellCenter(c[0],c[1]);
    if(hasLOS(_v1.copy(b.pos).setY(0.9), p.setY(0.9))){ b.pathI=i; break; }
  }
  var node = b.path[Math.min(b.pathI, b.path.length-1)];
  var np = cellCenter(node[0],node[1]);
  if(b.pos.distanceTo(np) < CELL*0.62){ b.pathI++; if(b.pathI>=b.path.length){ b.path=null; } }
  return np.sub(b.pos).setY(0).normalize();
}

function botFire(b, tgt, dist, D, W2){
  b.mag--;
  b.fireT = 60/W2.rpm * (D.rof||1) * (W2.mode==='bolt'? 1.9 : (W2.mode==='pump'?1.25:1));
  b.burst++;
  var bmax = irnd(D.burst[0], D.burst[1]);
  if(b.burst>=bmax){ b.burst=0; b.burstPause = rnd(0.30,0.85); }

  b.mmPing = 1.7;
  var muzzle = new THREE.Vector3().copy(b.pos).setY(b.pos.y+1.25);
  _v1.set(-Math.sin(b.yaw),0,-Math.cos(b.yaw)).multiplyScalar(0.45);
  muzzle.add(_v1);

  // muzzle flash light for nearby shots
  if(dist<50 || b.pos.distanceTo(camera.position)<50){
    spawnPuff(muzzle.clone(), 0.34, 0xffcc88, 0.09);
  }
  shotAt(muzzle, W2.sound, false);

  var pellets = W2.pellets||1;
  for(var p=0;p<pellets;p++){
    // accuracy model
    var acc = D.acc;
    acc *= clamp(1.25 - dist/(W2.range?W2.range[1]:60), 0.25, 1.15);
    if(tgt.isPlayer){
      var mv = Math.sqrt(tgt.vel.x*tgt.vel.x+tgt.vel.z*tgt.vel.z);
      acc *= clamp(1.05 - mv*0.045, 0.5, 1.05);
      acc /= (tgt.op? tgt.op.stealth : 1)*0.6+0.4;
    }
    if(W2.pellets) acc *= 0.62;
    var hit = Math.random() < acc;
    var end;
    if(hit){
      end = chestOf(tgt);
      end.x += rnd(-0.18,0.18); end.z += rnd(-0.18,0.18); end.y += rnd(-0.35,0.32);
      var head = Math.random() < (0.08 + settings.diff*0.03);
      var dmg = W2.dmg*D.dmg*(head?2.4:1)*(W2.pellets?1:1);
      if(dist>(W2.range?W2.range[0]:40)) dmg*=0.72;
      applyDamage(tgt, dmg, b, head);
      spawnSparks(end, 4, null, true);
    } else {
      var dir = spreadDir(_v2.copy(chestOf(tgt)).sub(muzzle).normalize(), D.spread*rnd(0.6,2.4)).clone();
      shootRay.set(muzzle, dir); shootRay.far=90;
      var hits = shootRay.intersectObjects(shootables,false);
      if(hits.length){
        end = hits[0].point.clone();
        var ud = hits[0].object.userData;
        if(ud && ud.actor && ud.actor.team!==b.team && ud.actor!==b){
          applyDamage(ud.actor, W2.dmg*D.dmg*0.9, b, ud.part==='head');
          spawnSparks(end,3,dir,true);
        } else {
          spawnSparks(end, 2, hits[0].face?hits[0].face.normal:dir);
          spawnPuff(end, 0.3, 0xa89f92, 0.28);
        }
      } else end = muzzle.clone().addScaledVector(dir, 60);
      // near-miss whizz
      if(tgt.isPlayer){
        var closest = new THREE.Line3(muzzle, end).closestPointToPoint(camera.position, true, new THREE.Vector3());
        if(closest.distanceTo(camera.position) < 2.4) tone(rnd(1500,2600), rnd(400,900), 0.08, 0.06, 'sine');
      }
    }
    spawnTracer(muzzle, end, b.team===TEAM.BLUE?0x9fd0ff:0xffb0a0);
  }
}

/* ------------------------------- damage ---------------------------------- */
function applyDamage(a, dmg, src, head, cause){
  if(!a.alive || state.phase!=='play') return;
  if(a.team===src.team && a!==src) return;   // no friendly fire
  a.hp -= dmg;
  if(a.isPlayer){
    a.regenT = 0;
    hurtPlayer(src, dmg);
  } else {
    a.hurtT = 0.12;
    // return fire toward the shooter
    if(!a.target && src.alive!==false){ a.target = src; a.hasLastSeen=true; a.lastSeen.copy(src.pos); a.reactT = rnd(0.1,0.3); }
  }
  if(a.hp<=0) killActor(a, src, head, cause);
}

function killActor(a, src, head, cause){
  a.alive=false; a.hp=0; a.deaths++;
  a.killer = src;
  a.streak = 0;
  a.respawnT = rnd(3.4,5.0);
  if(a.isPlayer){
    a.respawnT = 3.2;
    onPlayerDeath(src, head, cause);
  } else {
    a.deathT = 0;
    a.mesh.rotation.z = rnd(-0.35,0.35);
    if(a.pos.distanceTo(camera.position)<40) sfx('death');
    spawnSparks(chestOf(a), 8, null, true);
    rebuildShootables();
  }
  if(src && src!==a){
    src.kills++;
    src.streak = (src.streak||0)+1;
    if(src.streak > (src.bestStreak||0)) src.bestStreak = src.streak;
    state.score[src.team]++;
    if(src.isPlayer) onPlayerKill(a, head, cause);
    else if(src.streak>=3 && Math.random()<0.5 && !src.isPlayer) botStreakReward(src);
    checkMatchEnd();
  }
  addKillfeed(src, a, head, cause);
}

function botStreakReward(b){
  // enemy bots occasionally call in their own UAV to keep pressure on
  if(b.streak===3){ state.uav[b.team] = 22; if(b.team!==player.team) toast('ENEMY UAV OVERHEAD'); sfx('siren'); }
  if(b.streak>=5 && Math.random()<0.4){
    var t = pick(actors.filter(function(a){ return a.alive && a.team!==b.team; }));
    if(t) callAirstrike(t.pos.clone(), b);
  }
}

/* ------------------------------- sentries -------------------------------- */
var sentries = [];
function deploySentry(owner){
  var g = new THREE.Group();
  var base = new THREE.Mesh(_boxGeo, amat(0x2f3439)); base.scale.set(0.6,0.16,0.6); base.position.y=0.08;
  var leg1 = new THREE.Mesh(_boxGeo, amat(0x22262a)); leg1.scale.set(0.07,0.5,0.07); leg1.position.set(0.18,0.32,0.18);
  var leg2 = leg1.clone(); leg2.position.set(-0.18,0.32,0.18);
  var leg3 = leg1.clone(); leg3.position.set(0,0.32,-0.24);
  var head = new THREE.Mesh(_boxGeo, amat(0x39434b)); head.scale.set(0.42,0.3,0.5); head.position.y=0.72;
  var barrel = new THREE.Mesh(_boxGeo, amat(0x191c1f)); barrel.scale.set(0.08,0.08,0.5); barrel.position.set(0,0.74,-0.4);
  var light = new THREE.Mesh(_boxGeo, new THREE.MeshBasicMaterial({color:TEAM_COL[owner.team]}));
  light.scale.set(0.08,0.08,0.08); light.position.set(0,0.9,-0.1);
  [base,leg1,leg2,leg3,head,barrel,light].forEach(function(m){ m.castShadow=true; g.add(m); });
  var turret = new THREE.Group(); turret.add(head); turret.add(barrel); turret.add(light);
  g.add(turret);
  var p = player===owner ? player.pos.clone() : owner.pos.clone();
  g.position.copy(p);
  scene.add(g);
  var hitBox = new THREE.Mesh(_boxGeo, new THREE.MeshBasicMaterial({visible:false}));
  hitBox.scale.set(0.7,1.0,0.7); hitBox.position.copy(p).setY(0.5); scene.add(hitBox);
  var s = { mesh:g, turret:turret, hitBox:hitBox, pos:p, team:owner.team, owner:owner,
            hp:200, alive:true, life:48, fireT:0, target:null, yaw:0, barrel:barrel };
  hitBox.userData.sentry = s;
  sentries.push(s);
  rebuildShootables();
  return s;
}
function damageSentry(s, d){
  s.hp -= d;
  if(s.hp<=0 && s.alive){
    s.alive=false;
    explode(s.pos.clone().setY(0.5), 3.4, 60, s.owner);
    scene.remove(s.mesh); scene.remove(s.hitBox);
    rebuildShootables();
  }
}
function updateSentries(dt){
  for(var i=sentries.length-1;i>=0;i--){
    var s = sentries[i];
    if(!s.alive){ sentries.splice(i,1); continue; }
    s.life -= dt;
    if(s.life<=0){ damageSentry(s, 9999); continue; }
    s.fireT -= dt;
    // acquire
    var best=null,bd=1e9;
    for(var j=0;j<actors.length;j++){
      var a=actors[j]; if(!a.alive||a.team===s.team) continue;
      var d=s.pos.distanceTo(a.pos); if(d>42||d>bd) continue;
      if(!hasLOS(_v1.copy(s.pos).setY(1.0), chestOf(a))) continue;
      bd=d; best=a;
    }
    s.target=best;
    if(best){
      var wy = Math.atan2(-(best.pos.x-s.pos.x), -(best.pos.z-s.pos.z));
      var df = ((wy - s.yaw + Math.PI*3)%(Math.PI*2))-Math.PI;
      s.yaw += clamp(df, -5*dt, 5*dt);
      s.turret.rotation.y = s.yaw;
      if(s.fireT<=0 && Math.abs(df)<0.25){
        s.fireT = 0.14;
        var mz = _v2.copy(s.pos).setY(1.24).add(_v1.set(-Math.sin(s.yaw),0,-Math.cos(s.yaw)).multiplyScalar(0.5)).clone();
        var end = chestOf(best);
        if(Math.random()<0.72){ applyDamage(best, 15, s.owner, false, 'sentry'); spawnSparks(end,3,null,true); }
        else end.x+=rnd(-1,1), end.y+=rnd(-1,1), end.z+=rnd(-1,1);
        spawnTracer(mz, end, 0xfff0b0);
        shotAt(mz, {boom:0.5,lp:1600,crack:800}, false);
      }
    } else {
      s.turret.rotation.y += dt*0.6; s.yaw = s.turret.rotation.y;
    }
  }
}
