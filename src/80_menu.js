/* ================================= MENUS ================================== */
function statBar(label, v){
  return '<div class="stat"><span style="width:52px">'+label+'</span><span class="b"><i style="width:'+clamp(v,4,100)+'%"></i></span></div>';
}
function weaponCard(id){
  var w = WEAPONS[id], unlocked = isUnlocked('w',id);
  var sel = (w.slot==='primary'? profile.primary : profile.secondary)===id;
  var d = el('div','card2'+(sel?' sel':'')+(unlocked?'':' lock'));
  var dps = (w.dmg*(w.pellets||1));
  d.innerHTML =
    '<div class="nm">'+w.name+'</div><div class="ty">'+w.cls+'</div>'+
    (unlocked? (sel?'<div class="selmark up">EQUIPPED</div>':'') : '<div class="lk up">LVL '+w.lvl+'</div>')+
    '<div class="ds">'+w.desc+'</div>'+
    statBar('DMG', dps*1.05) +
    statBar('RATE', w.rpm/10) +
    statBar('RANGE', (w.range[1]/2)) +
    statBar('MOBIL', w.moveMul*72) +
    statBar('CTRL', 100 - w.recoil[0]*30);
  if(unlocked) d.addEventListener('click', function(){
    if(w.slot==='primary') profile.primary=id; else profile.secondary=id;
    sfx('ui'); buildMenus();
  });
  return d;
}
function operatorCard(id){
  var o = OPERATORS[id], unlocked = isUnlocked('o',id);
  var sel = profile.operator===id;
  var d = el('div','card2'+(sel?' sel':'')+(unlocked?'':' lock'));
  d.innerHTML =
    '<div class="nm">'+o.name+'</div><div class="ty">OPERATOR</div>'+
    (unlocked? (sel?'<div class="selmark up">SELECTED</div>':'') : '<div class="lk up">LVL '+o.lvl+'</div>')+
    '<div class="ds">'+o.perk+'</div>'+
    statBar('HP', o.hp*0.42) +
    statBar('SPEED', o.speed*62) +
    statBar('RELOAD', (2-o.reloadMul)*58) +
    statBar('ADS', (2-o.adsMul)*56) +
    statBar('DMG', o.dmgMul*62);
  if(unlocked) d.addEventListener('click', function(){ profile.operator=id; sfx('ui'); buildMenus(); });
  return d;
}
function buildMenus(){
  var gp=$('#gPrim'), gs=$('#gSec'), go=$('#gOps'), gb=$('#briefCards');
  gp.innerHTML=''; gs.innerHTML=''; go.innerHTML=''; gb.innerHTML='';
  PRIMARIES.forEach(function(id){ gp.appendChild(weaponCard(id)); });
  SECONDARIES.forEach(function(id){ gs.appendChild(weaponCard(id)); });
  Object.keys(OPERATORS).forEach(function(id){ go.appendChild(operatorCard(id)); });

  var op = OPERATORS[profile.operator];
  [['OPERATOR',op.name,op.perk],
   ['PRIMARY',WEAPONS[profile.primary].name,WEAPONS[profile.primary].cls+' · '+WEAPONS[profile.primary].mag+' rnd mag'],
   ['SECONDARY',WEAPONS[profile.secondary].name,WEAPONS[profile.secondary].cls+' · '+WEAPONS[profile.secondary].mag+' rnd mag'],
   ['DIFFICULTY',DIFF[settings.diff].name, settings.scoreLimit+' kills · '+settings.timeLimit+' min']
  ].forEach(function(r){
    var d = el('div','card2');
    d.style.cursor='default';
    d.innerHTML='<div class="ty">'+r[0]+'</div><div class="nm" style="margin-top:3px">'+r[1]+'</div><div class="ds">'+r[2]+'</div>';
    gb.appendChild(d);
  });
  updateXpHud();
}

