/* ================================== HUD =================================== */
function updateAmmoHud(){
  var w = WEAPONS[player.weapon], a = player.ammo[player.weapon]||{mag:0,reserve:0};
  $('#wname').textContent = w.name;
  $('#ammo').innerHTML = a.mag + '<small> / '+a.reserve+'</small>';
  $('#ammo').classList.toggle('low', a.mag <= Math.max(1,Math.ceil(w.mag*0.25)));
  $('#firemode').textContent = w.mode==='auto'?'AUTO':(w.mode==='semi'?'SEMI':(w.mode==='bolt'?'BOLT':'PUMP'));
  $('#nadecount').innerHTML = 'FRAG <b>'+player.grenades+'</b>';
}
function updateHealthHud(){
  var pct = clamp(player.hp/player.maxHp*100,0,100);
  $('#hpfill').style.width = pct+'%';
  $('#hpfill').classList.toggle('low', pct<40);
  $('#hpnum').textContent = Math.max(0,Math.round(player.hp))+' / '+player.maxHp+' HP';
  $('#vig').style.opacity = pct<55 ? (1-pct/55)*0.95 : 0;
}
var hitTimer=null;
function showHitmarker(kill, head){
  var h = $('#hitmark');
  h.classList.toggle('kill', !!kill);
  h.style.opacity = 1;
  h.style.transform = 'translate(-50%,-50%) rotate(45deg) scale('+(kill?1.35:1)+')';
  clearTimeout(hitTimer);
  hitTimer = setTimeout(function(){ h.style.opacity=0; }, kill?220:130);
  sfx(head?'headshot':(kill?'kill':'hit'));
}
function toast(txt){
  var t = el('div','tst up',txt);
  $('#toast').appendChild(t);
  setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 2000);
}
function xpPop(txt){
  var t = el('div','xpp up',txt);
  $('#xppop').appendChild(t);
  setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 1600);
}
function flashScreen(a){
  var f = $('#flash');
  f.style.transition='none'; f.style.opacity=a;
  requestAnimationFrame(function(){ f.style.transition='opacity .4s'; f.style.opacity=0; });
}
function addKillfeed(src, victim, head, cause){
  var feed = $('#feed');
  var wname = cause==='frag' ? 'FRAG' : (cause==='knife' ? 'KNIFE' : (cause==='sentry' ? 'SENTRY' :
    (src && src.weapon ? WEAPONS[src.weapon].name : 'KIA')));
  var sc = src ? (src.team===TEAM.BLUE?'#4aa8ff':'#ff4d4d') : '#8b96a5';
  var vc = victim.team===TEAM.BLUE?'#4aa8ff':'#ff4d4d';
  var sn = src ? (src.isPlayer?'YOU':src.name) : 'WORLD';
  var vn = victim.isPlayer?'YOU':victim.name;
  var d = el('div','fe up');
  if(src===player || victim===player) d.style.borderLeftColor='#ff8a1f';
  d.innerHTML = '<span style="color:'+sc+'">'+sn+'</span><span class="w">'+wname+(head?' ⌖':'')+'</span>'+
                '<span style="color:'+vc+'">'+vn+'</span>';
  feed.appendChild(d);
  while(feed.children.length>6) feed.removeChild(feed.firstChild);
  setTimeout(function(){ if(d.parentNode) d.parentNode.removeChild(d); }, 6500);
}

/* directional damage indicator */
function damageIndicator(src){
  if(!src || !src.pos) return;
  var d = el('div','dind');
  d.innerHTML = '<svg viewBox="0 0 100 100"><path d="M35 26 Q50 14 65 26 L58 33 Q50 26 42 33 Z" fill="rgba(255,60,50,.92)"/></svg>';
  $('#dmgdirs').appendChild(d);
  var upd = function(){
    TMP.copy(src.pos).sub(camera.position);
    var ang = Math.atan2(TMP.x, -TMP.z) - player.yaw;
    d.style.transform = 'rotate('+(-ang*180/Math.PI)+'deg)';
  };
  upd();
  d.style.opacity=1;
  var iv = setInterval(upd, 60);
  setTimeout(function(){ d.style.transition='opacity .4s'; d.style.opacity=0; }, 700);
  setTimeout(function(){ clearInterval(iv); if(d.parentNode) d.parentNode.removeChild(d); }, 1200);
}
function hurtPlayer(src, dmg){
  updateHealthHud();
  sfx('hurt');
  player.shake = Math.min(1.4, player.shake + clamp(dmg/45,0.08,0.5));
  damageIndicator(src);
  var f=$('#flash');
  f.style.transition='none'; f.style.background='#a00'; f.style.opacity=clamp(dmg/160,0.05,0.3);
  requestAnimationFrame(function(){ f.style.transition='opacity .35s'; f.style.opacity=0;
    setTimeout(function(){ f.style.background='#fff'; },360); });
}

