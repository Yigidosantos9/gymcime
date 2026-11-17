import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { MuscleIcon } from '@/components/body-map';
import { useSheet } from '@/components/sheet';
import { Badge, Button, Card, PressableScale, Stat, T } from '@/components/ui';
import { Font, Spacing } from '@/constants/theme';
import { deleteWorkout, getWorkoutDetail } from '@/db/queries';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { formatDayLong, formatDuration, formatMinutes, formatVolume, formatWeight } from '@/lib/format';
import { estimate1RM } from '@/lib/progression';
import { SET_TYPES } from '@/lib/rest';
import { leave } from '@/lib/nav';

export default function Session() {
  const t = useTheme();
  const sheet = useSheet();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, db } = useDbQuery((db) => getWorkoutDetail(db, Number(id)), [id]);

  if (!data) return null;
  const { workout, exercises } = data;
  const sets = exercises.flatMap((e) => e.sets);
  const volume = sets.reduce((acc, s) => acc + (s.weight ?? 0) * (s.reps ?? 0), 0);
  const rests = sets.filter((s) => s.rest_taken != null);
  const avgRest = rests.length ? Math.round(rests.reduce((a, s) => a + (s.rest_taken ?? 0), 0) / rests.length) : null;

  const onDelete = () =>
    sheet.actions({
      title: 'Antrenmanı sil?',
      message: 'Bu işlem geri alınamaz.',
      actions: [
        {
          label: 'Sil',
          icon: 'trash',
          style: 'destructive',
          onPress: async () => {
            await deleteWorkout(db, workout.id);
            leave();
          },
        },
      ],
    });

  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 60 }}>
      <Stack.Screen options={{ title: formatDayLong(workout.started_at) }} />
      <T variant="overline" secondary>
        {new Date(workout.started_at).toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short' })}
      </T>
      <T variant="display">{workout.name}</T>

      <Card style={{ marginTop: Spacing.lg }}>
        <View style={{ flexDirection: 'row' }}>
          <Stat label="Süre" value={formatMinutes((workout.finished_at ?? workout.started_at) - workout.started_at)} />
          <Stat label="Set" value={String(sets.length)} />
          <Stat label="Hacim" value={formatVolume(volume)} />
          {avgRest != null && <Stat label="Ort. mola" value={formatDuration(avgRest * 1000)} />}
        </View>
      </Card>

      {exercises.map((ex) => {
        const best = Math.max(0, ...ex.sets.filter((s) => s.set_type !== 'warmup').map((s) => estimate1RM(s.weight, s.reps)));
        let n = 0;
        return (
          <Card key={ex.id} style={{ marginTop: Spacing.md }}>
            <PressableScale onPress={() => router.push(`/exercise/${ex.exercise_id}`)} scaleTo={0.98} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
              <MuscleIcon muscle={ex.muscle} size={40} />
              <View style={{ flex: 1 }}>
                <T variant="heading">{ex.name}</T>
                <T variant="caption" secondary>
                  {ex.muscle}
                  {best > 0 ? ` · tahmini 1RM ${formatWeight(Math.round(best * 2) / 2)} kg` : ''}
                </T>
              </View>
            </PressableScale>
            <View style={{ marginTop: Spacing.md, gap: 4 }}>
              {ex.sets.map((s) => {
                const warm = s.set_type === 'warmup';
                const label = warm ? 'I' : String(++n);
                const typeInfo = SET_TYPES.find((x) => x.key === s.set_type);
                return (
                  <View key={s.id} style={[styles.setRow, { backgroundColor: t.surfaceRaised }]}>
                    <T variant="label" color={warm ? t.gold : t.textSecondary} style={{ width: 24, fontFamily: Font.heavy }}>
                      {label}
                    </T>
                    <T variant="body" style={{ flex: 1, fontFamily: Font.bold }}>
                      {s.weight ? `${formatWeight(s.weight)} kg` : 'Vücut'} × {s.reps ?? 0}
                    </T>
                    {s.set_type !== 'normal' && s.set_type !== 'warmup' && typeInfo && (
                      <Badge label={typeInfo.label} tint={s.set_type === 'drop' ? t.violet : t.danger} bg={s.set_type === 'drop' ? t.violetSoft : t.dangerSoft} />
                    )}
                    {s.rest_taken != null && (
                      <T variant="caption" muted style={{ marginLeft: 8 }}>
                        ⏱ {formatDuration(s.rest_taken * 1000)}
                      </T>
                    )}
                    {s.is_pr ? <T style={{ marginLeft: 6 }}>🏆</T> : null}
                  </View>
                );
              })}
            </View>
          </Card>
        );
      })}

      <Button title="Antrenmanı sil" kind="danger" icon="trash" onPress={onDelete} style={{ marginTop: Spacing.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  setRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
});
