import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { getSetting, getWeekPlan, setSetting } from '@/db/queries';

import { loadLanguage } from './language-io';

import { anyReminderOn, buildReminderSchedule, parseReminders, REMINDER_ID_PREFIX, type ReminderSettings } from './reminders';

const KEY = 'reminders';

export async function getReminderSettings(db: SQLiteDatabase) {
  return parseReminders(await getSetting(db, KEY));
}

export async function saveReminderSettings(db: SQLiteDatabase, s: ReminderSettings) {
  await setSetting(db, KEY, JSON.stringify(s));
}

/** İzin durumu; `ask` true ise (kullanıcı bir hatırlatıcıyı açtığında) sistem iznini ister. */
export async function ensureReminderPermission(ask: boolean) {
  if (Platform.OS === 'web') return false;
  try {
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    if (!ask || !cur.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** Bu mantığın serileştirilmesi: eşzamanlı iki çağrı aynı bildirimleri iki kez kurmasın. */
let running: Promise<void> = Promise.resolve();

/**
 * Hatırlatıcı bildirimlerini ayarlara + haftalık plana göre yeniden kurar. İdempotent: önce `gymcime-reminder:` önekli
 * tüm planlı bildirimleri (mola bildirimine dokunmadan) iptal eder, sonra güncel listeyi kurar. Sistem izni yoksa
 * hiçbir şey kurmaz (izni burada İSTEMEZ). Uygulama açılışında, ayar/plan/rutin değişince çağrılır.
 */
export function syncReminders(db: SQLiteDatabase): Promise<void> {
  running = running.then(() => doSync(db)).catch(() => {});
  return running;
}

async function doSync(db: SQLiteDatabase) {
  if (Platform.OS === 'web') return;
  const settings = await getReminderSettings(db);
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of existing) {
    if (n.identifier.startsWith(REMINDER_ID_PREFIX)) await Notifications.cancelScheduledNotificationAsync(n.identifier);
  }
  if (!anyReminderOn(settings) || !(await ensureReminderPermission(false))) return;
  const plan = await getWeekPlan(db);
  // bildirim metni kayıtlı dile göre (ekran dışı çağrılarda da doğru dil)
  const lang = await loadLanguage(db);
  for (const p of buildReminderSchedule(settings, plan, lang)) {
    await Notifications.scheduleNotificationAsync({
      identifier: p.id,
      content: { title: p.title, body: p.body, sound: false },
      trigger:
        p.weekday != null
          ? { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: p.weekday, hour: p.hour, minute: p.minute }
          : { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: p.hour, minute: p.minute },
    });
  }
}
