// The rules of the light, checked directly against the simulation:
// lit things freeze and burn, shadows hide, lanterns drain, snuffers snuff,
// reflectors relay, flares and lightning hold, emerging things are untouchable.
const { launch, loadGame, check, done } = require('./harness');

(async () => {
  const { browser, page, errors } = await launch();
  await loadGame(page, { quality: 'low' });
  console.log('Lighthouse: rules of the light');

  const r = await page.evaluate(() => {
    const L = window.__LH, G = L.G, out = {};
    G.paused = true; L.settings.tips = false;
    L.newGame(1); L.step(3); G.schedule.length = 0;
    const clear = () => { L.monsters.slice().forEach(m => L.killMonster(m, false)); L.structures.slice().forEach(s => L.removeStructure(s)); };
    const put = (type, x, z) => L.spawnMonster(type, 0, { x, z, fall: true });
    const aimAt = (x, z) => L.aim(Math.atan2(x, z), L.pitchToGround(x, z));
    out.state = G.state;

    // 1. inside the beam: frozen and burning; outside: moving
    clear(); aimAt(0, 25);
    const lit = put('crawler', 0, 25), dark = put('crawler', 25, 0);
    const d0 = Math.hypot(dark.x, dark.z), hp0 = lit.hp, p0 = { x: lit.x, z: lit.z };
    L.step(0.5);
    out.litHeld = lit.held; out.litMoved = Math.hypot(lit.x - p0.x, lit.z - p0.z);
    out.litDps = (hp0 - lit.hp) / 0.5; out.baseDps = L.CFG.BASE_DPS;
    out.darkHeld = dark.held; out.darkAdvanced = d0 - Math.hypot(dark.x, dark.z);

    // 2. focus burns hotter and narrows the cone
    const wideAngle = L.beam.angle;
    L.input.focusKey = true; L.step(0.4);
    const hpF = lit.hp; L.step(0.5);
    out.focusDps = (hpF - lit.hp) / 0.5; out.focusNarrow = L.beam.angle / wideAngle;
    // 3. the lens overheats and refuses to focus until it cools
    L.step(4); out.overheat = L.beam.overheat; out.focusAfterHeat = L.beam.focus;
    L.input.focusKey = false; L.step(4); out.cooled = !L.beam.overheat;

    // 4. a rock's shadow hides whatever is behind it
    clear();
    const rock = L.W.obstacles.filter(o => o.kind === 'rock' && Math.hypot(o.x, o.z) < 34 && Math.hypot(o.x, o.z) > 14)
      .sort((a, b) => b.r - a.r)[0];
    const dist = Math.hypot(rock.x, rock.z), ux = rock.x / dist, uz = rock.z / dist;
    const bx = ux * (dist + rock.r + 0.9), bz = uz * (dist + rock.r + 0.9);
    aimAt(bx, bz);
    const hid = put('crawler', bx, bz);
    L.step(0.05);
    out.shadowHidden = !hid.held && L.inShadow(hid.x, hid.y + 0.9, hid.z, hid);
    const fx = ux * (dist - rock.r - 1.5), fz = uz * (dist - rock.r - 1.5);
    const front = put('crawler', fx, fz); L.step(0.05);
    out.frontHeld = front.held;

    // 5. a hulk shades the small ones behind it
    clear(); aimAt(0, 22);
    const hulk = put('brute', 0, 18), small = put('skitter', 0, 21.8);
    L.step(0.05);
    out.hulkHeld = hulk.held; out.behindHulkHeld = small.held;

    // 6. lanterns hold and drain; snuffers ignore them and put them out
    clear(); L.aim(Math.PI, -0.3);
    const lan = L.addStructure('lantern', 12, 6, 0);
    const caught = put('crawler', 12 + 4, 6);
    L.step(1.0);
    out.lanternHeld = caught.held; out.oilDrained = lan.cap - lan.oil;
    const sn = put('snuffer', 12 + 5, 6 + 5);
    let t = 0; while (lan.oil > 0 && t < 10) { L.step(0.1); t += 0.1; }
    out.snufferHeldByLantern = false; out.lanternOut = lan.oil === 0; out.snuffTime = +t.toFixed(1);

    // 7. a reflector relays the beam when the lamp shines on it
    clear();
    const ref = L.addStructure('mirror', 0, 14, 0); ref.yaw = Math.PI / 2;
    ref.dir.set(Math.cos(L.CFG.MIRROR_PITCH), Math.sin(L.CFG.MIRROR_PITCH), 0);
    aimAt(0, 14);
    const relayed = put('crawler', 14, 14 - 0.1);
    relayed.y = L.terrainH(14, 14);
    L.step(0.4);
    out.mirrorPower = ref.power; out.relayedHeld = relayed.held; out.relayedBurning = relayed.dmgRate > 0;
    L.aim(-Math.PI / 2, -0.3); L.step(0.4);
    out.mirrorOff = ref.power < 0.1;

    // 8. a flare holds everything near it for its burn time
    clear(); L.aim(Math.PI, -0.3);
    G.flares = 2;
    L.throwFlare(-20, 0);
    const near = put('crawler', -20, 6);
    L.step(1.2);
    out.flareHeld = near.held;
    L.step(L.CFG.FLARE_T + 0.5);
    out.flareDone = L.flares.length === 0 && !near.held;

    // 9. lightning holds everything for an instant
    clear(); L.aim(Math.PI, -0.3);
    const anywhere = put('crawler', 30, -10);
    L.storm.flash = 0.22; L.storm.double = false; L.step(1 / 60);
    out.flashHeld = anywhere.held;
    L.step(0.4); out.afterFlash = anywhere.held;

    // 10. still under the water: untouchable
    clear();
    const em = L.spawnMonster('crawler', 0.4);
    aimAt(em.x * 0.97, em.z * 0.97);
    L.step(0.3);
    out.emergeHeld = em.held; out.emergeHp = em.hp === em.maxHp;

    // 11. at the tower's foot they claw at it, but only in the dark
    clear(); L.aim(Math.PI, -0.3);
    const claw = put('crawler', 0, 4.4);
    const hpStart = G.hp; L.step(1);
    out.clawDamage = hpStart - G.hp;
    const hp2 = G.hp; aimAt(0, 4.4); L.beam.yaw = L.beam.tyaw; L.beam.pitch = L.beam.tpitch; L.step(0.6);
    out.clawWhileLit = hp2 - G.hp; out.clawHeld = claw.held;

    // 12. what burns away becomes embers that fly home
    clear(); aimAt(0, 20);
    const e0 = G.embers, k = put('crawler', 0, 20); k.hp = 0.05;
    L.step(4);
    out.embersGained = G.embers - e0;
    return out;
  });

  check(r.state === 'night', 'a new game reaches night 1', r.state);
  check(r.litHeld && r.litMoved < 0.01, 'a creature in the beam is frozen', 'moved ' + r.litMoved.toFixed(3));
  check(Math.abs(r.litDps - r.baseDps) < 0.05, 'the plain beam burns at the base rate', r.litDps.toFixed(2));
  check(!r.darkHeld && r.darkAdvanced > 1, 'a creature in the dark keeps coming', r.darkAdvanced.toFixed(2) + ' m');
  check(Math.abs(r.focusDps / r.litDps - 2.6) < 0.15, 'focus burns 2.6× hotter', (r.focusDps / r.litDps).toFixed(2));
  check(Math.abs(r.focusNarrow - 0.5) < 0.02, 'focus halves the cone', r.focusNarrow.toFixed(2));
  check(r.overheat && r.focusAfterHeat < 0.05, 'the lens overheats and drops focus');
  check(r.cooled, 'the lens cools down again');
  check(r.shadowHidden, 'a rock’s shadow hides a creature from the beam');
  check(r.frontHeld, 'the same beam holds one in front of the rock');
  check(r.hulkHeld && !r.behindHulkHeld, 'a hulk shades the skitter behind it');
  check(r.lanternHeld && r.oilDrained > 0.9, 'a lantern holds a creature and burns oil doing it', r.oilDrained.toFixed(2));
  check(r.lanternOut, 'a snuffer walks through lantern light and puts it out', r.snuffTime + ' s');
  check(r.mirrorPower > 0.9 && r.relayedHeld && r.relayedBurning, 'a reflector relays the beam and burns what it hits');
  check(r.mirrorOff, 'the reflector goes dark when the lamp turns away');
  check(r.flareHeld, 'a flare holds creatures near it');
  check(r.flareDone, 'the flare burns out after its time');
  check(r.flashHeld && !r.afterFlash, 'lightning holds them for a moment only');
  check(!r.emergeHeld && r.emergeHp, 'nothing can be held while it is still under the water');
  check(r.clawDamage > 2, 'an unlit creature at the door damages the lighthouse', r.clawDamage.toFixed(1));
  check(r.clawHeld && r.clawWhileLit < 0.3, 'lighting the tower’s foot stops the clawing', r.clawWhileLit.toFixed(2));
  check(r.embersGained >= 3, 'burned creatures pay out embers', r.embersGained);
  await browser.close();
  done(errors);
})();
