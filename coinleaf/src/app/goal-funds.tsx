import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AmountInput } from '@/components/amount-input';
import { ProgressRing } from '@/components/charts';
import { ModalScreen, useCloseOnce } from '@/components/modal-screen';
import { Chip, Icon, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { todayISO } from '@/lib/dates';
import { newId } from '@/lib/id';
import { amountInputToCents, centsToAmountInput, currencyDecimals } from '@/lib/money';
import { successFeedback } from '@/lib/platform';
import { goalProgress } from '@/lib/selectors';
import { useMoney, useStore } from '@/lib/store';

export default function GoalFundsScreen() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: 'add' | 'withdraw' }>();
  const { state, dispatch } = useStore();
  const money = useMoney();
  const goal = state.goals.find((g) => g.id === id);
  const withdraw = mode === 'withdraw';
  const [amount, setAmount] = useState('');
  const decimals = currencyDecimals(state.settings.currency);

  const close = useCloseOnce(!goal);
  if (!goal) return null;

  const p = goalProgress(goal);
  const cents = amountInputToCents(amount);
  const tooMuch = withdraw && !!cents && cents > p.saved;
  const valid = !!cents && !tooMuch;
  const after = cents ? p.saved + (withdraw ? -cents : cents) : p.saved;

  function save() {
    if (!valid) return;
    dispatch({
      type: 'goal/contribute',
      goalId: goal!.id,
      contribution: { id: newId('gc'), amount: withdraw ? -cents! : cents!, date: todayISO() },
    });
    successFeedback();
    close();
  }

  const quick = withdraw ? [] : [p.monthlyNeeded, p.remaining].filter((x): x is number => !!x && x > 0);

  return (
    <ModalScreen title={withdraw ? 'Withdraw' : 'Add money'} actionLabel={withdraw ? 'Withdraw' : 'Add'} onAction={save} actionDisabled={!valid}>
      <View style={styles.head}>
        <ProgressRing ratio={goal.target ? after / goal.target : 0} color={goal.color} size={72} stroke={7}>
          <Icon name={goal.icon} size={26} color={goal.color} />
        </ProgressRing>
        <Txt variant="headline">{goal.name}</Txt>
        <Txt variant="subhead" tone="secondary" money>
          {money(Math.max(0, after))} of {money(goal.target)}
        </Txt>
      </View>
      <AmountInput value={amount} onChange={setAmount} currency={state.settings.currency} autoFocus testID="funds-amount" />
      {tooMuch ? (
        <Txt variant="footnote" tone="danger" align="center">
          Only {money(p.saved)} is saved in this goal.
        </Txt>
      ) : null}
      {quick.length ? (
        <View style={styles.chips}>
          {p.monthlyNeeded ? (
            <Chip label={`Monthly: ${money(p.monthlyNeeded)}`} onPress={() => setAmount(centsToAmountInput(p.monthlyNeeded!, decimals))} />
          ) : null}
          <Chip label={`Finish it: ${money(p.remaining)}`} onPress={() => setAmount(centsToAmountInput(p.remaining, decimals))} />
        </View>
      ) : null}
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: Spacing.xs, paddingTop: Spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'center' },
});
