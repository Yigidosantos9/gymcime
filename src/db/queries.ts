import type { SQLiteDatabase } from 'expo-sqlite';

import {
  detectStyle,
  estimate1RM,
  learnedReps,
  suggestNext,
  type DoneSet,
  type Increments,
  type Session,
  type SetStyle,
  type Suggestion,
} from '@/lib/progression';
import { baseRest, restAfter, type SetType } from '@/lib/rest';
import { startOfWeek } from '@/lib/format';

import { ROUTINE_TEMPLATES } from './seed';

// ───────────────────────── Tipler ─────────────────────────

export type Exercise = {
  id: number;
  slug: string | null;
  name: string;
  muscle: string;
  equipment: string;
  is_custom: number;
  rest_seconds: number | null;
  alias: string | null;
};

export type RoutineSummary = {
  id: number;
  name: string;
  exercise_count: number;
  muscles: string | null;
  last_done: number | null;
};

export type RoutineItem = {
  id?: number;
  exercise_id: number;
  name: string;
  muscle: string;
  equipment: string;
  target_sets: number;
  rep_min: number;
  rep_max: number;
  /** rutine özel dinlenme (null → egzersiz varsayılanı) */
  rest_seconds: number | null;
  default_rest?: number | null;
};

export type SetRow = {
  id: number;
  position: number;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  done: number;
  is_pr: number;
  set_type: SetType;
  rest_target: number | null;
  rest_taken: number | null;
  /** kaç tekrar daha yapılabilirdi (0 = tükeniş); null = girilmedi */
  rir: number | null;
};

export type WorkoutExerciseFull = {
  id: number;
  exercise_id: number;
  name: string;
  muscle: string;
  equipment: string;
  position: number;
  rep_min: number;
  rep_max: number;
  rest_seconds: number | null;
  exercise_rest: number | null;
  sets: SetRow[];
  previous: DoneSet[];
  suggestion: Suggestion;
  /** set düzeni: artan (piramit) ya da sabit */
  style: 'ramp' | 'straight';
  /** geçmişte her set sırasının medyan tekrarı */
  learnedReps: (number | null)[];
};

export type Workout = {
  id: number;
  name: string;
  routine_id: number | null;
  started_at: number;
  finished_at: number | null;
  note: string | null;
};

export type WorkoutListItem = Workout & {
  set_count: number;
  volume: number;
  exercise_names: string | null;
  pr_count: number;
};

export type Profile = {
  name: string;
  goal: string;
  experience: string;
  daysPerWeek: number;
  restSeconds: number;
  /** mola bitince ses (telefon sessizdeyse zaten çalmaz) */
  soundOn: boolean;
  hapticOn: boolean;
  /** ağırlık artış adımları (kg) */
  incBarbell: number;
  incDumbbell: number;
  incMachine: number;
  /** set düzeni: otomatik (geçmişten öğren), artan (piramit) ya da sabit */
  setStyle: SetStyle;
  /** kas grubu başına önerilen dinlenme (gün) */
  recoveryDays: number;
};

// ───────────────────────── Ayarlar / profil ─────────────────────────

