// A whole watch driven through the real interface: mouse aiming, focus, flares,
// the keeper's view without pointer lock, pause, the workshop's buy/place/aim/remove,
// the next night, losing, retrying, and leaving.
const { launch, loadGame, check, done } = require('./harness');

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const { browser, page, errors } = await launch({ width: 900, height: 560 });
  // sandboxed frames refuse pointer lock; prove the game plays without it
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.requestPointerLock = function () { return Promise.reject(new Error('refused')); };
  });
  await loadGame(page, { quality: 'low' });
  console.log('Lighthouse: a watch through the real interface');
  const ev = (fn, arg) => page.evaluate(fn, arg);

  check(await page.isVisible('#menu'), 'the title screen shows');
  await page.click('.diff[data-d="1"]');
  await page.click('#b-start');
  await sleep(300);
  check(await page.isVisible('#hud'), 'lighting the lamp starts the watch');
  await ev(() => { const L = window.__LH; L.G.schedule.length = 0; L.settings.tips = true; });
  await page.waitForFunction(() => window.__LH.G.state === 'night', null, { timeout: 20000 });
  check(true, 'dusk turns to night');

  // aim with the mouse at a known patch of ground
  const target = { x: 18, z: -16 };
  const scr = await ev(t => window.__LH.worldToScreen(new THREE.Vector3(t.x, window.__LH.terrainH(t.x, t.z), t.z)), target);
  await page.mouse.move(scr.x - 40, scr.y - 10);
  await page.mouse.move(scr.x, scr.y, { steps: 5 });
  await sleep(2500);
  const aimed = await ev(t => { const b = window.__LH.beam; return { want: Math.atan2(t.x, t.z), tyaw: b.tyaw, yaw: b.yaw }; }, target);
  const err = Math.abs(Math.atan2(Math.sin(aimed.yaw - aimed.want), Math.cos(aimed.yaw - aimed.want)));
  check(err < 0.12, 'the beam swings to where the mouse points', 'off by ' + (err * 57.3).toFixed(1) + '°');

  const until = async (fn, ms) => { try { await page.waitForFunction(fn, null, { timeout: ms || 6000 }); return true; } catch (e) { return false; } };
  await page.mouse.down();
  const fOn = await until(() => window.__LH.beam.focus > 0.8);
  await page.mouse.up();
  const fOff = await until(() => window.__LH.beam.focus < 0.2);
  check(fOn && fOff, 'holding the left button focuses the beam, letting go widens it');
  await page.keyboard.down(' ');
  const kOn = await until(() => window.__LH.beam.focus > 0.8);
  await page.keyboard.up(' ');
  const kOff = await until(() => window.__LH.beam.focus < 0.2);
  check(kOn && kOff, 'holding Space focuses the beam');

  const f0 = await ev(() => window.__LH.G.flares);
  await page.mouse.click(scr.x, scr.y, { button: 'right' });
  await sleep(200);
  const f1 = await ev(() => ({ n: window.__LH.G.flares, live: window.__LH.flares.length }));
  check(f1.n === f0 - 1 && f1.live === 1, 'right-click throws a flare', `${f0} → ${f1.n}`);
  await page.keyboard.press('f'); await sleep(200);
  check(await ev(() => window.__LH.flares.length) === 2, 'F throws another');

  // the on-screen buttons, as a touch player would use them
  await ev(() => { window.__LH.clearFlares(); window.__LH.G.flares = 1; });
  await page.click('#b-flare');
  const fb = await ev(() => ({ n: window.__LH.G.flares, live: window.__LH.flares.length }));
  check(fb.n === 0 && fb.live === 1, 'the Flare button throws a flare');
  const box = await page.locator('#b-focus').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const bOn = await until(() => window.__LH.beam.focus > 0.8);
  await page.mouse.up();
  const bOff = await until(() => window.__LH.beam.focus < 0.2);
  check(bOn && bOff, 'holding the Focus button focuses the beam');

  // keeper's view, free-look with no pointer lock
  await page.mouse.move(480, 300);
  await page.keyboard.press('v'); await sleep(300);
  const k0 = await ev(() => ({ mode: window.__LH.camCtl.mode, yaw: window.__LH.camCtl.kYaw, paused: window.__LH.G.paused }));
  await page.mouse.move(380, 300, { steps: 8 }); await sleep(300);
  const k1 = await ev(() => ({ yaw: window.__LH.camCtl.kYaw, tyaw: window.__LH.beam.tyaw }));
  check(k0.mode === 'keeper' && !k0.paused, 'V opens the keeper’s view even without pointer lock');
  check(Math.abs(k1.yaw - k0.yaw) > 0.1 && Math.abs(k1.tyaw - k1.yaw) < 1e-6, 'moving the mouse looks around and the lamp follows', (k1.yaw - k0.yaw).toFixed(2));
  await page.keyboard.down('ArrowLeft'); await sleep(300); await page.keyboard.up('ArrowLeft');
  const k2 = await ev(() => window.__LH.camCtl.kYaw);
  check(k2 - k1.yaw > 0.2, 'arrow keys turn the view too', (k2 - k1.yaw).toFixed(2));
  await page.keyboard.press('v'); await sleep(200);
  check(await ev(() => window.__LH.camCtl.mode) === 'over', 'V steps back to the overview');

  await page.keyboard.press('Escape'); await sleep(200);
  const paused = await ev(() => ({ p: window.__LH.G.paused, t: window.__LH.G.nightT }));
  await sleep(500);
  const still = await ev(() => window.__LH.G.nightT);
  check(paused.p && await page.isVisible('#pause') && still === paused.t, 'Esc pauses the night');
  await page.click('#b-resume'); await sleep(200);
  check(!(await ev(() => window.__LH.G.paused)), 'Resume carries on');

  // dawn and the workshop
  await ev(() => { const L = window.__LH; L.G.nightT = L.G.nightLen - 0.02; });
  await page.waitForSelector('#shop:not([hidden])', { timeout: 30000 });
  check(true, 'dawn comes and the workshop opens');
  await ev(() => { window.__LH.G.embers = 300; window.__LH.buy('refresh'); });   // re-render the list with the new purse
  await page.click('.item[data-id="up:gears"]');
  const g = await ev(() => ({ lv: window.__LH.G.up.gears, e: window.__LH.G.embers }));
  check(g.lv === 1 && g.e === 260, 'buying Clockwork upgrades the gears', `level ${g.lv}, embers ${g.e}`);

  // find open ground the camera can see, left of the workshop panel
  const spots = await ev(() => {
    const L = window.__LH, out = [];
    for (let r = 9; r <= 24 && out.length < 6; r += 3) for (let a = 0; a < 6.28 && out.length < 6; a += 0.35) {
      const x = Math.sin(a) * r, z = Math.cos(a) * r;
      if (!L.placementValid(x, z)) continue;
      if (out.some(o => Math.hypot(o.x - x, o.z - z) < 4)) continue;
      const v = new window.THREE.Vector3(x, L.terrainH(x, z), z), s = L.worldToScreen(v);
      if (s.x < 60 || s.x > innerWidth - 400 || s.y < 80 || s.y > innerHeight - 60) continue;
      out.push({ x, z, sx: s.x, sy: s.y });
    }
    return out;
  });
  check(spots.length >= 3, 'there is open ground to build on', spots.length + ' spots');
  await page.click('.item[data-id="lantern"]');
  await page.mouse.move(spots[0].sx + 3, spots[0].sy); await page.mouse.move(spots[0].sx, spots[0].sy);
  await sleep(150);
  await page.mouse.click(spots[0].sx, spots[0].sy);
  const lan = await ev(() => ({ n: window.__LH.structures.filter(s => s.type === 'lantern').length, e: window.__LH.G.embers }));
  check(lan.n === 1 && lan.e === 235, 'a lantern is set down where you click', `embers ${lan.e}`);

  await page.click('.item[data-id="mirror"]');
  await page.mouse.move(spots[1].sx, spots[1].sy); await sleep(150);
  await page.mouse.click(spots[1].sx, spots[1].sy);
  const mode = await ev(() => window.__LH.shop.mode);
  await page.mouse.move(spots[1].sx - 110, spots[1].sy + 20, { steps: 4 }); await sleep(150);
  await page.mouse.click(spots[1].sx - 110, spots[1].sy + 20);
  const mir = await ev(() => ({ n: window.__LH.structures.filter(s => s.type === 'mirror').length, e: window.__LH.G.embers, mode: window.__LH.shop.mode }));
  check(mode === 'aim' && mir.n === 1 && mir.e === 175 && mir.mode === null, 'a reflector is placed, aimed with the pointer, and paid for', `embers ${mir.e}`);

  await page.click('.item[data-id="remove"]');
  await page.mouse.move(spots[0].sx, spots[0].sy); await sleep(150);
  await page.mouse.click(spots[0].sx, spots[0].sy);
  const rem = await ev(() => ({ n: window.__LH.structures.length, e: window.__LH.G.embers }));
  check(rem.n === 1 && rem.e === 190, 'taking a lantern down refunds 60%', `embers ${rem.e}`);

  await page.click('#b-dusk');
  await sleep(300);
  check(await ev(() => window.__LH.G.night) === 2 && await page.isHidden('#shop'), 'lighting the lamp starts night 2');

  // lose, then retry the same night with the same island
  await ev(() => { const L = window.__LH; L.G.schedule.length = 0; L.G.hp = 1; L.aim(Math.PI, -0.2);
    for (let i = 0; i < 3; i++) L.spawnMonster('brute', 0, { x: Math.sin(i * 2) * 4.6, z: Math.cos(i * 2) * 4.6, fall: true }); });
  await page.waitForSelector('#end:not([hidden])', { timeout: 30000 });
  const endTitle = await page.textContent('#end-title');
  check(/went out/.test(endTitle), 'when the lighthouse falls, the light goes out', endTitle);
  await page.click('#end-btns .btn.primary');
  await sleep(300);
  const retry = await ev(() => ({ night: window.__LH.G.night, hp: window.__LH.G.hp, n: window.__LH.structures.length, state: window.__LH.G.state }));
  check(retry.night === 2 && retry.hp === 100 && retry.n === 1 && (retry.state === 'dusk' || retry.state === 'night'),
    'Try again restarts night 2 as it began', JSON.stringify(retry));

  await page.keyboard.press('Escape'); await sleep(200);
  await page.click('#b-quit'); await sleep(300);
  check(await page.isVisible('#menu') && await page.isHidden('#hud'), 'Leave the island returns to the title');

  await browser.close();
  done(errors);
})();
