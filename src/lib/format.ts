import { formatDecimal, getLanguage, localeData, t } from '@/i18n';

/** Ağırlık: TR 62,5 · EN 62.5 (tam sayıysa ondalıksız). */
export function formatWeight(w: number | null | undefined) {
  if (w == null) return '–';
  return formatDecimal(w, 1);
}

/** Binlik ayırıcılı tam sayı ("1,500" / "1.500" → 1500); kcal/gram/ml gibi tamsayı alanları için. Aksi halde `parseNumber`. */
export function parseAmount(text: string): number | null {
  const s = text.trim();
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ''));
  return parseNumber(s);
}

export function parseNumber(text: string): number | null {
  const cleaned = text.replace(',', '.').replace(/[^0-9.]/g, '');
  if (cleaned === '' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function formatDuration(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatMinutes(ms: number) {
  const min = Math.round(ms / 60000);
  if (min < 60) return t('format.min', { n: min });
  return t('format.hourMin', { h: Math.floor(min / 60), m: min % 60 });
}

export function formatDate(ts: number) {
  return dayMonth(new Date(ts));
}

/** "17 Kas" / "Nov 17" */
function dayMonth(d: Date) {
  const m = localeData().monthsShort[d.getMonth()];
  return getLanguage() === 'en' ? `${m} ${d.getDate()}` : `${d.getDate()} ${m}`;
}

export function formatDayLong(ts: number) {
  const d = new Date(ts);
  const today = startOfDay(Date.now());
  const day = startOfDay(ts);
  const diff = Math.round((today - day) / 86400000);
  if (diff === 0) return t('format.today');
  if (diff === 1) return t('format.yesterday');
  if (diff < 7) return localeData().days[d.getDay()];
  return `${dayMonth(d)}${d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ''}`;
}

export function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Pazartesi başlangıçlı hafta. */
export function startOfWeek(ts: number) {
  const d = new Date(startOfDay(ts));
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return d.getTime();
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 6) return t('format.night');
  if (h < 12) return t('format.morning');
  if (h < 18) return t('format.day');
  return t('format.evening');
}
