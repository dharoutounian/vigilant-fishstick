/* =====================================================================
   Main: the watch from dusk to dawn, input, camera, the loop
   ===================================================================== */

const G = {
  state: 'menu', paused: false, diff: 1, endless: false, best: 0,
  night: 0, nightT: 0, nightLen: 1, hp: CFG.HP, embers: 0, flares: 0,
  up: { gears: 0, lens: 0, aperture: 0, oil: 0 },
  stats: null, totals: null, fronts: [], schedule: [], si: 0,
  burning: 0, firstLit: false, warnedBase: false, tips: {}, snapshot: null,
  transT: 0, tod: 0, todFrom: 0, todTo: 0,
};
function freshStats() { return { kills: 0, embers: 0, seen: 0, damage: 0, flares: 0, byType: {} }; }
G.stats = freshStats(); G.totals = freshStats();

/* ---------- camera ---------- */
const camCtl = {
  mode: 'over', az: 0.75, el: 0.86, dist: 74, tAz: 0.75, tEl: 0.86, tDist: 74,
  focus: new THREE.Vector3(0, 2.5, 0), shake: 0,
  kYaw: 0.8, kPitch: -0.3,
};
function updateCamera(dt, time) {
  const c = camCtl;
  if (G.state === 'menu') {
    c.az += dt * 0.045; c.tAz = c.az;
    c.el = lerp(c.el, 0.34, dt * 0.8); c.dist = lerp(c.dist, 74, dt * 0.8);
  } else {
    c.az += wrapAngle(c.tAz - c.az) * clamp(dt * 8, 0, 1);
    c.el = lerp(c.el, c.tEl, clamp(dt * 6, 0, 1));
    c.dist = lerp(c.dist, c.tDist, clamp(dt * 6, 0, 1));
  }
  c.shake = Math.max(0, c.shake - dt * 1.5);
  const sk = c.shake * c.shake;
  if (c.mode === 'keeper' && G.state !== 'menu') {
    const fwd = new THREE.Vector3(Math.sin(c.kYaw), 0, Math.cos(c.kYaw));
    camera.position.copy(W.lampPos).addScaledVector(fwd, 3.0).add(new THREE.Vector3(0, 1.7, 0));
    const look = beamDir(c.kYaw, c.kPitch, new THREE.Vector3());
    camera.lookAt(camera.position.clone().add(look));
    camera.near = 0.3;
  } else {
    const ce = Math.cos(c.el), dist = c.dist * (camera.aspect < 0.8 ? 1.4 : 1);   // portrait screens stand further back
    camera.position.set(c.focus.x + Math.sin(c.az) * ce * dist, c.focus.y + Math.sin(c.el) * dist, c.focus.z + Math.cos(c.az) * ce * dist);
    camera.lookAt(c.focus);
  }
  if (sk > 0) camera.position.add(new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(sk * 0.8));
}
function setView(mode) {
  if (mode === camCtl.mode) return;
  camCtl.mode = mode;
  if (mode === 'keeper') {
    camCtl.kYaw = beam.tyaw; camCtl.kPitch = clamp(beam.tpitch, -1.2, 0.05);
    tryLock();
    log(input.locked ? 'Keeper’s view. Move the mouse to look; the lamp follows. V to step back.' :
      'Keeper’s view. Move the mouse or use the arrow keys to look; the lamp follows. V to step back.', 'tip');
  } else {
    if (document.pointerLockElement) { input.lockExitOk = true; document.exitPointerLock(); }
    // turn the overview to stand behind the beam
    camCtl.tAz = beam.yaw + Math.PI;
  }
  $('reticle').hidden = mode !== 'keeper';
  Sound.ui();
}

