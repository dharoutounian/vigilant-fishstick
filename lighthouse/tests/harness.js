// Shared Playwright setup for the Lighthouse tests.
const { chromium } = require('playwright');
const path = require('path');
const { pathToFileURL } = require('url');

const GAME = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
const LAUNCH = { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] };
if (process.env.CHROMIUM_PATH) LAUNCH.executablePath = process.env.CHROMIUM_PATH;

async function launch(viewport) {
  const browser = await chromium.launch(LAUNCH);
  const page = await browser.newPage({ viewport: viewport || { width: 480, height: 300 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + (e.stack || e.message)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  return { browser, page, errors };
}
async function loadGame(page, opts) {
  await page.goto(GAME);
  await page.waitForFunction(() => window.__LH && window.__LH.booted, null, { timeout: 30000 });
  if (opts && opts.quality) await page.evaluate(q => { window.__LH.settings.quality = q; }, opts.quality);
}

let failures = 0;
function check(cond, label, detail) {
  console.log((cond ? '  ok   ' : '  FAIL ') + label + (detail !== undefined ? '  (' + detail + ')' : ''));
  if (!cond) failures++;
}
function done(errors) {
  if (errors && errors.length) { console.log('  FAIL page errors:\n    ' + errors.join('\n    ')); failures++; }
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
  process.exitCode = failures ? 1 : 0;
}
module.exports = { launch, loadGame, check, done, GAME };
