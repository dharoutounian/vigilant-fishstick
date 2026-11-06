import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProgressRing } from '@/components/charts';
import { Button, Card, Divider, EmptyState, Icon, Section, Txt } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatDayLabel } from '@/lib/dates';
import { confirm } from '@/lib/platform';
import { goalProgress } from '@/lib/selectors';
import { useMoney, useStore } from '@/lib/store';

export default function GoalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch } = useStore();
  const money = useMoney();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const goal = state.goals.find((g) => g.id === id);

  // Deleting a goal navigates away from here; if one is still missing (a stale
  // link), say so rather than showing an empty page.
  if (!goal) {
    return (
      <View style={{ flex: 1, backgroundColor: t.background, justifyContent: 'center' }}>
        <EmptyState icon="flag" title="Goal not found" message="It may have been deleted." />
      </View>
    );
  }

  const p = goalProgress(goal);
  const history = [...goal.contributions].sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));

  async function removeContribution(cid: string, amount: number) {
    const ok = await confirm({
      title: `Remove this ${amount > 0 ? 'deposit' : 'withdrawal'}?`,
      message: `${money(Math.abs(amount))} will be ${amount > 0 ? 'taken off' : 'added back to'} ${goal!.name}.`,
      confirmText: 'Remove',
      destructive: true,
    });
    if (ok) dispatch({ type: 'goal/removeContribution', goalId: goal!.id, contributionId: cid });
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: goal.name,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              testID="edit-goal"
              hitSlop={10}
              onPress={() => router.push({ pathname: '/goal-edit', params: { id: goal.id } })}>
              <Txt tone="tint" weight="600">
                Edit
              </Txt>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: t.background }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxl }]}>
        <View style={styles.hero}>
          <ProgressRing ratio={p.ratio} color={goal.color} size={180} stroke={14}>
            <Icon name={p.complete ? 'checkmark-circle' : goal.icon} size={30} color={goal.color} />
            <Txt variant="title" money style={{ marginTop: 4 }} testID="goal-percent">
              {Math.round(p.ratio * 100)}%
            </Txt>
          </ProgressRing>
          <Txt money style={{ fontSize: 34, fontWeight: '700' }} testID="goal-saved">
            {money(p.saved)}
          </Txt>
          <Txt variant="subhead" tone="secondary" money>
            saved of {money(goal.target)}
          </Txt>
        </View>

        <Card style={{ gap: Spacing.md }}>
          <Stat label="Still to save" value={p.complete ? 'Nothing — goal reached' : money(p.remaining)} />
          {goal.deadline ? (
            <>
              <Divider />
              <Stat label="Target date" value={formatDate(goal.deadline)} />
            </>
          ) : null}
          {p.monthlyNeeded != null ? (
            <>
              <Divider />
              <Stat label="To stay on track" value={`${money(p.monthlyNeeded)} a month`} />
            </>
          ) : null}
        </Card>

        <View style={styles.actions}>
          <Button
            title="Add money"
            icon="add"
            testID="goal-add-money"
            style={{ flex: 1 }}
            onPress={() => router.push({ pathname: '/goal-funds', params: { id: goal.id, mode: 'add' } })}
          />
          <Button
            title="Withdraw"
            icon="remove"
            variant="secondary"
            style={{ flex: 1 }}
            disabled={p.saved <= 0}
            onPress={() => router.push({ pathname: '/goal-funds', params: { id: goal.id, mode: 'withdraw' } })}
          />
        </View>

        <Section title="History" footer={history.length ? 'Tap an entry to remove it.' : undefined}>
          <Card padded={false}>
            {history.length === 0 ? (
              <Txt tone="secondary" align="center" style={{ padding: Spacing.xl }}>
                No money added yet.
              </Txt>
            ) : (
              history.map((c, i) => (
                <View key={c.id}>
                  {i > 0 ? <Divider inset={Spacing.lg} /> : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${c.amount > 0 ? 'Added' : 'Withdrew'} ${money(Math.abs(c.amount))}, ${formatDayLabel(c.date)}`}
                    onPress={() => removeContribution(c.id, c.amount)}
                    style={({ pressed }) => [styles.historyRow, pressed && { backgroundColor: t.cardPressed }]}>
                    <Icon name={c.amount > 0 ? 'arrow-down-circle' : 'arrow-up-circle'} size={22} color={c.amount > 0 ? t.income : t.textSecondary} />
                    <Txt variant="callout" style={{ flex: 1 }}>
                      {c.amount > 0 ? 'Added' : 'Withdrew'}
                    </Txt>
                    <Txt variant="footnote" tone="secondary">
                      {formatDayLabel(c.date)}
                    </Txt>
                    <Txt variant="callout" weight="600" money tone={c.amount > 0 ? 'income' : 'primary'} style={{ minWidth: 90, textAlign: 'right' }}>
                      {money(c.amount, { signed: true })}
                    </Txt>
                  </Pressable>
                </View>
              ))
            )}
          </Card>
        </Section>
      </ScrollView>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Txt variant="subhead" tone="secondary">
        {label}
      </Txt>
      <Txt variant="subhead" weight="600" money style={{ flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? Spacing.lg : Spacing.xl,
    gap: Spacing.lg,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  hero: { alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.md },
  actions: { flexDirection: 'row', gap: Spacing.md },
  stat: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.md },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
});
