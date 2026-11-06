import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PALETTE } from '@/lib/defaults';
import { tapFeedback } from '@/lib/platform';

import { Card, Icon } from './ui';

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <Card>
      <View style={styles.grid}>
        {PALETTE.map((c) => {
          const selected = c.toLowerCase() === value.toLowerCase();
          return (
            <Pressable
              key={c}
              accessibilityRole="radio"
              accessibilityLabel={`Color ${c}`}
              aria-selected={selected}
              onPress={() => {
                tapFeedback();
                onChange(c);
              }}
              style={[styles.swatchWrap, selected && { borderColor: c }]}>
              <View style={[styles.swatch, { backgroundColor: c }]}>
                {selected ? <Icon name="checkmark" size={16} color="#fff" /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

export function IconPicker({
  icons,
  value,
  color,
  onChange,
}: {
  icons: readonly string[];
  value: string;
  color: string;
  onChange: (icon: string) => void;
}) {
  const t = useTheme();
  return (
    <Card>
      <View style={styles.grid}>
        {icons.map((name) => {
          const selected = name === value;
          return (
            <Pressable
              key={name}
              accessibilityRole="radio"
              accessibilityLabel={name.replace(/-/g, ' ')}
              aria-selected={selected}
              onPress={() => {
                tapFeedback();
                onChange(name);
              }}
              style={[styles.iconCell, { backgroundColor: selected ? color : t.fill }]}>
              <Icon name={name} size={20} color={selected ? '#fff' : t.textSecondary} />
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'flex-start' },
  swatchWrap: { padding: 3, borderRadius: Radius.pill, borderWidth: 2, borderColor: 'transparent' },
  swatch: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  iconCell: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
