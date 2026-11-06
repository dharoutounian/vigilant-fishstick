/**
 * Makes the App Store screenshots: fills the web build with a realistic sample
 * month, captures key screens in a phone-sized browser, and frames each with a
 * headline on a 1320×2868 canvas (the 6.9" iPhone size App Store Connect asks for).
 *
 *   npm run export:web && node scripts/screenshots.js
 *
 * Output: store/screenshots/*.png
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { start } = require('../e2e/server');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'store', 'screenshots');
const PORT = 8766;
const URL = `http://127.0.0.1:${PORT}`;
const TODAY = new Date(2026, 10, 24, 10, 30); // Nov 24 2026
const PHONE = { width: 393, height: 852 }; // points; captured at 3x
const CANVAS = { width: 1320, height: 2868 };

/* ------------------------------------------------------------ sample data */

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = (xs) => xs[Math.floor(rand() * xs.length)];
const cents = (min, max) => Math.round((min + rand() * (max - min)) * 100);
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

function sampleState() {
  const txs = [];
  let n = 0;
  const add = (date, categoryId, amount, note, type = 'expense') =>
    txs.push({ id: `s${++n}`, type, amount, categoryId, date, note, createdAt: n });

  // June to October follow a pattern; November (to the 24th) is hand-tuned.
  for (const [m, days] of [[6, 30], [7, 31], [8, 31], [9, 30], [10, 31]]) {
    for (let d = 2; d <= days; d += 7) add(iso(2026, m, d), 'cat_groceries', cents(85, 150), pick(['Weekly shop', 'Farmers market', 'Bulk run']));
    for (let d = 1; d <= days; d += 3) add(iso(2026, m, d), 'cat_dining', cents(12, 48), pick(['Lunch', 'Coffee & pastry', 'Pizza night', 'Sushi', 'Brunch']));
    add(iso(2026, m, 3), 'cat_transport', 3300, 'Monthly transit pass');
    add(iso(2026, m, 14), 'cat_transport', cents(38, 52), 'Gas');
    add(iso(2026, m, 6), 'cat_utilities', cents(64, 88), 'Electricity');
    add(iso(2026, m, 11), 'cat_utilities', 6000, 'Internet');
    add(iso(2026, m, 17), 'cat_shopping', cents(60, 180), pick(['New jacket', 'Books', 'Home goods']));
    add(iso(2026, m, 21), 'cat_fun', cents(25, 90), pick(['Concert tickets', 'Movie night', 'Bowling']));
  }
  add('2026-07-18', 'cat_travel', 61000, 'Summer road trip');
  add('2026-09-26', 'cat_travel', 24000, 'Weekend away');
  add('2026-10-09', 'cat_transport', 38000, 'Car service');
  add('2026-08-20', 'cat_freelance', 30000, 'Photo retouching', 'income');
  add('2026-10-12', 'cat_freelance', 65000, 'Logo design project', 'income');

  const nov = [
    ['2026-11-02', 'cat_groceries', 11240, 'Weekly shop'],
    ['2026-11-09', 'cat_groceries', 9875, 'Farmers market'],
    ['2026-11-16', 'cat_groceries', 13410, 'Weekly shop'],
    ['2026-11-23', 'cat_groceries', 8620, 'Weekly shop'],
    ['2026-11-03', 'cat_dining', 4250, 'Sushi with Maya'],
    ['2026-11-07', 'cat_dining', 1890, 'Lunch'],
    ['2026-11-12', 'cat_dining', 6480, 'Birthday dinner'],
    ['2026-11-15', 'cat_dining', 3120, 'Brunch'],
    ['2026-11-19', 'cat_dining', 2275, 'Pizza night'],
    ['2026-11-22', 'cat_dining', 1460, 'Coffee & pastry'],
    ['2026-11-24', 'cat_dining', 1695, 'Lunch'],
    ['2026-11-03', 'cat_transport', 3300, 'Monthly transit pass'],
    ['2026-11-13', 'cat_transport', 4610, 'Gas'],
    ['2026-11-06', 'cat_utilities', 7180, 'Electricity'],
    ['2026-11-11', 'cat_utilities', 6000, 'Internet'],
    ['2026-11-08', 'cat_shopping', 12900, 'Running shoes'],
    ['2026-11-20', 'cat_shopping', 10650, 'Winter coat (sale)'],
    ['2026-11-14', 'cat_fun', 8500, 'Concert tickets'],
    ['2026-11-21', 'cat_health', 2400, 'Pharmacy'],
  ];
  for (const [date, cat, amount, note] of nov) add(date, cat, amount, note);
  add('2026-11-18', 'cat_freelance', 42000, 'Website copy edit', 'income');

  const rule = (id, type, amount, categoryId, note, startDate) => ({
    id, type, amount, categoryId, note, frequency: 'monthly', startDate, generated: 0, active: true, createdAt: 0,
  });

  return {
    version: 1,
    transactions: txs,
    categories: [], // the app's defaults, read from a fresh launch below
    budgets: {
      cat_groceries: 60000,
      cat_dining: 25000,
      cat_shopping: 20000,
      cat_fun: 15000,
      cat_transport: 15000,
      cat_subs: 4000,
    },
    goals: [
      {
        id: 'g_japan', name: 'Japan trip', target: 400000, icon: 'airplane', color: '#EC4899', deadline: '2027-04-01', createdAt: 1,
        contributions: [
          { id: 'c1', amount: 80000, date: '2026-09-01' },
          { id: 'c2', amount: 80000, date: '2026-10-01' },
          { id: 'c3', amount: 75000, date: '2026-11-01' },
        ],
      },
      {
        id: 'g_emergency', name: 'Emergency fund', target: 1000000, icon: 'umbrella', color: '#3B82F6', createdAt: 2,
        contributions: [
          { id: 'c4', amount: 500000, date: '2026-08-01' },
          { id: 'c5', amount: 60000, date: '2026-09-01' },
          { id: 'c6', amount: 60000, date: '2026-10-01' },
        ],
      },
      {
        id: 'g_bike', name: 'Commuter bike', target: 90000, icon: 'bicycle', color: '#F59E0B', deadline: '2027-02-01', createdAt: 3,
        contributions: [{ id: 'c7', amount: 35000, date: '2026-10-20' }],
      },
      {
        id: 'g_laptop', name: 'New laptop', target: 180000, icon: 'laptop', color: '#10B981', createdAt: 0,
        contributions: [{ id: 'c8', amount: 180000, date: '2026-07-15' }],
      },
    ],
    recurring: [
      rule('r_pay', 'income', 520000, 'cat_salary', 'Paycheck', '2026-06-01'),
      rule('r_rent', 'expense', 165000, 'cat_housing', 'Rent', '2026-06-01'),
      rule('r_music', 'expense', 1199, 'cat_subs', 'Music streaming', '2026-06-09'),
      rule('r_video', 'expense', 1549, 'cat_subs', 'Video streaming', '2026-06-19'),
      rule('r_gym', 'expense', 3900, 'cat_health', 'Gym membership', '2026-06-05'),
      rule('r_phone', 'expense', 4500, 'cat_utilities', 'Phone bill', '2026-06-22'),
    ],
    settings: { currency: 'USD', lockEnabled: false },
  };
}

