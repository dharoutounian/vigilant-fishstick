import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { ModalScreen, useCloseOnce } from '@/components/modal-screen';
import { ColorPicker, IconPicker } from '@/components/style-picker';
import { Button, CategoryIcon, Section, Txt } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CATEGORY_ICONS, PALETTE, PROTECTED_CATEGORY_IDS } from '@/lib/defaults';
import { newId } from '@/lib/id';
import { confirm, successFeedback } from '@/lib/platform';
import { useStore } from '@/lib/store';
import type { TxType } from '@/lib/types';

export default function CategoryScreen() {
  const params = useLocalSearchParams<{ id?: string; type?: TxType }>();
  const { state, dispatch } = useStore();
  const t = useTheme();
  const existing = params.id ? state.categories.find((c) => c.id === params.id) : undefined;
  const type: TxType = existing?.type ?? (params.type === 'income' ? 'income' : 'expense');

  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? 'sparkles');
  const [color, setColor] = useState(existing?.color ?? PALETTE[state.categories.length % PALETTE.length]);

  const close = useCloseOnce(!!params.id && !existing);

  const trimmed = name.trim();
  const duplicate = state.categories.some(
    (c) => !c.archived && c.type === type && c.id !== existing?.id && c.name.toLowerCase() === trimmed.toLowerCase(),
  );
  const valid = trimmed.length > 0 && !duplicate;
  const used = existing
    ? state.transactions.filter((x) => x.categoryId === existing.id).length
    : 0;

  function save() {
    if (!valid) return;
    if (existing) dispatch({ type: 'category/update', category: { ...existing, name: trimmed, icon, color } });
    else dispatch({ type: 'category/add', category: { id: newId('cat'), name: trimmed, icon, color, type } });
    successFeedback();
    close();
  }

  async function remove() {
    if (!existing) return;
    const ok = await confirm({
      title: `Delete “${existing.name}”?`,
      message: used
        ? `It’s used by ${used} ${used === 1 ? 'transaction' : 'transactions'}. They’ll keep it, but you won’t be able to pick it for new ones.`
        : undefined,
      confirmText: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    dispatch({ type: 'category/delete', id: existing.id });
    close();
  }

  return (
    <ModalScreen
      title={existing ? 'Edit category' : type === 'income' ? 'New income category' : 'New category'}
      onAction={save}
      actionDisabled={!valid}>
      <View style={styles.preview}>
        <CategoryIcon icon={icon} color={color} size={64} />
      </View>
      <View style={{ gap: Spacing.xs }}>
        <TextInput
          testID="category-name"
          value={name}
          onChangeText={setName}
          placeholder="Name"
          placeholderTextColor={t.textTertiary}
          maxLength={24}
          autoFocus={!existing}
          style={[styles.input, { backgroundColor: t.card, color: t.text }]}
        />
        {duplicate ? (
          <Txt variant="footnote" tone="danger">
            You already have a category with this name.
          </Txt>
        ) : null}
      </View>
      <Section title="Icon">
        <IconPicker icons={CATEGORY_ICONS} value={icon} color={color} onChange={setIcon} />
      </Section>
      <Section title="Color">
        <ColorPicker value={color} onChange={setColor} />
      </Section>
      {existing && !PROTECTED_CATEGORY_IDS.has(existing.id) ? (
        <Button title="Delete category" icon="trash" variant="destructive" onPress={remove} />
      ) : null}
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center', paddingTop: Spacing.sm },
  input: { borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: 14, fontSize: 17 },
});
