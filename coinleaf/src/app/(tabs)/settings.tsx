import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';

import { authenticate, biometricsAvailable } from '@/components/app-lock';
import { Card, Divider, Icon, Row, Screen, Section, Txt } from '@/components/ui';
import { PRIVACY_URL, SUPPORT_URL } from '@/constants/links';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { transactionsToCsv } from '@/lib/csv';
import { currencyName } from '@/lib/currencies';
import { todayISO } from '@/lib/dates';
import { confirm, notify } from '@/lib/platform';
import { shareTextFile } from '@/lib/share-file';
import { useStore } from '@/lib/store';

function SettingIcon({ name, color }: { name: string; color: string }) {
  return (
    <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} size={17} color="#fff" />
    </View>
  );
}

export default function SettingsScreen() {
  const { state, dispatch } = useStore();
  const t = useTheme();
  const [canLock, setCanLock] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    biometricsAvailable().then(setCanLock);
  }, []);

  const activeRules = state.recurring.filter((r) => r.active).length;
  const customCount = state.categories.filter((c) => !c.archived).length;
  const version = Constants.expoConfig?.version ?? '1.0.0';

  async function toggleLock(on: boolean) {
    // Confirm it's really them before changing a security setting either way.
    const ok = await authenticate(on ? 'Turn on App Lock' : 'Turn off App Lock');
    if (ok) dispatch({ type: 'settings/update', settings: { lockEnabled: on } });
  }

  async function exportCsv() {
    if (!state.transactions.length) {
      notify('Nothing to export yet', 'Add a transaction first.');
      return;
    }
    setExporting(true);
    try {
      await shareTextFile(`coinleaf-${todayISO()}.csv`, transactionsToCsv(state), 'text/csv', 'public.comma-separated-values-text');
    } catch (e) {
      notify('Export failed', e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  }

  async function eraseAll() {
    const ok = await confirm({
      title: 'Erase all data?',
      message: 'Every transaction, budget, goal and category will be deleted from this device. This can’t be undone.',
      confirmText: 'Erase everything',
      destructive: true,
    });
    if (ok) dispatch({ type: 'reset' });
  }

  return (
    <Screen title="Settings">
      <Section title="General">
        <Card padded={false}>
          <Row
            testID="settings-currency"
            left={<SettingIcon name="cash" color="#10B981" />}
            title="Currency"
            right={`${state.settings.currency} · ${currencyName(state.settings.currency)}`}
            chevron
            onPress={() => router.push('/currency')}
          />
          <Divider inset={58} />
          <Row
            testID="settings-categories"
            left={<SettingIcon name="pricetags" color="#8B5CF6" />}
            title="Categories"
            right={String(customCount)}
            chevron
            onPress={() => router.push('/categories')}
          />
          <Divider inset={58} />
          <Row
            testID="settings-recurring"
            left={<SettingIcon name="repeat" color="#3B82F6" />}
            title="Repeating transactions"
            right={activeRules ? String(activeRules) : 'None'}
            chevron
            onPress={() => router.push('/recurring')}
          />
        </Card>
      </Section>

      {canLock ? (
        <Section title="Privacy" footer="Ask for Face ID, Touch ID or your passcode when opening Coinleaf.">
          <Card padded={false}>
            <Row
              left={<SettingIcon name="lock-closed" color="#F59E0B" />}
              title="App Lock"
              right={
                <Switch
                  value={state.settings.lockEnabled}
                  onValueChange={toggleLock}
                  trackColor={{ true: t.tint, false: t.fill }}
                  accessibilityLabel="App Lock"
                />
              }
            />
          </Card>
        </Section>
      ) : null}

      <Section title="Your data" footer="Coinleaf keeps everything on this device. There are no accounts, no ads and no tracking. Data is included in your device backups.">
        <Card padded={false}>
          <Row
            testID="export-csv"
            left={<SettingIcon name="share" color="#06B6D4" />}
            title={exporting ? 'Preparing…' : 'Export to spreadsheet (CSV)'}
            onPress={exporting ? undefined : exportCsv}
            chevron
          />
          <Divider inset={58} />
          <Row
            testID="erase-all"
            left={<SettingIcon name="trash" color="#EF4444" />}
            title="Erase all data"
            destructive
            onPress={eraseAll}
          />
        </Card>
      </Section>

      <Section title="About">
        <Card padded={false}>
          <Row
            left={<SettingIcon name="shield-checkmark" color="#64748B" />}
            title="Privacy policy"
            chevron
            onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}
          />
          <Divider inset={58} />
          <Row
            left={<SettingIcon name="help-buoy" color="#64748B" />}
            title="Help & support"
            chevron
            onPress={() => WebBrowser.openBrowserAsync(SUPPORT_URL)}
          />
        </Card>
      </Section>

      <View style={{ alignItems: 'center', gap: 4, paddingTop: Spacing.sm }}>
        <Icon name="leaf" size={20} color={t.tint} />
        <Txt variant="footnote" tone="secondary">
          Coinleaf {version}
        </Txt>
      </View>
    </Screen>
  );
}
