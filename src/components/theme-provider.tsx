import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { Colors, type Palette, type ThemePreference } from '@/constants/theme';
import { getSetting, setSetting } from '@/db/queries';

const ThemeCtx = createContext<{
  theme: Palette;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  reload: () => Promise<void>;
}>({ theme: Colors.dark, preference: 'dark', setPreference: () => {}, reload: async () => {} });

/** SQLiteProvider'ın içinde olmalı: tercih veritabanında saklanır. */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const system = useColorScheme();
  const [preference, setPref] = useState<ThemePreference>('dark');

  useEffect(() => {
    getSetting(db, 'theme').then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') setPref(v);
    });
  }, [db]);

  const setPreference = useCallback(
    (p: ThemePreference) => {
      setPref(p);
      setSetting(db, 'theme', p);
    },
    [db],
  );

  /** Veri silme / yedek içe aktarma sonrası kayıtlı temayı yeniden okur. */
  const reload = useCallback(async () => {
    const v = await getSetting(db, 'theme');
    setPref(v === 'light' || v === 'dark' || v === 'system' ? v : 'dark');
  }, [db]);

  const resolved = preference === 'system' ? (system === 'light' ? 'light' : 'dark') : preference;
  const value = useMemo(() => ({ theme: Colors[resolved], preference, setPreference, reload }), [resolved, preference, setPreference, reload]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useThemeContext() {
  return useContext(ThemeCtx);
}