export async function getSetting(db: SQLiteDatabase, key: string) {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setSetting(db: SQLiteDatabase, key: string, value: string) {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}

export async function getProfile(db: SQLiteDatabase): Promise<Profile | null> {
  const raw = await getSetting(db, 'profile');
  if (!raw) return null;
  const p = JSON.parse(raw) as Partial<Profile>;
  return {
    name: p.name ?? '',
    goal: p.goal ?? 'Kas kazanmak',
    experience: p.experience ?? 'Orta',
    daysPerWeek: p.daysPerWeek ?? 3,
    restSeconds: p.restSeconds ?? 90,
    soundOn: p.soundOn ?? true,
    hapticOn: p.hapticOn ?? true,
    incBarbell: p.incBarbell ?? 2.5,
    incDumbbell: p.incDumbbell ?? 2,
    incMachine: p.incMachine ?? 2.5,
    setStyle: p.setStyle ?? 'auto',
    recoveryDays: p.recoveryDays ?? 2,
  };
}

export async function saveProfile(db: SQLiteDatabase, profile: Profile) {
  await setSetting(db, 'profile', JSON.stringify(profile));
}

// ───────────────────────── Egzersizler ─────────────────────────

export async function listExercises(db: SQLiteDatabase) {
  return db.getAllAsync<Exercise & { use_count: number }>(`
    SELECT e.*, COUNT(we.id) AS use_count
    FROM exercises e
    LEFT JOIN workout_exercises we ON we.exercise_id = e.id
    GROUP BY e.id
    ORDER BY use_count DESC, e.name COLLATE NOCASE
  `);
}

export async function getExercise(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Exercise>('SELECT * FROM exercises WHERE id = ?', id);
}

export async function createExercise(db: SQLiteDatabase, name: string, muscle: string, equipment: string) {
  const res = await db.runAsync(
    'INSERT INTO exercises (name, muscle, equipment, is_custom) VALUES (?, ?, ?, 1)',
    name.trim(),
    muscle,
    equipment,
  );
  return res.lastInsertRowId;
}

// ───────────────────────── Rutinler ─────────────────────────

export async function listRoutines(db: SQLiteDatabase) {
  return db.getAllAsync<RoutineSummary>(`
    SELECT r.id, r.name,
      (SELECT COUNT(*) FROM routine_exercises re WHERE re.routine_id = r.id) AS exercise_count,
      (SELECT GROUP_CONCAT(DISTINCT e.muscle) FROM routine_exercises re JOIN exercises e ON e.id = re.exercise_id WHERE re.routine_id = r.id) AS muscles,
      (SELECT MAX(w.started_at) FROM workouts w WHERE w.routine_id = r.id AND w.finished_at IS NOT NULL) AS last_done
    FROM routines r
    ORDER BY r.created_at
  `);
}

export async function getRoutine(db: SQLiteDatabase, id: number) {
  const routine = await db.getFirstAsync<{ id: number; name: string }>('SELECT id, name FROM routines WHERE id = ?', id);
  if (!routine) return null;
  const items = await db.getAllAsync<RoutineItem>(
    `SELECT re.id, re.exercise_id, e.name, e.muscle, e.equipment, re.target_sets, re.rep_min, re.rep_max,
       re.rest_seconds, e.rest_seconds AS default_rest
     FROM routine_exercises re JOIN exercises e ON e.id = re.exercise_id
     WHERE re.routine_id = ? ORDER BY re.position`,
    id,
  );
  return { ...routine, items };
}

export async function saveRoutine(db: SQLiteDatabase, id: number | null, name: string, items: RoutineItem[]) {
  let routineId = id;
  await db.withTransactionAsync(async () => {
    if (routineId == null) {
      const res = await db.runAsync('INSERT INTO routines (name, created_at) VALUES (?, ?)', name, Date.now());
      routineId = res.lastInsertRowId;
    } else {
      await db.runAsync('UPDATE routines SET name = ? WHERE id = ?', name, routineId);
      await db.runAsync('DELETE FROM routine_exercises WHERE routine_id = ?', routineId);
    }
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      await db.runAsync(
        'INSERT INTO routine_exercises (routine_id, exercise_id, position, target_sets, rep_min, rep_max, rest_seconds) VALUES (?, ?, ?, ?, ?, ?, ?)',
        routineId,
        it.exercise_id,
        i,
        it.target_sets,
        it.rep_min,
        it.rep_max,
        it.rest_seconds ?? null,
      );
    }
  });
  return routineId!;
}

export async function deleteRoutine(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM routines WHERE id = ?', id);
}

export async function createRoutinesFromTemplate(db: SQLiteDatabase, key: keyof typeof ROUTINE_TEMPLATES) {
  const slugs = await db.getAllAsync<{ id: number; slug: string }>('SELECT id, slug FROM exercises WHERE slug IS NOT NULL');
  const bySlug = new Map(slugs.map((s) => [s.slug, s.id]));
  for (const tpl of ROUTINE_TEMPLATES[key]) {
    const items: RoutineItem[] = tpl.items
      .filter(([slug]) => bySlug.has(slug))
      .map(([slug, sets, min, max]) => ({
        exercise_id: bySlug.get(slug)!,
        name: '',
        muscle: '',
        equipment: '',
        target_sets: sets,
        rep_min: min,
        rep_max: max,
        rest_seconds: null,
      }));
    await saveRoutine(db, null, tpl.name, items);
  }
}

// ───────────────────────── Antrenman (aktif) ─────────────────────────

export async function getActiveWorkout(db: SQLiteDatabase) {
  return db.getFirstAsync<Workout>('SELECT * FROM workouts WHERE finished_at IS NULL ORDER BY started_at DESC LIMIT 1');
}

