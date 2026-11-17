// Görev 2.8 — egzersiz kütüphanesi araması, doğrudan rutin oluşturma, geçmişsiz egzersiz sorguları
import { cardioHistory, exerciseHistory, getActiveWorkout, getExercise, getRoutine, getWorkoutDetail, listExercises, listRoutines, saveRoutine, startWorkout } from '@/db/queries';
import { filterExercises } from '@/lib/exercise-library';
import { assert, freshDb } from './helpers';

(async () => {
  const { db } = await freshDb();
  const all = await listExercises(db);
  assert(all.length >= 60, `kütüphane tüm egzersizleri listeler (${all.length})`);
  const names = (r: typeof all) => r.map((e) => e.name);

  // ── arama
  assert(filterExercises(all, {}).length === all.length, 'filtre yok → hepsi');
  assert(names(filterExercises(all, { q: 'pull-up' })).includes('Pull-Up'), 'İngilizce ad');
  assert(names(filterExercises(all, { q: 'BARFİKS' })).includes('Pull-Up'), 'Türkçe takma ad, büyük harf + İ');
  assert(names(filterExercises(all, { q: 'barfiks' })).includes('Pull-Up'), 'aksansız (i/İ)');
  const back = filterExercises(all, { q: 'sirt' });
  assert(back.length > 0 && back.some((e) => e.muscle === 'Sırt'), 'kas: "sirt" → Sırt (aksan duyarsız)');
  assert(filterExercises(all, { q: 'gogus' }).length > 0 && filterExercises(all, { q: 'GÖĞÜS' }).length === filterExercises(all, { q: 'gogus' }).length, 'gogus ve GÖĞÜS → Göğüs');
  assert(filterExercises(all, { q: 'bench press' }).every((e) => /bench/i.test(e.name + (e.alias ?? ''))), 'çok sözcük: hepsi eşleşmeli');
  assert(filterExercises(all, { q: 'zzzxx' }).length === 0, 'eşleşmeyen → boş');
  const chestOnly = filterExercises(all, { muscle: 'Göğüs' });
  assert(chestOnly.length > 0 && chestOnly.every((e) => e.muscle === 'Göğüs'), 'kas çipi');
  const cardio = filterExercises(all, { kind: 'cardio' });
  assert(cardio.length >= 3 && cardio.every((e) => e.kind === 'cardio'), 'tür: kardiyo');
  assert(filterExercises(all, { kind: 'timed' }).some((e) => e.slug === 'plank'), 'tür: süreli (plank)');
  assert(filterExercises(all, { kind: 'bodyweight' }).every((e) => e.kind === 'bodyweight'), 'tür: vücut ağırlığı');
  assert(filterExercises(all, { q: 'bench', muscle: 'Sırt' }).length === 0, 'arama + kas birlikte (AND)');

  // ── geçmişi olmayan egzersiz: detay sorguları boş ama hatasız
  const pull = all.find((e) => e.slug === 'pullup')!;
  assert((await getExercise(db, pull.id))?.name === 'Pull-Up', 'getExercise');
  assert((await exerciseHistory(db, pull.id)).length === 0, 'exerciseHistory boş');
  assert((await cardioHistory(db, pull.id)).length === 0, 'cardioHistory boş');
  const bike = all.find((e) => e.kind === 'cardio')!;
  assert((await cardioHistory(db, bike.id)).length === 0 && (await exerciseHistory(db, bike.id)).length === 0, 'kardiyo: geçmiş yok → boş');

  // ── antrenmansız yeni rutin → listede → başlat
  const ids = [all.find((e) => e.slug === 'bench')!.id, pull.id];
  const before = (await listRoutines(db)).length;
  const items = ids.map((id) => ({ exercise_id: id, name: '', muscle: '', equipment: '', target_sets: 3, rep_min: 8, rep_max: 12, rest_seconds: null }));
  const rid = await saveRoutine(db, null, 'Göğüs + Sırt', items);
  const list = await listRoutines(db);
  assert(list.length === before + 1 && list.some((r) => r.id === rid && r.name === 'Göğüs + Sırt' && r.exercise_count === 2), 'yeni rutin listede (2 egzersiz)');
  const r = await getRoutine(db, rid);
  assert(r!.items.length === 2 && r!.items[0].exercise_id === ids[0] && r!.items[1].target_sets === 3, 'rutin kalemleri sıralı');
  assert((await getActiveWorkout(db)) == null, 'rutin oluşturmak antrenman başlatmaz');
  const wid = await startWorkout(db, rid);
  const d = await getWorkoutDetail(db, wid);
  assert(d!.workout.name === 'Göğüs + Sırt' && d!.exercises.length === 2 && d!.exercises[0].sets.length === 3, 'startWorkout: rutinden 2 egzersiz × 3 set');
  assert((await getActiveWorkout(db))?.id === wid, 'aktif antrenman');
  // geçmişsiz egzersizde öneri/önceki alanları hatasız
  assert(d!.exercises[1].previous.length === 0, 'geçmişsiz egzersiz: önceki seans yok');
})();
