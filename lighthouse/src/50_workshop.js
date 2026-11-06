/* =====================================================================
   The workshop: daytime building, buying and upgrading
   ===================================================================== */

const shop = {
  mode: null,          // null | 'lantern' | 'mirror' | 'aim' | 'remove'
  ghost: null, ghostRing: null, aiming: null, hover: null, valid: false,
  point: new THREE.Vector3(),
};

function countOf(type) { return structures.filter(s => s.type === type).length; }
function sellValue(s) { return Math.floor((s.type === 'lantern' ? CFG.LANTERN_COST : CFG.MIRROR_COST) * 0.6); }

function shopItems() {
  const items = [];
  const nL = countOf('lantern'), nM = countOf('mirror');
  items.push({ h: 'Build' });
  items.push({ id: 'lantern', name: 'Lantern', ds: `Holds back anything in its glow until the oil runs out. Snuffers ignore it. (${nL}/${CFG.LANTERN_MAX})`,
    cost: CFG.LANTERN_COST, off: nL >= CFG.LANTERN_MAX, toggle: true });
  items.push({ id: 'mirror', name: 'Reflector', ds: `Throws a second beam wherever you point it, whenever your light falls on it. (${nM}/${CFG.MIRROR_MAX})`,
    cost: CFG.MIRROR_COST, off: nM >= CFG.MIRROR_MAX, toggle: true });
  items.push({ id: 'remove', name: 'Take one down', ds: 'Get back 60% of what it cost.', cost: null, off: structures.length === 0, toggle: true });
  items.push({ h: 'Supplies' });
  items.push({ id: 'flares', name: `Flares ×${CFG.FLARE_PACK}`, ds: `You have ${G.flares}. A flare holds back everything near it for ${CFG.FLARE_T} seconds.`,
    cost: CFG.FLARE_PACK_COST });
  items.push({ id: 'repair', name: 'Mend the tower', ds: `Restore ${CFG.REPAIR_HP} to the lighthouse.`, cost: CFG.REPAIR_COST, off: G.hp >= CFG.HP });
  items.push({ h: 'The lamp' });
  for (const u of UPGRADES) {
    const lv = G.up[u.id], max = lv >= u.costs.length;
    items.push({ id: 'up:' + u.id, name: u.name, lv, levels: u.costs.length,
      ds: u.desc + ' ' + (max ? 'Now ' + u.fmt(u.vals[lv], lv) + '.' : u.fmt(u.vals[lv], lv) + ' → ' + u.fmt(u.vals[lv + 1], lv + 1) + '.'),
      cost: max ? null : u.costs[lv], max });
  }
  return items;
}

function renderShop() {
  const list = $('shop-list');
  const html = shopItems().map(it => {
    if (it.h) return `<h4>${it.h}</h4>`;
    const afford = it.cost == null || G.embers >= it.cost;
    const dis = it.off || (it.cost != null && !afford && !it.max) || it.max;
    const pressed = shop.mode === it.id || (it.id === 'mirror' && shop.mode === 'aim' && shop.aiming && shop.aiming.isNew);
    const pips = it.levels ? `<span class="pips">${Array.from({ length: it.levels }, (_, i) => `<i class="${i < it.lv ? 'on' : ''}"></i>`).join('')}</span>` : '';
    const cost = it.max ? `<span class="cost max">Complete</span>`
      : it.cost != null ? `<span class="cost"><svg class="ico"><use href="#i-ember"/></svg>${it.cost}</span>` : `<span class="cost"></span>`;
    return `<button class="item" type="button" data-id="${it.id}" ${dis && !pressed ? 'disabled' : ''} aria-pressed="${pressed}">
      <span class="nm">${it.name}${pips}</span>${cost}<span class="ds">${it.ds}</span></button>`;
  }).join('');
  list.innerHTML = html;
  $('s-embers').textContent = G.embers;
  $('s-hp').textContent = Math.ceil(G.hp);
  const hints = {
    lantern: 'Click open ground to set the lantern down. Right-click or Esc to cancel.',
    mirror: 'Click open ground to set the reflector down.',
    aim: 'Move the pointer to aim the reflected beam, then click. Your lamp must shine on it to work.',
    remove: 'Click a lantern or reflector to take it down.',
  };
  $('place-hint').textContent = hints[shop.mode] || (structures.some(s => s.type === 'mirror') ? 'Click a reflector to re-aim it.' : '');
}

