import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DonutChart, MonthBars } from '@/components/charts';
import { MonthSwitcher } from '@/components/month-switcher';
import { TransactionRow } from '@/components/transaction-row';
import { Button, Card, Divider, EmptyState, Icon, IconButton, ProgressBar, Screen, Section, Txt } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { currentMonthKey, formatMonth, formatMonthName } from '@/lib/dates';
import {
  budgetLines,
  budgetSummary,
  categoryMap,
  compareWithPreviousMonth,
  monthlyHistory,
  totalsByCategory,
  totalsOf,
  transactionsInMonth,
} from '@/lib/selectors';
import { useMoney, useStore } from '@/lib/store';

const TOP_SLICES = 5;

export default function OverviewScreen() {
  const { state } = useStore();
  const money = useMoney();
  const t = useTheme();
  const [month, setMonth] = useState(currentMonthKey());

  const data = useMemo(() => {
    const txs = transactionsInMonth(state.transactions, month);
    const totals = totalsOf(txs);
    const byCat = totalsByCategory(txs, state.categories, 'expense');
    const lines = budgetLines(state, month);
    return {
      txs,
      totals,
      byCat,
      budget: budgetSummary(lines, month),
      compare: compareWithPreviousMonth(state.transactions, month),
      history: monthlyHistory(state.transactions, month, 6),
      cats: categoryMap(state.categories),
    };
  }, [state, month]);

  const addButton = (
    <IconButton icon="add" label="Add transaction" testID="add-transaction" onPress={() => router.push('/transaction')} />
  );

  if (state.transactions.length === 0) {
    return (
      <Screen title="Overview" right={addButton}>
        <Card>
          <EmptyState
            icon="leaf"
            title="Welcome to Coinleaf"
            message="Track what you spend and earn, set monthly budgets, and save toward goals. Everything stays on this device."
            action={<Button title="Add your first transaction" icon="add" onPress={() => router.push('/transaction')} />}
          />
        </Card>
        <Section title="Get started">
          <Card padded={false}>
            <Tip icon="wallet" title="Set a budget" text="Pick a monthly limit for the categories you care about." onPress={() => router.navigate('/budgets')} />
            <Divider inset={64} />
            <Tip icon="flag" title="Create a savings goal" text="A trip, a laptop, a rainy-day fund." onPress={() => router.navigate('/goals')} />
            <Divider inset={64} />
            <Tip icon="repeat" title="Add your regular bills" text="Rent, salary and subscriptions can repeat automatically." onPress={() => router.push('/transaction')} />
          </Card>
        </Section>
      </Screen>
    );
  }

  const { totals, byCat, budget, compare } = data;
  const top = byCat.slice(0, TOP_SLICES);
  const rest = byCat.slice(TOP_SLICES);
  const restAmount = rest.reduce((s, r) => s + r.amount, 0);
  const slices = [
    ...top.map((r) => ({ key: r.category.id, value: r.amount, color: r.category.color })),
    ...(restAmount ? [{ key: 'rest', value: restAmount, color: t.textTertiary }] : []),
  ];
  const isCurrent = month === currentMonthKey();

  let insight: string | null = null;
  if (compare.change != null && Math.abs(compare.change) >= 0.01) {
    const pct = Math.round(Math.abs(compare.change) * 100);
    const span = isCurrent ? 'this time last month' : 'the month before';
    insight = `${pct}% ${compare.change < 0 ? 'less' : 'more'} than ${span}`;
  }

  return (
    <Screen title="Overview" right={addButton}>
      <MonthSwitcher month={month} onChange={setMonth} />

      <View style={[styles.hero, { backgroundColor: t.hero }]} testID="hero">
        <Txt variant="subhead" tone="heroSecondary">
          Spent in {formatMonthName(month)}
        </Txt>
        <Txt money tone="hero" style={styles.heroAmount} testID="spent-total" adjustsFontSizeToFit numberOfLines={1}>
          {money(totals.expense)}
        </Txt>
        {insight ? (
          <View style={styles.insight}>
            <Icon name={compare.change! < 0 ? 'trending-down' : 'trending-up'} size={15} color={t.heroText} />
            <Txt variant="footnote" tone="hero" weight="500">
              {insight}
            </Txt>
          </View>
        ) : null}
        <View style={styles.heroStats}>
          <HeroStat label="Income" value={money(totals.income)} testID="income-total" />
          <View style={[styles.heroDivider, { backgroundColor: t.heroTextSecondary }]} />
          <HeroStat label={totals.net >= 0 ? 'Saved' : 'Overspent'} value={money(Math.abs(totals.net))} testID="net-total" />
        </View>
      </View>

      {budget ? (
        <Pressable onPress={() => router.navigate('/budgets')} accessibilityRole="button" accessibilityLabel="Open budgets">
          <Card style={{ gap: Spacing.sm }}>
            <View style={styles.between}>
              <Txt variant="headline">Monthly budget</Txt>
              <Txt variant="subhead" tone="secondary" money>
                {money(budget.spent)} / {money(budget.limit)}
              </Txt>
            </View>
            <ProgressBar
              ratio={budget.ratio}
              color={budget.status === 'over' ? t.danger : budget.status === 'warning' ? t.warning : t.tint}
            />
            <Txt variant="footnote" tone={budget.status === 'over' ? 'danger' : 'secondary'}>
              {budget.remaining >= 0
                ? `${money(budget.remaining)} left${budget.perDayLeft != null ? ` · about ${money(budget.perDayLeft)} a day for ${budget.daysLeft} ${budget.daysLeft === 1 ? 'day' : 'days'}` : ''}`
                : `${money(-budget.remaining)} over budget`}
            </Txt>
          </Card>
        </Pressable>
      ) : (
        <Pressable onPress={() => router.navigate('/budgets')} accessibilityRole="button">
          <Card style={styles.nudge}>
            <Icon name="wallet" size={22} color={t.tint} />
            <View style={{ flex: 1 }}>
              <Txt variant="headline">Set a monthly budget</Txt>
              <Txt variant="footnote" tone="secondary">
                See how much is left to spend, day by day.
              </Txt>
            </View>
            <Icon name="chevron-forward" size={18} color={t.textTertiary} />
          </Card>
        </Pressable>
      )}

      <Section title="Where it went">
        <Card>
          {byCat.length === 0 ? (
            <Txt tone="secondary" align="center" style={{ paddingVertical: Spacing.lg }}>
              No spending in {formatMonth(month)}.
            </Txt>
          ) : (
            <View style={styles.breakdown}>
              <DonutChart slices={slices} size={150} stroke={20}>
                <Txt variant="caption" tone="secondary">
                  Total
                </Txt>
                <Txt variant="headline" money adjustsFontSizeToFit numberOfLines={1} style={{ maxWidth: 100 }}>
                  {money(totals.expense, { compact: totals.expense >= 1_000_000 })}
                </Txt>
              </DonutChart>
              <View style={styles.legend}>
                {top.map((r) => (
                  <LegendRow key={r.category.id} color={r.category.color} label={r.category.name} pct={r.share} />
                ))}
                {restAmount ? (
                  <LegendRow color={t.textTertiary} label={`${rest.length} more`} pct={restAmount / totals.expense} />
                ) : null}
              </View>
            </View>
          )}
        </Card>
      </Section>

      <Section title="Last 6 months">
        <Card>
          <MonthBars bars={data.history} format={(c) => money(c)} />
        </Card>
      </Section>

      <Section
        title="Recent"
        action={
          <Pressable onPress={() => router.navigate('/activity')} hitSlop={8} accessibilityRole="button">
            <Txt variant="subhead" tone="tint" weight="600">
              See all
            </Txt>
          </Pressable>
        }>
        <Card padded={false}>
          {data.txs.length === 0 ? (
            <Txt tone="secondary" align="center" style={{ padding: Spacing.xl }}>
              Nothing recorded in {formatMonth(month)}.
            </Txt>
          ) : (
            data.txs.slice(0, 5).map((tx, i) => (
              <View key={tx.id}>
                {i > 0 ? <Divider inset={64} /> : null}
                <TransactionRow tx={tx} category={data.cats.get(tx.categoryId)} showDate />
              </View>
            ))
          )}
        </Card>
      </Section>
    </Screen>
  );
}

