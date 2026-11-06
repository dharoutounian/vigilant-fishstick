import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, TextInput, View } from 'react-native';

import { AmountInput } from '@/components/amount-input';
import { Calendar } from '@/components/calendar';
import { ModalScreen, useCloseOnce } from '@/components/modal-screen';
import { ColorPicker, IconPicker } from '@/components/style-picker';
import { Button, Card, Section, Txt } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addMonths, formatDate, todayISO } from '@/lib/dates';
import { GOAL_ICONS, PALETTE } from '@/lib/defaults';
import { newId } from '@/lib/id';
import { amountInputToCents, centsToAmountInput, currencyDecimals } from '@/lib/money';
import { confirm, successFeedback } from '@/lib/platform';
import { useStore } from '@/lib/store';

export default function GoalEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { state, dispatch } = useStore();
  const t = useTheme();
  const existing = id ? state.goals.find((g) => g.id === id) : undefined;
  const decimals = currencyDecimals(state.settings.currency);
  const today = todayISO();

  const [name, setName] = useState(existing?.name ?? '');
  const [amount, setAmount] = useState(existing ? centsToAmountInput(existing.target, decimals) : '');
  const [icon, setIcon] = useState(existing?.icon ?? 'flag');
  const [color, setColor] = useState(existing?.color ?? PALETTE[(state.goals.length * 3) % PALETTE.length]);
  const [hasDeadline, setHasDeadline] = useState(!!existing?.deadline);
  const [deadline, setDeadline] = useState(existing?.deadline ?? addMonths(today, 6));

  const close = useCloseOnce(!!id && !existing);

  const cents = amountInputToCents(amount);
  const valid = !!cents && name.trim().length > 0;

  function save() {
    if (!valid) return;
    const fields = {
      name: name.trim(),
      target: cents!,
      icon,
      color,
      deadline: hasDeadline ? deadline : undefined,
    };
    if (existing) {
      dispatch({ type: 'goal/update', goal: { ...existing, ...fields } });
    } else {
      dispatch({ type: 'goal/add', goal: { id: newId('goal'), contributions: [], createdAt: Date.now(), ...fields } });
    }
    successFeedback();
    close();
  }

  async function remove() {
    if (!existing) return;
    const ok = await confirm({
      title: `Delete “${existing.name}”?`,
      message: 'The goal and its history will be removed. Your transactions are not affected.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    // Leave the goal's detail screen underneath as well, back to the Goals tab.
    close(() => router.dismissAll());
    dispatch({ type: 'goal/delete', id: existing.id });
  }

  return (
    <ModalScreen title={existing ? 'Edit goal' : 'New goal'} onAction={save} actionDisabled={!valid}>
      <TextInput
        testID="goal-name"
        value={name}
        onChangeText={setName}
        placeholder="What are you saving for?"
        placeholderTextColor={t.textTertiary}
        maxLength={40}
        autoFocus={!existing}
        style={[styles.input, { backgroundColor: t.card, color: t.text }]}
      />

      <Section title="Target amount">
        <Card padded={false}>
          <AmountInput value={amount} onChange={setAmount} currency={state.settings.currency} size="md" testID="goal-target" label="Target amount" />
        </Card>
      </Section>

      <Section title="Target date">
        <Card style={{ gap: Spacing.sm }}>
          <View style={styles.switchRow}>
            <Txt variant="callout" style={{ flex: 1 }}>
              {hasDeadline ? formatDate(deadline) : 'No target date'}
            </Txt>
            <Switch
              value={hasDeadline}
              onValueChange={setHasDeadline}
              trackColor={{ true: t.tint, false: t.fill }}
              accessibilityLabel="Set a target date"
            />
          </View>
          {hasDeadline ? <Calendar value={deadline} onChange={setDeadline} min={today} /> : null}
        </Card>
      </Section>

      <Section title="Icon">
        <IconPicker icons={GOAL_ICONS} value={icon} color={color} onChange={setIcon} />
      </Section>
      <Section title="Color">
        <ColorPicker value={color} onChange={setColor} />
      </Section>

      {existing ? <Button title="Delete goal" icon="trash" variant="destructive" onPress={remove} /> : null}
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  input: { borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: 14, fontSize: 17 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
});