function buy(id) {
  Sound.init();
  if (id === 'lantern' || id === 'mirror' || id === 'remove') {
    setShopMode(shop.mode === id ? null : id);
    return;
  }
  if (id === 'flares') { if (!pay(CFG.FLARE_PACK_COST)) return; G.flares += CFG.FLARE_PACK; Sound.coin(); }
  else if (id === 'repair') { if (G.hp >= CFG.HP || !pay(CFG.REPAIR_COST)) return; G.hp = Math.min(CFG.HP, G.hp + CFG.REPAIR_HP); Sound.place(); }
  else if (id.startsWith('up:')) {
    const u = UPG[id.slice(3)], lv = G.up[u.id];
    if (lv >= u.costs.length || !pay(u.costs[lv])) return;
    G.up[u.id]++; Sound.coin();
    if (u.id === 'oil') refillLanterns();
  }
  renderShop();
}
function pay(n) {
  if (G.embers < n) { Sound.deny(); return false; }
  G.embers -= n; return true;
}

function setShopMode(mode) {
  if (shop.mode === 'aim' && shop.aiming) {
    const s = shop.aiming;
    if (s.isNew) removeStructure(s); else { s.yaw = s.prevYaw; orientReflector(s); }
    shop.aiming = null;
  }
  shop.mode = mode;
  if (shop.ghost) { scene.remove(shop.ghost); shop.ghost = null; }
  shop.ghostRing.visible = false;
  if (mode === 'lantern' || mode === 'mirror') {
    shop.ghost = mode === 'lantern' ? lanternMesh() : reflectorMesh();
    shop.ghost.traverse(o => {
      if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.55; o.material.depthWrite = false; }
    });
    shop.ghost.visible = false;
    scene.add(shop.ghost);
  }
  renderShop();
}

function placementValid(x, z) {
  const r = Math.hypot(x, z), a = Math.atan2(z, x);
  if (r < 6.5 || r > shoreRadius(a) - 1.5) return false;
  if (terrainH(x, z) < 0.3) return false;
  if (!farFromObstacles(x, z, 0.9)) return false;
  for (const s of structures) if (Math.hypot(s.x - x, s.z - z) < 2.6) return false;
  return true;
}
function nearestStructure(x, z, within) {
  let best = null, bd = within;
  for (const s of structures) { const d = Math.hypot(s.x - x, s.z - z); if (d < bd) { bd = d; best = s; } }
  return best;
}

/* called every frame while it's day, with the ground point under the pointer */
function updateShopPointer(p, hasPoint) {
  shop.point.copy(p);
  const ring = shop.ghostRing;
  if (shop.hover) { setHighlight(shop.hover, false); shop.hover = null; }
  if ((shop.mode === 'lantern' || shop.mode === 'mirror') && shop.ghost) {
    shop.valid = hasPoint && placementValid(p.x, p.z);
    shop.ghost.visible = hasPoint;
    shop.ghost.position.set(p.x, terrainH(p.x, p.z), p.z);
    ring.visible = hasPoint;
    ring.material.color.set(shop.valid ? 0xffc070 : 0xff4a3a);
    placeGroundRing(ring, p.x, p.z, shop.mode === 'lantern' ? CFG.LANTERN_R : 1.2);
    canvas.style.cursor = shop.valid ? 'copy' : 'not-allowed';
  } else if (shop.mode === 'aim' && shop.aiming) {
    const s = shop.aiming;
    if (hasPoint && Math.hypot(p.x - s.x, p.z - s.z) > 1) { s.yaw = Math.atan2(p.x - s.x, p.z - s.z); orientReflector(s); }
    canvas.style.cursor = 'crosshair';
  } else if (shop.mode === 'remove' || shop.mode === null) {
    const s = hasPoint ? nearestStructure(p.x, p.z, 2.2) : null;
    if (s && (shop.mode === 'remove' || s.type === 'mirror')) { shop.hover = s; setHighlight(s, true); canvas.style.cursor = 'pointer'; }
    else canvas.style.cursor = shop.mode === 'remove' ? 'not-allowed' : 'default';
  }
  // reflectors preview their beam during the day
  for (const s of structures) if (s.type === 'mirror') {
    const show = G.state === 'day';
    s.shaft.visible = show;
    if (show) {
      aimShaft(s.shaft, new THREE.Vector3(s.ox, s.oy, s.oz), s.dir, CFG.MIRROR_RANGE, CFG.MIRROR_ANGLE * 0.98);
      s.shaft.userData.u.uStrength.value = s === shop.aiming ? 0.9 : 0.35;
    }
  }
}
function setHighlight(s, on) {
  s.mesh.traverse(o => { if (o.isMesh && o.material && o.material.emissive && o.material !== MAT.mirror) {
    if (on) { o.userData.e0 = o.userData.e0 == null ? o.material.emissiveIntensity : o.userData.e0; }
  } });
  if (!s.hl) s.hl = groundRing(1.3, 0.12, 32, 0xffffff, 0.5);
  if (on) { placeGroundRing(s.hl, s.x, s.z); scene.add(s.hl); s.hl.material.color.set(shop.mode === 'remove' ? 0xff6a50 : 0xffd27a); }
  else scene.remove(s.hl);
}

