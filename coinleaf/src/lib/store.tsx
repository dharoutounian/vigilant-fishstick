import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from 'react';
import { AppState as RNAppState } from 'react-native';

import { todayISO } from './dates';
import { initialState } from './defaults';
import { formatMoney, type FormatOptions } from './money';
import { STORAGE_KEY, deserialize, serialize } from './persist';
import { reducer, type Action } from './reducer';
import type { AppState } from './types';

interface StoreValue {
  state: AppState;
  dispatch: Dispatch<Action>;
  /** False until saved data has been read from disk. */
  hydrated: boolean;
}

const StoreContext = createContext<StoreValue | null>(null);

function deviceCurrency(): string {
  try {
    return getLocales()[0]?.currencyCode ?? 'USD';
  } catch {
    return 'USD';
  }
}

async function save(state: AppState) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, serialize(state));
  } catch (e) {
    console.warn('Coinleaf: could not save', e);
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState(deviceCurrency()));
  const [hydrated, setHydrated] = useState(false);
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  }, [state]);

  // Load once. Nothing is written until this finishes, so a slow read can never
  // be overwritten by the empty starting state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let raw: string | null = null;
      try {
        raw = await AsyncStorage.getItem(STORAGE_KEY);
      } catch (e) {
        console.warn('Coinleaf: could not read saved data', e);
      }
      const loaded = deserialize(raw, deviceCurrency());
      if (raw != null && loaded == null) {
        // Unreadable: keep a copy rather than silently replacing it.
        await AsyncStorage.setItem(`${STORAGE_KEY}:unreadable:${Date.now()}`, raw).catch(() => {});
      }
      if (cancelled) return;
      if (loaded) dispatch({ type: 'hydrate', state: loaded });
      dispatch({ type: 'recurring/run', today: todayISO() });
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Save shortly after each change.
  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => save(state), 200);
    return () => clearTimeout(t);
  }, [state, hydrated]);

  // Save immediately when the app is backgrounded; catch up on repeats when it returns.
  useEffect(() => {
    if (!hydrated) return;
    const sub = RNAppState.addEventListener('change', (next) => {
      if (next === 'background') save(latest.current);
      if (next === 'active') dispatch({ type: 'recurring/run', today: todayISO() });
    });
    return () => sub.remove();
  }, [hydrated]);

  return (
    <StoreContext.Provider value={{ state, dispatch, hydrated }}>{children}</StoreContext.Provider>
  );
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used inside <StoreProvider>');
  return value;
}

/** A formatter bound to the person's currency. */
export function useMoney() {
  const { state } = useStore();
  const currency = state.settings.currency;
  return useCallback(
    (cents: number, opts?: FormatOptions) => formatMoney(cents, currency, opts),
    [currency],
  );
}
