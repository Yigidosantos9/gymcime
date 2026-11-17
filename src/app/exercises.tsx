import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MuscleIcon } from '@/components/body-map';
import { CreateExerciseForm } from '@/components/create-exercise';
import { Icon } from '@/components/icon';
import { Button, Chip, PressableScale, T } from '@/components/ui';
import { Font, Radius, Spacing } from '@/constants/theme';
import { getExerciseMedia } from '@/db/exercise-media';
import { listExercises } from '@/db/queries';
import { MUSCLES } from '@/db/seed';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { EXERCISE_KINDS, type ExerciseKind } from '@/lib/cardio';
import { filterExercises } from '@/lib/exercise-library';
import { haptic } from '@/lib/haptics';
import { useT } from '@/components/language-provider';
import { equipmentLabel, muscleLabel } from '@/i18n/labels';

/** Egzersiz kütüphanesi: hiç yapılmamış hareketler dahil tüm egzersizler. */
export default function ExerciseLibrary() {
  const _ = useT();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { data: exercises, reload } = useDbQuery(listExercises);
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [kind, setKind] = useState<ExerciseKind | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => filterExercises(exercises ?? [], { q, muscle, kind }), [exercises, q, muscle, kind]);

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <View style={{ paddingHorizontal: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.sm }}>
        <View style={[styles.search, { backgroundColor: t.surfaceRaised, borderColor: t.border }]}>
          <Icon name="search" size={16} color={t.textMuted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={_('exercises.search_bench_back_triceps')}
            placeholderTextColor={t.textMuted}
            style={{ flex: 1, color: t.text, fontSize: 16, fontFamily: Font.medium }}
            autoCorrect={false}
          />
          {q.length > 0 && (
            <PressableScale onPress={() => setQ('')} hitSlop={8} accessibilityLabel={_('common.clear_search')}>
              <Icon name="close" size={14} color={t.textMuted} />
            </PressableScale>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: Spacing.lg }} style={{ marginHorizontal: -Spacing.lg, flexGrow: 0 }}>
          <Chip label={_('exercises.all_muscles')} active={!muscle} onPress={() => setMuscle(null)} />
          {MUSCLES.map((m) => (
            <Chip key={m} label={muscleLabel(m)} active={muscle === m} onPress={() => setMuscle(muscle === m ? null : m)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: Spacing.lg }} style={{ marginHorizontal: -Spacing.lg, flexGrow: 0 }}>
          <Chip label={_('exercises.all_types')} active={!kind} onPress={() => setKind(null)} />
          {EXERCISE_KINDS.map((k) => (
            <Chip key={k.key} label={k.label} active={kind === k.key} onPress={() => setKind(kind === k.key ? null : k.key)} />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(e) => String(e.id)}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ padding: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: 60 + insets.bottom }}
        ListHeaderComponent={
          exercises ? (
            <T variant="caption" secondary style={{ marginBottom: Spacing.sm }}>
              {_('common.exercises2', { count: filtered.length })}</T>
          ) : undefined
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xl }}>
            <T secondary>{_('exercises.no_matching_exercises')}</T>
          </View>
        }
        ListFooterComponent={
          <View style={{ marginTop: Spacing.md }}>
            {!creating ? (
              <Button title={q.trim().length > 1 ? _('common.create', { v: q.trim() }) : _('exercises.create_custom_exercise')} icon="add" kind="secondary" onPress={() => setCreating(true)} />
            ) : q.trim().length < 2 ? (
              <T secondary style={{ textAlign: 'center' }}>{_('exercises.first_type_the_new_exercise')}</T>
            ) : (
              <CreateExerciseForm
                name={q}
                submitLabel={_('exercises.create')}
                onCreated={async (id) => {
                  await reload();
                  haptic.success();
                  setCreating(false);
                  setQ('');
                  router.push(`/exercise/${id}`);
                }}
              />
            )}
          </View>
        }
        renderItem={({ item }) => {
          const media = getExerciseMedia(item.slug);
          return (
            <PressableScale onPress={() => router.push(`/exercise/${item.id}`)} scaleTo={0.98} style={styles.row} accessibilityLabel={item.name}>
              {media ? (
                <View style={[styles.thumb, { backgroundColor: '#FFFFFF', borderColor: t.border }]}>
                  <Image source={media.images[0]} style={StyleSheet.absoluteFill} contentFit="cover" />
                </View>
              ) : (
                <View style={[styles.thumb, { backgroundColor: t.surfaceRaised, borderColor: t.border }]} />
              )}
              <MuscleIcon muscle={item.muscle} size={36} />
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="heading" style={{ fontSize: 15 }} numberOfLines={1}>
                  {item.name}
                </T>
                <T variant="caption" secondary numberOfLines={1}>
                  {muscleLabel(item.muscle)} · {equipmentLabel(item.equipment)}
                  {item.kind === 'cardio' ? _('exercises.cardio') : item.kind === 'timed' ? _('common.timed') : item.kind === 'bodyweight' ? _('exercises.bodyweight') : ''}
                </T>
              </View>
              <Icon name="chevronRight" size={12} color={t.textMuted} />
            </PressableScale>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, height: 48, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  thumb: { width: 52, height: 52, borderRadius: Radius.sm, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
});
