/* =====================================================================
   Light: the beam, reflectors, lanterns, flares, lightning, particles.
   One rule runs the game: whatever is lit cannot move. The tests below
   use the same cone, radius and shadow geometry that the renderer draws,
   so what looks lit is lit.
   ===================================================================== */

/* ---------- particles ---------- */
class Particles {
  constructor(max, additive) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3); this.alpha = new Float32Array(max); this.size = new Float32Array(max);
    this.life = new Float32Array(max); this.life0 = new Float32Array(max);
    this.s0 = new Float32Array(max); this.s1 = new Float32Array(max); this.a0 = new Float32Array(max);
    this.grav = new Float32Array(max); this.drag = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('color', this.aCol);
    g.setAttribute('alpha', this.aAlpha); g.setAttribute('size', this.aSize);
    g.setDrawRange(0, 0);
    this.u = { scale: { value: 400 }, map: { value: TEX.dot } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, toneMapped: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `attribute vec3 color; attribute float alpha; attribute float size; uniform float scale;
        varying vec3 vC; varying float vA;
        void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_Position = projectionMatrix * mv; gl_PointSize = max(1.0, size * scale / -mv.z); }`,
      fragmentShader: `uniform sampler2D map; varying vec3 vC; varying float vA;
        void main(){ float a = texture2D(map, gl_PointCoord).a * vA; if (a < 0.004) discard; gl_FragColor = vec4(vC, a); }`,
    });
    this.points = new THREE.Points(g, mat); this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 5 : 4;
    scene.add(this.points);
  }
  emit(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, grav, drag) {
    if (this.n >= this.max) return;
    const i = this.n++, j = i * 3;
    this.pos[j] = x; this.pos[j + 1] = y; this.pos[j + 2] = z;
    this.vel[j] = vx; this.vel[j + 1] = vy; this.vel[j + 2] = vz;
    this.col[j] = r; this.col[j + 1] = g; this.col[j + 2] = b;
    this.life[i] = this.life0[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = a;
    this.grav[i] = grav || 0; this.drag[i] = drag || 0;
    this.size[i] = s0; this.alpha[i] = a;
  }
  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.kill(i); continue; }
      const j = i * 3, k = 1 - this.life[i] / this.life0[i], dr = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[j] *= dr; this.vel[j + 2] *= dr; this.vel[j + 1] = this.vel[j + 1] * dr - this.grav[i] * dt;
      this.pos[j] += this.vel[j] * dt; this.pos[j + 1] += this.vel[j + 1] * dt; this.pos[j + 2] += this.vel[j + 2] * dt;
      this.size[i] = lerp(this.s0[i], this.s1[i], k);
      this.alpha[i] = this.a0[i] * (k < 0.1 ? k / 0.1 : 1 - (k - 0.1) / 0.9);
      i++;
    }
    const g = this.points.geometry; g.setDrawRange(0, this.n);
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aAlpha.needsUpdate = this.aSize.needsUpdate = true;
    this.u.scale.value = renderer.domElement.height * 0.5 / Math.tan(camera.fov * DEG / 2);
  }
  kill(i) {
    const l = --this.n;
    if (i !== l) {
      const j = i * 3, m = l * 3;
      for (let c = 0; c < 3; c++) { this.pos[j + c] = this.pos[m + c]; this.vel[j + c] = this.vel[m + c]; this.col[j + c] = this.col[m + c]; }
      this.alpha[i] = this.alpha[l]; this.size[i] = this.size[l]; this.life[i] = this.life[l]; this.life0[i] = this.life0[l];
      this.s0[i] = this.s0[l]; this.s1[i] = this.s1[l]; this.a0[i] = this.a0[l]; this.grav[i] = this.grav[l]; this.drag[i] = this.drag[l];
    }
  }
  clear() { this.n = 0; }
}
let FX = null;   // { glow: additive Particles, smoke: alpha Particles }

