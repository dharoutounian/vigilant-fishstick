import { transactionsToCsv } from '../csv';
import { FALLBACK_EXPENSE_CATEGORY, initialState } from '../defaults';
import { deserialize, serialize } from '../persist';
import { reducer } from '../reducer';
import { generateDue, recurringTxId, resumeRule } from '../recurring';
import {
  budgetLines,
  budgetSummary,
  compareWithPreviousMonth,
  filterTransactions,
  goalProgress,
  groupByDay,
  monthlyHistory,
  totalsByCategory,
  totalsOf,
  transactionsInMonth,
} from '../selectors';
import type { AppState, Goal, RecurringRule, Transaction } from '../types';

let seq = 0;
function tx(partial: Partial<Transaction>): Transaction {
  seq += 1;
  return {
    id: `t${seq}`,
    type: 'expense',
    amount: 1000,
    categoryId: 'cat_groceries',
    date: '2026-11-03',
    note: '',
    createdAt: seq,
    ...partial,
  };
}

function rule(partial: Partial<RecurringRule>): RecurringRule {
  return {
    id: 'rule1',
    type: 'expense',
    amount: 150000,
    categoryId: 'cat_housing',
    note: 'Rent',
    frequency: 'monthly',
    startDate: '2026-09-01',
    generated: 0,
    active: true,
    createdAt: 1,
    ...partial,
  };
}

function withTxs(txs: Transaction[]): AppState {
  return txs.reduce((s, t) => reducer(s, { type: 'transaction/add', tx: t }), initialState());
}

describe('reducer: transactions', () => {
  it('keeps transactions sorted newest first', () => {
    const s = withTxs([
      tx({ id: 'a', date: '2026-11-01' }),
      tx({ id: 'b', date: '2026-11-05' }),
      tx({ id: 'c', date: '2026-11-03' }),
      tx({ id: 'd', date: '2026-11-05' }),
    ]);
    expect(s.transactions.map((t) => t.id)).toEqual(['d', 'b', 'c', 'a']);
  });

  it('updates and re-sorts, and deletes', () => {
    let s = withTxs([tx({ id: 'a', date: '2026-11-01' }), tx({ id: 'b', date: '2026-11-05' })]);
    s = reducer(s, { type: 'transaction/update', tx: { ...s.transactions[1], date: '2026-11-09' } });
    expect(s.transactions[0].id).toBe('a');
    s = reducer(s, { type: 'transaction/delete', id: 'a' });
    expect(s.transactions.map((t) => t.id)).toEqual(['b']);
  });
});

describe('reducer: categories', () => {
  it('deletes an unused category outright, with its budget', () => {
    let s = reducer(initialState(), { type: 'budget/set', categoryId: 'cat_travel', limit: 5000 });
    s = reducer(s, { type: 'category/delete', id: 'cat_travel' });
    expect(s.categories.find((c) => c.id === 'cat_travel')).toBeUndefined();
    expect(s.budgets.cat_travel).toBeUndefined();
  });

  it('archives a category that has history and moves repeats to the fallback', () => {
    let s = withTxs([tx({ categoryId: 'cat_travel' })]);
    s = reducer(s, { type: 'recurring/add', rule: rule({ categoryId: 'cat_travel', startDate: '2027-01-01' }), today: '2026-11-06' });
    s = reducer(s, { type: 'category/delete', id: 'cat_travel' });
    expect(s.categories.find((c) => c.id === 'cat_travel')?.archived).toBe(true);
    expect(s.transactions[0].categoryId).toBe('cat_travel');
    expect(s.recurring[0].categoryId).toBe(FALLBACK_EXPENSE_CATEGORY);
  });

  it('refuses to delete the fallback categories', () => {
    const s = reducer(initialState(), { type: 'category/delete', id: FALLBACK_EXPENSE_CATEGORY });
    expect(s.categories.some((c) => c.id === FALLBACK_EXPENSE_CATEGORY)).toBe(true);
  });

  it("doesn't let an edit change a category's type", () => {
    const s0 = initialState();
    const groceries = s0.categories.find((c) => c.id === 'cat_groceries')!;
    const s = reducer(s0, { type: 'category/update', category: { ...groceries, name: 'Food', type: 'income' } });
    const after = s.categories.find((c) => c.id === 'cat_groceries')!;
    expect(after.name).toBe('Food');
    expect(after.type).toBe('expense');
  });
});