function initMenus(){
  $$('.tab').forEach(function(t){
    t.addEventListener('click', function(){
      $$('.tab').forEach(function(x){x.classList.remove('sel');});
      t.classList.add('sel');
      $$('.pane').forEach(function(p){p.classList.remove('sel');});
      $('#p-'+t.dataset.p).classList.add('sel');
      sfx('ui');
    });
  });
  $('#deploy').addEventListener('click', function(){ audioInit(); startMatch(); });

  function bindRange(id, vid, fmt, apply){
    var s=$(id), v=$(vid);
    var upd=function(){ v.textContent = fmt(+s.value); apply(+s.value); };
    s.addEventListener('input', upd); upd();
  }
  bindRange('#sSens','#vSens',function(x){return (x/100).toFixed(2);},function(x){settings.sens=x/100;});
  bindRange('#sAds','#vAds',function(x){return (x/100).toFixed(2);},function(x){settings.adsSens=x/100;});
  bindRange('#sFov','#vFov',function(x){return x;},function(x){settings.fov=x;});
  bindRange('#sLimit','#vLimit',function(x){return x;},function(x){settings.scoreLimit=x; buildMenus();});
  bindRange('#sTime','#vTime',function(x){return x;},function(x){settings.timeLimit=x; buildMenus();});
  bindRange('#sVol','#vVol',function(x){return x;},function(x){settings.vol=x/100; if(masterGain) masterGain.gain.value=settings.vol;});
  bindRange('#sScale','#vScale',function(x){return x;},function(x){settings.scale=x/100; setPixelRatio();});
  bindRange('#sBob','#vBob',function(x){return x;},function(x){settings.viewBob=x/100;});
  $('#sInv').addEventListener('change',function(){ settings.invert=this.checked; });
  $('#sBody').addEventListener('change',function(){ settings.showBody=this.checked; });
  $('#sShadow').addEventListener('change',function(){ settings.shadows=this.checked; applyQuality(); });
  $('#sQual').addEventListener('change',function(){
    settings.quality=+this.value;
    var q = QUALITY[settings.quality];
    $('#sShadow').checked = settings.shadows = q.shadows;
    applyQuality(); sfx('ui');
  });
  $('#sDiff').addEventListener('change',function(){ settings.diff=+this.value; buildMenus(); });

  $('#pResume').addEventListener('click', function(){ togglePause(false); });
  $('#pRestart').addEventListener('click', function(){ $('#pause').classList.add('hide'); startMatch(); });
  $('#pQuit').addEventListener('click', function(){ quitToMenu(); });
  $('#rAgain').addEventListener('click', function(){ $('#results').classList.add('hide'); startMatch(); });
  $('#rMenu').addEventListener('click', function(){ $('#results').classList.add('hide'); quitToMenu(); });
}

function togglePause(on){
  if(on){
    if(state.phase!=='play') return;
    state.phase='pause';
    $('#pause').classList.remove('hide');
    var q = QUALITY[settings.quality] || QUALITY[2];
    $('#perfline').innerHTML = 'ESC TO RESUME &nbsp;·&nbsp; ' + Math.round(fpsSmooth) + ' FPS &nbsp;·&nbsp; ' +
      q.name + (fpsSmooth < 40 ? ' &nbsp;·&nbsp; <span style="color:var(--acc)">LOWER GRAPHICS QUALITY IN SETTINGS FOR MORE FPS</span>' : '');
    if(document.pointerLockElement) document.exitPointerLock();
  } else {
    $('#pause').classList.add('hide');
    state.phase='play';
    requestLock();
    updateLockHint();
  }
}
function quitToMenu(){
  state.phase='menu';
  updateLockHint();
  $('#pause').classList.add('hide');
  $('#hud').classList.remove('on');
  $('#board').classList.add('hide');
  $('#menu').classList.remove('hide');
  if(document.pointerLockElement) document.exitPointerLock();
  buildMenus();
}