/* ---------- input ---------- */
const input = {
  nx: 0, ny: -0.2, has: false, touch: !!(window.matchMedia && matchMedia('(pointer: coarse)').matches), keys: {},
  focusKey: false, focusMouse: false, focusBtn: false, locked: false, lockExitOk: false,
  aim: new THREE.Vector3(), aimOk: false, inside: false,
};
function tryLock() {
  if (input.touch || !canvas.requestPointerLock) return;
  try {
    const r = canvas.requestPointerLock();
    if (r && r.catch) r.catch(() => {});
  } catch (e) { /* refused in sandboxed frames: free-look still works */ }
}
function initInput() {
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') input.touch = true;
    else if (e.pointerType === 'mouse') input.touch = false;
    if (e.target !== canvas && !input.locked && G.state !== 'night') return;
    input.inside = true;
    if (camCtl.mode === 'keeper' && (G.state === 'night' || G.state === 'dusk') && !G.paused) {
      const k = 0.0022 * settings.sens;
      let dx = e.movementX || 0, dy = e.movementY || 0;
      if (e.pointerType === 'touch') {   // drag to look
        dx = input.lx == null ? 0 : e.clientX - input.lx; dy = input.ly == null ? 0 : e.clientY - input.ly;
        input.lx = e.clientX; input.ly = e.clientY;
        dx *= 1.6; dy *= 1.6;
      }
      camCtl.kYaw = wrapAngle(camCtl.kYaw - dx * k);
      camCtl.kPitch = clamp(camCtl.kPitch - dy * k, -1.25, 0.08);
      if (e.pointerType === 'mouse' && !input.locked) { input.nx = e.clientX / innerWidth * 2 - 1; input.ny = -(e.clientY / innerHeight * 2 - 1); }
      return;
    }
    if (e.target !== canvas) return;
    input.nx = e.clientX / innerWidth * 2 - 1; input.ny = -(e.clientY / innerHeight * 2 - 1); input.has = true;
  });
  canvas.addEventListener('pointerleave', () => { input.inside = false; });
  canvas.addEventListener('pointerdown', (e) => {
    Sound.init();
    canvas.focus({ preventScroll: true });
    if (e.pointerType === 'touch') { input.touch = true; input.lx = e.clientX; input.ly = e.clientY; }
    if (camCtl.mode !== 'keeper') { input.nx = e.clientX / innerWidth * 2 - 1; input.ny = -(e.clientY / innerHeight * 2 - 1); input.has = true; }
    if (G.paused) return;
    if (G.state === 'day') { updateAimPoint(); updateShopPointer(input.aim, input.aimOk); shopClick(e.button); return; }
    if (G.state !== 'night' && G.state !== 'dusk') return;
    if (camCtl.mode === 'keeper' && !input.locked && e.pointerType === 'mouse') tryLock();
    if (e.pointerType === 'touch') return;     // touch aims; the on-screen buttons focus and throw
    if (e.button === 0) input.focusMouse = true;
    if (e.button === 2) flareAtAim();
  });
  addEventListener('pointerup', (e) => { if (e.button === 0) input.focusMouse = false; });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (camCtl.mode === 'over') camCtl.tDist = clamp(camCtl.tDist * (e.deltaY > 0 ? 1.1 : 0.9), 34, 120);
  }, { passive: false });
  document.addEventListener('pointerlockchange', () => {
    input.locked = document.pointerLockElement === canvas;
    if (!input.locked && camCtl.mode === 'keeper' && G.state === 'night' && !G.paused && !input.lockExitOk) setPaused(true);
    input.lockExitOk = false;
  });
  addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT')) return;
    const k = e.key.toLowerCase();
    if (k === 'escape' || k === 'p') {
      const t = UI.top();
      if (t === 'settings' || t === 'how') { UI.close(t); if (t === 'settings') savePrefs(); return; }
      if (G.state === 'day' && shop.mode && k === 'escape') { setShopMode(null); return; }
      if (G.paused) setPaused(false); else setPaused(true);
      return;
    }
    if (G.paused || G.state === 'menu') return;
    input.keys[k] = true;
    if (k === ' ' ) { input.focusKey = true; e.preventDefault(); }
    if (k === 'f' && G.state === 'night') flareAtAim();
    if (k === 'v' && (G.state === 'night' || G.state === 'dusk')) setView(camCtl.mode === 'over' ? 'keeper' : 'over');
    if (k.startsWith('arrow')) e.preventDefault();
  });
  addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase(); input.keys[k] = false;
    if (k === ' ') { input.focusKey = false; if (G.state === 'night' || G.state === 'dusk') e.preventDefault(); }
  });
  // the on-screen buttons never keep keyboard focus, so Space always means "focus the beam"
  $('acts').addEventListener('mousedown', (e) => e.preventDefault());
  addEventListener('blur', () => { input.keys = {}; input.focusKey = input.focusMouse = input.focusBtn = false; });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'night' && !G.paused) setPaused(true); });

  const fb = $('b-focus');
  const on = (e) => { e.preventDefault(); Sound.init(); input.focusBtn = true; try { fb.setPointerCapture(e.pointerId); } catch (_) {} };
  const off = () => { input.focusBtn = false; };
  fb.addEventListener('pointerdown', on); fb.addEventListener('pointerup', off); fb.addEventListener('pointercancel', off);
  fb.addEventListener('lostpointercapture', off);
  $('b-flare').addEventListener('click', () => { Sound.init(); if (G.state === 'night') flareAtAim(); });
  $('b-view').addEventListener('click', () => { Sound.init(); if (G.state === 'night' || G.state === 'dusk') setView(camCtl.mode === 'over' ? 'keeper' : 'over'); });
}
function updateAimPoint() {
  if (camCtl.mode === 'keeper') input.aimOk = pickGround(0, 0, input.aim);
  else input.aimOk = pickGround(input.nx, input.ny, input.aim);
}
function flareAtAim() {
  updateAimPoint();
  if (!input.aimOk) { Sound.deny(); return; }
  throwFlare(input.aim.x, input.aim.z);
}
function steerInput(dt) {
  const k = input.keys;
  if (camCtl.mode === 'over') {
    if (k.q || k.a) camCtl.tAz += dt * 1.4;
    if (k.e || k.d) camCtl.tAz -= dt * 1.4;
    if (k.w) camCtl.tDist = clamp(camCtl.tDist - dt * 40, 34, 120);
    if (k.s) camCtl.tDist = clamp(camCtl.tDist + dt * 40, 34, 120);
    if (k.r) camCtl.tEl = clamp(camCtl.tEl + dt * 0.8, 0.45, 1.3);
    if (k.t) camCtl.tEl = clamp(camCtl.tEl - dt * 0.8, 0.45, 1.3);
    if (G.state === 'night' || G.state === 'dusk') {
      updateAimPoint();
      if (input.has || input.touch) {
        const L = W.lampPos, ax = input.aim.x - L.x, az = input.aim.z - L.z, hd = Math.hypot(ax, az);
        if (hd > 1.2) beam.tyaw = Math.atan2(ax, az);
        beam.tpitch = clamp(Math.atan2(input.aim.y + 0.9 - L.y, Math.max(hd, 0.5)), -1.45, 0.05);
      }
    }
  } else {
    const r = 1.6 * settings.sens;
    if (k.arrowleft || k.a || k.q) camCtl.kYaw = wrapAngle(camCtl.kYaw + dt * r);
    if (k.arrowright || k.d || k.e) camCtl.kYaw = wrapAngle(camCtl.kYaw - dt * r);
    if (k.arrowup || k.w) camCtl.kPitch = clamp(camCtl.kPitch + dt * r * 0.6, -1.25, 0.08);
    if (k.arrowdown || k.s) camCtl.kPitch = clamp(camCtl.kPitch - dt * r * 0.6, -1.25, 0.08);
    if (!input.locked && !input.touch && input.inside) {   // free-look: the screen edges keep turning you
      const ex = Math.abs(input.nx) > 0.86 ? Math.sign(input.nx) * (Math.abs(input.nx) - 0.86) / 0.14 : 0;
      camCtl.kYaw = wrapAngle(camCtl.kYaw - ex * dt * 1.8 * settings.sens);
    }
    beam.tyaw = camCtl.kYaw; beam.tpitch = camCtl.kPitch;
  }
  beam.wantFocus = (input.focusKey || input.focusMouse || input.focusBtn) && G.state === 'night';
}

