import { formatDecimal, t as tt, type MsgKey } from '@/i18n';

/**
 * Beslenme hesapları (saf mantık, birim testli). Tüm sonuçlar TAHMİNDİR.
 * BMI, vücut yağı (US Navy / Deurenberg), BMR (Mifflin-St Jeor), TDEE, kalori hedefi, makrolar, süre tahmini.
 */

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';

const activity = (key: ActivityLevel, factor: number) => ({
  key,
  factor,
  get label() {
    return tt(`activity.${key}` as MsgKey);
  },
  get text() {
    return tt(`activity.${key}.text` as MsgKey);
  },
});

export const ACTIVITY: { key: ActivityLevel; factor: number; label: string; text: string }[] = [
  activity('sedentary', 1.2),
  activity('light', 1.375),
  activity('moderate', 1.55),
  activity('active', 1.725),
  activity('veryActive', 1.9),
];

export const KCAL_PER_KG = 7700;
export const MIN_KCAL: Record<Sex, number> = { female: 1200, male: 1500 };
/** Günlük açık, TDEE'nin en fazla bu oranı olabilir. */
export const MAX_DEFICIT_RATIO = 0.25;
/** Fazla kalori, TDEE'nin en fazla bu oranı. */
export const MAX_SURPLUS_RATIO = 0.2;
/** Haftalık kilo değişimi, vücut ağırlığının en fazla %1'i. */
export const MAX_WEEKLY_RATE_RATIO = 0.01;

