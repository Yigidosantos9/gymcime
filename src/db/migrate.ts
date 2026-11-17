import type { SQLiteDatabase } from 'expo-sqlite';

import { SEED_EXERCISES } from './seed';

/** Güncel şema sürümü (PRAGMA user_version). Yedek dosyaları da bu sürümü taşır. */
export const DB_VERSION = 6;

/** Ağır bileşik hareketler: varsayılan 3 dk dinlenme. */
const HEAVY = ['squat', 'front-squat', 'deadlift', 'bench', 'incline-bench', 'ohp', 'rdl', 'bb-row', 'hip-thrust', 'hack-squat', 'leg-press', 'pullup', 'dips', 'cgbp'];
/** İzolasyon hareketleri: varsayılan 75 sn. */
const ISOLATION = ['db-fly', 'cable-fly', 'pec-deck', 'lateral', 'cable-lateral', 'front-raise', 'rear-delt', 'face-pull', 'bb-curl', 'db-curl', 'hammer', 'incline-curl', 'preacher', 'cable-curl', 'pushdown', 'rope-pushdown', 'oh-ext', 'kickback', 'leg-ext', 'leg-curl', 'calf-raise', 'abductor', 'cable-kickback', 'crunch', 'cable-crunch', 'russian-twist', 'straight-pulldown', 'shrug'];

/** Hem veritabanı hem (yedek içe aktarırken) `Transaction` nesnesi bu arayüzü karşılar. */
export type Queryable = Pick<SQLiteDatabase, 'runAsync' | 'getAllAsync' | 'getFirstAsync' | 'execAsync'>;

const marks = (list: string[]) => list.map(() => '?').join(',');

/** Seed egzersizlerinin dinlenme süresini varsayılanlara döndürür (özel egzersizlere dokunmaz). Transaction açmaz. */
export async function applyDefaultRest(db: Queryable) {
  await db.runAsync('UPDATE exercises SET rest_seconds = NULL WHERE is_custom = 0');
  await db.runAsync(`UPDATE exercises SET rest_seconds = 180 WHERE is_custom = 0 AND slug IN (${marks(HEAVY)})`, ...HEAVY);
  await db.runAsync(`UPDATE exercises SET rest_seconds = 75 WHERE is_custom = 0 AND slug IN (${marks(ISOLATION)})`, ...ISOLATION);
}

/** v3: İngilizce seed adları + Türkçe takma adlar (özel egzersizlere dokunmaz). Transaction açmaz. */
export async function applySeedNames(db: Queryable) {
  for (const [slug, name, alias] of SEED_EXERCISES) {
    await db.runAsync('UPDATE exercises SET name = ?, alias = ? WHERE slug = ? AND is_custom = 0', name, alias, slug);
  }
}

/**
 * Eski şemalı (`fromVersion`) bir yedekten gelen VERİYE, o sürümden sonraki migrasyonların
 * veri adımlarını uygular. Şema (sütun) değişiklikleri zaten güncel şemada mevcuttur. Transaction açmaz.
 */
export async function applyDataMigrations(db: Queryable, fromVersion: number) {
  if (fromVersion < 2) await applyDefaultRest(db);
  if (fromVersion < 3) await applySeedNames(db);
  // v4-v6: yalnızca yeni tablo/sütun; veri adımı yok
}

/** Yarıda kalmış bir migrasyon tekrar çalışırsa "duplicate column" hatası vermesin. */
async function addColumn(db: Queryable, table: string, column: string, type: string) {
  const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (cols.some((c) => c.name === column)) return;
  await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}

async function setVersion(db: SQLiteDatabase, v: number) {
  await db.execAsync(`PRAGMA user_version = ${v}`);
}

