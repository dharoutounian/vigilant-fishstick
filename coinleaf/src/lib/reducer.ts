import {
  FALLBACK_EXPENSE_CATEGORY,
  FALLBACK_INCOME_CATEGORY,
  PROTECTED_CATEGORY_IDS,
  initialState,
} from './defaults';
import { generateDue } from './recurring';
import type {
  AppState,
  Category,
  Goal,
  GoalContribution,
  ISODate,
  RecurringRule,
  Settings,
  Transaction,
} from './types';

export type Action =
  | { type: 'hydrate'; state: AppState }
  | { type: 'transaction/add'; tx: Transaction }
  | { type: 'transaction/update'; tx: Transaction }
  | { type: 'transaction/delete'; id: string }
  | { type: 'category/add'; category: Category }
  | { type: 'category/update'; category: Category }
  | { type: 'category/delete'; id: string }
  | { type: 'budget/set'; categoryId: string; limit: number | null }
  | { type: 'goal/add'; goal: Goal }
  | { type: 'goal/update'; goal: Goal }
  | { type: 'goal/delete'; id: string }
  | { type: 'goal/contribute'; goalId: string; contribution: GoalContribution }
  | { type: 'goal/removeContribution'; goalId: string; contributionId: string }
  | { type: 'recurring/add'; rule: RecurringRule; today: ISODate }
  | { type: 'recurring/update'; rule: RecurringRule; today: ISODate }
  | { type: 'recurring/delete'; id: string }
  | { type: 'recurring/run'; today: ISODate }
  | { type: 'settings/update'; settings: Partial<Settings> }
  | { type: 'reset' };

/** Newest first; ties broken by creation time so same-day entries keep their order. */
export function sortTransactions(txs: Transaction[]): Transaction[] {
  return [...txs].sort((a, b) =>
    a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1,
  );
}

function runRecurring(state: AppState, today: ISODate): AppState {
  const ids = new Set(state.transactions.map((t) => t.id));
  const { created, rules, changed } = generateDue(state.recurring, today, ids);
  if (!changed) return state;
  return {
    ...state,
    recurring: rules,
    transactions: created.length
      ? sortTransactions([...state.transactions, ...created])
      : state.transactions,
  };
}

function replaceById<T extends { id: string }>(list: T[], item: T): T[] {
  return list.map((x) => (x.id === item.id ? item : x));
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate':
      return action.state;

    case 'transaction/add':
      return { ...state, transactions: sortTransactions([...state.transactions, action.tx]) };

    case 'transaction/update':
      return {
        ...state,
        transactions: sortTransactions(replaceById(state.transactions, action.tx)),
      };

    case 'transaction/delete':
      return { ...state, transactions: state.transactions.filter((t) => t.id !== action.id) };

    case 'category/add':
      return { ...state, categories: [...state.categories, action.category] };

    case 'category/update': {
      const prev = state.categories.find((c) => c.id === action.category.id);
      if (!prev) return state;
      // The type of a category can't change once money is filed under it.
      const category = { ...action.category, type: prev.type };
      return { ...state, categories: replaceById(state.categories, category) };
    }

    case 'category/delete': {
      const { id } = action;
      if (PROTECTED_CATEGORY_IDS.has(id)) return state;
      const target = state.categories.find((c) => c.id === id);
      if (!target) return state;
      const inUse =
        state.transactions.some((t) => t.categoryId === id) ||
        state.recurring.some((r) => r.categoryId === id);
      const { [id]: _removed, ...budgets } = state.budgets;
      if (inUse) {
        // Keep history intact: hide the category instead of deleting it, and move
        // any future repeats to the fallback so they stay visible and editable.
        const fallback =
          target.type === 'income' ? FALLBACK_INCOME_CATEGORY : FALLBACK_EXPENSE_CATEGORY;
        return {
          ...state,
          budgets,
          categories: state.categories.map((c) => (c.id === id ? { ...c, archived: true } : c)),
          recurring: state.recurring.map((r) =>
            r.categoryId === id ? { ...r, categoryId: fallback } : r,
          ),
        };
      }
      return { ...state, budgets, categories: state.categories.filter((c) => c.id !== id) };
    }

    case 'budget/set': {
      const { categoryId, limit } = action;
      const { [categoryId]: _old, ...rest } = state.budgets;
      if (limit == null || limit <= 0) return { ...state, budgets: rest };
      return { ...state, budgets: { ...rest, [categoryId]: limit } };
    }

    case 'goal/add':
      return { ...state, goals: [...state.goals, action.goal] };

    case 'goal/update':
      return { ...state, goals: replaceById(state.goals, action.goal) };

    case 'goal/delete':
      return { ...state, goals: state.goals.filter((g) => g.id !== action.id) };

    case 'goal/contribute':
      return {
        ...state,
        goals: state.goals.map((g) =>
          g.id === action.goalId
            ? { ...g, contributions: [...g.contributions, action.contribution] }
            : g,
        ),
      };

    case 'goal/removeContribution':
      return {
        ...state,
        goals: state.goals.map((g) =>
          g.id === action.goalId
            ? { ...g, contributions: g.contributions.filter((c) => c.id !== action.contributionId) }
            : g,
        ),
      };

    case 'recurring/add':
      return runRecurring({ ...state, recurring: [...state.recurring, action.rule] }, action.today);

    case 'recurring/update':
      return runRecurring(
        { ...state, recurring: replaceById(state.recurring, action.rule) },
        action.today,
      );

    case 'recurring/delete':
      // Past transactions stay; they simply stop being linked to a schedule.
      return {
        ...state,
        recurring: state.recurring.filter((r) => r.id !== action.id),
        transactions: state.transactions.map((t) =>
          t.recurringId === action.id ? { ...t, recurringId: undefined } : t,
        ),
      };

    case 'recurring/run':
      return runRecurring(state, action.today);

    case 'settings/update':
      return { ...state, settings: { ...state.settings, ...action.settings } };

    case 'reset':
      return initialState(state.settings.currency);
  }
}