export type BodyInput = {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  waistCm?: number | null;
  neckCm?: number | null;
  hipCm?: number | null;
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// ───────────────────────── BMI ─────────────────────────

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function bmiCategory(v: number): string {
  if (v < 18.5) return tt('nutr.bmi.under');
  if (v < 25) return tt('nutr.bmi.normal');
  if (v < 30) return tt('nutr.bmi.over');
  if (v < 35) return tt('nutr.bmi.obese1');
  if (v < 40) return tt('nutr.bmi.obese2');
  return tt('nutr.bmi.obese3');
}

// ───────────────────────── Vücut yağı ─────────────────────────

export type BodyFat = { percent: number; method: 'navy' | 'bmi'; methodLabel: string };

/** US Navy formülü, metrik (cm) sürümü. Geçersiz ölçüde null. */
export function navyBodyFat(i: BodyInput): number | null {
  const { sex, heightCm: h, waistCm: w, neckCm: n, hipCm: hip } = i;
  if (!w || !n || w <= n) return null;
  let bf: number;
  if (sex === 'male') {
    bf = 495 / (1.0324 - 0.19077 * Math.log10(w - n) + 0.15456 * Math.log10(h)) - 450;
  } else {
    if (!hip || hip + w <= n) return null;
    bf = 495 / (1.29579 - 0.35004 * Math.log10(w + hip - n) + 0.221 * Math.log10(h)) - 450;
  }
  return Number.isFinite(bf) ? bf : null;
}

/** Deurenberg: BMI tabanlı yaklaşık tahmin. */
export function deurenbergBodyFat(i: BodyInput): number {
  return 1.2 * bmi(i.weightKg, i.heightCm) + 0.23 * i.age - 10.8 * (i.sex === 'male' ? 1 : 0) - 5.4;
}

/** Ölçüler varsa US Navy, yoksa Deurenberg. %3–60 aralığına sıkıştırılır. */
export function estimateBodyFat(i: BodyInput): BodyFat {
  const navy = navyBodyFat(i);
  if (navy != null) return { percent: round1(clamp(navy, 3, 60)), method: 'navy', methodLabel: tt('nutr.bf.navy') };
  return { percent: round1(clamp(deurenbergBodyFat(i), 3, 60)), method: 'bmi', methodLabel: tt('nutr.bf.bmi') };
}

/** ACE kategorileri. */
export function bodyFatCategory(sex: Sex, pct: number): string {
  const lim = sex === 'male' ? [6, 14, 18, 25] : [14, 21, 25, 32];
  if (pct < lim[0]) return tt('nutr.bfcat.veryLow');
  if (pct < lim[1]) return tt('nutr.bfcat.athletic');
  if (pct < lim[2]) return tt('nutr.bfcat.fit');
  if (pct < lim[3]) return tt('nutr.bfcat.ok');
  return tt('nutr.bfcat.high');
}

export function leanMassKg(weightKg: number, bfPercent: number) {
  return weightKg * (1 - bfPercent / 100);
}

// ───────────────────────── Enerji ─────────────────────────

/** Mifflin-St Jeor, kcal/gün. */
export function bmr(i: Pick<BodyInput, 'sex' | 'age' | 'heightCm' | 'weightKg'>): number {
  return 10 * i.weightKg + 6.25 * i.heightCm - 5 * i.age + (i.sex === 'male' ? 5 : -161);
}

export function activityFactor(level: ActivityLevel) {
  return ACTIVITY.find((a) => a.key === level)?.factor ?? 1.2;
}

export function tdee(i: BodyInput, level: ActivityLevel): number {
  return bmr(i) * activityFactor(level);
}

// ───────────────────────── Kalori hedefi ─────────────────────────

export type CalorieTarget = {
  /** hedef kcal/gün (yuvarlanmış) */
  kcal: number;
  tdee: number;
  /** kcal/gün fark (negatif = açık) */
  adjustment: number;
  /** kullanılan haftalık hız (güvenli sınırlara çekilmiş), kg/hafta */
  weeklyRateKg: number;
  /** istenen hızdan neden sapıldı (yoksa null) */
  clampedReason: string | null;
  /** Harcama güvenlik alt sınırının altında olduğu için açık oluşturulamadı (hedef = harcama) */
  deficitBlocked: boolean;
};

/** İstenen haftalık hızı (kg/hafta, − = verme) güvenli sınırlara çeker. */
export function safeWeeklyRate(rateKg: number, weightKg: number): number {
  const cap = weightKg * MAX_WEEKLY_RATE_RATIO;
  return clamp(rateKg, -cap, cap);
}

export function calorieTarget(i: BodyInput, level: ActivityLevel, weeklyRateKg: number): CalorieTarget {
  const t = tdee(i, level);
  let reason: string | null = null;
  const capped = safeWeeklyRate(weeklyRateKg, i.weightKg);
  if (Math.abs(capped - weeklyRateKg) > 1e-9) reason = tt('nutr.reason.weeklyCap', { v: formatDecimal(round1(Math.abs(capped))) });
  let adj = (capped * KCAL_PER_KG) / 7;
  if (adj < 0 && -adj > t * MAX_DEFICIT_RATIO) {
    adj = -t * MAX_DEFICIT_RATIO;
    reason = tt('nutr.reason.deficitCap');
  }
  if (adj > 0 && adj > t * MAX_SURPLUS_RATIO) {
    adj = t * MAX_SURPLUS_RATIO;
    reason = tt('nutr.reason.surplusCap');
  }
  let kcal = t + adj;
  const floor = MIN_KCAL[i.sex];
  let deficitBlocked = false;
  if (kcal < floor && adj <= 0 && t < floor) {
    // Harcamanın kendisi alt sınırın altında: açık oluşturulamaz, hedef = harcama (artı fark çıkmaz)
    kcal = t;
    deficitBlocked = true;
    reason = tt('nutr.reason.floorBlocked', { floor });
  } else if (kcal < floor) {
    kcal = floor;
    reason = tt(i.sex === 'female' ? 'nutr.reason.floorFemale' : 'nutr.reason.floorMale', { floor });
  }
  kcal = Math.round(kcal);
  const adjustment = Math.round(kcal - t);
  // gerçekte uygulanan hız
  const realRate = Math.round((((kcal - t) * 7) / KCAL_PER_KG) * 100) / 100;
  return { kcal, tdee: Math.round(t), adjustment, weeklyRateKg: realRate, clampedReason: reason, deficitBlocked };
}

// ───────────────────────── Makrolar ─────────────────────────

export type Macros = { kcal: number; protein: number; carbs: number; fat: number };

/**
 * Protein 1,8-2,2 g/kg (açıkta 2,2; fazlada 1,8; aksi halde 2,0), yağ ≥ %25 kcal (ve ≥ 0,6 g/kg), kalan karbonhidrat.
 * Karbonhidrat sıfırın altına düşerse önce protein 1,8 g/kg'a iner.
 */
export function macrosFor(kcal: number, weightKg: number, adjustment: number): Macros {
  const perKg = adjustment < -50 ? 2.2 : adjustment > 50 ? 1.8 : 2.0;
  let protein = Math.round(perKg * weightKg);
  const fat = Math.round(Math.max(kcal * 0.25, 0.6 * weightKg * 9) / 9);
  let carbs = Math.round((kcal - protein * 4 - fat * 9) / 4);
  if (carbs < 0) {
    protein = Math.round(1.8 * weightKg);
    carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  }
  return { kcal: Math.round(kcal), protein, carbs, fat };
}

/** Antrenman günü: küçük ek (+125 kcal), tamamı karbonhidrattan. */
export const TRAINING_DAY_EXTRA_KCAL = 125;

export function trainingDayMacros(base: Macros): Macros {
  return { ...base, kcal: base.kcal + TRAINING_DAY_EXTRA_KCAL, carbs: base.carbs + Math.round(TRAINING_DAY_EXTRA_KCAL / 4) };
}

// ───────────────────────── Hedef süresi ─────────────────────────

export type GoalEta = { targetWeightKg: number; weeks: number | null; direction: 'lose' | 'gain' | 'hold'; note: string | null };

/**
 * Hedef kiloya tahmini süre. Hedef yağ oranı verilirse, yağsız kütle sabit kabul edilerek hedef kilo hesaplanır.
 * Hız yönü hedefle uyuşmuyorsa süre null olur.
 */
export function goalEta(opts: { weightKg: number; weeklyRateKg: number; targetWeightKg?: number | null; targetBodyFat?: number | null; bodyFatPercent: number }): GoalEta | null {
  let target = opts.targetWeightKg ?? null;
  let note: string | null = null;
  if (target == null && opts.targetBodyFat != null) {
    if (opts.targetBodyFat <= 0 || opts.targetBodyFat >= 60) return null;
    target = leanMassKg(opts.weightKg, opts.bodyFatPercent) / (1 - opts.targetBodyFat / 100);
    note = tt('nutr.eta.leanKept');
  }
  if (target == null) return null;
  const diff = target - opts.weightKg;
  const direction = Math.abs(diff) < 0.25 ? 'hold' : diff < 0 ? 'lose' : 'gain';
  if (direction === 'hold') return { targetWeightKg: round1(target), weeks: 0, direction, note };
  const sameWay = (direction === 'lose' && opts.weeklyRateKg < 0) || (direction === 'gain' && opts.weeklyRateKg > 0);
  if (!sameWay || Math.abs(opts.weeklyRateKg) < 0.01) {
    return { targetWeightKg: round1(target), weeks: null, direction, note: tt('nutr.eta.rateDir') };
  }
  return { targetWeightKg: round1(target), weeks: Math.ceil(Math.abs(diff) / Math.abs(opts.weeklyRateKg)), direction, note };
}

// ───────────────────────── Trend karşılaştırma ─────────────────────────

/** Kilo kayıtlarından (ts, kg) son `days` gündeki doğrusal trend, kg/hafta. Yetersiz veride null. */
export function weightTrendPerWeek(points: { ts: number; kg: number }[], now = Date.now(), days = 28): number | null {
  const from = now - days * 86_400_000;
  const p = points.filter((x) => x.ts >= from && x.ts <= now);
  if (p.length < 2) return null;
  const spanDays = (Math.max(...p.map((x) => x.ts)) - Math.min(...p.map((x) => x.ts))) / 86_400_000;
  if (spanDays < 5) return null;
  const xs = p.map((x) => (x.ts - from) / 86_400_000);
  const ys = p.map((x) => x.kg);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  xs.forEach((x, k) => {
    num += (x - mx) * (ys[k] - my);
    den += (x - mx) ** 2;
  });
  if (den === 0) return null;
  return Math.round((num / den) * 7 * 100) / 100;
}

/** Ortalama alım ve harcamaya göre beklenen haftalık kilo değişimi (kg/hafta). */
export function expectedWeeklyChange(avgKcal: number, tdeeKcal: number): number {
  return Math.round((((avgKcal - tdeeKcal) * 7) / KCAL_PER_KG) * 100) / 100;
}

// ───────────────────────── Günlük toplamlar ─────────────────────────

export type MacroTotals = { kcal: number; protein: number; carbs: number; fat: number };

export function sumMacros(items: { kcal: number; protein: number; carbs: number; fat: number }[]): MacroTotals {
  return items.reduce(
    (a, f) => ({ kcal: a.kcal + f.kcal, protein: a.protein + f.protein, carbs: a.carbs + f.carbs, fat: a.fat + f.fat }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

/** Verilen makrolardan türetilen kcal (4/4/9). Fotoğraf tahminlerinde tutarlılık denetimi için. */
export function kcalFromMacros(m: { protein: number; carbs: number; fat: number }) {
  return m.protein * 4 + m.carbs * 4 + m.fat * 9;
}

// ───────────────────────── Tarih anahtarı ─────────────────────────

/** Yerel gün anahtarı "YYYY-MM-DD". */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function shiftDay(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta, 12);
  return dayKey(dt.getTime());
}

export function dayKeyToTs(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12).getTime();
}

export const MEALS = ['Kahvaltı', 'Öğle', 'Akşam', 'Ara'] as const;
export type Meal = (typeof MEALS)[number];

/** Saate göre varsayılan öğün. */
export function defaultMeal(hour: number): Meal {
  if (hour < 10) return 'Kahvaltı';
  if (hour < 15) return 'Öğle';
  if (hour < 21) return 'Akşam';
  return 'Ara';
}
