import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { tapFeedback } from '@/lib/platform';
import type { Category } from '@/lib/types';

import { CategoryIcon, Icon, Txt } from './ui';

export function CategoryPicker({
  categories,
  value,
  onChange,
  onAdd,
}: {
  categories: Category[];
  value: string | null;
  onChange: (id: string) => void;
  onAdd?: () => void;
}) {
  const t = useTheme();
  return (
    <View style={styles.grid}>
      {categories.map((c) => {
        const selected = c.id === value;
        return (
          <Pressable
            key={c.id}
            testID={`category-${c.id}`}
            accessibilityRole="radio"
            accessibilityLabel={c.name}
            aria-selected={selected}
            onPress={() => {
              tapFeedback();
              onChange(c.id);
            }}
            style={({ pressed }) => [
              styles.item,
              {
                backgroundColor: selected ? t.tintSoft : t.card,
                borderColor: selected ? t.tint : 'transparent',
                opacity: pressed ? 0.7 : 1,
              },
            ]}>
            <CategoryIcon icon={c.icon} color={c.color} size={34} />
            <Txt variant="caption" weight={selected ? '700' : '500'} numberOfLines={1} align="center">
              {c.name}
            </Txt>
          </Pressable>
        );
      })}
      {onAdd ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New category"
          onPress={onAdd}
          style={({ pressed }) => [styles.item, { backgroundColor: t.card, borderColor: 'transparent', opacity: pressed ? 0.7 : 1 }]}>
          <View style={[styles.addIcon, { backgroundColor: t.fill }]}>
            <Icon name="add" size={20} color={t.textSecondary} />
          </View>
          <Txt variant="caption" tone="secondary" weight="500">
            New
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  item: {
    width: '23%',
    flexGrow: 1,
    maxWidth: '24%',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
    paddingHorizontal: 4,
    borderRadius: Radius.md,
    borderWidth: 1.5,
  },
  addIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
