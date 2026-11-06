/**
 * End-to-end test of the web build, driving a real browser: adds income and
 * spending, edits and deletes, sets a budget, funds a goal, changes currency,
 * and checks everything survives a reload.
 *
 *   npm run export:web && npm run e2e
 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { start } = require('./server');

const PORT = 8765;
const URL = `http://127.0.0.1:${PORT}/`;
const NOW = new Date(2026, 10, 6, 12, 0, 0); // Fri Nov 6 2026, local time

let step = 0;
async function check(name, fn) {
  step += 1;
  process.stdout.write(`${String(step).padStart(2)}. ${name} … `);
  await fn();
  console.log('ok');
}

(async () => {
  const server = await start(PORT);
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US', timezoneId: 'America/New_York' });
  const page = await context.newPage();
  await page.clock.setFixedTime(NOW);

  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('dialog', (d) => d.accept()); // confirm() prompts: always say yes

  // Tabs stay mounted when hidden, so only ever target what's on screen.
  const id = (testId) => page.locator(`[data-testid="${testId}"]`).filter({ visible: true }).first();
  const text = (s) => page.getByText(s, { exact: true }).filter({ visible: true }).first();
  const button = (name) => page.getByRole('button', { name }).filter({ visible: true }).first();
  async function tab(name) {
    await id(`tab-${name}`).click();
    const title = name[0].toUpperCase() + name.slice(1);
    await page.getByRole('heading', { name: title, exact: true }).filter({ visible: true }).waitFor();
    // Let the outgoing tab finish hiding so its rows can't be matched.
    await page.waitForTimeout(300);
  }

  async function addTransaction({ type = 'expense', amount, category, note, repeat }) {
    await id('add-transaction').click();
    await id('amount-input').waitFor();
    if (type === 'income') await id('type-income').click();
    await id('amount-input').pressSequentially(amount);
    await id(`category-${category}`).click();
    if (note) await id('note-input').fill(note);
    if (repeat) await id(`repeat-${repeat}`).click();
    await id('modal-action').click();
    await id('amount-input').waitFor({ state: 'detached' });
  }

  try {
    await page.goto(URL);

    await check('first launch shows the welcome screen', async () => {
      await text('Welcome to Coinleaf').waitFor();
    });

    await check('add an expense', async () => {
      await addTransaction({ amount: '12.50', category: 'cat_groceries', note: 'Weekly shop' });
      assert.equal(await id('spent-total').innerText(), '$12.50');
    });

    await check('save is disabled until there is an amount; category is required', async () => {
      await id('add-transaction').click();
      await id('amount-input').waitFor();
      assert.equal(await id('modal-action').isDisabled(), true);
      await id('amount-input').pressSequentially('4');
      await id('modal-action').click();
      await text('Choose a category.').waitFor();
      await id('modal-cancel').click();
      await id('amount-input').waitFor({ state: 'detached' });
      assert.equal(await id('spent-total').innerText(), '$12.50');
    });

    await check('amount field accepts a comma and caps decimals', async () => {
      await id('add-transaction').click();
      await id('amount-input').pressSequentially('7,999');
      assert.equal(await id('amount-input').inputValue(), '7.99');
      await id('category-cat_dining').click();
      await id('modal-action').click();
      await id('amount-input').waitFor({ state: 'detached' });
      assert.equal(await id('spent-total').innerText(), '$20.49');
    });

    await check('add monthly income that started in September back-fills it', async () => {
      await id('add-transaction').click();
      await id('type-income').click();
      await id('amount-input').pressSequentially('3200');
      await id('category-cat_salary').click();
      await id('note-input').fill('Paycheck');
      await id('date-pick').click();
      // Go back two months in the calendar and pick the 1st.
      const cal = id('calendar');
      await cal.getByLabel('Previous month').click();
      await cal.getByLabel('Previous month').click();
      await cal.getByLabel('Sep 1, 2026').click();
      await id('repeat-monthly').click();
      await id('modal-action').click();
      await id('amount-input').waitFor({ state: 'detached' });
      assert.equal(await id('income-total').innerText(), '$3,200.00');
      assert.equal(await id('net-total').innerText(), '$3,179.51');
    });

    await check('activity lists the month grouped by day, with search across months', async () => {
      await tab('activity');
      await text('Weekly shop').waitFor();
      await text('Paycheck').waitFor();
      await id('search-input').fill('paycheck');
      await text('3 results across all months').waitFor();
      await id('search-input').fill('');
      await id('filter-income').click();
      await page.waitForTimeout(200);
      assert.equal(await page.getByText('Weekly shop').filter({ visible: true }).count(), 0);
      await text('Paycheck').waitFor();
      await id('filter-all').click();
    });

    await check('edit a transaction', async () => {
      await button(/^Weekly shop/).click();
      await id('amount-input').waitFor();
      assert.equal(await id('amount-input').inputValue(), '12.5');
      await id('amount-input').fill('');
      await id('amount-input').pressSequentially('20');
      await id('modal-action').click();
      await id('amount-input').waitFor({ state: 'detached' });
      await tab('overview');
      assert.equal(await id('spent-total').innerText(), '$27.99');
    });

    await check('delete a transaction (with confirmation)', async () => {
      await tab('activity');
      await button(/^Dining/).click();
      await id('delete-transaction').click();
      await id('amount-input').waitFor({ state: 'detached' });
      await tab('overview');
      assert.equal(await id('spent-total').innerText(), '$20.00');
    });

    await check('set a budget and see what is left', async () => {
      await tab('budgets');
      await id('set-budget-cat_groceries').click();
      await id('budget-amount').pressSequentially('150');
      await id('modal-action').click();
      await id('budget-amount').waitFor({ state: 'detached' });
      assert.equal(await id('budget-left').innerText(), '$130.00');
      await tab('overview');
      await text('Monthly budget').waitFor();
    });

    await check('create a goal, add money, and withdraw some', async () => {
      await tab('goals');
      await id('add-goal').click();
      await id('goal-name').fill('Lisbon trip');
      await id('goal-target').pressSequentially('1200');
      await id('modal-action').click();
      await id('goal-name').waitFor({ state: 'detached' });
      await button(/^Lisbon trip/).click();
      await id('goal-add-money').click();
      await id('funds-amount').pressSequentially('300');
      await id('modal-action').click();
      await id('funds-amount').waitFor({ state: 'detached' });
      assert.equal(await id('goal-saved').innerText(), '$300.00');
      assert.equal(await id('goal-percent').innerText(), '25%');
      await button('Withdraw').click();
      await id('funds-amount').pressSequentially('500');
      await text('Only $300.00 is saved in this goal.').waitFor();
      await id('funds-amount').fill('');
      await id('funds-amount').pressSequentially('60');
      await id('modal-action').click();
      await id('funds-amount').waitFor({ state: 'detached' });
      assert.equal(await id('goal-saved').innerText(), '$240.00');
      await page.goBack();
      await tab('goals');
      assert.equal(await id('goals-saved').innerText(), '$240.00');
    });

    await check('create a category from the transaction screen; it is auto-selected', async () => {
      await tab('overview');
      await id('add-transaction').click();
      await id('amount-input').pressSequentially('45');
      await button('New category').click();
      await id('category-name').fill('Climbing gym');
      await id('modal-action').click();
      await id('category-name').waitFor({ state: 'detached' });
      const selected = page.locator('[role="radio"][aria-selected="true"]', { hasText: 'Climbing gym' }).filter({ visible: true });
      await selected.waitFor();
      await id('modal-action').click();
      await id('amount-input').waitFor({ state: 'detached' });
      assert.equal(await id('spent-total').innerText(), '$65.00');
    });

    await check('change currency', async () => {
      await tab('settings');
      await id('settings-currency').click();
      await id('currency-EUR').click();
      await tab('overview');
      assert.equal(await id('spent-total').innerText(), '€65.00');
    });

    await check('everything survives a reload', async () => {
      await page.reload();
      await id('spent-total').waitFor();
      assert.equal(await id('spent-total').innerText(), '€65.00');
      assert.equal(await id('income-total').innerText(), '€3,200.00');
      await tab('goals');
      assert.equal(await id('goals-saved').innerText(), '€240.00');
    });

    await check('a month later, the repeating paycheck is added on its own', async () => {
      await page.clock.setFixedTime(new Date(2026, 11, 2, 9, 0, 0));
      await page.goto(URL);
      await id('income-total').waitFor();
      assert.equal(await id('month-label').innerText(), 'December 2026');
      assert.equal(await id('income-total').innerText(), '€3,200.00');
      await page.clock.setFixedTime(NOW);
      await page.goto(URL);
      await id('spent-total').waitFor();
    });

    await check('stop a repeating transaction from settings', async () => {
      await tab('settings');
      await id('settings-recurring').click();
      await text('Paycheck').waitFor();
      await button(/^Paycheck/).click();
      await button('Stop repeating').click();
      await text('No repeating transactions').waitFor();
      await page.goBack();
    });

    await check('delete a goal from its edit screen and land back on Goals', async () => {
      await tab('goals');
      await button(/^Lisbon trip/).click();
      await id('edit-goal').click();
      await button('Delete goal').click();
      await id('goal-name').waitFor({ state: 'detached' });
      await text('Save for something').waitFor();
      await page.getByRole('heading', { name: 'Goals', exact: true }).filter({ visible: true }).waitFor();
    });

    await check('erase all data returns to a clean slate', async () => {
      await tab('settings');
      await id('erase-all').click();
      await tab('overview');
      await text('Welcome to Coinleaf').waitFor();
      await page.reload();
      await text('Welcome to Coinleaf').waitFor();
    });

    await check('no errors were logged', async () => {
      assert.deepEqual(errors, []);
    });

    console.log(`\nAll ${step} checks passed.`);
  } catch (e) {
    console.log('FAILED');
    console.error(e);
    await page.screenshot({ path: 'e2e-failure.png' }).catch(() => {});
    if (errors.length) console.error('Page errors:\n' + errors.join('\n'));
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
})();
