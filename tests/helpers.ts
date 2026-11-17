import { DatabaseSync } from 'node:sqlite';

/** node:sqlite'ı expo-sqlite benzeri asenkron arayüze sarar. `calls.n` sorgu sayısını sayar. */
export function wrap(raw: DatabaseSync): any {
  const calls = { n: 0 };
  const norm = (p: any[]) => (p.length === 1 && Array.isArray(p[0]) ? p[0] : p);
  const wrapped: any = {
    calls,
    execAsync: async (s: string) => raw.exec(s),
    runAsync: async (s: string, ...p: any[]) => {
      calls.n++;
      const r = raw.prepare(s).run(...norm(p));
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: r.changes };
    },
    getFirstAsync: async (s: string, ...p: any[]) => (calls.n++, raw.prepare(s).get(...norm(p)) ?? null),
    getAllAsync: async (s: string, ...p: any[]) => (calls.n++, raw.prepare(s).all(...norm(p))),
    withExclusiveTransactionAsync: async (fn: (t: any) => Promise<void>) => {
      raw.exec("BEGIN");
      try {
        await fn(wrapped);
        raw.exec("COMMIT");
      } catch (e) {
        raw.exec("ROLLBACK");
        throw e;
      }
    },
    withTransactionAsync: async (fn: () => Promise<void>) => {
      raw.exec('BEGIN');
      try {
        await fn();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
  return wrapped;
}

export const assert = (c: any, m: string) => {
  if (!c) throw new Error('FAIL: ' + m);
  console.log('ok -', m);
};

export async function freshDb() {
  const { migrateDb } = await import('@/db/migrate');
  const raw = new DatabaseSync(':memory:');
  const db = wrap(raw);
  await migrateDb(db);
  return { raw, db };
}

/** Bitmiş antrenman + tamamlanmış setler ekler. sets: [weight, reps, set_type?] */
export function addWorkout(raw: DatabaseSync, exerciseId: number, startedAt: number, sets: [number, number, string?][], opts: { name?: string } = {}) {
  const w = Number(raw.prepare('INSERT INTO workouts (name, started_at, finished_at) VALUES (?, ?, ?)').run(opts.name ?? 'W', startedAt, startedAt + 3600_000).lastInsertRowid);
  const we = Number(raw.prepare('INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, 0)').run(w, exerciseId).lastInsertRowid);
  const ids: number[] = [];
  sets.forEach(([weight, reps, type], i) => {
    ids.push(Number(raw.prepare("INSERT INTO sets (workout_exercise_id, position, weight, reps, done, completed_at, set_type) VALUES (?, ?, ?, ?, 1, ?, ?)").run(we, i, weight, reps, startedAt + i * 1000, type ?? 'normal').lastInsertRowid));
  });
  return { workoutId: w, weId: we, setIds: ids };
}
