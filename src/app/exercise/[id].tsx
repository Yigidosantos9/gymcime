import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { MuscleIcon } from '@/components/body-map';
import { LineChart } from '@/components/charts';
import { ExerciseGuideCard } from '@/components/exercise-guide';
import { Icon } from '@/components/icon';
import { useSheet } from '@/components/sheet';
import { Button, Card, Chip, EmptyState, PressableScale, SectionHeader, Stat, T } from '@/components/ui';
import { Font, Radius, Spacing } from '@/constants/theme';
import { exerciseHistory, getExercise, getProfile, setExerciseDefaultRest } from '@/db/queries';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatDayLong, formatVolume, formatWeight } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { formatRest, REST_PRESETS } from '@/lib/rest';

type Metric = 'best1rm' | 'top_weight' | 'volume';
const METRICS: { key: Metric; label: string }[] = [
  { key: 'best1rm', label: 'Tahmini 1RM' },
  { key: 'top_weight', label: 'En ağır' },
  { key: 'volume', label: 'Hacim' },
];

export default function ExerciseDetail() {
  const t = useTheme();
  const sheet = useSheet();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [metric, setMetric] = useState<Metric>('best1rm');
  const { data, db, reload } = useDbQuery(
    async (db) => {
      const [exercise, history, profile] = await Promise.all([getExercise(db, Number(id)), exerciseHistory(db, Number(id)), getProfile(db)]);
      return { exercise, history, profileRest: profile?.restSeconds ?? 90 };
    },
    [id],
  );

  if (!data?.exercise) return null;
  const { exercise, history, profileRest } = data;
  const best1rm = Math.max(0, ...history.map((h) => h.best1rm));
  const heaviest = Math.max(0, ...history.map((h) => h.top_weight));
  const bestVol = Math.max(0, ...history.map((h) => h.volume));
  const fmt = (v: number) => (metric === 'volume' ? formatVolume(v) : `${formatWeight(Math.round(v * 2) / 2)} kg`);
  const rest = exercise.rest_seconds ?? profileRest;

  const pickRest = () =>
    sheet.custom({
      title: 'Varsayılan dinlenme',
      render: (close) => (
        <View style={{ gap: Spacing.md }}>
          <View style={styles.presetGrid}>
            {REST_PRESETS.map((p) => (
              <PressableScale
                key={p}
                onPress={async () => {
                  await setExerciseDefaultRest(db, exercise.id, p);
                  haptic.success();
                  close();
                  reload();
                }}
                style={[styles.preset, { backgroundColor: rest === p ? t.primary : t.surfacePressed }]}>
                <T variant="label" color={rest === p ? t.onPrimary : t.text}>
                  {formatRest(p)}
                </T>
              </PressableScale>
            ))}
          </View>
          <Button
            title={`Genel ayarı kullan (${formatRest(profileRest)})`}
            kind="secondary"
            onPress={async () => {
              await setExerciseDefaultRest(db, exercise.id, null);
              close();
              reload();
            }}
          />
        </View>
      ),
    });

  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 60 }}>
      <Stack.Screen options={{ title: '' }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
        <MuscleIcon muscle={exercise.muscle} size={60} />
        <View style={{ flex: 1 }}>
          <T variant="title">{exercise.name}</T>
          <T secondary variant="label">
            {exercise.muscle} · {exercise.equipment}
          </T>
        </View>
      </View>

      <PressableScale onPress={pickRest} style={[styles.restRow, { backgroundColor: t.surface, borderColor: t.border }]}>
        <Icon name="timer" size={16} color={t.primary} />
        <T variant="label" style={{ flex: 1 }}>
          Varsayılan dinlenme
        </T>
        <T variant="label" color={t.primary} style={{ fontFamily: Font.bold }}>
          {formatRest(rest)}
        </T>
        <Icon name="chevronRight" size={12} color={t.textMuted} />
      </PressableScale>

      <ExerciseGuideCard exercise={exercise} />

      {history.length === 0 ? (
        <Card style={{ marginTop: Spacing.lg }}>
          <EmptyState icon="chart" title="Henüz kayıt yok" text="Bu egzersizi bir antrenmanda tamamladığında grafiklerin burada görünecek." />
        </Card>
      ) : (
        <>
          <Animated.View entering={FadeInDown.duration(350)}>
            <Card style={{ marginTop: Spacing.lg }}>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: Spacing.md }}>
                {METRICS.map((m) => (
                  <Chip key={m.key} label={m.label} active={metric === m.key} onPress={() => setMetric(m.key)} />
                ))}
              </View>
              <LineChart values={history.map((h) => h[metric])} labels={history.map((h) => formatDate(h.started_at))} formatValue={fmt} height={180} />
            </Card>
          </Animated.View>

          <SectionHeader title="Rekorlar 🏆" />
          <Card>
            <View style={{ flexDirection: 'row' }}>
              <Stat label="Tahmini 1RM" value={formatWeight(Math.round(best1rm * 2) / 2)} unit="kg" />
              <Stat label="En ağır" value={formatWeight(heaviest)} unit="kg" />
              <Stat label="En iyi hacim" value={formatVolume(bestVol)} />
            </View>
          </Card>

          <SectionHeader title="Seanslar" />
          {[...history].reverse().map((h) => (
            <PressableScale key={h.workout_id} onPress={() => router.push(`/session/${h.workout_id}`)} scaleTo={0.98}>
              <Card style={{ marginBottom: Spacing.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <T variant="label">{formatDayLong(h.started_at)}</T>
                  <T variant="label" color={t.primary} style={{ fontFamily: Font.bold }}>
                    ~{formatWeight(Math.round(h.best1rm * 2) / 2)} kg
                  </T>
                </View>
                <T variant="caption" secondary style={{ marginTop: 4 }}>
                  {h.sets
                    .split(', ')
                    .map((s) => {
                      const [w, r] = s.split('x');
                      return `${formatWeight(Number(w))}×${r}`;
                    })
                    .join('  ·  ')}
                </T>
              </Card>
            </PressableScale>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  restRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    height: 50,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  preset: { width: '18%', minWidth: 58, height: 44, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
});
