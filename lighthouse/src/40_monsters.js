/* =====================================================================
   The things from the sea: models, behaviour, burning, embers
   ===================================================================== */

const monsters = [];
let monsterSeq = 0;

/* merge simple shapes into one geometry so each creature is a handful of draw calls */
function part(geo, px, py, pz, rx, ry, rz, sx, sy, sz) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  const m = new THREE.Matrix4().compose(new THREE.Vector3(px, py, pz),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)),
    new THREE.Vector3(sx == null ? 1 : sx, sy == null ? (sx == null ? 1 : sx) : sy, sz == null ? (sx == null ? 1 : sx) : sz));
  g.applyMatrix4(m);
  return g;
}
function merge(parts) {
  let n = 0; parts.forEach(g => n += g.attributes.position.count);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  parts.forEach(g => { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; g.dispose(); });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.computeBoundingSphere();
  return out;
}
const SPH = new THREE.SphereGeometry(1, 12, 9), SPH_LO = new THREE.SphereGeometry(1, 8, 6);
const CONE = new THREE.ConeGeometry(1, 1, 6), CYL = new THREE.CylinderGeometry(1, 1, 1, 7);
/* a tapered limb hanging down from its pivot, with a knuckle at the end */
function limbGeo(len, r0, r1, bend) {
  // upper segment hangs from the pivot; the lower one swings from the joint by `bend`
  const up = len * 0.55, lo = len * 0.5, jy = -up;
  const cb = Math.cos(bend), sb = Math.sin(bend);
  const a = part(new THREE.CylinderGeometry(r1, r0, up, 6), 0, -up / 2, 0);
  const j = part(SPH_LO, 0, jy, 0, 0, 0, 0, r1 * 1.15);
  const b = part(new THREE.CylinderGeometry(r1 * 0.75, r1, lo, 6), 0, jy - lo / 2 * cb, -lo / 2 * sb, bend, 0, 0);
  const k = part(SPH_LO, 0, jy - lo * cb, -lo * sb, 0, 0, 0, r1 * 1.3);
  return merge([a, j, b, k]);
}