function onPlayerDeath(src, head, cause){
  $('#dead').classList.remove('hide');
  $('#deadby').innerHTML = 'KILLED BY <b>'+(src&&src!==player?src.name:'YOURSELF')+'</b>'+
    (src&&src.weapon&&src!==player?' · '+WEAPONS[src.weapon].name:'')+(head?' · HEADSHOT':'');
  $('#respawn').textContent = '3';
  player.streaksUsed = {};
  designating=null; clearStrikeMarker();
  sfx('death');
  flashScreen(0.25);
  player.respawnT = 3.2;
  updateHealthHud();
}
function onPlayerKill(victim, head, cause){
  var xp = 100;
  var label = 'ELIMINATION';
  if(head){ xp += 50; label='HEADSHOT'; }
  if(cause==='knife'){ xp += 50; label='KNIFE KILL'; }
  if(cause==='frag'){ xp += 25; label='FRAG KILL'; }
  if(cause==='sentry'){ xp = 50; label='SENTRY KILL'; }
  if(player.streak>=3) { xp += player.streak*10; }
  addXp(xp, label + (player.streak>1? '  ×'+player.streak : ''));
  player.headshots += head?1:0;
  grantStreaks();
  if(player.streak===5) toast('5 KILL STREAK');
  if(player.streak===10) toast('RAMPAGE — 10 KILLS');
}

/* ------------------------------- minimap --------------------------------- */
var mmCtx=null;
function initMinimap(){ mmCtx = $('#mm').getContext('2d'); }
function drawMinimap(){
  if(!mmCtx) return;
  var C = mmCtx, S = 344;
  var sc = S/Math.max(W,H);
  C.clearRect(0,0,S,S);
  C.fillStyle='rgba(8,12,17,.9)'; C.fillRect(0,0,S,S);
  // geometry
  for(var y=0;y<H;y++) for(var x=0;x<W;x++){
    var s = solid[y][x];
    if(s===1){ C.fillStyle='rgba(150,163,178,.55)'; C.fillRect(x*sc,y*sc,sc,sc); }
    else if(s===2){ C.fillStyle='rgba(150,163,178,.28)'; C.fillRect(x*sc+sc*0.2,y*sc+sc*0.2,sc*0.6,sc*0.6); }
  }
  // spawn tints
  [0,1].forEach(function(t){
    C.fillStyle = t? 'rgba(255,77,77,.12)':'rgba(74,168,255,.12)';
    spawns[t].forEach(function(p){
      var gx=(p.x/CELL+W/2), gy=(p.z/CELL+H/2);
      C.fillRect((gx-1)*sc,(gy-1)*sc,sc*2,sc*2);
    });
  });
  var uavOn = state.uav[player.team]>0;
  // actors
  for(var i=0;i<actors.length;i++){
    var a = actors[i];
    if(!a.alive || a.isPlayer) continue;
    var gx=(a.pos.x/CELL+W/2)*sc, gy=(a.pos.z/CELL+H/2)*sc;
    var friendly = a.team===player.team;
    var ping = (a.mmPing||0)>0;
    if(!friendly && !uavOn && !ping) continue;
    C.beginPath();
    C.fillStyle = friendly? '#4aa8ff' : (uavOn? '#ff4d4d' : '#ff9f43');
    C.arc(gx,gy,5.5,0,6.283); C.fill();
    // facing tick
    C.strokeStyle = C.fillStyle; C.lineWidth=2.4;
    C.beginPath(); C.moveTo(gx,gy);
    C.lineTo(gx - Math.sin(a.yaw)*10, gy - Math.cos(a.yaw)*10); C.stroke();
  }
  // sentries
  for(var s2=0;s2<sentries.length;s2++){
    var st=sentries[s2]; if(!st.alive) continue;
    var sx=(st.pos.x/CELL+W/2)*sc, sy=(st.pos.z/CELL+H/2)*sc;
    C.fillStyle = st.team===player.team?'#7ee081':'#ff8a1f';
    C.fillRect(sx-4,sy-4,8,8);
  }
  // player + view cone
  if(player.alive){
    var px=(player.pos.x/CELL+W/2)*sc, py=(player.pos.z/CELL+H/2)*sc;
    var fx2=-Math.sin(player.yaw), fy=-Math.cos(player.yaw);
    var ang = Math.atan2(fy,fx2);
    var half = (camera.fov*Math.PI/180)*0.72;
    C.beginPath(); C.moveTo(px,py);
    C.arc(px,py,44,ang-half,ang+half); C.closePath();
    C.fillStyle='rgba(255,255,255,.10)'; C.fill();
    C.save(); C.translate(px,py); C.rotate(-Math.atan2(fx2,fy));
    C.beginPath(); C.moveTo(0,-9); C.lineTo(6.5,7); C.lineTo(0,3.6); C.lineTo(-6.5,7); C.closePath();
    C.fillStyle='#fff'; C.fill();
    C.restore();
  }
  $('#uavtag').textContent = uavOn ? 'UAV '+Math.ceil(state.uav[player.team])+'s' : '';
}

