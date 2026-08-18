/* ============================================================================
   OPERATION FIRESTORM — a browser tactical FPS
   Single file. Three.js r128. No external assets; audio is synthesised.
   ========================================================================== */
(function(){
'use strict';

var $ = function(s){ return document.querySelector(s); };
var $$ = function(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); };
var el = function(t,c,h){ var e=document.createElement(t); if(c)e.className=c; if(h!=null)e.innerHTML=h; return e; };

if(typeof THREE==='undefined'){
  document.getElementById('loading').innerHTML =
    '<div style="text-align:center;color:#ff8080;font-size:14px;line-height:1.8">'+
    'Could not load the 3D engine.<br>This game pulls three.js from a CDN — connect to the internet and reload.</div>';
  return;
}

/* ------------------------------- tuning ---------------------------------- */
var CELL = 3.5;              // world units per grid cell
var WALL_H = 5.2;            // full wall height
var CRATE_H = 1.25;          // waist-high cover height
var EYE = 1.62, EYE_CROUCH = 1.02;
var P_RAD = 0.42;            // player/bot collision radius
var GRAV = 22;
var TEAM = { BLUE:0, RED:1 };
var TEAM_COL = [0x4aa8ff, 0xff4d4d];
var TEAM_NAME = ['TASK FORCE 141','SPETSNAZ'];

var settings = {
  sens: 1.20, adsSens: 0.70, fov: 85, invert:false,
  diff: 1, scoreLimit: 50, timeLimit: 10,
  vol: 0.55, shadows: true, scale: 1.0, quality: 2,
  viewBob: 1.0,        // 0 disables camera bob/lean entirely
  showBody: true       // draw your own legs and torso in first person
};

// progression lives in memory for the page session
var profile = { xp: 0, level: 1, primary:'m4', secondary:'m9', operator:'ghost' };
function xpForLevel(l){ return Math.round(700*l + 90*l*l); }   // xp needed to go l -> l+1

/* Five rifles converge on one target, so what kills you is not any single bot
   but the stacked damage of the squad — measured at ~32 incoming DPS on
   REGULAR, spiking past 65 when three of them focus at once. Against that,
   health alone is a losing lever: it buys HP/DPS seconds and nothing more, and
   the pool needed for a fair fight would make you a sponge. Damage and
   accuracy are cut alongside the bigger health pool so a firefight lasts long
   enough to be a firefight, while a careless push still gets you killed. */
var DIFF = [
  { name:'RECRUIT',  react:[0.60,1.05], spread:3.4, dmg:0.30, aggro:0.7, burst:[2,4], acc:0.34, rof:1.35 },
  { name:'REGULAR',  react:[0.34,0.66], spread:2.2, dmg:0.40, aggro:0.9, burst:[3,6], acc:0.50, rof:1.18 },
  { name:'HARDENED', react:[0.22,0.44], spread:1.5, dmg:0.58, aggro:1.0, burst:[4,8], acc:0.66, rof:1.08 },
  { name:'VETERAN',  react:[0.13,0.28], spread:1.0, dmg:0.80, aggro:1.15,burst:[6,12],acc:0.84, rof:1.0 }
];

/* --------------------------------- math ---------------------------------- */
var TMP = new THREE.Vector3(), TMP2 = new THREE.Vector3();
function rnd(a,b){ return a + Math.random()*(b-a); }
function irnd(a,b){ return Math.floor(rnd(a,b+1)); }
function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
function lerp(a,b,t){ return a+(b-a)*t; }
function damp(a,b,l,dt){ return lerp(a,b,1-Math.exp(-l*dt)); }
function pick(a){ return a[Math.floor(Math.random()*a.length)]; }
function shuffle(a){ for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i];a[i]=a[j];a[j]=t; } return a; }