export async function migrateDb(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version >= DB_VERSION) return;

  if (version < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);

      CREATE TABLE IF NOT EXISTS exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE,
        name TEXT NOT NULL,
        muscle TEXT NOT NULL,
        equipment TEXT NOT NULL,
        is_custom INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS routines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS routine_exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
        exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        target_sets INTEGER NOT NULL DEFAULT 3,
        rep_min INTEGER NOT NULL DEFAULT 8,
        rep_max INTEGER NOT NULL DEFAULT 12
      );

      CREATE TABLE IF NOT EXISTS workouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        routine_id INTEGER REFERENCES routines(id) ON DELETE SET NULL,
        started_at INTEGER NOT NULL,
        finished_at INTEGER,
        note TEXT
      );

      CREATE TABLE IF NOT EXISTS workout_exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
        exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        rep_min INTEGER NOT NULL DEFAULT 8,
        rep_max INTEGER NOT NULL DEFAULT 12
      );

      CREATE TABLE IF NOT EXISTS sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_exercise_id INTEGER NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        weight REAL,
        reps INTEGER,
        rpe REAL,
        done INTEGER NOT NULL DEFAULT 0,
        is_pr INTEGER NOT NULL DEFAULT 0,
        completed_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS body_weights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        measured_at INTEGER NOT NULL,
        weight REAL NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_we_workout ON workout_exercises(workout_id);
      CREATE INDEX IF NOT EXISTS idx_we_exercise ON workout_exercises(exercise_id);
      CREATE INDEX IF NOT EXISTS idx_sets_we ON sets(workout_exercise_id);
      CREATE INDEX IF NOT EXISTS idx_workouts_started ON workouts(started_at);
    `);

    await db.withTransactionAsync(async () => {
      for (const [slug, name, , muscle, equipment] of SEED_EXERCISES) {
        await db.runAsync(
          'INSERT OR IGNORE INTO exercises (slug, name, muscle, equipment) VALUES (?, ?, ?, ?)',
          slug,
          name,
          muscle,
          equipment,
        );
      }
    });
    version = 1;
    await setVersion(db, version);
  }

  if (version < 2) {
    // Mola sistemi: egzersize/rutine/antrenmana özel dinlenme, set tipleri, gerçek dinlenme ölçümü
    await addColumn(db, 'exercises', 'rest_seconds', 'INTEGER');
    await addColumn(db, 'routine_exercises', 'rest_seconds', 'INTEGER');
    await addColumn(db, 'workout_exercises', 'rest_seconds', 'INTEGER');
    await addColumn(db, 'sets', 'set_type', "TEXT NOT NULL DEFAULT 'normal'");
    await addColumn(db, 'sets', 'rest_target', 'INTEGER');
    await addColumn(db, 'sets', 'rest_taken', 'INTEGER');
    await applyDefaultRest(db);
    version = 2;
    await setVersion(db, version);
  }

  if (version < 3) {
    // İngilizce egzersiz adları (Türkçe adlar aramada takma ad olarak kalır) + set zorluğu (RIR)
    await addColumn(db, 'exercises', 'alias', 'TEXT');
    await addColumn(db, 'sets', 'rir', 'INTEGER');
    await db.withTransactionAsync(async () => {
      await applySeedNames(db);
    });
    version = 3;
    await setVersion(db, version);
  }

  if (version < 4) {
    // AI egzersiz rehberi önbelleği (egzersiz başına bir kez üretilir)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS exercise_guides (
        exercise_id INTEGER PRIMARY KEY REFERENCES exercises(id) ON DELETE CASCADE,
        json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        model TEXT
      );
    `);
    version = 4;
    await setVersion(db, version);
  }

  if (version < 5) {
    // Beslenme: favori/sık yenen yiyecekler + günlük öğün kayıtları
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS foods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE,
        kcal REAL NOT NULL,
        protein REAL NOT NULL DEFAULT 0,
        carbs REAL NOT NULL DEFAULT 0,
        fat REAL NOT NULL DEFAULT 0,
        serving TEXT,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        use_count INTEGER NOT NULL DEFAULT 0,
        last_used INTEGER
      );

      CREATE TABLE IF NOT EXISTS food_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        day TEXT NOT NULL,
        meal TEXT NOT NULL,
        name TEXT NOT NULL,
        kcal REAL NOT NULL,
        protein REAL NOT NULL DEFAULT 0,
        carbs REAL NOT NULL DEFAULT 0,
        fat REAL NOT NULL DEFAULT 0,
        serving TEXT,
        food_id INTEGER REFERENCES foods(id) ON DELETE SET NULL,
        source TEXT NOT NULL DEFAULT 'manual',
        note TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_food_logs_day ON food_logs(day);
    `);
    version = 5;
    await setVersion(db, version);
  }

  if (version < 6) {
    // Set notu (geçmiş antrenmanı düzenleme + antrenman ekranı). Antrenman notu `workouts.note` v1'den beri var.
    await addColumn(db, 'sets', 'note', 'TEXT');
    version = 6;
    await setVersion(db, version);
  }
}
