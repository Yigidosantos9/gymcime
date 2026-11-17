import type { SQLiteDatabase } from 'expo-sqlite';

import type { ActivityLevel, Sex } from '@/lib/nutrition';

import { getSetting, setSetting } from './queries';

// ───────────────────────── Beslenme profili ─────────────────────────

export type NutritionProfile = {
  heightCm: number;
  age: number;
  sex: Sex;
  activity: ActivityLevel;
  waistCm: number | null;
  neckCm: number | null;
  hipCm: number | null;
  targetWeightKg: number | null;
  targetBodyFat: number | null;
  /** istenen haftalık kilo değişimi, kg (− = verme) */
  weeklyRateKg: number;
};

export async function getNutritionProfile(db: SQLiteDatabase): Promise<NutritionProfile | null> {
  const raw = await getSetting(db, 'nutrition_profile');
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<NutritionProfile>;
    if (!p.heightCm || !p.age || (p.sex !== 'male' && p.sex !== 'female')) return null;
    return {
      heightCm: p.heightCm,
      age: p.age,
      sex: p.sex,
      activity: p.activity ?? 'moderate',
      waistCm: p.waistCm ?? null,
      neckCm: p.neckCm ?? null,
      hipCm: p.hipCm ?? null,
      targetWeightKg: p.targetWeightKg ?? null,
      targetBodyFat: p.targetBodyFat ?? null,
      weeklyRateKg: p.weeklyRateKg ?? 0,
    };
  } catch {
    return null;
  }
}

export async function saveNutritionProfile(db: SQLiteDatabase, p: NutritionProfile) {
  await setSetting(db, 'nutrition_profile', JSON.stringify(p));
}

/** Kilo takibindeki son ölçüm. */
export async function latestBodyWeight(db: SQLiteDatabase) {
  return db.getFirstAsync<{ weight: number; measured_at: number }>('SELECT weight, measured_at FROM body_weights ORDER BY measured_at DESC LIMIT 1');
}

// ───────────────────────── Yiyecek kayıtları ─────────────────────────

export type Food = {
  id: number;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  serving: string | null;
  is_favorite: number;
  use_count: number;
  last_used: number | null;
};

export type FoodLog = {
  id: number;
  day: string;
  meal: string;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  serving: string | null;
  food_id: number | null;
  source: string;
  note: string | null;
  created_at: number;
};

export type NewFoodLog = {
  day: string;
  meal: string;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  serving?: string | null;
  source?: 'manual' | 'ai';
  note?: string | null;
};

/** Öğünü kaydeder; yiyeceği sık yenenler listesine ekler/günceller. Tek transaction. */
export async function addFoodLog(db: SQLiteDatabase, f: NewFoodLog, now = Date.now()) {
  let id = 0;
  await db.withTransactionAsync(async () => {
    id = await insertFoodLog(db, f, now);
  });
  return id;
}

/** Birden çok kalemi tek transaction'da kaydeder (biri hata verirse hiçbiri yazılmaz). */
export async function addFoodLogs(db: SQLiteDatabase, items: NewFoodLog[], now = Date.now()) {
  await db.withTransactionAsync(async () => {
    for (const f of items) await insertFoodLog(db, f, now);
  });
}

/** Transaction'sız iç yardımcı (iç içe transaction açmamak için dışarıdan çağırma). */
async function insertFoodLog(db: SQLiteDatabase, f: NewFoodLog, now: number) {
  const name = f.name.trim();
  await db.runAsync(
    `INSERT INTO foods (name, kcal, protein, carbs, fat, serving, use_count, last_used) VALUES (?, ?, ?, ?, ?, ?, 1, ?)
     ON CONFLICT(name) DO UPDATE SET kcal = excluded.kcal, protein = excluded.protein, carbs = excluded.carbs, fat = excluded.fat,
       serving = excluded.serving, use_count = use_count + 1, last_used = excluded.last_used`,
    name,
    f.kcal,
    f.protein,
    f.carbs,
    f.fat,
    f.serving ?? null,
    now,
  );
  const food = await db.getFirstAsync<{ id: number }>('SELECT id FROM foods WHERE name = ?', name);
  const res = await db.runAsync(
    `INSERT INTO food_logs (day, meal, name, kcal, protein, carbs, fat, serving, food_id, source, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    f.day,
    f.meal,
    name,
    f.kcal,
    f.protein,
    f.carbs,
    f.fat,
    f.serving ?? null,
    food?.id ?? null,
    f.source ?? 'manual',
    f.note ?? null,
    now,
  );
  return res.lastInsertRowId;
}

export async function deleteFoodLog(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM food_logs WHERE id = ?', id);
}

export async function listFoodLogs(db: SQLiteDatabase, day: string) {
  return db.getAllAsync<FoodLog>('SELECT * FROM food_logs WHERE day = ? ORDER BY created_at ASC, id ASC', day);
}

export type DayTotal = { day: string; kcal: number; protein: number; carbs: number; fat: number };

/** [fromDay, toDay] (dahil) arası, kaydı olan günlerin toplamları. */
export async function dayTotalsRange(db: SQLiteDatabase, fromDay: string, toDay: string) {
  return db.getAllAsync<DayTotal>(
    `SELECT day, SUM(kcal) AS kcal, SUM(protein) AS protein, SUM(carbs) AS carbs, SUM(fat) AS fat
     FROM food_logs WHERE day >= ? AND day <= ? GROUP BY day ORDER BY day ASC`,
    fromDay,
    toDay,
  );
}

export async function favoriteFoods(db: SQLiteDatabase) {
  return db.getAllAsync<Food>('SELECT * FROM foods WHERE is_favorite = 1 ORDER BY use_count DESC, name ASC');
}

/** Favori olmayan, en son/en çok yenenler. */
export async function recentFoods(db: SQLiteDatabase, limit = 12) {
  return db.getAllAsync<Food>('SELECT * FROM foods WHERE is_favorite = 0 ORDER BY last_used DESC, use_count DESC LIMIT ?', limit);
}

export async function toggleFavorite(db: SQLiteDatabase, foodId: number) {
  await db.runAsync('UPDATE foods SET is_favorite = 1 - is_favorite WHERE id = ?', foodId);
}

/** Bu gün (yerel gün sınırları, ms) en az bir antrenman başladı mı? */
export async function hasWorkoutBetween(db: SQLiteDatabase, startMs: number, endMs: number) {
  const r = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM workouts WHERE started_at >= ? AND started_at < ?', startMs, endMs);
  return (r?.n ?? 0) > 0;
}
