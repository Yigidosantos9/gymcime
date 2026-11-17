// Görev 2.12 — dil desteği: sözlük eşliği, Türkçe sabit metin taraması, biçimlendirme, hatırlatıcı, rehber önbelleği, yiyecek adları
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { en } from '@/i18n/en';
import { tr } from '@/i18n/tr';
import { currentLocale, decimalSep, formatDecimal, getLanguage, resolveLanguage, setLanguage, t, tOr, translate, localeData } from '@/i18n';
import { equipmentLabel, goalLabel, mealLabel, muscleLabel, routineLabel } from '@/i18n/labels';
import { FOODS_TR, FOOD_CATEGORIES } from '@/data/foods-tr';
import { EXERCISE_MEDIA, muscleName } from '@/db/exercise-media';
import { MUSCLES, EQUIPMENT } from '@/db/seed';
import { getGuideRow, saveGuide } from '@/db/queries';
import { migrateDb } from '@/db/migrate';
import { AiError, buildGuideRequest, buildMealRequest, GUIDE_SYSTEM } from '@/lib/ai-core';
import { parseAmount, formatDate, formatDayLong, formatMinutes, formatWeight, parseNumber, greeting } from '@/lib/format';
import { displayFoodName, displayServing, foodName, portionLabel, searchFoods, servingText } from '@/lib/food-search';
import { suggestNext, RULE_TABLE, EFFORT } from '@/lib/progression';
import { buildReminderSchedule, DEFAULT_REMINDERS } from '@/lib/reminders';
import { SET_TYPES, formatRest } from '@/lib/rest';
import { calorieTarget } from '@/lib/nutrition';
import { weekdayNames, weekdayShort, weekdayLetters, monthNames, WEEK_TEMPLATES, shortRoutineName } from '@/lib/week-plan';
import { restLabel } from '@/lib/recovery';
import { formatKm, formatHold, formatMin, EXERCISE_KINDS } from '@/lib/cardio';
import { assert, freshDb } from './helpers';
import { DatabaseSync } from 'node:sqlite';
import { wrap } from './helpers';

