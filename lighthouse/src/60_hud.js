/* =====================================================================
   HUD: the watch clock, purse, meters, keeper's log, radar
   ===================================================================== */

const HUD = {
  heatFlash: 0, hurtT: 0, last: {}, shake: 0,
  init() {
    this.el = {
      night: $('h-night'), of: $('h-of'), clock: $('h-clock'), trackI: document.querySelector('#track i'), trackB: document.querySelector('#track b'),
      embers: $('h-embers'), flares: $('h-flares'), hp: $('h-hp'), hpI: document.querySelector('#hp i'), hpBox: $('hp'),
      heat: $('heat'), heatI: document.querySelector('#heat i'), heatState: $('heat-state'), feed: $('feed'),
      vig: $('vignette'), focus: $('b-focus'), flare: $('b-flare'),
    };
    this.radar = $('radar').getContext('2d');
  },
  set(key, el, prop, val) {
    if (this.last[key] === val) return;
    this.last[key] = val;
    if (prop === 'text') el.textContent = val; else el.style[prop] = val;
  },
  clockText() {
    const k = G.nightLen ? clamp(G.nightT / G.nightLen, 0, 1) : 0;
    const mins = (CFG.NIGHT_START_HOUR + k * (CFG.NIGHT_END_HOUR - CFG.NIGHT_START_HOUR)) * 60;
    const h24 = Math.floor(mins / 60) % 24, mm = Math.floor(mins % 60 / 5) * 5;
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${h12}:${String(mm).padStart(2, '0')} ${h24 < 12 ? 'am' : 'pm'}`;
  },
  update(dt) {
    const e = this.el;
    const k = G.nightLen ? clamp(G.nightT / G.nightLen, 0, 1) : 0;
    this.set('night', e.night, 'text', 'Night ' + G.night);
    this.set('of', e.of, 'text', G.night > CFG.NIGHTS ? 'endless watch' : 'of ' + CFG.NIGHTS);
    this.set('clock', e.clock, 'text', this.clockText());
    this.set('track', e.trackI, 'width', (k * 100).toFixed(1) + '%');
    this.set('trackB', e.trackB, 'left', (k * 100).toFixed(1) + '%');
    this.set('embers', e.embers, 'text', String(G.embers));
    this.set('flares', e.flares, 'text', String(G.flares));
    this.set('hp', e.hp, 'text', String(Math.ceil(G.hp)));
    this.set('hpI', e.hpI, 'width', (G.hp / CFG.HP * 100).toFixed(1) + '%');
    this.set('heatI', e.heatI, 'width', (beam.heat * 100).toFixed(1) + '%');
    const hs = beam.overheat ? 'Cooling' : beam.focus > 0.5 ? 'Focused' : '';
    if (this.last.hs !== hs) { this.last.hs = hs; e.heatState.textContent = hs; e.heatState.className = beam.overheat ? 'warn' : ''; e.heat.classList.toggle('over', beam.overheat); }
    e.focus.classList.toggle('on', beam.focus > 0.5);
    e.focus.disabled = beam.overheat;
    e.flare.disabled = G.flares <= 0;
    this.hurtT -= dt;
    if (this.hurtT < 0 && e.vig.classList.contains('hurt')) e.vig.classList.remove('hurt');
    this.drawRadar();
  },
  hurt(m) {
    if (this.hurtT > 0.25) return;
    this.hurtT = 0.45;
    this.el.vig.classList.add('hurt');
    this.el.hpBox.classList.remove('hit'); void this.el.hpBox.offsetWidth; this.el.hpBox.classList.add('hit');
    Sound.thud(m.type === 'brute' || m.type === 'leviathan' ? 0.7 : 0.4);
    camCtl.shake = Math.max(camCtl.shake, m.type === 'leviathan' ? 0.6 : 0.25);
    if (!G.warnedBase && G.state === 'night') {
      G.warnedBase = true;
      log('Something is clawing at the door. Tilt the beam down onto the tower’s foot.', 'bad');
    }
  },
  bump(id) {
    const el = $(id); if (!el) return;
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  },
  banner(h, p) {
    const b = $('banner');
    $('banner-h').textContent = h; $('banner-p').textContent = p || '';
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  },
  log(text, kind) {
    const d = document.createElement('div');
    d.className = 'entry' + (kind ? ' ' + kind : '');
    const stamp = G.state === 'night' ? this.clockText() : '';
    d.innerHTML = (stamp ? `<em>${stamp}</em>` : '') + text;
    this.el.feed.appendChild(d);
    while (this.el.feed.children.length > 3) this.el.feed.firstChild.remove();
    setTimeout(() => d.remove(), 6100);
  },
  clearLog() { this.el.feed.innerHTML = ''; },

  drawRadar() {
    const g = this.radar, S = 300, C = S / 2, R = 140, scale = R / 68;
    g.clearRect(0, 0, S, S);
    let fx, fz;
    if (camCtl.mode === 'keeper') { fx = Math.sin(beam.yaw); fz = Math.cos(beam.yaw); }
    else { fx = -Math.sin(camCtl.az); fz = -Math.cos(camCtl.az); }
    const rx = -fz, rz = fx;   // right of forward
    const P = (x, z) => [C + (x * rx + z * rz) * scale, C - (x * fx + z * fz) * scale];
    g.save();
    g.beginPath(); g.arc(C, C, R + 8, 0, TAU); g.clip();
    // island
    g.beginPath();
    for (let i = 0; i <= 72; i++) {
      const a = i / 72 * TAU, r = shoreRadius(a), [px, py] = P(Math.cos(a) * r, Math.sin(a) * r);
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.fillStyle = 'rgba(70,82,64,.38)'; g.fill();
    g.strokeStyle = 'rgba(200,215,220,.25)'; g.lineWidth = 1.5; g.stroke();
    // rocks
    g.fillStyle = 'rgba(150,160,165,.45)';
    for (const o of W.obstacles) { const [px, py] = P(o.x, o.z); g.beginPath(); g.arc(px, py, Math.max(1.5, o.r * scale), 0, TAU); g.fill(); }
    // lit ground: the beam's footprint, drawn from where its cone meets the ground
    const L = W.lampPos;
    if (beam.power > 0.05) {
      const near = beam.pitch - beam.angle < -0.01 ? Math.max(0, (L.y - 1) / Math.tan(-(beam.pitch - beam.angle))) : 0;
      const far = beam.pitch + beam.angle < -0.01 ? Math.min(66, (L.y - 1) / Math.tan(-(beam.pitch + beam.angle))) : 66;
      const half = beam.angle * 1.05 / Math.max(0.3, Math.cos(beam.pitch));
      g.beginPath();
      for (let i = 0; i <= 12; i++) { const a = beam.yaw - half + i / 12 * half * 2; const [px, py] = P(Math.sin(a) * near, Math.cos(a) * near); i ? g.lineTo(px, py) : g.moveTo(px, py); }
      for (let i = 12; i >= 0; i--) { const a = beam.yaw - half + i / 12 * half * 2; const [px, py] = P(Math.sin(a) * far, Math.cos(a) * far); g.lineTo(px, py); }
      g.closePath();
      g.fillStyle = `rgba(255,214,130,${0.32 * beam.power})`; g.fill();
    }
    for (const s of structures) {
      const [px, py] = P(s.x, s.z);
      if (s.type === 'lantern') {
        g.beginPath(); g.arc(px, py, CFG.LANTERN_R * scale, 0, TAU);
        g.fillStyle = s.oil > 0 ? 'rgba(255,190,100,.18)' : 'rgba(120,120,120,.08)'; g.fill();
        if (s.oil > 0) {
          g.beginPath(); g.arc(px, py, CFG.LANTERN_R * scale, -Math.PI / 2, -Math.PI / 2 + TAU * s.oil / s.cap);
          g.strokeStyle = 'rgba(255,200,110,.7)'; g.lineWidth = 2; g.stroke();
        }
        g.fillStyle = s.oil > 0 ? '#ffc66a' : '#666'; g.fillRect(px - 2.5, py - 2.5, 5, 5);
      } else {
        if (s.power > 0.1 || G.state === 'day') {
          const a0 = s.yaw, h = CFG.MIRROR_ANGLE * 1.1, far = CFG.MIRROR_RANGE * 0.95;
          const [ax, ay] = P(s.x + Math.sin(a0 - h) * far, s.z + Math.cos(a0 - h) * far), [bx, by] = P(s.x + Math.sin(a0 + h) * far, s.z + Math.cos(a0 + h) * far);
          g.beginPath(); g.moveTo(px, py); g.lineTo(ax, ay); g.lineTo(bx, by); g.closePath();
          g.fillStyle = `rgba(255,214,130,${G.state === 'day' ? 0.15 : 0.3 * s.power})`; g.fill();
        }
        g.fillStyle = '#e8eef2'; g.beginPath(); g.moveTo(px, py - 4); g.lineTo(px + 4, py); g.lineTo(px, py + 4); g.lineTo(px - 4, py); g.fill();
      }
    }
    for (const f of flares) {
      const [px, py] = P(f.burning ? f.x : f.x, f.z);
      if (f.burning) { g.beginPath(); g.arc(px, py, CFG.FLARE_R * scale, 0, TAU); g.fillStyle = 'rgba(255,100,70,.2)'; g.fill(); }
      g.fillStyle = '#ff7a5a'; g.beginPath(); g.arc(px, py, 2.5, 0, TAU); g.fill();
    }
    // the things in the dark
    for (const m of monsters) {
      const [px, py] = P(m.x, m.z);
      const r = m.type === 'leviathan' ? 6 : m.type === 'brute' ? 4 : m.type === 'skitter' ? 2 : 3;
      g.fillStyle = m.dmgRate > 0 ? '#ffb347' : m.held ? '#d9c79a' : m.type === 'snuffer' ? '#a9d8ff' : '#ff4f3c';
      g.beginPath(); g.arc(px, py, r, 0, TAU); g.fill();
    }
    // tower
    g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(C, C, 4, 0, TAU); g.fill();
    g.restore();
    // fronts the tide is coming from
    if (G.state === 'night') for (const a of G.fronts) {
      const ex = Math.sin(a), ez = Math.cos(a), [px, py] = P(ex * 64, ez * 64);
      const ang = Math.atan2(py - C, px - C);
      g.save(); g.translate(C + Math.cos(ang) * (R + 2), C + Math.sin(ang) * (R + 2)); g.rotate(ang);
      g.fillStyle = 'rgba(255,90,70,.85)'; g.beginPath(); g.moveTo(4, 0); g.lineTo(-6, -6); g.lineTo(-6, 6); g.closePath(); g.fill();
      g.restore();
    }
    // north mark
    const [nx, ny] = P(0, -64), na = Math.atan2(ny - C, nx - C);
    g.fillStyle = 'rgba(227,233,234,.75)'; g.font = '600 20px Alegreya Sans, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('N', C + Math.cos(na) * (R - 12), C + Math.sin(na) * (R - 12));
  },
};
function log(text, kind) { if (kind === 'tip' && !settings.tips) return; HUD.log(text, kind); }
