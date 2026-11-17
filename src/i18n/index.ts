/**
 * Dil altyapısı (saf mantık — React'siz, testte doğrudan çalışır).
 * - Sözlükler: `tr.ts` (kaynak) ve `en.ts` (tr'nin TÜM anahtarlarını içermek zorunda; tip ile zorunlu).
 * - Parametre: `{ad}`; çoğul: değer `{ one, other }` olabilir ve `count` parametresiyle seçilir.
 * - Geçerli dil modül düzeyinde tutulur: `LanguageProvider` değiştirir; React dışı kod (lib/) `t()` ile okur,
 *   bileşenler `useT()` ile okuyup dil değişince yeniden çizilir.
 */
import { en } from './en';
import { tr, type MsgKey, type Msg } from './tr';

export type Lang = 'tr' | 'en';
export type LangPref = 'system' | Lang;
export type { MsgKey, Msg };

const DICTS: Record<Lang, Record<MsgKey, Msg>> = { tr, en };

let current: Lang = 'tr';

export function setLanguage(l: Lang) {
  current = l;
}
export function getLanguage(): Lang {
  return current;
}

/** 'system' → cihaz dili (tr ise Türkçe, aksi halde English). */
export function resolveLanguage(pref: LangPref | string | null | undefined, systemCode?: string | null): Lang {
  if (pref === 'tr' || pref === 'en') return pref;
  return systemCode?.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

export function isLangPref(v: unknown): v is LangPref {
  return v === 'system' || v === 'tr' || v === 'en';
}

function pickPlural(lang: Lang, msg: Msg, count: unknown): string {
  if (typeof msg === 'string') return msg;
  const n = typeof count === 'number' ? count : Number(count);
  // tr/en: tam olarak 1 → tekil, diğerleri → çoğul
  return Math.abs(n) === 1 ? msg.one : msg.other;
}

export type Params = Record<string, string | number | null | undefined>;

export function translate(lang: Lang, key: MsgKey, params?: Params): string {
  const raw = DICTS[lang][key] ?? DICTS.tr[key];
  if (raw === undefined) return String(key);
  const text = pickPlural(lang, raw, params?.count);
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name] ?? '') : m));
}

/** Geçerli dilde çeviri (React dışı kod ve modül düzeyi fonksiyonlar için). */
export function t(key: MsgKey, params?: Params): string {
  return translate(current, key, params);
}

/** Dinamik anahtar (ör. `muscle.${m}`) — sözlükte yoksa `fallback` (ör. kullanıcının özel kas/ekipman adı) döner. */
export function tOr(key: string, fallback: string, lang: Lang = current): string {
  return key in tr ? translate(lang, key as MsgKey) : fallback;
}

// ───────────────────────── Tarih / sayı verisi ─────────────────────────

const LOCALE_DATA = {
  tr: {
    locale: 'tr-TR',
    months: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
    monthsShort: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
    days: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'],
    daysShort: ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'],
    decimal: ',',
  },
  en: {
    locale: 'en-US',
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    daysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    decimal: '.',
  },
} as const;

export function localeData(lang: Lang = current) {
  return LOCALE_DATA[lang];
}

/** BCP-47 yerel ayar (toLocaleString vb. için). */
export function currentLocale() {
  return LOCALE_DATA[current].locale;
}

/** Sayıyı yerel ondalık ayırıcıyla yazar (TR: 62,5 · EN: 62.5). Giriş ayrıştırma her iki ayırıcıyı da kabul eder (`parseNumber`). */
export function formatDecimal(n: number, maxDigits = 1, lang: Lang = current): string {
  const fixed = Number.isInteger(n) ? String(n) : n.toFixed(maxDigits).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  return fixed.replace('.', LOCALE_DATA[lang].decimal);
}

/** Yerel ondalık ayırıcı ('.' → ',' Türkçede). Hazır "62.5" biçimli metni yerelleştirir. */
export const decimalSep = () => LOCALE_DATA[current].decimal;
