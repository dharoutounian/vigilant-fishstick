import { daysBetween, daysInMonthKey, monthKeyOf, shiftMonth, todayISO } from './dates';
import type { AppState, Category, Goal, ISODate, MonthKey, Transaction, TxType } from './types';

export interface Totals {
  income: number;
  expense: number;
  /** income - expense */
  net: number;
}

export function transactionsInMonth(txs: Transaction[], month: MonthKey): Transaction[] {
  return txs.filter((t) => monthKeyOf(t.date) === month);
}

export function totalsOf(txs: Transaction[]): Totals {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, net: income - expense };
}

export function categoryMap(categories: Category[]): Map<string, Category> {
  return new Map(categories.map((c) => [c.id, c]));
}

export interface CategoryTotal {
  category: Category;
  amount: number;
  /** Share of the total, 0..1 */
  share: number;
  count: number;
}

const UNKNOWN: Category = {
  id: '__unknown',
  name: 'Uncategorized',
  icon: 'help',
  color: '#64748B',
  type: 'expense',
};

/** Totals per category for one transaction type, biggest first. */
export function totalsByCategory(
  txs: Transaction[],
  categories: Category[],
  type: TxType = 'expense',
): CategoryTotal[] {
  const cats = categoryMap(categories);
  const sums = new Map<string, { amount: number; count: number }>();
  let total = 0;
  for (const t of txs) {
    if (t.type !== type) continue;
    const s = sums.get(t.categoryId) ?? { amount: 0, count: 0 };
    s.amount += t.amount;
    s.count += 1;
    sums.set(t.categoryId, s);
    total += t.amount;
  }
  return [...sums.entries()]
    .map(([id, s]) => ({
      category: cats.get(id) ?? { ...UNKNOWN, type },
      amount: s.amount,
      count: s.count,
      share: total ? s.amount / total : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export type BudgetStatus = 'ok' | 'warning' | 'over';

export interface BudgetLine {
  category: Category;
  limit: number;
  spent: number;
  remaining: number;
  /** spent / limit; can exceed 1. */
  ratio: number;
  status: BudgetStatus;
}

export function budgetStatus(ratio: number): BudgetStatus {
  if (ratio > 1) return 'over';
  if (ratio >= 0.8) return 'warning';
  return 'ok';
}

export function budgetLines(state: AppState, month: MonthKey): BudgetLine[] {
  const spent = new Map<string, number>();
  for (const t of state.transactions) {
    if (t.type !== 'expense' || monthKeyOf(t.date) !== month) continue;
    spent.set(t.categoryId, (spent.get(t.categoryId) ?? 0) + t.amount);
  }
  const lines: BudgetLine[] = [];
  for (const c of state.categories) {
    const limit = state.budgets[c.id];
    if (!limit || c.type !== 'expense') continue;
    const s = spent.get(c.id) ?? 0;
    const ratio = s / limit;
    lines.push({
      category: c,
      limit,
      spent: s,
      remaining: limit - s,
      ratio,
      status: budgetStatus(ratio),
    });
  }
  return lines.sort((a, b) => b.ratio - a.ratio);
}

export interface BudgetSummary {
  limit: number;
  spent: number;
  remaining: number;
  ratio: number;
  status: BudgetStatus;
  /** How much can be spent per remaining day (including today) and stay on budget. */
  perDayLeft: number | null;
  daysLeft: number;
}

/**
 * The month's budget as a whole. Only spending in budgeted categories counts
 * against it, so an unbudgeted one-off doesn't make every budget look blown.
 */
export function budgetSummary(lines: BudgetLine[], month: MonthKey, today: ISODate = todayISO()): BudgetSummary | null {
  if (!lines.length) return null;
  const limit = lines.reduce((s, l) => s + l.limit, 0);
  const spent = lines.reduce((s, l) => s + l.spent, 0);
  const remaining = limit - spent;
  const ratio = spent / limit;
  const days = daysInMonthKey(month);
  let daysLeft = 0;
  const thisMonth = monthKeyOf(today);
  if (month === thisMonth) daysLeft = days - Number(today.slice(8, 10)) + 1;
  else if (month > thisMonth) daysLeft = days;
  return {
    limit,
    spent,
    remaining,
    ratio,
    status: budgetStatus(ratio),
    daysLeft,
    perDayLeft: daysLeft > 0 && remaining > 0 ? Math.floor(remaining / daysLeft) : null,
  };
}

export interface DayGroup {
  date: ISODate;
  items: Transaction[];
  /** income - expense for the day */
  net: number;
}

/** Groups transactions (already sorted newest first) by day. */
export function groupByDay(txs: Transaction[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const t of txs) {
    let g = groups[groups.length - 1];
    if (!g || g.date !== t.date) {
      g = { date: t.date, items: [], net: 0 };
      groups.push(g);
    }
    g.items.push(t);
    g.net += t.type === 'income' ? t.amount : -t.amount;
  }
  return groups;
}

export interface TxFilter {
  query?: string;
  type?: TxType | 'all';
  categoryId?: string | null;
}

export function filterTransactions(
  txs: Transaction[],
  categories: Category[],
  filter: TxFilter,
): Transaction[] {
  const q = filter.query?.trim().toLowerCase() ?? '';
  const cats = categoryMap(categories);
  return txs.filter((t) => {
    if (filter.type && filter.type !== 'all' && t.type !== filter.type) return false;
    if (filter.categoryId && t.categoryId !== filter.categoryId) return false;
    if (!q) return true;
    const name = cats.get(t.categoryId)?.name.toLowerCase() ?? '';
    const amount = (t.amount / 100).toFixed(2);
    return t.note.toLowerCase().includes(q) || name.includes(q) || amount.includes(q);
  });
}

export interface MonthComparison {
  current: number;
  previous: number;
  /** (current - previous) / previous; null when there's nothing to compare with. */
  change: number | null;
}

/**
 * Spending this month vs the same span of last month. For the current month only
 * the days elapsed so far are compared, so the 5th of the month isn't measured
 * against a whole previous month.
 */
export function compareWithPreviousMonth(
  txs: Transaction[],
  month: MonthKey,
  today: ISODate = todayISO(),
): MonthComparison {
  const prev = shiftMonth(month, -1);
  const isCurrent = month === monthKeyOf(today);
  const cutoffDay = isCurrent ? Number(today.slice(8, 10)) : 31;
  let current = 0;
  let previous = 0;
  for (const t of txs) {
    if (t.type !== 'expense') continue;
    const m = monthKeyOf(t.date);
    const day = Number(t.date.slice(8, 10));
    if (m === month && (!isCurrent || day <= cutoffDay)) current += t.amount;
    else if (m === prev && day <= cutoffDay) previous += t.amount;
  }
  return { current, previous, change: previous > 0 ? (current - previous) / previous : null };
}

export interface MonthBar {
  month: MonthKey;
  income: number;
  expense: number;
}

/** Income and spending for the `count` months ending at `month`, oldest first. */
export function monthlyHistory(txs: Transaction[], month: MonthKey, count = 6): MonthBar[] {
  const bars: MonthBar[] = [];
  const index = new Map<MonthKey, MonthBar>();
  for (let i = count - 1; i >= 0; i--) {
    const m = shiftMonth(month, -i);
    const bar = { month: m, income: 0, expense: 0 };
    bars.push(bar);
    index.set(m, bar);
  }
  for (const t of txs) {
    const bar = index.get(monthKeyOf(t.date));
    if (!bar) continue;
    if (t.type === 'income') bar.income += t.amount;
    else bar.expense += t.amount;
  }
  return bars;
}

export interface GoalProgress {
  saved: number;
  remaining: number;
  /** 0..1, capped */
  ratio: number;
  complete: boolean;
  /** Amount to save each month to hit the deadline; null without a deadline. */
  monthlyNeeded: number | null;
  /** Days until the deadline; negative when it has passed. */
  daysLeft: number | null;
}

export function goalProgress(goal: Goal, today: ISODate = todayISO()): GoalProgress {
  const saved = goal.contributions.reduce((s, c) => s + c.amount, 0);
  const remaining = Math.max(0, goal.target - saved);
  const ratio = goal.target > 0 ? Math.min(1, Math.max(0, saved / goal.target)) : 0;
  const complete = saved >= goal.target && goal.target > 0;
  let monthlyNeeded: number | null = null;
  let daysLeft: number | null = null;
  if (goal.deadline) {
    daysLeft = daysBetween(today, goal.deadline);
    if (!complete && daysLeft > 0) {
      const months = Math.max(1, daysLeft / 30.4375);
      monthlyNeeded = Math.ceil(remaining / months);
    }
  }
  return { saved, remaining, ratio, complete, monthlyNeeded, daysLeft };
}

/** Categories that can be picked for a new transaction of this type. */
export function pickableCategories(categories: Category[], type: TxType): Category[] {
  return categories.filter((c) => c.type === type && !c.archived);
}
