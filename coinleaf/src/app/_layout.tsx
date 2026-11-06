import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AppLock } from '@/components/app-lock';
import { Colors } from '@/constants/theme';
import { StoreProvider, useStore } from '@/lib/store';

SplashScreen.preventAutoHideAsync().catch(() => {});

function navigationTheme(dark: boolean): Theme {
  const base = dark ? DarkTheme : DefaultTheme;
  const c = Colors[dark ? 'dark' : 'light'];
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: c.tint,
      background: c.background,
      card: c.background,
      text: c.text,
      border: c.separator,
    },
  };
}

function Navigator() {
  const { hydrated } = useStore();
  useEffect(() => {
    if (hydrated) SplashScreen.hideAsync().catch(() => {});
  }, [hydrated]);

  // Keep the splash up until saved data is loaded, so nothing flashes empty.
  if (!hydrated) return null;

  return (
    <>
      <Stack screenOptions={{ headerShown: false, headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="transaction" options={{ presentation: 'modal' }} />
        <Stack.Screen name="budget" options={{ presentation: 'modal' }} />
        <Stack.Screen name="goal-edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="goal-funds" options={{ presentation: 'modal' }} />
        <Stack.Screen name="category" options={{ presentation: 'modal' }} />
        <Stack.Screen name="recurring-rule" options={{ presentation: 'modal' }} />
        <Stack.Screen name="goal/[id]" options={{ headerShown: true, title: '' }} />
        <Stack.Screen name="categories" options={{ headerShown: true, title: 'Categories' }} />
        <Stack.Screen name="recurring" options={{ headerShown: true, title: 'Repeating' }} />
        <Stack.Screen name="currency" options={{ headerShown: true, title: 'Currency' }} />
      </Stack>
      <AppLock />
    </>
  );
}

export default function RootLayout() {
  const dark = useColorScheme() === 'dark';
  return (
    <StoreProvider>
      <ThemeProvider value={navigationTheme(dark)}>
        <StatusBar style="auto" />
        <Navigator />
      </ThemeProvider>
    </StoreProvider>
  );
}