function emitEmbers(x, y, z, n, spread, up) {
  for (let i = 0; i < n; i++) {
    const h = Math.random();
    FX.glow.emit(x + rnd(-spread, spread), y + rnd(-spread, spread) * 0.6, z + rnd(-spread, spread),
      rnd(-1.2, 1.2), rnd(0.6, 2.4) * (up || 1), rnd(-1.2, 1.2), rnd(0.6, 1.4), rnd(0.12, 0.22), 0.04,
      1.0, lerp(0.35, 0.7, h), lerp(0.08, 0.25, h), 1, -0.6, 0.9);
  }
}
function emitSmoke(x, y, z, n, spread, dark) {
  for (let i = 0; i < n; i++) {
    const c = dark ? rnd(0.02, 0.06) : rnd(0.16, 0.24);
    FX.smoke.emit(x + rnd(-spread, spread), y, z + rnd(-spread, spread), rnd(-0.3, 0.3), rnd(0.6, 1.5), rnd(-0.3, 0.3),
      rnd(1.2, 2.4), rnd(0.4, 0.7), rnd(1.4, 2.4), c, c, c * 1.1, dark ? 0.55 : 0.3, -0.1, 0.6);
  }
}

/* a ring that follows the ground, for radii */
function groundRing(r, width, segs, colorHex, opacity) {
  const pos = new Float32Array((segs + 1) * 2 * 3), idx = [];
  for (let i = 0; i <= segs; i++) {
    idx.push(...(i < segs ? [i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2] : []));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }));
  m.userData = { r, width, segs }; m.renderOrder = 3; m.frustumCulled = false;
  return m;
}
function placeGroundRing(m, x, z, r) {
  const u = m.userData; if (r != null) u.r = r;
  const p = m.geometry.attributes.position;
  for (let i = 0; i <= u.segs; i++) {
    const a = i / u.segs * TAU, ca = Math.cos(a), sa = Math.sin(a);
    for (let k = 0; k < 2; k++) {
      const rr = u.r + (k ? u.width / 2 : -u.width / 2), px = x + ca * rr, pz = z + sa * rr;
      p.setXYZ(i * 2 + k, px, Math.max(terrainH(px, pz), 0.05) + 0.12, pz);
    }
  }
  p.needsUpdate = true;
  m.geometry.computeBoundingSphere();
}

/* ---------- volumetric cone (the visible shaft of light in the sea mist) ---------- */
function makeShaft(colorHex) {
  const g = new THREE.CylinderGeometry(1, 0, 1, 48, 20, true);
  g.translate(0, 0.5, 0); g.rotateX(Math.PI / 2);   // apex at origin, opening along +z
  const u = { uColor: { value: new THREE.Color(colorHex) }, uStrength: { value: 1 }, uTime: W.uTime };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    toneMapped: false, fog: false,
    vertexShader: `varying float vT; varying vec3 vW; varying vec3 vN; varying vec3 vV;
      void main(){ vT = position.z; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uStrength, uTime; varying float vT; varying vec3 vW; varying vec3 vN; varying vec3 vV;
      void main(){
        float edge = abs(dot(normalize(vN), normalize(vV)));
        float a = uStrength * pow(1.0 - vT, 1.5) * smoothstep(0.0, 0.05, vT);
        a *= 0.6 * edge + 0.8 * pow(edge, 6.0);
        float n = sin(vW.x * 0.33 + uTime * 0.5) * sin(vW.z * 0.29 - uTime * 0.37) * sin(vW.y * 0.6 + uTime * 0.23);
        a *= 0.78 + 0.22 * n;
        a *= smoothstep(-0.6, 0.9, vW.y);
        gl_FragColor = vec4(uColor, clamp(a, 0.0, 1.0));
      }`,
  });
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 6;
  m.userData.u = u;
  scene.add(m);
  return m;
}
function aimShaft(m, origin, dir, len, angle) {
  m.position.copy(origin);
  const r = len * Math.tan(angle);
  m.scale.set(r, r, len);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
}

/* ---------- the beam ---------- */
const beam = {
  yaw: 0.8, pitch: -0.32, tyaw: 0.8, tpitch: -0.32, vyaw: 0,
  focus: 0, wantFocus: false, heat: 0, overheat: false,
  power: 0, target: 0,        // power eases toward target: lamp lit or out
  dir: new THREE.Vector3(), angle: 11 * DEG, hitLen: 40,
};
function beamDir(yaw, pitch, out) {
  return out.set(Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw));
}
function baseAngle() { return UPG.aperture.vals[G.up.aperture] * DEG; }
function turnRate() { return UPG.gears.vals[G.up.gears] * DEG; }
function beamDps() { return CFG.BASE_DPS * UPG.lens.vals[G.up.lens] * lerp(1, CFG.FOCUS_DMG, beam.focus) * beam.power; }

