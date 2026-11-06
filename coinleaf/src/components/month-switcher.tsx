import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { currentMonthKey, formatMonth, shiftMonth } from '@/lib/dates';
import type { MonthKey } from '@/lib/types';

import { Icon, Txt } from './ui';

export function MonthSwitcher({
  month,
  onChange,
  allowFuture = false,
}: {
  month: MonthKey;
  onChange: (m: MonthKey) => void;
  allowFuture?: boolean;
}) {
  const t = useTheme();
  const now = currentMonthKey();
  const canForward = allowFuture || month < now;
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Previous month"
        testID="month-prev"
        hitSlop={10}
        onPress={() => onChange(shiftMonth(month, -1))}
        style={({ pressed }) => [styles.arrow, { backgroundColor: t.card, opacity: pressed ? 0.6 : 1 }]}>
        <Icon name="chevron-back" size={18} color={t.text} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={month === now ? formatMonth(month) : `${formatMonth(month)}. Go to this month`}
        onPress={() => onChange(now)}
        disabled={month === now}
        style={styles.label}>
        <Txt variant="headline" testID="month-label">
          {formatMonth(month)}
        </Txt>
        {month !== now ? (
          <Txt variant="caption" tone="tint" weight="600">
            Back to this month
          </Txt>
        ) : null}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next month"
        testID="month-next"
        hitSlop={10}
        disabled={!canForward}
        onPress={() => onChange(shiftMonth(month, 1))}
        style={({ pressed }) => [
          styles.arrow,
          { backgroundColor: t.card, opacity: !canForward ? 0.35 : pressed ? 0.6 : 1 },
        ]}>
        <Icon name="chevron-forward" size={18} color={t.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  arrow: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, alignItems: 'center', minHeight: 36, justifyContent: 'center' },
});
