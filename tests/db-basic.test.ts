import { DatabaseSync } from 'node:sqlite';
import { migrateDb } from '@/db/migrate';
import * as q from '@/db/queries';
import { suggestNext } from '@/lib/progression';

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
  const db = wrap(new DatabaseSync(':memory:'));
  await migrateDb(db); await migrateDb(db);
  const ex = await q.listExercises(db);
  assert(ex.length > 60, `seed egzersizler (${ex.length})`);
  assert((await q.getProfile(db)) === null, 'profil başta yok');
  await q.saveProfile(db, { name: 'Test', goal: 'Kas kazanmak', experience: 'Orta', daysPerWeek: 4, restSeconds: 90 });
  await q.createRoutinesFromTemplate(db, 'upperlower');
  const routines = await q.listRoutines(db);
  assert(routines.length === 2 && routines[0].exercise_count === 6, 'şablon rutinler');

  // 1. antrenman
  const w1 = await q.startWorkout(db, routines[0].id);
  assert((await q.startWorkout(db, null)) === w1, 'aktif varken yeni başlamıyor');
  let d = (await q.getWorkoutDetail(db, w1))!;
  assert(d.exercises.length === 6 && d.exercises[0].sets.length === 4, 'rutin set sayıları');
  assert(d.exercises[0].suggestion.kind === 'start', 'ilk seferde start önerisi');
  const bench = d.exercises[0];
  for (const s of bench.sets) { await q.updateSetValues(db, s.id, { weight: 60, reps: 10 }); await q.toggleSetDone(db, s.id, true); }
  assert(await q.finishWorkout(db, w1), 'bitir');
  const sum = (await q.getWorkoutSummary(db, w1))!;
  assert(sum.setCount === 4 && sum.volume === 2400 && sum.prs.length === 0 && sum.workoutNumber === 1, `özet ${JSON.stringify(sum)}`);
  d = (await q.getWorkoutDetail(db, w1))!;
  assert(d.exercises.length === 1, 'tamamlanmamış egzersizler temizlendi');

  // 2. antrenman: öneri + PR
  const w2 = await q.startWorkout(db, routines[0].id);
  d = (await q.getWorkoutDetail(db, w2))!;
  const b2 = d.exercises[0];
  assert(b2.previous.length === 4 && b2.previous[0].weight === 60, 'önceki setler geldi');
  assert(b2.suggestion.kind === 'increase' && b2.suggestion.weight === 62.5 && b2.suggestion.reps === 6, `artış önerisi: ${JSON.stringify(b2.suggestion)}`);
  await q.updateSetValues(db, b2.sets[0].id, { weight: 65, reps: 10 });
  assert(await q.toggleSetDone(db, b2.sets[0].id, true), 'PR algılandı');
  await q.updateSetValues(db, b2.sets[1].id, { weight: 50, reps: 5 });
  assert(!(await q.toggleSetDone(db, b2.sets[1].id, true)), 'PR değil');
  await q.addExercisesToWorkout(db, w2, [ex[5].id]);
  await q.finishWorkout(db, w2);
  const s2 = (await q.getWorkoutSummary(db, w2))!;
  assert(s2.prs.length === 1 && s2.workoutNumber === 2, 'PR özette');

  const list = await q.listWorkouts(db);
  assert(list.length === 2 && list[0].pr_count === 1 && !!list[0].exercise_names, 'geçmiş listesi');
  const hist = await q.exerciseHistory(db, bench.exercise_id);
  assert(hist.length === 2 && Math.abs(hist[1].best1rm - 65 * (1 + 10 / 30)) < 0.01, 'egzersiz geçmişi 1RM');
  const stats = await q.getHomeStats(db);
  assert(stats.total === 2 && stats.weekCount === 2 && stats.weekStreak === 1, `ana sayfa istatistik ${JSON.stringify({ ...stats, daysDone: [...stats.daysDone] })}`);
  const wv = await q.weeklyVolume(db, 8);
  assert(wv.length === 8 && wv[7].volume === 2400 + 650 + 250, `haftalık hacim ${wv[7].volume}`);
  // arayüzde hacim yok: haftalık çalışma seti (ısınma hariç), en çok tekrar ve liste set sayısı
  assert(wv[7].sets === 6 && wv[7].workouts === 2 && wv[6].sets === 0, `haftalık çalışma seti ${wv[7].sets}`);
  assert(hist[0].max_reps === 10 && hist[1].max_reps === 10, `egzersiz geçmişi en çok tekrar ${hist[1].max_reps}`);
  assert(list[0].set_count === 2 && list[1].set_count === 4, `liste set sayısı ${list[0].set_count}/${list[1].set_count}`);
  assert((await q.muscleSets(db, 7))[0].muscle === 'Göğüs', 'kas setleri');
  assert((await q.topExercises(db)).length === 1, 'top egzersizler');

  // boş antrenman siliniyor
  const w3 = await q.startWorkout(db, null);
  assert(!(await q.finishWorkout(db, w3)) && (await q.getActiveWorkout(db)) === null, 'boş antrenman silindi');

  // ilerleme motoru
  assert(suggestNext([{ weight: 60, reps: 12 }, { weight: 60, reps: 12 }], 8, 12, 'Halter').weight === 62.5, '+2.5 kg');
  assert(suggestNext([{ weight: 60, reps: 4 }], 8, 12, 'Halter').kind === 'decrease', 'hafiflet');
  assert(suggestNext([{ weight: null, reps: 10 }], 8, 12, 'Vücut').reps === 11, 'vücut ağırlığı +1 tekrar');

  await q.saveRoutine(db, null, 'Yeni', []);
  await q.deleteRoutine(db, routines[0].id);
  assert((await q.listWorkouts(db)).length === 2, 'rutin silinince geçmiş kalıyor');
  await q.deleteAllData(db);
  assert((await q.getProfile(db)) === null && (await q.listExercises(db)).length > 60, 'verileri sıfırla');
  console.log('\nTÜM TESTLER GEÇTİ');
})().catch((e) => { console.error(e); process.exit(1); });
