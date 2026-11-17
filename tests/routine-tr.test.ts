// Görev 2.7 A — antrenmandan rutin + Türkçe talimatlar
import { EXERCISE_MEDIA } from '@/db/exercise-media';
import { createRoutineFromWorkout, getRoutine, listRoutines } from '@/db/queries';
import { assert, freshDb } from './helpers';

(async () => {
  // ── Türkçe talimatlar
  const entries = Object.entries(EXERCISE_MEDIA);
  assert(entries.length > 60, `eşlenen egzersiz sayısı (${entries.length})`);
  const empty = entries.filter(([, m]) => m.steps.tr.length === 0 || m.steps.en.length === 0 || [...m.steps.tr, ...m.steps.en].some((s) => s.trim().length < 5)).map(([k]) => k);
  assert(empty.length === 0, `her egzersizde iki dilde boş olmayan adım (${empty.join(',')})`);
  const english = /\b(the|your|and|with|then|until|should|breathe|repetitions)\b/i;
  const eng = entries.filter(([, m]) => m.steps.tr.some((s) => english.test(s))).map(([k]) => k);
  assert(eng.length === 0, `talimatlarda İngilizce kalıntı yok (${eng.join(',')})`);
  // İngilizce adımlar gerçekten İngilizce (Türkçe karakter yok)
  const trInEn = entries.filter(([, m]) => m.steps.en.some((s) => /[çğıöşüÇĞİÖŞÜ]/.test(s))).map(([k]) => k);
  assert(trInEn.length === 0, `İngilizce adımlarda Türkçe karakter yok (${trInEn.join(',')})`);
  const noTr = entries.filter(([, m]) => !m.steps.tr.every((s) => /[a-zçğıöşü]/i.test(s))).map(([k]) => k);
  assert(noTr.length === 0, 'adımlar cümle halinde');

  // ── createRoutineFromWorkout
  const { raw, db } = await freshDb();
  const ids = raw.prepare("SELECT id FROM exercises ORDER BY id LIMIT 4").all().map((r: any) => Number(r.id));
  const w = Number(raw.prepare("INSERT INTO workouts (name, started_at, finished_at) VALUES ('Sırt günü', 1000, 5000)").run().lastInsertRowid);
  const addEx = (exId: number, pos: number, min: number, max: number, rest: number | null, sets: [string, number][]) => {
    const we = Number(raw.prepare('INSERT INTO workout_exercises (workout_id, exercise_id, position, rep_min, rep_max, rest_seconds) VALUES (?,?,?,?,?,?)').run(w, exId, pos, min, max, rest).lastInsertRowid);
    sets.forEach(([type, done], i) => raw.prepare('INSERT INTO sets (workout_exercise_id, position, weight, reps, done, set_type) VALUES (?,?,?,?,?,?)').run(we, i, 50, 10, done, type));
  };
  // ters sırada ekle: position sırası kullanılmalı
  addEx(ids[1], 1, 6, 10, 120, [['warmup', 1], ['normal', 1], ['normal', 1]]);
  addEx(ids[0], 0, 8, 12, null, [['warmup', 1], ['warmup', 1], ['normal', 1], ['normal', 1], ['normal', 1], ['normal', 0]]);
  addEx(ids[2], 2, 10, 15, null, [['normal', 0]]); // hiç tamamlanmadı → rutine girmez

  const rid = await createRoutineFromWorkout(db, w, '  Sırt günü  ');
  assert(rid != null, 'rutin oluştu');
  const r = await getRoutine(db, rid!);
  assert(r!.name === 'Sırt günü', 'ad kırpıldı');
  assert(r!.items.length === 2, 'tamamlanmamış egzersiz hariç');
  assert(r!.items[0].exercise_id === ids[0] && r!.items[1].exercise_id === ids[1], 'sıra korunur (position)');
  assert(r!.items[0].target_sets === 3, 'ısınma ve tamamlanmamış set hariç: 3');
  assert(r!.items[1].target_sets === 2, 'ısınma hariç: 2');
  assert(r!.items[0].rep_min === 8 && r!.items[0].rep_max === 12, 'tekrar aralığı 8-12');
  assert(r!.items[1].rep_min === 6 && r!.items[1].rep_max === 10 && r!.items[1].rest_seconds === 120, 'tekrar aralığı 6-10 + dinlenme');
  assert((await listRoutines(db)).length === 1, 'listede 1 rutin');

  // hiç çalışma seti yoksa null
  const w2 = Number(raw.prepare("INSERT INTO workouts (name, started_at, finished_at) VALUES ('Boş', 1, 2)").run().lastInsertRowid);
  const we2 = Number(raw.prepare('INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?,?,0)').run(w2, ids[3]).lastInsertRowid);
  raw.prepare("INSERT INTO sets (workout_exercise_id, position, done, set_type) VALUES (?,0,1,'warmup')").run(we2);
  assert((await createRoutineFromWorkout(db, w2, 'X')) === null, 'yalnızca ısınma → rutin oluşmaz');
  assert((await listRoutines(db)).length === 1, 'başarısız denemede rutin eklenmedi');
  const rid2 = await createRoutineFromWorkout(db, w, '   ');
  assert((await getRoutine(db, rid2!))!.name === 'Yeni rutin', 'boş ad → varsayılan');
})();

