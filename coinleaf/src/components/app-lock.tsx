import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, Platform, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useStore } from '@/lib/store';

import { Button, Icon, Txt } from './ui';

/** Leaving the app for less than this doesn't ask for Face ID again. */
const GRACE_MS = 30_000;

export async function biometricsAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

export async function authenticate(reason: string): Promise<boolean> {
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Cancel',
    });
    return res.success;
  } catch {
    return false;
  }
}

/**
 * Covers the app with a lock screen when App Lock is on: at launch, and when
 * returning after more than a few seconds away.
 */
export function AppLock() {
  const { state, hydrated } = useStore();
  // Mounted once saved data is loaded, so the lock starts closed only if App Lock
  // was already on at launch, not the moment someone switches it on in Settings.
  if (!hydrated) return null;
  return <LockController enabled={state.settings.lockEnabled} />;
}

function LockController({ enabled }: { enabled: boolean }) {
  const [locked, setLocked] = useState(enabled);
  const leftAt = useRef<number | null>(null);
  const busy = useRef(false);

  const unlock = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const ok = await authenticate('Unlock Coinleaf');
    busy.current = false;
    if (ok) setLocked(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') leftAt.current = Date.now();
      if (next === 'active' && leftAt.current != null) {
        if (Date.now() - leftAt.current > GRACE_MS) setLocked(true);
        leftAt.current = null;
      }
    });
    return () => sub.remove();
  }, [enabled]);

  if (!enabled) return null;
  return (
    // onShow asks for Face ID as soon as the lock appears.
    <Modal visible={locked} animationType="none" presentationStyle="fullScreen" onShow={unlock} onRequestClose={() => {}}>
      <LockScreen onUnlock={unlock} />
    </Modal>
  );
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const t = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: t.background }]}>
      <View style={[styles.badge, { backgroundColor: t.tintSoft }]}>
        <Icon name="lock-closed" size={34} color={t.tint} />
      </View>
      <Txt variant="title" align="center">
        Coinleaf is locked
      </Txt>
      <Txt variant="subhead" tone="secondary" align="center">
        Unlock with Face ID or your passcode to see your finances.
      </Txt>
      <Button title="Unlock" icon="scan" onPress={onUnlock} style={{ alignSelf: 'stretch', marginTop: Spacing.lg }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl, gap: Spacing.md },
  badge: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
});
