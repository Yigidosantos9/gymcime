import { DatabaseSync } from 'node:sqlite';
import { migrateDb } from '@/db/migrate';
import * as q from '@/db/queries';
const raw = new DatabaseSync(':memory:');
const norm = (p: any[]) => (p.length === 1 && Array.isArray(p[0]) ? p[0] : p);
const db: any = {
  execAsync: async (s: string) => raw.exec(s),
  runAsync: async (s: string, ...p: any[]) => { const r = raw.prepare(s).run(...norm(p)); return { lastInsertRowId: Number(r.lastInsertRowid) }; },
  getFirstAsync: async (s: string, ...p: any[]) => raw.prepare(s).get(...norm(p)) ?? null,
  getAllAsync: async (s: string, ...p: any[]) => raw.prepare(s).all(...norm(p)),
  withTransactionAsync: async (fn: any) => { raw.exec('BEGIN'); try { await fn(); raw.exec('COMMIT'); } catch (e) { raw.exec('ROLLBACK'); throw e; } },
};
const assert = (c: any, m: string) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };
(async () => {
  await migrateDb(db);
  const ex = await q.listExercises(db);
  const by = (slug: string) => ex.find((e) => e.slug === slug)!;
  assert(by('lateral').name === 'Lateral Raise' && by('lateral').alias === 'Yana Açış', 'İngilizce ad + Türkçe takma ad');
  assert(by('rdl').name === 'Romanian Deadlift' && by('db-row').name === 'One-Arm Dumbbell Row', 'diğer adlar');
  const custom = await q.createExercise(db, 'Benim Hareketim', 'Göğüs', 'Makine');
  await migrateDb(db);
  assert((await q.getExercise(db, custom))!.name === 'Benim Hareketim', 'özel egzersiz adı korunur');

  const bench = by('bench').id;
  // 3 seans geçmiş
  for (let i = 0; i < 3; i++) {
    const w = await q.startWorkout(db, null);
    await q.addExercisesToWorkout(db, w, [bench]);
    const d = (await q.getWorkoutDetail(db, w))!;
    const sets = d.exercises[0].sets;
    for (const s of sets) {
      await q.updateSetValues(db, s.id, { weight: 60 + i * 2.5, reps: 12 });
      await q.toggleSetDone(db, s.id, true, 90);
      await q.setSetRir(db, s.id, 2);
    }
    await q.finishWorkout(db, w);
    raw.prepare('UPDATE workouts SET started_at = ? WHERE id = ?').run(Date.now() - (3 - i) * 3 * 86400000, w);
  }
  const w = await q.startWorkout(db, null);
  await q.addExercisesToWorkout(db, w, [bench]);
  const hist = await q.recentSessions(db, bench, w, 4);
  assert(hist.length === 3 && hist[0].sets[0].weight === 65 && hist[0].sets[0].rir === 2, `son seanslar en yeni başta (${hist.map((h) => h.sets[0].weight)})`);
  let d = (await q.getWorkoutDetail(db, w, { goal: 'Kas kazanmak', increments: { barbell: 5, dumbbell: 2, machine: 2.5 } }))!;
  const sug = d.exercises[0].suggestion;
  assert(sug.kind === 'increase' && sug.weight === 70 && sug.confidence === 'high', `öneri profil adımıyla (+5): ${sug.weight} ${sug.confidence}`);
  assert(d.exercises[0].previous.length === 3 && d.exercises[0].previous.every((p) => p.weight === 65), 'önceki sütunu son seans');
  await q.addWarmupSets(db, d.exercises[0].id, sug.warmups);
  d = (await q.getWorkoutDetail(db, w))!;
  const sets = d.exercises[0].sets;
  assert(sets.length === 3 + sug.warmups.length && sets.slice(0, sug.warmups.length).every((s) => s.set_type === 'warmup' && s.weight! > 0), 'ısınmalar başa, dolu');
  assert(sets.map((s) => s.position).join() === sets.map((_, i) => i).join(), 'pozisyonlar sıralı');
  await q.setSetRir(db, sets[3].id, null);
  assert((await q.getWorkoutDetail(db, w))!.exercises[0].sets[3].rir === null, 'RIR temizlenir');
  const p = await q.getProfile(db);
  assert(p === null, 'profil yok');
  await q.saveProfile(db, { name: 'a', goal: 'Güçlenmek', experience: 'Orta', daysPerWeek: 4, restSeconds: 90 } as any);
  const p2 = (await q.getProfile(db))!;
  assert(p2.soundOn === true && p2.hapticOn === true && p2.incBarbell === 2.5 && p2.incDumbbell === 2, 'eski profil yeni alanlara varsayılan alır');
  console.log('\nv3 TESTLERİ GEÇTİ');
})().catch((e) => { console.error(e); process.exit(1); });