// ── Kardiyo entegrasyonu
(async () => {
  const { cardioPrTexts, EMPTY_BESTS, updateBests } = await import('@/lib/cardio');
  const { cardioPrDetails, getWorkoutSummary } = await import('@/db/queries');
  const prev = updateBests(EMPTY_BESTS, { duration_sec: 1200, distance_m: 3000 });
  const t = cardioPrTexts(prev, { duration_sec: 1500, distance_m: 4200 });
  assert(t.includes('En uzun süre 25:00') && t.includes('En uzun mesafe 4,2 km') && t.includes('En hızlı tempo 5:57 /km'), `kardiyo PR metni (${t.join(' | ')})`);
  assert(cardioPrTexts(prev, { duration_sec: 1000, distance_m: 2000 }).length === 0, 'rekor değilse metin yok');

  const { raw, db } = await freshDb();
  const cardio = Number(raw.prepare("SELECT id FROM exercises WHERE kind='cardio' LIMIT 1").get()!.id);
  const mk = (start: number) => Number(raw.prepare('INSERT INTO workouts (name, started_at, finished_at) VALUES (?,?,?)').run('K', start, start + 3600_000).lastInsertRowid);
  const mkSet = (w: number, dur: number, dist: number, pr: number, done = 1) => {
    let we: any = raw.prepare('SELECT id FROM workout_exercises WHERE workout_id=? AND exercise_id=?').get(w, cardio);
    const weId = we ? Number(we.id) : Number(raw.prepare('INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?,?,0)').run(w, cardio).lastInsertRowid);
    raw.prepare('INSERT INTO sets (workout_exercise_id, position, duration_sec, distance_m, done, is_pr) VALUES (?,0,?,?,?,?)').run(weId, dur, dist, done, pr);
  };
  const w1 = mk(1_000_000); mkSet(w1, 1200, 3000, 0);
  const w2 = mk(2_000_000); mkSet(w2, 1500, 4200, 1); mkSet(w2, 600, 1000, 0);
  const d = await cardioPrDetails(db, w2);
  assert(d.length === 1 && d[0].texts.includes('En uzun süre 25:00'), 'cardioPrDetails: en uzun süre');
  const sm = await getWorkoutSummary(db, w2);
  assert(sm!.cardio.sets === 2, 'özet kardiyo set sayısı');

  const rid = await createRoutineFromWorkout(db, w2, 'Kardiyo günü');
  const r = await getRoutine(db, rid!);
  assert(r!.items.length === 1 && r!.items[0].target_sets === 2 && r!.items[0].kind === 'cardio', 'kardiyo: set sayısı = tamamlanan set (reps yok), tür taşındı');
})();
