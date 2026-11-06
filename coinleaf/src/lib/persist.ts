import { isValidISODate } from './dates';
import { DEFAULT_CATEGORIES, FALLBACK_EXPENSE_CATEGORY, FALLBACK_INCOME_CATEGORY, initialState } from './defaults';
import { sortTransactions } from './reducer';
import type {
  AppState,
  Category,
  Goal,
  GoalContribution,
  RecurringRule,
  Transaction,
  TxType,
} from './types';

export const STORAGE_KEY = 'coinleaf:state:v1';

export function serialize(state: AppState): string {
  return JSON.stringify(state);
}

type Json = Record<string, unknown>;

const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const isType = (v: unknown): v is TxType => v === 'expense' || v === 'income';
const isCents = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v > 0 && v < 1e13;
const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function readCategory(v: unknown): Category | null {
  if (!isObj(v) || typeof v.id !== 'string' || !isType(v.type)) return null;
  return {
    id: v.id,
    name: str(v.name, 'Category'),
    icon: str(v.icon, 'ellipsis-horizontal'),
    color: str(v.color, '#64748B'),
    type: v.type,
    ...(v.archived === true ? { archived: true } : null),
  };
}

function readTransaction(v: unknown): Transaction | null {
  if (!isObj(v) || typeof v.id !== 'string' || !isType(v.type)) return null;
  if (!isCents(v.amount) || !isValidISODate(v.date)) return null;
  return {
    id: v.id,
    type: v.type,
    amount: v.amount,
    categoryId: str(v.categoryId, v.type === 'income' ? FALLBACK_INCOME_CATEGORY : FALLBACK_EXPENSE_CATEGORY),
    date: v.date,
    note: str(v.note),
    ...(typeof v.recurringId === 'string' ? { recurringId: v.recurringId } : null),
    createdAt: num(v.createdAt),
  };
}

function readRule(v: unknown): RecurringRule | null {
  if (!isObj(v) || typeof v.id !== 'string' || !isType(v.type)) return null;
  if (!isCents(v.amount) || !isValidISODate(v.startDate)) return null;
  const f = v.frequency;
  if (f !== 'weekly' && f !== 'biweekly' && f !== 'monthly' && f !== 'yearly') return null;
  return {
    id: v.id,
    type: v.type,
    amount: v.amount,
    categoryId: str(v.categoryId, FALLBACK_EXPENSE_CATEGORY),
    note: str(v.note),
    frequency: f,
    startDate: v.startDate,
    generated: Math.max(0, Math.floor(num(v.generated))),
    active: v.active !== false,
    createdAt: num(v.createdAt),
  };
}

function readContribution(v: unknown): GoalContribution | null {
  if (!isObj(v) || typeof v.id !== 'string') return null;
  const amount = v.amount;
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount === 0) return null;
  if (!isValidISODate(v.date)) return null;
  return { id: v.id, amount, date: v.date };
}

function readGoal(v: unknown): Goal | null {
  if (!isObj(v) || typeof v.id !== 'string' || !isCents(v.target)) return null;
  return {
    id: v.id,
    name: str(v.name, 'Goal'),
    target: v.target,
    icon: str(v.icon, 'flag'),
    color: str(v.color, '#10B981'),
    ...(isValidISODate(v.deadline) ? { deadline: v.deadline } : null),
    contributions: arr(v.contributions)
      .map(readContribution)
      .filter((c): c is GoalContribution => c !== null),
    createdAt: num(v.createdAt),
  };
}

const notNull = <T,>(x: T | null): x is T => x !== null;

/**
 * Reads stored state defensively. Individual malformed records are dropped rather
 * than discarding everything, and the built-in fallback categories are restored
 * if they've gone missing. Returns null only when the document is unreadable.
 */
export function deserialize(raw: string | null, defaultCurrency = 'USD'): AppState | null {
  if (raw == null) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(data) || data.version !== 1) return null;

  const base = initialState(defaultCurrency);
  const categories = arr(data.categories).map(readCategory).filter(notNull);
  for (const id of [FALLBACK_EXPENSE_CATEGORY, FALLBACK_INCOME_CATEGORY]) {
    if (!categories.some((c) => c.id === id)) {
      categories.push({ ...DEFAULT_CATEGORIES.find((c) => c.id === id)! });
    }
  }

  const budgets: Record<string, number> = {};
  if (isObj(data.budgets)) {
    for (const [k, v] of Object.entries(data.budgets)) if (isCents(v)) budgets[k] = v;
  }

  const settings = isObj(data.settings) ? data.settings : {};
  const currency = str(settings.currency, base.settings.currency);

  return {
    version: 1,
    transactions: sortTransactions(arr(data.transactions).map(readTransaction).filter(notNull)),
    categories,
    budgets,
    goals: arr(data.goals).map(readGoal).filter(notNull),
    recurring: arr(data.recurring).map(readRule).filter(notNull),
    settings: {
      currency: /^[A-Z]{3}$/.test(currency) ? currency : base.settings.currency,
      lockEnabled: settings.lockEnabled === true,
    },
  };
}