function initBeam() {
  const s = new THREE.SpotLight(0xffe2b4, 0, CFG.RANGE + 9, 11 * DEG, 0.25, 0.9);
  s.castShadow = true;
  s.shadow.camera.near = 2;
  s.shadow.bias = -0.0006; s.shadow.normalBias = 0.04;
  s.position.copy(W.lampPos);
  scene.add(s); scene.add(s.target);
  beam.light = s;
  applyShadowQuality();
  beam.shaft = makeShaft(0xffdc9e);
  beam.flareSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, blending: THREE.AdditiveBlending, depthWrite: false,
    depthTest: false, transparent: true, toneMapped: false, fog: false, color: 0xfff0d0 }));
  beam.flareSprite.position.copy(W.lampPos); beam.flareSprite.renderOrder = 9;
  scene.add(beam.flareSprite);
  beamDir(beam.yaw, beam.pitch, beam.dir);
}
function applyShadowQuality() {
  const sz = QUALITY[settings.quality].shadow, sh = beam.light.shadow;
  if (sh.mapSize.x !== sz) {
    sh.mapSize.set(sz, sz);
    if (sh.map) { sh.map.dispose(); sh.map = null; }
  }
}

function updateBeam(dt) {
  // power: the lamp warming up or guttering out
  beam.power += clamp(beam.target - beam.power, -dt * 1.6, dt * 0.9);
  // lens heat and focus
  if (beam.overheat) {
    beam.heat -= CFG.HEAT_DOWN * dt * 0.8;
    if (beam.heat <= CFG.HEAT_RESUME) beam.overheat = false;
  }
  const focusing = beam.wantFocus && !beam.overheat && beam.power > 0.5;
  if (focusing) {
    beam.heat += CFG.HEAT_UP * dt;
    if (beam.heat >= 1) { beam.heat = 1; beam.overheat = true; onOverheat(); }
  } else if (!beam.overheat) beam.heat = Math.max(0, beam.heat - CFG.HEAT_DOWN * dt);
  beam.focus += clamp((focusing ? 1 : 0) - beam.focus, -dt * 5, dt * 7);

  // the clockwork: yaw and tilt chase the aim at a limited rate, easing in at the end
  const rate = turnRate();
  const dy = wrapAngle(beam.tyaw - beam.yaw);
  const stepY = clamp(dy, -rate * dt, rate * dt) * clamp(Math.abs(dy) * 10, 0.25, 1);
  beam.yaw = wrapAngle(beam.yaw + stepY);
  beam.vyaw = stepY / Math.max(dt, 1e-4);
  const dp = beam.tpitch - beam.pitch;
  beam.pitch += clamp(dp, -rate * 0.75 * dt, rate * 0.75 * dt) * clamp(Math.abs(dp) * 10, 0.25, 1);
  beamDir(beam.yaw, beam.pitch, beam.dir);
  beam.angle = baseAngle() * lerp(1, CFG.FOCUS_NARROW, beam.focus);
  if (G.state === 'night' && beam.power > 0.5) Sound.gearTick(Math.abs(beam.vyaw) / rate);
}
function onOverheat() {
  Sound.crack();
  emitSmoke(W.lampPos.x, W.lampPos.y + 1.2, W.lampPos.z, 14, 1.2, false);
  if (G.state === 'night') log('The lens is too hot to focus. Let it cool.', 'bad');
  HUD.heatFlash = 1;
}

/* where the beam's axis meets the ground, for drawing the shaft */
function beamGroundDistance() {
  const L = W.lampPos, d = beam.dir;
  if (d.y > -0.02) return CFG.RANGE + 6;
  let h = 0.5, t = 0;
  for (let i = 0; i < 4; i++) {
    t = (L.y - h) / -d.y;
    h = Math.max(terrainH(L.x + d.x * t, L.z + d.z * t), 0);
  }
  return Math.min(CFG.RANGE + 6, t);
}