export async function startWorkout(db: SQLiteDatabase, routineId: number | null) {
  const existing = await getActiveWorkout(db);
  if (existing) return existing.id;

  let workoutId = 0;
  await db.withTransactionAsync(async () => {
    let name = 'Serbest Antrenman';
    let items: RoutineItem[] = [];
    if (routineId != null) {
      const r = await getRoutine(db, routineId);
      if (r) {
        name = r.name;
        items = r.items;
      }
    }
    const res = await db.runAsync(
      'INSERT INTO workouts (name, routine_id, started_at) VALUES (?, ?, ?)',
      name,
      routineId,
      Date.now(),
    );
    workoutId = res.lastInsertRowId;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const we = await db.runAsync(
        'INSERT INTO workout_exercises (workout_id, exercise_id, position, rep_min, rep_max, rest_seconds) VALUES (?, ?, ?, ?, ?, ?)',
        workoutId,
        it.exercise_id,
        i,
        it.rep_min,
        it.rep_max,
        it.rest_seconds ?? null,
      );
      for (let s = 0; s < it.target_sets; s++) {
        await db.runAsync('INSERT INTO sets (workout_exercise_id, position) VALUES (?, ?)', we.lastInsertRowId, s);
      }
    }
  });
  return workoutId;
}

/** Bu egzersizin son N bitmiş seansı (en yeni başta), bu antrenman hariç. */
export async function recentSessions(db: SQLiteDatabase, exerciseId: number, excludeWorkoutId: number, limit = 4): Promise<Session[]> {
  const workouts = await db.getAllAsync<{ id: number; started_at: number }>(
    `SELECT DISTINCT w.id, w.started_at FROM workouts w JOIN workout_exercises we ON we.workout_id = w.id
     WHERE we.exercise_id = ? AND w.finished_at IS NOT NULL AND w.id != ?
       AND EXISTS (SELECT 1 FROM sets s WHERE s.workout_exercise_id = we.id AND s.done = 1)
     ORDER BY w.started_at DESC LIMIT ?`,
    exerciseId,
    excludeWorkoutId,
    limit,
  );
  if (workouts.length === 0) return [];
  const ids = workouts.map((w) => w.id);
  const rows = await db.getAllAsync<DoneSet & { workout_id: number }>(
    `SELECT we.workout_id, s.weight, s.reps, s.rpe, s.rir, s.set_type
     FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id
     WHERE s.done = 1 AND we.exercise_id = ? AND we.workout_id IN (${ids.map(() => '?').join(',')})
     ORDER BY we.position, s.position`,
    exerciseId,
    ...ids,
  );
  return workouts.map((w) => ({
    started_at: w.started_at,
    sets: rows.filter((r) => r.workout_id === w.id).map(({ workout_id: _, ...rest }) => rest),
  }));
}

export type SuggestOptions = { goal?: string; increments?: Increments; setStyle?: SetStyle };

export async function getWorkoutDetail(db: SQLiteDatabase, workoutId: number, opts: SuggestOptions = {}) {
  const workout = await db.getFirstAsync<Workout>('SELECT * FROM workouts WHERE id = ?', workoutId);
  if (!workout) return null;
  const exercises = await db.getAllAsync<Omit<WorkoutExerciseFull, 'sets' | 'previous' | 'suggestion'>>(
    `SELECT we.id, we.exercise_id, e.name, e.muscle, e.equipment, we.position, we.rep_min, we.rep_max,
       we.rest_seconds, e.rest_seconds AS exercise_rest
     FROM workout_exercises we JOIN exercises e ON e.id = we.exercise_id
     WHERE we.workout_id = ? ORDER BY we.position`,
    workoutId,
  );
  const allSets = await db.getAllAsync<SetRow & { workout_exercise_id: number }>(
    `SELECT s.* FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id
     WHERE we.workout_id = ? ORDER BY s.position`,
    workoutId,
  );
  const full: WorkoutExerciseFull[] = [];
  for (const ex of exercises) {
    const history = await recentSessions(db, ex.exercise_id, workoutId, 4);
    // "Önceki" sütunu: son seansın çalışma setleri (ısınma hariç)
    const previous = (history[0]?.sets ?? []).filter((p) => p.set_type !== 'warmup' && p.reps);
    full.push({
      ...ex,
      sets: allSets.filter((s) => s.workout_exercise_id === ex.id),
      previous,
      suggestion: suggestNext(history, ex.rep_min, ex.rep_max, ex.equipment, {
        goal: opts.goal,
        increments: opts.increments,
        now: workout.started_at,
      }),
      style: !opts.setStyle || opts.setStyle === 'auto' ? (detectStyle(history) ?? 'ramp') : opts.setStyle,
      learnedReps: learnedReps(history, 8),
    });
  }
  return { workout, exercises: full };
}

