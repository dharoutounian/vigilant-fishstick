/* ================================== MATCH ================================= */
var state = {
  phase:'boot',          // boot | menu | play | pause | over
  score:[0,0], time:600, uav:[0,0], started:false, menuT:0
};

function createBots(){
  for(var i=0;i<4;i++) createBot(TEAM.BLUE, i+1);
  for(var j=0;j<5;j++) createBot(TEAM.RED, j);
}

function startMatch(){
  state.score=[0,0]; state.uav=[0,0];
  state.time = settings.timeLimit*60;
  state.phase='play';
  pendingUnlocks=[];
  designating=null; clearStrikeMarker();

  // clear grenades / sentries / fx
  grenades.forEach(function(g){ scene.remove(g.mesh); }); grenades.length=0;
  sentries.forEach(function(s){ scene.remove(s.mesh); scene.remove(s.hitBox); }); sentries.length=0;
  fx.decals.forEach(function(d){ scene.remove(d); }); fx.decals.length=0;

  // reset player
  player.kills=0; player.deaths=0; player.streak=0; player.bestStreak=0; player.headshots=0;
  player.xpThisMatch=0; player.streaksReady={}; player.streaksUsed={};
  resetLoadout();
  player.alive=true;
  respawnPlayer();

  // reset bots
  actors.forEach(function(a){
    if(a.isPlayer) return;
    a.kills=0; a.deaths=0; a.streak=0; a.bestStreak=0;
    a.alive=false; a.respawnT = rnd(0.1,1.2); a.mesh.visible=false; a.deathT=99;
  });

  $('#menu').classList.add('hide');
  $('#hud').classList.add('on');
  $('#feed').innerHTML='';
  $('#results').classList.add('hide');
  $('#pause').classList.add('hide');
  buildStreakHud(); refreshStreakHud();
  updateAmmoHud(); updateHealthHud(); updateTopbar(); updateScoreboard(); updateXpHud();
  rebuildShootables();
  toast('MATCH START — FIRST TO '+settings.scoreLimit);
  requestLock();
  updateLockHint();
}

function checkMatchEnd(){
  updateTopbar();
  if(state.score[0]>=settings.scoreLimit || state.score[1]>=settings.scoreLimit) endMatch();
}
function endMatch(){
  if(state.phase!=='play') return;
  state.phase='over';
  if(document.pointerLockElement) document.exitPointerLock();
  updateLockHint();
  var win = state.score[0]>state.score[1];
  var draw = state.score[0]===state.score[1];
  $('#resTitle').textContent = draw? 'DRAW' : (win? 'VICTORY':'DEFEAT');
  $('#resTitle').style.color = draw? '#e8ecf1' : (win? '#3ddc84':'#ff4d4d');
  $('#resScore').textContent = state.score[0]+' — '+state.score[1];
  var kdr = player.deaths? (player.kills/player.deaths).toFixed(2) : player.kills.toFixed(2);
  $('#resStats').innerHTML =
    '<div><div class="v">'+player.kills+'</div><div class="k up">KILLS</div></div>'+
    '<div><div class="v">'+player.deaths+'</div><div class="k up">DEATHS</div></div>'+
    '<div><div class="v">'+kdr+'</div><div class="k up">K/D</div></div>'+
    '<div><div class="v">'+player.bestStreak+'</div><div class="k up">BEST STREAK</div></div>'+
    '<div><div class="v">'+player.headshots+'</div><div class="k up">HEADSHOTS</div></div>';
  var bonus = draw?250:(win?600:200);
  addXp(bonus);
  $('#resXp').textContent = '+'+player.xpThisMatch+' XP THIS MATCH  ·  MATCH BONUS +'+bonus;
  $('#unlockList').innerHTML = pendingUnlocks.length? 'NEW UNLOCKS — '+pendingUnlocks.join(' · ') : '';
  $('#results').classList.remove('hide');
  $('#hud').classList.remove('on');
  $('#board').classList.add('hide');
  sfx(win?'levelup':'death');
  buildMenus();
}

/* ================================== LOOP ==================================
   Fixed-timestep simulation. The world always advances in 1/60 s slices no
   matter what the display is doing, so a slow machine drops frames instead of
   dropping into slow motion, and physics stays identical at every frame rate.
-------------------------------------------------------------------------- */
var lastT = 0, accum = 0, hudAcc = 0;
var FIXED = 1/60, MAX_STEPS = 6;
var fpsSmooth = 60, fpsAcc = 0, fpsFrames = 0;

