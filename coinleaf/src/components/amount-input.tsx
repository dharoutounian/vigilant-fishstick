import { useRef, type ComponentRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Fonts, NoFocusRing, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { currencyDecimals, currencySymbol, localeDecimalSeparator, sanitizeAmountInput } from '@/lib/money';

import { Txt } from './ui';

const SEP = localeDecimalSeparator();

/**
 * A large amount field. `value` is a normalized string ("12.5"); the person sees
 * and types their own decimal mark.
 */
export function AmountInput({
  value,
  onChange,
  currency,
  autoFocus,
  tone = 'primary',
  size = 'lg',
  testID = 'amount-input',
  label = 'Amount',
}: {
  value: string;
  onChange: (v: string) => void;
  currency: string;
  autoFocus?: boolean;
  tone?: 'primary' | 'income';
  size?: 'lg' | 'md';
  testID?: string;
  label?: string;
}) {
  const t = useTheme();
  const ref = useRef<ComponentRef<typeof TextInput>>(null);
  const decimals = currencyDecimals(currency);
  const symbol = currencySymbol(currency);
  const fontSize = size === 'lg' ? (value.length > 9 ? 40 : 52) : 34;
  const color = tone === 'income' ? t.income : t.text;
  return (
    <Pressable onPress={() => ref.current?.focus()} style={styles.wrap} accessible={false}>
      <View style={styles.row}>
        <Txt style={{ fontSize: fontSize * 0.6, color: t.textSecondary, fontFamily: Fonts.rounded, fontWeight: '600' }}>
          {symbol}
        </Txt>
        <TextInput
          ref={ref}
          testID={testID}
          accessibilityLabel={label}
          value={value.replace('.', SEP)}
          onChangeText={(raw) => onChange(sanitizeAmountInput(raw, decimals))}
          placeholder={decimals > 0 ? `0${SEP}00` : '0'}
          placeholderTextColor={t.textTertiary}
          keyboardType={decimals > 0 ? 'decimal-pad' : 'number-pad'}
          inputMode="decimal"
          autoFocus={autoFocus}
          selectionColor={t.tint}
          maxLength={16}
          style={[
            styles.input,
            { fontSize, color, fontFamily: Fonts.rounded, minWidth: fontSize * 1.6 },
          ]}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' },
  input: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    padding: 0,
    textAlign: 'left',
    ...NoFocusRing,
  },
});
