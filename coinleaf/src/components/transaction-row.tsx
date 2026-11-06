import { router } from 'expo-router';
import { View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { formatDayLabel } from '@/lib/dates';
import { useMoney } from '@/lib/store';
import type { Category, Transaction } from '@/lib/types';

import { CategoryIcon, Icon, Row, Txt } from './ui';

export function TransactionRow({
  tx,
  category,
  showDate,
}: {
  tx: Transaction;
  category: Category | undefined;
  showDate?: boolean;
}) {
  const money = useMoney();
  const t = useTheme();
  const name = category?.name ?? 'Uncategorized';
  const title = tx.note || name;
  const parts = [tx.note ? name : null, showDate ? formatDayLabel(tx.date) : null].filter(Boolean);
  const amount = money(tx.type === 'income' ? tx.amount : -tx.amount, { signed: true });
  return (
    <Row
      testID={`tx-${tx.id}`}
      onPress={() => router.push({ pathname: '/transaction', params: { id: tx.id } })}
      accessibilityLabel={`${title}, ${amount}${parts.length ? `, ${parts.join(', ')}` : ''}`}
      left={<CategoryIcon icon={category?.icon ?? 'help'} color={category?.color ?? '#64748B'} />}
      title={title}
      subtitle={parts.join(' · ') || undefined}
      right={
        <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 6 }}>
          {tx.recurringId ? <Icon name="repeat" size={14} color={t.textTertiary} /> : null}
          <Txt variant="callout" weight="600" money tone={tx.type === 'income' ? 'income' : 'primary'}>
            {amount}
          </Txt>
        </View>
      }
    />
  );
}