function renderBeam(time) {
  const p = beam.power, s = beam.light;
  const flick = p < 0.99 ? (0.7 + 0.3 * Math.sin(time * 37) * Math.sin(time * 13)) : 1;
  const hot = beam.focus;
  s.color.setRGB(1, lerp(0.86, 0.95, hot), lerp(0.66, 0.88, hot));
  s.intensity = p * flick * lerp(4.2, 8.5, hot);
  s.angle = Math.max(beam.angle / 0.94, 1 * DEG);
  s.target.position.copy(W.lampPos).addScaledVector(beam.dir, 20);
  s.target.updateMatrixWorld();
  const len = Math.min(CFG.RANGE + 6, beamGroundDistance() * 1.18);
  beam.hitLen = len;
  aimShaft(beam.shaft, W.lampPos, beam.dir, len, beam.angle * 0.98);
  const su = beam.shaft.userData.u;
  su.uStrength.value = p * flick * lerp(0.75, 1.15, hot) * (camCtl.mode === 'keeper' ? 0.32 : 1);
  su.uColor.value.setRGB(1, lerp(0.84, 0.96, hot), lerp(0.58, 0.85, hot));
  beam.shaft.visible = p > 0.01;
  W.lampCage.rotation.y = beam.yaw; W.lampTilt.rotation.x = -beam.pitch;
  W.lampCore.material.color.setRGB(lerp(0.25, 1, p), lerp(0.2, 0.95, p), lerp(0.16, 0.85, p));
  W.lampLight.intensity = lerp(0.15, 1.6, p) * flick;
  W.glass.material.emissiveIntensity = 0.05 + 0.3 * p;
  // glare: the lamp flares when the beam swings toward the eye
  const toCam = camera.position.clone().sub(W.lampPos).normalize();
  const facing = Math.max(0, toCam.dot(beam.dir));
  const g = Math.pow(facing, 18) * 34 + Math.pow(facing, 3) * 4;
  beam.flareSprite.scale.setScalar((4 + g) * p);
  beam.flareSprite.material.opacity = clamp(0.25 + Math.pow(facing, 10) * 0.75, 0, 1) * p;
  W.lampGlowSprite.scale.setScalar(lerp(1.5, 9, p));
}

/* ---------- light tests ---------- */
function blockedBy(ox, oy, oz, dx, dy, dz, len2, cx, cz, r, top) {
  const fx = cx - ox, fz = cz - oz;
  const t = (fx * dx + fz * dz) / len2;
  if (t <= 0 || t >= 1) return false;
  const qx = ox + dx * t - cx, qz = oz + dz * t - cz, d2 = qx * qx + qz * qz;
  if (d2 >= r * r) return false;
  const te = Math.min(1, t + Math.sqrt(r * r - d2) / Math.sqrt(len2));
  return oy + dy * te < top;
}
/* is the straight path from the lamp to P in shadow? */
function inShadow(px, py, pz, self) {
  const L = W.lampPos, dx = px - L.x, dy = py - L.y, dz = pz - L.z, len2 = dx * dx + dz * dz;
  if (len2 < 1e-4) return false;
  for (const o of W.obstacles) if (blockedBy(L.x, L.y, L.z, dx, dy, dz, len2, o.x, o.z, o.r, o.top)) return true;
  for (const m of monsters) {
    if (!m.def.occluder || m === self || m.dead) continue;
    if (blockedBy(L.x, L.y, L.z, dx, dy, dz, len2, m.x, m.z, m.def.radius * 0.9, m.y + m.def.size * 1.7)) return true;
  }
  return false;
}
const _v = new THREE.Vector3();
/* inside the cone and not in shadow */
function beamHits(px, py, pz, radius, self) {
  if (beam.power < 0.35) return false;
  const L = W.lampPos;
  _v.set(px - L.x, py - L.y, pz - L.z);
  const dist = _v.length();
  if (dist > CFG.RANGE || dist < 0.5) return false;
  const cosA = _v.dot(beam.dir) / dist;
  const ang = Math.acos(clamp(cosA, -1, 1));
  if (ang > beam.angle * 0.94 + Math.atan(radius / dist) * 0.8) return false;
  return !inShadow(px, py, pz, self);
}
function mirrorHits(mr, px, py, pz, radius) {
  if (mr.power < 0.5) return false;
  _v.set(px - mr.ox, py - mr.oy, pz - mr.oz);
  const dist = _v.length();
  if (dist > CFG.MIRROR_RANGE || dist < 0.3) return false;
  const ang = Math.acos(clamp(_v.dot(mr.dir) / dist, -1, 1));
  return ang <= CFG.MIRROR_ANGLE * 0.94 + Math.atan(radius / dist) * 0.8;
}