/* ------------------------------------------------------------- capturing */

const SHOTS = [
  { file: '01-overview', title: 'See where your\nmoney goes', sub: 'Spending, income and savings at a glance', route: 'overview' },
  { file: '02-budgets', title: 'Budgets that\nkeep you on track', sub: 'Know exactly what’s left to spend each day', route: 'budgets' },
  { file: '03-goals', title: 'Save for what\nmatters', sub: 'Trips, emergencies, the next big thing', route: 'goals' },
  { file: '04-add', title: 'Add spending\nin seconds', sub: 'Amount, category, done', route: 'add' },
  { file: '05-activity', title: 'Every transaction,\nsearchable', sub: 'Grouped by day, filter by type or keyword', route: 'activity' },
  { file: '06-dark', title: 'Private by design', sub: 'No accounts. No ads. No tracking.\nYour data stays on your iPhone.', route: 'overview', dark: true, scroll: 520 },
];

async function capture(browser, shot, state) {
  const context = await browser.newContext({
    viewport: PHONE,
    deviceScaleFactor: 3,
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles',
    colorScheme: shot.dark ? 'dark' : 'light',
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(TODAY);
  await page.addInitScript((json) => localStorage.setItem('coinleaf:state:v1', json), JSON.stringify(state));
  await page.goto(`${URL}/`);
  const visible = (sel) => page.locator(sel).filter({ visible: true }).first();
  await visible('[data-testid="spent-total"]').waitFor();

  if (shot.route === 'add') {
    await visible('[data-testid="add-transaction"]').click();
    await visible('[data-testid="amount-input"]').pressSequentially('24.50');
    await visible('[data-testid="category-cat_dining"]').click();
    await visible('[data-testid="note-input"]').fill('Tacos with Alex');
    await visible('[data-testid="amount-input"]').blur();
  } else if (shot.route !== 'overview') {
    await visible(`[data-testid="tab-${shot.route}"]`).click();
  }
  await page.waitForTimeout(900);
  if (shot.scroll) {
    await page.mouse.move(PHONE.width / 2, PHONE.height / 2);
    await page.mouse.wheel(0, shot.scroll);
    await page.waitForTimeout(600);
  }
  const png = await page.screenshot({ type: 'png' });
  await context.close();
  return png;
}

function frameHtml(shot, png) {
  const img = `data:image/png;base64,${png.toString('base64')}`;
  const bg = shot.dark
    ? 'linear-gradient(170deg, #0B3B2B 0%, #04150F 100%)'
    : 'linear-gradient(170deg, #16A87A 0%, #0B6E4F 100%)';
  const shotWidth = 1020;
  const shotHeight = Math.round((shotWidth * PHONE.height) / PHONE.width);
  const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>');
  return `<!doctype html><html><head><style>
  * { margin: 0; box-sizing: border-box; }
  body { width: ${CANVAS.width}px; height: ${CANVAS.height}px; background: ${bg}; font-family: Inter, sans-serif; color: #fff; overflow: hidden; position: relative; }
  .text { position: absolute; top: 150px; left: 0; right: 0; text-align: center; padding: 0 90px; }
  h1 { font-size: 108px; line-height: 1.06; font-weight: 800; letter-spacing: -2.5px; }
  p { margin-top: 36px; font-size: 46px; line-height: 1.3; font-weight: 500; opacity: 0.86; }
  .phone { position: absolute; left: ${(CANVAS.width - shotWidth) / 2 - 18}px; top: ${CANVAS.height - shotHeight - 110}px;
           padding: 18px; border-radius: 96px; background: #0A0F0D; box-shadow: 0 40px 120px rgba(0,0,0,0.35), inset 0 0 0 3px rgba(255,255,255,0.12); }
  .phone img { display: block; width: ${shotWidth}px; height: ${shotHeight}px; border-radius: 80px; }
</style></head><body>
  <div class="text"><h1>${escape(shot.title)}</h1><p>${escape(shot.sub)}</p></div>
  <div class="phone"><img src="${img}"></div>
</body></html>`;
}

(async () => {
  const dist = path.join(ROOT, 'dist', 'index.html');
  if (!fs.existsSync(dist)) throw new Error('Build the web app first: npm run export:web');
  fs.mkdirSync(OUT, { recursive: true });

  const server = await start(PORT);
  const browser = await chromium.launch();
  try {
    // Let the app create its default categories, then add the sample data on top.
    const state = sampleState();
    const boot = await browser.newPage();
    await boot.goto(`${URL}/`);
    await boot.locator('text=Welcome to Coinleaf').first().waitFor();
    await boot.waitForTimeout(500);
    const saved = JSON.parse(await boot.evaluate(() => localStorage.getItem('coinleaf:state:v1')));
    state.categories = saved.categories;
    await boot.close();

    for (const shot of SHOTS) {
      const png = await capture(browser, shot, state);
      const page = await browser.newPage({ viewport: CANVAS, deviceScaleFactor: 1 });
      await page.setContent(frameHtml(shot, png));
      await page.waitForTimeout(150);
      const file = path.join(OUT, `${shot.file}.png`);
      await page.screenshot({ path: file, type: 'png' });
      await page.close();
      console.log('wrote', path.relative(ROOT, file));
    }
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
