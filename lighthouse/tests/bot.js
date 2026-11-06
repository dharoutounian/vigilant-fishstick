// A bot keeper: plays whole games at accelerated speed so the nights can be balanced
// with numbers. Shared by balance.test.js; also runnable on its own:
//   node lighthouse/tests/bot.js [difficulty 0-2] [nights]
const { launch, loadGame } = require('./harness');

/* runs inside the page */
function botGame(diff, nights, opts) {
  const L = window.__LH, G = L.G, beam = L.beam, STEP = 1 / 60;
  opts = opts || {};
  G.paused = true;                      // the real-time loop stands aside; the bot drives the clock
  L.settings.tips = false;
  L.newGame(diff);
  const report = [];
  const st = { t: 0, target: null };
  const lamp = L.W.lampPos;
  const night = { minD: 99, attackT: 0, maxAlive: 0 };
  function think() {
    let alive = 0;
    for (const k of L.monsters) {
      if (k.dead) continue; alive++;
      const d = Math.hypot(k.x, k.z); if (d < night.minD) night.minD = d;
      if (k.state === 'attack' && !k.held) night.attackT += STEP;
    }
    if (alive > night.maxAlive) night.maxAlive = alive;
    st.t -= STEP;
    if (st.t <= 0) {
      st.t = opts.react || 0.15;
      st.noise = (Math.random() - 0.5) * 2 * (opts.noise || 0);
      let best = null, bs = 1e9;
      for (const m of L.monsters) {
        if (m.dead) continue;
        const d = Math.hypot(m.x, m.z);
        let s = d - (m.state === 'attack' ? 40 : 0) - (m.type === 'snuffer' ? 6 : 0) + (m.state === 'emerge' ? 8 : 0);
        if (m === st.target && m.byBeam) s -= 14;
        if (s < bs) { bs = s; best = m; }
      }
      st.target = best;
    }
    const m = st.target;
    L.input.focusKey = false;
    if (opts.idle) return;
    if (m && !m.dead) {
      beam.tyaw = Math.atan2(m.x - lamp.x, m.z - lamp.z) + (st.noise || 0);
      const hd = Math.hypot(m.x - lamp.x, m.z - lamp.z);
      beam.tpitch = Math.max(-1.45, Math.min(0.05, Math.atan2(m.y + m.def.size * 0.75 - lamp.y, Math.max(hd, 0.5))));
      if (m.byBeam && beam.heat < 0.8 && !beam.overheat && !opts.noFocus) L.input.focusKey = true;
    }
    // flare the foot of the tower when it gets crowded
    if (G.flares > 0 && L.flares.length === 0) {
      const near = L.monsters.filter(k => !k.dead && Math.hypot(k.x, k.z) < 11);
      if (near.length >= 3) {
        const cx = near.reduce((a, k) => a + k.x, 0) / near.length, cz = near.reduce((a, k) => a + k.z, 0) / near.length;
        L.throwFlare(cx, cz);
      }
    }
  }
  const PLAN = ['lantern', 'gears', 'lens', 'lantern', 'aperture', 'lens', 'gears', 'mirror', 'oil', 'aperture', 'lantern', 'lens', 'gears', 'oil', 'aperture', 'oil'];
  function shopping() {
    if (opts.noShop) return;
    if (G.hp < 55) while (G.hp < 90 && G.embers >= L.CFG.REPAIR_COST) L.buy('repair');
    for (const item of PLAN) {
      if (item === 'lantern' || item === 'mirror') {
        const have = L.structures.filter(s => s.type === item).length;
        const cost = item === 'lantern' ? L.CFG.LANTERN_COST : L.CFG.MIRROR_COST;
        const want = PLAN.slice(0, PLAN.indexOf(item) + 1).filter(x => x === item).length;
        if (have >= want || G.embers < cost) continue;
        for (let k = 0; k < 40; k++) {
          const a = Math.random() * Math.PI * 2, r = item === 'lantern' ? 8 + Math.random() * 3 : 12 + Math.random() * 6;
          const x = Math.sin(a) * r, z = Math.cos(a) * r;
          if (!L.placementValid(x, z)) continue;
          G.embers -= cost;
          const s = L.addStructure(item, x, z, a + Math.PI / 2);
          break;
        }
      } else if (item.length > 3) {
        const u = L.UPG[item]; const lv = G.up[item];
        if (lv < u.costs.length && G.embers >= u.costs[lv]) L.buy('up:' + item);
      }
    }
  }
  let guard = 0;
  while (guard++ < 400000) {
    if (G.state === 'dusk' || G.state === 'night' || G.state === 'dawn' || G.state === 'over') { think(); L.tick(STEP); }
    if (G.state === 'over') {
      for (let i = 0; i < 60; i++) L.tick(STEP);
      report.push({ night: G.night, lost: true, at: +(G.nightT / G.nightLen).toFixed(2), kills: G.stats.kills, maxAlive: night.maxAlive });
      break;
    }
    if (G.state === 'day') {
      report.push({ night: G.night, hp: Math.round(G.hp), embers: G.embers, kills: G.totals.kills, minD: +night.minD.toFixed(1),
        attackT: +night.attackT.toFixed(1), maxAlive: night.maxAlive, up: Object.values(G.up).join(''), built: L.structures.length });
      night.minD = 99; night.attackT = 0; night.maxAlive = 0;
      if (G.night >= nights) break;
      shopping();
      L.beginDusk();
    }
    if (G.state === 'won') { report.push({ night: G.night, won: true, hp: Math.round(G.hp) }); break; }
  }
  L.input.focusKey = false;
  return report;
}

async function runBot(page, diff, nights, opts) {
  return page.evaluate(botGame.toString().replace(/^function botGame/, '(function botGame') + `)(${diff}, ${nights}, ${JSON.stringify(opts || {})})`);
}

module.exports = { runBot };

if (require.main === module) {
  (async () => {
    const diff = +(process.argv[2] || 1), nights = +(process.argv[3] || 7);
    const { browser, page, errors } = await launch({ width: 320, height: 200 });
    await loadGame(page, { quality: 'low' });
    const t0 = Date.now();
    const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? +a.split('=')[1] : d; };
    const human = process.argv.includes('--human'), novice = process.argv.includes('--novice');
    const rep = await runBot(page, diff, nights, { idle: process.argv.includes('--idle'),
      react: arg('react', novice ? 1.3 : human ? 0.8 : 0), noise: arg('noise', novice ? 0.12 : human ? 0.07 : 0),
      noFocus: novice || process.argv.includes('--nofocus') });
    rep.forEach(r => console.log(JSON.stringify(r)));
    console.log('took', ((Date.now() - t0) / 1000).toFixed(1) + 's', errors.length ? '\nERRORS ' + errors.join('\n') : '');
    await browser.close();
  })();
}
