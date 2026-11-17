// Görev 2.10 — haftalık plan: migrasyon, CRUD, rutin silinince dinlenme, uyum, takvim, çakışma, yedek, hatırlatıcı entegrasyonu
import { DatabaseSync } from 'node:sqlite';
import { exportBackup, importBackup, parseBackup, BACKUP_TABLES } from '@/db/backup';
import { DB_VERSION, migrateDb } from '@/db/migrate';
import {
  applyWeekAssignments,
  clearWeekPlan,
  deleteAllData,
  deleteRoutine,
  ensureTemplateRoutines,
  getWeekPlan,
  listRoutines,
  saveRoutine,
  setWeekPlanNote,
  setWeekPlanRoutine,
  workoutsBetween,
} from '@/db/queries';
import { ROUTINE_TEMPLATES } from '@/db/seed';
import { startOfDay, startOfWeek } from '@/lib/format';
import { buildReminderSchedule, DEFAULT_REMINDERS } from '@/lib/reminders';
import { dayStatus, monthGrid, muscleFrequency, recoveryConflicts, shiftMonth, shortRoutineName, templateAssignments, WEEK_TEMPLATES, weekdayOf, weekDayTs, weeklyAdherence } from '@/lib/week-plan';
import { assert, freshDb, wrap } from './helpers';

