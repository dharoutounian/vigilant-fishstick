import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, CategoryIcon, Divider, Row, Section, Segmented } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { pickableCategories } from '@/lib/selectors';
import { useStore } from '@/lib/store';
import type { TxType } from '@/lib/types';

export default function CategoriesScreen() {
  const { state } = useStore();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [type, setType] = useState<TxType>('expense');

  const { list, counts } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tx of state.transactions) counts.set(tx.categoryId, (counts.get(tx.categoryId) ?? 0) + 1);
    return { list: pickableCategories(state.categories, type), counts };
  }, [state.categories, state.transactions, type]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxl }]}>
      <Segmented
        value={type}
        onChange={setType}
        options={[
          { value: 'expense', label: 'Spending' },
          { value: 'income', label: 'Income' },
        ]}
      />
      <Section footer="Deleting a category that’s in use hides it from new entries and keeps your history.">
        <Card padded={false}>
          {list.map((c, i) => {
            const n = counts.get(c.id) ?? 0;
            return (
              <View key={c.id}>
                {i > 0 ? <Divider inset={64} /> : null}
                <Row
                  testID={`manage-category-${c.id}`}
                  left={<CategoryIcon icon={c.icon} color={c.color} />}
                  title={c.name}
                  subtitle={n ? `${n} ${n === 1 ? 'transaction' : 'transactions'}` : 'Not used yet'}
                  chevron
                  onPress={() => router.push({ pathname: '/category', params: { id: c.id } })}
                />
              </View>
            );
          })}
        </Card>
      </Section>
      <Button
        title={`New ${type === 'income' ? 'income' : 'spending'} category`}
        icon="add"
        variant="secondary"
        testID="new-category"
        onPress={() => router.push({ pathname: '/category', params: { type } })}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.lg, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
});
