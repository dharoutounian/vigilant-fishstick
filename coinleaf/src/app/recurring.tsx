import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, CategoryIcon, Divider, EmptyState, Row, Section, Txt } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDayLabel } from '@/lib/dates';
import { FREQUENCY_SHORT, nextOccurrence } from '@/lib/recurring';
import { categoryMap } from '@/lib/selectors';
import { useMoney, useStore } from '@/lib/store';
import type { RecurringRule } from '@/lib/types';

/** What a recurring rule adds up to per month, for the summary line. */
function monthlyEquivalent(r: RecurringRule): number {
  const perYear = { weekly: 52, biweekly: 26, monthly: 12, yearly: 1 }[r.frequency];
  return Math.round((r.amount * perYear) / 12);
}

export default function RecurringScreen() {
  const { state } = useStore();
  const money = useMoney();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const cats = categoryMap(state.categories);

  const { active, paused, monthlyOut, monthlyIn } = useMemo(() => {
    const byNext = (a: RecurringRule, b: RecurringRule) => (nextOccurrence(a) < nextOccurrence(b) ? -1 : 1);
    const active = state.recurring.filter((r) => r.active).sort(byNext);
    const paused = state.recurring.filter((r) => !r.active);
    const sum = (type: RecurringRule['type']) =>
      active.filter((r) => r.type === type).reduce((s, r) => s + monthlyEquivalent(r), 0);
    return { active, paused, monthlyOut: sum('expense'), monthlyIn: sum('income') };
  }, [state.recurring]);

  const row = (r: RecurringRule, i: number) => {
    const c = cats.get(r.categoryId);
    const next = nextOccurrence(r);
    return (
      <View key={r.id}>
        {i > 0 ? <Divider inset={64} /> : null}
        <Row
          testID={`rule-${r.id}`}
          left={<CategoryIcon icon={c?.icon ?? 'repeat'} color={c?.color ?? '#64748B'} />}
          title={r.note || c?.name || 'Repeating'}
          subtitle={`${FREQUENCY_SHORT[r.frequency]} · ${r.active ? `next ${formatDayLabel(next)}` : 'paused'}`}
          right={
            <Txt variant="callout" weight="600" money tone={r.type === 'income' ? 'income' : 'primary'}>
              {money(r.type === 'income' ? r.amount : -r.amount, { signed: true })}
            </Txt>
          }
          onPress={() => router.push({ pathname: '/recurring-rule', params: { id: r.id } })}
        />
      </View>
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxl }]}>
      {state.recurring.length === 0 ? (
        <Card>
          <EmptyState
            icon="repeat"
            title="No repeating transactions"
            message="Rent, salary and subscriptions can be added automatically. Choose a repeat option when you add a transaction."
            action={<Button title="Add one" icon="add" size="sm" onPress={() => router.push('/transaction')} />}
          />
        </Card>
      ) : (
        <>
          <Card style={styles.summary}>
            <View style={{ flex: 1 }}>
              <Txt variant="footnote" tone="secondary">
                Regular income
              </Txt>
              <Txt variant="headline" money tone="income">
                {money(monthlyIn)}/mo
              </Txt>
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="footnote" tone="secondary">
                Regular bills
              </Txt>
              <Txt variant="headline" money>
                {money(monthlyOut)}/mo
              </Txt>
            </View>
          </Card>
          {active.length ? (
            <Section title="Active" footer="Each one is added on its date, even if Coinleaf wasn’t open that day.">
              <Card padded={false}>{active.map(row)}</Card>
            </Section>
          ) : null}
          {paused.length ? (
            <Section title="Paused">
              <Card padded={false}>{paused.map(row)}</Card>
            </Section>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.lg, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  summary: { flexDirection: 'row', gap: Spacing.lg },
});