export async function addExercisesToWorkout(db: SQLiteDatabase, workoutId: number, exerciseIds: number[]) {
  const row = await db.getFirstAsync<{ maxPos: number | null }>(
    'SELECT MAX(position) AS maxPos FROM workout_exercises WHERE workout_id = ?',
    workoutId,
  );
  let pos = (row?.maxPos ?? -1) + 1;
  await db.withTransactionAsync(async () => {
    for (const exId of exerciseIds) {
      const we = await db.runAsync(
        'INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, ?)',
        workoutId,
        exId,
        pos++,
      );
      for (let s = 0; s < 3; s++) {
        await db.runAsync('INSERT INTO sets (workout_exercise_id, position) VALUES (?, ?)', we.lastInsertRowId, s);
      }
    }
  });
}

export async function removeWorkoutExercise(db: SQLiteDatabase, workoutExerciseId: number) {
  await db.runAsync('DELETE FROM workout_exercises WHERE id = ?', workoutExerciseId);
}

export async function addSet(db: SQLiteDatabase, workoutExerciseId: number, type: SetType = 'normal') {
  if (type === 'warmup') {
    // ısınma setleri en başa eklenir
    await db.runAsync('UPDATE sets SET position = position + 1 WHERE workout_exercise_id = ?', workoutExerciseId);
    await db.runAsync(
      "INSERT INTO sets (workout_exercise_id, position, set_type) VALUES (?, 0, 'warmup')",
      workoutExerciseId,
    );
    return;
  }
  const row = await db.getFirstAsync<{ maxPos: number | null }>(
    'SELECT MAX(position) AS maxPos FROM sets WHERE workout_exercise_id = ?',
    workoutExerciseId,
  );
  await db.runAsync(
    'INSERT INTO sets (workout_exercise_id, position, set_type) VALUES (?, ?, ?)',
    workoutExerciseId,
    (row?.maxPos ?? -1) + 1,
    type,
  );
}

export async function setSetRir(db: SQLiteDatabase, setId: number, rir: number | null) {
  await db.runAsync('UPDATE sets SET rir = ? WHERE id = ?', rir, setId);
}

/** Önerilen ısınma setlerini (ağırlık/tekrar dolu) egzersizin başına ekler. */
export async function addWarmupSets(db: SQLiteDatabase, workoutExerciseId: number, warmups: { weight: number; reps: number }[]) {
  if (warmups.length === 0) return;
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE sets SET position = position + ? WHERE workout_exercise_id = ?', warmups.length, workoutExerciseId);
    for (let i = 0; i < warmups.length; i++) {
      await db.runAsync(
        "INSERT INTO sets (workout_exercise_id, position, set_type, weight, reps) VALUES (?, ?, 'warmup', ?, ?)",
        workoutExerciseId,
        i,
        warmups[i].weight,
        warmups[i].reps,
      );
    }
  });
}

export async function setSetType(db: SQLiteDatabase, setId: number, type: SetType) {
  await db.runAsync('UPDATE sets SET set_type = ? WHERE id = ?', type, setId);
}

export async function setWorkoutExerciseRest(db: SQLiteDatabase, workoutExerciseId: number, seconds: number) {
  await db.runAsync('UPDATE workout_exercises SET rest_seconds = ? WHERE id = ?', seconds, workoutExerciseId);
}

export async function setExerciseDefaultRest(db: SQLiteDatabase, exerciseId: number, seconds: number | null) {
  await db.runAsync('UPDATE exercises SET rest_seconds = ? WHERE id = ?', seconds, exerciseId);
}

export async function deleteSet(db: SQLiteDatabase, setId: number) {
  await db.runAsync('DELETE FROM sets WHERE id = ?', setId);
}

export async function updateSetValues(
  db: SQLiteDatabase,
  setId: number,
  values: { weight: number | null; reps: number | null; rpe?: number | null },
) {
  await db.runAsync(
    'UPDATE sets SET weight = ?, reps = ?, rpe = ? WHERE id = ?',
    values.weight,
    values.reps,
    values.rpe ?? null,
    setId,
  );
}

/** Gerçek dinlenmeyi kaydetmek için üst sınır: bundan uzun boşluklar "mola" sayılmaz. */
const MAX_TRACKED_REST = 15 * 60;

