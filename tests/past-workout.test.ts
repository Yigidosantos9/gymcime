// Görev 2.11 — tekrar eden egzersiz + geçmişe antrenman ekleme
import {
  addExercisesToWorkout,
  addHistoryExercise,
  createHistoryWorkout,
  editHistorySet,
  finalizeHistoryEdit,
  getWorkoutDetail,
  getWorkoutExerciseIds,
  saveRoutine,
  startWorkout,
  workoutsBetween,
} from '@/db/queries';
import { startOfDay } from '@/lib/format';
import { assert, freshDb } from './helpers';

(async () => {
  const { raw, db } = await freshDb();
  const bench = (raw.prepare("SELECT id FROM exercises WHERE slug = 'bench-press'").get() as any)?.id ?? (raw.prepare("SELECT id FROM exercises WHERE kind = 'strength' LIMIT 1").get() as any).id;
  const squat = (raw.prepare("SELECT id FROM exercises WHERE kind = 'strength' AND id != ? LIMIT 1").get(bench) as any).id;
  const prFlags = (exId: number) =>
    raw
      .prepare('SELECT s.is_pr AS p, w.started_at AS t FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id JOIN workouts w ON w.id = we.workout_id WHERE we.exercise_id = ? ORDER BY w.started_at, s.position')
      .all(exId)
      .map((r: any) => r.p) as number[];
  const setsOf = (workoutId: number) => raw.prepare('SELECT s.id FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id WHERE we.workout_id = ? ORDER BY we.position, s.position').all(workoutId).map((r: any) => r.id as number);

  const now = new Date(2026, 10, 17, 12, 0).getTime();
  const day = (d: number, h = 18) => new Date(2026, 10, d, h, 0).getTime();

  // ── gelecek tarih reddi
  let threw = false;
  try {
    await createHistoryWorkout(db, { routineId: null, startedAt: now + 60_000, durationMin: 60, now });
  } catch {
    threw = true;
  }
  assert(threw, 'gelecek zaman reddedilir');
  assert((raw.prepare('SELECT COUNT(*) AS n FROM workouts').get() as any).n === 0, 'reddedilen antrenman yazılmadı');

  // ── bugün dahil; bitiş şimdiden ileri olamaz
  const todayId = await createHistoryWorkout(db, { routineId: null, startedAt: now - 30 * 60_000, durationMin: 120, now });
  const tw = raw.prepare('SELECT * FROM workouts WHERE id = ?').get(todayId) as any;
  assert(tw.finished_at != null && tw.finished_at <= now && tw.started_at === now - 30 * 60_000, 'bugün eklenebilir, finished_at dolu ve şimdiyi aşmaz');
  await finalizeHistoryEdit(db, todayId, undefined, { dropIfEmpty: true });
  assert(!raw.prepare('SELECT id FROM workouts WHERE id = ?').get(todayId), 'boş yeni antrenman (dropIfEmpty) atılır');

  // ── rutinden: set sayısıyla boş gelir; boş setler temizlenir
  await saveRoutine(db, null, 'Push', [
    { exercise_id: bench, target_sets: 3, rep_min: 5, rep_max: 8, rest_seconds: null } as any,
    { exercise_id: squat, target_sets: 2, rep_min: 5, rep_max: 8, rest_seconds: null } as any,
  ]);
  const rid = (raw.prepare("SELECT id FROM routines WHERE name = 'Push'").get() as any).id;
  const past = await createHistoryWorkout(db, { routineId: rid, startedAt: day(10), durationMin: 50, now });
  assert(setsOf(past).length === 5, 'rutin set sayısı kadar boş set (3+2)');
  const [s1] = setsOf(past);
  await editHistorySet(db, s1, { weight: 100, reps: 5 });
  const r = await finalizeHistoryEdit(db, past, { name: 'Push', note: null }, { dropIfEmpty: true });
  assert(!r.deleted, 'dolu antrenman silinmez');
  assert(setsOf(past).length === 1, 'boş kalan setler temizlendi (1 set kaldı)');
  assert((raw.prepare('SELECT COUNT(*) AS n FROM workout_exercises WHERE workout_id = ?').get(past) as any).n === 1, 'setsiz kalan egzersiz çıkarıldı');
  assert(raw.prepare('SELECT finished_at FROM workouts WHERE id = ?').get(past) && (raw.prepare('SELECT finished_at f FROM workouts WHERE id = ?').get(past) as any).f === day(10) + 50 * 60_000, 'süre = bitiş − başlangıç');

  // ── PR yeniden hesabı TARİH SIRASINA göre
  // 12 Kasım'da 110x5, sonra (geriye) 8 Kasım'a 120x5 ekle → 12 Kasım artık rekor olmamalı, 8 Kasım olmalı
  const w12 = await createHistoryWorkout(db, { routineId: null, startedAt: day(12), durationMin: 60, now });
  const we12 = await addHistoryExercise(db, w12, bench);
  const [a12] = setsOf(w12);
  await editHistorySet(db, a12, { weight: 110, reps: 5 });
  await finalizeHistoryEdit(db, w12);
  // bench: 10 Kasım 100x5 (past, rekor değil — ilk set best=0 → pr 0), 12 Kasım 110x5 → rekor
  assert(JSON.stringify(prFlags(bench)) === '[0,1]', `10 Kasım ilk (rekor değil), 12 Kasım rekor (${JSON.stringify(prFlags(bench))})`);
  const w8 = await createHistoryWorkout(db, { routineId: null, startedAt: day(8), durationMin: 60, now });
  await addHistoryExercise(db, w8, bench);
  const [a8] = setsOf(w8);
  await editHistorySet(db, a8, { weight: 120, reps: 5 });
  await finalizeHistoryEdit(db, w8);
  // sıra: 8 Kasım 120x5 (ilk, rekor değil), 10 Kasım 100x5 (değil), 12 Kasım 110x5 (değil — 120 daha yüksek)
  assert(JSON.stringify(prFlags(bench)) === '[0,0,0]', `geriye eklenen güçlü set sonraki rekorları geçersiz kılar (${JSON.stringify(prFlags(bench))})`);
  // geri al: set sil → 12 Kasım yeniden rekor
  await editHistorySet(db, a8, { weight: 90, reps: 5 });
  assert(JSON.stringify(prFlags(bench)) === '[0,1,1]', `düşük set → 10 Kasım (100>90) ve 12 Kasım rekor (${JSON.stringify(prFlags(bench))})`);
  void we12;

  // ── aynı güne ikinci antrenman
  const second = await createHistoryWorkout(db, { routineId: null, startedAt: day(12, 8), durationMin: 30, now });
  assert(second !== w12, 'aynı güne ikinci antrenman eklenebilir');
  const between = await workoutsBetween(db, startOfDay(day(12)), startOfDay(day(13)));
  assert(between.length === 2, 'takvim sorgusu o günün 2 antrenmanını verir');

  // ── plan uyumu: geçmişe eklenen antrenman o günü "yapıldı" yapar (workoutsBetween üzerinden)
  assert(between.some((w: any) => w.started_at === day(12)), 'plan uyumu kaynağı (workoutsBetween) geçmiş antrenmanı içerir');

  // ── önceki sütunu kendinden ESKİ seansı gösterir (geçmiş antrenman düzenlenirken)
  const d10 = await getWorkoutDetail(db, past);
  const benchEx = d10!.exercises.find((e) => e.exercise_id === bench)!;
  assert(benchEx.previous.length === 1 && benchEx.previous[0].weight === 90, 'önceki = 8 Kasım (kendinden eski), 12 Kasım değil');

  // ── tekrar eden egzersiz: iki kopya aktif antrenmanda
  const wid = await startWorkout(db, null);
  await addExercisesToWorkout(db, wid, [bench, bench]);
  assert((await getWorkoutExerciseIds(db, wid)).length === 1, 'getWorkoutExerciseIds tekil kimlik döner');
  const det = await getWorkoutDetail(db, wid);
  const copies = det!.exercises.filter((e) => e.exercise_id === bench);
  assert(copies.length === 2, 'iki kopya birlikte yaşar');
  assert(copies[0].previous.length === copies[1].previous.length && copies[0].previous.length > 0, 'iki kopyanın önceki sütunu aynı ve dolu');
  assert(copies[0].suggestion.weight === copies[1].suggestion.weight && copies[0].suggestion.weight != null, 'öneri iki kopyada tutarlı');
  // iki kopyada set tamamlayınca PR hesabı bozulmaz
  const cs = raw.prepare('SELECT s.id FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id WHERE we.workout_id = ? ORDER BY we.position, s.position').all(wid).map((x: any) => x.id as number);
  const { toggleSetDone, updateSetValues } = await import('@/db/queries');
  await updateSetValues(db, cs[0], { weight: 130, reps: 5 });
  await updateSetValues(db, cs[3], { weight: 125, reps: 5 });
  const p1 = await toggleSetDone(db, cs[0], true, 90, Date.now());
  const p2 = await toggleSetDone(db, cs[3], true, 90, Date.now() + 1000);
  assert(p1 === true && p2 === false, 'PR: ilk kopya 130 rekor, ikinci kopyadaki 125 rekor değil');
  // ── antrenman silinince PR bayrakları yeniden hesaplanır
  const { raw: r2, db: d2 } = await freshDb();
  const ex2 = Number((r2.prepare("SELECT id FROM exercises WHERE kind = 'strength' LIMIT 1").get() as any).id);
  const wA = await createHistoryWorkout(d2, { routineId: null, startedAt: day(5), durationMin: 60, now });
  await addHistoryExercise(d2, wA, ex2);
  await editHistorySet(d2, (r2.prepare('SELECT s.id FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id WHERE we.workout_id = ?').get(wA) as any).id, { weight: 100, reps: 5 });
  const wB = await createHistoryWorkout(d2, { routineId: null, startedAt: day(9), durationMin: 60, now });
  await addHistoryExercise(d2, wB, ex2);
  await editHistorySet(d2, (r2.prepare('SELECT s.id FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id WHERE we.workout_id = ?').get(wB) as any).id, { weight: 120, reps: 5 });
  const flags = () => r2.prepare('SELECT s.is_pr p FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id JOIN workouts w ON w.id = we.workout_id ORDER BY w.started_at').all().map((x: any) => x.p).join();
  assert(flags() === '0,1', `önce 100, sonra 120 → yenisi rekor (${flags()})`);
  const { deleteWorkout } = await import('@/db/queries');
  await deleteWorkout(d2, wA);
  assert(flags() === '0', `eski antrenman silinince yeni antrenmanın bayrağı düşer (${flags()})`);
  await deleteWorkout(d2, wB);
  assert(flags() === '', 'hepsi silindi');
  console.log('PAST-WORKOUT TESTS OK');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
