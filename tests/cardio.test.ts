import { DatabaseSync } from 'node:sqlite';

import { exportBackup, importBackup, parseBackup } from '@/db/backup';
import { DB_VERSION, migrateDb } from '@/db/migrate';
import * as q from '@/db/queries';
import { formatClock, formatHold, formatKm, formatPace, parseClock, parseHold, parseKm, suggestCardio } from '@/lib/cardio';
import { computeRecovery } from '@/lib/recovery';
import { assert, freshDb, wrap } from './helpers';

const DAY = 86400000;
const exId = async (db: any, slug: string) => (await db.getFirstAsync('SELECT id FROM exercises WHERE slug = ?', slug)).id as number;

function addCardio(raw: DatabaseSync, exerciseId: number, startedAt: number, sets: [number, number | null, number | null?][]) {
  const w = Number(raw.prepare('INSERT INTO workouts (name, started_at, finished_at) VALUES (?, ?, ?)').run('C', startedAt, startedAt + 3600_000).lastInsertRowid);
  const we = Number(raw.prepare('INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, 0)').run(w, exerciseId).lastInsertRowid);
  const ids: number[] = [];
  sets.forEach(([dur, dist, level], i) => {
    ids.push(Number(raw.prepare('INSERT INTO sets (workout_exercise_id, position, duration_sec, distance_m, level, done, completed_at) VALUES (?, ?, ?, ?, ?, 0, NULL)').run(we, i, dur, dist, level ?? null).lastInsertRowid));
  });
  return { workoutId: w, weId: we, setIds: ids };
}