/* ---------- nights ---------- */
function nightLength(n) { return 75 + 10 * Math.min(n, 8) + Math.max(0, n - 8) * 4; }
function isStormy(n) { return n === 5 || n === 7 || (n > 7 && n % 2 === 1); }
function buildNight(n) {
  const D = DIFFS[G.diff], len = nightLength(n), end = len - 12;
  const nf = n === 1 ? 1 : n <= 3 ? 2 : n <= 5 ? 3 : 4;
  const a0 = Math.random() * TAU;
  G.fronts = Array.from({ length: nf }, (_, i) => wrapAngle(a0 + i * TAU / nf + rnd(-0.4, 0.4)));
  // the night comes in surges, each one larger than the last
  const k = 3 + Math.min(n, 9);
  const surges = Array.from({ length: k }, (_, i) => ({ t: 6 + (end - 12) * (i + rnd(0.1, 0.6)) / k, w: 1 + i / k }));
  const wsum = surges.reduce((a, s) => a + s.w, 0);
  const surge = () => { let r = Math.random() * wsum; for (const s of surges) { if ((r -= s.w) <= 0) return s; } return surges[k - 1]; };
  const at = () => surge().t + rnd(0, 7);
  const front = () => pick(G.fronts) + rnd(-0.45, 0.45);
  const cnt = (v) => Math.max(0, Math.round(v * D.count));
  const S = [];
  for (let i = 0; i < cnt(10 + 6 * n); i++) S.push({ t: at(), type: 'crawler', a: front() });
  if (n >= 2) for (let p = 0; p < cnt(n); p++) {
    const t = at(), a = front(), size = 3 + Math.floor(n / 2);
    for (let i = 0; i < size; i++) S.push({ t: t + i * 0.3, type: 'skitter', a: a + rnd(-0.1, 0.1) });
  }
  if (n >= 3) for (let i = 0; i < cnt(n - 2); i++) S.push({ t: at(), type: 'brute', a: front() });
  if (n >= 4) for (let i = 0; i < cnt(2 * (n - 3)); i++) S.push({ t: at(), type: 'snuffer', a: front() });
  if (n === CFG.NIGHTS || (n > CFG.NIGHTS && n % 3 === 1)) S.push({ t: len * 0.3, type: 'leviathan', a: G.fronts[0] });
  S.forEach(s => s.t = Math.min(s.t, end));
  S.sort((x, y) => x.t - y.t);
  G.schedule = S; G.si = 0; G.nightLen = len; G.nightT = 0;
  storm.on = isStormy(n); storm.next = rnd(5, 9);
}
function frontsText() {
  const names = [...new Set(G.fronts.map(compassName))];
  if (names.length === 1) return `They will come from the ${names[0]}.`;
  return `They will come from the ${names.slice(0, -1).join(', the ')} and the ${names[names.length - 1]}.`;
}

