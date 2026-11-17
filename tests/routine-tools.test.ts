// Görev 2.9 — rutin kopyalama/sıralama, antrenmandan rutini güncelleme, plaka hesaplayıcı, hatırlatıcılar
import { applyWorkoutToRoutine, duplicateRoutine, getRoutine, getRoutineDiff, listRoutines, reorderRoutines, saveRoutine, sortRoutines, startWorkout, finishWorkout, addExercisesToWorkout, deleteRoutine, getWorkoutDetail, addSet, removeWorkoutExercise, deleteSet } from '@/db/queries';
import { diffRoutine } from '@/lib/routine-diff';
import { calcPlates, describePerSide, DEFAULT_PLATES } from '@/lib/plates';
import { anyReminderOn, buildReminderSchedule, DEFAULT_REMINDERS, parseReminders, toExpoWeekday } from '@/lib/reminders';
import { assert, freshDb } from './helpers';

(async () => {
  // ── plaka hesaplayıcı
  const p1 = calcPlates(100, 20);
  assert(p1.exact && p1.perSide.join(',') === '25,15' && p1.achieved === 100, `100 kg = 25+15 her tarafa (${p1.perSide})`);
  const p2 = calcPlates(60, 20);
  assert(p2.exact && p2.perSide.join(',') === '20' && p2.warning === null, '60 kg = her tarafa 20');
  const p3 = calcPlates(62.5, 20);
  assert(p3.exact && p3.perSide.join(',') === '20,1.25', `62,5 kg = 20 + 1,25 (${p3.perSide})`);
  assert(describePerSide([20, 10, 2.5]) === '20 + 10 + 2,5', 'metin biçimi');
  const p4 = calcPlates(61, 20); // 20,5 / taraf → ulaşılamaz; en yakın 60 (20) veya 62,5
  assert(!p4.exact && p4.warning !== null && (p4.achieved === 60 || p4.achieved === 62.5), `ulaşılamayan ağırlık: en yakın ${p4.achieved} + uyarı`);
  const p5 = calcPlates(15, 20);
  assert(p5.perSide.length === 0 && p5.achieved === 20 && p5.warning !== null, 'bardan hafif → sadece bar + uyarı');
  const p6 = calcPlates(20, 20);
  assert(p6.exact && p6.perSide.length === 0 && p6.warning === null, 'tam bar ağırlığı');
  const p7 = calcPlates(30, 20, [20, 15]); // 5/taraf yok
  assert(!p7.exact && p7.warning !== null, 'plaka seti kısıtlı → uyarı');
  const p8 = calcPlates(70, 20, [20, 15]); // 25/taraf: 15+... 20+? 20+5 yok → 25 yok, en yakın 20 veya 30(15+15)
  assert(Math.abs(p8.achieved - 70) <= 10 && p8.perSide.every((x) => [20, 15].includes(x)), 'yalnızca seçili plakalar kullanılır');
  const p9 = calcPlates(60, 15); // 15 kg bar
  assert(p9.exact && p9.perSide.join(',') === '20,2.5', `15 kg bar: 60 = 20 + 2,5 (${p9.perSide})`);
  const p11 = calcPlates(80, 20, [20, 15]); // 30/taraf = 15+15 (açgözlü 20 başarısız olurdu)
  assert(p11.exact && p11.perSide.join(',') === '15,15', 'açgözlü olmayan çözüm: 30 = 15+15');
  const od = calcPlates(80.1, 20);
  assert(!od.exact && od.warning !== null && od.achieved === 80, '80,1 kg tam sayılmaz, uyarı verir');
  assert(calcPlates(80, 20).exact && calcPlates(62.5, 20).exact, 'tam hedefler exact');
  assert(calcPlates(0, 20).warning !== null && calcPlates(NaN, 20).warning !== null, 'geçersiz hedef');
  assert(calcPlates(500, 20, DEFAULT_PLATES).exact, 'çok ağır hedef de çözülür');

  // ── rutin farkı (saf)
  const R = [
    { exercise_id: 1, name: 'A', target_sets: 3, rep_min: 8, rep_max: 12 },
    { exercise_id: 2, name: 'B', target_sets: 3, rep_min: 8, rep_max: 12 },
    { exercise_id: 3, name: 'C', target_sets: 2, rep_min: 10, rep_max: 15 },
  ];
  assert(!diffRoutine(R, R).changed, 'aynı yapı → değişiklik yok');
  const d1 = diffRoutine(R, [R[0], { ...R[1], target_sets: 4 }, R[2], { exercise_id: 9, name: 'Z', target_sets: 3, rep_min: 8, rep_max: 12 }]);
  assert(d1.changed && d1.added[0] === 'Z' && d1.sets.length === 1 && d1.sets[0].from === 3 && d1.sets[0].to === 4, 'eklenen egzersiz + set sayısı farkı');
  const d2 = diffRoutine(R, [R[2], R[0]]);
  assert(d2.removed.join() === 'B' && d2.reordered, 'çıkarılan egzersiz + sıra değişimi');
  assert(d2.lines.some((l) => l.includes('B çıkarıldı')) && d2.lines.some((l) => l.includes('sırası')), 'Türkçe satırlar');
  assert(!diffRoutine(R, [R[0], R[1]]).reordered, 'çıkarma tek başına sıra değişimi sayılmaz');

  // ── hatırlatıcı mantığı (saf)
  assert(toExpoWeekday(0) === 2 && toExpoWeekday(6) === 1 && toExpoWeekday(5) === 7, 'Pazartesi=2 … Pazar=1 (expo)');
  assert(!anyReminderOn(DEFAULT_REMINDERS) && buildReminderSchedule(DEFAULT_REMINDERS, []).length === 0, 'varsayılan: hepsi kapalı, bildirim yok');
  assert(JSON.stringify(parseReminders('bozuk{')) === JSON.stringify(DEFAULT_REMINDERS) && JSON.stringify(parseReminders(null)) === JSON.stringify(DEFAULT_REMINDERS), 'bozuk/boş JSON → varsayılan');
  const odd = parseReminders(JSON.stringify({ workout: { on: true, days: [9, 2, 2, -1], hour: 31, minute: -5 }, weigh: { on: 'yes', day: 3 } }));
  assert(odd.workout.hour === 23 && odd.workout.minute === 0 && odd.workout.days.join() === '0,2,6', `değerler sınırlandı (${odd.workout.days}, ${odd.workout.hour}:${odd.workout.minute})`);
  assert(odd.weigh.on === false && odd.weigh.day === 3, 'on yalnızca true ise açık');
  const base = { ...DEFAULT_REMINDERS, workout: { on: true, days: [0, 2], hour: 18, minute: 30 } };
  const neutral = buildReminderSchedule(base, Array.from({ length: 7 }, (_, weekday) => ({ weekday, routine_name: null })));
  assert(neutral.length === 2 && neutral.every((n) => !n.body.includes('Bugün:')) && neutral[0].weekday === 2 && neutral[1].weekday === 4 && neutral[0].hour === 18 && neutral[0].minute === 30, 'plan yok: seçili günler, nötr metin');
  const plan = Array.from({ length: 7 }, (_, weekday) => ({ weekday, routine_name: weekday === 1 ? 'Sırt günü' : weekday === 4 ? 'Bacak' : null }));
  const planned = buildReminderSchedule(base, plan);
  assert(planned.length === 2 && planned[0].body === 'Bugün: Sırt günü 💪' && planned[0].weekday === 3 && planned[1].weekday === 6, 'plan var: yalnızca planlı günler, rutin adıyla');
  assert(new Set(planned.map((n) => n.id)).size === planned.length, 'bildirim kimlikleri benzersiz (idempotent yeniden kurulum)');
  const all = buildReminderSchedule({ workout: { on: false, days: [], hour: 7, minute: 0 }, weigh: { on: true, day: 6, hour: 8, minute: 15 }, meal: { on: true, hour: 21, minute: 0 } }, []);
  assert(all.length === 2 && all[0].weekday === 1 && all[1].weekday === undefined, 'tartılma haftalık (Pazar=1), öğün günlük');

  // ── v7 yedeği içe aktarılınca rutin sırası (v8 veri adımı)
  {
    const { raw: r0, db: d0 } = await freshDb();
    const { exportBackup, importBackup, parseBackup } = await import('@/db/backup');
    const ex0 = Number((r0.prepare('SELECT id FROM exercises LIMIT 1').get() as any).id);
    const mk = (n: string) => ({ exercise_id: ex0, name: '', muscle: '', equipment: '', target_sets: 3, rep_min: 8, rep_max: 12, rest_seconds: null as number | null });
    await saveRoutine(d0, null, 'A', [mk('A')]);
    await saveRoutine(d0, null, 'B', [mk('B')]);
    const bk = JSON.parse(JSON.stringify(await exportBackup(d0)));
    bk.schemaVersion = 7;
    for (const r of bk.tables.routines) delete r.sort_order;
    delete bk.tables.week_plan;
    const { db: d1 } = await freshDb();
    await importBackup(d1, parseBackup(JSON.stringify(bk)));
    const orders = (await listRoutines(d1)).map((r) => r.sort_order);
    assert(orders.length === 2 && orders[0] > 0 && orders[0] < orders[1], `v7 yedek: sort_order sıralı (${orders})`);
    const nid = await saveRoutine(d1, null, 'C', [mk('C')]);
    assert((await listRoutines(d1)).at(-1)!.id === nid, 'v7 yedek sonrası yeni rutin en sonda');
  }

  // ── DB: kopyala / sırala / sil
  const { raw, db } = await freshDb();
  const ids = (raw.prepare('SELECT id FROM exercises ORDER BY id LIMIT 4').all() as any[]).map((r) => Number(r.id));
  const item = (exId: number, sets = 3) => ({ exercise_id: exId, name: '', muscle: '', equipment: '', target_sets: sets, rep_min: 8, rep_max: 12, rest_seconds: null as number | null });
  const a = await saveRoutine(db, null, 'Sırt günü', [item(ids[0]), item(ids[1], 4)]);
  const b = await saveRoutine(db, null, 'Göğüs', [item(ids[2])]);
  const c = await saveRoutine(db, null, 'Bacak', [item(ids[3])]);
  assert((await listRoutines(db)).map((r) => r.id).join() === [a, b, c].join(), 'yeni rutinler sona eklenir (sıra korunur)');
  const copyId = await duplicateRoutine(db, a);
  const copy = await getRoutine(db, copyId!);
  assert(copy!.name === 'Sırt günü (kopya)' && copy!.items.length === 2 && copy!.items[1].target_sets === 4 && copy!.items[0].exercise_id === ids[0], 'kopya: ad + egzersizler + ayarlar');
  assert((await listRoutines(db)).at(-1)!.id === copyId, 'kopya listenin sonunda');
  assert((await duplicateRoutine(db, 99999)) === null, 'olmayan rutin kopyalanmaz');
  await reorderRoutines(db, [c, a, b, copyId!]);
  assert((await listRoutines(db)).map((r) => r.id).join() === [c, a, b, copyId].join(), 'elle sıralama kalıcı');
  const nr = await saveRoutine(db, null, 'Yeni', [item(ids[0])]);
  assert((await listRoutines(db)).at(-1)!.id === nr, 'elle sıralamadan sonra yeni rutin sona');
  await saveRoutine(db, a, 'Sırt günü', [item(ids[0])]);
  assert((await listRoutines(db)).map((r) => r.id).join() === [c, a, b, copyId, nr].join(), 'rutini düzenlemek sırayı bozmaz');
  const list = await listRoutines(db);
  raw.prepare('UPDATE routines SET created_at = ? WHERE id = ?').run(100, c);
  raw.prepare('UPDATE routines SET created_at = ? WHERE id = ?').run(500, b);
  const lst = (await listRoutines(db)).map((r) => ({ ...r, last_done: r.id === a ? 9000 : r.id === b ? 5000 : null }));
  assert(sortRoutines(lst, 'recent').slice(0, 2).map((r) => r.id).join() === [a, b].join(), 'sıralama: son yapılan');
  assert(sortRoutines(lst, 'name').map((r) => r.name)[0] === 'Bacak', 'sıralama: ad (Türkçe)');
  assert(sortRoutines(lst, 'created')[0].created_at >= sortRoutines(lst, 'created')[1].created_at, 'sıralama: oluşturulma (yeni önce)');
  assert(sortRoutines(lst, 'manual').map((r) => r.id).join() === list.map((r) => r.id).join(), 'sıralama: elle = veritabanı sırası');
  await deleteRoutine(db, copyId!);
  assert((await getRoutine(db, copyId!)) === null, 'rutin silindi');

  // ── antrenmandan rutini güncelle
  const rid = await saveRoutine(db, null, 'Push', [item(ids[0], 3), item(ids[1], 3)]);
  const doneOne = (wid: number) => raw.prepare('UPDATE sets SET done = 1, weight = 50, reps = 10 WHERE id = (SELECT s.id FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id WHERE we.workout_id = ? ORDER BY s.id LIMIT 1)').run(wid);
  const w0 = await startWorkout(db, rid);
  doneOne(w0);
  await finishWorkout(db, w0);
  assert((await getRoutineDiff(db, w0))!.changed === false, 'dokunulmayan antrenman → fark yok');
  const w = await startWorkout(db, rid);
  let det = (await getWorkoutDetail(db, w))!;
  await addSet(db, det.exercises[0].id); // 3 → 4 set
  await removeWorkoutExercise(db, det.exercises[1].id); // ikinci egzersiz çıkar
  await addExercisesToWorkout(db, w, [ids[2]]); // yeni egzersiz
  det = (await getWorkoutDetail(db, w))!;
  const warm = det.exercises[0].sets[0];
  raw.prepare("UPDATE sets SET set_type = 'warmup' WHERE id = ?").run(warm.id); // ısınma sayılmaz → 3 çalışma seti kalır
  await addSet(db, det.exercises[0].id); // tekrar 4 çalışma seti
  raw.prepare('UPDATE sets SET done = 1, weight = 50, reps = 10 WHERE id = ?').run(det.exercises[0].sets[1].id);
  await finishWorkout(db, w);
  const diff = (await getRoutineDiff(db, w))!;
  assert(diff.changed && diff.routineId === rid && diff.routineName === 'Push', 'fark bulundu');
  assert(diff.added.length === 1 && diff.removed.length === 1 && diff.sets.length === 1 && diff.sets[0].to === 4, 'eklenen/çıkarılan/set sayısı (ısınma hariç)');
  const before = await getRoutine(db, rid);
  assert(before!.items.length === 2 && before!.items[0].target_sets === 3, 'onaylanmadan rutin değişmez');
  assert((await applyWorkoutToRoutine(db, w)) === rid, 'rutin güncellendi');
  const after = await getRoutine(db, rid);
  assert(after!.name === 'Push' && after!.items.length === 2 && after!.items[0].target_sets === 4 && after!.items[1].exercise_id === ids[2], 'yeni yapı: ad korunur, sıra/set sayısı güncel');
  assert((await getRoutineDiff(db, w))!.changed === false, 'güncelledikten sonra fark kalmadı');
  const free = await startWorkout(db, null);
  assert((await getRoutineDiff(db, free)) === null && (await applyWorkoutToRoutine(db, free)) === null, 'rutinsiz antrenmanda öneri yok');
  await addExercisesToWorkout(db, free, [ids[0]]);
  doneOne(free);
  await finishWorkout(db, free);
  // atlanan set fark sayılmaz
  const w3 = await startWorkout(db, rid);
  const d3 = (await getWorkoutDetail(db, w3))!;
  await deleteSet(db, d3.exercises[0].sets[0].id);
  await addSet(db, d3.exercises[0].id);
  doneOne(w3); // yalnızca bir set yapıldı, kalanı atlandı (bitirirken silinir)
  await finishWorkout(db, w3);
  assert(raw.prepare('SELECT COUNT(*) n FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id WHERE we.workout_id = ?').get(w3)!.n === 1, 'atlanan setler bitişte silindi');
  assert((await getRoutineDiff(db, w3))!.changed === false, 'set sil + ekle = aynı sayı; atlanan set/egzersiz fark sayılmaz');
  assert((await getRoutineDiff(db, 99999)) === null, 'olmayan antrenman → null');
  await deleteRoutine(db, rid);
  assert((await getRoutineDiff(db, w3)) === null, 'rutin silinmişse öneri yok');
})();
