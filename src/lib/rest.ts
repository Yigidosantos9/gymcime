import { t, type MsgKey } from '@/i18n';

export type SetType = 'warmup' | 'normal' | 'drop' | 'failure';

const setType = (key: SetType) => ({
  key,
  get label() {
    return t(`setType.${key}` as MsgKey);
  },
  get short() {
    return key === 'normal' ? '' : t(`setType.short.${key}` as MsgKey);
  },
  get hint() {
    return t(`setType.${key}.hint` as MsgKey);
  },
});

/** Etiketler getter: dil değişince güncel metni verir. */
export const SET_TYPES: { key: SetType; label: string; short: string; hint: string }[] = (['normal', 'warmup', 'drop', 'failure'] as SetType[]).map(setType);

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
  if (sec <= 0) return t('rest.none');
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return t('rest.sec', { n: s });
  return s === 0 ? t('rest.min', { n: m }) : `${m}:${String(s).padStart(2, '0')}`;
}
