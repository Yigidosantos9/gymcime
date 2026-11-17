import { DatabaseSync } from 'node:sqlite';

import { exportBackup, importBackup, parseBackup } from '@/db/backup';
import { SEED_EXERCISES } from '@/db/seed';
import * as q from '@/db/queries';
import { addWorkout, assert, freshDb } from './helpers';

async function exId(db: any, slug: string): Promise<number> {
  return (await db.getFirstAsync('SELECT id FROM exercises WHERE slug = ?', slug)).id;
}

(async () => {
  // ───── 1. Boş tamamlanmış set istatistikleri bozmaz, çıkışta temizlenir ─────
  {
    const { raw, db } = await freshDb();
    const bench = await exId(db, 'bench');
    const squat = await exId(db, 'squat');
    const now = Date.now();
    const a = addWorkout(raw, bench, now - 5 * 86400000, [[100, 5]]);
    const b = addWorkout(raw, bench, now - 3 * 86400000, [[105, 5]]);
    const before = {
      muscleSets: JSON.stringify(await q.muscleSets(db, 30)),
      last: JSON.stringify(await q.muscleLastTrained(db)),
      list: (await q.listWorkouts(db)).map((w) => w.set_count).join(','),
    };
    // geçmiş antrenmana egzersiz ekle: boş tamamlanmış set gelir
    await q.addHistoryExercise(db, b.workoutId, squat);
    assert(JSON.stringify(await q.muscleSets(db, 30)) === before.muscleSets, 'muscleSets boş seti saymıyor');
    assert(JSON.stringify(await q.muscleLastTrained(db)) === before.last, 'muscleLastTrained boş seti saymıyor');
    assert((await q.listWorkouts(db)).map((w) => w.set_count).join(',') === before.list, 'listWorkouts set_count boş seti saymıyor');
    assert((await q.exerciseHistory(db, squat)).length === 0 && !(await q.topExercises(db, 10)).some((e) => e.id === squat), 'exerciseHistory/topExercises boş seti saymıyor');
    // squat'ın yalnızca boş seti olan geçmiş seansı recentSessions kotasını/önerisini bozmaz
    const cur = Number(raw.prepare("INSERT INTO workouts (name, started_at) VALUES ('Aktif', ?)").run(now).lastInsertRowid);
    assert((await q.recentSessions(db, squat, cur)).length === 0, 'yalnızca boş seti olan seans geçmişe sayılmaz');
    // limit kotası: 4 gerçek seans + 1 boş seans → 4 gerçek seans dönmeli
    for (let i = 0; i < 4; i++) addWorkout(raw, squat, now - (20 - i) * 86400000, [[80 + i, 5]]);
    await q.addHistoryExercise(db, (await db.getFirstAsync('SELECT id FROM workouts ORDER BY started_at DESC LIMIT 1 OFFSET 1')).id, squat);
    const rs = await q.recentSessions(db, squat, cur, 4);
    assert(rs.length === 4 && rs.every((s) => s.sets.length === 1 && s.sets[0].reps), 'boş seans limit kotasını yemiyor');

    // çıkışta temizlik + PR yeniden hesabı
    const ex = raw.prepare('SELECT id FROM workout_exercises WHERE workout_id = ? AND exercise_id = ?').get(b.workoutId, squat) as any;
    assert(!!ex, 'boş egzersiz eklendi');
    const firstSquat = (raw.prepare("SELECT s.id FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id JOIN workouts w ON w.id = we.workout_id WHERE we.exercise_id = ? AND s.reps > 0 ORDER BY w.started_at LIMIT 1").get(squat) as any).id;
    raw.prepare('UPDATE sets SET is_pr = 1 WHERE id = ?').run(firstSquat); // bayat PR bayrağı
    await q.finalizeHistoryEdit(db, b.workoutId, { name: 'Yeni', note: 'n' });
    const d = (await q.getWorkoutDetail(db, b.workoutId))!;
    assert(d.exercises.length === 1 && d.exercises[0].exercise_id === bench, 'boş set ve setsiz egzersiz silindi');
    assert(d.workout.name === 'Yeni' && d.workout.note === 'n', 'başlık/not da kaydedildi');
    assert((raw.prepare('SELECT is_pr FROM sets WHERE id = ?').get(firstSquat) as any).is_pr === 0 && a.setIds.length === 1, 'PR bayrakları yeniden hesaplandı');
    // değerli sete dokunmaz
    await q.addHistorySet(db, b.weId);
    raw.prepare('UPDATE sets SET weight = NULL, reps = NULL WHERE id = ?').run(b.setIds[0]);
    await q.finalizeHistoryEdit(db, b.workoutId);
    const left = raw.prepare('SELECT weight, reps FROM sets WHERE workout_exercise_id = ?').all(b.weId) as any[];
    assert(left.length === 1 && left[0].weight === 105 && left[0].reps === 5, 'dolu set korunur');
    // yalnızca tekrar (vücut ağırlığı) olan set korunur
    const bw = addWorkout(raw, await exId(db, 'pushup'), now - 86400000, [[0, 15]]);
    await q.finalizeHistoryEdit(db, bw.workoutId);
    assert((raw.prepare('SELECT COUNT(*) n FROM sets WHERE workout_exercise_id = ?').get(bw.weId) as any).n === 1, 'vücut ağırlığı seti (0 kg × 15) korunur');
  }

  // ───── 2. Eski şemalı yedek: veri migrasyonları uygulanır ─────
  {
    const { raw, db } = await freshDb();
    const bench = await exId(db, 'bench');
    const lateral = await exId(db, 'lateral');
    const custom = await q.createExercise(db, 'Özel', 'Sırt', 'Kablo');
    await q.setExerciseDefaultRest(db, custom, 33);
    const good = await exportBackup(db, 1);
    // v1 yedeği simülasyonu: v2/v3 sütun değerleri yok
    const old = JSON.parse(JSON.stringify(good));
    old.schemaVersion = 1;
    for (const e of old.tables.exercises) {
      if (e.is_custom === 0) {
        e.name = 'Eski Türkçe Ad';
        delete e.alias;
        delete e.rest_seconds;
      }
    }
    for (const t of ['exercise_guides', 'foods', 'food_logs']) old.tables[t] = [];
    await importBackup(db, parseBackup(JSON.stringify(old)));
    const row = async (id: number) => (await db.getFirstAsync('SELECT name, alias, rest_seconds FROM exercises WHERE id = ?', id)) as any;
    const seedBench = SEED_EXERCISES.find((s) => s[0] === 'bench')!;
    const b = await row(bench);
    assert(b.name === seedBench[1] && b.alias === seedBench[2], 'v1 yedeği: İngilizce ad + alias uygulandı');
    assert(b.rest_seconds === 180 && (await row(lateral)).rest_seconds === 75, 'v1 yedeği: varsayılan dinlenme uygulandı');
    const c = await row(custom);
    assert(c.name === 'Özel' && c.rest_seconds === 33, 'özel egzersize dokunulmadı');
    // güncel sürüm yedeğinde migrasyon çalışmaz (özelleştirilmiş dinlenme korunur)
    await q.setExerciseDefaultRest(db, bench, 77);
    await importBackup(db, parseBackup(JSON.stringify(await exportBackup(db, 1))));
    assert((await row(bench)).rest_seconds === 77, 'güncel yedekte özelleştirilmiş dinlenme korunur');
  }

  // ───── 3. importBackup özel (exclusive) transaction kullanır ve geri alınabilir ─────
  {
    const { raw, db } = await freshDb();
    let exclusive = 0;
    const orig = db.withExclusiveTransactionAsync;
    db.withExclusiveTransactionAsync = (fn: any) => (exclusive++, orig(fn));
    const bench = await exId(db, 'bench');
    addWorkout(raw, bench, 1, [[50, 5]]);
    const good = await exportBackup(db, 1);
    await importBackup(db, parseBackup(JSON.stringify(good)));
    assert(exclusive === 1, 'withExclusiveTransactionAsync kullanıldı');
    const bad = JSON.parse(JSON.stringify(good));
    bad.tables.body_weights = [{ id: 1, measured_at: 1, weight: [1] }];
    let failed = false;
    try { await importBackup(db, parseBackup(JSON.stringify(bad))); } catch { failed = true; }
    assert(failed && (await q.listWorkouts(db)).length === 1, 'hata → geri alındı');
  }

  console.log('\nGÖREV 0 DÜZELTME TESTLERİ GEÇTİ');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