function simulate(dt){
  state.time -= dt;
  if(state.time<=0){ state.time=0; endMatch(); return; }
  for(var t=0;t<2;t++) if(state.uav[t]>0) state.uav[t]-=dt;

  updatePlayer(dt);
  for(var i=0;i<actors.length;i++){ if(!actors[i].isPlayer) updateBot(actors[i], dt); }
  updateGrenades(dt);
  updateSentries(dt);
  updateDesignator();
  updateViewmodel(dt);
  updatePlayerBody(dt);
  updateFx(dt);
}

function loop(now){
  requestAnimationFrame(loop);
  if(!lastT) lastT = now;
  var raw = (now-lastT)/1000;
  lastT = now;
  if(!(raw>0)) raw = FIXED;
  if(raw > 0.5) raw = FIXED;           // tab was backgrounded — don't fast-forward
  raw = Math.min(raw, 0.25);

  // rolling fps read-out for the pause screen
  fpsAcc += raw; fpsFrames++;
  if(fpsAcc > 0.5){ fpsSmooth = fpsFrames/fpsAcc; fpsAcc = 0; fpsFrames = 0; }

  if(state.phase==='play'){
    accum += raw;
    var steps = 0;
    while(accum >= FIXED && steps < MAX_STEPS && state.phase==='play'){
      simulate(FIXED);
      accum -= FIXED; steps++;
    }
    if(steps >= MAX_STEPS) accum = 0;   // machine can't keep up; skip the backlog

    hudAcc += raw;
    if(hudAcc>0.05){
      hudAcc=0;
      drawMinimap(); updateTopbar(); updateCrosshair(); refreshStreakHud();
      if(!$('#board').classList.contains('hide')) updateScoreboard();
      if(player.alive) updateHealthHud();
    }
    // keep the shadow box centred on the action so shadows stay crisp
    sunLight.position.set(player.pos.x+62, 52, player.pos.z+34);
    sunLight.target.position.set(player.pos.x, 0, player.pos.z);
    sunLight.target.updateMatrixWorld();
  } else if(state.phase==='menu' || state.phase==='boot'){
    accum = 0;
    state.menuT += raw*0.055;
    var r = 46;
    camera.position.set(Math.cos(state.menuT)*r, 26 + Math.sin(state.menuT*0.7)*5, Math.sin(state.menuT)*r);
    camera.lookAt(0, 2, 0);
    camera.fov = 62; camera.updateProjectionMatrix();
    updateFx(raw);
    updatePlayerBody(raw);
  } else {
    accum = 0;
    updateFx(raw);
    updateViewmodel(raw);
    updatePlayerBody(raw);
  }

  renderer.clear();
  renderer.render(scene, camera);
  if(state.phase==='play'){
    renderer.clearDepth();
    renderer.render(gunScene, gunCam);
  }
}

/* ================================== BOOT ================================== */
function init(){
  initRenderer();
  buildMap();
  initPathBuffers();
  initViewmodel();
  initInput();
  initMinimap();
  initMenus();
  buildStreakHud();
  createBots();
  buildPlayerBody();
  resetLoadout();
  buildMenus();
  updateXpHud();
  state.phase='menu';
  $('#loading').classList.add('hide');
  requestAnimationFrame(loop);
  window.__FIRESTORM = { state:state, player:player, actors:actors, settings:settings,
                         profile:profile, startMatch:startMatch, WEAPONS:WEAPONS,
                         mouse:mouse, keys:keys, sentries:sentries, grenades:grenades,
                         hasLOS:hasLOS, chestOf:chestOf, vm:vm, gunCam:gunCam, camera:camera,
                         adsPosFor:adsPosFor, VM_FOV_ADS:VM_FOV_ADS,
                         playerBody:function(){ return pbody; },
                         eyeHeight:function(){return player.height;} };
}

try { init(); }
catch(e){
  var d = document.getElementById('err');
  d.classList.remove('hide');
  d.textContent = 'FIRESTORM failed to start:\n\n' + (e && e.stack ? e.stack : e);
  console.error(e);
}
})();
