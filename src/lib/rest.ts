export type SetType = 'warmup' | 'normal' | 'drop' | 'failure';

export const SET_TYPES: { key: SetType; label: string; short: string; hint: string }[] = [
  { key: 'normal', label: 'Normal', short: '', hint: 'Çalışma seti' },
  { key: 'warmup', label: 'Isınma', short: 'I', hint: 'Daha kısa dinlenme, rekora sayılmaz' },
  { key: 'drop', label: 'Drop set', short: 'D', hint: 'Dinlenmeden ağırlığı düşür' },
  { key: 'failure', label: 'Tükeniş', short: 'T', hint: 'Son tekrara kadar, +30 sn dinlenme' },
];

export const REST_PRESETS = [30, 45, 60, 75, 90, 120, 150, 180, 240, 300];

/**
 * Bir setten sonra ne kadar dinlenileceği.
 * Öncelik: antrenmandaki ayar → rutindeki ayar (antrenmana kopyalanır) → egzersiz varsayılanı → profil varsayılanı.
 */
export function baseRest(workoutRest: number | null | undefined, exerciseRest: number | null | undefined, profileRest: number) {
  return workoutRest ?? exerciseRest ?? profileRest;
}

export function restAfter(base: number, type: SetType | string) {
  switch (type) {
    case 'warmup':
      return Math.max(30, Math.round((base * 0.5) / 15) * 15);
    case 'drop':
      return 0;
    case 'failure':
      return base + 30;
    default:
      return base;
  }
}

export function formatRest(sec: number) {
  if (sec <= 0) return 'Yok';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s} sn`;
  return s === 0 ? `${m} dk` : `${m}:${String(s).padStart(2, '0')}`;
}
