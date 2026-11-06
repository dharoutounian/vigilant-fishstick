import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { daysInMonthKey, formatDate, formatMonth, monthKeyOf, parseISODate, shiftMonth, todayISO } from '@/lib/dates';
import type { ISODate } from '@/lib/types';

import { Icon, Txt } from './ui';

const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'narrow' });
// Jan 4 2026 is a Sunday.
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => weekdayFormatter.format(new Date(2026, 0, 4 + i)));

/** A month grid for picking a day. */
export function Calendar({
  value,
  onChange,
  min,
}: {
  value: ISODate;
  onChange: (d: ISODate) => void;
  min?: ISODate;
}) {
  const t = useTheme();
  const [month, setMonth] = useState(monthKeyOf(value));
  const today = todayISO();
  const first = parseISODate(`${month}-01`).getDay();
  const days = daysInMonthKey(month);
  const cells: (ISODate | null)[] = [
    ...Array<null>(first).fill(null),
    ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
  ];
  while (cells.length % 7) cells.push(null);

  return (
    <View style={styles.wrap} testID="calendar">
      <View style={styles.head}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" hitSlop={10} onPress={() => setMonth(shiftMonth(month, -1))} style={styles.nav}>
          <Icon name="chevron-back" size={18} color={t.tint} />
        </Pressable>
        <Txt variant="headline">{formatMonth(month)}</Txt>
        <Pressable accessibilityRole="button" accessibilityLabel="Next month" hitSlop={10} onPress={() => setMonth(shiftMonth(month, 1))} style={styles.nav}>
          <Icon name="chevron-forward" size={18} color={t.tint} />
        </Pressable>
      </View>
      <View style={styles.grid}>
        {WEEKDAYS.map((w, i) => (
          <View key={`w${i}`} style={styles.cell}>
            <Txt variant="caption" tone="tertiary" weight="600">
              {w}
            </Txt>
          </View>
        ))}
        {cells.map((d, i) => {
          if (!d) return <View key={`e${i}`} style={styles.cell} />;
          const selected = d === value;
          const isToday = d === today;
          const disabled = !!min && d < min;
          return (
            <Pressable
              key={d}
              accessibilityRole="button"
              accessibilityLabel={formatDate(d)}
              aria-selected={selected}
              aria-disabled={disabled}
              disabled={disabled}
              onPress={() => onChange(d)}
              style={styles.cell}>
              <View
                style={[
                  styles.day,
                  selected && { backgroundColor: t.tint },
                  !selected && isToday && { borderWidth: 1.5, borderColor: t.tint },
                ]}>
                <Txt
                  variant="callout"
                  weight={selected || isToday ? '700' : '400'}
                  style={{ color: selected ? t.onTint : disabled ? t.textTertiary : isToday ? t.tint : t.text }}>
                  {Number(d.slice(8))}
                </Txt>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: Spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  nav: { padding: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1.15, alignItems: 'center', justifyContent: 'center' },
  day: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
