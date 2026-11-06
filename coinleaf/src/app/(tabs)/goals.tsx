import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ProgressRing } from '@/components/charts';
import { Button, Card, EmptyState, Icon, IconButton, ProgressBar, Screen, Section, Txt } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, monthKeyOf, formatMonth } from '@/lib/dates';
import { goalProgress } from '@/lib/selectors';
import { useMoney, useStore } from '@/lib/store';
import type { Goal } from '@/lib/types';

export default function GoalsScreen() {
  const { state } = useStore();
  const money = useMoney();
  const t = useTheme();

  const goals = useMemo(
    () =>
      state.goals
        .map((g) => ({ goal: g, p: goalProgress(g) }))
        // Unfinished goals first, then by creation.
        .sort((a, b) => Number(a.p.complete) - Number(b.p.complete) || a.goal.createdAt - b.goal.createdAt),
    [state.goals],
  );
  const saved = goals.reduce((s, g) => s + g.p.saved, 0);
  const target = goals.reduce((s, g) => s + g.goal.target, 0);

  const add = <IconButton icon="add" label="New goal" testID="add-goal" onPress={() => router.push('/goal-edit')} />;

  if (!goals.length) {
    return (
      <Screen title="Goals" right={add}>
        <Card>
          <EmptyState
            icon="flag"
            title="Save for something"
            message="A trip, a new laptop, an emergency fund. Set a target and watch it fill up as you put money aside."
            action={<Button title="Create a goal" icon="add" onPress={() => router.push('/goal-edit')} />}
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title="Goals" right={add}>
      <Card style={{ gap: Spacing.sm }}>
        <Txt variant="subhead" tone="secondary">
          Saved across {goals.length} {goals.length === 1 ? 'goal' : 'goals'}
        </Txt>
        <Txt money style={{ fontSize: 34, fontWeight: '700' }} testID="goals-saved">
          {money(saved)}
        </Txt>
        <ProgressBar ratio={target ? saved / target : 0} color={t.tint} height={10} />
        <Txt variant="footnote" tone="secondary" money>
          of {money(target)} total
        </Txt>
      </Card>

      <Section title="Your goals">
        <View style={{ gap: Spacing.md }}>
          {goals.map(({ goal }) => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
        </View>
      </Section>
    </Screen>
  );
}

function GoalCard({ goal }: { goal: Goal }) {
  const t = useTheme();
  const money = useMoney();
  const p = goalProgress(goal);
  let detail: string;
  if (p.complete) detail = 'Goal reached';
  else if (p.monthlyNeeded != null) detail = `${money(p.monthlyNeeded)}/month to reach it by ${formatMonth(monthKeyOf(goal.deadline!))}`;
  else if (p.daysLeft != null && p.daysLeft <= 0) detail = `Target date was ${formatDate(goal.deadline!)}`;
  else detail = `${money(p.remaining)} to go`;

  return (
    <Pressable
      testID={`goal-${goal.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${goal.name}: ${money(p.saved)} of ${money(goal.target)}`}
      onPress={() => router.push({ pathname: '/goal/[id]', params: { id: goal.id } })}
      style={({ pressed }) => [styles.card, { backgroundColor: pressed ? t.cardPressed : t.card }]}>
      <ProgressRing ratio={p.ratio} color={goal.color} size={60} stroke={6}>
        <Icon name={p.complete ? 'checkmark' : goal.icon} size={24} color={goal.color} />
      </ProgressRing>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="headline" numberOfLines={1}>
          {goal.name}
        </Txt>
        <Txt variant="subhead" money>
          {money(p.saved)} <Txt variant="subhead" tone="secondary">of {money(goal.target)}</Txt>
        </Txt>
        <Txt variant="footnote" tone={p.complete ? 'tint' : 'secondary'} numberOfLines={2}>
          {detail}
        </Txt>
      </View>
      <Txt variant="headline" money tone="secondary">
        {Math.round(p.ratio * 100)}%
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, padding: Spacing.lg, borderRadius: Radius.lg },
});
