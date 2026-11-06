import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabBarHeight } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';

import { Icon, Txt } from './ui';

const TABS = [
  { name: 'index', href: '/', label: 'Overview', icon: 'pie-chart' },
  { name: 'activity', href: '/activity', label: 'Activity', icon: 'list' },
  { name: 'budgets', href: '/budgets', label: 'Budgets', icon: 'wallet' },
  { name: 'goals', href: '/goals', label: 'Goals', icon: 'flag' },
  { name: 'settings', href: '/settings', label: 'Settings', icon: 'settings' },
] as const;

/**
 * The web build's tab bar: a floating, frosted capsule in the spirit of the
 * iOS 26 system tab bar the native app uses.
 */
export default function AppTabs() {
  const insets = useSafeAreaInsets();
  const dark = useIsDark();
  return (
    <Tabs style={{ flex: 1 }}>
      <TabSlot style={{ flex: 1 }} />
      <TabList asChild>
        {/* asChild slots need a flat style object, not an array. */}
        <View
          style={StyleSheet.flatten([
            styles.bar,
            {
              bottom: insets.bottom + 10,
              backgroundColor: dark ? 'rgba(38,44,41,0.72)' : 'rgba(255,255,255,0.78)',
              borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            },
          ])}>
          {TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton icon={tab.icon} label={tab.label} />
            </TabTrigger>
          ))}
        </View>
      </TabList>
    </Tabs>
  );
}

function TabButton({ icon, label, isFocused, ref: _ref, ...props }: TabTriggerSlotProps & { icon: string; label: string }) {
  const t = useTheme();
  const color = isFocused ? t.tint : t.text;
  return (
    <Pressable {...props} accessibilityRole="tab" accessibilityLabel={label} testID={`tab-${label.toLowerCase()}`} style={styles.tab}>
      <View style={[styles.pill, isFocused && { backgroundColor: t.fill }]}>
        <Icon name={isFocused ? icon : `${icon}-outline`} size={22} color={color} />
        <Txt variant="caption" weight={isFocused ? '700' : '500'} style={{ color, fontSize: 10 }}>
          {label}
        </Txt>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: TabBarHeight - 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    // Frosted glass on the web.
    backdropFilter: 'blur(20px) saturate(180%)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
  } as never,
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pill: { alignItems: 'center', justifyContent: 'center', gap: 1, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 999, minWidth: 60 },
});
