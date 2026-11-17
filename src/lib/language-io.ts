import { getLocales } from 'expo-localization';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getSetting } from '@/db/queries';
import { isLangPref, resolveLanguage, type Lang, type LangPref } from '@/i18n';

export function systemLanguageCode(): string | null {
  try {
    return getLocales()[0]?.languageCode ?? null;
  } catch {
    return null;
  }
}

export async function loadLanguagePref(db: SQLiteDatabase): Promise<LangPref> {
  const v = await getSetting(db, 'language');
  return isLangPref(v) ? v : 'system';
}

/** Kayıtlı tercihten (veya sistemden) çözülen dil — bildirim kurulumu gibi React dışı yerler için. */
export async function loadLanguage(db: SQLiteDatabase): Promise<Lang> {
  return resolveLanguage(await loadLanguagePref(db), systemLanguageCode());
}
