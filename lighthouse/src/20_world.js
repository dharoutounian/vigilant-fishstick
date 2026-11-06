/* =====================================================================
   World: renderer, sky, sea, island, props, the lighthouse itself
   ===================================================================== */

const settings = { quality: 'medium', volume: 0.8, sens: 1, tips: true };
const QUALITY = {
  low:    { pr: 0.75, shadow: 1024, ocean: 70,  grass: 0 },
  medium: { pr: 1.0,  shadow: 1536, ocean: 120, grass: 1000 },
  high:   { pr: 2.0,  shadow: 2048, ocean: 170, grass: 2000 },
};
(function guessQuality() {
  const small = Math.min(innerWidth, innerHeight) < 600;
  const touch = matchMedia && matchMedia('(pointer:coarse)').matches;
  settings.quality = (small && touch) ? 'low' : 'medium';
})();

const canvas = $('c');
let renderer, scene, camera;
const W = {
  obstacles: [],       // {x,z,r,top} circles that block light and bodies
  shadowCasters: [],
  H0: 0, lampPos: new THREE.Vector3(),
  uTime: { value: 0 },
};

/* colours given as sRGB hex, converted to the linear space three.js lights in */
function col(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }

function softTexture(size, stops) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(s => grd.addColorStop(s[0], s[1]));
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
  return t;
}
const TEX = {};

/* ---------- island shape ---------- */
function shoreRadius(a) {
  return CFG.SHORE + 3.2 * Math.sin(a * 3 + 0.7) + 2.0 * Math.sin(a * 5 + 2.1) + 1.2 * Math.sin(a * 8 + 0.3);
}
function terrainH(x, z) {
  const r = Math.hypot(x, z), a = Math.atan2(z, x);
  const u = r / shoreRadius(a);
  if (u >= 1) return -Math.min(7, (u - 1) * 30);
  let h = 2.5 * (1 - smoothstep(0.14, 1.0, u)) + 0.35 * (1 - u);
  const w = smoothstep(0.16, 0.4, u) * (1 - smoothstep(0.82, 1.0, u));
  h += w * (0.55 * Math.sin(x * 0.19 + z * 0.11) * Math.sin(z * 0.16 - x * 0.07)
          + 0.28 * Math.sin(x * 0.47 + 1.3) * Math.sin(z * 0.41 + 0.4));
  return h;
}
/* where things stand: on land, or wading in the shallows */
function groundY(x, z) { return Math.max(terrainH(x, z), -0.25); }

/* ---------- renderer ---------- */
function initRenderer() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a1320, 0.0065);
  camera = new THREE.PerspectiveCamera(50, 1, 0.3, 1200);
  applyPixelRatio();
  addEventListener('resize', onResize);
  onResize();
}
function applyPixelRatio() {
  renderer.setPixelRatio(Math.min(QUALITY[settings.quality].pr, window.devicePixelRatio || 1));
}
function onResize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 0.8 ? 62 : 50;   // portrait phones need a wider lens to fit the island
  camera.updateProjectionMatrix();
}

