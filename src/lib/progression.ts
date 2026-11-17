import { formatDecimal, t, type MsgKey } from '@/i18n';
/**
 * Ağırlık önerisi v3 — kural tabanlı, deterministik, telefonda anlık çalışır.
 *
 * 1 adım = incrementFor(ekipman). Zorluk: Kolay = RIR ≥3, İyi = 2, Zor = 1, Tükendim = 0
 * (seçilmediyse: hedef tekrar tutturuldu → İyi, 1 eksik → Zor, 2+ eksik → Tükendim).
 *
 *  - Sonraki antrenman (suggestNext), en ağır sete göre: Kolay +2 adım · İyi +1 adım ·
 *    Zor aynı ağırlık +1 tekrar (üst sınırdaysa +1 adım) · Tükendim aynı ağırlık (hedefin 2+ altı: −1 adım).
 *  - Seans içi (replanAfter): sonraki set = yapılan + piramit artışı; Kolay +1 adım · İyi plan · Zor artış iptal · Tükendim −1 adım.
 *  - e1RM yalnızca bilgidir; plato yalnızca not (otomatik deload yok). >14 gün ara → hafiflet. Ağır halter için ısınma önerisi.
 */

export type DoneSet = {
  weight: number | null;
  reps: number | null;
  rpe?: number | null;
  rir?: number | null;
  set_type?: string;
};

export type Session = { started_at: number; sets: DoneSet[] };

export type Increments = { barbell: number; dumbbell: number; machine: number };

export type SuggestKind = 'start' | 'increase' | 'hold' | 'decrease' | 'deload' | 'return';

export type Suggestion = {
  weight: number | null;
  reps: number;
  /** Kısa Türkçe gerekçe */
  reason: string;
  kind: SuggestKind;
  confidence: 'low' | 'medium' | 'high';
  /** Mevcut güç tahmini (kg) */
  e1rm: number | null;
  /** Hedef RIR (setin sonunda kaç tekrar yedekte kalsın) */
  targetRir: number;
  plateau: boolean;
  warmups: { weight: number; reps: number }[];
};

export const DEFAULT_INCREMENTS: Increments = { barbell: 2.5, dumbbell: 2, machine: 2.5 };

/** Setin zorluk seçenekleri → RIR */
const effortOption = (key: number) => ({
  key,
  get label() {
    return t(`effort.${key}` as MsgKey);
  },
  get hint() {
    return t(`effort.${key}.hint` as MsgKey);
  },
});
export const EFFORT: { key: number; label: string; hint: string }[] = [4, 2, 1, 0].map(effortOption);

export function effortLabel(rir: number | null | undefined) {
  if (rir == null) return null;
  if (rir >= 3) return t('effort.easy');
  if (rir === 2) return t('effort.good');
  if (rir === 1) return t('effort.hard');
  return t('effort.fail');
}