/* --------------------------------- audio --------------------------------- */
var AC=null, masterGain=null, noiseBuf=null;
function audioInit(){
  if(AC) return;
  try{
    var Ctx = window.AudioContext||window.webkitAudioContext; if(!Ctx) return;
    AC = new Ctx();
    masterGain = AC.createGain(); masterGain.gain.value = settings.vol; masterGain.connect(AC.destination);
    var len = AC.sampleRate*1.2; noiseBuf = AC.createBuffer(1,len,AC.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for(var i=0;i<len;i++) d[i] = Math.random()*2-1;
  }catch(e){ AC=null; }
}
function noise(dur,vol,type,freq,q,pan,decay){
  if(!AC) return;
  var s=AC.createBufferSource(); s.buffer=noiseBuf; s.loop=true;
  var f=AC.createBiquadFilter(); f.type=type||'lowpass'; f.frequency.value=freq||1200; f.Q.value=q||1;
  var g=AC.createGain(); var t=AC.currentTime;
  g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0008,t+(decay||dur));
  s.connect(f); f.connect(g);
  if(pan!==undefined && AC.createStereoPanner){ var p=AC.createStereoPanner(); p.pan.value=clamp(pan,-1,1); g.connect(p); p.connect(masterGain); }
  else g.connect(masterGain);
  s.start(t); s.stop(t+dur+0.05);
}
function tone(f0,f1,dur,vol,type,pan){
  if(!AC) return;
  var o=AC.createOscillator(); o.type=type||'square';
  var g=AC.createGain(); var t=AC.currentTime;
  o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(Math.max(1,f1),t+dur);
  g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0008,t+dur);
  o.connect(g);
  if(pan!==undefined && AC.createStereoPanner){ var p=AC.createStereoPanner(); p.pan.value=clamp(pan,-1,1); g.connect(p); p.connect(masterGain); }
  else g.connect(masterGain);
  o.start(t); o.stop(t+dur+0.02);
}
// spatialised gunshot: dist attenuation + stereo pan relative to camera
function shotAt(pos, cfg, own){
  if(!AC) return;
  var vol=1, pan=0;
  if(!own && pos){
    var d = pos.distanceTo(camera.position);
    vol = clamp(1 - d/70, 0, 1); vol *= vol;
    if(vol<0.02) return;
    TMP.copy(pos).sub(camera.position);
    var right = TMP2.set(1,0,0).applyQuaternion(camera.quaternion);
    pan = clamp(TMP.normalize().dot(right)*1.1, -1, 1);
  }
  var v = (own?0.5:0.42)*vol;
  noise(0.16, v*cfg.boom, 'lowpass', cfg.lp, 1.2, pan, 0.12);
  noise(0.09, v*0.55, 'highpass', 2200, 0.7, pan, 0.07);
  tone(cfg.crack, cfg.crack*0.25, 0.09, v*0.34, 'square', pan);
}
function sfx(n){
  if(!AC) return;
  switch(n){
    case 'hit':      tone(2100,1500,0.05,0.16,'square'); break;
    case 'kill':     tone(1500,900,0.10,0.19,'square'); break;
    case 'headshot': tone(2600,1200,0.13,0.21,'square'); break;
    case 'magout':   noise(0.07,0.16,'bandpass',900,3,0,0.06); break;
    case 'magin':    noise(0.07,0.20,'bandpass',700,3,0,0.05); tone(220,120,0.06,0.08,'square'); break;
    case 'bolt':     noise(0.05,0.16,'bandpass',1800,4,0,0.04); break;
    case 'swap':     noise(0.06,0.11,'bandpass',1300,3,0,0.05); break;
    case 'hurt':     tone(180,90,0.14,0.16,'sawtooth'); break;
    case 'death':    tone(300,60,0.55,0.22,'sawtooth'); noise(0.5,0.14,'lowpass',500,1,0,0.5); break;
    case 'spawn':    tone(420,700,0.16,0.12,'sine'); break;
    case 'streak':   tone(700,1400,0.14,0.17,'sine'); setTimeout(function(){tone(1050,1700,0.18,0.15,'sine');},110); break;
    case 'ui':       tone(900,1300,0.045,0.09,'sine'); break;
    case 'pin':      tone(1700,1200,0.06,0.15,'square'); break;
    case 'empty':    noise(0.045,0.14,'highpass',2600,2,0,0.04); break;
    case 'melee':    noise(0.12,0.24,'bandpass',420,1.4,0,0.1); tone(160,70,0.12,0.14,'sawtooth'); break;
    case 'levelup':  tone(600,900,0.14,0.16,'sine'); setTimeout(function(){tone(900,1350,0.24,0.16,'sine');},130); break;
    case 'jet':      noise(1.5,0.24,'bandpass',420,0.7,0,1.4); break;
    case 'siren':    tone(500,900,0.3,0.12,'sine'); break;
  }
}
function boomAt(pos, power){
  if(!AC) return;
  var d = pos.distanceTo(camera.position);
  var vol = clamp(1 - d/95, 0, 1); vol*=vol;
  if(vol<0.02) return;
  TMP.copy(pos).sub(camera.position);
  var right = TMP2.set(1,0,0).applyQuaternion(camera.quaternion);
  var pan = clamp(TMP.normalize().dot(right), -1, 1);
  noise(0.9, 0.75*vol*(power||1), 'lowpass', 260, 1, pan, 0.85);
  tone(110,26,0.6,0.4*vol*(power||1),'sine',pan);
}
