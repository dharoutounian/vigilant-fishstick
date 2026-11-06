import type { AppState, Category, Settings } from './types';

/** Category and goal colors. Chosen to stay distinct from one another in both themes. */
export const PALETTE = [
  '#10B981', // emerald
  '#3B82F6', // blue
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
  '#6366F1', // indigo
  '#84CC16', // lime
  '#06B6D4', // cyan
  '#A855F7', // purple
  '#64748B', // slate
] as const;

/** Ionicons glyphs offered when creating a category or goal. */
export const CATEGORY_ICONS = [
  'cart',
  'restaurant',
  'cafe',
  'car',
  'bus',
  'home',
  'flash',
  'water',
  'wifi',
  'phone-portrait',
  'bag-handle',
  'shirt',
  'film',
  'game-controller',
  'musical-notes',
  'medkit',
  'fitness',
  'heart',
  'airplane',
  'bed',
  'school',
  'book',
  'gift',
  'paw',
  'happy',
  'repeat',
  'construct',
  'shield-checkmark',
  'receipt',
  'briefcase',
  'laptop',
  'trending-up',
  'cash',
  'card',
  'wallet',
  'business',
  'ribbon',
  'sparkles',
  'ellipsis-horizontal',
] as const;

export const GOAL_ICONS = [
  'flag',
  'airplane',
  'home',
  'car',
  'school',
  'laptop',
  'heart',
  'gift',
  'umbrella',
  'diamond',
  'bicycle',
  'camera',
  'paw',
  'medkit',
  'trophy',
  'sparkles',
] as const;

export const FALLBACK_EXPENSE_CATEGORY = 'cat_other';
export const FALLBACK_INCOME_CATEGORY = 'cat_other_income';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat_groceries', name: 'Groceries', icon: 'cart', color: '#10B981', type: 'expense' },
  { id: 'cat_dining', name: 'Dining', icon: 'restaurant', color: '#F97316', type: 'expense' },
  { id: 'cat_transport', name: 'Transport', icon: 'car', color: '#3B82F6', type: 'expense' },
  { id: 'cat_housing', name: 'Housing', icon: 'home', color: '#8B5CF6', type: 'expense' },
  { id: 'cat_utilities', name: 'Utilities', icon: 'flash', color: '#F59E0B', type: 'expense' },
  { id: 'cat_shopping', name: 'Shopping', icon: 'bag-handle', color: '#EC4899', type: 'expense' },
  { id: 'cat_fun', name: 'Entertainment', icon: 'film', color: '#6366F1', type: 'expense' },
  { id: 'cat_health', name: 'Health', icon: 'medkit', color: '#EF4444', type: 'expense' },
  { id: 'cat_subs', name: 'Subscriptions', icon: 'repeat', color: '#06B6D4', type: 'expense' },
  { id: 'cat_travel', name: 'Travel', icon: 'airplane', color: '#14B8A6', type: 'expense' },
  { id: FALLBACK_EXPENSE_CATEGORY, name: 'Other', icon: 'ellipsis-horizontal', color: '#64748B', type: 'expense' },
  { id: 'cat_salary', name: 'Salary', icon: 'briefcase', color: '#10B981', type: 'income' },
  { id: 'cat_freelance', name: 'Freelance', icon: 'laptop', color: '#3B82F6', type: 'income' },
  { id: 'cat_invest', name: 'Investments', icon: 'trending-up', color: '#8B5CF6', type: 'income' },
  { id: 'cat_gifts_in', name: 'Gifts', icon: 'gift', color: '#EC4899', type: 'income' },
  { id: FALLBACK_INCOME_CATEGORY, name: 'Other income', icon: 'cash', color: '#64748B', type: 'income' },
];

/** Categories the app relies on as a fallback; they can be renamed but not deleted. */
export const PROTECTED_CATEGORY_IDS = new Set([FALLBACK_EXPENSE_CATEGORY, FALLBACK_INCOME_CATEGORY]);

/** Common currencies, offered first in the picker. */
export const CURRENCIES = [
  'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'JPY', 'CNY', 'INR', 'CHF',
  'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'TRY', 'ILS', 'AED',
  'SAR', 'ZAR', 'NGN', 'KES', 'EGP', 'BRL', 'MXN', 'ARS', 'CLP', 'COP',
  'PEN', 'KRW', 'SGD', 'HKD', 'TWD', 'THB', 'MYR', 'IDR', 'PHP', 'VND',
  'PKR', 'BDT', 'UAH', 'AMD', 'GEL', 'KZT', 'ISK',
];

export function defaultSettings(currency = 'USD'): Settings {
  return { currency, lockEnabled: false };
}

export function initialState(currency = 'USD'): AppState {
  return {
    version: 1,
    transactions: [],
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    budgets: {},
    goals: [],
    recurring: [],
    settings: defaultSettings(currency),
  };
}
