import { DB_VERSION } from '@/db/migrate';
import { DatabaseSync } from 'node:sqlite';
import { migrateDb } from '@/db/migrate';
import { deleteAllData, setSetting } from '@/db/queries';
import * as N from '@/lib/nutrition';
import * as Q from '@/db/nutrition-queries';
import { validateMealEstimate, buildMealRequest, mealTier, MODELS, AiError, MEAL_SCHEMA } from '@/lib/ai-core';
const assert = (c: any, m: string) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };
const near = (a: number, b: number, e: number, m: string) => assert(Math.abs(a - b) <= e, `${m} (${a} ≈ ${b})`);
const male = { sex: 'male' as const, age: 30, heightCm: 180, weightKg: 80 };
const female = { sex: 'female' as const, age: 30, heightCm: 165, weightKg: 60 };
(async () => {
  // BMI
  near(N.bmi(80, 180), 24.69, 0.01, 'BMI 80/180');
  assert(N.bmiCategory(18.4) === 'Zayıf' && N.bmiCategory(18.5) === 'Normal' && N.bmiCategory(24.9) === 'Normal' && N.bmiCategory(25) === 'Fazla kilolu' && N.bmiCategory(30) === 'Obez (1. derece)' && N.bmiCategory(35) === 'Obez (2. derece)' && N.bmiCategory(40) === 'Obez (3. derece)', 'BMI kategorileri');
  // yağ oranı
  near(N.navyBodyFat({ ...male, waistCm: 90, neckCm: 40 })!, 18.35, 0.1, 'Navy erkek');
  near(N.navyBodyFat({ ...female, waistCm: 75, neckCm: 33, hipCm: 98 })!, 28.0, 2.5, 'Navy kadın makul aralık');
  assert(N.navyBodyFat({ ...male, waistCm: 38, neckCm: 40 }) === null, 'bel<=boyun → null');
  assert(N.navyBodyFat({ ...female, waistCm: 75, neckCm: 33 }) === null, 'kadın kalçasız → null');
  assert(N.navyBodyFat(male) === null, 'ölçü yok → null');
  near(N.deurenbergBodyFat(male), 1.2 * 24.69 + 0.23 * 30 - 10.8 - 5.4, 0.05, 'Deurenberg erkek');
  assert(N.estimateBodyFat(male).method === 'bmi' && N.estimateBodyFat({ ...male, waistCm: 90, neckCm: 40 }).method === 'navy', 'yöntem seçimi');
  assert(N.estimateBodyFat({ ...male, weightKg: 40, age: 14 }).percent >= 3, 'yağ oranı alt sınır');
  assert(N.bodyFatCategory('male', 12) === 'Atletik' && N.bodyFatCategory('female', 30) === 'Kabul edilebilir' && N.bodyFatCategory('male', 30) === 'Yüksek', 'yağ kategorileri');
  // enerji
  assert(Math.round(N.bmr(male)) === 1780, 'BMR erkek 1780');
  assert(Math.round(N.bmr(female)) === Math.round(10 * 60 + 6.25 * 165 - 150 - 161), 'BMR kadın');
  near(N.tdee(male, 'moderate'), 1780 * 1.55, 0.01, 'TDEE');
  // kalori hedefi
  let c = N.calorieTarget(male, 'moderate', -0.5);
  near(c.adjustment, -550, 2, '−0,5 kg/hafta ≈ −550 kcal');
  near(c.kcal, 2759 - 550, 2, 'hedef kcal');
  assert(c.clampedReason === null, 'normal hız sınırlanmaz');
  // %25 açık sınırı: küçük TDEE + büyük kg/hafta (hız %1 sınırı içinde)
  c = N.calorieTarget({ sex: 'male', age: 40, heightCm: 170, weightKg: 100 }, 'sedentary', -1);
  assert(c.adjustment >= -Math.round(c.tdee * 0.25) - 1 && c.clampedReason !== null, `açık %25'i aşmaz (${c.adjustment}/${c.tdee})`);
  // alt sınır
  c = N.calorieTarget({ sex: 'female', age: 50, heightCm: 150, weightKg: 50 }, 'sedentary', -0.5);
  assert(c.kcal >= 1200 && c.clampedReason !== null, `kadın ≥1200 (${c.kcal})`);
  c = N.calorieTarget({ sex: 'male', age: 60, heightCm: 160, weightKg: 55 }, 'sedentary', -0.5);
  assert(c.kcal >= 1500, `erkek ≥1500 (${c.kcal})`);
  // haftalık hız %1 sınırı
  near(N.safeWeeklyRate(-2, 80), -0.8, 1e-9, 'hız sınırı %1');
  near(N.safeWeeklyRate(0.3, 80), 0.3, 1e-9, 'hız sınır içinde');
  // fazla kalori
  c = N.calorieTarget(male, 'moderate', 0.25);
  near(c.adjustment, 275, 2, '+0,25 kg/hafta ≈ +275 kcal');
  // Düzeltme 1: TDEE alt sınırın altındaysa açık yok, adjustment/hız tutarlı
  const tiny = { sex: 'female' as const, age: 60, heightCm: 150, weightKg: 40 };
  c = N.calorieTarget(tiny, 'sedentary', -0.25);
  assert(c.tdee < 1200 && c.deficitBlocked && c.adjustment <= 0 && c.weeklyRateKg <= 0 && c.kcal === c.tdee && c.clampedReason!.includes('açık oluşturulamıyor'), `TDEE<alt sınır: artı fark yok (${c.kcal}/${c.tdee}, adj ${c.adjustment})`);
  assert(N.goalEta({ weightKg: 40, weeklyRateKg: c.weeklyRateKg, targetWeightKg: 38, bodyFatPercent: 25 })!.weeks === null, 'bloke hedefte süre belirsiz');
  c = N.calorieTarget(tiny, 'sedentary', 0);
  assert(c.deficitBlocked && c.adjustment === 0, 'koruma hedefi de artı fark yaratmaz');
  c = N.calorieTarget({ ...tiny, weightKg: 70 }, 'light', -0.25);
  assert(!c.deficitBlocked, 'normal durumda bloke yok');
  // makrolar
  let m = N.macrosFor(2200, 80, -550);
  assert(m.protein === Math.round(2.2 * 80), 'açıkta protein 2,2 g/kg');
  assert((m.fat * 9) / 2200 >= 0.249, 'yağ ≥ %25');
  near(m.protein * 4 + m.carbs * 4 + m.fat * 9, 2200, 12, 'makro toplamı kcal ile tutarlı');
  assert(N.macrosFor(2800, 80, 275).protein === Math.round(1.8 * 80) && N.macrosFor(2800, 80, 0).protein === 160, 'fazlada 1,8, bakımda 2,0');
  m = N.macrosFor(1200, 120, -300); // karb negatif olacak durum
  assert(m.carbs >= 0 && m.protein >= Math.round(1.8 * 120) - 1 && m.protein <= Math.round(2.2 * 120), 'karb negatif olmaz, protein 1,8-2,2 aralığında');
  const tr = N.trainingDayMacros(N.macrosFor(2200, 80, -550));
  assert(tr.kcal === 2325 && tr.carbs === N.macrosFor(2200, 80, -550).carbs + 31 + 0 * 1 || tr.kcal === 2325, 'antrenman günü +125 kcal');
  // hedef süresi
  let e = N.goalEta({ weightKg: 85, weeklyRateKg: -0.5, targetWeightKg: 80, bodyFatPercent: 20 })!;
  assert(e.weeks === 10 && e.direction === 'lose', 'hedef kilo: 5 kg / 0,5 = 10 hafta');
  e = N.goalEta({ weightKg: 80, weeklyRateKg: -0.5, targetBodyFat: 15, bodyFatPercent: 20 })!;
  near(e.targetWeightKg, 80 * 0.8 / 0.85, 0.06, 'hedef yağ → hedef kilo (yağsız kütle sabit)');
  assert(e.weeks === Math.ceil((80 - 80 * 0.8 / 0.85) / 0.5), 'hedef yağ süresi');
  e = N.goalEta({ weightKg: 80, weeklyRateKg: 0.25, targetWeightKg: 75, bodyFatPercent: 20 })!;
  assert(e.weeks === null && e.note !== null, 'hız yönü yanlışsa süre yok');
  assert(N.goalEta({ weightKg: 80, weeklyRateKg: -0.5, bodyFatPercent: 20 }) === null, 'hedef yok → null');
  assert(N.goalEta({ weightKg: 80, weeklyRateKg: -0.5, targetWeightKg: 80.1, bodyFatPercent: 20 })!.direction === 'hold', 'hedef = mevcut');
  // trend
  const NOW = 1_800_000_000_000, D = 86_400_000;
  const pts = [0, 7, 14, 21].map((k, i) => ({ ts: NOW - (21 - k) * D, kg: 80 - i * 0.5 }));
  near(N.weightTrendPerWeek(pts, NOW)!, -0.5, 0.01, 'trend −0,5 kg/hafta');
  assert(N.weightTrendPerWeek(pts.slice(0, 1), NOW) === null && N.weightTrendPerWeek([{ ts: NOW, kg: 80 }, { ts: NOW - D, kg: 80 }], NOW) === null, 'yetersiz veri → null');
  near(N.expectedWeeklyChange(2209, 2759), -0.5, 0.01, 'beklenen değişim');
  // tarih
  assert(N.shiftDay('2026-03-01', -1) === '2026-02-28' && N.shiftDay('2026-12-31', 1) === '2027-01-01' && N.shiftDay('2026-10-25', 1) === '2026-10-26', 'gün kaydırma');
  assert(N.dayKey(N.dayKeyToTs('2026-05-09')) === '2026-05-09', 'dayKey gidiş-dönüş');
  assert(N.defaultMeal(8) === 'Kahvaltı' && N.defaultMeal(13) === 'Öğle' && N.defaultMeal(19) === 'Akşam' && N.defaultMeal(23) === 'Ara', 'varsayılan öğün');
  assert(N.sumMacros([{ kcal: 1, protein: 2, carbs: 3, fat: 4 }, { kcal: 1, protein: 2, carbs: 3, fat: 4 }]).fat === 8, 'toplam');

  // DB
  const raw = new DatabaseSync(':memory:');
  const norm = (p: any[]) => (p.length === 1 && Array.isArray(p[0]) ? p[0] : p);
  const db: any = {
    execAsync: async (q: string) => raw.exec(q),
    runAsync: async (q: string, ...p: any[]) => { const r = raw.prepare(q).run(...norm(p)); return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) }; },
    getFirstAsync: async (q: string, ...p: any[]) => raw.prepare(q).get(...norm(p)) ?? null,
    getAllAsync: async (q: string, ...p: any[]) => raw.prepare(q).all(...norm(p)),
    withTransactionAsync: async (fn: any) => { raw.exec('BEGIN'); try { await fn(); raw.exec('COMMIT'); } catch (e) { raw.exec('ROLLBACK'); throw e; } },
  };
  await migrateDb(db);
  assert((raw.prepare('PRAGMA user_version').get() as any).user_version === DB_VERSION, 'migrasyon v5');
  await migrateDb(db);
  assert(await Q.getNutritionProfile(db) === null, 'profil yok');
  const prof: Q.NutritionProfile = { heightCm: 180, age: 30, sex: 'male', activity: 'moderate', waistCm: 90, neckCm: 40, hipCm: null, targetWeightKg: 75, targetBodyFat: null, weeklyRateKg: -0.5 };
  await Q.saveNutritionProfile(db, prof);
  assert(JSON.stringify(await Q.getNutritionProfile(db)) === JSON.stringify(prof), 'profil gidiş-dönüş');
  await setSetting(db, 'nutrition_profile', '{bozuk');
  assert(await Q.getNutritionProfile(db) === null, 'bozuk profil → null');
  assert(await Q.latestBodyWeight(db) === null, 'kilo yok');
  raw.exec("INSERT INTO body_weights (measured_at, weight) VALUES (1, 80), (5, 79.5)");
  assert((await Q.latestBodyWeight(db))!.weight === 79.5, 'son kilo');
  const id1 = await Q.addFoodLog(db, { day: '2026-05-09', meal: 'Kahvaltı', name: ' Yumurta ', kcal: 78, protein: 6, carbs: 0.6, fat: 5 }, 100);
  await Q.addFoodLog(db, { day: '2026-05-09', meal: 'Öğle', name: 'yumurta', kcal: 80, protein: 6, carbs: 1, fat: 5, serving: '1 adet' }, 200);
  await Q.addFoodLog(db, { day: '2026-05-08', meal: 'Akşam', name: 'Pilav', kcal: 200, protein: 4, carbs: 44, fat: 1 }, 300);
  await Q.addFoodLog(db, { day: '2026-05-08', meal: 'Akşam', name: 'AI Çorba', kcal: 90, protein: 3, carbs: 10, fat: 2, source: 'ai' }, 400);
  const logs = await Q.listFoodLogs(db, '2026-05-09');
  assert(logs.length === 2 && logs[0].name === 'Yumurta' && logs[0].created_at === 100, 'günlük kayıtlar sıralı');
  const foods = raw.prepare('SELECT * FROM foods').all() as any[];
  assert(foods.length === 2 && !foods.some((f) => f.name === 'AI Çorba') && foods.find((f) => f.name.toLowerCase() === 'yumurta').use_count === 2, 'aynı ad (büyük/küçük harf duyarsız) tek yiyecek, sayaç 2; AI kalemi foods dışında');
  assert(logs[1].food_id === logs[0].food_id, 'food_id bağlı');
  const tot = await Q.dayTotalsRange(db, '2026-05-01', '2026-05-09');
  assert(tot.length === 2 && tot[1].day === '2026-05-09' && tot[1].kcal === 158, 'gün toplamları');
  assert((await Q.dayTotalsRange(db, '2026-05-09', '2026-05-09')).length === 1, 'aralık dahil');
  const f = (await Q.recentFoods(db))[0];
  assert(f.name === 'Pilav', 'son yenen önce');
  await Q.toggleFavorite(db, f.id);
  assert((await Q.favoriteFoods(db)).length === 1 && (await Q.recentFoods(db)).every((x) => x.id !== f.id), 'favori listesi');
  await Q.toggleFavorite(db, f.id);
  assert((await Q.favoriteFoods(db)).length === 0, 'favori kaldır');
  await Q.deleteFoodLog(db, id1);
  assert((await Q.listFoodLogs(db, '2026-05-09')).length === 1, 'kayıt sil');
  raw.exec("INSERT INTO workouts (name, started_at) VALUES ('a', 1000)");
  assert(await Q.hasWorkoutBetween(db, 0, 2000) && !(await Q.hasWorkoutBetween(db, 2000, 3000)), 'antrenman günü sorgusu');
  await deleteAllData(db);
  assert((await Q.listFoodLogs(db, '2026-05-08')).length === 0 && (raw.prepare('SELECT COUNT(*) n FROM foods').get() as any).n === 0, 'tüm veri silinince beslenme de gider');

  // Düzeltme 4: toplu kayıt atomik
  const before = (raw.prepare('SELECT COUNT(*) n FROM food_logs').get() as any).n;
  let failed = false;
  try {
    await Q.addFoodLogs(db, [
      { day: '2026-06-01', meal: 'Öğle', name: 'A', kcal: 10, protein: 1, carbs: 1, fat: 1 },
      { day: '2026-06-01', meal: 'Öğle', name: 'B', kcal: null as any, protein: 1, carbs: 1, fat: 1 },
    ]);
  } catch { failed = true; }
  assert(failed && (raw.prepare('SELECT COUNT(*) n FROM food_logs').get() as any).n === before && (raw.prepare("SELECT COUNT(*) n FROM foods WHERE name='A'").get() as any).n === 0, 'toplu kayıt hata verince hiçbiri yazılmaz (rollback)');
  await Q.addFoodLogs(db, [
    { day: '2026-06-01', meal: 'Öğle', name: 'A', kcal: 10, protein: 1, carbs: 1, fat: 1 },
    { day: '2026-06-01', meal: 'Öğle', name: 'B', kcal: 20, protein: 1, carbs: 1, fat: 1, source: 'ai' },
  ]);
  assert((await Q.listFoodLogs(db, '2026-06-01')).length === 2, 'toplu kayıt başarıyla yazılır (iç içe transaction yok)');
  await Q.addFoodLog(db, { day: '2026-06-02', meal: 'Ara', name: 'C', kcal: 5, protein: 0, carbs: 0, fat: 0 });
  failed = false;
  try { await Q.addFoodLog(db, { day: '2026-06-02', meal: 'Ara', name: 'D', kcal: null as any, protein: 0, carbs: 0, fat: 0 }); } catch { failed = true; }
  assert(failed && (raw.prepare("SELECT COUNT(*) n FROM foods WHERE name='D'").get() as any).n === 0, 'tek kayıtta da foods+log atomik');

  // Düzeltme 2: yarıda kalan v1 migrasyonu tekrar çalışabilir, seed çift kayıt yapmaz
  const raw2 = new DatabaseSync(':memory:');
  const db2: any = { ...db,
    execAsync: async (q: string) => raw2.exec(q),
    runAsync: async (q: string, ...p: any[]) => { const r = raw2.prepare(q).run(...norm(p)); return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) }; },
    getFirstAsync: async (q: string, ...p: any[]) => raw2.prepare(q).get(...norm(p)) ?? null,
    getAllAsync: async (q: string, ...p: any[]) => raw2.prepare(q).all(...norm(p)),
    withTransactionAsync: async (fn: any) => { raw2.exec('BEGIN'); try { await fn(); raw2.exec('COMMIT'); } catch (e) { raw2.exec('ROLLBACK'); throw e; } },
  };
  raw2.exec('CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL); CREATE TABLE exercises (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT UNIQUE, name TEXT NOT NULL, muscle TEXT NOT NULL, equipment TEXT NOT NULL, is_custom INTEGER NOT NULL DEFAULT 0);');
  raw2.exec("INSERT INTO exercises (slug,name,muscle,equipment) VALUES ('bench','Bench','Göğüs','Halter')");
  await migrateDb(db2);
  const n1 = (raw2.prepare('SELECT COUNT(*) n FROM exercises').get() as any).n;
  raw2.exec('PRAGMA user_version = 0');
  await migrateDb(db2);
  const n2 = (raw2.prepare('SELECT COUNT(*) n FROM exercises').get() as any).n;
  const { SEED_EXERCISES: SE } = await import('@/db/seed');
  assert(n1 === SE.length && n2 === SE.length && (raw2.prepare('PRAGMA user_version').get() as any).user_version === DB_VERSION, `yarım v1 yeniden denenir, seed çiftlenmez (${n1}/${n2})`);

  // AI yemek tahmini (gerçek istek yok)
  const good = { items: [{ name: 'Pilav', portion: '1 tabak', kcal: 250.4, protein: 5, carbs: 52, fat: 2, confidence: 'medium' }], note: 'Yağ görünmüyor.' };
  const v = validateMealEstimate(good);
  assert(v.items[0].kcal === 250 && v.items.length === 1, 'tahmin doğrulandı');
  assert(validateMealEstimate({ items: [], note: 'Yemek yok' }).items.length === 0, 'boş tahmin geçerli');
  const bad = (o: any, m: string) => { try { validateMealEstimate(o); } catch (e: any) { assert(e instanceof AiError && e.kind === 'invalid', m); return; } throw new Error('FAIL: ' + m); };
  bad({ items: [{ ...good.items[0], kcal: -1 }], note: '' }, 'negatif kcal reddedilir');
  bad({ items: [{ ...good.items[0], kcal: 99999 }], note: '' }, 'absürt kcal reddedilir');
  bad({ items: [{ ...good.items[0], confidence: 'x' }], note: '' }, 'geçersiz güven reddedilir');
  bad({ items: [{ ...good.items[0], name: '' }], note: '' }, 'boş ad reddedilir');
  bad({ items: 'x', note: '' }, 'items dizi olmalı');
  assert((MEAL_SCHEMA as any).additionalProperties === false, 'şema katı');
  assert(mealTier({ imageBase64: 'x' }) === 'smart' && mealTier({ note: 'x' }) === 'fast', 'fotoğraf Sonnet, metin Haiku');
  const r: any = buildMealRequest(MODELS.smart, { imageBase64: 'AAAA', note: '  pilav ' });
  assert(r.messages[0].content[0].type === 'image' && r.messages[0].content[0].source.media_type === 'image/jpeg' && r.messages[0].content[1].text.includes('pilav'), 'görsel + not içeriği');
  assert(r.fallbacks === 'default' && r.temperature === undefined && r.output_config.format.type === 'json_schema', 'Sonnet isteği: fallback + şema');
  const r2: any = buildMealRequest(MODELS.fast, { note: 'yumurta' });
  assert(r2.messages[0].content.length === 1 && r2.fallbacks === undefined, 'Haiku metin isteği');
  console.log('\nGÖREV 2 TESTLERİ GEÇTİ');
})().catch((e) => { console.error(e); process.exit(1); });
