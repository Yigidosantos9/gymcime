/**
 * Akıllı ağırlık önerisi v2 — tamamen deterministik, telefonda anlık çalışır.
 *
 * Girdi: bu egzersizin son birkaç seansı (ısınma hariç), her setin ağırlık/tekrar
 * ve varsa zorluk (RIR = kaç tekrar daha yapabilirdin) bilgisi.
 *
 * Mantık:
 *  1. Her seans için zorluğu hesaba katan tahmini 1RM (e1RM):  w × (1 + (tekrar + RIR) / 30)
 *  2. "Double progression": tüm setler aralığın üst sınırına ulaştıysa → ağırlık artar.
 *  3. RIR biliniyorsa: çok kolay geldiyse e1RM'den hedef ağırlık hesaplanır (en fazla +%7).
 *  4. Hedefin altında kalındıysa → e1RM'den güvenli ağırlık (−%5…−%12).
 *  5. Uzun ara (>14 gün) → %10–15 hafiflet. 3 seanstır ilerleme yoksa → plato / deload.
 *  6. Sonuç, ekipmanın artış adımına yuvarlanır. Ağır bileşik hareketlerde ısınma setleri önerilir.
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
export const EFFORT: { key: number; label: string; hint: string }[] = [
  { key: 4, label: 'Kolay', hint: '4+ tekrar daha yapabilirdim' },
  { key: 2, label: 'İyi', hint: '2-3 tekrar yedekte' },
  { key: 1, label: 'Zor', hint: '1 tekrar daha zor çıkardı' },
  { key: 0, label: 'Tükendim', hint: 'Bir tekrar daha çıkmazdı' },
];

export function effortLabel(rir: number | null | undefined) {
  if (rir == null) return null;
  if (rir >= 3) return 'Kolay';
  if (rir === 2) return 'İyi';
  if (rir === 1) return 'Zor';
  return 'Tükendim';
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

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '')).replace('.', ',');

/**
 * Bir sonraki seans için öneri.
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
      reason: `İlk sefer: ${repMin}-${repMax} tekrarı ${targetRir} tekrar yedekte bırakarak yapabileceğin bir ağırlık seç`,
    };
  }

  const last = valid[0];
  const lastSets = working(last.sets);
  const topWeight = Math.max(...lastSets.map((s) => s.weight ?? 0));
  const topSets = lastSets.filter((s) => (s.weight ?? 0) === topWeight);
  const minReps = Math.min(...topSets.map((s) => s.reps ?? 0));
  // "Çok kolay" kararı için TÜM üst setlerin zorluğu bilinmeli (tükeniş seti vb. gözden kaçmasın)
  const allRirKnown = topSets.every((s) => s.rir != null || s.set_type === 'failure');
  const rirs = topSets.map((s) => rirOf(s, targetRir));
  const avgRir = allRirKnown ? rirs.reduce((a, b) => a + b, 0) / rirs.length : null;
  const minRir = Math.min(...rirs);

  // Ağırlıklı e1RM (son seans 0.5, önceki 0.3, ondan önceki 0.2)
  const e1rms = valid.slice(0, 4).map((h) => sessionE1RM(h.sets, targetRir));
  const w = [0.5, 0.3, 0.2];
  let num = 0;
  let den = 0;
  e1rms.slice(0, 3).forEach((v, i) => {
    if (v > 0) {
      num += v * w[i];
      den += w[i];
    }
  });
  const e1rm = den > 0 ? num / den : 0;
  base.e1rm = e1rm > 0 ? Math.round(e1rm * 10) / 10 : null;

  // Plato: son 3 seansın hiçbiri, 4 seans önceki en iyiyi %0.5 geçemediyse
  const plateau = e1rms.length >= 4 && Math.max(...e1rms.slice(0, 3)) <= e1rms[3] * 1.005;
  base.plateau = plateau;

  const daysOff = (now - last.started_at) / 86400000;

  // ── Vücut ağırlığı / ekipmansız: tekrarla ilerle
  if (step === 0 || topWeight === 0) {
    const bw = (reps: number, kind: SuggestKind, reason: string): Suggestion => ({ ...base, weight: topWeight || null, reps, kind, reason });
    if (daysOff > 14) {
      const r = Math.max(1, Math.round(minReps * 0.85));
      return bw(r, 'return', `${Math.round(daysOff)} gündür yapmadın → ${r} tekrarla yeniden başla`);
    }
    if (minReps >= repMax) return bw(repMax + 1, 'increase', `Üst sınır (${repMax}) tamam → ${repMax + 1} tekrar dene ya da ağırlık ekle`);
    const target = minReps + 1;
    if (minReps < repMin) return bw(target, 'hold', `Hedef ${repMin} tekrar · bugün ${target} tekrara uzan`);
    return bw(target, 'hold', `Geçen sefer en az ${minReps} tekrar → bugün ${target} hedefle`);
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
      `${Math.round(daysOff)} gündür yapmadın → %${Math.round((1 - factor) * 100)} hafif başla, formu oturt`,
    );
  }

  // ── Plato + son seans zorladıysa: deload
  if (plateau && minReps <= repMin) {
    return finish(floorTo(topWeight * 0.9, step), repMax, 'deload', '3 seanstır güç artmıyor → %10 hafif, yüksek tekrarlı bir seans (deload)');
  }

  // ── Hedefin altında kaldı
  if (minReps < Math.max(1, repMin - 1) || (minReps < repMin && minRir <= 0)) {
    const fromE1rm = weightFor(e1rm || effective1RM(topWeight, minReps, minRir), repMin, targetRir);
    const clamped = Math.min(topWeight * 0.95, Math.max(topWeight * 0.88, fromE1rm));
    return finish(floorTo(clamped, step), repMin, 'decrease', `Hedefin (${repMin}) altında kaldın → ${fmt(floorTo(clamped, step))} kg ile formu koru`);
  }

  // ── Üst sınıra ulaştı: klasik artış
  if (minReps >= repMax && minRir >= targetRir - 1) {
    return finish(topWeight + step, repMin, 'increase', `Tüm setlerde üst sınır (${repMax}) tamam → +${fmt(step)} kg`);
  }

  // ── RIR biliniyor ve çok kolay geldi: e1RM'den hedef ağırlık (en fazla +%7)
  // Zorluk seçenekleri en fazla RIR 4 → eşik 4'ü geçmesin (yoksa "Formda kalmak"ta hiç tetiklenmez)
  if (avgRir != null && avgRir >= Math.min(targetRir + 2, 4) && minReps >= repMin) {
    const midReps = Math.round((repMin + repMax) / 2);
    const target = weightFor(effective1RM(topWeight, minReps, avgRir), midReps, targetRir);
    const next = floorTo(Math.min(target, topWeight * 1.07), step);
    if (next > topWeight) {
      return finish(next, midReps, 'increase', `Geçen sefer kolay geldi (≈${Math.round(avgRir)} tekrar yedekte) → ${fmt(next)} kg × ${midReps}`);
    }
    // Artış adımı tahmini aşıyor (veya %7 sınırını): ağırlığı koru, tekrarı artır
    const r = Math.min(repMax, minReps + 2);
    return finish(topWeight, r, 'hold', `Kolay geldi ama bir sonraki adım (+${fmt(step)} kg) erken → aynı ağırlıkla ${r} tekrar`);
  }

  // ── Üst sınıra ulaştı ama zorlandı: aynı ağırlıkta pekiştir
  if (minReps >= repMax) {
    return finish(topWeight, repMax, 'hold', `Üst sınıra ulaştın ama zorlandın → aynı ağırlıkla ${repMax} tekrarı rahatlat`);
  }

  // ── Aynı ağırlık, +1 tekrar
  const target = Math.min(repMax, minReps + 1);
  return finish(
    topWeight,
    target,
    'hold',
    plateau ? `Plato sinyali: ${target} tekrarı hedefle, olmazsa deload düşün` : `Aynı ağırlık, ${target} tekrarı hedefle`,
  );
}

/**
 * Seans içi ayar: tamamlanan çalışma setinin ağırlık/tekrar/zorluk (RIR) bilgisinden
 * bir sonraki set için ağırlık ve tekrar önerir.
 *
 *  - Kolay (RIR ≥3): güç tahmininden hedef ağırlık; en az bir adım, en fazla iki adım artış.
 *  - İyi (RIR 2 = hedef): aynı ağırlık ve tekrar.
 *  - Zor / Tükendim (RIR ≤1): yorgunluk payıyla (%2) yeniden hesap; tekrar hedef aralıkta
 *    kalıyorsa ağırlığı koru ve tekrarı düşür, kalmıyorsa ağırlığı düşür (en fazla %12).
 *  - Zorluk girilmediyse ve hedef tekrarın 2+ altında kalındıysa "tükendi" kabul edilir.
 */
