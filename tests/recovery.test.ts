import { DatabaseSync } from 'node:sqlite';
import { migrateDb } from '@/db/migrate';
import * as q from '@/db/queries';
import { computeRecovery, fatigueValues, restingMuscles } from '@/lib/recovery';
const assert = (c: any, m: string) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };
const raw = new DatabaseSync(':memory:');
const norm = (p: any[]) => (p.length === 1 && Array.isArray(p[0]) ? p[0] : p);
const db: any = {
  execAsync: async (s: string) => raw.exec(s),
  runAsync: async (s: string, ...p: any[]) => { const r = raw.prepare(s).run(...norm(p)); return { lastInsertRowId: Number(r.lastInsertRowid) }; },
  getFirstAsync: async (s: string, ...p: any[]) => raw.prepare(s).get(...norm(p)) ?? null,
  getAllAsync: async (s: string, ...p: any[]) => raw.prepare(s).all(...norm(p)),
  withTransactionAsync: async (fn: any) => { raw.exec('BEGIN'); try { await fn(); raw.exec('COMMIT'); } catch (e) { raw.exec('ROLLBACK'); throw e; } },
};
(async () => {
  await migrateDb(db);
  const ex = await q.listExercises(db);
  const id = (slug: string) => ex.find((e) => e.slug === slug)!.id;
  const D = 86400000, now = Date.now();
  async function session(daysAgo: number, slugs: string[], warmupOnly = false) {
    const w = await q.startWorkout(db, null);
    await q.addExercisesToWorkout(db, w, slugs.map(id));
    const d = (await q.getWorkoutDetail(db, w))!;
    for (const e of d.exercises) for (const s of e.sets) {
      if (warmupOnly) await q.setSetType(db, s.id, 'warmup');
      await q.updateSetValues(db, s.id, { weight: 50, reps: 10 });
      await q.toggleSetDone(db, s.id, true);
    }
    await q.finishWorkout(db, w);
    raw.prepare('UPDATE workouts SET started_at = ?, finished_at = ? WHERE id = ?').run(now - daysAgo * D, now - daysAgo * D + 3600000, w);
  }
  await session(5, ['bench', 'squat']);
  await session(1, ['bench']);
  await session(0, ['lat-pulldown']);
  await session(0, ['lateral'], true); // sadece ısınma → sayılmaz
  const rows = await q.muscleLastTrained(db);
  const g = rows.find((r) => r.muscle === 'Göğüs')!;
  assert(rows.length === 3 && g.sets === 3, `son çalışma: ${JSON.stringify(rows.map((r) => [r.muscle, r.sets]))}`);
  const rec = computeRecovery(rows, 2, now);
  const by = (m: string) => rec.find((r) => r.muscle === m)!;
  assert(by('Göğüs').daysRested === 1 && !by('Göğüs').ready && by('Göğüs').remaining === 1, 'göğüs dün → 1 gün daha');
  assert(by('Bacak').daysRested === 5 && by('Bacak').ready, 'bacak 5 gün → hazır');
  assert(by('Sırt').daysRested === 0 && by('Sırt').remaining === 2, 'sırt bugün → 2 gün daha');
  assert(by('Omuz').daysRested === null && by('Omuz').ready, 'omuz sadece ısınma → hiç çalışmamış sayılır');
  assert(!rec.some((r) => r.muscle === 'Kardiyo') && rec.length === 8, '8 kas grubu, kardiyo hariç');
  const fv = fatigueValues(rec, 2);
  assert(fv['Sırt'] === 1 && fv['Göğüs'] === 0.5 && fv['Bacak'] === undefined, `yorgunluk haritası ${JSON.stringify(fv)}`);
  assert(restingMuscles(['Göğüs', 'Bacak'], rec).map((r) => r.muscle).join() === 'Göğüs', 'rutindeki dinlenen kaslar');
  assert(computeRecovery(rows, 1, now).find((r) => r.muscle === 'Göğüs')!.ready, '1 gün ayarında göğüs hazır');
  const p = (await q.getProfile(db)) ?? null;
  assert(p === null, 'profil yok');
  await q.saveProfile(db, { name: 'x', goal: 'Kas kazanmak', experience: 'Orta', daysPerWeek: 3, restSeconds: 90 } as any);
  const p2 = (await q.getProfile(db))!;
  assert(p2.recoveryDays === 2 && p2.setStyle === 'auto', 'yeni profil alanları varsayılan');
  // getWorkoutDetail style
  const w = await q.startWorkout(db, null);
  await q.addExercisesToWorkout(db, w, [id('bench')]);
  let d = (await q.getWorkoutDetail(db, w, { setStyle: 'straight' }))!;
  assert(d.exercises[0].style === 'straight', 'ayar sabit → sabit');
  d = (await q.getWorkoutDetail(db, w, { setStyle: 'auto' }))!;
  assert(d.exercises[0].style === 'straight' && d.exercises[0].learnedReps[0] === 10, 'otomatik: geçmiş sabit (hep 50) → sabit, tekrar öğrenildi');
  console.log('TOPARLANMA TESTLERİ GEÇTİ');
})().catch((e) => { console.error(e); process.exit(1); });
