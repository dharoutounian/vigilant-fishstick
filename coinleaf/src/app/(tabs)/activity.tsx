import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, SectionList, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MonthSwitcher } from '@/components/month-switcher';
import { TransactionRow } from '@/components/transaction-row';
import { Button, Divider, EmptyState, Icon, IconButton, ScreenHeader, Segmented, Txt } from '@/components/ui';
import { MaxContentWidth, NoFocusRing, Radius, Spacing, TabBarHeight } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { currentMonthKey, formatDayLabel, formatMonth } from '@/lib/dates';
import { categoryMap, filterTransactions, groupByDay, totalsOf, transactionsInMonth } from '@/lib/selectors';
import { useMoney, useStore } from '@/lib/store';
import type { TxType } from '@/lib/types';

export default function ActivityScreen() {
  const { state } = useStore();
  const money = useMoney();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(currentMonthKey());
  const [query, setQuery] = useState('');
  const [type, setType] = useState<TxType | 'all'>('all');

  const searching = query.trim().length > 0;
  const { sections, totals, cats, count } = useMemo(() => {
    // A search looks through everything, not just the month on screen.
    const base = searching ? state.transactions : transactionsInMonth(state.transactions, month);
    const list = filterTransactions(base, state.categories, { query, type });
    return {
      sections: groupByDay(list).map((g) => ({ ...g, data: g.items })),
      totals: totalsOf(list),
      cats: categoryMap(state.categories),
      count: list.length,
    };
  }, [state.transactions, state.categories, month, query, type, searching]);

  const manual = Platform.OS !== 'ios';

  const header = (
    <View style={styles.headerBlock}>
      <ScreenHeader
        title="Activity"
        right={<IconButton icon="add" label="Add transaction" testID="add-transaction" onPress={() => router.push('/transaction')} />}
      />
      <View style={[styles.search, { backgroundColor: t.fill }]}>
        <Icon name="search" size={17} color={t.textTertiary} />
        <TextInput
          testID="search-input"
          value={query}
          onChangeText={setQuery}
          placeholder="Search notes, categories, amounts"
          placeholderTextColor={t.textTertiary}
          returnKeyType="search"
          autoCorrect={false}
          clearButtonMode="while-editing"
          style={[styles.searchInput, { color: t.text }]}
        />
        {searching && Platform.OS !== 'ios' ? (
          <Pressable onPress={() => setQuery('')} accessibilityLabel="Clear search" hitSlop={8}>
            <Icon name="close-circle" size={17} color={t.textTertiary} />
          </Pressable>
        ) : null}
      </View>
      <Segmented
        testIDPrefix="filter"
        value={type}
        onChange={setType}
        options={[
          { value: 'all', label: 'All' },
          { value: 'expense', label: 'Spending' },
          { value: 'income', label: 'Income' },
        ]}
      />
      {searching ? (
        <Txt variant="footnote" tone="secondary">
          {count} {count === 1 ? 'result' : 'results'} across all months
        </Txt>
      ) : (
        <MonthSwitcher month={month} onChange={setMonth} />
      )}
      {count > 0 ? (
        <View style={[styles.totals, { backgroundColor: t.card }]}>
          <Total label="In" value={money(totals.income)} tone="income" />
          <Total label="Out" value={money(totals.expense)} />
          <Total label="Net" value={money(totals.net, { signed: true })} tone={totals.net >= 0 ? 'income' : 'danger'} />
        </View>
      ) : null}
    </View>
  );

  return (
    <SectionList
      style={{ flex: 1, backgroundColor: t.background }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: (manual ? insets.top : 0) + Spacing.md,
          paddingBottom: (manual ? insets.bottom + TabBarHeight : 0) + Spacing.xxl,
        },
      ]}
      sections={sections}
      keyExtractor={(item) => item.id}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <EmptyState
          icon={searching ? 'search' : 'receipt'}
          title={searching ? 'No matches' : 'Nothing here yet'}
          message={
            searching
              ? 'Try a different word or amount.'
              : `No ${type === 'income' ? 'income' : type === 'expense' ? 'spending' : 'transactions'} in ${formatMonth(month)}.`
          }
          action={searching ? undefined : <Button title="Add transaction" icon="add" size="sm" onPress={() => router.push('/transaction')} />}
        />
      }
      renderSectionHeader={({ section }) => (
        <View style={styles.dayHeader}>
          <Txt variant="footnote" weight="600" tone="secondary">
            {formatDayLabel(section.date)}
          </Txt>
          <Txt variant="footnote" tone="secondary" money>
            {money(section.net, { signed: true })}
          </Txt>
        </View>
      )}
      renderItem={({ item, index, section }) => (
        <View
          style={[
            { backgroundColor: t.card },
            index === 0 && styles.first,
            index === section.data.length - 1 && styles.last,
          ]}>
          {index > 0 ? <Divider inset={64} /> : null}
          <TransactionRow tx={item} category={cats.get(item.categoryId)} />
        </View>
      )}
    />
  );
}

function Total({ label, value, tone = 'primary' }: { label: string; value: string; tone?: 'primary' | 'income' | 'danger' }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Txt variant="caption" tone="secondary">
        {label}
      </Txt>
      <Txt variant="subhead" weight="600" money tone={tone} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.lg, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  headerBlock: { gap: Spacing.lg, marginBottom: Spacing.sm },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    height: 40,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0, ...NoFocusRing },
  totals: { flexDirection: 'row', borderRadius: Radius.md, paddingVertical: Spacing.md },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  first: { borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, overflow: 'hidden' },
  last: { borderBottomLeftRadius: Radius.lg, borderBottomRightRadius: Radius.lg, overflow: 'hidden' },
});
