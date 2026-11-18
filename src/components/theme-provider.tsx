import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { Colors, FONT_SCALES, parseFontScale, type FontScalePref, type Palette, type ThemePreference } from '@/constants/theme';
import { getSetting, setSetting } from '@/db/queries';

const ThemeCtx = createContext<{
  theme: Palette;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  reload: () => Promise<void>;
  /** yazı/boyut ölçeği çarpanı (1 / 1.15 / 1.3) */
  scale: number;
  fontScale: FontScalePref;
  setFontScale: (p: FontScalePref) => void;
}>({ theme: Colors.dark, preference: 'dark', setPreference: () => {}, reload: async () => {}, scale: FONT_SCALES.large, fontScale: 'large', setFontScale: () => {} });

/** SQLiteProvider'ın içinde olmalı: tercih veritabanında saklanır. */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const system = useColorScheme();
  const [preference, setPref] = useState<ThemePreference>('dark');
  const [fontScale, setFontScalePref] = useState<FontScalePref>(parseFontScale(null));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([getSetting(db, 'theme'), getSetting(db, 'font_scale')])
      .then(([v, fs]) => {
        if (v === 'light' || v === 'dark' || v === 'system') setPref(v);
        setFontScalePref(parseFontScale(fs));
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [db]);

  const setFontScale = useCallback(
    (p: FontScalePref) => {
      setFontScalePref(p);
      setSetting(db, 'font_scale', p);
    },
    [db],
  );

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
    setFontScalePref(parseFontScale(await getSetting(db, 'font_scale')));
  }, [db]);

  const resolved = preference === 'system' ? (system === 'light' ? 'light' : 'dark') : preference;
  const value = useMemo(
    () => ({ theme: Colors[resolved], preference, setPreference, reload, scale: FONT_SCALES[fontScale], fontScale, setFontScale }),
    [resolved, preference, setPreference, reload, fontScale, setFontScale],
  );
  // tercih okunana kadar çizme: yanlış ölçekte bir kare görünmesin (kök görünüm zaten koyu zeminli)
  if (!ready) return null;
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useThemeContext() {
  return useContext(ThemeCtx);
}
