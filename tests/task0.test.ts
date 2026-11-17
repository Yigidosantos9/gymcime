import { DatabaseSync } from 'node:sqlite';

import { backupCounts, BackupError, BACKUP_TABLES, exportBackup, importBackup, parseBackup } from '@/db/backup';
import { DB_VERSION, migrateDb } from '@/db/migrate';
import { addFoodLog, addFoodLogs } from '@/db/nutrition-queries';
import * as q from '@/db/queries';
import { estimate1RM } from '@/lib/progression';
import { createRequestGate } from '@/lib/request-gate';
import { addWorkout, assert, freshDb, wrap } from './helpers';

async function exId(db: any, slug: string): Promise<number> {
  return (await db.getFirstAsync('SELECT id FROM exercises WHERE slug = ?', slug)).id;
}
const pr = (raw: DatabaseSync, id: number) => (raw.prepare('SELECT is_pr FROM sets WHERE id = ?').get(id) as any).is_pr as number;

(async () => {
  // ───── 1. PR / 1RM tutarlılığı (SQL ↔ estimate1RM) ─────
  {
    const { raw, db } = await freshDb();
    const bench = await exId(db, 'bench');
    for (const [w, r] of [[100, 1], [100, 5], [60, 12], [80, 0], [0, 5], [102.5, 3], [50, 30]] as [number, number][]) {
      const row = raw.prepare(`SELECT ${q.e1rmSql(String(w), String(r))} AS v`).get() as any;
      assert(Math.abs(row.v - estimate1RM(w, r)) < 1e-9, `SQL 1RM = estimate1RM (${w}×${r})`);
    }
    // geçmiş 100×1, bugün 103×1 → rekor (eski SQL 100×1'i 103.33 sayıp bunu kaçırıyordu)
    addWorkout(raw, bench, 1_000_000, [[100, 1]]);
    const today = addWorkout(raw, bench, 2_000_000, [[103, 1], [100, 1]]);
    raw.exec(`UPDATE sets SET done = 0 WHERE workout_exercise_id = ${today.weId}`);
    assert((await q.toggleSetDone(db, today.setIds[0], true)) === true, '100×1 geçmiş, 103×1 bugün → rekor');
    assert((await q.toggleSetDone(db, today.setIds[1], true)) === false, '100×1 tekrar → rekor değil');
    // 1 tekrar için eski SQL (w*(1+1/30)) 100×1'i 103.33 sayardı: 103×1 rekor olmazdı
    const hist = await q.exerciseHistory(db, bench);
    assert(hist[0].best1rm === 100, `exerciseHistory 1 tekrar için ağırlığın kendisi (${hist[0].best1rm})`);
    const top = await q.topExercises(db, 3);
    assert(top[0].best1rm === 103, 'topExercises aynı kural');
  }

  // ───── 2. foods ezilmez, AI kalemi foods'a girmez ─────
  {
    const { raw, db } = await freshDb();
    await addFoodLog(db, { day: 'd', meal: 'Öğle', name: 'Pilav', kcal: 200, protein: 4, carbs: 44, fat: 1, serving: '1 kase' }, 10);
    await addFoodLog(db, { day: 'd', meal: 'Akşam', name: 'pilav', kcal: 999, protein: 99, carbs: 99, fat: 99, serving: 'x' }, 20);
    const f = raw.prepare('SELECT * FROM foods').all() as any[];
    assert(f.length === 1 && f[0].kcal === 200 && f[0].protein === 4 && f[0].serving === '1 kase', 'çakışmada kayıtlı makrolar ezilmedi');
    assert(f[0].use_count === 2 && f[0].last_used === 20, 'use_count/last_used güncellendi');
    const logs = raw.prepare('SELECT kcal FROM food_logs ORDER BY id').all() as any[];
    assert(logs[1].kcal === 999, 'kayıt (food_logs) girilen değeri tutar');
    await addFoodLogs(db, [{ day: 'd', meal: 'Öğle', name: 'Tahmini tabak', kcal: 500, protein: 20, carbs: 50, fat: 20, source: 'ai' }], 30);
    assert((raw.prepare("SELECT COUNT(*) n FROM foods WHERE name = 'Tahmini tabak'").get() as any).n === 0, 'AI kalemi foods\'a yazılmadı');
    const ai = raw.prepare("SELECT food_id, source FROM food_logs WHERE name = 'Tahmini tabak'").get() as any;
    assert(ai.food_id === null && ai.source === 'ai', 'AI kalemi yalnızca food_logs\'ta');
  }

  // ───── 3. useDbQuery sürüm koruması mantığı ─────
  {
    const gate = createRequestGate();
    const a = gate.begin();
    const b = gate.begin();
    assert(!gate.isLatest(a) && gate.isLatest(b), 'eski istek (a) yok sayılır, son istek (b) geçerli');
    // yavaş-hızlı yarışı simülasyonu
    let data = '';
    const run = async (ms: number, v: string) => {
      const tok = gate.begin();
      await new Promise((r) => setTimeout(r, ms));
      if (gate.isLatest(tok)) data = v;
    };
    await Promise.all([run(30, 'eski'), run(5, 'yeni')]);
    assert(data === 'yeni', 'yavaş dönen eski reload() yeniyi ezmiyor');
  }

  // ───── 4. Özet: ısınma hariç sayım/hacim ─────
  {
    const { raw, db } = await freshDb();
    const bench = await exId(db, 'bench');
    const w = addWorkout(raw, bench, 5_000_000, [[40, 10, 'warmup'], [60, 10], [60, 10]]);
    const s = (await q.getWorkoutSummary(db, w.workoutId))!;
    assert(s.setCount === 2 && s.volume === 1200, `özet ısınmayı saymıyor (set ${s.setCount}, hacim ${s.volume})`);
    assert(s.muscles[0].sets === 2, 'kas dağılımıyla tutarlı');
    // haftalık çalışma seti (ana sayfa/ilerleme) ısınmayı saymaz; geçmiş listesi de aynı
    const rec = addWorkout(raw, bench, Date.now() - 3_600_000, [[40, 15, 'warmup'], [60, 10], [60, 8]]);
    const wk = await q.weeklyVolume(db, 2);
    assert(wk[1].sets === 2 && wk[1].workouts === 1, `haftalık çalışma seti ısınmasız (${wk[1].sets})`);
    const eh = await q.exerciseHistory(db, bench);
    assert(eh[eh.length - 1].max_reps === 10 && eh.every((h) => h.max_reps <= 10), 'en çok tekrar ısınmayı saymıyor');
    const li = (await q.listWorkouts(db)).find((x) => x.id === rec.workoutId)!;
    assert(li.set_count === 2, `geçmiş set sayısı ısınmasız (${li.set_count})`);
  }

  // ───── 5. deleteAllData ─────
  {
    const { raw, db } = await freshDb();
    const bench = await exId(db, 'bench');
    const custom = await q.createExercise(db, 'Özel', 'Göğüs', 'Halter');
    await q.setExerciseDefaultRest(db, bench, 10);
    await q.setExerciseDefaultRest(db, await exId(db, 'lateral'), 200);
    await q.setExerciseDefaultRest(db, await exId(db, 'pushup'), 99);
    addWorkout(raw, bench, 1, [[50, 5]]);
    await q.setSetting(db, 'profile', '{}');
    await addFoodLog(db, { day: 'd', meal: 'Öğle', name: 'X', kcal: 1, protein: 0, carbs: 0, fat: 0 });
    await q.deleteAllData(db);
    const n = (t: string) => (raw.prepare(`SELECT COUNT(*) n FROM ${t}`).get() as any).n;
    assert(['sets', 'workouts', 'workout_exercises', 'settings', 'foods', 'food_logs', 'routines'].every((t) => n(t) === 0), 'tüm kullanıcı verisi silindi');
    assert(!(await q.getExercise(db, custom)), 'özel egzersiz silindi');
    const rest = async (slug: string) => (await db.getFirstAsync('SELECT rest_seconds r FROM exercises WHERE slug = ?', slug)).r;
    assert((await rest('bench')) === 180 && (await rest('lateral')) === 75 && (await rest('pushup')) === null, 'rest_seconds seed varsayılanlarına döndü');
    // atomiklik: ortada hata olursa hiçbir şey silinmemeli
    addWorkout(raw, bench, 1, [[50, 5]]);
    raw.exec('DROP TABLE food_logs');
    let failed = false;
    try { await q.deleteAllData(db); } catch { failed = true; }
    assert(failed && n('workouts') === 1, 'hata olursa deleteAllData geri alınır (tek transaction)');
  }

  // ───── 6. Migrasyon v6 idempotent ─────
  {
    const raw = new DatabaseSync(':memory:');
    const db = wrap(raw);
    await migrateDb(db);
    await migrateDb(db);
    assert((raw.prepare('PRAGMA user_version').get() as any).user_version === DB_VERSION && DB_VERSION >= 6, `şema v${DB_VERSION}`);
    const noteCols = (raw.prepare('PRAGMA table_info(sets)').all() as any[]).filter((c) => c.name === 'note');
    assert(noteCols.length === 1, 'sets.note tek kez var');
    raw.exec('PRAGMA user_version = 5'); // v6 sütunu var ama sürüm geride (yarıda kalan migrasyon)
    await migrateDb(db);
    assert((raw.prepare('PRAGMA user_version').get() as any).user_version === DB_VERSION, 'yarıda kalan v6 tekrar çalışınca hata yok');
  }

  // ───── 7. getWorkoutDetail N+1 yok; batch = tekli ─────
  {
    const { raw, db } = await freshDb();
    const slugs = ['bench', 'squat', 'deadlift', 'ohp', 'pullup', 'dips'];
    const ids = await Promise.all(slugs.map((s) => exId(db, s)));
    ids.forEach((id, i) => {
      addWorkout(raw, id, 1_000 + i, [[50 + i, 8]]);
      addWorkout(raw, id, 2_000 + i, [[55 + i, 8]]);
    });
    const cur = Number(raw.prepare("INSERT INTO workouts (name, started_at) VALUES ('Aktif', 9000)").run().lastInsertRowid);
    const run = (n: number) => {
      raw.exec(`DELETE FROM workout_exercises WHERE workout_id = ${cur}`);
      ids.slice(0, n).forEach((id, i) => raw.prepare('INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, ?)').run(cur, id, i));
    };
    run(1);
    db.calls.n = 0;
    await q.getWorkoutDetail(db, cur);
    const one = db.calls.n;
    run(6);
    db.calls.n = 0;
    const d = (await q.getWorkoutDetail(db, cur))!;
    assert(db.calls.n === one, `sorgu sayısı egzersiz sayısından bağımsız (${one} → ${db.calls.n})`);
    const batch = await q.recentSessionsBatch(db, ids, cur, 4);
    for (const id of ids) {
      const wholeSeen = JSON.stringify(batch.get(id));
      assert(wholeSeen === JSON.stringify((await q.recentSessions(db, id, cur, 4))), `batch = tekli (${id})`);
      assert(batch.get(id)!.length === 2 && batch.get(id)![0].started_at > batch.get(id)![1].started_at, 'en yeni başta');
    }
    assert(d.exercises.every((e) => e.previous.length === 1), 'önceki set bilgisi dolu');
  }

  // ───── 8. Geçmiş düzenleme + PR yeniden hesabı ─────
  {
    const { raw, db } = await freshDb();
    const bench = await exId(db, 'bench');
    const squat = await exId(db, 'squat');
    const a = addWorkout(raw, bench, 1_000_000, [[100, 5], [60, 10, 'warmup']]);
    const b = addWorkout(raw, bench, 2_000_000, [[105, 5]]);
    const c = addWorkout(raw, bench, 3_000_000, [[110, 5]]);
    await q.editHistorySet(db, a.setIds[0], { weight: 100 }); // yeniden hesap tetikle
    assert(pr(raw, a.setIds[0]) === 0 && pr(raw, b.setIds[0]) === 1 && pr(raw, c.setIds[0]) === 1, 'ilk seans rekor değil, sonrakiler rekor');
    // A'yı 120×5 yap → B ve C artık rekor değil
    await q.editHistorySet(db, a.setIds[0], { weight: 120, reps: 5 });
    assert(pr(raw, b.setIds[0]) === 0 && pr(raw, c.setIds[0]) === 0, 'önceki seans yükselince sonrakilerin rekoru kalkar');
    // A'yı 90×5'e düşür → B (105) rekor, C (110) rekor
    await q.editHistorySet(db, a.setIds[0], { weight: 90 });
    assert(pr(raw, b.setIds[0]) === 1 && pr(raw, c.setIds[0]) === 1, 'düşünce yeniden rekor olur');
    // ısınma tipine çevirme: 90×5 çalışma seti ısınma olur → B ilk çalışma seti, rekor değil
    await q.editHistorySet(db, a.setIds[0], { set_type: 'warmup' });
    assert(pr(raw, b.setIds[0]) === 0 && pr(raw, c.setIds[0]) === 1, 'ısınmaya çevrilen set rekora sayılmaz');
    // set silme
    await q.editHistorySet(db, a.setIds[0], { set_type: 'normal', weight: 90 });
    await q.deleteHistorySet(db, a.setIds[0]);
    assert(pr(raw, b.setIds[0]) === 0 && pr(raw, c.setIds[0]) === 1, 'ilk set silinince sonraki ilk olur (rekor değil), C rekor');
    // set ekleme (son setin değerleri kopyalanır, tamamlanmış)
    const newId = (await q.addHistorySet(db, c.weId))!;
    const ns = raw.prepare('SELECT * FROM sets WHERE id = ?').get(newId) as any;
    assert(ns.done === 1 && ns.weight === 110 && ns.reps === 5 && ns.position === 1 && pr(raw, newId) === 0, 'set eklendi, rekor değil (eşit)');
    await q.editHistorySet(db, newId, { weight: 115, note: '  omuz sızladı  ', rir: 1 });
    const ns2 = raw.prepare('SELECT * FROM sets WHERE id = ?').get(newId) as any;
    assert(ns2.weight === 115 && ns2.note === 'omuz sızladı' && ns2.rir === 1 && ns2.is_pr === 1, 'ağırlık/not/zorluk düzenlendi, yeni rekor');
    await q.editHistorySet(db, newId, { note: '   ' });
    assert((raw.prepare('SELECT note FROM sets WHERE id = ?').get(newId) as any).note === null, 'boş not → null');
    // egzersiz ekle / çıkar
    const weId = (await q.addHistoryExercise(db, c.workoutId, squat))!;
    const d = (await q.getWorkoutDetail(db, c.workoutId))!;
    assert(d.exercises.length === 2 && d.exercises[1].sets.length === 1 && d.exercises[1].sets[0].done === 1, 'egzersiz eklendi (1 tamamlanmış set)');
    await q.removeHistoryExercise(db, c.weId);
    assert(pr(raw, b.setIds[0]) === 0 && (await q.getWorkoutDetail(db, c.workoutId))!.exercises.length === 1, 'egzersiz çıkarıldı');
    assert(weId > 0, 'id döndü');
    // başlık + not
    await q.updateWorkoutMeta(db, c.workoutId, { name: '  Yeni ad ', note: ' Güzel gün ' });
    let w = (await q.getWorkoutDetail(db, c.workoutId))!.workout;
    assert(w.name === 'Yeni ad' && w.note === 'Güzel gün', 'başlık ve not güncellendi');
    await q.updateWorkoutMeta(db, c.workoutId, { name: '   ', note: '' });
    w = (await q.getWorkoutDetail(db, c.workoutId))!.workout;
    assert(w.name === 'Antrenman' && w.note === null, 'boş başlık varsayılana, boş not null');
    // canlı antrenmandaki set notu
    await q.setSetNote(db, b.setIds[0], 'x'.repeat(300));
    assert((await q.getWorkoutDetail(db, b.workoutId))!.exercises[0].sets[0].note!.length === 140, 'set notu 140 ile sınırlı');
  }

  // ───── 9. Yedek: dışa → sil → içe = aynı veri ─────
  {
    const { raw, db } = await freshDb();
    const bench = await exId(db, 'bench');
    await q.saveProfile(db, { name: 'Test', goal: 'Kas kazanmak', experience: 'Orta', daysPerWeek: 4, restSeconds: 90, soundOn: true, hapticOn: true, incBarbell: 2.5, incDumbbell: 2, incMachine: 2.5, setStyle: 'auto', recoveryDays: 2, barWeight: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25] });
    await q.setSetting(db, 'anthropic_api_key', 'sk-ant-SECRET-SHOULD-NOT-LEAK');
    await q.createRoutinesFromTemplate(db, 'upperlower');
    const custom = await q.createExercise(db, 'Özel Hareket', 'Sırt', 'Kablo');
    await q.setExerciseDefaultRest(db, bench, 200);
    const w1 = addWorkout(raw, bench, 1_000_000, [[100, 5], [60, 10, 'warmup']]);
    addWorkout(raw, custom, 2_000_000, [[40, 12]]);
    raw.prepare('UPDATE sets SET note = ?, rir = 2 WHERE id = ?').run('not "tırnak" \' ve ünicode ğüşiçö', w1.setIds[0]);
    raw.exec("INSERT INTO body_weights (measured_at, weight) VALUES (1, 80.5), (2, 80.1)");
    await q.saveGuide(db, bench, '{"a":1}', 'm', 5);
    await addFoodLog(db, { day: '2026-05-09', meal: 'Öğle', name: 'Pilav', kcal: 200, protein: 4, carbs: 44, fat: 1 }, 10);
    await addFoodLogs(db, [{ day: '2026-05-09', meal: 'Akşam', name: 'AI tabak', kcal: 300, protein: 1, carbs: 1, fat: 1, source: 'ai', note: 'n' }], 20);

    const before = await exportBackup(db, 123);
    assert(!JSON.stringify(before).includes('SECRET'), 'API anahtarı yedeğe girmedi');
    assert(before.schemaVersion === DB_VERSION && before.tables.sets.length === 3, 'yedek sürümlü ve tam');
    const text = JSON.stringify(before);
    await q.deleteAllData(db);
    assert((await q.listWorkouts(db)).length === 0, 'silindi');
    await importBackup(db, parseBackup(text));
    const after = await exportBackup(db, 123);
    // API anahtarı benzeri ayar yedekte olmadığından geri gelmemeli; geri kalan her şey birebir aynı
    assert(JSON.stringify(after) === text, 'dışa → sil → içe = birebir aynı veri');
    const c = backupCounts(after);
    assert(c.workouts === 2 && c.sets === 3 && c.routines === 2 && c.foodLogs === 2 && c.bodyWeights === 2, 'sayımlar');
    // içe aktarılan veri çalışır durumda (id sayaçları, FK)
    const id = await q.createExercise(db, 'Yeni', 'Göğüs', 'Halter');
    assert(id > Math.max(...after.tables.exercises.map((e: any) => e.id)), 'AUTOINCREMENT devam ediyor');
    assert((await q.getWorkoutDetail(db, w1.workoutId))!.exercises[0].sets[0].note?.includes('ünicode'), 'set notu korundu');
    // mevcut veriyi DEĞİŞTİRİR (birleştirmez)
    addWorkout(raw, bench, 9_000_000, [[1, 1]]);
    await importBackup(db, parseBackup(text));
    assert((await q.listWorkouts(db)).length === 2, 'içe aktarma mevcut veriyi değiştirir');
  }

  // ───── 10. Yedek doğrulama / reddetme ─────
  {
    const { raw, db } = await freshDb();
    const good = await exportBackup(db, 1);
    const expectReject = (text: string, why: string, re?: RegExp) => {
      try {
        parseBackup(text);
      } catch (e) {
        assert(e instanceof BackupError && (!re || re.test(e.userMessage)), `reddedildi: ${why}`);
        return;
      }
      throw new Error('FAIL: reddedilmedi: ' + why);
    };
    expectReject(JSON.stringify({ ...good, schemaVersion: DB_VERSION + 1 }), 'daha yeni şema sürümü', /daha yeni/);
    expectReject(JSON.stringify({ ...good, schemaVersion: 0 }), 'geçersiz sürüm');
    expectReject(JSON.stringify({ ...good, schemaVersion: '6' }), 'sürüm sayı değil');
    expectReject(JSON.stringify({ ...good, app: 'baska' }), 'başka uygulama');
    expectReject(JSON.stringify({ ...good, format: 99 }), 'bilinmeyen biçim');
    expectReject('{bozuk', 'JSON değil');
    expectReject('[]', 'dizi');
    expectReject(JSON.stringify({ ...good, tables: { ...good.tables, sets: 'x' } }), 'bozuk tablo');
    expectReject(JSON.stringify({ ...good, tables: { ...good.tables, sets: [1] } }), 'satır nesne değil');
    // eski sürüm (tablo eksik) kabul edilir
    const old = { ...good, schemaVersion: 4, tables: { ...good.tables } } as any;
    delete old.tables.foods;
    delete old.tables.food_logs;
    assert(parseBackup(JSON.stringify(old)).tables.foods.length === 0, 'eski sürüm yedeği (eksik tablolar boş) kabul');

    // geçersiz değerli yedek: içe aktarma tamamen geri alınır, mevcut veri korunur
    const bench = await exId(db, 'bench');
    addWorkout(raw, bench, 1, [[50, 5]]);
    const evil = JSON.parse(JSON.stringify(good));
    evil.tables.body_weights = [{ id: 1, measured_at: 1, weight: 80 }, { id: 2, measured_at: 2, weight: { x: 1 } }];
    let failed = false;
    try { await importBackup(db, parseBackup(JSON.stringify(evil))); } catch { failed = true; }
    assert(failed && (await q.listWorkouts(db)).length === 1 && (raw.prepare('SELECT COUNT(*) n FROM body_weights').get() as any).n === 0, 'bozuk içe aktarma geri alındı, mevcut veri duruyor');
    // sütun adı enjeksiyonu: şemada olmayan sütunlar yok sayılır
    const inj = JSON.parse(JSON.stringify(good));
    inj.tables.body_weights = [{ id: 1, measured_at: 1, weight: 80, 'weight); DROP TABLE sets; --': 1 }];
    await importBackup(db, parseBackup(JSON.stringify(inj)));
    assert((raw.prepare('SELECT COUNT(*) n FROM body_weights').get() as any).n === 1 && (raw.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name = 'sets'").get() as any).n === 1, 'bilinmeyen sütun adı yok sayıldı (enjeksiyon yok)');
    assert(BACKUP_TABLES.length === 12, 'tüm tablolar yedekte');
    // her tablo gerçekten yedek kapsamında mı (şemaya yeni tablo eklenirse test uyarır)
    const real = (raw.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as any[]).map((r) => r.name).sort();
    assert(JSON.stringify(real) === JSON.stringify([...BACKUP_TABLES].sort()), `şemadaki her tablo yedekte (${real.join(',')})`);
  }

  console.log('\nGÖREV 0 TESTLERİ GEÇTİ');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
