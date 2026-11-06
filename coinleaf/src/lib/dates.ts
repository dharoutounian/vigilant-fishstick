import type { Frequency, ISODate, MonthKey } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Formats a Date as a local calendar day. */
export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parses `YYYY-MM-DD` as local midnight (not UTC, which `new Date(str)` would do). */
export function parseISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isValidISODate(value: unknown): value is ISODate {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toISODate(parseISODate(value)) === value;
}

export function todayISO(now: Date = new Date()): ISODate {
  return toISODate(now);
}

export function addDays(iso: ISODate, days: number): ISODate {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * Adds whole months, clamping to the last day of shorter months:
 * Jan 31 + 1 month = Feb 28 (or 29), not Mar 3.
 */
export function addMonths(iso: ISODate, months: number): ISODate {
  const [y, m, d] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const monthIndex = total - year * 12;
  const day = Math.min(d, daysInMonth(year, monthIndex));
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
}

/**
 * The nth occurrence (0 = the start date) of a repeating schedule. Always computed
 * from the start date, so a rule that starts on the 31st lands on the 31st again
 * after passing through February.
 */
export function nthOccurrence(start: ISODate, frequency: Frequency, n: number): ISODate {
  switch (frequency) {
    case 'weekly':
      return addDays(start, 7 * n);
    case 'biweekly':
      return addDays(start, 14 * n);
    case 'monthly':
      return addMonths(start, n);
    case 'yearly':
      return addMonths(start, 12 * n);
  }
}

export function monthKeyOf(iso: ISODate): MonthKey {
  return iso.slice(0, 7);
}

export function currentMonthKey(now: Date = new Date()): MonthKey {
  return monthKeyOf(todayISO(now));
}

export function shiftMonth(key: MonthKey, delta: number): MonthKey {
  return monthKeyOf(addMonths(`${key}-01`, delta));
}

export function daysInMonthKey(key: MonthKey): number {
  const [y, m] = key.split('-').map(Number);
  return daysInMonth(y, m - 1);
}

/** Whole days between two dates (b - a). */
export function daysBetween(a: ISODate, b: ISODate): number {
  const ms = parseISODate(b).getTime() - parseISODate(a).getTime();
  return Math.round(ms / 86_400_000);
}

const monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
const shortMonthFormatter = new Intl.DateTimeFormat(undefined, { month: 'short' });
const monthNameFormatter = new Intl.DateTimeFormat(undefined, { month: 'long' });
const dayFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});
const dayYearFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

/** "November 2026" */
export function formatMonth(key: MonthKey): string {
  return monthFormatter.format(parseISODate(`${key}-01`));
}

/** "November" */
export function formatMonthName(key: MonthKey): string {
  return monthNameFormatter.format(parseISODate(`${key}-01`));
}

/** "Nov" */
export function formatShortMonth(key: MonthKey): string {
  return shortMonthFormatter.format(parseISODate(`${key}-01`));
}

/** "Today", "Yesterday", or "Tue, Nov 3". */
export function formatDayLabel(iso: ISODate, today: ISODate = todayISO()): string {
  if (iso === today) return 'Today';
  if (iso === addDays(today, -1)) return 'Yesterday';
  if (iso === addDays(today, 1)) return 'Tomorrow';
  if (iso.slice(0, 4) !== today.slice(0, 4)) return dayYearFormatter.format(parseISODate(iso));
  return dayFormatter.format(parseISODate(iso));
}

/** "Nov 3, 2026" */
export function formatDate(iso: ISODate): string {
  return dayYearFormatter.format(parseISODate(iso));
}