function saveSnapshot() {
  G.snapshot = {
    night: G.night, hp: G.hp, embers: G.embers, flares: G.flares, up: { ...G.up },
    structures: structures.filter(s => !s.isNew).map(s => ({ type: s.type, x: s.x, z: s.z, yaw: s.yaw })),
    totals: JSON.parse(JSON.stringify(G.totals)),
  };
}
function resetWorldState() {
  clearMonsters(); clearFlares(); collectOrbsNow(); FX.glow.clear(); FX.smoke.clear();
  while (structures.length) removeStructure(structures[0]);
  storm.on = false; storm.flash = 0;
  HUD.clearLog();
  beam.heat = 0; beam.overheat = false; beam.focus = 0;
}
function newGame(diff) {
  G.diff = diff; G.endless = false;
  resetWorldState();
  G.night = 0; G.hp = CFG.HP; G.embers = CFG.START_EMBERS; G.flares = CFG.START_FLARES;
  G.up = { gears: 0, lens: 0, aperture: 0, oil: 0 };
  G.stats = freshStats(); G.totals = freshStats(); G.tips = {};
  G.paused = false;
  setView('over');
  camCtl.tAz = camCtl.az; camCtl.tEl = 0.86; camCtl.tDist = 74;
  beginDusk();
}
function retryNight() {
  const s = G.snapshot; if (!s) { newGame(G.diff); return; }
  resetWorldState();
  G.night = s.night - 1; G.hp = s.hp; G.embers = s.embers; G.flares = s.flares; G.up = { ...s.up };
  G.totals = JSON.parse(JSON.stringify(s.totals)); G.stats = freshStats();
  s.structures.forEach(d => addStructure(d.type, d.x, d.z, d.yaw));
  setView('over');
  beginDusk();
}
function toTitle() {
  resetWorldState();
  closeShop();
  G.state = 'menu'; G.paused = false;
  setView('over');
  $('hud').hidden = true;
  beam.target = 1;
  animateTod(0, 1.5);
  UI.open('menu');
  if (G.best) $('menu-foot').textContent = `Your longest watch: ${G.best} night${G.best === 1 ? '' : 's'}. Mouse or touch to aim the beam.`;
}

