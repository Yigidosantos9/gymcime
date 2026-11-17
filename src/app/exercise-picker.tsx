import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MuscleIcon } from '@/components/body-map';
import { Icon } from '@/components/icon';
import { Button, Chip, IconButton, PressableScale, T } from '@/components/ui';
import { Font, Radius, Spacing } from '@/constants/theme';
import { addExercisesToWorkout, addHistoryExercise, createExercise, listExercises } from '@/db/queries';
import { EQUIPMENT, MUSCLES } from '@/db/seed';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { EXERCISE_KINDS, type ExerciseKind } from '@/lib/cardio';
import { haptic } from '@/lib/haptics';
import { pickerStore } from '@/lib/picker-store';
import { formatRest } from '@/lib/rest';
import { leave } from '@/lib/nav';

const normalize = (s: string) =>
  s.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');

export default function ExercisePicker() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { workoutId, historyWorkoutId } = useLocalSearchParams<{ workoutId?: string; historyWorkoutId?: string }>();
  const { data: exercises, db, reload } = useDbQuery(listExercises);
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);
  const [newMuscle, setNewMuscle] = useState<string>(MUSCLES[0]);
  const [newEquip, setNewEquip] = useState<string>(EQUIPMENT[0]);
  const [newKind, setNewKind] = useState<ExerciseKind>('strength');

  const filtered = useMemo(() => {
    const nq = normalize(q.trim());
    return (exercises ?? []).filter((e) => (!muscle || e.muscle === muscle) && (!nq || normalize(e.name).includes(nq) || normalize(e.alias ?? '').includes(nq) || normalize(e.muscle).includes(nq)));
  }, [exercises, q, muscle]);

  const toggle = (id: number) => {
    haptic.tap();
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
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

  const create = async () => {
    if (!q.trim()) return;
    const id = await createExercise(db, q, newMuscle, newEquip, newKind);
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
          <T variant="title" style={{ flex: 1 }}>
            Egzersiz ekle
          </T>
          <IconButton icon="close" onPress={leave} color={t.textSecondary} />
        </View>
        <View style={[styles.search, { backgroundColor: t.surfaceRaised, borderColor: t.border }]}>
          <Icon name="search" size={16} color={t.textMuted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Ara: bench, squat, curl…"
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
          <Chip label="Tümü" active={!muscle} onPress={() => setMuscle(null)} />
          {MUSCLES.map((m) => (
            <Chip key={m} label={m} active={muscle === m} onPress={() => setMuscle(muscle === m ? null : m)} />
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
            <T secondary>“{q}” bulunamadı.</T>
            {q.trim().length > 1 && !creating && (
              <Button title={`“${q.trim()}” oluştur`} icon="add" kind="secondary" onPress={() => setCreating(true)} />
            )}
          </View>
        }
        ListFooterComponent={
          creating ? (
            <Animated.View entering={FadeInDown} style={[styles.createBox, { backgroundColor: t.surfaceRaised, borderColor: t.border }]}>
              <T variant="heading">Yeni egzersiz: {q.trim()}</T>
              <T variant="overline" secondary>
                Tür
              </T>
              <View style={styles.wrap}>
                {EXERCISE_KINDS.map((k) => (
                  <Chip
                    key={k.key}
                    label={k.label}
                    active={newKind === k.key}
                    onPress={() => {
                      setNewKind(k.key);
                      if (k.key === 'cardio') setNewMuscle('Kardiyo');
                      else if (newMuscle === 'Kardiyo') setNewMuscle(k.key === 'timed' ? 'Karın' : MUSCLES[0]);
                      if (k.key === 'bodyweight') setNewEquip('Vücut');
                    }}
                  />
                ))}
              </View>
              <T variant="caption" muted>
                {EXERCISE_KINDS.find((k) => k.key === newKind)?.hint}
              </T>
              <T variant="overline" secondary>
                Kas grubu
              </T>
              <View style={styles.wrap}>
                {MUSCLES.map((m) => (
                  <Chip key={m} label={m} active={newMuscle === m} onPress={() => setNewMuscle(m)} />
                ))}
              </View>
              <T variant="overline" secondary>
                Ekipman
              </T>
              <View style={styles.wrap}>
                {EQUIPMENT.map((m) => (
                  <Chip key={m} label={m} active={newEquip === m} onPress={() => setNewEquip(m)} />
                ))}
              </View>
              <Button title="Oluştur ve seç" icon="check" onPress={create} />
            </Animated.View>
          ) : undefined
        }
        renderItem={({ item }) => {
          const on = selected.includes(item.id);
          const order = selected.indexOf(item.id) + 1;
          return (
            <PressableScale
              onPress={() => toggle(item.id)}
              hapticOnPress={false}
              scaleTo={0.98}
              style={[styles.row, { backgroundColor: on ? t.primarySoft : 'transparent', borderColor: on ? t.primary : 'transparent' }]}>
              <MuscleIcon muscle={item.muscle} size={44} />
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="heading" style={{ fontSize: 15 }}>
                  {item.name}
                </T>
                <T variant="caption" secondary>
                  {item.muscle} · {item.equipment}
                  {item.kind === 'cardio' ? ' · süre + mesafe' : item.kind === 'timed' ? ' · süreli' : ''}
                  {item.rest_seconds ? ` · ${formatRest(item.rest_seconds)} mola` : ''}
                  {item.use_count > 0 ? ` · ${item.use_count}×` : ''}
                </T>
              </View>
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
          <Button title={`${selected.length} egzersiz ekle`} icon="addCircle" onPress={confirm} />
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
  createBox: { padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, gap: Spacing.md, marginTop: Spacing.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
