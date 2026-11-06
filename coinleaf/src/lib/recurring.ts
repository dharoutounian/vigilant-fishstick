import { nthOccurrence } from './dates';
import type { ISODate, RecurringRule, Transaction } from './types';

/** Safety cap so a rule with a start date years in the past can't flood the list. */
const MAX_PER_RUN = 500;

/** Id of the nth transaction a rule produces. Deterministic, so re-running never duplicates. */
export function recurringTxId(ruleId: string, n: number): string {
  return `${ruleId}__${n}`;
}

export function nextOccurrence(rule: RecurringRule): ISODate {
  return nthOccurrence(rule.startDate, rule.frequency, rule.generated);
}

/**
 * Turns every occurrence that is due (on or before `today`) into a transaction.
 * Returns the new transactions and the rules with their counters advanced.
 * Pure: the same input always gives the same output.
 */
export function generateDue(
  rules: RecurringRule[],
  today: ISODate,
  existingIds: Set<string>,
): { created: Transaction[]; rules: RecurringRule[]; changed: boolean } {
  const created: Transaction[] = [];
  let changed = false;

  const nextRules = rules.map((rule) => {
    if (!rule.active) return rule;
    let n = rule.generated;
    let date = nthOccurrence(rule.startDate, rule.frequency, n);
    let made = 0;
    while (date <= today && made < MAX_PER_RUN) {
      const id = recurringTxId(rule.id, n);
      if (!existingIds.has(id)) {
        created.push({
          id,
          type: rule.type,
          amount: rule.amount,
          categoryId: rule.categoryId,
          date,
          note: rule.note,
          recurringId: rule.id,
          createdAt: rule.createdAt + n,
        });
      }
      n += 1;
      made += 1;
      date = nthOccurrence(rule.startDate, rule.frequency, n);
    }
    if (n === rule.generated) return rule;
    changed = true;
    return { ...rule, generated: n };
  });

  return { created, rules: nextRules, changed };
}

/**
 * Re-activates a paused rule without back-filling the occurrences that fell due
 * while it was paused: the schedule picks up from the first date on or after today.
 */
export function resumeRule(rule: RecurringRule, today: ISODate): RecurringRule {
  let n = rule.generated;
  while (nthOccurrence(rule.startDate, rule.frequency, n) < today) n += 1;
  return { ...rule, active: true, generated: n };
}

export const FREQUENCY_LABELS: Record<RecurringRule['frequency'], string> = {
  weekly: 'Every week',
  biweekly: 'Every 2 weeks',
  monthly: 'Every month',
  yearly: 'Every year',
};

export const FREQUENCY_SHORT: Record<RecurringRule['frequency'], string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  yearly: 'Yearly',
};