/* compile every creature's shaders for tonight's lights now, so the first arrival doesn't stutter */
function prewarm() {
  const tmp = Object.keys(MON).map(t => { const m = makeMonsterMesh(t); m.root.position.set(0, -40, 0); return m; });
  try { renderer.compile(scene, camera); } catch (e) { /* drawing will compile them anyway */ }
  tmp.forEach(m => { scene.remove(m.root); m.mat.dispose(); m.glow.material.dispose(); });
}
function animateTod(to, secs) { G.todFrom = W.tod; G.todTo = to; G.todT = 0; G.todDur = secs; }

function beginDusk() {
  closeShop();
  G.night++;
  saveSnapshot();
  G.stats = freshStats();
  G.firstLit = false; G.warnedBase = false;
  buildNight(G.night);
  G.state = 'dusk'; G.transT = 0;
  $('hud').hidden = false;
  animateTod(0, 2.5);
  beam.target = 1;
  refillLanterns();
  prewarm();
  Sound.foghorn();
  const title = G.night > CFG.NIGHTS ? `Night ${G.night}` : `Night ${G.night}`;
  const sub = G.night === CFG.NIGHTS ? 'The last night. ' + frontsText() : frontsText();
  HUD.banner(title, sub);
  if (storm.on) setTimeout(() => log('A storm tonight. Each lightning flash holds them still for a moment.', 'tip'), 2600);
}
function beginNight() {
  G.state = 'night';
  if (G.night === 1) tipOnce('aim', input.touch ? 'Drag to swing the beam. It only turns as fast as its clockwork.'
    : 'Move the pointer to swing the beam. It only turns as fast as its clockwork.');
}
function beginDawn() {
  G.state = 'dawn'; G.transT = 0;
  beam.target = 0;
  animateTod(1, 4.5);
  Sound.dawn();
  HUD.banner('Dawn', `Night ${G.night} is over.`);
  // whatever is left burns in the sunrise
  monsters.forEach((m, i) => { m.dawnT = 0.4 + i * 0.07 + Math.random() * 0.6; });
  clearFlares();
  if (camCtl.mode === 'keeper') setView('over');
}
function toDay(afterWin) {
  G.state = 'day'; G.transT = 0;
  storm.on = false;
  collectOrbsNow();
  for (const k in G.stats) if (typeof G.stats[k] === 'number') G.totals[k] += G.stats[k];
  const bonus = Math.round((15 + 5 * G.night) * DIFFS[G.diff].embers);
  G.embers += bonus; G.flares += 1;
  refillLanterns();
  $('hud').hidden = true;
  animateTod(1, 0.5);
  camCtl.tEl = 1.0; camCtl.tDist = 78;
  const k = G.stats.kills;
  let note = afterWin ? 'The watch goes on. ' : '';
  note += (k === 0 ? 'Nothing burned in your light last night.' : k === 1 ? 'One of them burned away in the night.' : `${k} of them burned away in the night.`)
    + ` The keeper's allowance: ${bonus} embers and a fresh flare.`;
  if (G.night === 1) note += ' Lanterns hold back the dark near the tower while your beam works elsewhere.';
  openShop(note);
  G.stats = freshStats();
}
function loseGame() {
  G.state = 'over'; G.transT = 0;
  beam.target = 0;
  Sound.lightsOut();
  log('The lamp is out.', 'bad');
  if (camCtl.mode === 'keeper') setView('over');
  camCtl.tDist = 70; camCtl.tEl = 0.55;
  setTimeout(() => { if (G.state === 'over') showEnd('lost'); }, 2600);
}
function tipOnce(key, text) {
  if (G.tips[key]) return;
  G.tips[key] = true;
  log(text, 'tip');
}