function shopClick(button) {
  if (button === 2) { if (shop.mode) { setShopMode(null); Sound.ui(); } return; }
  const p = shop.point;
  if (shop.mode === 'lantern' || shop.mode === 'mirror') {
    const type = shop.mode, cost = type === 'lantern' ? CFG.LANTERN_COST : CFG.MIRROR_COST;
    if (!shop.valid) { Sound.deny(); return; }
    if (G.embers < cost) { Sound.deny(); setShopMode(null); return; }
    if (type === 'lantern') {
      G.embers -= cost;
      addStructure('lantern', p.x, p.z, 0);
      Sound.place();
      setShopMode(null);
    } else {
      const s = addStructure('mirror', p.x, p.z, Math.atan2(p.x, p.z));
      s.isNew = true; s.prevYaw = s.yaw;
      Sound.place();
      if (shop.ghost) { scene.remove(shop.ghost); shop.ghost = null; }
      shop.ghostRing.visible = false;
      shop.mode = 'aim'; shop.aiming = s;
      renderShop();
    }
  } else if (shop.mode === 'aim' && shop.aiming) {
    const s = shop.aiming;
    if (s.isNew) {
      if (!pay(CFG.MIRROR_COST)) { removeStructure(s); shop.aiming = null; shop.mode = null; renderShop(); return; }
      s.isNew = false;
    }
    shop.aiming = null; shop.mode = null;
    Sound.place();
    renderShop();
  } else if (shop.mode === 'remove') {
    const s = shop.hover;
    if (!s) { Sound.deny(); return; }
    setHighlight(s, false); shop.hover = null;
    G.embers += sellValue(s);
    removeStructure(s);
    Sound.coin();
    setShopMode(structures.length ? 'remove' : null);
  } else if (shop.mode === null && shop.hover && shop.hover.type === 'mirror') {
    const s = shop.hover; setHighlight(s, false); shop.hover = null;
    s.prevYaw = s.yaw; s.isNew = false;
    shop.mode = 'aim'; shop.aiming = s;
    renderShop();
  }
}

function initShop() {
  shop.ghostRing = groundRing(CFG.LANTERN_R, 0.16, 64, 0xffc070, 0.5);
  shop.ghostRing.visible = false; scene.add(shop.ghostRing);
  $('shop-list').addEventListener('click', (e) => {
    const b = e.target.closest('.item'); if (!b || b.disabled) return;
    buy(b.dataset.id);
  });
  $('b-dusk').addEventListener('click', () => { Sound.init(); setShopMode(null); beginDusk(); });
}

function openShop(note) {
  $('shop-eyebrow').textContent = `Morning after night ${G.night}`;
  $('shop-title').textContent = 'The workshop';
  $('shop-note').textContent = note || '';
  $('b-dusk').textContent = `Light the lamp for night ${G.night + 1}`;
  $('shop').hidden = false;
  setShopMode(null);
}
function closeShop() {
  setShopMode(null);
  $('shop').hidden = true;
  canvas.style.cursor = '';
  for (const s of structures) if (s.type === 'mirror') s.shaft.visible = false;
}
