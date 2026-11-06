import {
  amountInputToCents,
  centsToAmountInput,
  formatMoney,
  parseAmount,
  sanitizeAmountInput,
} from '../money';

describe('sanitizeAmountInput', () => {
  it.each([
    ['12', '12'],
    ['12.5', '12.5'],
    ['12,5', '12.5'],
    ['0012', '12'],
    ['.5', '0.5'],
    ['1.234', '1.23'],
    ['1..2', '1.2'],
    ['1.2.3', '1.23'],
    ['$4a5', '45'],
    ['', ''],
    ['0', '0'],
    ['1234567890123', '123456789'],
  ])('%p -> %p', (input, out) => {
    expect(sanitizeAmountInput(input)).toBe(out);
  });

  it('drops decimals for zero-decimal currencies', () => {
    expect(sanitizeAmountInput('1200.50', 0)).toBe('1200');
  });
});

describe('amountInputToCents', () => {
  it('converts without floating point error', () => {
    expect(amountInputToCents('0.1')).toBe(10);
    expect(amountInputToCents('19.99')).toBe(1999);
    expect(amountInputToCents('1.005')).toBe(101); // rounds rather than truncating
    expect(amountInputToCents('123456789.99')).toBe(12345678999);
  });

  it('rejects empty, zero and nonsense', () => {
    expect(amountInputToCents('')).toBeNull();
    expect(amountInputToCents('.')).toBeNull();
    expect(amountInputToCents('0')).toBeNull();
    expect(amountInputToCents('0.00')).toBeNull();
    expect(amountInputToCents('abc')).toBeNull();
  });
});

describe('centsToAmountInput', () => {
  it('round-trips through the input format', () => {
    for (const cents of [1, 10, 99, 100, 1250, 1999, 100000, 12345678999]) {
      expect(amountInputToCents(centsToAmountInput(cents))).toBe(cents);
    }
    expect(centsToAmountInput(1250)).toBe('12.5');
    expect(centsToAmountInput(1200)).toBe('12');
  });
});

describe('parseAmount', () => {
  it.each([
    ['$1,234.56', 123456],
    ['1.234,56', 123456],
    ['12,5', 1250],
    ['1,234,567', 123456700],
    ['€ 9.99', 999],
    ['-5', null],
    ['', null],
  ])('%p -> %p', (input, cents) => {
    expect(parseAmount(input)).toBe(cents);
  });
});

describe('formatMoney', () => {
  it('formats cents in the currency', () => {
    expect(formatMoney(123456, 'USD')).toMatch(/1,234\.56/);
    expect(formatMoney(123456, 'USD')).toContain('$');
  });

  it('signs values', () => {
    expect(formatMoney(500, 'USD', { signed: true }).startsWith('+')).toBe(true);
    expect(formatMoney(-500, 'USD').startsWith('−')).toBe(true);
    expect(formatMoney(0, 'USD', { signed: true }).startsWith('+')).toBe(false);
  });

  it('respects zero-decimal currencies', () => {
    expect(formatMoney(150000, 'JPY')).not.toMatch(/\.\d\d/);
  });

  it('survives an unknown currency code', () => {
    expect(formatMoney(100, 'ZZZ')).toContain('1');
  });
});

describe('currency display helpers', () => {
  it('finds the symbol and decimal mark', () => {
    const { currencySymbol, localeDecimalSeparator } = jest.requireActual('../money');
    expect(currencySymbol('USD')).toBe('$');
    expect(currencySymbol('EUR')).toBe('€');
    expect(['.', ',']).toContain(localeDecimalSeparator());
  });
});