function runSchedule() {
  while (G.si < G.schedule.length && G.schedule[G.si].t <= G.nightT) {
    const s = G.schedule[G.si++];
    const m = spawnMonster(s.type, s.a);
    if (G.night === 1 && G.stats.seen === 1) log(`Something has come out of the water to the ${compassName(s.a)}. It can only move in the dark.`, 'tip');
    if (s.type === 'brute') tipOnce('brute', 'A hulk. Smaller things hide in its shadow, and it takes a long time to burn.');
    if (s.type === 'snuffer') tipOnce('snuffer', 'A snuffer. It ignores lanterns and goes to put them out. Only the beam, reflectors and flares hold it.');
    if (s.type === 'leviathan') { HUD.banner('Something vast', `is rising to the ${compassName(s.a)}.`); Sound.roar(panFor(new THREE.Vector3(m.x, 0, m.z))); camCtl.shake = 0.7; }
  }
}
function nightTips() {
  if (G.night !== 1 && G.night !== 2) return;
  if (G.firstLit) tipOnce('burn', 'Hold the light on it and it burns away.');
  if (G.nightT > 28 || (G.tips.burn && G.stats.kills >= 2)) tipOnce('focus', input.touch
    ? 'Hold Focus for a narrow beam that burns far hotter, until the lens overheats.'
    : 'Hold the left button or Space to focus: a narrow beam that burns far hotter, until the lens overheats.');
  if (G.nightT > 48) tipOnce('flare', input.touch ? 'Tap Flare to throw one where you aim. It holds back everything near it.'
    : 'Right-click or press F to throw a flare where you aim. It holds back everything near it.');
  if (!G.tips.shadow && Math.random() < 0.05) {
    for (const m of monsters) {
      if (m.state !== 'walk' || m.held) continue;
      const py = m.y + m.def.size * 0.75, L = W.lampPos;
      _v.set(m.x - L.x, py - L.y, m.z - L.z);
      const d = _v.length(), ang = Math.acos(clamp(_v.dot(beam.dir) / d, -1, 1));
      if (ang < beam.angle * 0.9 && inShadow(m.x, py, m.z, m)) {
        tipOnce('shadow', 'It is moving in a rock’s shadow. Your light can’t reach behind cover.');
        break;
      }
    }
  }
}

/* ---------- the fixed-step simulation ---------- */
const STEP = 1 / 60;
let simTime = 0;
function tick(dt) {
  simTime += dt;
  // time of day transitions
  if (G.todDur) {
    G.todT += dt;
    const k = smoothstep(0, 1, G.todT / G.todDur);
    setTimeOfDay(lerp(G.todFrom, G.todTo, k));
    if (G.todT >= G.todDur) G.todDur = 0;
  }
  if (G.state === 'menu') {
    beam.tyaw = wrapAngle(beam.tyaw + dt * 0.55); beam.tpitch = -0.22 + Math.sin(simTime * 0.3) * 0.08;
    beam.target = 1; beam.wantFocus = false;
  } else steerInput(dt);
  updateBeam(dt);
  updateStorm(dt);
  updateStructures(dt, simTime);

  if (G.state === 'dusk') {
    G.transT += dt;
    if (G.transT > 2.5) beginNight();
  } else if (G.state === 'night') {
    G.nightT += dt;
    runSchedule();
    updateMonsters(dt);
    nightTips();
    if (G.hp <= 0) { loseGame(); }
    else if (G.nightT >= G.nightLen) beginDawn();
  } else if (G.state === 'dawn') {
    G.transT += dt;
    for (let i = monsters.length - 1; i >= 0; i--) {
      const m = monsters[i];
      m.held = true; m.dmgRate = 1; m.burn = 1;
      m.dawnT -= dt;
      if (m.dawnT <= 0) killMonster(m, false);
    }
    if (G.transT > 5) {
      if (G.night === CFG.NIGHTS && !G.endless) { G.state = 'won'; collectOrbsNow(); for (const k in G.stats) if (typeof G.stats[k] === 'number') G.totals[k] += G.stats[k]; G.stats = freshStats(); showEnd('won'); }
      else toDay(false);
    }
  } else if (G.state === 'over') {
    G.transT += dt;
    // with the light gone, they come on freely
    beam.target = 0;
    updateMonsters(dt);
  }
  if (G.state !== 'menu') updateFlares(dt, simTime);
  updateOrbs(dt);
  Sound.ambience({ storm: storm.on, burning: G.burning || 0, flares: flares.some(f => f.burning), lamp: beam.power > 0.3, focus: beam.focus });
}

