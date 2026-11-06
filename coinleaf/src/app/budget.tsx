import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AmountInput } from '@/components/amount-input';
import { ModalScreen, useCloseOnce } from '@/components/modal-screen';
import { Button, CategoryIcon, Chip, Section, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { currentMonthKey, shiftMonth } from '@/lib/dates';
import { amountInputToCents, centsToAmountInput, currencyDecimals } from '@/lib/money';
import { successFeedback } from '@/lib/platform';
import { transactionsInMonth } from '@/lib/selectors';
import { useMoney, useStore } from '@/lib/store';

export default function BudgetScreen() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const { state, dispatch } = useStore();
  const money = useMoney();
  const category = state.categories.find((c) => c.id === categoryId);
  const current = categoryId ? state.budgets[categoryId] : undefined;
  const decimals = currencyDecimals(state.settings.currency);
  const [amount, setAmount] = useState(current ? centsToAmountInput(current, decimals) : '');

  const close = useCloseOnce(!category);

  // What was actually spent recently, to suggest a realistic limit.
  const suggestions = useMemo(() => {
    const month = currentMonthKey();
    const spentIn = (m: string) =>
      transactionsInMonth(state.transactions, m)
        .filter((t) => t.type === 'expense' && t.categoryId === categoryId)
        .reduce((s, t) => s + t.amount, 0);
    const last = spentIn(shiftMonth(month, -1));
    const three = [1, 2, 3].map((i) => spentIn(shiftMonth(month, -i)));
    const months = three.filter((x) => x > 0).length;
    const avg = months ? Math.round(three.reduce((a, b) => a + b, 0) / months) : 0;
    // Rounded up to a whole unit so the suggestion reads cleanly.
    const round = (c: number) => Math.ceil(c / 100) * 100;
    const out: { label: string; cents: number }[] = [];
    if (last) out.push({ label: `Last month: ${money(round(last))}`, cents: round(last) });
    if (avg && months > 1 && round(avg) !== round(last)) out.push({ label: `3-month average: ${money(round(avg))}`, cents: round(avg) });
    return out;
  }, [state.transactions, categoryId, money]);

  if (!category) return null;
  const cents = amountInputToCents(amount);

  function save() {
    if (!cents) return;
    dispatch({ type: 'budget/set', categoryId: category!.id, limit: cents });
    successFeedback();
    close();
  }

  function remove() {
    dispatch({ type: 'budget/set', categoryId: category!.id, limit: null });
    close();
  }

  return (
    <ModalScreen title={current ? 'Edit budget' : 'New budget'} onAction={save} actionDisabled={!cents}>
      <View style={styles.head}>
        <CategoryIcon icon={category.icon} color={category.color} size={52} />
        <Txt variant="title">{category.name}</Txt>
        <Txt variant="subhead" tone="secondary">
          Monthly limit
        </Txt>
      </View>
      <AmountInput value={amount} onChange={setAmount} currency={state.settings.currency} autoFocus testID="budget-amount" label="Monthly limit" />
      {suggestions.length ? (
        <Section title="Based on your spending">
          <View style={styles.chips}>
            {suggestions.map((s) => (
              <Chip key={s.label} label={s.label} onPress={() => setAmount(centsToAmountInput(s.cents, decimals))} />
            ))}
          </View>
        </Section>
      ) : null}
      <Txt variant="footnote" tone="secondary" align="center">
        The same limit applies every month. Change it whenever you like.
      </Txt>
      {current ? <Button title="Remove budget" icon="trash" variant="destructive" onPress={remove} /> : null}
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
