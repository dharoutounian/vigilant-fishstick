import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { MonthSwitcher } from '@/components/month-switcher';
import { Card, CategoryIcon, Divider, EmptyState, Icon, ProgressBar, Screen, Section, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { currentMonthKey } from '@/lib/dates';
import {
  budgetLines,
  budgetSummary,
  pickableCategories,
  totalsByCategory,
  transactionsInMonth,
  type BudgetLine,
} from '@/lib/selectors';
import { useMoney, useStore } from '@/lib/store';

export default function BudgetsScreen() {
  const { state } = useStore();
  const money = useMoney();
  const t = useTheme();
  const [month, setMonth] = useState(currentMonthKey());

  const { lines, summary, unbudgeted } = useMemo(() => {
    const lines = budgetLines(state, month);
    const spent = new Map(
      totalsByCategory(transactionsInMonth(state.transactions, month), state.categories).map((r) => [r.category.id, r.amount]),
    );
    const unbudgeted = pickableCategories(state.categories, 'expense')
      .filter((c) => !state.budgets[c.id])
      .map((c) => ({ category: c, spent: spent.get(c.id) ?? 0 }))
      .sort((a, b) => b.spent - a.spent);
    return { lines, summary: budgetSummary(lines, month), unbudgeted };
  }, [state, month]);

  const statusColor = (s: BudgetLine['status']) => (s === 'over' ? t.danger : s === 'warning' ? t.warning : t.tint);
  const openBudget = (categoryId: string) => router.push({ pathname: '/budget', params: { categoryId } });

  return (
    <Screen title="Budgets">
      <MonthSwitcher month={month} onChange={setMonth} />

      {summary ? (
        <Card style={{ gap: Spacing.sm }}>
          <Txt variant="subhead" tone="secondary">
            {summary.remaining >= 0 ? 'Left to spend' : 'Over budget by'}
          </Txt>
          <Txt
            money
            testID="budget-left"
            style={{ fontSize: 36, fontWeight: '700' }}
            tone={summary.remaining >= 0 ? 'primary' : 'danger'}>
            {money(Math.abs(summary.remaining))}
          </Txt>
          <ProgressBar ratio={summary.ratio} color={statusColor(summary.status)} height={10} />
          <View style={styles.between}>
            <Txt variant="footnote" tone="secondary" money>
              {money(summary.spent)} of {money(summary.limit)}
            </Txt>
            {summary.perDayLeft != null ? (
              <Txt variant="footnote" tone="secondary" money>
                {money(summary.perDayLeft)}/day · {summary.daysLeft} {summary.daysLeft === 1 ? 'day' : 'days'} left
              </Txt>
            ) : null}
          </View>
        </Card>
      ) : (
        <Card>
          <EmptyState
            icon="wallet"
            title="Plan your month"
            message="Give a category a monthly limit and Coinleaf shows what's left as you spend. Budgets carry over to every month."
          />
        </Card>
      )}

      {lines.length ? (
        <Section title="Budgeted">
          <Card padded={false}>
            {lines.map((l, i) => (
              <View key={l.category.id}>
                {i > 0 ? <Divider inset={Spacing.lg} /> : null}
                <Pressable
                  testID={`budget-line-${l.category.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${l.category.name}: ${money(l.spent)} of ${money(l.limit)}`}
                  onPress={() => openBudget(l.category.id)}
                  style={({ pressed }) => [styles.line, pressed && { backgroundColor: t.cardPressed }]}>
                  <View style={styles.lineTop}>
                    <CategoryIcon icon={l.category.icon} color={l.category.color} size={32} />
                    <View style={{ flex: 1 }}>
                      <Txt variant="callout" weight="600" numberOfLines={1}>
                        {l.category.name}
                      </Txt>
                      <Txt variant="footnote" tone="secondary" money>
                        {money(l.spent)} of {money(l.limit)}
                      </Txt>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Txt variant="callout" weight="600" money tone={l.remaining < 0 ? 'danger' : 'primary'}>
                        {money(Math.abs(l.remaining))}
                      </Txt>
                      <Txt variant="caption" tone={l.remaining < 0 ? 'danger' : 'secondary'}>
                        {l.remaining < 0 ? 'over' : 'left'}
                      </Txt>
                    </View>
                  </View>
                  <ProgressBar ratio={l.ratio} color={statusColor(l.status)} height={6} />
                </Pressable>
              </View>
            ))}
          </Card>
        </Section>
      ) : null}

      {unbudgeted.length ? (
        <Section title={lines.length ? 'No budget yet' : 'Choose a category'} footer="Tap a category to set its monthly limit.">
          <Card padded={false}>
            {unbudgeted.map(({ category, spent }, i) => (
              <View key={category.id}>
                {i > 0 ? <Divider inset={60} /> : null}
                <Pressable
                  testID={`set-budget-${category.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Set a budget for ${category.name}`}
                  onPress={() => openBudget(category.id)}
                  style={({ pressed }) => [styles.unbudgeted, pressed && { backgroundColor: t.cardPressed }]}>
                  <CategoryIcon icon={category.icon} color={category.color} size={32} />
                  <View style={{ flex: 1 }}>
                    <Txt variant="callout" numberOfLines={1}>
                      {category.name}
                    </Txt>
                    {spent ? (
                      <Txt variant="footnote" tone="secondary" money>
                        {money(spent)} spent
                      </Txt>
                    ) : null}
                  </View>
                  <Icon name="add-circle" size={22} color={t.tint} />
                </Pressable>
              </View>
            ))}
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.sm },
  line: { padding: Spacing.lg, gap: Spacing.md },
  lineTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  unbudgeted: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
});