/* ---------- sky ---------- */
const skyU = {
  top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, bottom: { value: new THREE.Color() },
  sunDir: { value: new THREE.Vector3(0, -1, 0) }, sunCol: { value: new THREE.Color() }, sunAmt: { value: 0 },
  flash: { value: 0 },
};
function buildSky() {
  const mat = new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
    vertexShader: `varying vec3 vDir;
      void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 top, horizon, bottom, sunCol; uniform vec3 sunDir; uniform float sunAmt, flash; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir); float h = d.y;
        vec3 c = mix(horizon, top, smoothstep(0.0, 0.5, h));
        c = mix(c, bottom, smoothstep(0.0, -0.2, h));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        c += sunCol * (pow(s, 6.0) * 0.45 + pow(s, 60.0) * 0.5 + smoothstep(0.9993, 0.9997, s) * 3.0) * sunAmt;
        c += vec3(0.55,0.62,0.75) * flash * (0.4 + 0.6 * smoothstep(-0.1, 0.5, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), mat);
  sky.renderOrder = -10; sky.frustumCulled = false;
  scene.add(sky); W.sky = sky;

  // stars
  const N = 1400, pos = new Float32Array(N * 3), sz = new Float32Array(N), ph = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const u = mapRand(), v = mapRand();
    const th = u * TAU, y = 0.03 + Math.pow(v, 0.8) * 0.97, r = Math.sqrt(1 - y * y);
    pos[i * 3] = Math.cos(th) * r * 450; pos[i * 3 + 1] = y * 450; pos[i * 3 + 2] = Math.sin(th) * r * 450;
    sz[i] = 0.8 + Math.pow(mapRand(), 6) * 2.6; ph[i] = mapRand() * TAU;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('size', new THREE.BufferAttribute(sz, 1));
  g.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
  W.starU = { opacity: { value: 1 }, time: W.uTime, pr: { value: 1 } };
  const sm = new THREE.ShaderMaterial({
    uniforms: W.starU, transparent: true, depthWrite: false, fog: false, toneMapped: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float size; attribute float phase; uniform float time, pr; varying float vA;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv;
        vA = 0.55 + 0.45 * sin(time * (1.3 + phase * 0.4) + phase * 7.0);
        gl_PointSize = size * pr * 1.6; }`,
    fragmentShader: `uniform float opacity; varying float vA;
      void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vec3(0.85,0.9,1.0), a * a * vA * opacity); }`,
  });
  const stars = new THREE.Points(g, sm); stars.frustumCulled = false; stars.renderOrder = -9;
  scene.add(stars); W.stars = stars;

  // moon and halo
  const mc = document.createElement('canvas'); mc.width = mc.height = 128;
  const mg = mc.getContext('2d');
  const grd = mg.createRadialGradient(56, 56, 4, 64, 64, 60);
  grd.addColorStop(0, '#f6f3ea'); grd.addColorStop(0.85, '#d7d8d4'); grd.addColorStop(1, 'rgba(210,214,214,0)');
  mg.fillStyle = grd; mg.beginPath(); mg.arc(64, 64, 60, 0, TAU); mg.fill();
  mg.fillStyle = 'rgba(150,152,160,.35)';
  [[48, 50, 12], [80, 72, 9], [62, 86, 7], [86, 44, 6], [42, 78, 5]].forEach(([x, y, r]) => { mg.beginPath(); mg.arc(x, y, r, 0, TAU); mg.fill(); });
  const mt = new THREE.CanvasTexture(mc); mt.encoding = THREE.sRGBEncoding;
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: mt, fog: false, depthWrite: false, toneMapped: false, transparent: true }));
  moon.scale.setScalar(26); moon.renderOrder = -8;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: softTexture(128, [[0, 'rgba(180,200,235,.55)'], [0.25, 'rgba(140,165,210,.18)'], [1, 'rgba(0,0,0,0)']]),
    fog: false, depthWrite: false, toneMapped: false, transparent: true, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(140); halo.renderOrder = -8;
  W.moonDir = new THREE.Vector3(-0.42, 0.42, -0.8).normalize();
  scene.add(moon, halo); W.moon = moon; W.halo = halo;

  // clouds: soft clumps low on the horizon
  const cc = document.createElement('canvas'); cc.width = 256; cc.height = 128;
  const cg = cc.getContext('2d');
  for (let i = 0; i < 46; i++) {
    const x = 30 + mapRand() * 196, y = 50 + Math.sin((x - 30) / 196 * Math.PI) * -18 + mapRand() * 30, r = 14 + mapRand() * 26;
    const gg = cg.createRadialGradient(x, y, 0, x, y, r);
    gg.addColorStop(0, 'rgba(255,255,255,.5)'); gg.addColorStop(1, 'rgba(255,255,255,0)');
    cg.fillStyle = gg; cg.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const ct = new THREE.CanvasTexture(cc); ct.encoding = THREE.sRGBEncoding;
  W.clouds = [];
  for (let i = 0; i < 9; i++) {
    const m = new THREE.SpriteMaterial({ map: ct, fog: false, depthWrite: false, toneMapped: false, transparent: true, color: 0x141c28 });
    const s = new THREE.Sprite(m);
    const a = mapRand() * TAU, el = 0.04 + mapRand() * 0.16;
    s.userData = { a, el, speed: (mapRand() - 0.5) * 0.004 };
    s.scale.set(220 + mapRand() * 160, 70 + mapRand() * 40, 1); s.renderOrder = -7;
    scene.add(s); W.clouds.push(s);
  }
}