const MODELS = {};
function buildModels() {
  // drowned: a hunched, wet crawler on four long limbs
  MODELS.crawler = {
    body: merge([
      part(SPH, 0, 0.78, 0.05, -0.25, 0, 0, 0.42, 0.34, 0.62),
      part(SPH, 0, 0.72, -0.42, 0, 0, 0, 0.33, 0.3, 0.36),
      part(SPH, 0, 0.84, 0.66, 0.2, 0, 0, 0.22, 0.2, 0.28),
      part(CONE, 0, 0.76, 0.9, Math.PI / 2, 0, 0, 0.12, 0.3, 0.12),
      ...[0, 1, 2, 3].map(i => part(CONE, 0, 1.06 - i * 0.04, 0.3 - i * 0.24, -0.4, 0, 0, 0.06, 0.22, 0.06)),
    ]),
    eyes: [[-0.1, 0.9, 0.86, 0.045], [0.1, 0.9, 0.86, 0.045]],
    limbs: [
      { p: [-0.3, 0.86, 0.38], geo: limbGeo(1.0, 0.08, 0.05, -0.6), off: 0, splay: 0.35 },
      { p: [0.3, 0.86, 0.38], geo: null, off: Math.PI, splay: -0.35 },
      { p: [-0.28, 0.74, -0.45], geo: limbGeo(0.82, 0.09, 0.05, 0.7), off: Math.PI, splay: 0.3 },
      { p: [0.28, 0.74, -0.45], geo: null, off: 0, splay: -0.3 },
    ],
    color: 0x1b2024, eye: 0xffcf6a, gait: 7, swing: 0.75,
  };
  // skitter: small, low and many-legged
  MODELS.skitter = {
    body: merge([
      part(SPH, 0, 0.42, 0, 0, 0, 0, 0.36, 0.22, 0.5),
      part(SPH, 0, 0.42, 0.44, 0, 0, 0, 0.2, 0.16, 0.2),
      part(SPH, 0, 0.5, -0.5, 0.3, 0, 0, 0.26, 0.2, 0.34),
    ]),
    eyes: [[-0.08, 0.5, 0.6, 0.035], [0.08, 0.5, 0.6, 0.035], [-0.05, 0.56, 0.57, 0.025], [0.05, 0.56, 0.57, 0.025]],
    limbs: [-1, 1].flatMap(s => [0.25, 0, -0.25].map((z, i) => ({
      p: [s * 0.3, 0.46, z], geo: limbGeo(0.62, 0.04, 0.025, 0.9), off: (i + (s > 0 ? 1 : 0)) * Math.PI, splay: s * 1.0, sweep: true }))),
    color: 0x1c1a1c, eye: 0xff6a4a, gait: 15, swing: 0.5,
  };
  // hulk: a heavy knuckle-walker with a spiny back
  MODELS.brute = {
    body: merge([
      part(SPH, 0, 1.1, 0.1, -0.35, 0, 0, 0.62, 0.55, 0.62),
      part(SPH, 0, 1.25, 0.3, 0, 0, 0, 0.52, 0.42, 0.45),
      part(SPH, 0, 0.82, -0.42, 0, 0, 0, 0.42, 0.38, 0.38),
      part(SPH, 0, 1.12, 0.72, 0.2, 0, 0, 0.22, 0.2, 0.24),
      part(CONE, 0, 0.98, 0.86, Math.PI / 2 + 0.3, 0, 0, 0.14, 0.3, 0.14),
      ...[0, 1, 2, 3, 4].map(i => part(CONE, 0, 1.7 - i * 0.1, 0.4 - i * 0.22, -0.5, 0, 0, 0.1, 0.4, 0.1)),
    ]),
    eyes: [[-0.09, 1.18, 0.9, 0.04], [0.09, 1.18, 0.9, 0.04]],
    limbs: [
      { p: [-0.55, 1.35, 0.32], geo: limbGeo(1.45, 0.17, 0.11, -0.35), off: 0, splay: 0.22 },
      { p: [0.55, 1.35, 0.32], geo: null, off: Math.PI, splay: -0.22 },
      { p: [-0.3, 0.75, -0.5], geo: limbGeo(0.78, 0.14, 0.09, 0.4), off: Math.PI, splay: 0.12 },
      { p: [0.3, 0.75, -0.5], geo: null, off: 0, splay: -0.12 },
    ],
    color: 0x1e2022, eye: 0xffa040, gait: 4, swing: 0.55, castShadow: true,
  };
  // snuffer: a drifting shroud that hunts lanterns
  const cloak = new THREE.ConeGeometry(0.55, 1.7, 12, 5, true);
  const cp = cloak.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const y = cp.getY(i);
    if (y < -0.5) {
      const k = Math.sin(i * 12.989) * 43758.5; const r = k - Math.floor(k);
      cp.setY(i, y - r * 0.5); cp.setX(i, cp.getX(i) * (1 + r * 0.3)); cp.setZ(i, cp.getZ(i) * (1 + r * 0.3));
    }
  }
  cloak.computeVertexNormals();
  MODELS.snuffer = {
    body: merge([part(cloak, 0, 0.1, 0), part(SPH, 0, 0.95, 0.05, 0, 0, 0, 0.3, 0.33, 0.3)]),
    eyes: [[-0.09, 0.95, 0.3, 0.05], [0.09, 0.95, 0.3, 0.05]],
    limbs: [], color: 0x0f1216, eye: 0xc4ecff, gait: 2, swing: 0, translucent: true,
  };
  // leviathan: what the sea sends last
  MODELS.leviathan = {
    body: merge([
      part(SPH, 0, 1.0, 0, -0.2, 0, 0, 0.7, 0.62, 0.95),
      part(SPH, 0, 1.25, 0.62, 0, 0, 0, 0.48, 0.4, 0.42),
      part(SPH, 0, 1.05, 1.0, 0.25, 0, 0, 0.28, 0.24, 0.3),
      part(CONE, -0.24, 1.38, 0.9, 0.9, 0, 0.5, 0.06, 0.4, 0.06),
      part(CONE, 0.24, 1.38, 0.9, 0.9, 0, -0.5, 0.06, 0.4, 0.06),
      ...[0, 1, 2, 3, 4, 5].map(i => part(CONE, 0, 1.65 - i * 0.05, 0.4 - i * 0.25, -0.6, 0, 0, 0.09, 0.42, 0.09)),
    ]),
    eyes: [[-0.15, 1.18, 1.22, 0.04], [0.15, 1.18, 1.22, 0.04], [-0.24, 1.26, 1.12, 0.035], [0.24, 1.26, 1.12, 0.035],
           [-0.11, 1.3, 1.18, 0.03], [0.11, 1.3, 1.18, 0.03], [-0.3, 1.12, 1.05, 0.03], [0.3, 1.12, 1.05, 0.03]],
    limbs: [
      { p: [-0.6, 1.25, 0.4], geo: limbGeo(1.35, 0.15, 0.09, -0.4), off: 0, splay: 0.3 },
      { p: [0.6, 1.25, 0.4], geo: null, off: Math.PI, splay: -0.3 },
      ...[-1, 1].flatMap(s => [0, 1, 2].map(i => ({ p: [s * 0.45, 0.8, -0.2 - i * 0.35], geo: limbGeo(1.1 + i * 0.1, 0.09, 0.04, 0.9),
        off: i * 1.3 + (s > 0 ? 0.6 : 0), splay: s * (0.9 + i * 0.2), sweep: true, tentacle: true }))),
    ],
    color: 0x1a1d21, eye: 0xffe27a, gait: 2.4, swing: 0.4, castShadow: true,
  };
  for (const k in MODELS) {
    const M = MODELS[k];
    let prev = null;
    M.limbs.forEach(l => { if (l.geo) prev = l.geo; else l.geo = prev; });
    M.eyeGeo = merge(M.eyes.map(e => part(SPH_LO, e[0], e[1], e[2], 0, 0, 0, e[3])));
    M.eyeMat = new THREE.MeshBasicMaterial({ color: M.eye, toneMapped: false, fog: false });
  }
}

