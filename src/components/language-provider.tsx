import { useSQLiteContext } from 'expo-sqlite';
import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { setSetting } from '@/db/queries';
import { resolveLanguage, setLanguage, translate, type Lang, type LangPref, type MsgKey, type Params } from '@/i18n';
import { loadLanguagePref, systemLanguageCode } from '@/lib/language-io';
import { syncReminders } from '@/lib/reminder-io';

export type TFn = (key: MsgKey, params?: Params) => string;

const LangCtx = createContext<{ lang: Lang; preference: LangPref; setPreference: (p: LangPref) => void; reload: () => Promise<void> }>({
  lang: 'tr',
  preference: 'system',
  setPreference: () => {},
  reload: async () => {},
});

/** SQLiteProvider'ın içinde olmalı: tercih `settings.language` ('system' | 'tr' | 'en'). Değişince tüm uygulama anında yeniden çizilir. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [preference, setPref] = useState<LangPref>('system');
  const [ready, setReady] = useState(false);
  const lang = resolveLanguage(preference, systemLanguageCode());
  // Alt ağaç çizilmeden ÖNCE modül düzeyi dili ayarla (lib/ içindeki t() çağrıları doğru dili görsün)
  setLanguage(lang);

  useEffect(() => {
    loadLanguagePref(db)
      .then((v) => setPref(v))
      .catch(() => {})
      .finally(() => setReady(true));
  }, [db]);

  const setPreference = useCallback(
    (p: LangPref) => {
      setLanguage(resolveLanguage(p, systemLanguageCode()));
      setPref(p);
      // hatırlatıcı bildirim metinleri dile bağlı: yeni dille yeniden kur
      setSetting(db, 'language', p)
        .then(() => syncReminders(db))
        .catch(() => {});
    },
    [db],
  );

  /** Veri silme / yedek içe aktarma sonrası kayıtlı tercihi yeniden okur (bayat state kalmasın). */
  const reload = useCallback(async () => {
    const p = await loadLanguagePref(db);
    setLanguage(resolveLanguage(p, systemLanguageCode()));
    setPref(p);
  }, [db]);

  const value = useMemo(() => ({ lang, preference, setPreference, reload }), [lang, preference, setPreference, reload]);
  // tercih okunana kadar çizme: yanlış dilde bir kare görünmesin
  if (!ready) return null;
  // `key={lang}`: dil değişince alt ağaç yeniden kurulur. React Compiler, modül düzeyi dili okuyan ifadeleri
  // (selamlama, gün/ay adları, tarih biçimleri) bağımlılıksız önbelleğe alabildiği için; yeniden kurulum
  // eski dilde metin kalmasını kökten engeller. Dil seyrek değiştiği için navigasyonun sıfırlanması kabul edilebilir.
  return (
    <LangCtx.Provider value={value}>
      <Fragment key={lang}>{children}</Fragment>
    </LangCtx.Provider>
  );
}

export function useLanguage() {
  return useContext(LangCtx);
}

/** Çeviri fonksiyonu; dil değişince bileşen yeniden çizilir. */
export function useT(): TFn {
  const { lang } = useContext(LangCtx);
  return useCallback((key, params) => translate(lang, key, params), [lang]);
}
