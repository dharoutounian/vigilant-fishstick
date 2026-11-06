import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type ScrollViewProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts, MaxContentWidth, Radius, Spacing, TabBarHeight, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({
  name,
  size = 20,
  color,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  const t = useTheme();
  return <Ionicons name={name as IconName} size={size} color={color ?? t.text} />;
}

/* ------------------------------------------------------------------ Text */

const textVariants = StyleSheet.create({
  largeTitle: { fontSize: 34, fontWeight: '700', letterSpacing: 0.3 },
  title: { fontSize: 22, fontWeight: '700' },
  headline: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 17 },
  callout: { fontSize: 16 },
  subhead: { fontSize: 15 },
  footnote: { fontSize: 13 },
  caption: { fontSize: 12 },
  section: { fontSize: 13, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
});

type TextTone = 'primary' | 'secondary' | 'tertiary' | 'tint' | 'danger' | 'warning' | 'income' | 'onTint' | 'hero' | 'heroSecondary';

const toneColor = (t: Palette, tone: TextTone) =>
  ({
    primary: t.text,
    secondary: t.textSecondary,
    tertiary: t.textTertiary,
    tint: t.tint,
    danger: t.danger,
    warning: t.warning,
    income: t.income,
    onTint: t.onTint,
    hero: t.heroText,
    heroSecondary: t.heroTextSecondary,
  })[tone];

export interface TxtProps extends TextProps {
  variant?: keyof typeof textVariants;
  tone?: TextTone;
  weight?: TextStyle['fontWeight'];
  /** Tabular, rounded digits for amounts. */
  money?: boolean;
  align?: TextStyle['textAlign'];
}

export function Txt({ variant = 'body', tone = 'primary', weight, money, align, style, ...rest }: TxtProps) {
  const t = useTheme();
  return (
    <Text
      {...rest}
      style={[
        textVariants[variant],
        { color: toneColor(t, tone) },
        weight ? { fontWeight: weight } : null,
        money ? { fontVariant: ['tabular-nums'], fontFamily: Fonts.rounded } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}

/* ---------------------------------------------------------------- Layout */

interface ScreenProps extends Omit<ScrollViewProps, 'children'> {
  title: string;
  right?: ReactNode;
  children: ReactNode;
}

/**
 * A tab's scrolling page with a large title. On iOS the native tab bar insets the
 * scroll view itself; elsewhere the safe area and tab bar are padded by hand.
 */
export function Screen({ title, right, children, contentContainerStyle, ...rest }: ScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const manual = Platform.OS !== 'ios';
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.background }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.screenContent,
        {
          paddingTop: (manual ? insets.top : 0) + Spacing.md,
          paddingBottom: (manual ? insets.bottom + TabBarHeight : 0) + Spacing.xxl,
        },
        contentContainerStyle,
      ]}
      {...rest}>
      <ScreenHeader title={title} right={right} />
      {children}
    </ScrollView>
  );
}

export function ScreenHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <Txt variant="largeTitle" accessibilityRole="header" numberOfLines={1} style={{ flexShrink: 1 }}>
        {title}
      </Txt>
      {right ? <View style={styles.headerRight}>{right}</View> : null}
    </View>
  );
}

export function Card({
  children,
  style,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.card }, padded && styles.cardPadded, style]}>
      {children}
    </View>
  );
}

export function Section({
  title,
  action,
  children,
  footer,
  style,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  footer?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.section, style]}>
      {title || action ? (
        <View style={styles.sectionHeader}>
          {title ? (
            <Txt variant="section" tone="secondary">
              {title}
            </Txt>
          ) : (
            <View />
          )}
          {action}
        </View>
      ) : null}
      {children}
      {footer ? (
        <Txt variant="footnote" tone="secondary" style={styles.sectionFooter}>
          {footer}
        </Txt>
      ) : null}
    </View>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.separator, marginLeft: inset }} />;
}

/* --------------------------------------------------------------- Buttons */

type ButtonVariant = 'primary' | 'secondary' | 'plain' | 'destructive';

interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  title: string;
  icon?: string;
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ title, icon, variant = 'primary', size = 'md', loading, disabled, style, ...rest }: ButtonProps) {
  const t = useTheme();
  const bg = {
    primary: t.tint,
    secondary: t.tintSoft,
    plain: 'transparent',
    destructive: t.dangerSoft,
  }[variant];
  const fg = {
    primary: t.onTint,
    secondary: t.tint,
    plain: t.tint,
    destructive: t.danger,
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        size === 'sm' && styles.buttonSm,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
        style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 19} color={fg} /> : null}
          <Txt variant={size === 'sm' ? 'subhead' : 'headline'} weight="600" style={{ color: fg }}>
            {title}
          </Txt>
        </>
      )}
    </Pressable>
  );
}