/* burning shows as heat at the silhouette, the way a coal glows at its edges */
function burnShader(sh) {
  sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
    float rim = 1.0 - abs(dot(normal, normalize(vViewPosition)));
    totalEmissiveRadiance *= 0.12 + 2.4 * pow(rim, 2.5);`);
}
function makeMonsterMesh(type) {
  const M = MODELS[type], def = MON[type];
  const mat = new THREE.MeshStandardMaterial({ color: col(M.color), roughness: M.translucent ? 0.9 : 0.36, metalness: 0.0,
    emissive: col(0xff5a1c), emissiveIntensity: 0, transparent: !!M.translucent, opacity: M.translucent ? 0.88 : 1,
    side: M.translucent ? THREE.DoubleSide : THREE.FrontSide });
  mat.onBeforeCompile = burnShader;
  const root = new THREE.Group(), inner = new THREE.Group(); root.add(inner);
  const body = new THREE.Mesh(M.body, mat); inner.add(body);
  const eyes = new THREE.Mesh(M.eyeGeo, M.eyeMat); inner.add(eyes);
  const limbs = M.limbs.map(l => {
    const piv = new THREE.Group(); piv.position.set(l.p[0], l.p[1], l.p[2]);
    const mesh = new THREE.Mesh(l.geo, mat); piv.add(mesh);
    piv.rotation.z = l.splay * (l.sweep ? 1 : 0.5);
    inner.add(piv);
    return { piv, l };
  });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: M.eye, blending: THREE.AdditiveBlending,
    depthWrite: false, transparent: true, toneMapped: false, fog: false, opacity: 0.8 }));
  const e0 = M.eyes[0];
  glow.position.set(0, e0[1], e0[2] + 0.05); glow.scale.setScalar(0.6);
  inner.add(glow);
  inner.scale.setScalar(def.size);
  const cast = !!M.castShadow;
  root.traverse(o => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = false; } });
  scene.add(root);
  return { root, inner, body, mat, limbs, glow, eyes };
}

/* angle convention: the direction (sin a, cos a); north is -z */
const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
function compassName(a) {
  const brg = wrapAngle(Math.PI - a);
  return COMPASS[((Math.round(brg / (Math.PI / 4)) % 8) + 8) % 8];
}

function spawnMonster(type, a, opts) {
  opts = opts || {};
  const def = MON[type], D = DIFFS[G.diff];
  const r = opts.r != null ? opts.r : CFG.SPAWN_R + rnd(0, 4);
  const x = opts.x != null ? opts.x : Math.sin(a) * r, z = opts.z != null ? opts.z : Math.cos(a) * r;
  const nightScale = 1 + Math.max(0, G.night - CFG.NIGHTS) * 0.12;   // endless watch keeps getting harder
  const hp = def.hp * D.hp * nightScale * (type === 'leviathan' ? 1 + (G.night > CFG.NIGHTS ? 0.3 : 0) : 1);
  const m = {
    id: ++monsterSeq, type, def, x, z, y: -5, yaw: Math.atan2(-x, -z),
    hp, maxHp: hp, speed: def.speed * D.speed * rnd(0.92, 1.08), dmg: def.dmg * D.dmg,
    state: opts.fall ? 'walk' : 'emerge', t: 0, phase: Math.random() * TAU, moving: 0,
    held: false, burn: 0, dmgRate: 0, dead: false, litOnce: false, spawnAcc: 0, attackT: 0,
    jx: 0, jz: 0, target: null, bob: Math.random() * TAU,
  };
  Object.assign(m, makeMonsterMesh(type));
  m.y = standY(m) - (m.state === 'emerge' ? def.size * 1.8 : 0);
  monsters.push(m);
  if (m.state === 'emerge') {
    const pan = panFor(new THREE.Vector3(x, 0, z));
    Sound.splash(pan, type === 'leviathan' ? 0.9 : 0.25);
    if (Math.random() < 0.5 || type !== 'skitter') Sound.groan(pan, type === 'brute' ? 0.4 : 0.22, type === 'brute' ? 0.7 : type === 'skitter' ? 1.6 : 1);
    for (let i = 0; i < 10; i++) FX.smoke.emit(x + rnd(-1, 1), 0.2, z + rnd(-1, 1), rnd(-1, 1), rnd(1.5, 3.5), rnd(-1, 1), 0.8, 0.4, 1.2, 0.6, 0.66, 0.7, 0.45, 6, 0.5);
  }
  G.stats.seen++;
  return m;
}
function standY(m) {
  const h = terrainH(m.x, m.z);
  return Math.max(h, -0.55 * m.def.size) + (m.def.float || 0);
}
function removeMonster(m) {
  scene.remove(m.root);
  m.mat.dispose(); m.glow.material.dispose();
  const i = monsters.indexOf(m); if (i >= 0) monsters.splice(i, 1);
}
function clearMonsters() { while (monsters.length) removeMonster(monsters[0]); }

/* ---------- behaviour ---------- */
function snufferTarget(m) {
  let best = null, bd = 1e9;
  for (const s of structures) {
    if (s.type !== 'lantern' || s.oil <= 0) continue;
    const d = Math.hypot(s.x - m.x, s.z - m.z);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

function updateMonsters(dt) {
  const flash = flashLevel() > 0.5;
  const dps = beamDps();
  let burning = 0;
  for (let i = monsters.length - 1; i >= 0; i--) {
    const m = monsters[i], def = m.def;
    if (m.dead) continue;
    m.t += dt;
    const py = m.y + def.size * 0.75;
    // still under the water: no light reaches it yet
    if (m.state === 'emerge') {
      m.held = false; m.byBeam = false; m.dmgRate = 0;
      m.t2 = (m.t2 || 0) + dt;
      if (m.t2 > 1.3) m.state = 'walk';
      m.y = standY(m) - def.size * 1.8 * (1 - smoothstep(0, 1.3, m.t2));
      m.moving = 0;
      continue;
    }
    // who is holding it?
    const byBeam = beamHits(m.x, py, m.z, def.radius, m);
    let byMirror = 0;
    for (const s of structures) if (s.type === 'mirror' && mirrorHits(s, m.x, py, m.z, def.radius)) byMirror++;
    const byFlare = flareHolding(m);
    const lantern = def.ignoresLanterns ? null : lanternHolding(m);
    m.held = byBeam || byMirror > 0 || byFlare || !!lantern || flash;
    m.byBeam = byBeam; m.byLantern = !!lantern;
    m.dmgRate = (byBeam ? dps : 0) + Math.min(byMirror, 2) * dps * CFG.MIRROR_DMG + (byFlare ? CFG.FLARE_DPS : 0);
    if (lantern && !byBeam && !byMirror && !byFlare) lantern.oil = Math.max(0, lantern.oil - dt);

    if (m.dmgRate > 0) {
      m.hp -= m.dmgRate * dt;
      burning++;
      if (!m.litOnce) {
        m.litOnce = true;
        Sound.screech(panFor(new THREE.Vector3(m.x, m.y, m.z)), m.type === 'brute' || m.type === 'leviathan' ? 0.3 : 0.16,
          m.type === 'skitter' ? 1.5 : m.type === 'brute' ? 0.6 : m.type === 'leviathan' ? 0.4 : 1);
        G.firstLit = true;
      }
      if (Math.random() < dt * 30 * Math.min(2, m.dmgRate)) emitEmbers(m.x, py, m.z, 1, def.size * 0.35, 1);
      if (Math.random() < dt * 8) emitSmoke(m.x, py + def.size * 0.3, m.z, 1, def.size * 0.3, true);
      if (m.hp <= 0) { killMonster(m, true); continue; }
    }
    m.burn += clamp((m.dmgRate > 0 ? 1 : 0) - m.burn, -dt * 2.5, dt * 6);

    if (m.held) { m.moving = 0; m.y = standY(m); continue; }

    // the leviathan sheds skitters while it is in the dark
    if (m.type === 'leviathan') {
      m.spawnAcc += dt;
      if (m.spawnAcc > 9) {
        m.spawnAcc = 0;
        for (let k = 0; k < 3; k++) {
          const a = rnd(0, TAU);
          spawnMonster('skitter', 0, { x: m.x + Math.sin(a) * 3, z: m.z + Math.cos(a) * 3, fall: true });
        }
        Sound.roar(panFor(new THREE.Vector3(m.x, 0, m.z)));
      }
    }

    // where to go
    let tx = 0, tz = 0, reach = CFG.BASE_R + def.radius * 0.7;
    if (m.type === 'snuffer') {
      if (!m.target || m.target.oil <= 0 || structures.indexOf(m.target) < 0) m.target = snufferTarget(m);
      if (m.target) { tx = m.target.x; tz = m.target.z; reach = 1.0; }
    }
    let dx = tx - m.x, dz = tz - m.z, dist = Math.hypot(dx, dz);
    if (dist <= reach) {
      if (m.type === 'snuffer' && m.target) {
        m.target.oil = 0; m.target.out = true;
        Sound.hiss(panFor(new THREE.Vector3(m.x, 0, m.z)), 0.35);
        emitSmoke(m.target.x, m.target.y + 2.1, m.target.z, 16, 0.3, true);
        log('A snuffer has put out a lantern.', 'bad');
        m.target = null;
        continue;
      }
      m.state = 'attack';
      m.attackT += dt;
      m.moving = 0.5;
      const dmg = m.dmg * dt;
      G.hp = Math.max(0, G.hp - dmg);
      G.stats.damage += dmg;
      HUD.hurt(m);
      continue;
    }
    m.state = 'walk';
    let ux = dx / dist, uz = dz / dist, sx = ux, sz = uz;
    const R = def.radius;
    for (const o of W.obstacles) {
      const ax = m.x - o.x, az = m.z - o.z, d = Math.hypot(ax, az), clear = o.r + R + 2.4;
      if (d > clear || d < 1e-3) continue;
      const w = (clear - d) / clear;
      if (-(ax * ux + az * uz) > 0) {
        let px = -az / d, pz = ax / d;
        if (px * ux + pz * uz < 0) { px = -px; pz = -pz; }
        sx += px * w * 2.4; sz += pz * w * 2.4;
      }
      sx += ax / d * w * 0.6; sz += az / d * w * 0.6;
    }
    for (const s of structures) {   // walk around lantern posts and reflectors
      if (m.type === 'snuffer' && s === m.target) continue;
      const ax = m.x - s.x, az = m.z - s.z, d = Math.hypot(ax, az), clear = 0.6 + R + 1.2;
      if (d < clear && d > 1e-3) { const w = (clear - d) / clear; sx += ax / d * w * 1.2; sz += az / d * w * 1.2; }
    }
    const sl = Math.hypot(sx, sz) || 1; sx /= sl; sz /= sl;
    const wet = terrainH(m.x, m.z) < -0.2 && !def.float ? 0.62 : 1;
    const sp = m.speed * wet * (m.type === 'skitter' ? (0.75 + 0.25 * Math.sin(m.t * 9 + m.phase)) : 1);
    m.x += sx * sp * dt; m.z += sz * sp * dt;
    m.moving = sp;
    // turn toward travel
    const want = Math.atan2(sx, sz);
    m.yaw += wrapAngle(want - m.yaw) * clamp(dt * 6, 0, 1);
    // stay out of rocks and the tower
    for (const o of W.obstacles) {
      const ax = m.x - o.x, az = m.z - o.z, d = Math.hypot(ax, az), min = o.r + R;
      if (d < min && d > 1e-4) { m.x = o.x + ax / d * min; m.z = o.z + az / d * min; }
    }
    m.y = standY(m);
  }
  // keep them from stacking: only the free ones get pushed
  for (let i = 0; i < monsters.length; i++) {
    const a = monsters[i];
    if (a.dead || a.state === 'emerge') continue;
    for (let j = i + 1; j < monsters.length; j++) {
      const b = monsters[j];
      if (b.dead || b.state === 'emerge') continue;
      if (!!a.def.float !== !!b.def.float) continue;
      const dx = b.x - a.x, dz = b.z - a.z, min = (a.def.radius + b.def.radius) * 0.95;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min || d2 < 1e-6) continue;
      const d = Math.sqrt(d2), push = (min - d) * 0.5;
      const ux = dx / d, uz = dz / d;
      const fa = a.held ? 0 : (b.held ? 2 : 1), fb = b.held ? 0 : (a.held ? 2 : 1);
      a.x -= ux * push * fa; a.z -= uz * push * fa; b.x += ux * push * fb; b.z += uz * push * fb;
    }
  }
  G.burning = burning;
}

function killMonster(m, reward) {
  m.dead = true;
  const y = m.y + m.def.size * 0.7, big = m.def.size > 1.5;
  emitEmbers(m.x, y, m.z, big ? 70 : 26, m.def.size * 0.4, 1.4);
  emitSmoke(m.x, y, m.z, big ? 24 : 9, m.def.size * 0.4, true);
  for (let i = 0; i < (big ? 30 : 12); i++)
    FX.glow.emit(m.x, y, m.z, rnd(-5, 5), rnd(1, 6), rnd(-5, 5), rnd(0.3, 0.6), 0.25, 0.05, 1, 0.8, 0.5, 1, 9, 1.5);
  Sound.puff(panFor(new THREE.Vector3(m.x, m.y, m.z)), big ? 0.6 : 0.3, big);
  if (reward) {
    G.stats.kills++;
    G.stats.byType[m.type] = (G.stats.byType[m.type] || 0) + 1;
    const val = Math.max(1, Math.round(m.def.reward * DIFFS[G.diff].embers));
    spawnOrb(m.x, y, m.z, val);
    if (m.type === 'leviathan') { log('The leviathan burns, and the sea goes quiet.', 'tip'); HUD.banner('It is gone', 'The leviathan burned in your light.'); }
  }
  removeMonster(m);
}

/* ---------- embers that fly home to the lamp ---------- */
const orbs = [];
let orbCombo = 0, orbComboT = 0;
function spawnOrb(x, y, z, val) {
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xff9a40, blending: THREE.AdditiveBlending,
    depthWrite: false, transparent: true, toneMapped: false, fog: false }));
  spr.scale.setScalar(1.2 + Math.min(val, 20) * 0.08); spr.position.set(x, y, z);
  scene.add(spr);
  orbs.push({ spr, x, y, z, t: 0, dur: 1.0 + Math.hypot(x, z) / 60, val, cx: x * 0.5, cy: y + 10 + Math.random() * 4, cz: z * 0.5 });
}
function updateOrbs(dt) {
  orbComboT -= dt; if (orbComboT <= 0) orbCombo = 0;
  const L = W.lampPos;
  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i]; o.t += dt;
    const k = smoothstep(0, 1, Math.min(1, o.t / o.dur)), u = 1 - k;
    const px = u * u * o.x + 2 * u * k * o.cx + k * k * L.x;
    const py = u * u * o.y + 2 * u * k * o.cy + k * k * L.y;
    const pz = u * u * o.z + 2 * u * k * o.cz + k * k * L.z;
    o.spr.position.set(px, py, pz);
    if (Math.random() < 0.6) FX.glow.emit(px, py, pz, 0, 0, 0, 0.35, 0.3, 0.02, 1, 0.55, 0.2, 0.8, 0, 0);
    if (o.t >= o.dur) {
      scene.remove(o.spr); o.spr.material.dispose(); orbs.splice(i, 1);
      G.embers += o.val; G.stats.embers += o.val;
      Sound.chime(orbCombo++); orbComboT = 1.2;
      HUD.bump('c-embers');
    }
  }
}
function collectOrbsNow() {
  for (const o of orbs) { scene.remove(o.spr); o.spr.material.dispose(); G.embers += o.val; G.stats.embers += o.val; }
  orbs.length = 0;
}

/* ---------- drawing ---------- */
function renderMonsters(time, dt) {
  for (const m of monsters) {
    const M = MODELS[m.type];
    let jx = 0, jz = 0;
    if (m.held && m.state !== 'emerge') {
      const k = m.dmgRate > 0 ? 0.06 : 0.025;
      jx = (Math.random() - 0.5) * k * m.def.size; jz = (Math.random() - 0.5) * k * m.def.size;
    }
    let y = m.y;
    if (m.def.float) { m.bob += dt * 2; y += Math.sin(m.bob) * 0.18; }
    m.root.position.set(m.x + jx, y, m.z + jz);
    m.root.rotation.y = m.yaw;
    if (m.moving > 0) m.phase += dt * M.gait * clamp(m.moving / m.def.speed, 0.4, 1.6);
    const sw = M.swing * (m.moving > 0 ? 1 : 0.15);
    for (const L of m.limbs) {
      const s = Math.sin(m.phase + L.l.off);
      if (L.l.tentacle) { L.piv.rotation.x = Math.sin(time * 2 + L.l.off) * 0.5; L.piv.rotation.y = Math.sin(time * 1.3 + L.l.off) * 0.4; }
      else if (L.l.sweep) { L.piv.rotation.y = s * sw; L.piv.rotation.x = Math.max(0, Math.cos(m.phase + L.l.off)) * -0.3 * sw; }
      else L.piv.rotation.x = s * sw + (m.state === 'attack' && L.l.p[2] > 0 ? Math.sin(time * 8 + L.l.off) * 0.6 - 0.5 : 0);
    }
    // body bob and the lunge of a clawing attack
    const bob = m.moving > 0 ? Math.abs(Math.sin(m.phase)) * 0.05 : 0;
    m.inner.position.y = bob * m.def.size;
    m.inner.rotation.x = m.state === 'attack' ? Math.sin(time * 8 + m.id) * 0.12 + 0.1 : (m.held ? -0.12 : 0);
    if (m.type === 'snuffer') m.inner.rotation.z = Math.sin(time * 1.7 + m.id) * 0.12;
    // burning shows as heat glowing through the skin; damage makes it brighter
    const dmgFrac = 1 - m.hp / m.maxHp;
    const fl = 0.75 + 0.25 * Math.sin(time * 40 + m.id * 3);
    m.mat.emissiveIntensity = m.burn * fl * (0.35 + 1.3 * dmgFrac);
    // eyes: blink now and then, flare when burning
    const blink = (Math.sin(time * 0.7 + m.id * 2.3) > 0.985) ? 0.1 : 1;
    m.eyes.scale.y = blink;
    m.glow.material.opacity = (m.held ? 0.35 : 0.85) * blink;
    m.glow.scale.setScalar(m.held ? 0.45 : 0.62);
  }
}