/* ---------- structures: lanterns and reflectors ---------- */
const structures = [];
const MAT = {};
function structureMaterials() {
  MAT.iron = new THREE.MeshStandardMaterial({ color: col(0x24282c), roughness: 0.55, metalness: 0.5 });
  MAT.stone = new THREE.MeshStandardMaterial({ color: col(0x6c6a64), roughness: 0.95 });
  MAT.wood = new THREE.MeshStandardMaterial({ color: col(0x4a3b2d), roughness: 0.95 });
  MAT.mirror = new THREE.MeshStandardMaterial({ color: col(0xc9d3da), roughness: 0.08, metalness: 0.95, emissive: col(0xffe0a0),
    emissiveIntensity: 0, side: THREE.DoubleSide });
  TEX.dot = softTexture(64, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']]);
  TEX.flame = softTexture(64, [[0, 'rgba(255,250,220,1)'], [0.3, 'rgba(255,190,90,.85)'], [1, 'rgba(255,120,30,0)']]);
}
function makeBar() {
  const g = new THREE.Group();
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.14), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true,
    opacity: 0.55, depthWrite: false, toneMapped: false }));
  const fgG = new THREE.PlaneGeometry(1.1, 0.07); fgG.translate(0.55, 0, 0);
  const fg = new THREE.Mesh(fgG, new THREE.MeshBasicMaterial({ color: 0xffc66a, depthWrite: false, toneMapped: false, transparent: true }));
  fg.position.set(-0.55, 0, 0.01);
  g.add(bg, fg); g.userData.fg = fg; g.renderOrder = 7; bg.renderOrder = 7; fg.renderOrder = 8;
  return g;
}

function lanternMesh() {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 1.7, 6), MAT.wood); post.position.y = 0.85;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.25, 8), MAT.stone); foot.position.y = 0.1;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.3, 4), MAT.iron); cap.position.y = 2.42; cap.rotation.y = Math.PI / 4;
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.42), MAT.iron); base.position.y = 1.74;
  const glassM = new THREE.MeshStandardMaterial({ color: col(0xffe7b0), emissive: col(0xffb04a), emissiveIntensity: 1.2,
    transparent: true, opacity: 0.55, roughness: 0.2 });
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.34), glassM); glass.position.y = 2.02;
  for (let i = 0; i < 4; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.55, 0.04), MAT.iron);
    bar.position.set((i & 1 ? 1 : -1) * 0.19, 2.02, (i & 2 ? 1 : -1) * 0.19); g.add(bar);
  }
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.flame, blending: THREE.AdditiveBlending, depthWrite: false,
    transparent: true, toneMapped: false }));
  flame.position.y = 2.0; flame.scale.set(0.5, 0.7, 1);
  g.add(post, foot, cap, base, glass, flame);
  g.userData = { glass, flame };
  return g;
}
function reflectorMesh() {
  const g = new THREE.Group();
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.65, 1.3, 8), MAT.stone); ped.position.y = 0.65;
  const fork = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 6, 16, Math.PI), MAT.iron); fork.position.y = CFG.MIRROR_H; fork.rotation.z = Math.PI;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 6), MAT.iron); stem.position.y = 1.5;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.58, 24), MAT.mirror.clone()); disc.position.y = CFG.MIRROR_H;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.05, 6, 24), MAT.iron); disc.add(rim);
  g.add(ped, fork, stem, disc);
  g.userData = { disc, fork };
  return g;
}