(async () => {
  // ── 1. anahtar eşliği
  const trKeys = Object.keys(tr).sort();
  const enKeys = Object.keys(en).sort();
  assert(trKeys.length > 700, `sözlük dolu (${trKeys.length} anahtar)`);
  assert(JSON.stringify(trKeys) === JSON.stringify(enKeys), `tr/en anahtar eşliği (${trKeys.filter((k) => !(k in en)).join(',')} | ${enKeys.filter((k) => !(k in tr)).join(',')})`);
  const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  const forms = (m: any): string[] => (typeof m === 'string' ? [m] : [m.one, m.other]);
  const badPh: string[] = [];
  const emptyEn: string[] = [];
  const badPlural: string[] = [];
  for (const k of trKeys) {
    const a = (tr as any)[k], b = (en as any)[k];
    const trSet = new Set(forms(a).map(ph)), enSet = new Set(forms(b).map(ph));
    if (trSet.size !== 1 || enSet.size !== 1 || [...trSet][0] !== [...enSet][0]) badPh.push(k);
    if (forms(b).some((x) => !x.trim())) emptyEn.push(k);
    if (typeof b === 'object' && !(typeof b.one === 'string' && typeof b.other === 'string' && ph(b.one).includes('count'))) badPlural.push(k);
  }
  assert(badPh.length === 0, `parametre eşliği tr/en (${badPh.join(',')})`);
  assert(emptyEn.length === 0, `İngilizce karşılıklar boş değil (${emptyEn.join(',')})`);
  assert(badPlural.length === 0, `çoğul anahtarlar one/other + {count} (${badPlural.join(',')})`);
  // İngilizce metinde Türkçe karakter olmamalı (özel kural: tr dili adları ve bazı sabitler hariç)
  const EN_TR_OK = new Set(['settings.language_tr', 'onboarding.language']);
  const trInEn = enKeys.filter((k) => !EN_TR_OK.has(k) && forms((en as any)[k]).some((x) => /[çğıöşüÇĞİÖŞÜ]/.test(x)));
  assert(trInEn.length === 0, `İngilizce sözlükte Türkçe karakter yok (${trInEn.slice(0, 8).join(',')})`);

  // ── 2. src/app ve src/components içinde i18n dışında Türkçe karakterli sabit metin kalmadı
  const ALLOWED = /Göğüs|Sırt|Kalça|Karın|Vücut|Güçlenmek|Yağ yakmak|Yeni başlıyorum|İleri|Dambıl|Diğer|Kas kazanmak|Formda kalmak|Kardiyo/g; // DB'de saklanan Türkçe anahtarlar
  const stripComments = (src: string) =>
    src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .map((l) => l.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
      .join('\n');
  const walk = (d: string, out: string[] = []) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.tsx?$/.test(f)) out.push(p);
    }
    return out;
  };
  const offenders: string[] = [];
  for (const file of [...walk(join(process.cwd(), 'src/app')), ...walk(join(process.cwd(), 'src/components'))]) {
    const code = stripComments(readFileSync(file, 'utf8')).replace(ALLOWED, '');
    code.split('\n').forEach((line, i) => {
      if (/[çğıöşüÇĞİÖŞÜ]/.test(line)) offenders.push(`${file.replace(process.cwd() + '/', '')}:${i + 1}: ${line.trim().slice(0, 70)}`);
    });
  }
  assert(offenders.length === 0, `i18n dışında Türkçe karakterli sabit metin yok (${offenders.slice(0, 5).join(' | ')})`);

  // ── 3. dil çözümleme + çeviri + çoğul
  assert(resolveLanguage('tr', 'en') === 'tr' && resolveLanguage('en', 'tr') === 'en', 'açık tercih önceliklidir');
  assert(resolveLanguage('system', 'tr') === 'tr' && resolveLanguage('system', 'tr-TR') === 'tr' && resolveLanguage('system', 'en') === 'en' && resolveLanguage('system', 'de') === 'en' && resolveLanguage(null, null) === 'en', 'sistem dili: tr → Türkçe, diğerleri English');
  assert(translate('tr', 'history.workouts', { count: 3 }) === '3 antrenman' && translate('en', 'history.workouts', { count: 1 }) === '1 workout' && translate('en', 'history.workouts', { count: 3 }) === '3 workouts' && translate('en', 'history.workouts', { count: 0 }) === '0 workouts', 'parametre + çoğul (en: 1 tekil, diğer çoğul)');
  assert(translate('tr', 'history.workouts', { count: 1 }) === '1 antrenman', 'tr çoğulda sayı + tekil ad');
  setLanguage('en');
  assert(getLanguage() === 'en' && t('common.today') === 'Today' && currentLocale() === 'en-US', 'geçerli dil English');
  assert(tOr('muscle.Göğüs', 'x') === 'Chest' && tOr('muscle.Özel Kas', 'Özel Kas') === 'Özel Kas', 'tOr: bilinmeyen (özel) değer olduğu gibi');
  setLanguage('tr');
  assert(t('common.today') === 'Bugün' && currentLocale() === 'tr-TR', 'geçerli dil Türkçe');

  // ── 4. biçimlendirme (sayı / tarih / gün-ay adları)
  setLanguage('tr');
  assert(formatWeight(62.5) === '62,5' && formatWeight(60) === '60' && formatWeight(null) === '–' && decimalSep() === ',', 'TR sayı: 62,5');
  assert(formatDecimal(3.25, 2) === '3,25' && formatDecimal(10, 1) === '10' && formatDecimal(0.5, 0) === '1' || formatDecimal(0.5, 0) === '0', 'formatDecimal TR');
  setLanguage('en');
  assert(formatWeight(62.5) === '62.5' && formatWeight(60) === '60' && decimalSep() === '.', 'EN sayı: 62.5');
  assert(formatDecimal(3.25, 2) === '3.25' && formatDecimal(30, 0) === '30', 'formatDecimal EN (tam sayı korunur)');
  assert(parseNumber('62,5') === 62.5 && parseNumber('62.5') === 62.5, 'giriş her iki ayırıcıyı da kabul eder');
  const d = new Date(2026, 10, 3, 12).getTime(); // 3 Kasım 2026
  assert(formatDate(d) === 'Nov 3', `EN tarih: ${formatDate(d)}`);
  assert(weekdayNames()[0] === 'Monday' && weekdayNames()[6] === 'Sunday' && weekdayShort()[2] === 'Wed' && weekdayLetters().join('') === 'MTWTFSS' && monthNames()[10] === 'November', 'EN gün/ay adları (Pazartesi başlangıçlı)');
  assert(formatDayLong(Date.now()) === 'Today' && formatDayLong(Date.now() - 86400000) === 'Yesterday', 'EN göreli gün');
  assert(formatMinutes(65 * 60000) === '1 h 5 min' && formatMinutes(40 * 60000) === '40 min', `EN süre: ${formatMinutes(65 * 60000)}`);
  assert(['Good night', 'Good morning', 'Good afternoon', 'Good evening'].includes(greeting()), 'EN selam');
  assert(formatRest(0) === 'None' && formatRest(90) === '1:30' && formatRest(45) === '45 sec' && formatHold(30) === '30 sec' && formatKm(3200) === '3.2' && formatMin(65) === '1 h 05 min', 'EN rest/kardiyo birimleri');
  setLanguage('tr');
  assert(formatDate(d) === '3 Kas' && weekdayNames()[0] === 'Pazartesi' && weekdayShort()[2] === 'Çar' && weekdayLetters().join('') === 'PSÇPCCP' && monthNames()[10] === 'Kasım', 'TR tarih/gün/ay adları');
  assert(formatMinutes(65 * 60000) === '1 sa 5 dk' && formatKm(3200) === '3,2' && formatRest(0) === 'Yok', 'TR süre/birimler');
  assert(localeData('en').months.length === 12 && localeData('tr').daysShort.length === 7, 'yerel ay/gün tablosu tam');

  // ── 5. etiketler (DB'de Türkçe anahtar, gösterimde çeviri)
  setLanguage('en');
  assert(MUSCLES.every((m) => muscleLabel(m) !== m || m === 'Biceps' || m === 'Triceps') && muscleLabel('Göğüs') === 'Chest' && muscleLabel('Bacak') === 'Legs', 'kas grupları çevrilir');
  assert(EQUIPMENT.every((e) => (equipmentLabel(e) !== e) || e === 'Kettlebell') && equipmentLabel('Halter') === 'Barbell', 'ekipman çevrilir');
  assert(goalLabel('Yağ yakmak') === 'Lose fat' && mealLabel('Kahvaltı') === 'Breakfast' && routineLabel('Üst Vücut') === 'Upper Body' && routineLabel('Serbest Antrenman') === 'Free workout', 'hedef/öğün/seed rutin adları çevrilir');
  assert(routineLabel('Benim Sırt Günüm') === 'Benim Sırt Günüm' && muscleLabel('Özel') === 'Özel', 'kullanıcı adları/özel değerler değişmez');
  assert(routineLabel('Üst Vücut', 'tr') === 'Üst Vücut' && muscleLabel('Göğüs', 'tr') === 'Göğüs', 'etiketler açık dille de çağrılabilir');
  assert(SET_TYPES.find((s) => s.key === 'warmup')!.label === 'Warm-up' && SET_TYPES.find((s) => s.key === 'failure')!.short === 'F', 'set tipleri (getter) dili izler');
  assert(EFFORT.map((e) => e.label).join() === 'Easy,Good,Hard,Failed' && RULE_TABLE[0].inSession === 'Next set +1 step', 'zorluk adları + kural tablosu çevrilir');
  assert(EXERCISE_KINDS[0].label === 'Weight' && WEEK_TEMPLATES[0].label === 'PPL · 3 days' && shortRoutineName('Üst Vücut', 5) === 'Upper', 'egzersiz türleri, şablonlar, kısa rutin adı');
  assert(restLabel({ muscle: 'Göğüs', last: 1, lastSets: 1, daysRested: 3, ready: true, remaining: 0 }) === 'Resting for 3 days' && restLabel({ muscle: 'x', last: 1, lastSets: 1, daysRested: 1, ready: true, remaining: 0 }) === 'Trained yesterday', 'toparlanma etiketleri');
  assert(muscleName('lower back') === 'Lower back', 'veri seti kas adı İngilizce');
  setLanguage('tr');
  assert(SET_TYPES.find((s) => s.key === 'warmup')!.label === 'Isınma' && muscleLabel('Göğüs') === 'Göğüs' && routineLabel('Üst Vücut') === 'Üst Vücut', 'Türkçeye dönünce etiketler döner');
  assert(muscleName('lower back') === 'Alt sırt', 'veri seti kas adı Türkçe');

  // ── 6. kurallar / öneri metinleri / beslenme gerekçeleri iki dilde
  const NOW = 1_800_000_000_000, D = 86400000;
  const hist = [{ started_at: NOW - 3 * D, sets: [{ weight: 60, reps: 12, rir: null, set_type: 'normal' }] }];
  setLanguage('tr');
  const sTr = suggestNext(hist as any, 8, 12, 'Halter', { now: NOW });
  setLanguage('en');
  const sEn = suggestNext(hist as any, 8, 12, 'Halter', { now: NOW });
  assert(sTr.weight === sEn.weight && sTr.reps === sEn.reps && sTr.kind === sEn.kind, 'sayısal öneri dilden bağımsız (deterministik)');
  assert(/Son sefer/.test(sTr.reason) && /Last time/.test(sEn.reason) && /step/.test(sEn.reason) && !/[çğıöşü]/.test(sEn.reason), `gerekçe dile göre: "${sEn.reason}"`);
  const prog = suggestNext([], 8, 12, 'Halter', { now: NOW });
  assert(/First time/.test(prog.reason), 'ilk sefer gerekçesi İngilizce');
  const ct = calorieTarget({ sex: 'male', age: 30, heightCm: 180, weightKg: 80 } as any, 'moderate', -2);
  assert(ct.clampedReason == null || !/[çğıöşü]/.test(ct.clampedReason), 'beslenme gerekçesi İngilizce (Türkçe karakter yok)');
  assert(new AiError('auth').userMessage.startsWith('The API key') && translate('tr', 'ai.err.auth').startsWith('API anahtarı'), 'AI hata mesajı seçili dilde');
  setLanguage('tr');
  assert(new AiError('auth').userMessage.startsWith('API anahtarı'), 'AI hata mesajı Türkçe');

  // ── 7. AI istekleri seçili dilde; rehber önbelleği dile göre ayrı
  const gTr = buildGuideRequest('claude-sonnet-5-5', 'x', 'tr');
  const gEn = buildGuideRequest('claude-sonnet-5-5', 'x', 'en');
  assert(gTr.system[0].text === GUIDE_SYSTEM && gEn.system[0].text !== GUIDE_SYSTEM && /English/.test(gEn.system[0].text) && gEn.system[0].cache_control.type === 'ephemeral', 'rehber istemi İngilizce talimat + prompt caching');
  const mEn = buildMealRequest('claude-haiku-5-5', { note: 'two eggs' }, 'en');
  assert(/English/.test(mEn.system[0].text) && (mEn.messages[0].content as any)[0].text === 'User note: two eggs', 'yemek tahmini İngilizce istenir');
  const { raw, db } = await freshDb();
  const exId = Number((raw.prepare('SELECT id FROM exercises LIMIT 1').get() as any).id);
  await saveGuide(db, exId, '{"a":1}', 'm', 1000, 'tr');
  await saveGuide(db, exId, '{"a":2}', 'm', 2000, 'en');
  assert((await getGuideRow(db, exId, 'tr'))!.json === '{"a":1}' && (await getGuideRow(db, exId, 'en'))!.json === '{"a":2}', 'rehber önbelleği dile göre ayrı');
  await saveGuide(db, exId, '{"a":3}', 'm', 3000, 'en');
  assert((await getGuideRow(db, exId, 'en'))!.json === '{"a":3}' && (await getGuideRow(db, exId, 'tr'))!.json === '{"a":1}', 'aynı dil yeniden yazılır, diğeri korunur');
  // v10 → v11: eski tek anahtarlı tablo 'tr' olarak taşınır
  raw.exec("DROP TABLE exercise_guides; CREATE TABLE exercise_guides (exercise_id INTEGER PRIMARY KEY, json TEXT NOT NULL, created_at INTEGER NOT NULL, model TEXT);");
  raw.prepare("INSERT INTO exercise_guides VALUES (?, '{\"old\":1}', 5, 'm')").run(exId);
  raw.exec('PRAGMA user_version = 10');
  await migrateDb(wrap(raw));
  const migrated = await getGuideRow(db, exId, 'tr');
  assert(migrated && migrated.json === '{"old":1}' && (await getGuideRow(db, exId, 'en')) == null, 'v11 migrasyonu mevcut rehberleri tr olarak korur');

  // ── 8. hatırlatıcı bildirimleri dile göre yeniden kurulur (saf kısım)
  const rem = { ...DEFAULT_REMINDERS, workout: { ...DEFAULT_REMINDERS.workout, on: true }, weigh: { ...DEFAULT_REMINDERS.weigh, on: true }, meal: { ...DEFAULT_REMINDERS.meal, on: true } };
  const plan = [{ weekday: 0, routine_name: 'Üst Vücut' }, { weekday: 1, routine_name: null }];
  const sTrN = buildReminderSchedule(rem, plan, 'tr');
  const sEnN = buildReminderSchedule(rem, plan, 'en');
  assert(sTrN.length === sEnN.length && sTrN.map((n) => n.id).join() === sEnN.map((n) => n.id).join(), 'aynı kimlikler (idempotent yeniden kurulum)');
  assert(sTrN[0].title === 'Antrenman zamanı' && sTrN[0].body === 'Bugün: Üst Vücut 💪', 'TR bildirim');
  assert(sEnN[0].title === 'Workout time' && sEnN[0].body === 'Today: Upper Body 💪' && sEnN.find((n) => n.id.endsWith('weigh'))!.title === 'Weigh-in day' && sEnN.find((n) => n.id.endsWith('meal'))!.title === 'Log your meals', 'EN bildirim (seed rutin adı da çevrilir)');
  setLanguage('en');
  assert(buildReminderSchedule(rem, plan)[0].title === 'Workout time', 'lang verilmezse geçerli dil kullanılır');
  setLanguage('tr');

  // ── 9. yiyecek veritabanı: nameEn + iki dilde arama + kategori adları
  assert(FOODS_TR.every((f) => f.nameEn && f.nameEn.trim().length > 1), 'her yiyeceğin İngilizce adı var');
  const missingEn = FOODS_TR.filter((f) => f.nameEn === f.name && !/^(Humus|Falafel|Granola|Tiramisu|Cheesecake|Brownie|Muffin|Bagel|Tortilla|Latte|Cappuccino|Hamburger|Cheeseburger|Baklava|Boza|Salep|Mozzarella|Parmesan|Hellim|Kefir|Tantuni|Avokado|Kivi|Mango|Kinoa|Ananas|Kraker|Omlet|Menemen)$/.test(f.name));
  assert(missingEn.length < 5, `İngilizce adlar gerçekten çevrilmiş (${missingEn.map((f) => f.name).join(',')})`);
  assert(searchFoods('bagel').some((f) => f.name === 'Simit') && searchFoods('simit').some((f) => f.name === 'Simit'), 'arama her iki dilde çalışır (bagel/simit)');
  assert(searchFoods('chicken breast').some((f) => f.name.includes('Tavuk Göğsü')) && searchFoods('tavuk göğsü').length > 0, 'İngilizce ve Türkçe sorgu');
  setLanguage('en');
  const simit = FOODS_TR.find((f) => f.name === 'Simit')!;
  assert(foodName(simit).startsWith('Simit') && foodName(FOODS_TR.find((f) => f.name === 'Beyaz Peynir')!) === 'White Cheese (Feta)', 'gösterim adı dile göre');
  assert(FOOD_CATEGORIES.map((c) => c.label).join('|').includes('Breakfast items') && FOOD_CATEGORIES.every((c) => c.label.length > 2 && !/[çğıöşüÇĞİÖŞÜ]/.test(c.label)), 'kategori adları İngilizce');
  assert(portionLabel('2 yemek kaşığı (30 g)') === '2 tbsp (30 g)' && portionLabel('1 küçük kase (150 g)') === '1 small bowl (150 g)' && portionLabel('1 adet (1,5 g)') === '1 piece (1.5 g)', `porsiyon etiketi: ${portionLabel('2 yemek kaşığı (30 g)')}`);
  assert(servingText({ unit: 'g' }, simit.portions[0], 2, 220) === '2 × ' + portionLabel(simit.portions[0].label) && servingText({ unit: 'g' }, null, 1, 150.5) === '150.5 g', 'serving metni İngilizce ayırıcı');
  const trPortionsClean = FOODS_TR.flatMap((f) => f.portions).filter((p) => /[çğıöşüÇĞİÖŞÜ]/.test(portionLabel(p.label)));
  assert(trPortionsClean.length < 10, `porsiyon etiketlerinde çevrilmemiş Türkçe az (${trPortionsClean.slice(0, 5).map((p) => p.label).join(' | ')})`);
  setLanguage('tr');
  assert(FOOD_CATEGORIES[0].label === 'Kahvaltılık' && foodName(simit) === 'Simit', 'TR kategori adı + yiyecek adı');

  // ── 10. egzersiz adımları iki dilde
  const eEntries = Object.values(EXERCISE_MEDIA);
  assert(eEntries.every((m) => m.steps.tr.length > 0 && m.steps.en.length > 0), 'her egzersizde tr + en adım');

  // ── binlik ayırıcı (tamsayı alanları) / ondalık korunur
  assert(parseAmount('1,500') === 1500 && parseAmount('1.500') === 1500 && parseAmount('12.345.678') === null || parseAmount('1.500') === 1500, 'parseAmount: binlik ayırıcı');
  assert(parseAmount('62.5') === 62.5 && parseAmount('62,5') === 62.5 && parseAmount('150') === 150 && parseAmount('0,5') === 0.5 && parseAmount('') === null, 'parseAmount: ondalık davranışı korunur');
  assert(parseNumber('62,5') === 62.5 && parseNumber('1,5') === 1.5, 'parseNumber ondalık (ağırlık alanları)');

  // ── kayıtlı yiyecek adı Türkçe asıl ad; gösterim dile göre, elle yazılan değişmez
  setLanguage('en');
  assert(displayFoodName('Beyaz Peynir') === 'White Cheese (Feta)' && displayFoodName('Annemin köftesi') === 'Annemin köftesi', 'kayıtlı ad EN gösterimde çevrilir, elle yazılan kalır');
  const peynir = FOODS_TR.find((f) => f.name === 'Beyaz Peynir')!;
  assert(servingText(peynir, peynir.portions[0], 1, 30, 'tr') === peynir.portions[0].label && /slice|piece|tbsp|serving/.test(displayServing(peynir.portions[0].label) ?? ''), 'porsiyon Türkçe saklanır, EN gösterimde çevrilir');
  setLanguage('tr');
  assert(displayFoodName('Beyaz Peynir') === 'Beyaz Peynir', 'TR gösterim aynı');

  // ── kullanıcıya görünen metinler: src/lib ve src/db içinde de Türkçe sabit metin yok (AI Türkçe istemleri/veri kaynakları hariç)
  const libOffenders: string[] = [];
  const LIB_SKIP = /ai-core\.ts|food-search\.ts|seed\.ts|exercise-media\.ts/;
  for (const file of [...walk(join(process.cwd(), 'src/lib')), ...walk(join(process.cwd(), 'src/db')), ...walk(join(process.cwd(), 'src/hooks'))]) {
    if (LIB_SKIP.test(file)) continue;
    const code = stripComments(readFileSync(file, 'utf8')).replace(ALLOWED, '').replace(/Kahvaltı|Öğle|Akşam|Üst/g, '');
    code.split('\n').forEach((line, i) => {
      if (/[çğıöşüÇĞİÖŞÜ]/.test(line)) libOffenders.push(`${file.replace(process.cwd() + '/', '')}:${i + 1}: ${line.trim().slice(0, 60)}`);
    });
  }
  assert(libOffenders.length === 0, `lib/db içinde sabit Türkçe görünen metin yok (${libOffenders.slice(0, 4).join(' | ')})`);
  console.log('I18N TESTS OK');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
