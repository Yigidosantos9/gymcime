import { DB_VERSION } from '@/db/migrate';
import { DatabaseSync } from 'node:sqlite';
import { migrateDb } from '@/db/migrate';
import * as q from '@/db/queries';
import { restAfter, baseRest } from '@/lib/rest';

function wrap(raw: DatabaseSync): any {
  const norm = (p: any[]) => (p.length === 1 && Array.isArray(p[0]) ? p[0] : p);
  return {
    execAsync: async (s: string) => raw.exec(s),
    runAsync: async (s: string, ...p: any[]) => { const r = raw.prepare(s).run(...norm(p)); return { lastInsertRowId: Number(r.lastInsertRowid), changes: r.changes }; },
    getFirstAsync: async (s: string, ...p: any[]) => raw.prepare(s).get(...norm(p)) ?? null,
    getAllAsync: async (s: string, ...p: any[]) => raw.prepare(s).all(...norm(p)),
    withTransactionAsync: async (fn: () => Promise<void>) => { raw.exec('BEGIN'); try { await fn(); raw.exec('COMMIT'); } catch (e) { raw.exec('ROLLBACK'); throw e; } },
  };
}
const assert = (c: any, m: string) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };

(async () => {
  // v1 → v2 yükseltme: v1 şemasıyla veri oluştur, sonra migrate
  const raw = new DatabaseSync(':memory:');
  const db = wrap(raw);
  await migrateDb(db);
  const v = raw.prepare('PRAGMA user_version').get() as any;
  assert(v.user_version === DB_VERSION, 'şema v3');
  const squat = (await q.listExercises(db)).find((e) => e.slug === 'squat')!;
  const curl = (await q.listExercises(db)).find((e) => e.slug === 'db-curl')!;
  const plank = (await q.listExercises(db)).find((e) => e.slug === 'plank')!;
  assert(squat.rest_seconds === 180 && curl.rest_seconds === 75 && plank.rest_seconds === null, 'egzersiz varsayılan molaları');

  // rest yardımcıları
  assert(restAfter(180, 'warmup') === 90 && restAfter(60, 'warmup') === 30 && restAfter(120, 'drop') === 0 && restAfter(120, 'failure') === 150, 'set tipine göre mola');
  assert(baseRest(null, 180, 90) === 180 && baseRest(100, 180, 90) === 100 && baseRest(null, null, 90) === 90, 'mola önceliği');

  // rutin: squat için rutine özel 150 sn
  const rid = await q.saveRoutine(db, null, 'Bacak', [
    { exercise_id: squat.id, name: '', muscle: '', equipment: '', target_sets: 2, rep_min: 5, rep_max: 8, rest_seconds: 150 },
    { exercise_id: curl.id, name: '', muscle: '', equipment: '', target_sets: 2, rep_min: 10, rep_max: 15, rest_seconds: null },
  ]);
  const r = (await q.getRoutine(db, rid))!;
  assert(r.items[0].rest_seconds === 150 && r.items[1].rest_seconds === null && r.items[1].default_rest === 75, 'rutin mola alanları');

  const w = await q.startWorkout(db, rid);
  let d = (await q.getWorkoutDetail(db, w))!;
  assert(d.exercises[0].rest_seconds === 150 && d.exercises[0].exercise_rest === 180, 'antrenmana rutin molası kopyalandı');

  // ısınma seti başa eklenir
  await q.addSet(db, d.exercises[0].id, 'warmup');
  d = (await q.getWorkoutDetail(db, w))!;
  const sq = d.exercises[0];
  assert(sq.sets.length === 3 && sq.sets[0].set_type === 'warmup' && sq.sets[0].position === 0, 'ısınma seti başta');

  // mola ölçümü: t0 ısınma, t0+100 sn set1, t0+260 sn set2
  const t0 = 1_700_000_000_000;
  await q.updateSetValues(db, sq.sets[0].id, { weight: 40, reps: 10 });
  await q.toggleSetDone(db, sq.sets[0].id, true, 90, t0);
  await q.updateSetValues(db, sq.sets[1].id, { weight: 100, reps: 6 });
  await q.toggleSetDone(db, sq.sets[1].id, true, 90, t0 + 100_000);
  await q.updateSetValues(db, sq.sets[2].id, { weight: 100, reps: 6 });
  await q.toggleSetDone(db, sq.sets[2].id, true, 90, t0 + 260_000);
  d = (await q.getWorkoutDetail(db, w))!;
  const [w0, s1, s2] = d.exercises[0].sets;
  assert(w0.rest_taken === null, 'ilk sette mola yok');
  assert(s1.rest_taken === 100 && s1.rest_target === 75, `ısınmadan sonra hedef yarıya iner (150→75): ${s1.rest_target}`);
  assert(s2.rest_taken === 160 && s2.rest_target === 150, 'normal set sonrası hedef 150');

  // drop set sonrası mola hedefi 0 → ölçülmez
  await q.setSetType(db, d.exercises[1].sets[0].id, 'drop');
  await q.updateSetValues(db, d.exercises[1].sets[0].id, { weight: 14, reps: 12 });
  await q.toggleSetDone(db, d.exercises[1].sets[0].id, true, 90, t0 + 400_000);
  await q.updateSetValues(db, d.exercises[1].sets[1].id, { weight: 10, reps: 12 });
  await q.toggleSetDone(db, d.exercises[1].sets[1].id, true, 90, t0 + 410_000);
  d = (await q.getWorkoutDetail(db, w))!;
  assert(d.exercises[1].sets[0].rest_taken === 140 && d.exercises[1].sets[0].rest_target === 150, 'egzersiz değişiminde mola ölçümü');
  assert(d.exercises[1].sets[1].rest_taken === null, 'drop setten sonra mola ölçülmez');

  // geri alınca mola temizlenir
  await q.toggleSetDone(db, d.exercises[1].sets[1].id, false);
  d = (await q.getWorkoutDetail(db, w))!;
  assert(d.exercises[1].sets[1].rest_taken === null && !d.exercises[1].sets[1].done, 'geri alma');
  await q.toggleSetDone(db, d.exercises[1].sets[1].id, true, 90, t0 + 410_000);

  // uzun boşluk (20 dk) ölçülmez
  await q.addSet(db, d.exercises[1].id);
  d = (await q.getWorkoutDetail(db, w))!;
  const last = d.exercises[1].sets[2];
  await q.updateSetValues(db, last.id, { weight: 10, reps: 10 });
  await q.toggleSetDone(db, last.id, true, 90, t0 + 410_000 + 20 * 60_000);
  d = (await q.getWorkoutDetail(db, w))!;
  assert(d.exercises[1].sets[2].rest_taken === null, '15 dk üstü boşluk mola sayılmaz');

  await q.finishWorkout(db, w);
  const sum = (await q.getWorkoutSummary(db, w))!;
  assert(sum.restAvgTaken === Math.round((100 + 160 + 140) / 3) && sum.restAvgTarget === Math.round((75 + 150 + 150) / 3), `özet mola ort. ${sum.restAvgTaken}/${sum.restAvgTarget}`);
  assert(sum.muscles.find((m) => m.muscle === 'Bacak')?.sets === 2, 'özet kaslar ısınmayı saymaz');

  // ısınma rekora sayılmaz; önceki setlerde ısınma yok sayılır
  const w2 = await q.startWorkout(db, rid);
  let d2 = (await q.getWorkoutDetail(db, w2))!;
  assert(d2.exercises[0].previous.length === 2 && d2.exercises[0].previous.every((p) => p.weight === 100), 'önceki setler ısınmayı içermez');
  await q.addSet(db, d2.exercises[0].id, 'warmup');
  d2 = (await q.getWorkoutDetail(db, w2))!;
  await q.updateSetValues(db, d2.exercises[0].sets[0].id, { weight: 200, reps: 10 });
  assert(!(await q.toggleSetDone(db, d2.exercises[0].sets[0].id, true, 90)), 'ısınma seti rekor olmaz');
  await q.updateSetValues(db, d2.exercises[0].sets[1].id, { weight: 105, reps: 6 });
  assert(await q.toggleSetDone(db, d2.exercises[0].sets[1].id, true, 90), 'normal set rekor');
  await q.finishWorkout(db, w2);

  const rs = await q.restStats(db, 100000);
  assert(Array.isArray(rs), 'mola istatistiği sorgusu çalışıyor');
  assert((await q.recentPrCount(db, 100000)) >= 1, 'rekor sayısı');

  // workout rest override + egzersiz varsayılanı
  const w3 = await q.startWorkout(db, null);
  await q.addExercisesToWorkout(db, w3, [plank.id]);
  const d3 = (await q.getWorkoutDetail(db, w3))!;
  await q.setWorkoutExerciseRest(db, d3.exercises[0].id, 45);
  await q.setExerciseDefaultRest(db, plank.id, 60);
  const d3b = (await q.getWorkoutDetail(db, w3))!;
  assert(d3b.exercises[0].rest_seconds === 45 && d3b.exercises[0].exercise_rest === 60, 'mola ayarları kaydediliyor');
  console.log('\nTÜM v2 TESTLERİ GEÇTİ');
})().catch((e) => { console.error(e); process.exit(1); });