function addStructure(type, x, z, yaw) {
  const y = terrainH(x, z);
  const s = { type, x, z, y, yaw: yaw || 0 };
  if (type === 'lantern') {
    s.mesh = lanternMesh(); s.mesh.position.set(x, y, z);
    s.oil = s.cap = UPG.oil.vals[G.up.oil];
    s.light = new THREE.PointLight(0xffb45c, 1.5, CFG.LANTERN_R * 1.75, 2);
    s.light.position.set(x, y + 2.1, z);
    s.ring = groundRing(CFG.LANTERN_R, 0.12, 64, 0xffc070, 0.22); placeGroundRing(s.ring, x, z);
    s.bar = makeBar(); s.bar.position.set(x, y + 2.95, z);
    scene.add(s.mesh, s.light, s.ring, s.bar);
  } else {
    s.mesh = reflectorMesh(); s.mesh.position.set(x, y, z);
    s.ox = x; s.oy = y + CFG.MIRROR_H; s.oz = z; s.power = 0;
    s.dir = beamDir(s.yaw, CFG.MIRROR_PITCH, new THREE.Vector3());
    s.light = new THREE.SpotLight(0xffe2b4, 0, CFG.MIRROR_RANGE + 8, CFG.MIRROR_ANGLE, 0.25, 1);
    s.light.position.set(s.ox, s.oy, s.oz);
    scene.add(s.light.target);
    s.shaft = makeShaft(0xffdc9e);
    scene.add(s.mesh, s.light);
    orientReflector(s);
  }
  structures.push(s);
  W.obstacleStruct = null;
  return s;
}
function orientReflector(s) {
  s.dir = beamDir(s.yaw, CFG.MIRROR_PITCH, s.dir || new THREE.Vector3());
  const toLamp = W.lampPos.clone().sub(new THREE.Vector3(s.ox, s.oy, s.oz)).normalize();
  const n = toLamp.add(s.dir).normalize();
  const disc = s.mesh.userData.disc;
  disc.lookAt(new THREE.Vector3(s.ox, s.oy, s.oz).add(n));
  s.mesh.userData.fork.rotation.y = Math.atan2(n.x, n.z) + Math.PI / 2;
  s.light.target.position.set(s.ox, s.oy, s.oz).addScaledVector(s.dir, 12);
  s.light.target.updateMatrixWorld();
}
function removeStructure(s) {
  const i = structures.indexOf(s); if (i >= 0) structures.splice(i, 1);
  scene.remove(s.mesh, s.light);
  if (s.ring) scene.remove(s.ring);
  if (s.bar) scene.remove(s.bar);
  if (s.shaft) scene.remove(s.shaft);
  if (s.light.target) scene.remove(s.light.target);
}
function refillLanterns() {
  for (const s of structures) if (s.type === 'lantern') { s.cap = UPG.oil.vals[G.up.oil]; s.oil = s.cap; s.out = false; }
}
function lanternHolding(m) {
  let best = null, bd = 1e9;
  for (const s of structures) {
    if (s.type !== 'lantern' || s.oil <= 0) continue;
    const d = Math.hypot(m.x - s.x, m.z - s.z);
    if (d <= CFG.LANTERN_R + m.def.radius * 0.5 && d < bd) { bd = d; best = s; }
  }
  return best;
}