describe('reducer: budgets', () => {
  it('sets, replaces and clears a budget', () => {
    let s = reducer(initialState(), { type: 'budget/set', categoryId: 'cat_dining', limit: 20000 });
    expect(s.budgets.cat_dining).toBe(20000);
    s = reducer(s, { type: 'budget/set', categoryId: 'cat_dining', limit: 30000 });
    expect(s.budgets.cat_dining).toBe(30000);
    s = reducer(s, { type: 'budget/set', categoryId: 'cat_dining', limit: null });
    expect('cat_dining' in s.budgets).toBe(false);
  });
});

describe('recurring', () => {
  it('generates every due occurrence once, and none in the future', () => {
    let s = reducer(initialState(), { type: 'recurring/add', rule: rule({}), today: '2026-11-06' });
    expect(s.transactions.map((t) => t.date)).toEqual(['2026-11-01', '2026-10-01', '2026-09-01']);
    expect(s.recurring[0].generated).toBe(3);

    // Running again the same day changes nothing.
    const again = reducer(s, { type: 'recurring/run', today: '2026-11-06' });
    expect(again).toBe(s);

    s = reducer(s, { type: 'recurring/run', today: '2026-12-01' });
    expect(s.transactions[0].date).toBe('2026-12-01');
    expect(s.transactions).toHaveLength(4);
  });

  it('never re-creates an occurrence the person deleted', () => {
    let s = reducer(initialState(), { type: 'recurring/add', rule: rule({}), today: '2026-11-06' });
    s = reducer(s, { type: 'transaction/delete', id: recurringTxId('rule1', 2) });
    s = reducer(s, { type: 'recurring/run', today: '2026-11-07' });
    expect(s.transactions).toHaveLength(2);
  });

  it('skips paused rules and resumes without back-filling', () => {
    const paused = rule({ active: false });
    expect(generateDue([paused], '2026-11-06', new Set()).created).toHaveLength(0);
    const resumed = resumeRule({ ...paused, generated: 1 }, '2026-11-06');
    expect(resumed.active).toBe(true);
    expect(resumed.generated).toBe(3); // next is Dec 1
    expect(generateDue([resumed], '2026-11-06', new Set()).created).toHaveLength(0);
  });

  it('a rule starting in the future creates nothing yet', () => {
    const s = reducer(initialState(), { type: 'recurring/add', rule: rule({ startDate: '2026-11-20' }), today: '2026-11-06' });
    expect(s.transactions).toHaveLength(0);
  });

  it('keeps past transactions when a rule is deleted', () => {
    let s = reducer(initialState(), { type: 'recurring/add', rule: rule({}), today: '2026-11-06' });
    s = reducer(s, { type: 'recurring/delete', id: 'rule1' });
    expect(s.recurring).toHaveLength(0);
    expect(s.transactions).toHaveLength(3);
    expect(s.transactions.every((t) => t.recurringId === undefined)).toBe(true);
  });
});