/* ---------- sea ---------- */
const WAVE_GLSL = `
uniform float uTime;
vec3 waveField(vec2 p, float t, float detail){
  float h = 0.0; vec2 g = vec2(0.0);
  vec2 d; float ph;
  d = normalize(vec2(1.0,0.3));  ph = dot(d,p)*0.16 + t*1.05; h += 0.30*sin(ph); g += 0.30*0.16*cos(ph)*d;
  d = normalize(vec2(-0.4,1.0)); ph = dot(d,p)*0.23 + t*1.35; h += 0.18*sin(ph); g += 0.18*0.23*cos(ph)*d;
  d = normalize(vec2(0.7,-0.8)); ph = dot(d,p)*0.41 + t*1.9;  h += 0.08*sin(ph)*detail; g += 0.08*0.41*cos(ph)*d*detail;
  d = normalize(vec2(-0.9,-0.2));ph = dot(d,p)*0.83 + t*2.7;  h += 0.03*sin(ph)*detail; g += 0.03*0.83*cos(ph)*d*detail;
  d = normalize(vec2(0.2,-1.0)); ph = dot(d,p)*1.9 + t*4.1;   g += 0.006*1.9*cos(ph)*d*detail;
  d = normalize(vec2(0.95,0.5)); ph = dot(d,p)*3.1 + t*5.3;   g += 0.003*3.1*cos(ph)*d*detail;
  return vec3(h, g);
}
float shoreR(float a){ return ${CFG.SHORE.toFixed(1)} + 3.2*sin(a*3.0+0.7) + 2.0*sin(a*5.0+2.1) + 1.2*sin(a*8.0+0.3); }
`;
const seaU = { skyRefl: { value: new THREE.Color() }, foamCol: { value: new THREE.Color(0.5, 0.56, 0.6) } };
function buildSea() {
  const mat = new THREE.MeshStandardMaterial({ color: col(0x0b2131), roughness: 0.42, metalness: 0.0 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = W.uTime; sh.uniforms.skyRefl = seaU.skyRefl; sh.uniforms.foamCol = seaU.foamCol;
    sh.vertexShader = WAVE_GLSL + 'varying vec3 vWPos;\n' + sh.vertexShader
      .replace('#include <beginnormal_vertex>', `
        vec3 wp0 = (modelMatrix * vec4(position, 1.0)).xyz;
        vec3 wv = waveField(wp0.xz, uTime, 0.0);
        vec3 objectNormal = normalize(vec3(-wv.y, 1.0, -wv.z));`)
      .replace('#include <begin_vertex>', `vec3 transformed = vec3(position); transformed.y += wv.x;
        vWPos = wp0 + vec3(0.0, wv.x, 0.0);`);
    sh.fragmentShader = WAVE_GLSL + 'uniform vec3 skyRefl; uniform vec3 foamCol; varying vec3 vWPos;\n' + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        float rr = length(vWPos.xz); float uu = rr / shoreR(atan(vWPos.z, vWPos.x));
        float foam = smoothstep(1.05, 1.0, uu) * smoothstep(0.8, 1.0, sin(uu * 110.0 - uTime * 1.6 + sin(vWPos.x * 0.3) * 2.0) * 0.5 + 0.5);
        foam += smoothstep(1.015, 1.0, uu) * 0.6;
        diffuseColor.rgb = mix(diffuseColor.rgb, foamCol, clamp(foam, 0.0, 1.0) * 0.4);`)
      .replace('#include <normal_fragment_maps>', `
        vec3 wf = waveField(vWPos.xz, uTime, 1.0);
        normal = normalize((viewMatrix * vec4(normalize(vec3(-wf.y, 1.0, -wf.z)), 0.0)).xyz);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float fres = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 4.0);
        totalEmissiveRadiance += skyRefl * (0.08 + 0.9 * fres);`);
  };
  W.seaMat = mat;
  rebuildSea();
}
function rebuildSea() {
  if (W.sea) { scene.remove(W.sea); W.sea.geometry.dispose(); }
  const seg = QUALITY[settings.quality].ocean;
  const g = new THREE.PlaneGeometry(700, 700, seg, seg); g.rotateX(-Math.PI / 2);
  const sea = new THREE.Mesh(g, W.seaMat); sea.receiveShadow = true;
  scene.add(sea); W.sea = sea;
}

/* ---------- island ---------- */
function buildTerrain() {
  const S = 150, N = 190;
  const g = new THREE.PlaneGeometry(S, S, N, N); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, colors = new Float32Array(p.count * 3);
  const cSand = col(0x7d7058), cWet = col(0x2c2b27), cGrass = col(0x3a4529), cGrass2 = col(0x4a5232),
        cRock = col(0x5b5f5d), cDeep = col(0x15191b), tmp = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), h = terrainH(x, z);
    p.setY(i, h);
    const sl = Math.hypot(terrainH(x + 0.5, z) - terrainH(x - 0.5, z), terrainH(x, z + 0.5) - terrainH(x, z - 0.5));
    const n = 0.5 + 0.5 * Math.sin(x * 0.8 + Math.sin(z * 0.6) * 2) * Math.sin(z * 0.7 + x * 0.2);
    if (h < -0.4) tmp.copy(cDeep).lerp(cWet, smoothstep(-3, -0.4, h));
    else if (h < 0.15) tmp.copy(cWet).lerp(cSand, smoothstep(-0.4, 0.15, h));
    else if (h < 0.65) tmp.copy(cSand).lerp(cGrass, smoothstep(0.35, 0.65, h));
    else tmp.copy(cGrass).lerp(cGrass2, n);
    if (h > 0.2) tmp.lerp(cRock, clamp(sl * 1.4 - 0.15, 0, 0.75));
    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 }));
  m.receiveShadow = true;
  scene.add(m); W.terrain = m;
  W.H0 = terrainH(0, 0);
}

function rockGeometry(detail, seed) {
  const g = new THREE.IcosahedronGeometry(1, detail), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed) * 43758.5453;
    const f = 0.78 + (k - Math.floor(k)) * 0.42;
    p.setXYZ(i, x * f, y * f * (y < 0 ? 0.6 : 1), z * f);
  }
  g.computeVertexNormals();
  return g;
}
function addObstacle(x, z, r, top, kind) { const o = { x, z, r, top, kind }; W.obstacles.push(o); return o; }
function farFromObstacles(x, z, gap) {
  for (const o of W.obstacles) if (Math.hypot(x - o.x, z - o.z) < o.r + gap) return false;
  return true;
}

function buildProps() {
  const rockMat = new THREE.MeshStandardMaterial({ color: col(0x4c5358), roughness: 0.9, flatShading: true });
  const rockGeos = [0, 1, 2, 3].map(i => rockGeometry(1, i * 1.7));
  function rock(x, z, sx, sy, sz, rot) {
    const m = new THREE.Mesh(rockGeos[(mapRand() * 4) | 0], rockMat);
    const base = terrainH(x, z);
    m.scale.set(sx, sy, sz); m.rotation.y = rot; m.position.set(x, base + sy * 0.15, z);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m); W.shadowCasters.push(m);
    addObstacle(x, z, Math.max(sx, sz) * 0.88, base + sy * 1.0, 'rock');
    return m;
  }

  // keeper's cottage, a little way from the tower
  const cot = new THREE.Group();
  const cx = -8.6, cz = 7.8, cang = Math.atan2(-cx, -cz);
  const cbase = terrainH(cx, cz);
  const wall = new THREE.MeshStandardMaterial({ color: col(0xbdb5a3), roughness: 0.9 });
  const roofM = new THREE.MeshStandardMaterial({ color: col(0x2f353b), roughness: 0.75, flatShading: true });
  const body = new THREE.Mesh(new THREE.BoxGeometry(6.2, 3.0, 4.2), wall); body.position.y = 1.5;
  const roofG = new THREE.CylinderGeometry(2.6, 2.6, 6.6, 3, 1); roofG.rotateZ(Math.PI / 2); roofG.rotateX(Math.PI / 6);
  const roof = new THREE.Mesh(roofG, roofM); roof.position.y = 3.0 + 1.3; roof.scale.set(1, 0.62, 1);
  const chim = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.8, 0.7), wall); chim.position.set(1.9, 4.6, -0.6);
  const winM = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: col(0xffb054), emissiveIntensity: 1.6 });
  [-1.6, 1.6].forEach(x => { const w = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.08), winM); w.position.set(x, 1.7, 2.12); cot.add(w); });
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.9, 0.08), new THREE.MeshStandardMaterial({ color: col(0x3b2b1f) }));
  door.position.set(0, 0.95, 2.12);
  cot.add(body, roof, chim, door);
  cot.position.set(cx, cbase - 0.1, cz); cot.rotation.y = cang;
  cot.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(cot); W.shadowCasters.push(cot); W.cottage = cot;
  for (let k = -1; k <= 1; k++) {
    const lx = k * 2.1;
    addObstacle(cx + Math.cos(cang) * lx, cz - Math.sin(cang) * lx, 2.2, cbase + 4.2, 'cottage');
  }
  const winLight = new THREE.PointLight(0xffa64a, 0.7, 7, 2);
  winLight.position.set(cx + Math.sin(cang) * 3, cbase + 1.8, cz + Math.cos(cang) * 3);
  scene.add(winLight); W.winLight = winLight;

  // rocks on the island
  let tries = 0, placed = 0;
  while (placed < 16 && tries++ < 600) {
    const a = mapRand() * TAU, r = 13 + mapRand() * 27;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (r > shoreRadius(a) - 3) continue;
    if (!farFromObstacles(x, z, 6.5)) continue;
    const s = 1.3 + mapRand() * 1.5;
    rock(x, z, s * (0.9 + mapRand() * 0.5), s * (0.9 + mapRand() * 0.8), s * (0.8 + mapRand() * 0.5), mapRand() * TAU);
    if (mapRand() < 0.45) {   // a smaller companion
      const ca = mapRand() * TAU, cr = s * 1.5;
      rock(x + Math.cos(ca) * cr, z + Math.sin(ca) * cr, s * 0.45, s * 0.5, s * 0.45, mapRand() * TAU);
    }
    placed++;
  }
  // sea stacks out in the surf
  for (let i = 0; i < 4; i++) {
    const a = i * TAU / 4 + 0.5 + mapRand() * 0.8, r = shoreRadius(a) + 6 + mapRand() * 6;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, s = 2.0 + mapRand() * 1.2;
    const m = rock(x, z, s, s * 2.6, s * 0.9, mapRand() * TAU);
    m.position.y = terrainH(x, z) + s * 1.2;
    W.obstacles[W.obstacles.length - 1].top = m.position.y + s * 2.4;
  }
  // pebbles: decoration only, too small to hide behind
  const pebG = rockGeometry(0, 9), pebN = 70;
  const peb = new THREE.InstancedMesh(pebG, rockMat, pebN), mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < pebN; i++) {
    const a = mapRand() * TAU, r = 6 + mapRand() * 38, x = Math.cos(a) * r, z = Math.sin(a) * r, s = 0.15 + mapRand() * 0.35;
    if (r > shoreRadius(a) + 2) { i--; continue; }
    e.set(mapRand() * 3, mapRand() * 3, 0); q.setFromEuler(e);
    mtx.compose(new THREE.Vector3(x, terrainH(x, z) + s * 0.2, z), q, new THREE.Vector3(s, s * 0.7, s));
    peb.setMatrixAt(i, mtx);
  }
  peb.receiveShadow = true; scene.add(peb);

  // dead trees
  const bark = new THREE.MeshStandardMaterial({ color: col(0x2b2621), roughness: 1 });
  tries = 0; placed = 0;
  while (placed < 6 && tries++ < 400) {
    const a = mapRand() * TAU, r = 16 + mapRand() * 22, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (r > shoreRadius(a) - 5 || !farFromObstacles(x, z, 3.5)) continue;
    const t = new THREE.Group(), base = terrainH(x, z), hgt = 3.2 + mapRand() * 1.6;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.26, hgt, 6), bark); trunk.position.y = hgt / 2;
    t.add(trunk);
    for (let b = 0; b < 4; b++) {
      const len = 0.8 + mapRand() * 1.3, br = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.08, len, 5), bark);
      const piv = new THREE.Group(); piv.position.y = hgt * (0.5 + mapRand() * 0.42);
      piv.rotation.set(0, mapRand() * TAU, 0.6 + mapRand() * 0.6);
      br.position.y = len / 2; piv.add(br); t.add(piv);
    }
    t.rotation.set((mapRand() - 0.5) * 0.25, mapRand() * TAU, (mapRand() - 0.5) * 0.25);
    t.position.set(x, base - 0.1, z);
    t.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(t); W.shadowCasters.push(t);
    addObstacle(x, z, 0.35, base + hgt * 0.95, 'tree');
    placed++;
  }

  // jetty and a rowboat (over water; they don't hide anything)
  const wood = new THREE.MeshStandardMaterial({ color: col(0x4a3b2d), roughness: 0.95 });
  const da = -2.25, dr0 = shoreRadius(da) - 2.5, dlen = 15;
  const jetty = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, dlen), wood); deck.position.set(0, 1.0, dlen / 2);
  jetty.add(deck);
  for (let s = 0; s <= dlen; s += 2.5) [-1, 1].forEach(sd => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4.5, 6), wood); post.position.set(sd * 1.05, -1.2, s); jetty.add(post);
  });
  jetty.position.set(Math.cos(da) * dr0, 0, Math.sin(da) * dr0);
  jetty.rotation.y = Math.atan2(Math.cos(da), Math.sin(da));
  jetty.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  scene.add(jetty);
  const boatG = new THREE.SphereGeometry(1, 14, 7, 0, TAU, Math.PI / 2, Math.PI / 2);
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(boatG, new THREE.MeshStandardMaterial({ color: col(0x5b3424), roughness: 0.8, side: THREE.DoubleSide }));
  hull.scale.set(0.95, 0.55, 2.3); boat.add(hull);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.35), wood); seat.position.y = -0.12; boat.add(seat);
  const bp = jetty.localToWorld(new THREE.Vector3(2.4, 0, dlen * 0.7));
  boat.position.set(bp.x, 0.15, bp.z); boat.rotation.y = jetty.rotation.y + 0.2;
  scene.add(boat); W.boat = boat;

  // fence posts by the cottage
  for (let i = 0; i < 7; i++) {
    const a = cang + Math.PI + (i - 3) * 0.14, r = 17;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!farFromObstacles(x, z, 0.8)) continue;
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.1, 0.14), wood); p.position.set(x, terrainH(x, z) + 0.45, z);
    p.rotation.z = (mapRand() - 0.5) * 0.3; scene.add(p);
  }
}

/* grass tufts that sway, instanced */
function rebuildGrass() {
  if (W.grass) { scene.remove(W.grass); W.grass.geometry.dispose(); W.grass = null; }
  const n = QUALITY[settings.quality].grass;
  if (!n) return;
  if (!W.grassGeo) {
    const pos = [], nor = [];
    for (let k = 0; k < 5; k++) {
      const a = k * TAU / 5 + 0.3, ca = Math.cos(a), sa = Math.sin(a), h = 0.45 + (k % 3) * 0.12, lean = 0.16;
      const w = 0.05;
      pos.push(-sa * w, 0, ca * w, sa * w, 0, -ca * w, ca * lean, h, sa * lean);
      for (let v = 0; v < 3; v++) nor.push(ca * 0.3, 0.95, sa * 0.3);
    }
    W.grassGeo = new THREE.BufferGeometry();
    W.grassGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    W.grassGeo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    W.grassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, side: THREE.DoubleSide });
    W.grassMat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = W.uTime;
      // blades are lit the same from both sides
      sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>',
        'float faceDirection = 1.0; vec3 normal = normalize(vNormal); vec3 geometryNormal = normal;');
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
        vec3 transformed = vec3(position);
        float gph = instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.27;
        transformed.x += sin(uTime * 1.9 + gph) * 0.09 * position.y;
        transformed.z += cos(uTime * 1.5 + gph) * 0.06 * position.y;`);
    };
  }
  const g = new THREE.InstancedMesh(W.grassGeo, W.grassMat, n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  const c1 = col(0x3e4a2a), c2 = col(0x5d5f35);
  let i = 0, guard = 0;
  while (i < n && guard++ < n * 20) {
    const a = mapRand() * TAU, r = 5 + Math.sqrt(mapRand()) * 38, x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = terrainH(x, z);
    if (h < 0.55 || !farFromObstacles(x, z, 0.4)) continue;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), mapRand() * TAU);
    const s = 0.7 + mapRand() * 0.8;
    m.compose(new THREE.Vector3(x, h - 0.03, z), q, new THREE.Vector3(s, s, s));
    g.setMatrixAt(i, m);
    c.copy(c1).lerp(c2, mapRand()); g.setColorAt(i, c);
    i++;
  }
  g.count = i;
  g.receiveShadow = true;
  scene.add(g); W.grass = g;
}

