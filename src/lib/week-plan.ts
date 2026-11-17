import { ROUTINE_TEMPLATES } from '@/db/seed';
import { localeData, t, type MsgKey } from '@/i18n';
import { routineLabel } from '@/i18n/labels';
import { startOfDay, startOfWeek } from '@/lib/format';

/** Haftalık plan yardımcıları (saf). Hafta Pazartesi başlar: 0 = Pazartesi … 6 = Pazar. */

/** Geçerli dilde gün/ay adları (Pazartesi başlangıçlı; çağrı anında hesaplanır — dil değişince güncel). */
export const weekdayNames = () => [1, 2, 3, 4, 5, 6, 0].map((i) => localeData().days[i]);
export const weekdayShort = () => [1, 2, 3, 4, 5, 6, 0].map((i) => localeData().daysShort[i]);
export const weekdayLetters = () => weekdayShort().map((s) => s[0]);
export const monthNames = () => [...localeData().months];

/** Zaman damgasının haftanın hangi günü olduğu (yerel saat dilimi; 0 = Pazartesi). */
export function weekdayOf(ts: number) {
  return (new Date(ts).getDay() + 6) % 7;
}

/** `now`'ın haftasının `weekday`. gününün (0 = Pazartesi) gece yarısı (yerel). */
export function weekDayTs(now: number, weekday: number) {
  const d = new Date(startOfWeek(now));
  d.setDate(d.getDate() + weekday);
  return d.getTime();
}

export type DayStatus = 'done' | 'missed' | 'upcoming' | 'rest';

/**
 * Bir günün durumu: yapıldı (planlı olsun olmasın o gün antrenman var) · kaçırıldı (planlı, geçmiş, yapılmadı) ·
 * yaklaşan/bugün bekleyen (planlı) · dinlenme (plan yok).
 */
export function dayStatus(planned: boolean, done: boolean, dayTs: number, nowTs: number): DayStatus {
  if (done) return 'done';
  if (!planned) return 'rest';
  return startOfDay(dayTs) < startOfDay(nowTs) ? 'missed' : 'upcoming';
}

/** "Bu hafta plan: 4/5" — planlı günlerden kaçında (rutin eşleşmese de) antrenman yapıldı. */
export function weeklyAdherence(planned: boolean[], doneDays: ReadonlySet<number>) {
  let total = 0;
  let done = 0;
  for (let d = 0; d < 7; d++) {
    if (!planned[d]) continue;
    total++;
    if (doneDays.has(d)) done++;
  }
  return { planned: total, done };
}

export type MonthCell = { ts: number; inMonth: boolean };

/** Ay takvimi: Pazartesi başlangıçlı haftalar (4-6 satır). `month` 0-11. Gün aritmetiği yerel tarihle (DST'ye dayanıklı). */
export function monthGrid(year: number, month: number): MonthCell[][] {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = Math.ceil((lead + daysInMonth) / 7);
  const out: MonthCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const row: MonthCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(year, month, 1 - lead + w * 7 + d);
      row.push({ ts: date.getTime(), inMonth: date.getMonth() === month });
    }
    out.push(row);
  }
  return out;
}

/** Ayı değiştir (ay taşmasında yıl da değişir). */
export function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export type RecoveryConflict = { muscle: string; /** art arda çalışılan günler */ days: [number, number]; gap: number };

/**
 * Plan toparlanma çakışmaları: aynı kasın iki planlı çalışma günü arası, önerilen dinlenme gününden kısaysa.
 * Hafta tekrarladığı için Pazar → Pazartesi geçişi de kontrol edilir. Kardiyo hariç.
 */
export function recoveryConflicts(dayMuscles: string[][], recoveryDays: number): RecoveryConflict[] {
  const byMuscle = new Map<string, number[]>();
  dayMuscles.forEach((ms, d) => {
    for (const m of new Set(ms)) {
      if (m === 'Kardiyo') continue;
      byMuscle.set(m, [...(byMuscle.get(m) ?? []), d]);
    }
  });
  const out: RecoveryConflict[] = [];
  for (const [muscle, days] of byMuscle) {
    if (days.length < 2) continue;
    for (let i = 0; i < days.length; i++) {
      const a = days[i];
      const next = i + 1 < days.length ? days[i + 1] : days[0] + 7;
      const gap = next - a;
      if (gap < recoveryDays) out.push({ muscle, days: [a, next % 7], gap });
    }
  }
  return out.sort((x, y) => x.days[0] - y.days[0] || x.muscle.localeCompare(y.muscle, 'tr'));
}

/** Her kasın haftada kaç gün çalıştığı (kardiyo dahil; çoktan aza). */
export function muscleFrequency(dayMuscles: string[][]) {
  const count = new Map<string, number>();
  for (const ms of dayMuscles) for (const m of new Set(ms)) count.set(m, (count.get(m) ?? 0) + 1);
  return [...count.entries()].map(([muscle, days]) => ({ muscle, days })).sort((a, b) => b.days - a.days || a.muscle.localeCompare(b.muscle, 'tr'));
}

/** Rutin adından takvimde gösterilecek kısa etiket (ilk kelime, en çok `max` harf). */
export function shortRoutineName(name: string | null | undefined, max = 5) {
  if (!name) return '';
  const first = routineLabel(name.trim()).split(/\s+/)[0] ?? '';
  return first.length > max ? first.slice(0, max - 1) + '.' : first;
}

export type WeekTemplate = {
  key: string;
  /** geçerli dilde başlık / açıklama (getter) */
  readonly label: string;
  readonly hint: string;
  source: keyof typeof ROUTINE_TEMPLATES;
  /** gün (0-6) → şablon rutin adı (ROUTINE_TEMPLATES) */
  days: Record<number, string>;
};

export const WEEK_TEMPLATES: WeekTemplate[] = [
  { key: 'ppl3', get label() { return t('week.tpl.ppl3' as MsgKey); }, get hint() { return t('week.tpl.ppl3.hint' as MsgKey); }, source: 'ppl', days: { 0: 'Push', 2: 'Pull', 4: 'Legs' } },
  { key: 'ppl6', get label() { return t('week.tpl.ppl6' as MsgKey); }, get hint() { return t('week.tpl.ppl6.hint' as MsgKey); }, source: 'ppl', days: { 0: 'Push', 1: 'Pull', 2: 'Legs', 3: 'Push', 4: 'Pull', 5: 'Legs' } },
  { key: 'ul4', get label() { return t('week.tpl.ul4' as MsgKey); }, get hint() { return t('week.tpl.ul4.hint' as MsgKey); }, source: 'upperlower', days: { 0: 'Üst Vücut', 1: 'Alt Vücut', 3: 'Üst Vücut', 4: 'Alt Vücut' } },
  { key: 'fb3', get label() { return t('week.tpl.fb3' as MsgKey); }, get hint() { return t('week.tpl.fb3.hint' as MsgKey); }, source: 'full', days: { 0: 'Full Body A', 2: 'Full Body B', 4: 'Full Body A' } },
];

/** Şablon + (ad → rutin id) haritasından 7 günlük atama (boş gün = null). */
export function templateAssignments(tpl: WeekTemplate, idsByName: ReadonlyMap<string, number>): (number | null)[] {
  return Array.from({ length: 7 }, (_, d) => {
    const name = tpl.days[d];
    return name ? (idsByName.get(name) ?? null) : null;
  });
}