/* ---------- rendering ---------- */
const PERF = { fps: 0, acc: 0, n: 0 };
function render(dt, time) {
  W.uTime.value = time;
  W.starU.pr.value = renderer.getPixelRatio();
  updateCamera(dt, time);
  updateSkyFollow();
  renderBeam(time);
  renderMonsters(time, G.paused ? 0 : dt);
  FX.glow.update(G.paused ? 0 : dt); FX.smoke.update(G.paused ? 0 : dt);
  if (W.boat) { W.boat.position.y = 0.12 + Math.sin(time * 1.1) * 0.12; W.boat.rotation.z = Math.sin(time * 0.9) * 0.06; }
  // lightning lights the whole sky and island for an instant
  const fl = flashLevel();
  skyU.flash.value = fl;
  W.hemiBase = W.hemi.intensity;
  if (fl > 0) { W.hemi.intensity += fl * 2.2; W.skyLight.intensity += fl * 2.5; }
  if (G.state === 'day') updateAimPoint(), updateShopPointer(input.aim, input.aimOk && input.has);
  if (G.state !== 'menu' && G.state !== 'day') HUD.update(dt);
  renderer.render(scene, camera);
  if (fl > 0) { W.hemi.intensity = W.hemiBase; W.skyLight.intensity -= fl * 2.5; }
}

let lastT = 0, acc = 0, booted = false;
function frame(nowMs) {
  requestAnimationFrame(frame);
  const now = nowMs / 1000;
  let dt = lastT ? now - lastT : STEP; lastT = now;
  if (dt > 0.25) dt = 0.25;
  PERF.acc += dt; PERF.n++;
  if (PERF.acc > 1) { PERF.fps = PERF.n / PERF.acc; PERF.acc = 0; PERF.n = 0; }
  if (!G.paused) {
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 15) { tick(STEP); acc -= STEP; n++; }
    if (n === 15) acc = 0;
  }
  render(dt, now);
}

function boot() {
  try {
    initRenderer();
    initWorld();
    initLight();
    buildModels();
    HUD.init();
    initShop();
    initInput();
    initMenus();
    applyQuality();
    beam.power = 1; beam.target = 1;
    setTimeOfDay(0);
    prewarm();
  } catch (e) {
    console.error(e);
    $('err-msg').textContent = 'This browser could not start WebGL, which the game needs to draw the island. ' + (e && e.message ? '(' + e.message + ')' : '');
    $('err').hidden = false; $('menu').hidden = true;
    return;
  }
  UI.stack = ['menu'];
  booted = true;
  requestAnimationFrame(frame);
}

/* hooks for the automated tests */
window.__LH = {
  G, CFG, MON, W, beam, monsters, structures, flares, storm, camCtl, input, shop, settings, UPG,
  newGame, beginDusk, beginNight, beginDawn, toDay, retryNight, toTitle, spawnMonster, killMonster, addStructure, removeStructure,
  throwFlare, clearFlares, beamHits, inShadow, mirrorHits, lanternHolding, buy, shopClick, setShopMode, updateShopPointer, placementValid,
  setView, setPaused, terrainH, tick, pickGround, worldToScreen, camera: () => camera, flashLevel,
  step(sec) { const n = Math.round(sec / STEP); for (let i = 0; i < n; i++) tick(STEP); },
  aim(yaw, pitch) { beam.yaw = beam.tyaw = yaw; beam.pitch = beam.tpitch = pitch; beamDir(yaw, pitch, beam.dir); input.has = false; },
  pitchToGround(x, z) { const L = W.lampPos; return Math.atan2(groundY(x, z) + 0.9 - L.y, Math.hypot(x - L.x, z - L.z)); },
  get booted() { return booted; },
};

boot();