function updateStructures(dt, time) {
  const night = G.state === 'night' || G.state === 'dawn' || G.state === 'dusk' || G.state === 'over';
  for (const s of structures) {
    if (s.type === 'lantern') {
      const lit = s.oil > 0 && (night || G.state === 'menu');
      const f = lit ? (0.85 + 0.15 * Math.sin(time * 11 + s.x) * Math.sin(time * 7.3 + s.z)) : 0;
      const frac = s.cap ? s.oil / s.cap : 0;
      const low = frac < 0.25 ? (0.55 + 0.45 * Math.abs(Math.sin(time * 9 + s.x))) : 1;
      s.light.intensity = lit ? 1.7 * f * low * (0.55 + 0.45 * Math.sqrt(frac)) : (G.state === 'day' ? 0.0 : 0);
      s.mesh.userData.flame.visible = lit;
      s.mesh.userData.flame.scale.set(0.45 * (0.6 + 0.4 * frac) * f, 0.7 * (0.6 + 0.4 * frac) * f, 1);
      s.mesh.userData.glass.material.emissiveIntensity = lit ? 1.3 * f * low : 0.05;
      s.ring.material.opacity = G.state === 'day' ? 0.35 : (lit ? 0.16 * low : 0.0);
      s.bar.visible = night && s.oil < s.cap - 0.01;
      s.bar.userData.fg.scale.x = Math.max(0.001, frac);
      s.bar.userData.fg.material.color.set(frac < 0.25 ? 0xff7050 : 0xffc66a);
      s.bar.quaternion.copy(camera.quaternion);
      if (lit && Math.random() < dt * 3) emitEmbers(s.x, s.y + 2.3, s.z, 1, 0.05, 0.4);
    } else {
      const want = (night && beam.power > 0.5 && beamHits(s.ox, s.oy, s.oz, 0.45, null)) ? 1 : 0;
      s.power += clamp(want - s.power, -dt * 8, dt * 8);
      const p = s.power * beam.power;
      s.light.intensity = p * lerp(3.0, 5.5, beam.focus);
      s.light.angle = CFG.MIRROR_ANGLE / 0.94;
      aimShaft(s.shaft, new THREE.Vector3(s.ox, s.oy, s.oz), s.dir, CFG.MIRROR_RANGE, CFG.MIRROR_ANGLE * 0.98);
      s.shaft.userData.u.uStrength.value = p * 0.75;
      s.shaft.visible = p > 0.01;
      s.mesh.userData.disc.material.emissiveIntensity = p * 2.5;
    }
  }
}

/* ---------- flares ---------- */
const flares = [];
let flareLights = [];
function initFlares() {
  for (let i = 0; i < CFG.FLARE_MAX_LIVE; i++) {
    const l = new THREE.PointLight(0xff5a36, 0, CFG.FLARE_R * 1.9, 2);
    l.position.set(0, -50, 0); scene.add(l);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, blending: THREE.AdditiveBlending, depthWrite: false,
      transparent: true, toneMapped: false, color: 0xff7a50 }));
    spr.visible = false; scene.add(spr);
    const ring = groundRing(CFG.FLARE_R, 0.1, 56, 0xff7050, 0.0); scene.add(ring);
    flareLights.push({ light: l, spr, ring, busy: false });
  }
}
function throwFlare(x, z) {
  if (G.flares <= 0) { Sound.deny(); log('No flares left. Buy more at dawn.', 'bad'); return false; }
  if (flares.length >= CFG.FLARE_MAX_LIVE) { Sound.deny(); return false; }
  const d = Math.hypot(x, z);
  if (d > CFG.FLARE_REACH) { x *= CFG.FLARE_REACH / d; z *= CFG.FLARE_REACH / d; }
  const slot = flareLights.find(f => !f.busy); if (!slot) return false;
  slot.busy = true;
  G.flares--; HUD.bump('c-flares');
  const y = groundY(x, z);
  const f = { slot, x, z, y, t: 0, fly: 0.9, sx: 0, sy: W.lampPos.y - 1.5, sz: 0 };
  const a = Math.atan2(x, z); f.sx = Math.sin(a) * 3.3; f.sz = Math.cos(a) * 3.3;
  flares.push(f);
  Sound.flareLaunch();
  G.stats.flares++;
  return true;
}
function updateFlares(dt, time) {
  for (let i = flares.length - 1; i >= 0; i--) {
    const f = flares[i], sl = f.slot;
    f.t += dt;
    let px, py, pz, burning = false;
    if (f.t < f.fly) {
      const k = f.t / f.fly;
      px = lerp(f.sx, f.x, k); pz = lerp(f.sz, f.z, k); py = lerp(f.sy, f.y + 0.3, k) + Math.sin(k * Math.PI) * 9;
      sl.light.intensity = 1.2;
      if (Math.random() < 0.9) FX.glow.emit(px, py, pz, rnd(-0.3, 0.3), rnd(-0.3, 0.3), rnd(-0.3, 0.3), 0.5, 0.35, 0.05, 1, 0.45, 0.25, 1, 0, 0);
    } else {
      const bt = f.t - f.fly;
      if (bt > CFG.FLARE_T) { sl.busy = false; sl.light.intensity = 0; sl.spr.visible = false; sl.ring.material.opacity = 0; flares.splice(i, 1); continue; }
      px = f.x; py = f.y + 0.3; pz = f.z; burning = true;
      if (!f.landed) { f.landed = true; placeGroundRing(sl.ring, f.x, f.z, CFG.FLARE_R); Sound.puff(panFor(new THREE.Vector3(px, py, pz)), 0.3); }
      const fade = bt > CFG.FLARE_T - 1 ? (CFG.FLARE_T - bt) : 1;
      const flick = 0.8 + 0.2 * Math.sin(time * 31 + i) * Math.sin(time * 17);
      sl.light.intensity = 3.2 * flick * fade;
      sl.ring.material.opacity = 0.28 * fade;
      if (Math.random() < 0.8) FX.glow.emit(px, py + 0.2, pz, rnd(-1, 1), rnd(1, 3), rnd(-1, 1), rnd(0.3, 0.7), 0.2, 0.03, 1, 0.4, 0.2, 1, 3, 0.5);
      if (Math.random() < 0.25) emitSmoke(px, py + 0.5, pz, 1, 0.2, false);
    }
    f.burning = burning;
    sl.light.position.set(px, py + 0.8, pz);
    sl.spr.visible = true; sl.spr.position.set(px, py + 0.2, pz);
    sl.spr.scale.setScalar(burning ? 3.4 + Math.sin(time * 23) * 0.4 : 1.6);
  }
}
function flareHolding(m) {
  for (const f of flares) if (f.burning && Math.hypot(m.x - f.x, m.z - f.z) <= CFG.FLARE_R + m.def.radius * 0.5) return true;
  return false;
}
function clearFlares() {
  for (const f of flares) { f.slot.busy = false; f.slot.light.intensity = 0; f.slot.spr.visible = false; f.slot.ring.material.opacity = 0; }
  flares.length = 0;
}

