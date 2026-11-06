/**
 * Money helpers. Amounts are integer cents everywhere; these functions are the
 * only place that converts to and from what people read and type.
 */

/** Largest amount accepted from input: 999,999,999.99 */
export const MAX_AMOUNT = 99_999_999_999;

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: string, compact: boolean): Intl.NumberFormat {
  const key = `${currency}|${compact}`;
  let f = formatters.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        ...(compact ? { notation: 'compact', maximumFractionDigits: 1 } : null),
      });
    } catch {
      // Unknown currency code: fall back to a plain number with the code in front.
      f = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    formatters.set(key, f);
  }
  return f;
}

export interface FormatOptions {
  /** Prefix positive values with "+". Negative values always get "−". */
  signed?: boolean;
  /** "$1.2K" instead of "$1,234.00". */
  compact?: boolean;
}

export function formatMoney(cents: number, currency: string, opts: FormatOptions = {}): string {
  const f = formatter(currency, !!opts.compact);
  const abs = Math.abs(cents) / 100;
  let text = f.format(abs);
  if (!f.resolvedOptions().currency) text = `${currency} ${text}`;
  if (cents < 0) return `−${text}`;
  if (opts.signed && cents > 0) return `+${text}`;
  return text;
}

/** Number of decimals the currency normally shows (2 for USD, 0 for JPY). */
export function currencyDecimals(currency: string): number {
  try {
    return (
      new Intl.NumberFormat(undefined, { style: 'currency', currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

export function currencySymbol(currency: string): string {
  try {
    const f = new Intl.NumberFormat(undefined, { style: 'currency', currency });
    if (typeof f.formatToParts === 'function') {
      const part = f.formatToParts(0).find((p) => p.type === 'currency');
      if (part) return part.value;
    }
    // "$0.00" -> "$", "0,00 €" -> "€", "CHF 0.00" -> "CHF"
    return f.format(0).replace(/[\d.,\s\u00a0\u202f]/g, '') || currency;
  } catch {
    return currency;
  }
}

/** The decimal separator people in this locale type: "." or ",". */
export function localeDecimalSeparator(): string {
  try {
    // "1.5" or "1,5"
    const mark = new Intl.NumberFormat(undefined, { minimumFractionDigits: 1 }).format(1.5).replace(/\d/g, '');
    return mark === ',' ? ',' : '.';
  } catch {
    return '.';
  }
}

/**
 * Cleans what someone is typing into an amount field. Accepts either "." or ","
 * as the decimal mark, keeps one of them, caps decimals at `decimals`, and
 * strips leading zeros. Returns a normalized string using "." as the mark.
 *
 *   sanitizeAmountInput("12,5")   -> "12.5"
 *   sanitizeAmountInput("0012")   -> "12"
 *   sanitizeAmountInput("1.234")  -> "1.23"
 */
export function sanitizeAmountInput(raw: string, decimals = 2): string {
  const cleaned = raw.replace(/,/g, '.').replace(/[^\d.]/g, '');
  const dot = cleaned.indexOf('.');
  let intPart = dot === -1 ? cleaned : cleaned.slice(0, dot);
  let fracPart = dot === -1 ? '' : cleaned.slice(dot + 1).replace(/\./g, '');

  intPart = intPart.replace(/^0+(?=\d)/, '').slice(0, 9);
  if (decimals <= 0) return intPart;

  fracPart = fracPart.slice(0, decimals);
  if (dot === -1) return intPart;
  return `${intPart || '0'}.${fracPart}`;
}

/** Converts a sanitized amount string to cents. Returns null for empty or zero. */
export function amountInputToCents(input: string): number | null {
  // Done on the digits rather than with floats: Number('1.005') * 100 is 100.4999…
  const m = /^(\d*)(?:\.(\d*))?$/.exec(input);
  if (!m || (!m[1] && !m[2])) return null;
  const frac = m[2] ?? '';
  let cents = Number(m[1] || '0') * 100 + Number((frac + '00').slice(0, 2));
  if (frac.length > 2 && Number(frac[2]) >= 5) cents += 1;
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > MAX_AMOUNT) return null;
  return cents;
}

/** The editable string for an existing amount: 1250 -> "12.5", 1200 -> "12". */
export function centsToAmountInput(cents: number, decimals = 2): string {
  const value = cents / 100;
  if (decimals <= 0) return String(Math.round(value));
  return String(Number(value.toFixed(decimals)));
}

/**
 * Parses a free-form amount someone pasted or imported: "$1,234.56", "1.234,56",
 * "12,5". Returns cents, or null when it isn't a positive amount.
 */
export function parseAmount(text: string): number | null {
  let s = text.replace(/[^\d.,-]/g, '');
  if (!s || s.startsWith('-')) return null;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot !== -1 && lastComma !== -1) {
    // Both present: whichever comes last is the decimal mark.
    const decimal = lastDot > lastComma ? '.' : ',';
    const thousands = decimal === '.' ? ',' : '.';
    s = s.split(thousands).join('').replace(decimal, '.');
  } else {
    const mark = lastDot !== -1 ? '.' : lastComma !== -1 ? ',' : null;
    if (mark) {
      const count = s.split(mark).length - 1;
      // "1,234,567" is grouping; a single mark is a decimal point.
      s = count > 1 ? s.split(mark).join('') : s.replace(mark, '.');
    }
  }
  return amountInputToCents(s);
}