/** Round icon-only button, e.g. the "+" in a header. */
export function IconButton({
  icon,
  label,
  onPress,
  filled = true,
  size = 36,
  testID,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  filled?: boolean;
  size?: number;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: filled ? t.tint : t.fill,
          opacity: pressed ? 0.7 : 1,
        },
      ]}>
      <Icon name={icon} size={size * 0.58} color={filled ? t.onTint : t.text} />
    </Pressable>
  );
}

/* ------------------------------------------------------------------ Rows */

export function Row({
  left,
  title,
  subtitle,
  right,
  onPress,
  chevron,
  destructive,
  testID,
  accessibilityLabel,
}: {
  left?: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  destructive?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const t = useTheme();
  const content = (pressed: boolean) => (
    <View style={[styles.row, pressed && { backgroundColor: t.cardPressed }]}>
      {left}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt variant="callout" tone={destructive ? 'danger' : 'primary'} numberOfLines={1}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="footnote" tone="secondary" numberOfLines={1} style={{ marginTop: 2 }}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {typeof right === 'string' ? (
        <Txt variant="callout" tone="secondary" numberOfLines={1}>
          {right}
        </Txt>
      ) : (
        right
      )}
      {chevron ? <Icon name="chevron-forward" size={18} color={t.textTertiary} /> : null}
    </View>
  );
  if (!onPress) return content(false);
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)}>
      {({ pressed }) => content(pressed)}
    </Pressable>
  );
}

export function CategoryIcon({ icon, color, size = 36 }: { icon: string; color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Icon name={icon} size={size * 0.52} color="#FFFFFF" />
    </View>
  );
}

/* -------------------------------------------------------------- Controls */

export function ProgressBar({
  ratio,
  color,
  height = 8,
  track,
}: {
  ratio: number;
  color: string;
  height?: number;
  track?: string;
}) {
  const t = useTheme();
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
      style={{ height, borderRadius: height / 2, backgroundColor: track ?? t.fill, overflow: 'hidden' }}>
      <View style={{ width: `${pct}%`, height: '100%', borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  testIDPrefix,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  testIDPrefix?: string;
}) {
  const t = useTheme();
  return (
    <View accessibilityRole="tablist" style={[styles.segmented, { backgroundColor: t.fill }]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            aria-selected={selected}
            testID={testIDPrefix ? `${testIDPrefix}-${o.value}` : undefined}
            onPress={() => onChange(o.value)}
            style={[styles.segment, selected && [styles.segmentSelected, { backgroundColor: t.card }]]}>
            <Txt variant="subhead" weight={selected ? '600' : '500'} tone={selected ? 'primary' : 'secondary'}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
  testID,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: string;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      aria-selected={!!selected}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? t.tint : t.card,
          borderColor: selected ? t.tint : t.separator,
          opacity: pressed ? 0.75 : 1,
        },
      ]}>
      {icon ? <Icon name={icon} size={15} color={selected ? t.onTint : t.textSecondary} /> : null}
      <Txt variant="subhead" weight="500" style={{ color: selected ? t.onTint : t.text }}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: string;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: t.tintSoft }]}>
        <Icon name={icon} size={30} color={t.tint} />
      </View>
      <Txt variant="headline" align="center">
        {title}
      </Txt>
      <Txt variant="subhead" tone="secondary" align="center" style={{ maxWidth: 300 }}>
        {message}
      </Txt>
      {action ? <View style={{ marginTop: Spacing.sm }}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    minHeight: 44,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  card: { borderRadius: Radius.lg, overflow: 'hidden' },
  cardPadded: { padding: Spacing.lg },
  section: { gap: Spacing.sm },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
    minHeight: 22,
  },
  sectionFooter: { paddingHorizontal: Spacing.xs },
  button: {
    minHeight: 50,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  buttonSm: { minHeight: 36, borderRadius: Radius.pill, paddingHorizontal: Spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    minHeight: 52,
  },
  segmented: { flexDirection: 'row', borderRadius: Radius.sm, padding: 3 },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 8,
  },
  segmentSelected: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  empty: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.lg },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
});