export function adjustAfterSet(
  planned: { weight: number | null; reps: number },
  done: { weight: number | null; reps: number | null; rir: number | null },
  targetRir: number,
  step: number,
  range: { repMin: number; repMax: number } = { repMin: 1, repMax: 30 },
): { weight: number | null; reps: number; note: string | null } {
  const reps = done.reps ?? 0;
  const missed = reps > 0 && reps < planned.reps - 1;
  const rir = done.rir ?? (missed ? 0 : null);
  const label = effortLabel(rir) ?? 'Zor';
  const w = done.weight ?? planned.weight;
  const clampReps = (r: number) => Math.max(Math.max(1, range.repMin - 2), Math.min(range.repMax, r));

  if (rir == null || reps <= 0) return { weight: w, reps: planned.reps, note: null };

  // Vücut ağırlığı / ekipmansız: sadece tekrar
  if (!w || step === 0) {
    const delta = Math.max(-2, Math.min(2, rir - targetRir));
    const r = Math.max(1, reps + delta);
    return { weight: w, reps: r, note: delta === 0 ? null : `${label} → sonraki set ${r} tekrar` };
  }

  // Hedefteyse aynen devam
  if (rir === targetRir && !missed) return { weight: w, reps: planned.reps, note: null };

  const fatigue = rir >= 2 ? 1 : 0.98;
  const e1 = effective1RM(w, reps, rir) * fatigue;
  const target = Math.max(range.repMin, Math.min(range.repMax, planned.reps));
  const ideal = weightFor(e1, target, targetRir);
  const repsAt = (wt: number) => Math.floor(30 * (e1 / wt - 1) - targetRir + 1e-9);

  if (ideal >= w + step) {
    const nw = Math.min(floorTo(ideal, step), w + 2 * step);
    return { weight: nw, reps: target, note: `${label} → sonraki set ${fmt(nw)} kg × ${target}` };
  }
  if (ideal < w) {
    const r = repsAt(w);
    if (r >= range.repMin) {
      const rr = clampReps(Math.min(r, target));
      return { weight: w, reps: rr, note: rr === planned.reps ? null : `${label} → aynı ağırlık, ${rr} tekrar` };
    }
    const nw = Math.max(step, Math.min(w - step, Math.max(roundTo(ideal, step), floorTo(w * 0.88, step))));
    const rr = clampReps(Math.min(target, Math.max(range.repMin, repsAt(nw))));
    return { weight: nw, reps: rr, note: `${label} → sonraki set ${fmt(nw)} kg × ${rr}` };
  }
  // ideal, mevcut ağırlıkla bir adım yukarısı arasında: ağırlığı koru, tekrarı ayarla
  const rr = clampReps(Math.max(target, Math.min(range.repMax, repsAt(w))));
  return { weight: w, reps: rr, note: rr === planned.reps ? null : `${label} → aynı ağırlık, ${rr} tekrar` };
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
 * Tamamlanan bir çalışma setinden sonra kalan setleri yeniden planla.
 * Zorluk (RIR) girildiyse ya da ağırlık/tekrar plandan saptıysa güç tahmini güncellenir;
 * kalan setler bu tahmin ve set başına %1 yorgunluk payıyla, plana göre −%12…+2 adım aralığında ayarlanır.
 */
export function replanAfter(
  plan: SetPlan[],
  doneIndex: number,
  done: { weight: number | null; reps: number | null; rir: number | null },
  step: number,
  opts: { style?: 'ramp' | 'straight'; repMin?: number } = {},
): { plan: SetPlan[]; note: string | null } {
  const p = plan[doneIndex];
  const reps = done.reps ?? 0;
  const w = done.weight ?? p?.weight ?? null;
  if (!p || !w || reps <= 0 || step === 0) return { plan, note: null };
  const asPlanned = done.rir == null && reps >= p.reps && w === p.weight;
  if (asPlanned) return { plan, note: null };
  const missed = reps < p.reps - 1;
  const rir = done.rir ?? (missed ? 0 : p.rir);
  const e1 = effective1RM(w, reps, rir);
  const next = plan.map((x) => ({ ...x }));
  for (let j = doneIndex + 1; j < next.length; j++) {
    const base = plan[j].weight ?? w;
    const ideal = weightFor(e1 * Math.pow(0.99, j - doneIndex), next[j].reps, next[j].rir);
    const lo = floorTo(base * 0.88, step);
    const hi = base + 2 * step;
    next[j].weight = Math.max(step, Math.min(hi, Math.max(lo, roundTo(ideal, step))));
    // Piramit: setler hafiflemesin → ağırlığı yapılan sette tut, tekrarı tahmine göre azalt.
    // Tekrar hedef aralığın 2'den fazla altına düşecekse ağırlığı düşürmeye izin ver.
    if (opts.style === 'ramp' && next[j].weight! < w) {
      const repsAtW = Math.floor(30 * ((e1 * Math.pow(0.99, j - doneIndex)) / w - 1) - next[j].rir + 1e-9);
      const floorReps = Math.max(1, (opts.repMin ?? 1) - 2);
      if (repsAtW >= floorReps) {
        next[j].weight = w;
        next[j].reps = Math.min(next[j].reps, repsAtW);
      }
    }
  }
  const n = next[doneIndex + 1];
  const changed = n && (n.weight !== plan[doneIndex + 1].weight || n.reps !== plan[doneIndex + 1].reps);
  const label = done.rir != null ? effortLabel(done.rir)! : missed ? 'Tekrar kaçtı' : 'Set farklı';
  return {
    plan: next,
    note: changed ? `${label} → Set ${doneIndex + 2}: ${fmt(n.weight!)} kg × ${n.reps}` : null,
  };
}
