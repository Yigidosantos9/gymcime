import { t } from '@/i18n';

/** Haftalık antrenman günü seçenekleri. 1 ve 7 gün seçilebilir ama önerilmez. */
export const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 7];

export function dayWarning(d: number): string | null {
  if (d === 1) return t('goals.warn1');
  if (d === 7) return t('goals.warn7');
  return null;
}

export const notRecommended = (d: number) => d === 1 || d === 7;
