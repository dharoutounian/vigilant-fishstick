'use strict';
/* =====================================================================
   LIGHTHOUSE - core: helpers, tuning tables, procedural audio
   ===================================================================== */

const TAU = Math.PI * 2, DEG = Math.PI / 180;
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(e0, e1, x) { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }
function wrapAngle(a) { a %= TAU; if (a > Math.PI) a -= TAU; else if (a < -Math.PI) a += TAU; return a; }
function rnd(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
function mulberry32(s) {
  return function () {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const mapRand = mulberry32(1847);   // the island is the same every time
const $ = (id) => document.getElementById(id);

/* ---------- tuning ---------- */
const CFG = {
  NIGHTS: 7,
  HP: 100,
  BASE_R: 3.3,           // lighthouse footprint radius at the ground
  LAMP_ABOVE: 16.6,      // lamp height above the plinth base
  RANGE: 52,             // how far the beam is strong enough to hold them, metres from the lamp
  SPAWN_R: 61,
  SHORE: 44,
  FOCUS_DMG: 2.6,        // damage multiplier while focused
  FOCUS_NARROW: 0.5,     // cone angle multiplier while focused
  HEAT_UP: 1 / 3.6,      // full heat after 3.6 s of focus
  HEAT_DOWN: 1 / 2.4,
  HEAT_RESUME: 0.35,     // an overheated lens must cool to this before focusing again
  BASE_DPS: 0.85,
  FLARE_R: 9, FLARE_T: 7, FLARE_DPS: 0.35, FLARE_REACH: 50, FLARE_MAX_LIVE: 2,
  LANTERN_R: 6.5, LANTERN_MAX: 6, LANTERN_COST: 25,
  MIRROR_MAX: 2, MIRROR_COST: 60, MIRROR_RANGE: 34, MIRROR_ANGLE: 9 * DEG,
  MIRROR_PITCH: -9 * DEG, MIRROR_H: 2.4, MIRROR_DMG: 0.55,
  FLARE_PACK: 2, FLARE_PACK_COST: 20,
  REPAIR_HP: 25, REPAIR_COST: 20,
  START_EMBERS: 30, START_FLARES: 2,
  NIGHT_START_HOUR: 20, NIGHT_END_HOUR: 30,   // 8 pm to 6 am
};

const UPGRADES = [
  { id: 'gears', name: 'Clockwork', desc: 'The lamp turns faster.', vals: [70, 100, 135, 180], costs: [40, 85, 150],
    fmt: v => v + '°/s' },
  { id: 'lens', name: 'Fresnel prisms', desc: 'The beam burns hotter.', vals: [1, 1.4, 1.85, 2.4], costs: [50, 100, 170],
    fmt: v => '×' + v },
  { id: 'aperture', name: 'Lens order', desc: 'A larger lens widens the beam.', vals: [11, 13, 15.5, 18], costs: [45, 90, 150],
    fmt: (v, i) => ['Fourth', 'Third', 'Second', 'First'][i] + ' order' },
  { id: 'oil', name: 'Paraffin', desc: 'Lanterns hold back the dark for longer.', vals: [30, 50, 80, 120], costs: [30, 60, 100],
    fmt: v => v + 's of oil' },
];
const UPG = {}; UPGRADES.forEach(u => UPG[u.id] = u);

const DIFFS = [
  { name: 'Calm seas', hp: 0.75, speed: 0.9, count: 0.8, dmg: 0.7, embers: 1.15 },
  { name: 'Squall', hp: 1.0, speed: 1.0, count: 1.0, dmg: 1.0, embers: 1.0 },
  { name: 'Tempest', hp: 1.3, speed: 1.1, count: 1.25, dmg: 1.3, embers: 0.9 },
];

/* hp is seconds of the plain beam; dmg is lighthouse damage per second while clawing */
const MON = {
  crawler:   { name: 'drowned',   hp: 3.0,  speed: 3.8, dmg: 3,  size: 1.25, reward: 3,  radius: 0.65 },
  skitter:   { name: 'skitter',   hp: 0.8,  speed: 7.0, dmg: 1.5, size: 0.8, reward: 1, radius: 0.42 },
  brute:     { name: 'hulk',      hp: 13,   speed: 2.3, dmg: 9,  size: 2.3, reward: 10, radius: 1.25, occluder: true },
  snuffer:   { name: 'snuffer',   hp: 2.2,  speed: 4.8, dmg: 2,  size: 1.15, reward: 4,  radius: 0.55, float: 1.5, ignoresLanterns: true },
  leviathan: { name: 'leviathan', hp: 90,   speed: 1.25, dmg: 20, size: 5.2, reward: 80, radius: 3.2, occluder: true },
};

/* ---------- procedural audio ---------- */
const Sound = (function () {
  let ctx = null, master = null, sfx = null, amb = null;
  let white = null, brown = null;
  const loops = {};
  let vol = 0.8, lastTick = 0;
  const throttle = {};

  function makeNoise(kind) {
    const len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else d[i] = w;
    }
    return buf;
  }
  function loop(buf, type, freq, q) {
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 0.7;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(amb); src.start();
    return { src, f, g };
  }
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { ctx = null; return; }
    master = ctx.createGain(); master.gain.value = vol;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
    master.connect(comp); comp.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.gain.value = 0.9; sfx.connect(master);
    amb = ctx.createGain(); amb.gain.value = 0.8; amb.connect(master);
    white = makeNoise('white'); brown = makeNoise('brown');
    loops.ocean = loop(brown, 'lowpass', 500, 0.5);
    loops.surf = loop(white, 'bandpass', 900, 0.4);
    loops.wind = loop(white, 'bandpass', 480, 2.5);
    loops.rain = loop(white, 'highpass', 3000, 0.5);
    loops.sizzle = loop(white, 'bandpass', 3400, 1.2);
    loops.crackle = loop(white, 'bandpass', 1500, 3);
    // the lamp's hum: two low partials through a lowpass
    const hf = ctx.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 260;
    const hg = ctx.createGain(); hg.gain.value = 0; hf.connect(hg); hg.connect(amb);
    [55, 110.4, 165.2].forEach((fr, i) => {
      const o = ctx.createOscillator(); o.type = i === 0 ? 'sine' : 'sawtooth'; o.frequency.value = fr;
      const og = ctx.createGain(); og.gain.value = i === 0 ? 0.7 : 0.12; o.connect(og); og.connect(hf); o.start();
    });
    loops.hum = { g: hg, f: hf };
  }
  function now() { return ctx ? ctx.currentTime : 0; }
  function setVolume(v) { vol = v; if (master) master.gain.setTargetAtTime(v, now(), 0.05); }
  function ok(key, gap) {
    if (!ctx) return false;
    const t = performance.now();
    if (key && throttle[key] && t - throttle[key] < gap) return false;
    if (key) throttle[key] = t;
    return true;
  }
  function out(pan, gain) {
    const g = ctx.createGain(); g.gain.value = gain;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner(); p.pan.value = clamp(pan || 0, -1, 1); g.connect(p); p.connect(sfx);
    } else g.connect(sfx);
    return g;
  }
  function envGain(dest, t0, a, peak, d) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    g.connect(dest);
    return g;
  }
  function noiseHit(dest, t0, dur, type, freq, q, a, peak, rate) {
    const s = ctx.createBufferSource(); s.buffer = white; s.playbackRate.value = rate || 1;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = envGain(dest, t0, a, peak, dur);
    s.connect(f); f.connect(g); s.start(t0, Math.random() * 2); s.stop(t0 + a + dur + 0.05);
    return f;
  }
  function tone(dest, t0, type, f0, f1, a, peak, dur) {
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + a + dur);
    const g = envGain(dest, t0, a, peak, dur);
    o.connect(g); o.start(t0); o.stop(t0 + a + dur + 0.05);
    return o;
  }

  const api = {
    init, setVolume,
    get ready() { return !!ctx; },
    ambience(p) {
      if (!ctx) return;
      const t = now(), k = 0.25;
      const swell = 0.5 + 0.5 * Math.sin(t * 0.37) * Math.sin(t * 0.13 + 1);
      loops.ocean.g.gain.setTargetAtTime(0.32 + 0.22 * swell, t, k);
      loops.surf.g.gain.setTargetAtTime(0.04 + 0.07 * swell, t, k);
      loops.surf.f.frequency.setTargetAtTime(700 + 600 * swell, t, k);
      loops.wind.g.gain.setTargetAtTime((p.storm ? 0.16 : 0.05) * (0.6 + 0.4 * Math.sin(t * 0.21)), t, 0.8);
      loops.wind.f.frequency.setTargetAtTime(380 + 260 * Math.sin(t * 0.17), t, 0.8);
      loops.rain.g.gain.setTargetAtTime(p.storm ? 0.09 : 0, t, 1.0);
      loops.sizzle.g.gain.setTargetAtTime(Math.min(0.22, p.burning * 0.05), t, 0.08);
      loops.crackle.g.gain.setTargetAtTime(p.flares ? 0.12 : 0, t, 0.15);
      loops.hum.g.gain.setTargetAtTime(p.lamp ? 0.05 + 0.09 * p.focus : 0, t, 0.15);
      loops.hum.f.frequency.setTargetAtTime(220 + 500 * p.focus, t, 0.1);
    },
    gearTick(speed) {     // clockwork ratchet while the lamp turns
      if (!ctx || speed < 0.05) return;
      const t = performance.now();
      if (t - lastTick < clamp(140 / speed, 35, 400)) return;
      lastTick = t;
      const t0 = now();
      noiseHit(out(0, 0.12), t0, 0.03, 'bandpass', 2400 + Math.random() * 600, 6, 0.001, 0.6);
    },
    splash(pan, v) {
      if (!ok('splash', 90)) return;
      const t0 = now(), o = out(pan, v);
      noiseHit(o, t0, 0.5, 'lowpass', 900, 0.6, 0.01, 0.8);
      noiseHit(o, t0 + 0.05, 0.25, 'bandpass', 2500, 1, 0.01, 0.3);
    },
    groan(pan, v, pitch) {
      if (!ok('groan', 260)) return;
      const t0 = now(), o = out(pan, v);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700 * pitch; f.Q.value = 4; f.connect(o);
      tone(f, t0, 'sawtooth', 120 * pitch, 70 * pitch, 0.12, 0.6, 0.9);
      tone(f, t0, 'sawtooth', 123 * pitch, 66 * pitch, 0.15, 0.45, 0.9);
    },
    screech(pan, v, pitch) {
      if (!ok('screech', 160)) return;
      const t0 = now(), o = out(pan, v);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800 * pitch; f.Q.value = 3; f.connect(o);
      const osc = tone(f, t0, 'sawtooth', 900 * pitch, 520 * pitch, 0.02, 0.5, 0.45);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 38; const lg = ctx.createGain(); lg.gain.value = 90 * pitch;
      lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t0); lfo.stop(t0 + 0.6);
      noiseHit(o, t0, 0.35, 'highpass', 3000, 0.7, 0.01, 0.25);
    },
    puff(pan, v, big) {
      if (!ok('puff', 40)) return;
      const t0 = now(), o = out(pan, v);
      noiseHit(o, t0, big ? 0.9 : 0.35, 'lowpass', big ? 500 : 1400, 0.8, 0.005, big ? 1.2 : 0.7);
      noiseHit(o, t0, 0.2, 'highpass', 4000, 0.7, 0.002, 0.25);
      tone(o, t0, 'sine', big ? 90 : 220, big ? 40 : 90, 0.005, 0.5, big ? 0.6 : 0.18);
    },
    chime(i) {
      if (!ok('chime', 45)) return;
      const t0 = now(), o = out(0, 0.16);
      const f = 660 * Math.pow(2, (Math.min(i, 12) * 2) / 12);
      tone(o, t0, 'sine', f, f, 0.005, 0.5, 0.5);
      tone(o, t0, 'sine', f * 2, f * 2, 0.005, 0.15, 0.25);
    },
    thud(v) {
      if (!ok('thud', 220)) return;
      const t0 = now(), o = out(0, v);
      tone(o, t0, 'sine', 70, 38, 0.005, 0.9, 0.35);
      noiseHit(o, t0, 0.3, 'lowpass', 320, 1, 0.005, 0.8);
      noiseHit(o, t0 + 0.04, 0.5, 'bandpass', 160, 8, 0.05, 0.25, 0.4);   // creak
    },
    foghorn() {
      if (!ctx) return;
      const t0 = now(), o = out(0, 0.5);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520; f.Q.value = 2; f.connect(o);
      [[110, 0.5], [82.4, 0.42], [164.8, 0.12]].forEach(([fr, p]) => {
        const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = fr;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(p, t0 + 0.35); g.gain.setValueAtTime(p, t0 + 2.3);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.4);
        osc.connect(g); g.connect(f); osc.start(t0); osc.stop(t0 + 3.5);
      });
    },
    dawn() {
      if (!ctx) return;
      const t0 = now(), o = out(0, 0.22);
      [261.6, 329.6, 392, 523.3, 659.3].forEach((fr, i) => {
        tone(o, t0 + i * 0.18, 'sine', fr, fr, 0.4, 0.35, 2.6);
        tone(o, t0 + i * 0.18, 'triangle', fr * 2, fr * 2, 0.4, 0.06, 2.0);
      });
    },
    thunder(delay, v) {
      if (!ctx) return;
      const t0 = now() + delay, o = out(rnd(-0.5, 0.5), v);
      noiseHit(o, t0, 2.6, 'lowpass', 260, 0.9, 0.04, 1.2, 0.5);
      noiseHit(o, t0, 0.5, 'lowpass', 1200, 0.7, 0.01, 0.6);
    },
    flareLaunch() {
      if (!ok('flare', 100)) return;
      const t0 = now(), o = out(0, 0.35);
      const f = noiseHit(o, t0, 0.9, 'bandpass', 600, 2, 0.02, 0.8);
      f.frequency.exponentialRampToValueAtTime(2400, t0 + 0.8);
      tone(o, t0 + 0.9, 'sine', 180, 60, 0.005, 0.4, 0.2);
    },
    hiss(pan, v) {
      if (!ok('hiss', 120)) return;
      const t0 = now(), o = out(pan, v);
      noiseHit(o, t0, 0.8, 'highpass', 2600, 0.6, 0.02, 0.7);
      tone(o, t0, 'sine', 160, 50, 0.005, 0.4, 0.3);
    },
    crack() {
      if (!ctx) return;
      const t0 = now(), o = out(0, 0.5);
      noiseHit(o, t0, 0.12, 'highpass', 1800, 0.7, 0.001, 1.0);
      noiseHit(o, t0 + 0.05, 1.4, 'highpass', 3500, 0.5, 0.05, 0.4);
    },
    roar(pan) {
      if (!ctx) return;
      const t0 = now(), o = out(pan, 0.7);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; f.Q.value = 3; f.connect(o);
      tone(f, t0, 'sawtooth', 70, 38, 0.3, 0.9, 2.2);
      tone(f, t0, 'sawtooth', 73, 41, 0.35, 0.7, 2.2);
      noiseHit(o, t0, 2.0, 'lowpass', 300, 1, 0.3, 0.6);
    },
    ui() {
      if (!ok('ui', 50)) return;
      const t0 = now(); tone(out(0, 0.1), t0, 'triangle', 880, 660, 0.002, 0.4, 0.08);
    },
    place() {
      if (!ctx) return;
      const t0 = now(), o = out(0, 0.35);
      tone(o, t0, 'sine', 150, 80, 0.003, 0.8, 0.2);
      noiseHit(o, t0, 0.15, 'lowpass', 900, 1, 0.003, 0.5);
    },
    coin() {
      if (!ctx) return;
      const t0 = now(), o = out(0, 0.16);
      tone(o, t0, 'triangle', 988, 988, 0.003, 0.5, 0.12);
      tone(o, t0 + 0.07, 'triangle', 1318, 1318, 0.003, 0.5, 0.3);
    },
    deny() {
      if (!ok('deny', 120)) return;
      const t0 = now(); tone(out(0, 0.15), t0, 'square', 180, 150, 0.003, 0.3, 0.14);
    },
    lightsOut() {
      if (!ctx) return;
      const t0 = now(), o = out(0, 0.6);
      noiseHit(o, t0, 1.5, 'lowpass', 400, 1, 0.01, 1.0);
      tone(o, t0, 'sine', 220, 40, 0.01, 0.6, 2.4);
    },
  };
  return api;
})();
