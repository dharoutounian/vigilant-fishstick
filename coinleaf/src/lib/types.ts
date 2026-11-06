/**
 * Core data model. Everything the app stores lives in one `AppState` document.
 *
 * Money is always an integer number of minor units ("cents"), never a float,
 * so sums never drift. Dates are local calendar days as `YYYY-MM-DD` strings,
 * which sort correctly as text and are immune to time-zone shifts.
 */

export type TxType = 'expense' | 'income';

/** A local calendar date, `YYYY-MM-DD`. */
export type ISODate = string;

/** A calendar month, `YYYY-MM`. */
export type MonthKey = string;

export interface Category {
  id: string;
  name: string;
  /** Ionicons glyph name. */
  icon: string;
  color: string;
  type: TxType;
  /** Archived categories keep their history but are hidden from pickers. */
  archived?: boolean;
}

export interface Transaction {
  id: string;
  type: TxType;
  /** Always positive, in cents. `type` decides the sign. */
  amount: number;
  categoryId: string;
  date: ISODate;
  note: string;
  /** Set when this transaction was produced by a repeating rule. */
  recurringId?: string;
  createdAt: number;
}

export type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'yearly';

export interface RecurringRule {
  id: string;
  type: TxType;
  amount: number;
  categoryId: string;
  note: string;
  frequency: Frequency;
  /** The first occurrence. Later ones are computed from it, never from each other. */
  startDate: ISODate;
  /** How many occurrences have already been turned into transactions. */
  generated: number;
  active: boolean;
  createdAt: number;
}

export interface GoalContribution {
  id: string;
  /** Positive adds money to the goal, negative withdraws it. */
  amount: number;
  date: ISODate;
}

export interface Goal {
  id: string;
  name: string;
  /** Target amount in cents. */
  target: number;
  icon: string;
  color: string;
  deadline?: ISODate;
  contributions: GoalContribution[];
  createdAt: number;
}

export interface Settings {
  /** ISO 4217 code, e.g. "USD". */
  currency: string;
  /** Require Face ID / Touch ID / passcode when opening the app. */
  lockEnabled: boolean;
}

export interface AppState {
  version: 1;
  transactions: Transaction[];
  categories: Category[];
  /** Monthly spending limit per expense category, in cents. */
  budgets: Record<string, number>;
  goals: Goal[];
  recurring: RecurringRule[];
  settings: Settings;
}
