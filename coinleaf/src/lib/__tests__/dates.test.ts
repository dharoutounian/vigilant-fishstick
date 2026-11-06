import {
  addDays,
  addMonths,
  daysBetween,
  formatDayLabel,
  isValidISODate,
  nthOccurrence,
  parseISODate,
  shiftMonth,
  toISODate,
} from '../dates';

describe('dates', () => {
  it('parses as local midnight and formats back', () => {
    const d = parseISODate('2026-03-08');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(8);
    expect(d.getHours()).toBe(0);
    expect(toISODate(d)).toBe('2026-03-08');
  });

  it('validates dates', () => {
    expect(isValidISODate('2026-02-28')).toBe(true);
    expect(isValidISODate('2026-02-30')).toBe(false);
    expect(isValidISODate('2024-02-29')).toBe(true);
    expect(isValidISODate('26-1-1')).toBe(false);
    expect(isValidISODate(20260101)).toBe(false);
  });

  it('adds days across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
  });

  it('adds months, clamping to the end of short months', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2026-01-31', 2)).toBe('2026-03-31');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
  });

  it('computes occurrences from the start date, not from each other', () => {
    expect(nthOccurrence('2026-01-31', 'monthly', 1)).toBe('2026-02-28');
    expect(nthOccurrence('2026-01-31', 'monthly', 2)).toBe('2026-03-31');
    expect(nthOccurrence('2026-01-01', 'weekly', 2)).toBe('2026-01-15');
    expect(nthOccurrence('2026-01-01', 'biweekly', 2)).toBe('2026-01-29');
    expect(nthOccurrence('2024-02-29', 'yearly', 1)).toBe('2025-02-28');
    expect(nthOccurrence('2024-02-29', 'yearly', 4)).toBe('2028-02-29');
  });

  it('shifts months', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  it('counts days between dates across DST changes', () => {
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31);
    expect(daysBetween('2026-11-01', '2026-10-01')).toBe(-31);
  });

  it('labels nearby days in words', () => {
    expect(formatDayLabel('2026-11-06', '2026-11-06')).toBe('Today');
    expect(formatDayLabel('2026-11-05', '2026-11-06')).toBe('Yesterday');
    expect(formatDayLabel('2026-11-07', '2026-11-06')).toBe('Tomorrow');
    expect(formatDayLabel('2025-11-03', '2026-11-06')).toMatch(/2025/);
  });
});