describe('selectors', () => {
  const s = withTxs([
    tx({ amount: 5000, categoryId: 'cat_groceries', date: '2026-11-02' }),
    tx({ amount: 3000, categoryId: 'cat_groceries', date: '2026-11-04' }),
    tx({ amount: 2000, categoryId: 'cat_dining', date: '2026-11-04', note: 'Pizza night' }),
    tx({ type: 'income', amount: 400000, categoryId: 'cat_salary', date: '2026-11-01' }),
    tx({ amount: 9999, categoryId: 'cat_dining', date: '2026-10-20' }),
    tx({ amount: 4000, categoryId: 'cat_groceries', date: '2026-10-03' }),
  ]);

  it('totals a month', () => {
    const nov = transactionsInMonth(s.transactions, '2026-11');
    expect(totalsOf(nov)).toEqual({ income: 400000, expense: 10000, net: 390000 });
  });

  it('breaks spending down by category, biggest first', () => {
    const nov = transactionsInMonth(s.transactions, '2026-11');
    const rows = totalsByCategory(nov, s.categories);
    expect(rows.map((r) => [r.category.id, r.amount])).toEqual([
      ['cat_groceries', 8000],
      ['cat_dining', 2000],
    ]);
    expect(rows[0].share).toBeCloseTo(0.8);
  });

  it('tracks budgets and their status', () => {
    let b = reducer(s, { type: 'budget/set', categoryId: 'cat_groceries', limit: 10000 });
    b = reducer(b, { type: 'budget/set', categoryId: 'cat_dining', limit: 1500 });
    const lines = budgetLines(b, '2026-11');
    expect(lines.map((l) => [l.category.id, l.spent, l.status])).toEqual([
      ['cat_dining', 2000, 'over'],
      ['cat_groceries', 8000, 'warning'],
    ]);
    const sum = budgetSummary(lines, '2026-11', '2026-11-06')!;
    expect(sum.limit).toBe(11500);
    expect(sum.spent).toBe(10000);
    expect(sum.daysLeft).toBe(25);
    expect(sum.perDayLeft).toBe(60);
  });

  it('groups by day with a daily net', () => {
    const groups = groupByDay(transactionsInMonth(s.transactions, '2026-11'));
    expect(groups.map((g) => [g.date, g.items.length, g.net])).toEqual([
      ['2026-11-04', 2, -5000],
      ['2026-11-02', 1, -5000],
      ['2026-11-01', 1, 400000],
    ]);
  });

  it('searches notes, category names and amounts', () => {
    expect(filterTransactions(s.transactions, s.categories, { query: 'pizza' })).toHaveLength(1);
    expect(filterTransactions(s.transactions, s.categories, { query: 'groc' })).toHaveLength(3);
    expect(filterTransactions(s.transactions, s.categories, { query: '99.99' })).toHaveLength(1);
    expect(filterTransactions(s.transactions, s.categories, { type: 'income' })).toHaveLength(1);
  });

  it('compares with the same span of last month', () => {
    // Nov 1-6: 10000. Oct 1-6: 4000.
    const c = compareWithPreviousMonth(s.transactions, '2026-11', '2026-11-06');
    expect(c).toEqual({ current: 10000, previous: 4000, change: 1.5 });
    // A finished month compares against the whole previous month.
    const oct = compareWithPreviousMonth(s.transactions, '2026-10', '2026-11-06');
    expect(oct.current).toBe(13999);
    expect(oct.change).toBeNull();
  });

  it('builds a monthly history, oldest first', () => {
    const h = monthlyHistory(s.transactions, '2026-11', 3);
    expect(h.map((b) => [b.month, b.expense])).toEqual([
      ['2026-09', 0],
      ['2026-10', 13999],
      ['2026-11', 10000],
    ]);
  });
});

describe('goals', () => {
  const goal: Goal = {
    id: 'g1',
    name: 'Trip',
    target: 120000,
    icon: 'airplane',
    color: '#000',
    deadline: '2027-05-06',
    contributions: [
      { id: 'c1', amount: 30000, date: '2026-10-01' },
      { id: 'c2', amount: -5000, date: '2026-10-15' },
    ],
    createdAt: 1,
  };

  it('computes saved, remaining and the monthly amount needed', () => {
    const p = goalProgress(goal, '2026-11-06');
    expect(p.saved).toBe(25000);
    expect(p.remaining).toBe(95000);
    expect(p.ratio).toBeCloseTo(25000 / 120000);
    expect(p.complete).toBe(false);
    expect(p.daysLeft).toBe(181);
    // ~5.95 months left
    expect(p.monthlyNeeded).toBeGreaterThan(15900);
    expect(p.monthlyNeeded).toBeLessThan(16000);
  });

  it('marks a funded goal complete and caps the ratio', () => {
    const p = goalProgress({ ...goal, contributions: [{ id: 'x', amount: 200000, date: '2026-11-01' }] }, '2026-11-06');
    expect(p.complete).toBe(true);
    expect(p.ratio).toBe(1);
    expect(p.monthlyNeeded).toBeNull();
  });

  it('adds and removes contributions', () => {
    let s = reducer(initialState(), { type: 'goal/add', goal: { ...goal, contributions: [] } });
    s = reducer(s, { type: 'goal/contribute', goalId: 'g1', contribution: { id: 'c9', amount: 500, date: '2026-11-06' } });
    expect(s.goals[0].contributions).toHaveLength(1);
    s = reducer(s, { type: 'goal/removeContribution', goalId: 'g1', contributionId: 'c9' });
    expect(s.goals[0].contributions).toHaveLength(0);
  });
});

