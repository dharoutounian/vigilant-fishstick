import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AmountInput } from '@/components/amount-input';
import { Calendar } from '@/components/calendar';
import { CategoryPicker } from '@/components/category-picker';
import { ModalScreen, useCloseOnce } from '@/components/modal-screen';
import { Button, Card, Chip, Icon, Section, Segmented, Txt } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addDays, formatDate, todayISO } from '@/lib/dates';
import { newId } from '@/lib/id';
import { amountInputToCents, centsToAmountInput, currencyDecimals } from '@/lib/money';
import { confirm, successFeedback } from '@/lib/platform';
import { FREQUENCY_SHORT } from '@/lib/recurring';
import { pickableCategories } from '@/lib/selectors';
import { useStore } from '@/lib/store';
import type { Frequency, TxType } from '@/lib/types';

type Repeat = 'never' | Frequency;

const REPEAT_OPTIONS: { value: Repeat; label: string }[] = [
  { value: 'never', label: 'Never' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: '2 weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

export default function TransactionScreen() {
  const params = useLocalSearchParams<{ id?: string; type?: TxType }>();
  const { state, dispatch } = useStore();
  const t = useTheme();
  const existing = params.id ? state.transactions.find((x) => x.id === params.id) : undefined;
  const editing = !!params.id;
  const currency = state.settings.currency;
  const decimals = currencyDecimals(currency);
  const today = todayISO();

  const [type, setType] = useState<TxType>(existing?.type ?? (params.type === 'income' ? 'income' : 'expense'));
  const [amount, setAmount] = useState(existing ? centsToAmountInput(existing.amount, decimals) : '');
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null);
  const [date, setDate] = useState(existing?.date ?? today);
  const [note, setNote] = useState(existing?.note ?? '');
  const [repeat, setRepeat] = useState<Repeat>('never');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  // Closes itself if the transaction is deleted elsewhere (or never existed).
  const close = useCloseOnce(editing && !existing);

  const categories = useMemo(() => {
    const list = pickableCategories(state.categories, type);
    // Keep an archived category visible when it's the one already chosen.
    const current = state.categories.find((c) => c.id === categoryId);
    if (current?.archived && current.type === type) list.push(current);
    return list;
  }, [state.categories, type, categoryId]);

  // Auto-select a category created from this screen.
  const knownIds = useRef(new Set(state.categories.map((c) => c.id)));
  useEffect(() => {
    const fresh = state.categories.find((c) => !knownIds.current.has(c.id) && c.type === type);
    if (fresh) setCategoryId(fresh.id);
    knownIds.current = new Set(state.categories.map((c) => c.id));
  }, [state.categories, type]);

  const cents = amountInputToCents(amount);
  const rule = existing?.recurringId ? state.recurring.find((r) => r.id === existing.recurringId) : undefined;

  function switchType(next: TxType) {
    setType(next);
    if (categoryId && state.categories.find((c) => c.id === categoryId)?.type !== next) setCategoryId(null);
  }

  function save() {
    if (!cents || !categoryId) {
      setShowErrors(true);
      return;
    }
    const trimmed = note.trim();
    if (existing) {
      dispatch({ type: 'transaction/update', tx: { ...existing, type, amount: cents, categoryId, date, note: trimmed } });
    } else if (repeat !== 'never') {
      dispatch({
        type: 'recurring/add',
        today,
        rule: {
          id: newId('rule'),
          type,
          amount: cents,
          categoryId,
          note: trimmed,
          frequency: repeat,
          startDate: date,
          generated: 0,
          active: true,
          createdAt: Date.now(),
        },
      });
    } else {
      dispatch({
        type: 'transaction/add',
        tx: { id: newId('tx'), type, amount: cents, categoryId, date, note: trimmed, createdAt: Date.now() },
      });
    }
    successFeedback();
    close();
  }

  async function remove() {
    if (!existing) return;
    const ok = await confirm({
      title: 'Delete this transaction?',
      message: rule ? 'Only this one is deleted. Future repeats continue.' : undefined,
      confirmText: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    dispatch({ type: 'transaction/delete', id: existing.id });
    close();
  }

  const dateIsOther = date !== today && date !== addDays(today, -1);

  return (
    <ModalScreen
      title={editing ? 'Edit transaction' : type === 'income' ? 'New income' : 'New expense'}
      onAction={save}
      actionDisabled={!cents}>
      <Segmented
        testIDPrefix="type"
        value={type}
        onChange={switchType}
        options={[
          { value: 'expense', label: 'Expense' },
          { value: 'income', label: 'Income' },
        ]}
      />

      <AmountInput
        value={amount}
        onChange={setAmount}
        currency={currency}
        autoFocus={!editing}
        tone={type === 'income' ? 'income' : 'primary'}
      />
      {showErrors && !cents ? (
        <Txt variant="footnote" tone="danger" align="center" style={{ marginTop: -Spacing.md }}>
          Enter an amount.
        </Txt>
      ) : null}

      <Section title="Category">
        <CategoryPicker
          categories={categories}
          value={categoryId}
          onChange={setCategoryId}
          onAdd={() => router.push({ pathname: '/category', params: { type } })}
        />
        {showErrors && !categoryId ? (
          <Txt variant="footnote" tone="danger">
            Choose a category.
          </Txt>
        ) : null}
      </Section>

      <Section title="Date">
        <View style={styles.chips}>
          <Chip label="Today" selected={date === today} onPress={() => { setDate(today); setCalendarOpen(false); }} />
          <Chip
            label="Yesterday"
            selected={date === addDays(today, -1)}
            onPress={() => { setDate(addDays(today, -1)); setCalendarOpen(false); }}
          />
          <Chip
            label={dateIsOther ? formatDate(date) : 'Pick a date'}
            icon="calendar"
            selected={dateIsOther || calendarOpen}
            testID="date-pick"
            onPress={() => setCalendarOpen((o) => !o)}
          />
        </View>
        {calendarOpen ? (
          <Card>
            <Calendar
              value={date}
              onChange={(d) => {
                setDate(d);
                setCalendarOpen(false);
              }}
            />
          </Card>
        ) : null}
      </Section>

      <Section title="Note">
        <TextInput
          testID="note-input"
          value={note}
          onChangeText={setNote}
          placeholder={type === 'income' ? 'e.g. November paycheck' : 'e.g. Weekly shop'}
          placeholderTextColor={t.textTertiary}
          maxLength={120}
          returnKeyType="done"
          style={[styles.input, { backgroundColor: t.card, color: t.text }]}
        />
      </Section>

      {!editing ? (
        <Section
          title="Repeat"
          footer={
            repeat === 'never'
              ? undefined
              : date > today
                ? `Starts ${formatDate(date)}, then repeats ${FREQUENCY_SHORT[repeat].toLowerCase()}.`
                : `Added now and again ${FREQUENCY_SHORT[repeat].toLowerCase()}. Change or stop it any time in Settings › Repeating.`
          }>
          <View style={styles.chips}>
            {REPEAT_OPTIONS.map((o) => (
              <Chip key={o.value} label={o.label} selected={repeat === o.value} testID={`repeat-${o.value}`} onPress={() => setRepeat(o.value)} />
            ))}
          </View>
        </Section>
      ) : rule ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/recurring-rule', params: { id: rule.id } })}
          style={[styles.ruleLink, { backgroundColor: t.card }]}>
          <Icon name="repeat" size={18} color={t.tint} />
          <Txt variant="subhead" style={{ flex: 1 }}>
            Repeats {FREQUENCY_SHORT[rule.frequency].toLowerCase()}
            {rule.active ? '' : ' (paused)'}
          </Txt>
          <Txt variant="subhead" tone="tint" weight="600">
            Manage
          </Txt>
        </Pressable>
      ) : null}

      {editing ? <Button title="Delete transaction" icon="trash" variant="destructive" onPress={remove} testID="delete-transaction" /> : null}
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  input: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    fontSize: 17,
  },
  ruleLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.md },
});
