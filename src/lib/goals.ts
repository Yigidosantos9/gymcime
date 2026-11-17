/** Haftalık antrenman günü seçenekleri. 1 ve 7 gün seçilebilir ama önerilmez. */
export const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 7];

export function dayWarning(d: number): string | null {
  if (d === 1) return 'Haftada 1 gün ilerleme için az kalır. Mümkünse en az 2 gün öneririz.';
  if (d === 7) return 'Hiç dinlenme günü yok. Kasların toparlanması için haftada en az 1 gün dinlenmeni öneririz.';
  return null;
}

export const notRecommended = (d: number) => d === 1 || d === 7;
