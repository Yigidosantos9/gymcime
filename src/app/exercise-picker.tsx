import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MuscleIcon } from '@/components/body-map';
import { CreateExerciseForm } from '@/components/create-exercise';
import { Icon } from '@/components/icon';
import { Badge, Button, Chip, IconButton, PressableScale, T } from '@/components/ui';
import { Font, Radius, Spacing } from '@/constants/theme';
import { addExercisesToWorkout, addHistoryExercise, getWorkoutExerciseIds, listExercises } from '@/db/queries';
import { useSheet } from '@/components/sheet';
import { MUSCLES } from '@/db/seed';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { filterExercises } from '@/lib/exercise-library';
import { haptic } from '@/lib/haptics';
import { pickerStore } from '@/lib/picker-store';
import { formatRest } from '@/lib/rest';
import { leave } from '@/lib/nav';
import { useT } from '@/components/language-provider';
import { equipmentLabel, muscleLabel } from '@/i18n/labels';

export default function ExercisePicker() {
  const _ = useT();
  const t = useTheme();
  const sheet = useSheet();
  const insets = useSafeAreaInsets();
  const { workoutId, historyWorkoutId } = useLocalSearchParams<{ workoutId?: string; historyWorkoutId?: string }>();
  const { data: exercises, db, reload } = useDbQuery(listExercises);
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);
  const contextWorkoutId = historyWorkoutId ?? workoutId;
  // Bağlamda (rutin / aktif antrenman / geçmiş antrenman) zaten olan egzersizler: etiket + yine de ekle uyarısı
  const { data: existingIds } = useDbQuery(
    async (db) => (contextWorkoutId ? getWorkoutExerciseIds(db, Number(contextWorkoutId)) : pickerStore.getExisting()),
    [contextWorkoutId],
  );
  const existing = useMemo(() => new Set(existingIds ?? []), [existingIds]);
  const existingLabel = _(contextWorkoutId ? 'exercisePicker.in_workout' : 'exercisePicker.in_routine');

  const filtered = useMemo(() => {
    return filterExercises(exercises ?? [], { q, muscle });
  }, [exercises, q, muscle]);

  const toggle = (id: number, name: string) => {
    const add = () => {
      haptic.tap();
      setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    };
    // Engelleme yok, uyarı var: zaten olan bir hareket yeni seçiliyorsa onay iste
    if (existing.has(id) && !selected.includes(id)) {
      sheet.actions({
        title: _('exercisePicker.is_already_there', { name: name }),
        message: _(contextWorkoutId ? 'exercisePicker.dup_workout' : 'exercisePicker.dup_routine'),
        cancelLabel: _('common.cancel'),
        actions: [{ label: _('exercisePicker.add_anyway'), icon: 'addCircle', onPress: add }],
      });
      return;
    }
    add();
  };

  const confirm = async () => {
    if (selected.length === 0) return;
    if (historyWorkoutId) {
      for (const exId of selected) await addHistoryExercise(db, Number(historyWorkoutId), exId);
    } else if (workoutId) await addExercisesToWorkout(db, Number(workoutId), selected);
    else pickerStore.deliver(selected);
    haptic.success();
    leave();
  };

  const onCreated = async (id: number) => {
    await reload();
    setSelected((s) => [...s, id]);
    setCreating(false);
    setQ('');
    haptic.success();
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.surface }}>
      <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, gap: Spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <T variant="title" style={{ flex: 1 }}>{_('common.add_exercise')}</T>
          <IconButton icon="close" onPress={leave} color={t.textSecondary} />
        </View>
        <View style={[styles.search, { backgroundColor: t.surfaceRaised, borderColor: t.border }]}>
          <Icon name="search" size={16} color={t.textMuted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={_('exercisePicker.search_bench_squat_curl')}
            placeholderTextColor={t.textMuted}
            style={{ flex: 1, color: t.text, fontSize: 16, fontFamily: Font.medium }}
            autoCorrect={false}
          />
          {q.length > 0 && (
            <PressableScale onPress={() => setQ('')} hitSlop={8}>
              <Icon name="close" size={14} color={t.textMuted} />
            </PressableScale>
          )}
        </View>
        <ScrollView
          horizontal
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: Spacing.lg }}
          style={{ marginHorizontal: -Spacing.lg, flexGrow: 0 }}>
          <Chip label={_('exercisePicker.all')} active={!muscle} onPress={() => setMuscle(null)} />
          {MUSCLES.map((m) => (
            <Chip key={m} label={muscleLabel(m)} active={muscle === m} onPress={() => setMuscle(muscle === m ? null : m)} />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(e) => String(e.id)}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 130 + insets.bottom }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xl }}>
            <T secondary>{_('exercisePicker.not_found', { q: q })}</T>
            {q.trim().length > 1 && !creating && (
              <Button title={_('common.create', { v: q.trim() })} icon="add" kind="secondary" onPress={() => setCreating(true)} />
            )}
          </View>
        }
        ListFooterComponent={
          creating ? (
            <CreateExerciseForm name={q} submitLabel={_('exercisePicker.create_and_select')} onCreated={onCreated} />
          ) : undefined
        }
        renderItem={({ item }) => {
          const on = selected.includes(item.id);
          const order = selected.indexOf(item.id) + 1;
          return (
            <PressableScale
              onPress={() => toggle(item.id, item.name)}
              hapticOnPress={false}
              scaleTo={0.98}
              style={[styles.row, { backgroundColor: on ? t.primarySoft : 'transparent', borderColor: on ? t.primary : 'transparent' }]}>
              <MuscleIcon muscle={item.muscle} size={44} />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <T variant="heading" style={{ fontSize: 15, flexShrink: 1 }}>
                    {item.name}
                  </T>
                  {existing.has(item.id) && <Badge label={existingLabel} tint={t.gold} bg={t.goldSoft} />}
                </View>
                <T variant="caption" secondary>
                  {muscleLabel(item.muscle)} · {equipmentLabel(item.equipment)}
                  {item.kind === 'cardio' ? _('exercisePicker.time_distance') : item.kind === 'timed' ? _('common.timed') : ''}
                  {item.rest_seconds ? _('exercisePicker.rest', { v: formatRest(item.rest_seconds) }) : ''}
                  {item.use_count > 0 ? ` · ${item.use_count}×` : ''}
                </T>
              </View>
              <IconButton icon="info" label={_('exercisePicker.info', { name: item.name })} onPress={() => router.push(`/exercise/${item.id}`)} bg="transparent" color={t.textSecondary} size={20} />
              <View style={[styles.check, { backgroundColor: on ? t.primary : 'transparent', borderColor: on ? t.primary : t.borderStrong }]}>
                {on && (
                  <T variant="label" color={t.onPrimary} style={{ fontFamily: Font.heavy }}>
                    {order}
                  </T>
                )}
              </View>
            </PressableScale>
          );
        }}
      />

      {selected.length > 0 && (
        <Animated.View entering={FadeInDown.springify().damping(16)} style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
          <Button title={_('exercisePicker.add_exercises', { count: selected.length })} icon="addCircle" onPress={confirm} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: Radius.md, marginBottom: 4, borderWidth: 1 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 16, right: 16, bottom: 0 },
});
