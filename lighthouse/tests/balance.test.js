// Balance guard rails, played by the bot keeper at accelerated speed:
// leaving the beam still loses the first night, a decent keeper survives Calm seas,
// and a sharp one survives the Squall.
const { launch, loadGame, check, done } = require('./harness');
const { runBot } = require('./bot');

(async () => {
  const { browser, page, errors } = await launch({ width: 320, height: 200 });
  await loadGame(page, { quality: 'low' });
  console.log('Lighthouse: balance');

  const idle = await runBot(page, 1, 7, { idle: true });
  const last = idle[idle.length - 1];
  check(last.lost && last.night === 1, 'a keeper who never moves the beam loses the first night', JSON.stringify(last));

  const calm = await runBot(page, 0, 7, { react: 0.8, noise: 0.07 });
  const cEnd = calm[calm.length - 1];
  check(cEnd.won, 'a steady keeper sees out seven nights of calm seas', 'hp ' + cEnd.hp);

  const squall = await runBot(page, 1, 7, {});
  const sEnd = squall[squall.length - 1];
  check(sEnd.won, 'a sharp keeper sees out the squall', 'hp ' + sEnd.hp);
  const totals = squall.filter(r => r.kills != null).map(r => r.kills);
  const perNight = totals.map((k, i) => k - (i ? totals[i - 1] : 0));
  check(perNight.every((k, i) => i === 0 || k > perNight[i - 1]), 'every night brings more of them', perNight.join(' → '));

  const slow = await runBot(page, 2, 7, { react: 1.3, noise: 0.12, noFocus: true });
  const tEnd = slow[slow.length - 1];
  check(!tEnd.won, 'a slow keeper who never focuses cannot survive the tempest', 'fell on night ' + tEnd.night);

  await browser.close();
  done(errors);
})();