/**
 * Seti tamamlar/geri alır. Tamamlarken bir önceki tamamlanan setten bu yana geçen
 * gerçek dinlenmeyi (`rest_taken`) ve o setten sonra planlanan dinlenmeyi (`rest_target`) kaydeder.
 * Kişisel rekor kırıldıysa `true` döner (ısınma setleri rekora sayılmaz).
 */
export async function toggleSetDone(db: SQLiteDatabase, setId: number, done: boolean, profileRest = 90, now = Date.now()) {
  if (!done) {
    await db.runAsync(
      'UPDATE sets SET done = 0, is_pr = 0, completed_at = NULL, rest_taken = NULL, rest_target = NULL WHERE id = ?',
      setId,
    );
    return false;
  }
  const set = await db.getFirstAsync<{ weight: number | null; reps: number | null; exercise_id: number; workout_id: number; set_type: string }>(
    `SELECT s.weight, s.reps, s.set_type, we.exercise_id, we.workout_id
     FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id WHERE s.id = ?`,
    setId,
  );
  if (!set) return false;

  let isPr = false;
  if (set.weight && set.reps && set.set_type !== 'warmup') {
    const best = await db.getFirstAsync<{ best: number | null }>(
      `SELECT MAX(s.weight * (1 + s.reps / 30.0)) AS best
       FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id
       WHERE we.exercise_id = ? AND s.done = 1 AND s.id != ? AND s.weight > 0 AND s.reps > 0 AND s.set_type != 'warmup'`,
      set.exercise_id,
      setId,
    );
    const prev = best?.best ?? 0;
    isPr = prev > 0 && estimate1RM(set.weight, set.reps) > prev + 0.01;
  }

  // Bir önceki tamamlanan set → planlanan ve gerçek dinlenme
  const prevSet = await db.getFirstAsync<{ completed_at: number; set_type: string; we_rest: number | null; ex_rest: number | null }>(
    `SELECT s.completed_at, s.set_type, we.rest_seconds AS we_rest, e.rest_seconds AS ex_rest
     FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id JOIN exercises e ON e.id = we.exercise_id
     WHERE we.workout_id = ? AND s.done = 1 AND s.id != ? AND s.completed_at IS NOT NULL
     ORDER BY s.completed_at DESC LIMIT 1`,
    set.workout_id,
    setId,
  );
  let restTaken: number | null = null;
  let restTarget: number | null = null;
  if (prevSet) {
    const gap = Math.round((now - prevSet.completed_at) / 1000);
    const target = restAfter(baseRest(prevSet.we_rest, prevSet.ex_rest, profileRest), prevSet.set_type);
    if (gap >= 0 && gap <= MAX_TRACKED_REST && target > 0) {
      restTaken = gap;
      restTarget = target;
    }
  }

  await db.runAsync(
    'UPDATE sets SET done = 1, is_pr = ?, completed_at = ?, rest_taken = ?, rest_target = ? WHERE id = ?',
    isPr ? 1 : 0,
    now,
    restTaken,
    restTarget,
    setId,
  );
  return isPr;
}

export type FinishSummary = {
  workoutId: number;
  name: string;
  durationMs: number;
  setCount: number;
  volume: number;
  restAvgTaken: number | null;
  restAvgTarget: number | null;
  muscles: { muscle: string; sets: number }[];
  prs: { name: string; weight: number; reps: number }[];
  workoutNumber: number;
};