/** Epley formülü ile tahmini 1RM. */
export function estimate1RM(weight: number | null | undefined, reps: number | null | undefined) {
  if (!weight || !reps || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/** Zorluğu hesaba katan 1RM: tükenişe kadar yapılabilecek tekrar = reps + RIR. */
export function effective1RM(weight: number, reps: number, rir: number) {
  return weight * (1 + (reps + rir) / 30);
}

/** e1RM'den, hedef tekrar + yedek tekrar için ağırlık. */
export function weightFor(e1rm: number, reps: number, rir: number) {
  return e1rm / (1 + (reps + rir) / 30);
}

export function incrementFor(equipment: string, inc: Increments = DEFAULT_INCREMENTS) {
  switch (equipment) {
    case 'Halter':
      return inc.barbell;
    case 'Dambıl':
    case 'Kettlebell':
      return inc.dumbbell;
    case 'Makine':
    case 'Kablo':
      return inc.machine;
    default:
      return 0; // vücut ağırlığı: tekrar ile ilerle
  }
}

export function roundTo(value: number, step: number) {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

function floorTo(value: number, step: number) {
  if (step <= 0) return value;
  return Math.floor(value / step + 1e-9) * step;
}

export function targetRirFor(goal: string) {
  if (goal === 'Formda kalmak') return 3;
  return 2;
}

/** RIR girilmemişse makul tahmin: tükeniş setleri 0, diğerleri hedef RIR kadar. */
function rirOf(s: DoneSet, fallback: number) {
  if (s.rir != null) return s.rir;
  if (s.set_type === 'failure') return 0;
  if (s.rpe != null) return Math.max(0, 10 - s.rpe);
  return fallback;
}

function working(sets: DoneSet[]) {
  return sets.filter(
    (s) =>
      s.set_type !== 'warmup' &&
      s.set_type !== 'drop' &&
      Number.isFinite(s.reps ?? NaN) &&
      (s.reps ?? 0) > 0 &&
      (s.weight == null || (Number.isFinite(s.weight) && s.weight >= 0)),
  );
}

function sessionE1RM(sets: DoneSet[], fallbackRir: number) {
  let best = 0;
  for (const s of working(sets)) {
    if (!s.weight) continue;
    best = Math.max(best, effective1RM(s.weight, s.reps!, rirOf(s, fallbackRir)));
  }
  return best;
}

const HEAVY_EQUIPMENT = new Set(['Halter']);

export function warmupsFor(weight: number | null, equipment: string, step: number) {
  if (!weight || !HEAVY_EQUIPMENT.has(equipment) || weight < 40) return [];
  const bar = 20;
  const scheme: [number, number][] = [
    [0.4, 10],
    [0.6, 5],
    [0.8, 3],
  ];
  const out: { weight: number; reps: number }[] = [];
  for (const [pct, reps] of scheme) {
    const w = Math.max(bar, roundTo(weight * pct, step || 2.5));
    if (w >= weight) continue;
    if (out.length && out[out.length - 1].weight === w) continue;
    out.push({ weight: w, reps });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Kural tabanlı öneri (sabit, ezberlenebilir kurallar — e1RM yalnızca bilgi)
// ─────────────────────────────────────────────────────────────────────────────

export type Effort = 'easy' | 'good' | 'hard' | 'fail';

export const EFFORT_NAME: Record<Effort, string> = {
  get easy() {
    return t('effort.easy');
  },
  get good() {
    return t('effort.good');
  },
  get hard() {
    return t('effort.hard');
  },
  get fail() {
    return t('effort.fail');
  },
};

/** Kolay = RIR ≥3, İyi = 2, Zor = 1, Tükendim = 0. */
export function effortFromRir(rir: number): Effort {
  if (rir >= 3) return 'easy';
  if (rir === 2) return 'good';
  if (rir === 1) return 'hard';
  return 'fail';
}

/** Zorluk seçilmediyse: hedef tutturuldu → İyi; 1 tekrar eksik → Zor; 2+ eksik → Tükendim. */
export function inferEffort(reps: number, targetReps: number): Effort {
  if (reps >= targetReps) return 'good';
  if (reps === targetReps - 1) return 'hard';
  return 'fail';
}

/** Kural tablosu (UI'daki "?" sheet'i ve testler aynı kaynağı kullanır). */
const ruleRow = (effort: Effort) => ({
  effort,
  get meaning() {
    return t(`effort.meaning.${effort}` as MsgKey);
  },
  get inSession() {
    return t(`effort.inSession.${effort}` as MsgKey);
  },
  get nextWorkout() {
    return t(`effort.next.${effort}` as MsgKey);
  },
});
export const RULE_TABLE: { effort: Effort; meaning: string; inSession: string; nextWorkout: string }[] = (['easy', 'good', 'hard', 'fail'] as Effort[]).map(ruleRow);

const fmt = (n: number) => formatDecimal(n, 1);
const stepsText = (n: number) => t('prog.stepFn', { sign: n > 0 ? '+' : '−', count: Math.abs(n) });

/** Bir setin zorluğu: açık RIR > tükeniş seti > RPE > tekrardan çıkarım. */
function effortOfSet(s: DoneSet, targetReps: number): { effort: Effort; inferred: boolean } {
  if (s.rir != null) return { effort: effortFromRir(s.rir), inferred: false };
  if (s.set_type === 'failure') return { effort: 'fail', inferred: false };
  if (s.rpe != null) return { effort: effortFromRir(Math.max(0, 10 - s.rpe)), inferred: false };
  return { effort: inferEffort(s.reps ?? 0, targetReps), inferred: true };
}

/**
 * Bir sonraki seans için öneri — "en ağır (son) çalışma seti"nin zorluğuna göre sabit kurallar.
 * @param sessions en yeni seans başta olacak şekilde son seanslar (ısınma setleri dahil olabilir, yok sayılır)
 */
export function suggestNext(
  sessions: Session[] | DoneSet[],
  repMin: number,
  repMax: number,
  equipment: string,
  opts: { goal?: string; increments?: Increments; now?: number } = {},
): Suggestion {
  // Eski imza (tek seansın setleri) ile geriye uyumluluk
  const hist: Session[] =
    sessions.length > 0 && 'sets' in (sessions[0] as Session)
      ? (sessions as Session[])
      : sessions.length > 0
        ? [{ started_at: opts.now ?? Date.now(), sets: sessions as DoneSet[] }]
        : [];
  const goal = opts.goal ?? 'Kas kazanmak';
  const targetRir = targetRirFor(goal);
  const step = incrementFor(equipment, opts.increments);
  const now = opts.now ?? Date.now();

  const valid = hist.filter((h) => working(h.sets).length > 0);
  const base: Omit<Suggestion, 'weight' | 'reps' | 'reason' | 'kind'> = {
    confidence: valid.length >= 3 ? 'high' : valid.length === 2 ? 'medium' : 'low',
    e1rm: null,
    targetRir,
    plateau: false,
    warmups: [],
  };

  if (valid.length === 0) {
    return {
      ...base,
      weight: null,
      reps: repMin,
      kind: 'start',
      reason: t('prog.start', { min: repMin, max: repMax, rir: targetRir }),
    };
  }

  const last = valid[0];
  const lastSets = working(last.sets);
  const topWeight = Math.max(...lastSets.map((s) => s.weight ?? 0));
  // En ağır set (eşitlikte sonuncusu) — kural bu sete göre işler
  const top = [...lastSets].reverse().find((s) => (s.weight ?? 0) === topWeight)!;
  const topReps = top.reps ?? 0;

  // Bilgi amaçlı e1RM ve plato (öneriyi değiştirmez)
  const e1rms = valid.slice(0, 4).map((h) => sessionE1RM(h.sets, targetRir));
  const wts = [0.5, 0.3, 0.2];
  let num = 0;
  let den = 0;
  e1rms.slice(0, 3).forEach((v, i) => {
    if (v > 0) {
      num += v * wts[i];
      den += wts[i];
    }
  });
  const e1rm = den > 0 ? num / den : 0;
  base.e1rm = e1rm > 0 ? Math.round(e1rm * 10) / 10 : null;
  base.plateau = e1rms.length >= 4 && Math.max(...e1rms.slice(0, 3)) <= e1rms[3] * 1.005;

  const daysOff = (now - last.started_at) / 86400000;
  const { effort, inferred } = effortOfSet(top, repMin);
  const eff = inferred ? t('effort.inferred', { name: EFFORT_NAME[effort] }) : EFFORT_NAME[effort];
  const lead = t('prog.lead', { eff });

  // ── Vücut ağırlığı / ekipmansız: tekrarla ilerle (Kolay +2 · İyi +1 · Zor aynı · Tükendim −1)
  if (step === 0 || topWeight === 0) {
    const bw = (reps: number, kind: SuggestKind, reason: string): Suggestion => ({ ...base, weight: topWeight || null, reps, kind, reason });
    if (daysOff > 14) {
      const r = Math.max(1, Math.round(topReps * 0.85));
      return bw(r, 'return', t('prog.bw.return', { days: Math.round(daysOff), reps: r }));
    }
    // Tükendim: yalnızca açıkça seçildiyse ve sonuç hedefin (alt sınır) altına düşmüyorsa −1; çıkarımla ise gerileme yok
    const delta = effort === 'fail' ? (!inferred && topReps - 1 >= repMin ? -1 : 0) : { easy: 2, good: 1, hard: 0 }[effort];
    const r = Math.max(1, topReps + delta);
    const kind: SuggestKind = delta > 0 ? 'increase' : delta < 0 ? 'decrease' : 'hold';
    return bw(r, kind, delta > 0 ? t('prog.bw.up', { lead, delta, reps: r }) : delta < 0 ? t('prog.bw.down', { lead, reps: r }) : t('prog.bw.same', { lead, reps: r }));
  }

  const finish = (weight: number, reps: number, kind: SuggestKind, reason: string): Suggestion => {
    const wgt = Math.max(step, weight);
    return { ...base, weight: wgt, reps, kind, reason, warmups: warmupsFor(wgt, equipment, step) };
  };

  // ── Uzun ara: hafiflet
  if (daysOff > 14) {
    const factor = daysOff > 28 ? 0.85 : 0.9;
    return finish(
      floorTo(topWeight * factor, step),
      repMin,
      'return',
      t('prog.return', { days: Math.round(daysOff), pct: Math.round((1 - factor) * 100) }),
    );
  }

  const clampReps = (r: number) => Math.max(repMin, Math.min(repMax, r));
  // Ağırlık artarken tekrar: yaptığın tekrar (üst sınırdaysa alt sınıra dön)
  const repsAfterIncrease = topReps >= repMax ? repMin : clampReps(topReps);
  const up = (steps: number): Suggestion => {
    const w = topWeight + steps * step;
    return finish(w, repsAfterIncrease, 'increase', t('prog.up', { lead, steps: stepsText(steps), w: fmt(w) }));
  };

  switch (effort) {
    case 'easy':
      return up(2);
    case 'good':
      // Hedef tutturulmadıysa (zorluk girilmiş ama tekrar alt sınırın altında) önce tekrarı yakala
      if (topReps < repMin) return finish(topWeight, topReps + 1, 'hold', t('prog.goodBelow', { lead, min: repMin, reps: topReps + 1 }));
      return up(1);
    case 'hard':
      if (topReps >= repMax) return up(1);
      return finish(topWeight, topReps + 1, 'hold', t('prog.hardHold', { lead, w: fmt(topWeight), reps: topReps + 1 }));
    case 'fail':
      if (topReps <= repMin - 2) {
        const w = topWeight - step;
        return finish(w, repMin, 'decrease', t('prog.failDown', { lead, min: repMin, w: fmt(Math.max(step, w)) }));
      }
      return finish(topWeight, clampReps(topReps), 'hold', t('prog.failHold', { lead, w: fmt(topWeight), reps: clampReps(topReps) }));
  }
}

/**
 * Vücut ağırlığı / ekipmansız hareketlerde seans içi ayar: sonraki setin tekrarı.
 * Kolay → plan+1 · İyi → plan · Zor → yapılan tekrar (en çok plan kadar) · Tükendim → yapılan −1 (zorluk çıkarımla Tükendim ise gerileme yok).
 */
export function adjustBodyweight(
  plannedReps: number,
  done: { reps: number | null; rir: number | null; failure?: boolean },
): { reps: number; note: string | null } {
  const reps = done.reps ?? 0;
  if (reps <= 0) return { reps: plannedReps, note: null };
  const { effort, inferred } = done.rir != null ? { effort: effortFromRir(done.rir), inferred: false } : done.failure ? { effort: 'fail' as Effort, inferred: false } : { effort: inferEffort(reps, plannedReps), inferred: true };
  // Açık Tükendim: yorgunluk için −1; çıkarımla Tükendim: gerileme yok
  const r = Math.max(
    1,
    effort === 'easy' ? plannedReps + 1 : effort === 'good' ? plannedReps : effort === 'hard' || inferred ? Math.min(plannedReps, reps) : Math.min(plannedReps, reps) - 1,
  );
  return { reps: r, note: r === plannedReps ? null : t('prog.bwNote', { eff: inferred ? t('effort.inferred', { name: EFFORT_NAME[effort] }) : EFFORT_NAME[effort], reps: r }) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Set düzeni (piramit / sabit) ve set set planlama
// ─────────────────────────────────────────────────────────────────────────────

export type SetStyle = 'auto' | 'ramp' | 'straight';

/**
 * Geçmişten set düzenini öğren: çalışma setlerinde son set ilkinden belirgin ağırsa (%4+)
 * "artan / piramit", değilse "sabit". Veri yoksa null.
 */
export function detectStyle(history: Session[]): 'ramp' | 'straight' | null {
  let ramp = 0;
  let total = 0;
  for (const h of history.slice(0, 4)) {
    const ws = working(h.sets).filter((s) => (s.weight ?? 0) > 0);
    if (ws.length < 2) continue;
    total++;
    if ((ws[ws.length - 1].weight ?? 0) >= (ws[0].weight ?? 0) * 1.04) ramp++;
  }
  if (total === 0) return null;
  return ramp * 2 >= total ? 'ramp' : 'straight';
}

/** Setlerin hedef zorluğu (RIR). Piramitte ilk set kolay, son set en zor. */
export function rirSchedule(n: number, targetRir: number, style: 'ramp' | 'straight') {
  if (n <= 0) return [];
  if (style === 'straight') return Array.from({ length: n }, () => targetRir);
  const last = Math.max(0, targetRir - 1);
  if (n === 1) return [last];
  const first = targetRir + 2;
  return Array.from({ length: n }, (_, i) => Math.floor(first + ((last - first) * i) / (n - 1) + 1e-9));
}

/** Geçmiş seanslarda her set sırasının (çalışma setleri) medyan tekrarı. */
export function learnedReps(history: Session[], n: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < n; i++) {
    const vals = history
      .slice(0, 3)
      .map((h) => working(h.sets)[i]?.reps ?? null)
      .filter((v): v is number => v != null && v > 0)
      .sort((a, b) => a - b);
    out.push(vals.length ? vals[Math.floor(vals.length / 2)] : null);
  }
  return out;
}

export type SetPlan = { weight: number | null; reps: number; rir: number };

/**
 * Seansın set planı. `top` en ağır (son) setin önerisidir; diğer setler güç tahmininden,
 * set sırasının hedef zorluğuna göre hesaplanır. Piramitte ağırlıklar azalmaz.
 */
export function planSets(
  top: { weight: number | null; reps: number },
  n: number,
  style: 'ramp' | 'straight',
  targetRir: number,
  step: number,
  repsPerSet: (number | null)[] = [],
): SetPlan[] {
  const rirs = rirSchedule(n, targetRir, style);
  if (!top.weight || step === 0 || n === 0) {
    return rirs.map((rir, i) => ({ weight: top.weight, reps: i === n - 1 ? top.reps : (repsPerSet[i] ?? top.reps), rir }));
  }
  const e1 = effective1RM(top.weight, top.reps, rirs[n - 1]);
  const plan: SetPlan[] = rirs.map((rir, i) => {
    const reps = i === n - 1 ? top.reps : (repsPerSet[i] ?? top.reps);
    const w = i === n - 1 ? top.weight! : roundTo(weightFor(e1, reps, rir), step);
    return { weight: Math.max(step, Math.min(top.weight!, w)), reps, rir };
  });
  if (style === 'ramp') {
    for (let i = n - 2; i >= 0; i--) plan[i].weight = Math.min(plan[i].weight!, plan[i + 1].weight!);
  } else {
    for (const p of plan) p.weight = top.weight;
  }
  return plan;
}

/**
 * Seans içi kural: tamamlanan çalışma setinden sonra kalan setleri yeniden planla.
 *   taban = yapılan ağırlık + planlanan piramit artışı (plan[n+1] − plan[n], ≥ 0; sabitte 0)
 *   Kolay → taban + 1 adım · İyi → taban · Zor → yapılan ağırlık · Tükendim → yapılan − 1 adım
 * Sonraki setlerin hepsi yeni ağırlığa göre plandaki farkları korur (zincir). Tekrar hedefi plandaki gibi kalır.
 * Zorluk seçilmediyse: planlanan tekrar tutturuldu → İyi; 1 eksik → Zor; 2+ eksik → Tükendim.
 */
export function replanAfter(
  plan: SetPlan[],
  doneIndex: number,
  done: { weight: number | null; reps: number | null; rir: number | null; failure?: boolean },
  step: number,
): { plan: SetPlan[]; note: string | null } {
  const p = plan[doneIndex];
  const nextSet = plan[doneIndex + 1];
  const reps = done.reps ?? 0;
  const w = done.weight ?? p?.weight ?? null;
  if (!p || !nextSet || !w || reps <= 0 || step === 0) return { plan, note: null };
  const inferred = done.rir == null && !done.failure;
  const effort: Effort = done.rir != null ? effortFromRir(done.rir) : done.failure ? 'fail' : inferEffort(reps, p.reps);
  const rise = Math.max(0, (nextSet.weight ?? 0) - (p.weight ?? 0));
  const taban = w + rise;
  const nextWeight = Math.max(
    step,
    effort === 'easy' ? taban + step : effort === 'good' ? taban : effort === 'hard' ? w : w - step,
  );
  const next = plan.map((x) => ({ ...x }));
  next[doneIndex + 1].weight = nextWeight;
  for (let j = doneIndex + 2; j < next.length; j++) {
    const diff = Math.max(0, (plan[j].weight ?? 0) - (plan[j - 1].weight ?? 0));
    next[j].weight = Math.max(step, (next[j - 1].weight ?? 0) + diff);
  }
  const changed = nextWeight !== nextSet.weight;
  const why =
    effort === 'easy' ? t('prog.why.easy') : effort === 'good' ? t('prog.why.good') : effort === 'hard' ? (rise > 0 ? t('prog.why.hardCancel') : t('prog.why.hardSame')) : t('prog.why.fail');
  return {
    plan: next,
    note: changed ? t('prog.adjust', { eff: inferred ? t('effort.inferred', { name: EFFORT_NAME[effort] }) : EFFORT_NAME[effort], n: doneIndex + 2, w: fmt(nextWeight), reps: nextSet.reps, why }) : null,
  };
}
