import { categoryMap } from './selectors';
import type { AppState } from './types';

/** Quotes a CSV field when it needs it, and defuses spreadsheet formula injection. */
export function csvField(value: string, text = true): string {
  let v = value;
  // A text cell starting with = + - @ is run as a formula by Excel/Sheets/Numbers.
  if (text && /^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

/**
 * All transactions as CSV, oldest first. Amounts are plain decimals with a
 * leading minus for spending, which every spreadsheet app imports cleanly.
 */
export function transactionsToCsv(state: AppState): string {
  const cats = categoryMap(state.categories);
  const header = ['Date', 'Type', 'Category', 'Amount', 'Currency', 'Note', 'Repeats'];
  const rows = [...state.transactions]
    .sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1))
    .map((t) => {
      const signed = (t.type === 'expense' ? -t.amount : t.amount) / 100;
      return [
        t.date,
        t.type === 'expense' ? 'Expense' : 'Income',
        cats.get(t.categoryId)?.name ?? 'Uncategorized',
        signed.toFixed(2),
        state.settings.currency,
        t.note,
        t.recurringId ? 'Yes' : '',
      ];
    });
  const AMOUNT_COLUMN = 3;
  return (
    [header, ...rows]
      .map((r) => r.map((v, i) => csvField(v, i !== AMOUNT_COLUMN)).join(','))
      .join('\r\n') + '\r\n'
  );
}
