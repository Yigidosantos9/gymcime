import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Button, Card, Chip, IconButton, T } from '@/components/ui';
import { Font, Spacing } from '@/constants/theme';
import { createHistoryWorkout, listRoutines } from '@/db/queries';
import { routineLabel } from '@/i18n/labels';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { startOfDay } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { monthNames, weekdayNames, weekdayOf } from '@/lib/week-plan';
import { useT } from '@/components/language-provider';

function Stepper({ label, value, onMinus, onPlus, minusDisabled, plusDisabled }: { label: string; value: string; onMinus: () => void; onPlus: () => void; minusDisabled?: boolean; plusDisabled?: boolean }) {
  const t = useTheme();
  return (
    <View style={styles.stepRow}>
      <T variant="label" secondary style={{ width: 70 }}>
        {label}
      </T>
      <IconButton icon="chevronLeft" label={`${label} −`} onPress={onMinus} disabled={minusDisabled} bg={t.surfaceRaised} color={t.textSecondary} size={14} />
      <T variant="heading" style={{ flex: 1, textAlign: 'center', fontFamily: Font.bold }}>
        {value}
      </T>
      <IconButton icon="chevronRight" label={`${label} +`} onPress={onPlus} disabled={plusDisabled} bg={t.surfaceRaised} color={t.textSecondary} size={14} />
    </View>
  );
}

/** Geçmişe antrenman ekle: tarih (bugüne kadar) + başlangıç saati + süre + rutin/boş. Sonra oturum ekranında düzenleme modu açılır. */
export default function AddPastWorkout() {
  const _ = useT();
  const t = useTheme();
  const { date } = useLocalSearchParams<{ date?: string }>();
  const [now] = useState(() => Date.now());
  const today = startOfDay(now);
  const initialDay = Math.min(date ? startOfDay(Number(date)) : today, today);
  const [day, setDay] = useState(initialDay);
  // başlangıç dakikası (gün içinde): bugünse şimdi−60 dk, değilse 18:00
  const [minutes, setMinutes] = useState(() => (initialDay === today ? Math.max(0, Math.floor((now - today) / 60000 / 5) * 5 - 60) : 18 * 60));
  const [duration, setDuration] = useState(60);
  const [routineId, setRoutineId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const { data: routines, db } = useDbQuery(listRoutines);

  const startedAt = (() => {
    const d = new Date(day);
    d.setHours(0, minutes, 0, 0);
    return d.getTime();
  })();
  const future = startedAt > now;
  const dd = new Date(day);
  const dayLabel = `${weekdayNames()[weekdayOf(day)]}, ${dd.getDate()} ${monthNames()[dd.getMonth()]} ${dd.getFullYear()}`;
  const shiftDay = (n: number) => {
    const d = new Date(day);
    d.setDate(d.getDate() + n);
    const ts = startOfDay(d.getTime());
    if (ts <= today) setDay(ts);
  };

  const save = async () => {
    if (future || busy) return;
    setBusy(true);
    try {
      const id = await createHistoryWorkout(db, { routineId, startedAt, durationMin: duration });
      haptic.success();
      router.replace(`/session/${id}?edit=1&fresh=1`);
    } catch {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 60, gap: Spacing.md }}>
      <Card>
        <Stepper label={_('addPastWorkout.date')} value={dayLabel} onMinus={() => shiftDay(-1)} onPlus={() => shiftDay(1)} plusDisabled={day >= today} />
        <Stepper
          label={_('addPastWorkout.start')}
          value={`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`}
          onMinus={() => setMinutes((m) => (m - 5 + 1440) % 1440)}
          onPlus={() => setMinutes((m) => (m + 5) % 1440)}
        />
        <Stepper label={_('common.duration')} value={_('addPastWorkout.min', { duration: duration })} onMinus={() => setDuration((d) => Math.max(5, d - 5))} onPlus={() => setDuration((d) => Math.min(300, d + 5))} minusDisabled={duration <= 5} />
        {future && (
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: Spacing.sm }}>
            <Icon name="info" size={14} color={t.danger} />
            <T variant="caption" color={t.danger} style={{ flex: 1 }}>{_('addPastWorkout.you_can_t_add_a')}</T>
          </View>
        )}
      </Card>

      <T variant="overline" secondary>{_('common.routine')}</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip label={_('common.empty_workout')} active={routineId == null} onPress={() => setRoutineId(null)} />
        {(routines ?? []).map((r) => (
          <Chip key={r.id} label={routineLabel(r.name)} active={routineId === r.id} onPress={() => setRoutineId(r.id)} />
        ))}
      </View>
      <T variant="caption" muted>
        {routineId == null ? _('addPastWorkout.you_ll_add_exercises_in') : _('addPastWorkout.the_routine_s_exercises_come')}
      </T>
      <Button title={_('common.continue')} icon="check" onPress={save} disabled={future} loading={busy} style={{ marginTop: Spacing.md }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6 },
});
