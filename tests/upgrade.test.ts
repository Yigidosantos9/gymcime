import { DB_VERSION } from '@/db/migrate';
import { DatabaseSync } from 'node:sqlite';
import { migrateDb } from '@/db/migrate';
import * as q from '@/db/queries';
const raw = new DatabaseSync(':memory:');
const norm = (p: any[]) => (p.length === 1 && Array.isArray(p[0]) ? p[0] : p);
const db: any = {
  execAsync: async (s: string) => raw.exec(s),
  runAsync: async (s: string, ...p: any[]) => { const r = raw.prepare(s).run(...norm(p)); return { lastInsertRowId: Number(r.lastInsertRowid) }; },
  getFirstAsync: async (s: string, ...p: any[]) => raw.prepare(s).get(...norm(p)) ?? null,
  getAllAsync: async (s: string, ...p: any[]) => raw.prepare(s).all(...norm(p)),
  withTransactionAsync: async (fn: any) => { raw.exec('BEGIN'); await fn(); raw.exec('COMMIT'); },
};
(async () => {
  // v1 şemasını elle kur (git'teki ilk sürümün tabloları)
  raw.exec(`CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
  CREATE TABLE exercises (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT UNIQUE, name TEXT NOT NULL, muscle TEXT NOT NULL, equipment TEXT NOT NULL, is_custom INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE routines (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, created_at INTEGER NOT NULL);
  CREATE TABLE routine_exercises (id INTEGER PRIMARY KEY AUTOINCREMENT, routine_id INTEGER NOT NULL, exercise_id INTEGER NOT NULL, position INTEGER NOT NULL, target_sets INTEGER NOT NULL DEFAULT 3, rep_min INTEGER NOT NULL DEFAULT 8, rep_max INTEGER NOT NULL DEFAULT 12);
  CREATE TABLE workouts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, routine_id INTEGER, started_at INTEGER NOT NULL, finished_at INTEGER, note TEXT);
  CREATE TABLE workout_exercises (id INTEGER PRIMARY KEY AUTOINCREMENT, workout_id INTEGER NOT NULL, exercise_id INTEGER NOT NULL, position INTEGER NOT NULL, rep_min INTEGER NOT NULL DEFAULT 8, rep_max INTEGER NOT NULL DEFAULT 12);
  CREATE TABLE sets (id INTEGER PRIMARY KEY AUTOINCREMENT, workout_exercise_id INTEGER NOT NULL, position INTEGER NOT NULL, weight REAL, reps INTEGER, rpe REAL, done INTEGER NOT NULL DEFAULT 0, is_pr INTEGER NOT NULL DEFAULT 0, completed_at INTEGER);
  CREATE TABLE body_weights (id INTEGER PRIMARY KEY AUTOINCREMENT, measured_at INTEGER NOT NULL, weight REAL NOT NULL);
  INSERT INTO exercises (slug,name,muscle,equipment) VALUES ('squat','Squat','Bacak','Halter');
  INSERT INTO workouts (name, started_at, finished_at) VALUES ('Eski', 1, 2);
  INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (1,1,0);
  INSERT INTO sets (workout_exercise_id, position, weight, reps, done) VALUES (1,0,100,5,1);
  PRAGMA user_version = 1;`);
  await migrateDb(db);
  const v = (raw.prepare('PRAGMA user_version').get() as any).user_version;
  const ex = await q.getExercise(db, 1);
  const d = await q.getWorkoutDetail(db, 1);
  if (v !== DB_VERSION || ex?.name !== 'Squat' || ex?.alias !== 'Squat' || ex?.rest_seconds !== 180 || d?.exercises[0].sets[0].set_type !== 'normal' || d.exercises[0].sets[0].weight !== 100) throw new Error('upgrade FAIL');
  console.log('ok - v1 → v3 yükseltme veriyi koruyor');
})().catch((e) => { console.error(e); process.exit(1); });