/* ---------- the lighthouse ---------- */
function buildLighthouse() {
  const H0 = W.H0, grp = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: col(0x77756f), roughness: 0.92 });
  const white = new THREE.MeshStandardMaterial({ color: col(0xe4ddcf), roughness: 0.8 });
  const red = new THREE.MeshStandardMaterial({ color: col(0x9b2a22), roughness: 0.75 });
  const iron = new THREE.MeshStandardMaterial({ color: col(0x23272b), roughness: 0.5, metalness: 0.55 });

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.7, 1.4, 28), stone);
  plinth.position.y = H0 + 0.2; grp.add(plinth);
  const y0 = H0 + 0.9, TH = 14.2, rB = 3.3, rT = 2.25, bands = 6;
  for (let i = 0; i < bands; i++) {
    const a = i / bands, b = (i + 1) / bands;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(lerp(rB, rT, b), lerp(rB, rT, a), TH / bands, 36, 1, true), i % 2 ? red : white);
    m.position.y = y0 + TH * (a + b) / 2; grp.add(m);
  }
  // door, facing the cottage
  const doorM = new THREE.MeshStandardMaterial({ color: col(0x2a1d14), roughness: 0.8 });
  const dAng = Math.atan2(-8.6, 7.8);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.3, 0.3), doorM);
  door.position.set(Math.sin(dAng) * 3.25, y0 + 1.15, Math.cos(dAng) * 3.25); door.rotation.y = dAng; grp.add(door);
  // warm windows up the tower
  const winM = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: col(0xffb867), emissiveIntensity: 1.4 });
  [[0.25, 1.1], [0.5, 3.0], [0.72, 4.9]].forEach(([f, a]) => {
    const r = lerp(rB, rT, f) - 0.02, w = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.8, 0.1), winM);
    w.position.set(Math.sin(a) * r, y0 + TH * f, Math.cos(a) * r); w.rotation.y = a; grp.add(w);
  });
  // gallery
  const yG = y0 + TH;
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(3.45, 2.6, 0.45, 32), iron); deck.position.y = yG + 0.12; grp.add(deck);
  const rail = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.045, 6, 48), iron); rail.rotation.x = Math.PI / 2; rail.position.y = yG + 1.25; grp.add(rail);
  const rail2 = rail.clone(); rail2.position.y = yG + 0.75; grp.add(rail2);
  const postG = new THREE.CylinderGeometry(0.04, 0.04, 1.0, 5);
  for (let i = 0; i < 28; i++) {
    const a = i / 28 * TAU, p = new THREE.Mesh(postG, iron);
    p.position.set(Math.cos(a) * 3.3, yG + 0.82, Math.sin(a) * 3.3); grp.add(p);
  }
  // lantern room
  const wallR = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.05, 0.7, 24), red); wallR.position.y = yG + 0.7; grp.add(wallR);
  const glassY = yG + 1.05 + 1.15;
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 1.95, 2.3, 24, 1, true),
    new THREE.MeshStandardMaterial({ color: col(0xfff0cc), emissive: col(0xffcf7a), emissiveIntensity: 0.25, transparent: true,
      opacity: 0.16, roughness: 0.1, depthWrite: false, side: THREE.DoubleSide }));
  glass.position.y = glassY; grp.add(glass); W.glass = glass;
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * TAU, m = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.3, 0.07), iron);
    m.position.set(Math.cos(a) * 1.96, glassY, Math.sin(a) * 1.96); grp.add(m);
  }
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.15, 24, 10, 0, TAU, 0, Math.PI / 2), iron);
  dome.position.y = glassY + 1.15; dome.scale.y = 0.7; grp.add(dome);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), iron); ball.position.y = glassY + 1.15 + 1.6; grp.add(ball);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 4), iron); rod.position.y = glassY + 1.15 + 2.4; grp.add(rod);

  W.lampPos.set(0, H0 + CFG.LAMP_ABOVE, 0);
  // the lamp: a blown-out core, a rotating cage of lens panels, and a glow
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff1d0, toneMapped: false }));
  core.position.copy(W.lampPos); grp.add(core); W.lampCore = core;
  const cage = new THREE.Group(); cage.position.copy(W.lampPos);
  const tilt = new THREE.Group(); cage.add(tilt);
  const lensM = new THREE.MeshStandardMaterial({ color: col(0xfff2d0), emissive: col(0xffcc80), emissiveIntensity: 0.9,
    transparent: true, opacity: 0.6, roughness: 0.15 });
  [-1, 1].forEach(s => {
    const panel = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.1, 24), lensM);
    panel.rotation.x = Math.PI / 2; panel.position.z = s * 0.62; tilt.add(panel);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.05, 6, 24), iron); ring.position.z = s * 0.62; tilt.add(ring);
  });
  const frame = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.04, 6, 24), iron); frame.rotation.y = Math.PI / 2; tilt.add(frame);
  grp.add(cage); W.lampCage = cage; W.lampTilt = tilt;
  TEX.glow = softTexture(128, [[0, 'rgba(255,240,210,1)'], [0.12, 'rgba(255,214,140,.75)'], [0.4, 'rgba(255,170,80,.16)'], [1, 'rgba(0,0,0,0)']]);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, blending: THREE.AdditiveBlending, depthWrite: false,
    transparent: true, toneMapped: false, fog: false }));
  glow.position.copy(W.lampPos); glow.scale.setScalar(9); grp.add(glow); W.lampGlowSprite = glow;

  // the tower never shadows its own lamp
  grp.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
  scene.add(grp); W.lighthouse = grp;

  const lampLight = new THREE.PointLight(0xffd59a, 1.6, 18, 2);
  lampLight.position.copy(W.lampPos).add(new THREE.Vector3(0, 0.5, 0));
  scene.add(lampLight); W.lampLight = lampLight;
}

