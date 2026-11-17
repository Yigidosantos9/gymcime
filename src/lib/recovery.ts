import { MUSCLES } from '@/db/seed';
import { t } from '@/i18n';
import { startOfDay } from '@/lib/format';

/** Her kas grubu için toparlanma durumu. */
export type MuscleRecovery = {
  muscle: string;
  /** en son çalıştığı antrenmanın başlangıcı (ms); hiç çalışmadıysa null */
  last: number | null;
  /** o antrenmanda bu kasa yapılan çalışma seti sayısı */
  lastSets: number;
  /** kaç gündür dinleniyor (bugün çalıştıysa 0); hiç çalışmadıysa null */
  daysRested: number | null;
  /** önerilen dinlenme tamam mı */
  ready: boolean;
  /** önerilen dinlenmeye kalan gün */
  remaining: number;
};

export const RECOVERY_OPTIONS = [1, 2, 3, 4];

export function computeRecovery(
  rows: { muscle: string; last: number; sets: number }[],
  recoveryDays: number,
  now = Date.now(),
): MuscleRecovery[] {
  const today = startOfDay(now);
  const byMuscle = new Map(rows.map((r) => [r.muscle, r]));
  return MUSCLES.filter((m) => m !== 'Kardiyo').map((muscle) => {
    const r = byMuscle.get(muscle);
    if (!r) return { muscle, last: null, lastSets: 0, daysRested: null, ready: true, remaining: 0 };
    const daysRested = Math.max(0, Math.round((today - startOfDay(r.last)) / 86400000));
    const remaining = Math.max(0, recoveryDays - daysRested);
    return { muscle, last: r.last, lastSets: r.sets, daysRested, ready: remaining === 0, remaining };
  });
}

/** Vücut haritası için yorgunluk değeri (1 = bugün çalıştı, 0 = toparlandı). */
export function fatigueValues(rec: MuscleRecovery[], recoveryDays: number) {
  return Object.fromEntries(
    rec.filter((r) => r.daysRested != null && !r.ready).map((r) => [r.muscle, Math.max(0.25, 1 - r.daysRested! / Math.max(1, recoveryDays))]),
  );
}

export function restLabel(r: MuscleRecovery) {
  if (r.daysRested == null) return t('recovery.never');
  if (r.daysRested === 0) return t('recovery.today');
  if (r.daysRested === 1) return t('recovery.yesterday');
  return t('recovery.days', { count: r.daysRested });
}

/** Rutindeki kaslardan henüz toparlanmamış olanlar. */
export function restingMuscles(muscles: string[], rec: MuscleRecovery[]) {
  const set = new Set(muscles);
  return rec.filter((r) => set.has(r.muscle) && !r.ready);
}