/* ---------- lightning (storm nights) ---------- */
const storm = { on: false, next: 6, flash: 0, rain: null };
function initRain() {
  const N = 1600, pos = new Float32Array(N * 6);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x8fa4b8, transparent: true, opacity: 0.35, depthWrite: false }));
  m.frustumCulled = false; m.visible = false; scene.add(m);
  storm.rain = m; storm.drops = [];
  for (let i = 0; i < N; i++) storm.drops.push({ x: rnd(-70, 70), y: rnd(0, 60), z: rnd(-70, 70), s: rnd(28, 40) });
}
function updateStorm(dt) {
  if (storm.flash > 0) storm.flash = Math.max(0, storm.flash - dt);
  if (storm.on && G.state === 'night') {
    storm.next -= dt;
    if (storm.next <= 0) {
      storm.next = rnd(7, 15);
      storm.flash = 0.22;
      storm.double = Math.random() < 0.6;
      Sound.thunder(rnd(0.3, 1.4), 0.7);
    }
  }
  const r = storm.rain; r.visible = storm.on && G.state !== 'menu';
  if (r.visible) {
    const p = r.geometry.attributes.position, c = camCtl.focus;
    for (let i = 0; i < storm.drops.length; i++) {
      const d = storm.drops[i];
      d.y -= d.s * dt; d.x += 4 * dt;
      if (d.y < -1) { d.y = rnd(30, 60); d.x = c.x + rnd(-70, 70); d.z = c.z + rnd(-70, 70); }
      p.setXYZ(i * 2, d.x, d.y, d.z); p.setXYZ(i * 2 + 1, d.x - 0.12, d.y + 0.9, d.z);
    }
    p.needsUpdate = true;
  }
}
function flashLevel() {
  if (storm.flash <= 0) return 0;
  const t = 0.22 - storm.flash;
  return (t < 0.06 ? 1 : (storm.double && t > 0.1 && t < 0.15 ? 0.8 : 0.15));
}

function initLight() {
  structureMaterials();
  FX = { glow: new Particles(2500, true), smoke: new Particles(1200, false) };
  initBeam();
  initFlares();
  initRain();
}