/* ---------- ambient light and time of day ---------- */
const TOD = {
  night: { top: 0x03060c, horizon: 0x0e1828, bottom: 0x05080d, fog: 0x0b1421, fogD: 0.0062, hemiS: 0x24365a, hemiG: 0x07090c, hemiI: 0.62,
           sky: 0x9ab0d8, skyI: 0.38, stars: 1, refl: 0x0c1a2a, cloud: 0x121a26, sea: 0x0a1f2e, sunAmt: 0, foam: 0x3e4d57 },
  dawn:  { top: 0x2a3a5c, horizon: 0xe39a72, bottom: 0x2a2024, fog: 0x77656c, fogD: 0.0048, hemiS: 0xd2a495, hemiG: 0x3a3028, hemiI: 0.95,
           sky: 0xffb47c, skyI: 1.3, stars: 0.08, refl: 0x9a7a7a, cloud: 0xd99a84, sea: 0x1d3a4c, sunAmt: 1, foam: 0xb8b3ad },
  day:   { top: 0x3c6da6, horizon: 0xaac4d6, bottom: 0x6b8696, fog: 0x9db2c1, fogD: 0.0034, hemiS: 0xbfd6ee, hemiG: 0x5a5040, hemiI: 1.15,
           sky: 0xfff0d8, skyI: 1.9, stars: 0, refl: 0x6f93ad, cloud: 0xf1f3f5, sea: 0x1f5068, sunAmt: 0.8, foam: 0xdce4e6 },
};
const _ca = new THREE.Color(), _cb = new THREE.Color();
function mixHex(a, b, t, out, linear) {
  _ca.setHex(a); _cb.setHex(b); out.copy(_ca).lerp(_cb, t);
  if (linear) out.convertSRGBToLinear();
  return out;
}
function buildLights() {
  W.hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 1); scene.add(W.hemi);
  W.skyLight = new THREE.DirectionalLight(0xffffff, 1); scene.add(W.skyLight); scene.add(W.skyLight.target);
  W.tod = -1;
}
/* t: 0 night, 0.5 dawn, 1 day */
function setTimeOfDay(t) {
  W.tod = t;
  const A = t < 0.5 ? TOD.night : TOD.dawn, B = t < 0.5 ? TOD.dawn : TOD.day, k = t < 0.5 ? t * 2 : (t - 0.5) * 2;
  const L = (key, out) => mixHex(A[key], B[key], k, out, true);
  const N = (key) => lerp(A[key], B[key], k);
  mixHex(A.top, B.top, k, skyU.top.value, false); mixHex(A.horizon, B.horizon, k, skyU.horizon.value, false);
  mixHex(A.bottom, B.bottom, k, skyU.bottom.value, false);
  mixHex(A.fog, B.fog, k, scene.fog.color, false);
  scene.fog.density = N('fogD');
  L('hemiS', W.hemi.color); L('hemiG', W.hemi.groundColor); W.hemi.intensity = N('hemiI');
  L('sky', W.skyLight.color); W.skyLight.intensity = N('skyI');
  L('refl', seaU.skyRefl.value); L('foam', seaU.foamCol.value);
  L('sea', W.seaMat.color);
  W.starU.opacity.value = N('stars');
  // moon by night, a sun climbing out of the east by day
  const sunEl = lerp(-0.25, 0.75, smoothstep(0.2, 1, t));
  const sunDir = new THREE.Vector3(0.75, sunEl, 0.45).normalize();
  skyU.sunDir.value.copy(sunDir); skyU.sunAmt.value = N('sunAmt') * smoothstep(0.15, 0.5, t);
  skyU.sunCol.value.set(t < 0.75 ? 0xffa060 : 0xfff0d0);
  const lightDir = t < 0.3 ? W.moonDir : sunDir.clone().lerp(W.moonDir, 1 - smoothstep(0.3, 0.6, t)).normalize();
  W.skyLight.position.copy(lightDir).multiplyScalar(100);
  W.moon.material.opacity = 1 - smoothstep(0.2, 0.55, t);
  W.halo.material.opacity = 1 - smoothstep(0.1, 0.45, t);
  W.clouds.forEach(c => { mixHex(A.cloud, B.cloud, k, c.material.color, true); c.material.opacity = lerp(0.85, 0.7, t); });
  W.winLight.intensity = lerp(0.8, 0.0, smoothstep(0.4, 0.9, t));
}
function updateSkyFollow() {
  W.sky.position.copy(camera.position);
  W.stars.position.copy(camera.position);
  W.moon.position.copy(camera.position).addScaledVector(W.moonDir, 420);
  W.halo.position.copy(W.moon.position);
  for (const c of W.clouds) {
    const u = c.userData; u.a += u.speed * 0.016;
    c.position.set(camera.position.x + Math.cos(u.a) * 430 * Math.cos(u.el), camera.position.y + Math.sin(u.el) * 430,
                   camera.position.z + Math.sin(u.a) * 430 * Math.cos(u.el));
  }
}

/* ---------- picking the ground under the pointer ---------- */
const _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2();
function pickGround(nx, ny, out) {
  _ndc.set(nx, ny); _ray.setFromCamera(_ndc, camera);
  const o = _ray.ray.origin, d = _ray.ray.direction;
  if (d.y > -0.01) {   // looking above the horizon: clamp to a far point
    out.set(o.x + d.x * 200, 0, o.z + d.z * 200);
    return false;
  }
  let H = 1, t = 0;
  for (let i = 0; i < 6; i++) {
    t = (o.y - H) / -d.y;
    const x = o.x + d.x * t, z = o.z + d.z * t;
    H = Math.max(terrainH(x, z), 0);
  }
  out.set(o.x + d.x * t, H, o.z + d.z * t);
  return true;
}
function worldToScreen(v) {
  const p = v.clone().project(camera);
  return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight, behind: p.z > 1 };
}
function panFor(v) { const s = v.clone().project(camera); return clamp(s.x, -1, 1) * 0.7; }

function initWorld() {
  buildSky();
  buildSea();
  buildTerrain();
  buildProps();
  rebuildGrass();
  buildLighthouse();
  buildLights();
  setTimeOfDay(0);
}
