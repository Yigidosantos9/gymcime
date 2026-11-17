import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Card, Chip, PressableScale, SectionHeader, T } from '@/components/ui';
import { Font, Spacing } from '@/constants/theme';
import { getWeekPlan } from '@/db/queries';
import { useTheme } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';
import { ensureReminderPermission, getReminderSettings, saveReminderSettings, syncReminders } from '@/lib/reminder-io';
import { formatTime, type ReminderSettings, type TimeOfDay } from '@/lib/reminders';
import { weekdayNames, weekdayShort } from '@/lib/week-plan';
import { useT } from '@/components/language-provider';

function Stepper({ label, value, onMinus, onPlus }: { label: string; value: string; onMinus: () => void; onPlus: () => void }) {
  const _ = useT();
  const t = useTheme();
  return (
    <View style={[styles.stepper, { backgroundColor: t.surfaceRaised }]}>
      <PressableScale onPress={onMinus} hapticOnPress={false} accessibilityLabel={_('reminderSettings.decrease', { label: label })} style={styles.stepBtn}>
        <Icon name="minus" size={12} color={t.textSecondary} />
      </PressableScale>
      <T variant="heading" style={{ minWidth: 30, textAlign: 'center', fontVariant: ['tabular-nums'] }} accessibilityLabel={`${label} ${value}`}>
        {value}
      </T>
      <PressableScale onPress={onPlus} hapticOnPress={false} accessibilityLabel={_('reminderSettings.increase', { label: label })} style={styles.stepBtn}>
        <Icon name="add" size={12} color={t.primary} />
      </PressableScale>
    </View>
  );
}

function TimeRow({ value, onChange }: { value: TimeOfDay; onChange: (v: TimeOfDay) => void }) {
  const _ = useT();
  const t = useTheme();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
      <Icon name="clock" size={14} color={t.textSecondary} />
      <Stepper label={_('reminderSettings.hour')} value={pad(value.hour)} onMinus={() => onChange({ ...value, hour: (value.hour + 23) % 24 })} onPlus={() => onChange({ ...value, hour: (value.hour + 1) % 24 })} />
      <T variant="heading">:</T>
      <Stepper label={_('reminderSettings.minute')} value={pad(value.minute)} onMinus={() => onChange({ ...value, minute: (value.minute + 55) % 60 })} onPlus={() => onChange({ ...value, minute: (value.minute + 5) % 60 })} />
    </View>
  );
}

/** Ayarlar → Hatırlatıcılar: antrenman günleri, tartılma, öğün kaydı. Yerel bildirim (internet gerekmez). */
export function ReminderSettingsSection() {
  const _ = useT();
  const t = useTheme();
  const db = useSQLiteContext();
  const [s, setS] = useState<ReminderSettings | null>(null);
  const [hasPlan, setHasPlan] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    getReminderSettings(db).then(setS);
    getWeekPlan(db).then((p) => setHasPlan(p.some((d) => d.routine_id != null)));
  }, [db]);

  if (!s) return null;

  const commit = async (next: ReminderSettings) => {
    setS(next);
    await saveReminderSettings(db, next);
    await syncReminders(db);
  };

  /** Bir hatırlatıcıyı aç/kapat; açarken bildirim izni istenir. */
  const toggle = async (key: 'workout' | 'weigh' | 'meal', on: boolean) => {
    if (on) {
      const ok = await ensureReminderPermission(true);
      setDenied(!ok);
      if (!ok) {
        haptic.warning();
        return;
      }
    }
    haptic.tap();
    await commit({ ...s, [key]: { ...s[key], on } });
  };

  const toggleDay = (d: number) => {
    const days = s.workout.days.includes(d) ? s.workout.days.filter((x) => x !== d) : [...s.workout.days, d].sort((a, b) => a - b);
    commit({ ...s, workout: { ...s.workout, days } });
  };

  return (
    <>
      <SectionHeader title={_('reminderSettings.reminders')} />
      <Card style={{ gap: Spacing.lg }}>
        {denied && (
          <T variant="caption" color={t.danger}>{_('reminderSettings.notification_permission_wasn_t')}</T>
        )}

        <View style={{ gap: Spacing.md }}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <T variant="label">{_('reminderSettings.training_day')}</T>
              <T variant="caption" muted>
                {hasPlan ? _('reminderSettings.on_days_in_the_weekly') : _('reminderSettings.on_the_days_you_choose')}
              </T>
            </View>
            <Switch value={s.workout.on} onValueChange={(v) => toggle('workout', v)} trackColor={{ true: t.primary, false: t.surfacePressed }} accessibilityLabel={_('reminderSettings.training_day_reminder')} />
          </View>
          {s.workout.on && (
            <>
              {hasPlan ? (
                <T variant="caption" secondary>{_('reminderSettings.days_come_from_the_weekly')}</T>
              ) : (
                <View style={styles.wrap}>
                  {weekdayShort().map((d, i) => (
                    <Chip key={d} label={d} active={s.workout.days.includes(i)} onPress={() => toggleDay(i)} />
                  ))}
                </View>
              )}
              <TimeRow value={s.workout} onChange={(v) => commit({ ...s, workout: { ...s.workout, ...v } })} />
              <T variant="caption" muted>{_('reminderSettings.every_planned_day_the_notification', { v: formatTime(s.workout) })}</T>
            </>
          )}
        </View>

        <View style={{ gap: Spacing.md }}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <T variant="label">{_('reminderSettings.weigh_in')}</T>
              <T variant="caption" muted>{_('reminderSettings.once_a_week')}</T>
            </View>
            <Switch value={s.weigh.on} onValueChange={(v) => toggle('weigh', v)} trackColor={{ true: t.primary, false: t.surfacePressed }} accessibilityLabel={_('reminderSettings.weigh_in_reminder')} />
          </View>
          {s.weigh.on && (
            <>
              <View style={styles.wrap}>
                {weekdayShort().map((d, i) => (
                  <Chip key={d} label={d} active={s.weigh.day === i} onPress={() => commit({ ...s, weigh: { ...s.weigh, day: i } })} />
                ))}
              </View>
              <TimeRow value={s.weigh} onChange={(v) => commit({ ...s, weigh: { ...s.weigh, ...v } })} />
              <T variant="caption" muted>
                {weekdayNames()[s.weigh.day]} {formatTime(s.weigh)}
              </T>
            </>
          )}
        </View>

        <View style={{ gap: Spacing.md }}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <T variant="label">{_('reminderSettings.meal_logging')}</T>
              <T variant="caption" muted>{_('reminderSettings.every_evening')}</T>
            </View>
            <Switch value={s.meal.on} onValueChange={(v) => toggle('meal', v)} trackColor={{ true: t.primary, false: t.surfacePressed }} accessibilityLabel={_('reminderSettings.meal_logging_reminder')} />
          </View>
          {s.meal.on && <TimeRow value={s.meal} onChange={(v) => commit({ ...s, meal: { ...s.meal, ...v } })} />}
        </View>

        <T variant="caption" muted style={{ fontFamily: Font.regular }}>{_('reminderSettings.notifications_are_scheduled')}</T>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 2 },
  stepBtn: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
});
