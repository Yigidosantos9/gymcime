/** Rutin yapısı: egzersiz sırası, çalışma seti sayısı, tekrar aralığı. */
export type ShapeItem = { exercise_id: number; name: string; target_sets: number; rep_min: number; rep_max: number };

export type RoutineDiff = {
  changed: boolean;
  added: string[];
  removed: string[];
  /** set sayısı değişenler */
  sets: { name: string; from: number; to: number }[];
  /** tekrar aralığı değişenler */
  reps: { name: string; from: string; to: string }[];
  /** ortak egzersizlerin sırası değişti mi */
  reordered: boolean;
  /** kullanıcıya gösterilecek Türkçe satırlar */
  lines: string[];
};

/** Rutindeki yapı ile antrenmanda yapılan yapıyı karşılaştırır (saf). */
export function diffRoutine(routine: ShapeItem[], workout: ShapeItem[]): RoutineDiff {
  const rById = new Map(routine.map((r) => [r.exercise_id, r]));
  const wById = new Map(workout.map((w) => [w.exercise_id, w]));
  const added = workout.filter((w) => !rById.has(w.exercise_id)).map((w) => w.name);
  const removed = routine.filter((r) => !wById.has(r.exercise_id)).map((r) => r.name);
  const sets: RoutineDiff['sets'] = [];
  const reps: RoutineDiff['reps'] = [];
  for (const w of workout) {
    const r = rById.get(w.exercise_id);
    if (!r) continue;
    if (r.target_sets !== w.target_sets) sets.push({ name: w.name, from: r.target_sets, to: w.target_sets });
    if (r.rep_min !== w.rep_min || r.rep_max !== w.rep_max) reps.push({ name: w.name, from: `${r.rep_min}-${r.rep_max}`, to: `${w.rep_min}-${w.rep_max}` });
  }
  const rOrder = routine.filter((r) => wById.has(r.exercise_id)).map((r) => r.exercise_id);
  const wOrder = workout.filter((w) => rById.has(w.exercise_id)).map((w) => w.exercise_id);
  const reordered = rOrder.some((id, i) => id !== wOrder[i]);
  const lines = [
    ...added.map((n) => `+ ${n} eklendi`),
    ...removed.map((n) => `− ${n} çıkarıldı`),
    ...sets.map((s) => `${s.name}: ${s.from} → ${s.to} set`),
    ...reps.map((s) => `${s.name}: ${s.from} → ${s.to} tekrar`),
    ...(reordered ? ['Egzersiz sırası değişti'] : []),
  ];
  return { changed: lines.length > 0, added, removed, sets, reps, reordered, lines };
}
