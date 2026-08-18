/* ============================== KILLSTREAKS =============================== */
var STREAKS = {
  uav:    { at:3, name:'UAV RECON',  key:'4', icon:'<svg viewBox="0 0 24 24"><path d="M12 3v6M4 9h16M7 9l5 9 5-9"/></svg>' },
  strike: { at:5, name:'AIRSTRIKE',  key:'5', icon:'<svg viewBox="0 0 24 24"><path d="M3 12h18M12 3l4 9-4 9-4-9z"/></svg>' },
  sentry: { at:7, name:'SENTRY GUN', key:'6', icon:'<svg viewBox="0 0 24 24"><path d="M4 18h16M8 18v-4h8v4M10 14V9h9M6 21h12"/></svg>' }
};
var STREAK_ORDER = ['uav','strike','sentry'];
var designating = null;   // pending airstrike
var strikeMarker = null;

function buildStreakHud(){
  var row = $('#streakrow'); row.innerHTML='';
  STREAK_ORDER.forEach(function(k){
    var s = STREAKS[k];
    var d = el('div','ks');
    d.id = 'ks-'+k;
    d.innerHTML = s.icon + '<span>'+s.key+' · '+s.at+'</span>';
    row.appendChild(d);
  });
}
function refreshStreakHud(){
  STREAK_ORDER.forEach(function(k){
    var d = $('#ks-'+k); if(!d) return;
    d.classList.toggle('rdy', !!player.streaksReady[k]);
    d.classList.toggle('act', k==='uav' && state.uav[player.team]>0);
  });
}
function grantStreaks(){
  STREAK_ORDER.forEach(function(k){
    if(player.streak>=STREAKS[k].at && !player.streaksReady[k] && !player.streaksUsed[k]){
      player.streaksReady[k]=true;
      player.streaksUsed[k]=true;      // one per life-streak tier
      toast(STREAKS[k].name+' READY  ['+STREAKS[k].key+']');
      sfx('streak');
    }
  });
  refreshStreakHud();
}
function useStreak(k){
  if(!player.streaksReady[k] || !player.alive) return;
  if(k==='uav'){
    player.streaksReady[k]=false;
    state.uav[player.team] = 26;
    toast('UAV ONLINE — ENEMIES REVEALED'); sfx('siren');
  } else if(k==='strike'){
    if(designating){ designating=null; clearStrikeMarker(); toast('AIRSTRIKE CANCELLED'); return; }
    designating = true;
    toast('DESIGNATE TARGET — LEFT CLICK');
    sfx('ui');
  } else if(k==='sentry'){
    player.streaksReady[k]=false;
    deploySentry(player);
    toast('SENTRY GUN DEPLOYED'); sfx('streak');
  }
  refreshStreakHud();
}
function clearStrikeMarker(){
  if(strikeMarker){ scene.remove(strikeMarker); strikeMarker=null; }
}
// while designating, the crosshair projects onto the ground
function updateDesignator(){
  if(!designating || !player.alive){ if(strikeMarker) strikeMarker.visible=false; return; }
  var dir = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  shootRay.set(camera.position, dir); shootRay.far=200;
  var hits = shootRay.intersectObjects(collidables,false);
  if(!hits.length){ if(strikeMarker) strikeMarker.visible=false; return; }
  var p = hits[0].point;
  if(!strikeMarker){
    strikeMarker = new THREE.Group();
    var ring = new THREE.Mesh(new THREE.RingGeometry(3.4,4.0,32),
      new THREE.MeshBasicMaterial({color:0xff5533, transparent:true, opacity:0.8, side:THREE.DoubleSide, depthTest:false}));
    ring.rotation.x=-Math.PI/2; strikeMarker.add(ring);
    var ring2 = new THREE.Mesh(new THREE.RingGeometry(0.4,0.6,20),
      new THREE.MeshBasicMaterial({color:0xff5533, transparent:true, opacity:0.9, side:THREE.DoubleSide, depthTest:false}));
    ring2.rotation.x=-Math.PI/2; strikeMarker.add(ring2);
    strikeMarker.renderOrder=999;
    scene.add(strikeMarker);
  }
  strikeMarker.visible=true;
  strikeMarker.position.copy(p).setY(p.y+0.08);
  strikeMarker.rotation.y += 0.02;
  strikeMarker.userData.point = p.clone();
}
function confirmStrike(){
  if(!designating || !strikeMarker || !strikeMarker.userData.point) return false;
  var p = strikeMarker.userData.point.clone();
  designating=false; clearStrikeMarker();
  player.streaksReady.strike=false;
  refreshStreakHud();
  callAirstrike(p, player);
  return true;
}
function callAirstrike(point, owner){
  if(owner===player) toast('AIRSTRIKE INBOUND');
  else if(owner.team!==player.team) toast('ENEMY AIRSTRIKE INBOUND');
  sfx('jet');
  var dirAngle = Math.random()*Math.PI*2;
  var dx = Math.cos(dirAngle), dz = Math.sin(dirAngle);
  var n = 8;
  for(var i=0;i<n;i++){
    (function(i){
      setTimeout(function(){
        if(state.phase!=='play') return;
        var off = (i - n/2)*5.6;
        var px = point.x + dx*off + rnd(-2.2,2.2);
        var pz = point.z + dz*off + rnd(-2.2,2.2);
        px = clamp(px, -MAPW/2+CELL, MAPW/2-CELL);
        pz = clamp(pz, -MAPH/2+CELL, MAPH/2-CELL);
        explode(new THREE.Vector3(px, groundAt(px,pz)+0.4, pz), 9.6, 300, owner);
      }, 1600 + i*115);
    })(i);
  }
}

/* ============================== PROGRESSION =============================== */
var pendingUnlocks = [];
function unlocksAt(level){
  var out=[];
  for(var k in WEAPONS) if(WEAPONS[k].lvl===level && k!=='knife') out.push(WEAPONS[k].name);
  for(var o in OPERATORS) if(OPERATORS[o].lvl===level) out.push('OPERATOR '+OPERATORS[o].name);
  return out;
}
function addXp(n, label){
  profile.xp += n; player.xpThisMatch += n;
  if(label) xpPop('+'+n+'  '+label);
  var need = xpForLevel(profile.level);
  while(profile.xp >= need){
    profile.xp -= need; profile.level++;
    var u = unlocksAt(profile.level);
    pendingUnlocks = pendingUnlocks.concat(u);
    toast('RANK UP — LEVEL '+profile.level);
    if(u.length) setTimeout(function(){ toast('UNLOCKED: '+u.join(', ')); }, 900);
    sfx('levelup');
    need = xpForLevel(profile.level);
  }
  updateXpHud();
}
function updateXpHud(){
  var need = xpForLevel(profile.level);
  var pct = clamp(profile.xp/need*100,0,100);
  var f=$('#xpfill'); if(f) f.style.width = pct+'%';
  var t=$('#xptxt'); if(t) t.textContent = 'LVL '+profile.level+'  ·  '+profile.xp+' / '+need+' XP';
  var m=$('#mLvl'); if(m) m.textContent = profile.level;
  var mx=$('#mXp'); if(mx) mx.style.width = pct+'%';
}
function isUnlocked(kind, id){
  var lvl = kind==='w' ? WEAPONS[id].lvl : OPERATORS[id].lvl;
  return profile.level >= lvl;
}