(async () => {
  // ── biçimlendirme / ayrıştırma
  assert(formatClock(1230) === '20:30' && formatClock(3725) === '1:02:05' && formatClock(45) === '0:45', 'dk:sn biçimi');
  assert(parseClock('20:30') === 1230 && parseClock('20') === 1200 && parseClock('1:02:05') === 3725 && parseClock('20,5') === 1230, 'dk:sn ayrıştırma');
  assert(parseClock('') === null && parseClock('abc') === null && parseClock('5:75') === null && parseClock('0') === null, 'geçersiz süre → null');
  assert(parseHold('45') === 45 && parseHold('1:30') === 90 && parseHold('x') === null, 'süreli giriş: sayı = saniye');
  assert(formatHold(45) === '45 sn' && formatHold(90) === '1:30', 'süreli biçim');
  assert(formatKm(3200) === '3,2' && formatKm(5000) === '5' && formatKm(12345) === '12,35', 'km biçimi');
  assert(parseKm('3,2') === 3200 && parseKm('5') === 5000 && parseKm('0') === null && parseKm('a') === null, 'km ayrıştırma');
  assert(formatPace(375) === '6:15 /km', 'tempo');

  // ── öneri
  const s1 = suggestCardio([{ started_at: 1, sets: [{ duration_sec: 1200, distance_m: 3200 }] }], 'cardio');
  assert(s1.duration_sec === 1320 && s1.reason.includes('Geçen sefer 20 dk · 3,2 km') && s1.reason.includes('bugün 22 dk'), 'kardiyo önerisi 20 dk → 22 dk');
  assert(suggestCardio([], 'cardio').duration_sec === null, 'geçmiş yok → öneri yok');
  assert(suggestCardio([{ started_at: 1, sets: [{ duration_sec: 40, distance_m: null }] }], 'timed').duration_sec === 45, 'süreli +5 sn');
  assert(suggestCardio([{ started_at: 1, sets: [{ duration_sec: 300, distance_m: null }] }], 'cardio').duration_sec === 360, 'en az +1 dk (tam dakika)');

  // ── v7 migrasyonu: şema, seed türleri, adlar, idempotent
  const { raw, db } = await freshDb();
  assert((raw.prepare('PRAGMA user_version').get() as any).user_version === DB_VERSION && DB_VERSION >= 7, `sürüm ${DB_VERSION}`);
  const kinds = Object.fromEntries((raw.prepare('SELECT slug, kind, name FROM exercises').all() as any[]).map((r) => [r.slug, r]));
  assert(kinds.treadmill.kind === 'cardio' && kinds.bike.kind === 'cardio' && kinds.rower.kind === 'cardio', 'kardiyo makineleri cardio');
  assert(kinds.plank.kind === 'timed' && kinds.pushup.kind === 'bodyweight' && kinds.pullup.kind === 'bodyweight' && kinds.bench.kind === 'strength' && kinds['db-curl'].kind === 'strength', 'plank timed, vücut bodyweight, diğerleri strength');
  assert(kinds.treadmill.name === 'Treadmill' && kinds.bike.name === 'Stationary Bike' && kinds.rower.name === 'Rowing Machine', '"(min)" eki yok');
  const setCols = (raw.prepare('PRAGMA table_info(sets)').all() as any[]).map((c) => c.name);
  assert(['duration_sec', 'distance_m', 'level', 'kcal'].every((c) => setCols.includes(c)), 'set sütunları');
  await migrateDb(db);
  raw.exec('PRAGMA user_version = 6');
  await migrateDb(db); // sütunlar zaten var → hata vermemeli
  assert((raw.prepare('PRAGMA user_version').get() as any).user_version === DB_VERSION, 'v7 migrasyonu idempotent');

  // ── eski kardiyo verisi (dakika reps'te) duration_sec'e taşınır; özel kardiyo egzersizi cardio olur
  const old = new DatabaseSync(':memory:');
  old.exec(`CREATE TABLE exercises (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT UNIQUE, name TEXT NOT NULL, muscle TEXT NOT NULL, equipment TEXT NOT NULL, is_custom INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE workouts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, routine_id INTEGER, started_at INTEGER NOT NULL, finished_at INTEGER, note TEXT);
    CREATE TABLE workout_exercises (id INTEGER PRIMARY KEY AUTOINCREMENT, workout_id INTEGER NOT NULL, exercise_id INTEGER NOT NULL, position INTEGER NOT NULL, rep_min INTEGER NOT NULL DEFAULT 8, rep_max INTEGER NOT NULL DEFAULT 12);
    CREATE TABLE sets (id INTEGER PRIMARY KEY AUTOINCREMENT, workout_exercise_id INTEGER NOT NULL, position INTEGER NOT NULL, weight REAL, reps INTEGER, rpe REAL, done INTEGER NOT NULL DEFAULT 0, is_pr INTEGER NOT NULL DEFAULT 0, completed_at INTEGER);
    CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    CREATE TABLE routines (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE routine_exercises (id INTEGER PRIMARY KEY AUTOINCREMENT, routine_id INTEGER NOT NULL, exercise_id INTEGER NOT NULL, position INTEGER NOT NULL, target_sets INTEGER NOT NULL DEFAULT 3, rep_min INTEGER NOT NULL DEFAULT 8, rep_max INTEGER NOT NULL DEFAULT 12);
    CREATE TABLE body_weights (id INTEGER PRIMARY KEY AUTOINCREMENT, measured_at INTEGER NOT NULL, weight REAL NOT NULL);
    INSERT INTO exercises (slug,name,muscle,equipment) VALUES ('treadmill','Treadmill (min)','Kardiyo','Makine');
    INSERT INTO exercises (name,muscle,equipment,is_custom) VALUES ('Eliptik','Kardiyo','Makine',1);
    INSERT INTO workouts (name, started_at, finished_at) VALUES ('Eski', 1, 2);
    INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (1,1,0);
    INSERT INTO sets (workout_exercise_id, position, reps, done) VALUES (1,0,25,1);
    PRAGMA user_version = 1;`);
  const odb = wrap(old);
  await migrateDb(odb);
  const os = old.prepare('SELECT duration_sec, reps FROM sets').get() as any;
  assert(os.duration_sec === 1500 && os.reps === null, 'eski kardiyo dakikası duration_sec oldu');
  assert((old.prepare("SELECT kind FROM exercises WHERE name = 'Eliptik'").get() as any).kind === 'cardio', 'özel Kardiyo kas grubu → cardio');
  assert((old.prepare("SELECT name FROM exercises WHERE slug = 'treadmill'").get() as any).name === 'Treadmill', 'eski ad temizlendi');

  // ── istatistiklerden ayrışma
  const tm = await exId(db, 'treadmill');
  const bench = await exId(db, 'bench');
  const now = Date.now();
  const bw = Number(raw.prepare('INSERT INTO workouts (name, started_at, finished_at) VALUES (?, ?, ?)').run('Karma', now - 1000, now).lastInsertRowid);
  const bwe = Number(raw.prepare('INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, 0)').run(bw, bench).lastInsertRowid);
  raw.prepare('INSERT INTO sets (workout_exercise_id, position, weight, reps, done, completed_at) VALUES (?, 0, 60, 8, 1, ?)').run(bwe, now);
  const cwe = Number(raw.prepare('INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, 1)').run(bw, tm).lastInsertRowid);
  raw.prepare('INSERT INTO sets (workout_exercise_id, position, duration_sec, distance_m, done, completed_at) VALUES (?, 0, 1200, 3200, 1, ?)').run(cwe, now);
  const ms = await q.muscleSets(db, 7);
  assert(ms.length === 1 && ms[0].muscle === 'Göğüs' && ms[0].sets === 1, 'muscleSets kardiyoyu saymaz');
  const last = await q.muscleLastTrained(db);
  assert(!last.some((r) => r.muscle === 'Kardiyo'), 'muscleLastTrained kardiyoyu saymaz');
  assert(computeRecovery(last, 2).every((r) => r.muscle !== 'Kardiyo'), 'toparlanma kardiyosuz');
  const list = await q.listWorkouts(db);
  assert(list[0].set_count === 1 && list[0].cardio_sec === 1200, 'geçmiş set sayısı kardiyosuz, kardiyo süresi ayrı');
  const sum = await q.getWorkoutSummary(db, bw);
  assert(sum!.setCount === 1 && !sum!.muscles.some((m) => m.muscle === 'Kardiyo') && sum!.cardio.minutes === 20 && sum!.cardio.km === 3.2, 'özet: set sayısı/kas kardiyosuz, kardiyo ayrı');
  const wv = await q.weeklyVolume(db, 2);
  assert(wv.reduce((a, b) => a + b.sets, 0) === 1, 'weeklyVolume kardiyosuz');
  const wc = await q.weeklyCardio(db, 2);
  assert(Math.round(wc.reduce((a, b) => a + b.minutes, 0)) === 20, 'weeklyCardio dakikası');
  assert((await q.topExercises(db)).every((e) => e.id !== tm), 'topExercises kardiyosuz');

  // ── antrenman ekranı verisi: öneri + PR
  const t0 = now - 10 * DAY;
  addCardio(raw, tm, t0, [[1200, 3200]]);
  const cur = addCardio(raw, tm, now, [[1320, 3500], [600, 1000]]);
  const detail = await q.getWorkoutDetail(db, cur.workoutId);
  // (cur henüz bitmedi sayılmaz → finished_at dolu ama excludeWorkoutId bu antrenmanı dışlar)
  const ex = detail!.exercises[0];
  assert(ex.kind === 'cardio' && ex.cardioSuggestion?.duration_sec === 1320 && ex.cardioSuggestion.reason.includes('bugün 22 dk'), 'detay: basit kardiyo önerisi');
  assert(ex.cardioSuggestion!.reason.includes('Geçen sefer 20 dk · 3,2 km'), 'öneri geçen seferi anlatır');
  // PR: ilk set en uzun süre/mesafe + daha hızlı tempo
  const pr1 = await q.toggleSetDone(db, cur.setIds[0], true);
  assert(pr1 === true && (raw.prepare('SELECT is_pr FROM sets WHERE id = ?').get(cur.setIds[0]) as any).is_pr === 1, 'kardiyo PR (daha uzun süre/mesafe)');
  const pr2 = await q.toggleSetDone(db, cur.setIds[1], true);
  assert(pr2 === false, 'daha kısa set PR değil');
  const done = raw.prepare('SELECT rest_taken, rest_target FROM sets WHERE id = ?').get(cur.setIds[1]) as any;
  assert(done.rest_taken === null && done.rest_target === null, 'kardiyoda mola takibi yok');
  // yalnızca tempo PR'ı
  const t2 = addCardio(raw, tm, now + 1000, [[1000, 3000]]); // süre ve mesafe daha az; tempo 333 sn/km (önceki en hızlı: 1320/3.5=377)
  assert((await q.toggleSetDone(db, t2.setIds[0], true)) === true, 'en hızlı tempo PR');
  // geçmiş düzenleme: kardiyo seti finalize ile silinmez
  await q.finalizeHistoryEdit(db, cur.workoutId);
  assert((raw.prepare('SELECT COUNT(*) c FROM sets WHERE workout_exercise_id = ?').get(cur.weId) as any).c === 2, 'finalizeHistoryEdit kardiyo setini silmez');
  await q.editHistorySet(db, cur.setIds[0], { duration_sec: 600, distance_m: 1500 });
  assert((raw.prepare('SELECT is_pr FROM sets WHERE id = ?').get(cur.setIds[0]) as any).is_pr === 0, 'düzenlemede PR yeniden hesaplanır');

  // ── yeni egzersiz türü
  const cid = await q.createExercise(db, 'Eliptik', 'Kardiyo', 'Makine', 'cardio');
  assert((await q.getExercise(db, cid))!.kind === 'cardio' && (await q.getExercise(db, bench))!.kind === 'strength', 'createExercise türü');
  await q.createExercise(db, 'Eski tür', 'Göğüs', 'Halter');
  assert((await db.getFirstAsync("SELECT kind FROM exercises WHERE name = 'Eski tür'")).kind === 'strength', 'varsayılan tür strength');

  // ── yedek: dışa → içe yeni sütunlar
  const backup = await exportBackup(db);
  assert(backup.schemaVersion === DB_VERSION, 'yedek şema güncel');
  const { db: db2, raw: raw2 } = await freshDb();
  await importBackup(db2, parseBackup(JSON.stringify(backup)));
  const s = raw2.prepare('SELECT duration_sec, distance_m FROM sets WHERE duration_sec = 1200').get() as any;
  assert(s && s.distance_m === 3200, 'yedek: süre/mesafe geri yüklendi');
  assert((raw2.prepare("SELECT kind FROM exercises WHERE name = 'Eliptik'").get() as any).kind === 'cardio', 'yedek: egzersiz türü geri yüklendi');

  // ── eski (v6) yedek v7'ye yükseltilir
  const v6 = JSON.parse(JSON.stringify(backup));
  v6.schemaVersion = 6;
  for (const r of v6.tables.exercises) delete r.kind;
  for (const r of v6.tables.sets) { delete r.duration_sec; delete r.distance_m; delete r.level; delete r.kcal; }
  const exs = v6.tables.exercises as any[];
  exs.find((e) => e.slug === 'treadmill').name = 'Treadmill (min)';
  const { db: db3, raw: raw3 } = await freshDb();
  await importBackup(db3, parseBackup(JSON.stringify(v6)));
  const k3 = Object.fromEntries((raw3.prepare('SELECT slug, kind, name FROM exercises').all() as any[]).map((r) => [r.slug, r]));
  assert(k3.treadmill.kind === 'cardio' && k3.treadmill.name === 'Treadmill' && k3.plank.kind === 'timed' && k3.pushup.kind === 'bodyweight' && k3.bench.kind === 'strength', 'v6 yedek: türler ve adlar uygulandı');
  assert((raw3.prepare("SELECT kind FROM exercises WHERE name = 'Eliptik'").get() as any).kind === 'cardio', 'v6 yedek: özel Kardiyo egzersizi cardio');

  // ── kontrolcü düzeltmeleri
  {
    const { raw: r, db: d } = await freshDb();
    const plank = await exId(d, 'plank');
    const tread = await exId(d, 'treadmill');
    const w = Number(r.prepare('INSERT INTO workouts (name, started_at, finished_at) VALUES (?, 1, 2)').run('E').lastInsertRowid);
    const pw = Number(r.prepare('INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, 0)').run(w, plank).lastInsertRowid);
    const tw = Number(r.prepare('INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, 1)').run(w, tread).lastInsertRowid);
    r.prepare('INSERT INTO sets (workout_exercise_id, position, reps, weight, done) VALUES (?, 0, 45, NULL, 1)').run(pw);
    r.prepare('INSERT INTO sets (workout_exercise_id, position, reps, done) VALUES (?, 0, 20, 1)').run(tw);
    r.exec('PRAGMA user_version = 6');
    await migrateDb(d);
    await migrateDb(d);
    const ps = r.prepare('SELECT duration_sec, reps FROM sets WHERE workout_exercise_id = ?').get(pw) as any;
    const ts = r.prepare('SELECT duration_sec, reps FROM sets WHERE workout_exercise_id = ?').get(tw) as any;
    assert(ps.duration_sec === 45 && ps.reps === null, 'plank: eski saniye duration_sec oldu (×60 yok)');
    assert(ts.duration_sec === 1200 && ts.reps === null, 'treadmill: eski dakika ×60 kaldı');
    // yedekten içe aktarım (v6): plank saniyesi taşınır
    const b6 = JSON.parse(JSON.stringify(await exportBackup(d)));
    b6.schemaVersion = 6;
    for (const row of b6.tables.sets) { row.reps = row.duration_sec === 45 ? 45 : row.duration_sec === 1200 ? 20 : row.reps; row.duration_sec = null; }
    const { raw: r2, db: d2 } = await freshDb();
    await importBackup(d2, parseBackup(JSON.stringify(b6)));
    const pb = r2.prepare('SELECT duration_sec, reps FROM sets WHERE duration_sec = 45').get() as any;
    assert(pb && pb.reps === null, 'v6 yedek: plank saniyesi taşındı');
    assert((r2.prepare('SELECT COUNT(*) c FROM sets WHERE duration_sec = 1200').get() as any).c === 1, 'v6 yedek: kardiyo dakikası taşındı');

    // özet: yalnızca cardio "Kardiyo" sayılır, timed sayılmaz
    const n = Date.now();
    const w2 = Number(r.prepare('INSERT INTO workouts (name, started_at, finished_at) VALUES (?, ?, ?)').run('S', n - 5000, n).lastInsertRowid);
    const a = Number(r.prepare('INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, 0)').run(w2, plank).lastInsertRowid);
    const c = Number(r.prepare('INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, 1)').run(w2, tread).lastInsertRowid);
    r.prepare('INSERT INTO sets (workout_exercise_id, position, duration_sec, done, completed_at) VALUES (?, 0, 60, 1, ?)').run(a, n);
    r.prepare('INSERT INTO sets (workout_exercise_id, position, duration_sec, distance_m, done, completed_at) VALUES (?, 0, 600, 1000, 1, ?)').run(c, n);
    const sm = await q.getWorkoutSummary(d, w2);
    assert(sm!.cardio.sets === 1 && sm!.cardio.minutes === 10, 'özet kardiyosu timed sayılmaz');
    const wcs = await q.weeklyCardio(d, 2);
    assert(Math.round(wcs.reduce((x, y) => x + y.minutes, 0)) === 10, 'weeklyCardio timed saymaz');

    // rutin: drop setler sayılmaz
    const bench2 = await exId(d, 'bench');
    const w3 = Number(r.prepare('INSERT INTO workouts (name, started_at, finished_at) VALUES (?, ?, ?)').run('R', n, n).lastInsertRowid);
    const be = Number(r.prepare('INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, 0)').run(w3, bench2).lastInsertRowid);
    for (let i = 0; i < 3; i++) r.prepare("INSERT INTO sets (workout_exercise_id, position, weight, reps, done, set_type) VALUES (?, ?, 50, 8, 1, 'normal')").run(be, i);
    for (let i = 3; i < 5; i++) r.prepare("INSERT INTO sets (workout_exercise_id, position, weight, reps, done, set_type) VALUES (?, ?, 40, 8, 1, 'drop')").run(be, i);
    r.prepare("INSERT INTO sets (workout_exercise_id, position, weight, reps, done, set_type) VALUES (?, 5, 20, 10, 1, 'warmup')").run(be);
    const rid = await q.createRoutineFromWorkout(d, w3, 'Test');
    assert((r.prepare('SELECT target_sets FROM routine_exercises WHERE routine_id = ?').get(rid!) as any).target_sets === 3, 'rutin: 3 normal + 2 drop + ısınma → 3 set');

    // egzersiz rekor kartı: set bazlı maksimum
    const w4 = Number(r.prepare('INSERT INTO workouts (name, started_at, finished_at) VALUES (?, ?, ?)').run('K', n + 1, n + 2).lastInsertRowid);
    const k = Number(r.prepare('INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, 0)').run(w4, tread).lastInsertRowid);
    r.prepare('INSERT INTO sets (workout_exercise_id, position, duration_sec, distance_m, done) VALUES (?, 0, 600, 2000, 1)').run(k);
    r.prepare('INSERT INTO sets (workout_exercise_id, position, duration_sec, distance_m, done) VALUES (?, 1, 900, 1500, 1)').run(k);
    const ch = (await q.cardioHistory(d, tread)).find((h) => h.workout_id === w4)!;
    assert(ch.duration_sec === 1500 && ch.max_set_sec === 900 && ch.max_set_m === 2000, 'cardioHistory: toplam ve set bazlı maksimum ayrı');
  }
  console.log('cardio testleri tamam');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
