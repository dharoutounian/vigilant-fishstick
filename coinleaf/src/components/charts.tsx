import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatShortMonth } from '@/lib/dates';
import type { MonthBar } from '@/lib/selectors';

import { Txt } from './ui';

export interface DonutSlice {
  key: string;
  value: number;
  color: string;
}

/** A ring split into slices, with a small gap between each. */
export function DonutChart({
  slices,
  size = 168,
  stroke = 22,
  children,
}: {
  slices: DonutSlice[];
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const t = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = slices.reduce((s, x) => s + x.value, 0);
  const visible = slices.filter((s) => s.value > 0);
  const gap = visible.length > 1 ? Math.min(4, c * 0.01) : 0;

  let offset = 0;
  return (
    <View style={{ width: size, height: size }} accessible={false}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.fill} strokeWidth={stroke} fill="none" />
          {total > 0 &&
            visible.map((s) => {
              const len = (s.value / total) * c;
              const dash = Math.max(0.5, len - gap);
              const el = (
                <Circle
                  key={s.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  stroke={s.color}
                  strokeWidth={stroke}
                  fill="none"
                  strokeDasharray={`${dash} ${c - dash}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += len;
              return el;
            })}
        </G>
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
    </View>
  );
}

export function ProgressRing({
  ratio,
  color,
  size = 56,
  stroke = 6,
  children,
}: {
  ratio: number;
  color: string;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const t = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const len = Math.max(0, Math.min(1, ratio)) * c;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.fill} strokeWidth={stroke} fill="none" />
          {len > 0 ? (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={color}
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${len} ${c}`}
            />
          ) : null}
        </G>
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
    </View>
  );
}

/** Income and spending side by side for each of the last few months. */
export function MonthBars({
  bars,
  format,
  height = 120,
}: {
  bars: MonthBar[];
  format: (cents: number) => string;
  height?: number;
}) {
  const t = useTheme();
  const max = Math.max(1, ...bars.map((b) => Math.max(b.income, b.expense)));
  const last = bars[bars.length - 1]?.month;
  return (
    <View>
      <View style={[styles.bars, { height }]}>
        {bars.map((b) => {
          const current = b.month === last;
          return (
            <View
              key={b.month}
              style={styles.barGroup}
              accessible
              accessibilityLabel={`${formatShortMonth(b.month)}: income ${format(b.income)}, spending ${format(b.expense)}`}>
              <View
                style={[
                  styles.bar,
                  { height: `${(b.income / max) * 100}%`, backgroundColor: t.tint, opacity: current ? 0.35 : 0.22 },
                ]}
              />
              <View
                style={[
                  styles.bar,
                  { height: `${(b.expense / max) * 100}%`, backgroundColor: t.tint, opacity: current ? 1 : 0.6 },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.barLabels}>
        {bars.map((b) => (
          <Txt
            key={b.month}
            variant="caption"
            tone={b.month === last ? 'primary' : 'secondary'}
            weight={b.month === last ? '600' : '400'}
            align="center"
            style={{ flex: 1 }}>
            {formatShortMonth(b.month)}
          </Txt>
        ))}
      </View>
      <View style={styles.legend}>
        <LegendDot color={t.tint} label="Spending" />
        <LegendDot color={t.tint} faded label="Income" />
      </View>
    </View>
  );
}

function LegendDot({ color, label, faded }: { color: string; label: string; faded?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color, opacity: faded ? 0.3 : 1 }} />
      <Txt variant="caption" tone="secondary">
        {label}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  barGroup: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 3, height: '100%' },
  bar: { width: 12, borderRadius: 4, minHeight: 2 },
  barLabels: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  legend: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.md, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
