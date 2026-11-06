import { router } from 'expo-router';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Txt } from './ui';

export function closeModal() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/**
 * Closes an editor exactly once. Editors also close themselves when the record
 * they edit disappears (deleted elsewhere); without the guard, deleting from the
 * editor itself would close it twice and pop the screen underneath too.
 */
export function useCloseOnce(recordMissing: boolean) {
  const closed = useRef(false);
  const close = useCallback((navigate: () => void = closeModal) => {
    if (closed.current) return;
    closed.current = true;
    navigate();
  }, []);
  useEffect(() => {
    if (recordMissing) close();
  }, [recordMissing, close]);
  return close;
}

/**
 * A sheet with Cancel / title / primary action across the top, like the
 * system's own editors.
 */
export function ModalScreen({
  title,
  actionLabel = 'Save',
  onAction,
  actionDisabled,
  onCancel = closeModal,
  cancelLabel = 'Cancel',
  children,
  footer,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  onCancel?: () => void;
  cancelLabel?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  // iOS sheets start below the status bar; full-screen presentations don't.
  const top = Platform.OS === 'ios' ? 0 : insets.top;
  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <View style={[styles.bar, { paddingTop: top + Spacing.sm, borderBottomColor: t.separator }]}>
        <Pressable accessibilityRole="button" testID="modal-cancel" onPress={onCancel} hitSlop={10} style={styles.side}>
          <Txt tone="tint">{cancelLabel}</Txt>
        </Pressable>
        <Txt variant="headline" numberOfLines={1} style={styles.title} accessibilityRole="header">
          {title}
        </Txt>
        <View style={[styles.side, { alignItems: 'flex-end' }]}>
          {onAction ? (
            <Pressable
              accessibilityRole="button"
              testID="modal-action"
              onPress={onAction}
              disabled={actionDisabled}
              hitSlop={10}>
              <Txt tone="tint" weight="700" style={{ opacity: actionDisabled ? 0.4 : 1 }}>
                {actionLabel}
              </Txt>
            </Pressable>
          ) : null}
        </View>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        // Scrolls content clear of the keyboard on iOS.
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxl }]}>
        {children}
        {footer}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  side: { width: 80 },
  title: { flex: 1, textAlign: 'center' },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});