function HeroStat({ label, value, testID }: { label: string; value: string; testID?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Txt variant="footnote" tone="heroSecondary">
        {label}
      </Txt>
      <Txt variant="headline" tone="hero" money testID={testID} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Txt>
    </View>
  );
}

function LegendRow({ color, label, pct }: { color: string; label: string; pct: number }) {
  return (
    <View style={styles.legendRow}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Txt variant="subhead" numberOfLines={1} style={{ flex: 1 }}>
        {label}
      </Txt>
      <Txt variant="subhead" tone="secondary" money>
        {Math.round(pct * 100)}%
      </Txt>
    </View>
  );
}

function Tip({ icon, title, text, onPress }: { icon: string; title: string; text: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.tip, pressed && { backgroundColor: t.cardPressed }]}>
      <View style={[styles.tipIcon, { backgroundColor: t.tintSoft }]}>
        <Icon name={icon} size={18} color={t.tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt variant="callout" weight="600">
          {title}
        </Txt>
        <Txt variant="footnote" tone="secondary">
          {text}
        </Txt>
      </View>
      <Icon name="chevron-forward" size={18} color={t.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: Radius.lg, padding: Spacing.xl, gap: Spacing.xs },
  heroAmount: { fontSize: 44, fontWeight: '700', letterSpacing: -0.5 },
  insight: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  heroStats: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.lg, gap: Spacing.lg },
  heroDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', opacity: 0.5 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: Spacing.sm },
  nudge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  breakdown: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xl },
  legend: { flex: 1, gap: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  tip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
  tipIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