(async () => {
  // ── hafta / gün hesapları (yerel saat dilimi)
  const wed = new Date(2026, 10, 18, 23, 30).getTime(); // 18 Kasım 2026 Çarşamba gece
  assert(weekdayOf(wed) === 2, 'Çarşamba = 2');
  assert(weekdayOf(new Date(2026, 10, 15, 0, 5).getTime()) === 6, 'Pazar = 6 (gece yarısından hemen sonra)');
  assert(weekdayOf(new Date(2026, 10, 16, 0, 0).getTime()) === 0, 'Pazartesi = 0');
  assert(new Date(startOfWeek(wed)).getDay() === 1 && new Date(startOfWeek(wed)).getDate() === 16, 'hafta Pazartesi (16 Kasım) başlar');
  assert(new Date(weekDayTs(wed, 6)).getDate() === 22 && new Date(weekDayTs(wed, 0)).getDate() === 16, 'weekDayTs: Pazar 22, Pazartesi 16');
  // yaz/kış saati geçişi haftası (Avrupa: 25 Ekim 2026) — gün sayıları kaymamalı
  const dstWeek = new Date(2026, 9, 21).getTime();
  assert([0, 1, 2, 3, 4, 5, 6].map((d) => new Date(weekDayTs(dstWeek, d)).getDate()).join() === '19,20,21,22,23,24,25', 'saat dilimi geçişinde günler doğru');

  // ── uyum: "bu hafta plan 4/5"
  const planned = [true, true, false, true, true, true, false];
  const adh = weeklyAdherence(planned, new Set([0, 1, 2, 4])); // 2. gün planda yok ama antrenman var → sayılmaz
  assert(adh.planned === 5 && adh.done === 3, `plan 3/5 (planlı olmayan gün sayılmaz) (${adh.done}/${adh.planned})`);
  assert(weeklyAdherence(planned, new Set([0, 1, 3, 4, 5])).done === 5, '5/5');
  assert(weeklyAdherence([false, false, false, false, false, false, false], new Set([1])).planned === 0, 'plan yok → 0 planlı');

  // ── gün durumu
  const now = new Date(2026, 10, 18, 12, 0).getTime();
  const day = (d: number) => new Date(2026, 10, d).getTime();
  assert(dayStatus(true, true, day(16), now) === 'done', 'yapıldı');
  assert(dayStatus(true, false, day(16), now) === 'missed', 'geçmiş planlı + yapılmadı = kaçırıldı');
  assert(dayStatus(true, false, day(18), now) === 'upcoming', 'bugün planlı + henüz yapılmadı = bekliyor (kaçırılmadı)');
  assert(dayStatus(true, false, day(20), now) === 'upcoming', 'gelecek planlı');
  assert(dayStatus(false, false, day(17), now) === 'rest', 'planlı değil = dinlenme');
  assert(dayStatus(false, true, day(17), now) === 'done', 'plansız gün ama antrenman yapıldı = yapıldı');

  // ── ay takvimi
  const nov = monthGrid(2026, 10); // 1 Kasım 2026 = Pazar
  assert(nov.length === 6 && nov.every((r) => r.length === 7), 'Kasım 2026: 6 hafta (Pazar başlıyor)');
  assert(new Date(nov[0][0].ts).getDate() === 26 && new Date(nov[0][0].ts).getMonth() === 9 && !nov[0][0].inMonth, 'ilk hücre 26 Ekim (Pazartesi), ay dışı');
  assert(nov[0][6].inMonth && new Date(nov[0][6].ts).getDate() === 1, '1 Kasım ilk satırın son hücresi (Pazar)');
  assert(nov.flat().filter((c) => c.inMonth).length === 30, 'ay içi 30 gün');
  const feb = monthGrid(2027, 1); // 1 Şubat 2027 = Pazartesi, 28 gün → 4 satır
  assert(feb.length === 4 && feb[0][0].inMonth && feb.flat().every((c) => c.inMonth), 'Şubat 2027 tam 4 satır');
  const leap = monthGrid(2028, 1);
  assert(leap.flat().filter((c) => c.inMonth).length === 29, 'artık yıl: Şubat 2028 = 29 gün');
  assert(nov.flat().every((c, i, a) => i === 0 || new Date(c.ts).getTime() > new Date(a[i - 1].ts).getTime() && startOfDay(c.ts) === c.ts), 'hücreler artan ve gece yarısı');
  assert(JSON.stringify(shiftMonth(2026, 11, 1)) === '{"year":2027,"month":0}' && JSON.stringify(shiftMonth(2026, 0, -1)) === '{"year":2025,"month":11}', 'ay değiştirme yıl sınırını geçer');

  // ── toparlanma çakışması
  const M = (...x: string[]) => x;
  const none = recoveryConflicts([M('Göğüs'), M('Sırt'), M('Bacak'), [], M('Göğüs'), M('Sırt'), []], 2);
  assert(none.length === 0, 'aralıklı plan: çakışma yok');
  const back2back = recoveryConflicts([M('Göğüs', 'Triceps'), M('Göğüs'), [], [], [], [], []], 2);
  assert(back2back.length === 1 && back2back[0].muscle === 'Göğüs' && back2back[0].days.join() === '0,1' && back2back[0].gap === 1, 'Göğüs Pzt-Sal art arda');
  const wrapC = recoveryConflicts([M('Bacak'), [], [], [], [], [], M('Bacak')], 2);
  assert(wrapC.length === 1 && wrapC[0].days.join() === '6,0', 'Pazar → Pazartesi geçişi de kontrol edilir');
  assert(recoveryConflicts([M('Göğüs'), [], M('Göğüs'), [], [], [], []], 2).length === 0, '2 gün arayla = önerilen dinlenme tamam');
  assert(recoveryConflicts([M('Göğüs'), [], M('Göğüs'), [], [], [], []], 3).length === 1, 'önerilen 3 gün ise 2 gün ara çakışma');
  assert(recoveryConflicts([M('Kardiyo'), M('Kardiyo'), [], [], [], [], []], 2).length === 0, 'kardiyo hariç');
  assert(recoveryConflicts([M('Göğüs'), [], [], [], [], [], []], 3).length === 0, 'haftada tek gün = çakışma yok');
  const freq = muscleFrequency([M('Göğüs', 'Göğüs'), M('Sırt'), M('Göğüs'), [], [], [], []]);
  assert(freq[0].muscle === 'Göğüs' && freq[0].days === 2 && freq[1].muscle === 'Sırt' && freq[1].days === 1, 'kas sıklığı (gün başına bir kez)');
  assert(shortRoutineName('Göğüs günü') === 'Göğüs' && shortRoutineName('Full Body A', 3) === 'Fu.' && shortRoutineName('Full Body A', 4) === 'Full' && shortRoutineName(null) === '', 'kısa ad');

  // ── şablonlar rutin adlarıyla uyumlu
  for (const tpl of WEEK_TEMPLATES) {
    const names = new Set(ROUTINE_TEMPLATES[tpl.source].map((r) => r.name));
    assert(Object.values(tpl.days).every((n) => names.has(n)), `şablon ${tpl.key}: rutin adları ROUTINE_TEMPLATES'ta var`);
  }

  // ── migrasyon: idempotent, v9 tablosu
  const raw = new DatabaseSync(':memory:');
  const db = wrap(raw);
  await migrateDb(db);
  assert((raw.prepare('PRAGMA user_version').get() as any).user_version === DB_VERSION && DB_VERSION >= 9, `şema v${DB_VERSION}`);
  raw.exec('PRAGMA user_version = 8'); // yarıda kalan v9 (tablo var, sürüm geride)
  await migrateDb(db);
  await migrateDb(db);
  assert((raw.prepare('PRAGMA user_version').get() as any).user_version === DB_VERSION, 'v9 migrasyonu tekrar çalışınca hata yok');
  const cols = (raw.prepare('PRAGMA table_info(week_plan)').all() as any[]).map((c) => c.name).join();
  assert(cols === 'weekday,routine_id,note', `week_plan sütunları (${cols})`);
  assert((raw.prepare('PRAGMA table_info(routines)').all() as any[]).some((c) => c.name === 'sort_order'), 'routines.sort_order (v8)');
  assert(BACKUP_TABLES.includes('week_plan'), 'week_plan yedek tablolarında');
  // v7 DB'den yükseltme: mevcut rutinler sort_order = id alır
  const old = new DatabaseSync(':memory:');
  const oldDb = wrap(old);
  await migrateDb(oldDb);
  old.exec('DROP TABLE week_plan; PRAGMA user_version = 7;');
  await migrateDb(oldDb);
  assert((old.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name = 'week_plan'").get() as any).n === 1, 'v7 → güncel: week_plan oluştu');

  // ── CRUD
  const exIds = (raw.prepare('SELECT id, muscle FROM exercises ORDER BY id').all() as any[]);
  const chest = Number(exIds.find((e) => e.muscle === 'Göğüs').id);
  const back = Number(exIds.find((e) => e.muscle === 'Sırt').id);
  const it = (exId: number) => ({ exercise_id: exId, name: '', muscle: '', equipment: '', target_sets: 3, rep_min: 8, rep_max: 12, rest_seconds: null as number | null });
  const rChest = await saveRoutine(db, null, 'Göğüs günü', [it(chest)]);
  const rBack = await saveRoutine(db, null, 'Sırt günü', [it(back)]);
  let plan = await getWeekPlan(db);
  assert(plan.length === 7 && plan.every((d, i) => d.weekday === i && d.routine_id === null && d.note === null), 'boş plan: 7 gün, hepsi dinlenme');
  await setWeekPlanRoutine(db, 0, rChest);
  await setWeekPlanRoutine(db, 1, rBack);
  await setWeekPlanNote(db, 1, '  sabah  ');
  plan = await getWeekPlan(db);
  assert(plan[0].routine_name === 'Göğüs günü' && plan[0].muscles.join() === 'Göğüs' && plan[1].routine_name === 'Sırt günü' && plan[1].note === 'sabah' && plan[2].routine_id === null, 'atama + not + kas listesi');
  await setWeekPlanRoutine(db, 1, rChest);
  assert((await getWeekPlan(db))[1].note === 'sabah', 'rutin değişince not korunur');
  await setWeekPlanNote(db, 3, 'Yürüyüş'); // rutinsiz not = dinlenme günü notu
  assert((await getWeekPlan(db))[3].note === 'Yürüyüş' && (await getWeekPlan(db))[3].routine_id === null, 'dinlenme gününe not');
  await setWeekPlanNote(db, 3, '   ');
  assert((raw.prepare('SELECT COUNT(*) n FROM week_plan WHERE weekday = 3').get() as any).n === 0, 'boş not + rutin yok → satır silinir');
  try {
    raw.prepare('INSERT INTO week_plan (weekday) VALUES (7)').run();
    assert(false, 'geçersiz gün reddedilmeli');
  } catch (e: any) {
    assert(!String(e.message).startsWith('FAIL'), 'geçersiz gün (7) veritabanında reddedildi');
  }

  // rutin silinince o gün dinlenme olur
  await setWeekPlanRoutine(db, 4, rBack);
  await setWeekPlanNote(db, 4, 'akşam');
  raw.exec('PRAGMA foreign_keys = ON');
  await deleteRoutine(db, rBack);
  plan = await getWeekPlan(db);
  assert(plan[4].routine_id === null && plan[4].routine_name === null && plan[4].note === 'akşam', 'rutin silinince gün dinlenmeye döner (not kalır)');
  assert(plan[0].routine_id === rChest, 'diğer günler etkilenmez');

  // şablon: idempotent, mevcut aynı adlı rutini kullanır
  const ppl = WEEK_TEMPLATES.find((t) => t.key === 'ppl3')!;
  const before = (await listRoutines(db)).length;
  const ids1 = await ensureTemplateRoutines(db, 'ppl');
  const ids2 = await ensureTemplateRoutines(db, 'ppl');
  assert([...ids1.entries()].every(([n, id]) => ids2.get(n) === id) && (await listRoutines(db)).length === before + 3, 'şablon rutinleri bir kez oluşur (Push/Pull/Legs)');
  await applyWeekAssignments(db, templateAssignments(ppl, ids1));
  plan = await getWeekPlan(db);
  assert(plan.map((d) => d.routine_name ?? '-').join() === 'Push,-,Pull,-,Legs,-,-', `PPL 3 gün atandı (${plan.map((d) => d.routine_name ?? '-')})`);
  assert(plan[4].note === 'akşam', 'şablon notları korur');
  assert(plan[0].muscles.length > 0, 'şablon rutininin kasları var');
  const conf = recoveryConflicts(plan.map((d) => d.muscles), 2);
  assert(Array.isArray(conf), 'plan çakışma hesabına girer');

  // ── yedek: week_plan dışa → içe
  const backup = await exportBackup(db);
  assert(backup.tables.week_plan.length === 4 /* 3 rutin + 1 notlu dinlenme günü */ && backup.schemaVersion === DB_VERSION, 'yedekte week_plan satırları');
  const { db: db2 } = await freshDb();
  await importBackup(db2, parseBackup(JSON.stringify(backup)));
  const plan2 = await getWeekPlan(db2);
  assert(plan2.map((d) => d.routine_name ?? '-').join() === plan.map((d) => d.routine_name ?? '-').join() && plan2[4].note === 'akşam', 'dışa → içe aktarma aynı plan');
  const v8 = JSON.parse(JSON.stringify(backup));
  v8.schemaVersion = 8;
  delete v8.tables.week_plan;
  const { db: db3 } = await freshDb();
  await importBackup(db3, parseBackup(JSON.stringify(v8)));
  assert((await getWeekPlan(db3)).every((d) => d.routine_id === null), 'eski yedek (plan yok) → boş plan');

  // ── tümünü sil planı temizler
  await deleteAllData(db);
  assert((raw.prepare('SELECT COUNT(*) n FROM week_plan').get() as any).n === 0, 'deleteAllData week_plan temizler');
  await setWeekPlanNote(db, 2, 'x');
  await clearWeekPlan(db);
  assert((raw.prepare('SELECT COUNT(*) n FROM week_plan').get() as any).n === 0, 'clearWeekPlan');

  // ── takvim sorgusu: ay aralığı
  const { raw: r4, db: db4 } = await freshDb();
  const ex = Number((r4.prepare('SELECT id FROM exercises LIMIT 1').get() as any).id);
  const rid = await saveRoutine(db4, null, 'Test', [it(ex)]);
  const add = (name: string, ts: number, routine: number | null, done = true) =>
    r4.prepare('INSERT INTO workouts (name, routine_id, started_at, finished_at) VALUES (?, ?, ?, ?)').run(name, routine, ts, done ? ts + 3600000 : null);
  add('A', new Date(2026, 9, 31, 23, 59).getTime(), rid);
  add('B', new Date(2026, 10, 1, 0, 0).getTime(), rid);
  add('C', new Date(2026, 10, 30, 23, 59).getTime(), null);
  add('D', new Date(2026, 11, 1, 0, 0).getTime(), rid);
  add('Açık', new Date(2026, 10, 10).getTime(), rid, false);
  const got = await workoutsBetween(db4, new Date(2026, 10, 1).getTime(), new Date(2026, 11, 1).getTime());
  assert(got.map((w) => w.name).join() === 'B,C', `ay sınırları ve açık antrenman hariç (${got.map((w) => w.name)})`);

  // ── hatırlatıcı entegrasyonu: plan değişince bildirimler değişir
  const rem = { ...DEFAULT_REMINDERS, workout: { on: true, days: [0, 1, 2, 3, 4, 5, 6], hour: 7, minute: 45 } };
  const p0 = plan.map((d) => ({ weekday: d.weekday, routine_name: d.routine_name }));
  const s0 = buildReminderSchedule(rem, p0);
  assert(s0.length === 3 && s0.map((n) => n.body).join('|') === 'Bugün: Push 💪|Bugün: Pull 💪|Bugün: Legs 💪', 'plan: yalnız planlı günler, rutin adıyla (seçili 7 gün yok sayılır)');
  const s1 = buildReminderSchedule(rem, p0.map((d) => (d.weekday === 2 ? { ...d, routine_name: 'Omuz' } : d)));
  assert(s1.find((n) => n.id.endsWith('workout:2'))!.body === 'Bugün: Omuz 💪', 'plan değişince yeniden kurulacak liste güncellenir');
  const s2 = buildReminderSchedule(rem, p0.map((d) => ({ ...d, routine_name: null })));
  assert(s2.length === 7 && s2[0].body.indexOf('Bugün:') === -1, 'plan boşalınca seçili günler + nötr metin');
})();