/** Antrenmanı bitirir. Hiç tamamlanmış set yoksa antrenmanı siler ve `false` döner. */
export async function finishWorkout(db: SQLiteDatabase, workoutId: number): Promise<boolean> {
  const workout = await db.getFirstAsync<Workout>('SELECT * FROM workouts WHERE id = ?', workoutId);
  if (!workout) return false;
  const doneCount = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) AS c FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id
     WHERE we.workout_id = ? AND s.done = 1`,
    workoutId,
  );
  if (!doneCount?.c) {
    await db.runAsync('DELETE FROM workouts WHERE id = ?', workoutId);
    return false;
  }
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `DELETE FROM sets WHERE done = 0 AND workout_exercise_id IN (SELECT id FROM workout_exercises WHERE workout_id = ?)`,
      workoutId,
    );
    await db.runAsync(
      `DELETE FROM workout_exercises WHERE workout_id = ? AND id NOT IN (SELECT workout_exercise_id FROM sets)`,
      workoutId,
    );
    await db.runAsync('UPDATE workouts SET finished_at = ? WHERE id = ?', now, workoutId);
  });
  return true;
}

export async function getWorkoutSummary(db: SQLiteDatabase, workoutId: number): Promise<FinishSummary | null> {
  const workout = await db.getFirstAsync<Workout>('SELECT * FROM workouts WHERE id = ?', workoutId);
  if (!workout) return null;
  const stats = await db.getFirstAsync<{ c: number; v: number }>(
    `SELECT COUNT(*) AS c, COALESCE(SUM(COALESCE(s.weight,0) * COALESCE(s.reps,0)), 0) AS v
     FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id WHERE we.workout_id = ?`,
    workoutId,
  );
  const prs = await db.getAllAsync<{ name: string; weight: number; reps: number }>(
    `SELECT e.name, s.weight, s.reps FROM sets s
     JOIN workout_exercises we ON we.id = s.workout_exercise_id JOIN exercises e ON e.id = we.exercise_id
     WHERE we.workout_id = ? AND s.is_pr = 1 ORDER BY we.position, s.position`,
    workoutId,
  );
  const num = await db.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) AS c FROM workouts WHERE finished_at IS NOT NULL AND started_at <= ?',
    workout.started_at,
  );
  const rest = await db.getFirstAsync<{ taken: number | null; target: number | null }>(
    `SELECT AVG(s.rest_taken) AS taken, AVG(s.rest_target) AS target
     FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id
     WHERE we.workout_id = ? AND s.rest_taken IS NOT NULL`,
    workoutId,
  );
  const muscles = await db.getAllAsync<{ muscle: string; sets: number }>(
    `SELECT e.muscle, COUNT(s.id) AS sets FROM sets s
     JOIN workout_exercises we ON we.id = s.workout_exercise_id JOIN exercises e ON e.id = we.exercise_id
     WHERE we.workout_id = ? AND s.set_type != 'warmup' GROUP BY e.muscle ORDER BY sets DESC`,
    workoutId,
  );
  return {
    workoutId,
    name: workout.name,
    durationMs: (workout.finished_at ?? Date.now()) - workout.started_at,
    setCount: stats?.c ?? 0,
    volume: stats?.v ?? 0,
    prs,
    workoutNumber: num?.c ?? 1,
    restAvgTaken: rest?.taken != null ? Math.round(rest.taken) : null,
    restAvgTarget: rest?.target != null ? Math.round(rest.target) : null,
    muscles,
  };
}

export async function discardWorkout(db: SQLiteDatabase, workoutId: number) {
  await db.runAsync('DELETE FROM workouts WHERE id = ?', workoutId);
}

export async function deleteWorkout(db: SQLiteDatabase, workoutId: number) {
  await db.runAsync('DELETE FROM workouts WHERE id = ?', workoutId);
}

export async function renameWorkout(db: SQLiteDatabase, workoutId: number, name: string) {
  await db.runAsync('UPDATE workouts SET name = ? WHERE id = ?', name, workoutId);
}

// ───────────────────────── Geçmiş ve istatistik ─────────────────────────

export async function listWorkouts(db: SQLiteDatabase, limit = 100) {
  return db.getAllAsync<WorkoutListItem>(
    `SELECT w.*,
      (SELECT COUNT(*) FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id WHERE we.workout_id = w.id) AS set_count,
      (SELECT COALESCE(SUM(COALESCE(s.weight,0) * COALESCE(s.reps,0)),0) FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id WHERE we.workout_id = w.id) AS volume,
      (SELECT COUNT(*) FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id WHERE we.workout_id = w.id AND s.is_pr = 1) AS pr_count,
      (SELECT GROUP_CONCAT(name, ' · ') FROM (SELECT e.name FROM workout_exercises we JOIN exercises e ON e.id = we.exercise_id WHERE we.workout_id = w.id ORDER BY we.position)) AS exercise_names
     FROM workouts w WHERE w.finished_at IS NOT NULL
     ORDER BY w.started_at DESC LIMIT ?`,
    limit,
  );
}

export async function getHomeStats(db: SQLiteDatabase) {
  const weekStart = startOfWeek(Date.now());
  const thisWeek = await db.getAllAsync<{ started_at: number }>(
    'SELECT started_at FROM workouts WHERE finished_at IS NOT NULL AND started_at >= ?',
    weekStart,
  );
  const total = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM workouts WHERE finished_at IS NOT NULL');
  const allStarts = await db.getAllAsync<{ started_at: number }>(
    'SELECT started_at FROM workouts WHERE finished_at IS NOT NULL ORDER BY started_at DESC',
  );
  // Haftalık seri: art arda en az 1 antrenman yapılan hafta sayısı (bu hafta henüz boşsa geçen haftadan say)
  const weeks = new Set(allStarts.map((w) => startOfWeek(w.started_at)));
  let streak = 0;
  let cursor = weekStart;
  if (!weeks.has(cursor)) cursor = startOfWeek(cursor - 86400000);
  while (weeks.has(cursor)) {
    streak++;
    cursor = startOfWeek(cursor - 86400000);
  }
  const daysDone = new Set(thisWeek.map((w) => (new Date(w.started_at).getDay() + 6) % 7));
  return { daysDone, weekCount: thisWeek.length, total: total?.c ?? 0, weekStreak: streak };
}

export async function weeklyVolume(db: SQLiteDatabase, weeks = 8) {
  const from = startOfWeek(Date.now()) - (weeks - 1) * 7 * 86400000;
  const rows = await db.getAllAsync<{ started_at: number; v: number; c: number }>(
    `SELECT w.started_at,
      COALESCE(SUM(COALESCE(s.weight,0) * COALESCE(s.reps,0)),0) AS v,
      COUNT(s.id) AS c
     FROM workouts w JOIN workout_exercises we ON we.workout_id = w.id JOIN sets s ON s.workout_exercise_id = we.id
     WHERE w.finished_at IS NOT NULL AND w.started_at >= ?
     GROUP BY w.id`,
    from,
  );
  const buckets: { week: number; volume: number; sets: number; workouts: number }[] = [];
  for (let i = 0; i < weeks; i++) buckets.push({ week: from + i * 7 * 86400000, volume: 0, sets: 0, workouts: 0 });
  for (const r of rows) {
    const idx = Math.floor((startOfWeek(r.started_at) - from) / (7 * 86400000));
    const b = buckets[Math.min(Math.max(idx, 0), weeks - 1)];
    b.volume += r.v;
    b.sets += r.c;
    b.workouts += 1;
  }
  return buckets;
}

/** Son N günde kas grubu başına tamamlanan set sayısı. */
export async function muscleSets(db: SQLiteDatabase, days = 7) {
  return db.getAllAsync<{ muscle: string; sets: number }>(
    `SELECT e.muscle, COUNT(s.id) AS sets
     FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id
     JOIN exercises e ON e.id = we.exercise_id JOIN workouts w ON w.id = we.workout_id
     WHERE w.finished_at IS NOT NULL AND w.started_at >= ? AND s.done = 1 AND s.set_type != 'warmup'
     GROUP BY e.muscle ORDER BY sets DESC`,
    Date.now() - days * 86400000,
  );
}

export type ExerciseSession = {
  workout_id: number;
  started_at: number;
  best1rm: number;
  top_weight: number;
  volume: number;
  sets: string; // "60x8, 60x8"
};

export async function exerciseHistory(db: SQLiteDatabase, exerciseId: number) {
  return db.getAllAsync<ExerciseSession>(
    `SELECT w.id AS workout_id, w.started_at,
      MAX(COALESCE(s.weight,0) * (1 + COALESCE(s.reps,0) / 30.0)) AS best1rm,
      MAX(COALESCE(s.weight,0)) AS top_weight,
      SUM(COALESCE(s.weight,0) * COALESCE(s.reps,0)) AS volume,
      GROUP_CONCAT(COALESCE(s.weight,0) || 'x' || COALESCE(s.reps,0), ', ') AS sets
     FROM workouts w JOIN workout_exercises we ON we.workout_id = w.id JOIN sets s ON s.workout_exercise_id = we.id
     WHERE we.exercise_id = ? AND w.finished_at IS NOT NULL AND s.done = 1
     GROUP BY w.id ORDER BY w.started_at ASC`,
    exerciseId,
  );
}

/** İlerleme ekranı için: en çok yapılan egzersizler ve güncel tahmini 1RM. */
export async function topExercises(db: SQLiteDatabase, limit = 6) {
  return db.getAllAsync<{ id: number; name: string; muscle: string; sessions: number; best1rm: number }>(
    `SELECT e.id, e.name, e.muscle, COUNT(DISTINCT w.id) AS sessions,
      MAX(COALESCE(s.weight,0) * (1 + COALESCE(s.reps,0) / 30.0)) AS best1rm
     FROM exercises e JOIN workout_exercises we ON we.exercise_id = e.id
     JOIN workouts w ON w.id = we.workout_id JOIN sets s ON s.workout_exercise_id = we.id
     WHERE w.finished_at IS NOT NULL AND s.done = 1
     GROUP BY e.id ORDER BY sessions DESC, best1rm DESC LIMIT ?`,
    limit,
  );
}

// ───────────────────────── Vücut ağırlığı ─────────────────────────

export async function addBodyWeight(db: SQLiteDatabase, weight: number) {
  await db.runAsync('INSERT INTO body_weights (measured_at, weight) VALUES (?, ?)', Date.now(), weight);
}

export async function listBodyWeights(db: SQLiteDatabase) {
  return db.getAllAsync<{ id: number; measured_at: number; weight: number }>(
    'SELECT * FROM body_weights ORDER BY measured_at ASC',
  );
}

export async function deleteAllData(db: SQLiteDatabase) {
  await db.execAsync(`
    DELETE FROM sets; DELETE FROM workout_exercises; DELETE FROM workouts;
    DELETE FROM routine_exercises; DELETE FROM routines; DELETE FROM body_weights;
    DELETE FROM settings; DELETE FROM exercise_guides; DELETE FROM food_logs; DELETE FROM foods; DELETE FROM exercises WHERE is_custom = 1;
  `);
}

// ───────────────────────── AI egzersiz rehberi önbelleği ─────────────────────────

export type GuideRow = { exercise_id: number; json: string; created_at: number; model: string | null };

export async function getGuideRow(db: SQLiteDatabase, exerciseId: number) {
  return db.getFirstAsync<GuideRow>('SELECT * FROM exercise_guides WHERE exercise_id = ?', exerciseId);
}

export async function saveGuide(db: SQLiteDatabase, exerciseId: number, json: string, model: string | null, now = Date.now()) {
  await db.runAsync(
    `INSERT INTO exercise_guides (exercise_id, json, created_at, model) VALUES (?, ?, ?, ?)
     ON CONFLICT(exercise_id) DO UPDATE SET json = excluded.json, created_at = excluded.created_at, model = excluded.model`,
    exerciseId,
    json,
    now,
    model,
  );
}

export async function deleteGuide(db: SQLiteDatabase, exerciseId: number) {
  await db.runAsync('DELETE FROM exercise_guides WHERE exercise_id = ?', exerciseId);
}

// ───────────────────────── Dinlenme analizi ─────────────────────────

export type RestStat = { exercise_id: number; name: string; samples: number; avg_taken: number; avg_target: number };

/** Son N günde egzersiz başına ortalama planlanan ve gerçekleşen dinlenme. */
export async function restStats(db: SQLiteDatabase, days = 28) {
  return db.getAllAsync<RestStat>(
    `SELECT e.id AS exercise_id, e.name, COUNT(s.id) AS samples,
       ROUND(AVG(s.rest_taken)) AS avg_taken, ROUND(AVG(s.rest_target)) AS avg_target
     FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id
     JOIN exercises e ON e.id = we.exercise_id JOIN workouts w ON w.id = we.workout_id
     WHERE w.finished_at IS NOT NULL AND w.started_at >= ? AND s.rest_taken IS NOT NULL
     GROUP BY e.id HAVING samples >= 2 ORDER BY (AVG(s.rest_taken) - AVG(s.rest_target)) DESC`,
    Date.now() - days * 86400000,
  );
}

export async function recentPrCount(db: SQLiteDatabase, days = 30) {
  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) AS c FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id
     JOIN workouts w ON w.id = we.workout_id
     WHERE s.is_pr = 1 AND w.finished_at IS NOT NULL AND w.started_at >= ?`,
    Date.now() - days * 86400000,
  );
  return row?.c ?? 0;
}

// ───────────────────────── Kas toparlanması ─────────────────────────

/** Her kas grubunun en son çalıştığı (bitmiş) antrenman ve o antrenmandaki çalışma seti sayısı. */
export async function muscleLastTrained(db: SQLiteDatabase) {
  return db.getAllAsync<{ muscle: string; last: number; sets: number }>(
    `WITH per AS (
       SELECT e.muscle, w.id AS wid, w.started_at, COUNT(s.id) AS sets
       FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id
       JOIN exercises e ON e.id = we.exercise_id JOIN workouts w ON w.id = we.workout_id
       WHERE w.finished_at IS NOT NULL AND s.done = 1 AND s.set_type != 'warmup'
       GROUP BY e.muscle, w.id
     )
     SELECT p.muscle, p.started_at AS last, p.sets FROM per p
     WHERE p.started_at = (SELECT MAX(p2.started_at) FROM per p2 WHERE p2.muscle = p.muscle)`,
  );
}
