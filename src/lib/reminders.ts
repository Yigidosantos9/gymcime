/** Hatırlatıcılar: ayarlar + planlanacak bildirim listesinin saf hesabı (expo-notifications'a dokunmaz). */

export type TimeOfDay = { hour: number; minute: number };

export type ReminderSettings = {
  /** antrenman günü hatırlatıcısı; haftalık plan varsa günler plandan gelir, yoksa `days` kullanılır */
  workout: TimeOfDay & { on: boolean; /** 0 = Pazartesi … 6 = Pazar */ days: number[] };
  weigh: TimeOfDay & { on: boolean; day: number };
  meal: TimeOfDay & { on: boolean };
};

export const DEFAULT_REMINDERS: ReminderSettings = {
  workout: { on: false, days: [0, 2, 4], hour: 18, minute: 0 },
  weigh: { on: false, day: 0, hour: 8, minute: 0 },
  meal: { on: false, hour: 21, minute: 0 },
};

const clampInt = (v: unknown, lo: number, hi: number, fb: number) => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fb;
  return Math.min(hi, Math.max(lo, n));
};

/** Kayıtlı JSON'u (bozuk/eksik olabilir) güvenle ayarlara çevirir. */
export function parseReminders(raw: string | null | undefined): ReminderSettings {
  let p: any = {};
  try {
    p = raw ? JSON.parse(raw) : {};
  } catch {
    p = {};
  }
  const d = DEFAULT_REMINDERS;
  const time = (x: any, fb: TimeOfDay) => ({ hour: clampInt(x?.hour, 0, 23, fb.hour), minute: clampInt(x?.minute, 0, 59, fb.minute) });
  const days = Array.isArray(p?.workout?.days) ? [...new Set<number>(p.workout.days.map((n: unknown) => clampInt(n, 0, 6, 0)))].sort((a, b) => a - b) : d.workout.days;
  return {
    workout: { on: p?.workout?.on === true, days, ...time(p?.workout, d.workout) },
    weigh: { on: p?.weigh?.on === true, day: clampInt(p?.weigh?.day, 0, 6, d.weigh.day), ...time(p?.weigh, d.weigh) },
    meal: { on: p?.meal?.on === true, ...time(p?.meal, d.meal) },
  };
}

export const anyReminderOn = (s: ReminderSettings) => s.workout.on || s.weigh.on || s.meal.on;

/** Bizim günümüz (0 = Pazartesi) → expo-notifications haftalık tetikleyici (1 = Pazar … 7 = Cumartesi). */
export function toExpoWeekday(day: number) {
  return ((day + 1) % 7) + 1;
}

export const REMINDER_ID_PREFIX = 'gymcime-reminder:';

export type PlannedNotification = {
  id: string;
  title: string;
  body: string;
  /** undefined → her gün */
  weekday?: number;
  hour: number;
  minute: number;
};

export type PlanDay = { weekday: number; routine_name: string | null };

/**
 * Planlanacak bildirimler.
 * Antrenman: haftalık planda en az bir rutin varsa YALNIZCA rutin atanmış günlerde ve rutin adıyla
 * ("Bugün: Sırt günü 💪"); plan yoksa seçilen günlerde nötr metinle.
 */
export function buildReminderSchedule(s: ReminderSettings, plan: PlanDay[]): PlannedNotification[] {
  const out: PlannedNotification[] = [];
  if (s.workout.on) {
    const planned = plan.filter((p) => p.routine_name);
    if (planned.length > 0) {
      for (const p of planned) {
        out.push({
          id: `${REMINDER_ID_PREFIX}workout:${p.weekday}`,
          title: 'Antrenman zamanı',
          body: `Bugün: ${p.routine_name} 💪`,
          weekday: toExpoWeekday(p.weekday),
          hour: s.workout.hour,
          minute: s.workout.minute,
        });
      }
    } else {
      for (const d of s.workout.days) {
        out.push({
          id: `${REMINDER_ID_PREFIX}workout:${d}`,
          title: 'Antrenman zamanı',
          body: 'Bugün antrenman günü, hazır mısın? 💪',
          weekday: toExpoWeekday(d),
          hour: s.workout.hour,
          minute: s.workout.minute,
        });
      }
    }
  }
  if (s.weigh.on) {
    out.push({
      id: `${REMINDER_ID_PREFIX}weigh`,
      title: 'Tartılma günü',
      body: 'Sabah, aç karnına tartılıp kilonu kaydetmeyi unutma.',
      weekday: toExpoWeekday(s.weigh.day),
      hour: s.weigh.hour,
      minute: s.weigh.minute,
    });
  }
  if (s.meal.on) {
    out.push({
      id: `${REMINDER_ID_PREFIX}meal`,
      title: 'Öğünlerini kaydet',
      body: 'Bugün yediklerini eklemek için bir dakikan var mı?',
      hour: s.meal.hour,
      minute: s.meal.minute,
    });
  }
  return out;
}

export const formatTime = (t: TimeOfDay) => `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