describe('persistence', () => {
  it('round-trips state', () => {
    let s = withTxs([tx({ note: 'Milk, eggs "fresh"' })]);
    s = reducer(s, { type: 'budget/set', categoryId: 'cat_dining', limit: 20000 });
    s = reducer(s, { type: 'recurring/add', rule: rule({}), today: '2026-11-06' });
    s = reducer(s, { type: 'settings/update', settings: { currency: 'EUR', lockEnabled: true } });
    expect(deserialize(serialize(s))).toEqual(s);
  });

  it('returns null for unreadable data', () => {
    expect(deserialize(null)).toBeNull();
    expect(deserialize('{not json')).toBeNull();
    expect(deserialize('[]')).toBeNull();
    expect(deserialize(JSON.stringify({ version: 99 }))).toBeNull();
  });

  it('drops individual bad records instead of losing everything', () => {
    const raw = JSON.stringify({
      version: 1,
      transactions: [
        { id: 'ok', type: 'expense', amount: 500, categoryId: 'cat_dining', date: '2026-11-01', note: '', createdAt: 1 },
        { id: 'bad-amount', type: 'expense', amount: 1.5, date: '2026-11-01' },
        { id: 'bad-date', type: 'expense', amount: 100, date: 'yesterday' },
        null,
      ],
      categories: [{ id: 'cat_dining', name: 'Dining', icon: 'restaurant', color: '#f00', type: 'expense' }],
      budgets: { cat_dining: 1000, junk: -5 },
      settings: { currency: 'not-a-code' },
    });
    const s = deserialize(raw, 'GBP')!;
    expect(s.transactions.map((t) => t.id)).toEqual(['ok']);
    expect(s.budgets).toEqual({ cat_dining: 1000 });
    expect(s.settings.currency).toBe('GBP');
    // Fallback categories are restored.
    expect(s.categories.some((c) => c.id === FALLBACK_EXPENSE_CATEGORY)).toBe(true);
  });
});

describe('csv export', () => {
  it('writes a header, signed amounts, and escapes text', () => {
    const s = withTxs([
      tx({ date: '2026-11-02', amount: 1250, note: 'Milk, eggs "fresh"' }),
      tx({ date: '2026-11-01', type: 'income', amount: 100000, categoryId: 'cat_salary', note: '=HYPERLINK("x")' }),
    ]);
    const lines = transactionsToCsv(s).trimEnd().split('\r\n');
    expect(lines[0]).toBe('Date,Type,Category,Amount,Currency,Note,Repeats');
    expect(lines[1]).toBe(`2026-11-01,Income,Salary,1000.00,USD,"'=HYPERLINK(""x"")",`);
    expect(lines[2]).toBe('2026-11-02,Expense,Groceries,-12.50,USD,"Milk, eggs ""fresh""",');
  });
});

describe('persistence ordering', () => {
  it('sorts transactions newest first on load, whatever order they were stored in', () => {
    const s = withTxs([tx({ id: 'old', date: '2026-01-01' }), tx({ id: 'new', date: '2026-02-01' })]);
    const reversed = { ...s, transactions: [...s.transactions].reverse() };
    expect(deserialize(serialize(reversed))!.transactions.map((t) => t.id)).toEqual(['new', 'old']);
  });
});
