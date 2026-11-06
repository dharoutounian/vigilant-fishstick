import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Switch, TextInput, View } from 'react-native';

import { AmountInput } from '@/components/amount-input';
import { CategoryPicker } from '@/components/category-picker';
import { ModalScreen, useCloseOnce } from '@/components/modal-screen';
import { Button, Card, Divider, Section, Txt } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatDayLabel, todayISO } from '@/lib/dates';
import { amountInputToCents, centsToAmountInput, currencyDecimals } from '@/lib/money';
import { confirm, successFeedback } from '@/lib/platform';
import { FREQUENCY_LABELS, nextOccurrence, resumeRule } from '@/lib/recurring';
import { pickableCategories } from '@/lib/selectors';
import { useStore } from '@/lib/store';

export default function RecurringRuleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch } = useStore();
  const t = useTheme();
  const rule = state.recurring.find((r) => r.id === id);
  const decimals = currencyDecimals(state.settings.currency);

  const [amount, setAmount] = useState(rule ? centsToAmountInput(rule.amount, decimals) : '');
  const [categoryId, setCategoryId] = useState(rule?.categoryId ?? null);
  const [note, setNote] = useState(rule?.note ?? '');
  const [active, setActive] = useState(rule?.active ?? true);

  const close = useCloseOnce(!rule);

  const categories = useMemo(
    () => (rule ? pickableCategories(state.categories, rule.type) : []),
    [state.categories, rule],
  );

  if (!rule) return null;
  const cents = amountInputToCents(amount);
  const valid = !!cents && !!categoryId;
  const madeSoFar = state.transactions.filter((x) => x.recurringId === rule.id).length;

  function save() {
    if (!valid || !rule) return;
    const today = todayISO();
    let next = { ...rule, amount: cents!, categoryId: categoryId!, note: note.trim() };
    if (active && !rule.active) next = resumeRule(next, today);
    else next.active = active;
    dispatch({ type: 'recurring/update', rule: next, today });
    successFeedback();
    close();
  }

  async function remove() {
    if (!rule) return;
    const ok = await confirm({
      title: 'Stop repeating?',
      message: madeSoFar
        ? `No more will be added. The ${madeSoFar} already recorded ${madeSoFar === 1 ? 'stays' : 'stay'} in your history.`
        : 'No more will be added.',
      confirmText: 'Stop and delete',
      destructive: true,
    });
    if (!ok) return;
    dispatch({ type: 'recurring/delete', id: rule.id });
    close();
  }

  return (
    <ModalScreen title="Repeating" onAction={save} actionDisabled={!valid}>
      <AmountInput value={amount} onChange={setAmount} currency={state.settings.currency} tone={rule.type === 'income' ? 'income' : 'primary'} />
      <Card style={{ gap: Spacing.md }}>
        <Info label="Repeats" value={FREQUENCY_LABELS[rule.frequency]} />
        <Divider />
        <Info label="Started" value={formatDate(rule.startDate)} />
        <Divider />
        <Info label="Next" value={active ? formatDayLabel(nextOccurrence(rule)) : 'Paused'} />
        <Divider />
        <View style={styles.switchRow}>
          <Txt variant="subhead" style={{ flex: 1 }}>
            Active
          </Txt>
          <Switch value={active} onValueChange={setActive} trackColor={{ true: t.tint, false: t.fill }} accessibilityLabel="Active" />
        </View>
      </Card>
      <Txt variant="footnote" tone="secondary">
        Changes apply to future repeats. Ones already recorded can be edited from Activity.
      </Txt>
      <Section title="Category">
        <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />
      </Section>
      <Section title="Note">
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Note"
          placeholderTextColor={t.textTertiary}
          maxLength={120}
          style={[styles.input, { backgroundColor: t.card, color: t.text }]}
        />
      </Section>
      <Button title="Stop repeating" icon="stop-circle" variant="destructive" onPress={remove} />
    </ModalScreen>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.switchRow}>
      <Txt variant="subhead" tone="secondary" style={{ flex: 1 }}>
        {label}
      </Txt>
      <Txt variant="subhead" weight="600">
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 28 },
  input: { borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: 14, fontSize: 17 },
});
