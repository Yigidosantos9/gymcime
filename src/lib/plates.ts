/** Plaka hesaplayıcı (saf). Tüm hesap 0,25 kg biriminde tam sayıyla yapılır (kayan nokta hatası yok). */

export const DEFAULT_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
export const BAR_OPTIONS = [20, 15, 10];
export const ALL_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

/** Plaka renkleri (IPF'e yakın). */
export const PLATE_COLORS: Record<number, string> = {
  25: '#D93A3A',
  20: '#2F6FDB',
  15: '#E3B100',
  10: '#2EA86B',
  5: '#E9EEF2',
  2.5: '#2B2F33',
  1.25: '#A7B0B8',
};

const U = 4; // 1 kg = 4 birim

export type PlateResult = {
  /** her tarafa takılacak plakalar (büyükten küçüğe) */
  perSide: number[];
  /** gerçekten ulaşılan toplam ağırlık (bar + 2 × plakalar) */
  achieved: number;
  /** hedefe tam ulaşıldı mı */
  exact: boolean;
  /** uyarı (Türkçe) ya da null */
  warning: string | null;
};

/**
 * `target` toplam ağırlığı için her tarafa takılacak plakaları bulur (en az plaka sayısıyla).
 * Hedef tam yapılamıyorsa en yakın ulaşılabilir ağırlığı verir (eşitlikte hafif olanı) ve uyarır.
 * Hedef bardan hafifse sadece bar (uyarı ile). Plaka sayısı sınırsız varsayılır (çiftler halinde).
 */
export function calcPlates(target: number, bar: number, available: number[] = DEFAULT_PLATES): PlateResult {
  const plates = [...new Set(available)].filter((p) => p > 0).sort((a, b) => b - a);
  if (!Number.isFinite(target) || target <= 0) return { perSide: [], achieved: bar, exact: false, warning: 'Bir ağırlık gir.' };
  if (target < bar) {
    return { perSide: [], achieved: bar, exact: false, warning: `Hedef bar ağırlığından (${fmt(bar)} kg) hafif; sadece bar.` };
  }
  if (plates.length === 0) return { perSide: [], achieved: bar, exact: target === bar, warning: target === bar ? null : 'Ayarlarda hiç plaka seçili değil.' };

  const wanted = Math.round(((target - bar) / 2) * U); // bir taraf, birim
  const units = plates.map((p) => Math.round(p * U));
  const cap = wanted + Math.max(...units); // hedefin biraz ötesine de bak (daha yakın olabilir)
  // minCount[v] = v birimini yapan en az plaka sayısı (Infinity = ulaşılamaz)
  const minCount = new Array<number>(cap + 1).fill(Infinity);
  const pick = new Array<number>(cap + 1).fill(-1);
  minCount[0] = 0;
  for (let v = 1; v <= cap; v++) {
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (u <= v && minCount[v - u] + 1 < minCount[v]) {
        minCount[v] = minCount[v - u] + 1;
        pick[v] = i;
      }
    }
  }
  let best = -1;
  for (let d = 0; d <= cap; d++) {
    const lo = wanted - d;
    const hi = wanted + d;
    if (lo >= 0 && minCount[lo] !== Infinity) {
      best = lo;
      break;
    }
    if (hi <= cap && minCount[hi] !== Infinity) {
      best = hi;
      break;
    }
  }
  const perSide: number[] = [];
  for (let v = best; v > 0; v -= units[pick[v]]) perSide.push(plates[pick[v]]);
  perSide.sort((a, b) => b - a);
  const achieved = bar + (2 * best) / U;
  const exact = Math.abs(achieved - target) < 1e-9; // yuvarlanmamış hedefe göre (ör. 80,1 kg tam sayılmaz)
  return {
    perSide,
    achieved,
    exact,
    warning: exact ? null : `${fmt(target)} kg bu plakalarla yapılamıyor; en yakın ${fmt(achieved)} kg.`,
  };
}

function fmt(n: number) {
  return (Number.isInteger(n) ? String(n) : String(n).replace(/\.?0+$/, '')).replace('.', ',');
}

/** "20 + 10 + 2,5" biçiminde metin. */
export function describePerSide(perSide: number[]) {
  return perSide.length === 0 ? 'plaka yok' : perSide.map((p) => fmt(p)).join(' + ');
}
