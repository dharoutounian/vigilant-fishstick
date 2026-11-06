import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Divider, Icon, Row, Txt } from '@/components/ui';
import { MaxContentWidth, NoFocusRing, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CURRENCY_NAMES, currencyName } from '@/lib/currencies';
import { CURRENCIES } from '@/lib/defaults';
import { currencySymbol, formatMoney } from '@/lib/money';
import { tapFeedback } from '@/lib/platform';
import { useStore } from '@/lib/store';

export default function CurrencyScreen() {
  const { state, dispatch } = useStore();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const current = state.settings.currency;

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = CURRENCIES.includes(current) ? CURRENCIES : [current, ...CURRENCIES];
    return all.filter((c) => !q || c.toLowerCase().includes(q) || (CURRENCY_NAMES[c] ?? '').toLowerCase().includes(q));
  }, [query, current]);

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: t.background }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxl }]}
      data={list}
      keyExtractor={(c) => c}
      ListHeaderComponent={
        <View style={{ gap: Spacing.md, marginBottom: Spacing.md }}>
          <View style={[styles.search, { backgroundColor: t.fill }]}>
            <Icon name="search" size={17} color={t.textTertiary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search currencies"
              placeholderTextColor={t.textTertiary}
              autoCorrect={false}
              style={[styles.searchInput, { color: t.text }]}
            />
          </View>
          <Txt variant="footnote" tone="secondary">
            Changing the currency changes how amounts are shown. It doesn’t convert them.
          </Txt>
        </View>
      }
      renderItem={({ item, index }) => (
        <View
          style={[
            { backgroundColor: t.card },
            index === 0 && styles.first,
            index === list.length - 1 && styles.last,
          ]}>
          {index > 0 ? <Divider inset={Spacing.lg} /> : null}
          <Row
            testID={`currency-${item}`}
            title={`${currencyName(item)}`}
            subtitle={`${item} · ${currencySymbol(item)} · ${formatMoney(123456, item)}`}
            right={item === current ? <Icon name="checkmark" size={20} color={t.tint} /> : undefined}
            onPress={() => {
              tapFeedback();
              dispatch({ type: 'settings/update', settings: { currency: item } });
              router.back();
            }}
          />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, height: 40 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0, ...NoFocusRing },
  first: { borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, overflow: 'hidden' },
  last: { borderBottomLeftRadius: Radius.lg, borderBottomRightRadius: Radius.lg, overflow: 'hidden' },
});