/* ------------------------------ scoreboard -------------------------------- */
function updateScoreboard(){
  var rows=[[],[]];
  actors.forEach(function(a){ rows[a.team].push(a); });
  rows.forEach(function(r){ r.sort(function(x,y){ return y.kills-x.kills || x.deaths-y.deaths; }); });
  function fill(tb, list){
    tb.innerHTML='';
    list.forEach(function(a){
      var tr = el('tr', a.isPlayer?'me':'');
      var kdr = a.deaths? (a.kills/a.deaths).toFixed(2) : a.kills.toFixed(2);
      tr.innerHTML = '<td class="n">'+(a.isPlayer? (player.op.name+' (YOU)') : a.name)+'</td>'+
        '<td>'+a.kills+'</td><td>'+a.deaths+'</td><td>'+kdr+'</td><td>'+(a.bestStreak||0)+'</td>';
      tb.appendChild(tr);
    });
  }
  fill($('#bdBlue'), rows[0]); fill($('#bdRed'), rows[1]);
  $('#bdScoreB').textContent = state.score[0];
  $('#bdScoreR').textContent = state.score[1];
}
function updateTopbar(){
  $('#sBlue').textContent = state.score[0];
  $('#sRed').textContent = state.score[1];
  var t = Math.max(0,state.time);
  $('#timer').textContent = Math.floor(t/60)+':'+('0'+Math.floor(t%60)).slice(-2);
  $('#bBlue').firstChild.style.width = clamp(state.score[0]/settings.scoreLimit*100,0,100)+'%';
  $('#bRed').firstChild.style.width = clamp(state.score[1]/settings.scoreLimit*100,0,100)+'%';
}

/* ------------------------------ crosshair -------------------------------- */
function updateCrosshair(){
  var w = WEAPONS[player.weapon];
  var spread = lerp(w.hipSpread, w.adsSpread, player.adsAmt);
  var mv = Math.sqrt(player.vel.x*player.vel.x+player.vel.z*player.vel.z);
  spread *= 1 + mv*0.06 + (player.onGround?0:0.8);
  var gap = clamp(4 + spread*2.4 + vm.kick*7, 3, 26);
  $('#xh-t').style.top = (21-gap-8)+'px';
  $('#xh-b').style.top = (21+gap)+'px';
  $('#xh-l').style.left = (21-gap-8)+'px';
  $('#xh-r').style.left = (21+gap)+'px';
  var col = designating? '#ff5533' : '#fff';
  ['#xh-t','#xh-b','#xh-l','#xh-r','#xh-dot'].forEach(function(s){ $(s).style.background=col; });
}
