import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { MuscleIcon } from '@/components/body-map';
import { Icon } from '@/components/icon';
import { useSheet } from '@/components/sheet';
import { Button, Card, IconButton, PressableScale, T } from '@/components/ui';
import { Font, Radius, Spacing } from '@/constants/theme';
import { deleteRoutine, getExercise, getProfile, getRoutine, saveRoutine, type RoutineItem } from '@/db/queries';
import { useTheme } from '@/hooks/use-theme';
import { isTimeBased } from '@/lib/cardio';
import { haptic } from '@/lib/haptics';
import { pickerStore } from '@/lib/picker-store';
import { formatRest, REST_PRESETS } from '@/lib/rest';
import { beginWorkout } from '@/lib/start-workout';
import { leave } from '@/lib/nav';

export default function RoutineEditor() {
  const t = useTheme();
  const db = useSQLiteContext();
  const sheet = useSheet();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const [name, setName] = useState('');
  const [items, setItems] = useState<RoutineItem[]>([]);
  const [loaded, setLoaded] = useState(isNew);
  const [profileRest, setProfileRest] = useState(90);

  useEffect(() => {
    getProfile(db).then((p) => p && setProfileRest(p.restSeconds));
    if (isNew) return;
    getRoutine(db, Number(id)).then((r) => {
      if (r) {
        setName(r.name);
        setItems(r.items);
      }
      setLoaded(true);
    });
  }, [db, id, isNew]);

  useFocusEffect(
    useCallback(() => {
      const ids = pickerStore.consume();
      if (!ids) return;
      (async () => {
        const added: RoutineItem[] = [];
        for (const exId of ids) {
          const e = await getExercise(db, exId);
          if (e) {
            added.push({
              exercise_id: e.id,
              name: e.name,
              muscle: e.muscle,
              equipment: e.equipment,
              target_sets: 3,
              rep_min: 8,
              rep_max: 12,
              rest_seconds: null,
              default_rest: e.rest_seconds,
              kind: e.kind,
            });
          }
        }
        setItems((prev) => [...prev, ...added]);
      })();
    }, [db]),
  );

  const update = (idx: number, patch: Partial<RoutineItem>) => {
    haptic.tap();
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    haptic.tap();
    setItems((prev) => {
      const copy = [...prev];
      [copy[idx], copy[j]] = [copy[j], copy[idx]];
      return copy;
    });
  };

  const save = async () => {
    if (!name.trim()) {
      haptic.warning();
      sheet.actions({ title: 'Rutine bir isim ver', message: 'Örneğin "Push Günü" veya "Bacak".', actions: [] , cancelLabel: 'Tamam' });
      return;
    }
    await saveRoutine(db, isNew ? null : Number(id), name.trim(), items);
    haptic.success();
    leave();
  };

  const remove = () =>
    sheet.actions({
      title: 'Rutini sil?',
      message: 'Geçmiş antrenmanların silinmez.',
      actions: [
        {
          label: 'Rutini sil',
          icon: 'trash',
          style: 'destructive',
          onPress: async () => {
            await deleteRoutine(db, Number(id));
            leave();
          },
        },
      ],
    });

  const pickRest = (idx: number) => {
    const it = items[idx];
    const def = it.default_rest ?? profileRest;
    sheet.custom({
      title: `${it.name} · dinlenme`,
      render: (close) => (
        <View style={{ gap: Spacing.md }}>
          <View style={styles.presetGrid}>
            {REST_PRESETS.map((p) => {
              const active = (it.rest_seconds ?? def) === p;
              return (
                <PressableScale
                  key={p}
                  onPress={() => {
                    update(idx, { rest_seconds: p });
                    close();
                  }}
                  style={[styles.preset, { backgroundColor: active ? t.primary : t.surfacePressed }]}>
                  <T variant="label" color={active ? t.onPrimary : t.text}>
                    {formatRest(p)}
                  </T>
                </PressableScale>
              );
            })}
          </View>
          <Button
            title={`Varsayılanı kullan (${formatRest(def)})`}
            kind="secondary"
            onPress={() => {
              update(idx, { rest_seconds: null });
              close();
            }}
          />
        </View>
      ),
    });
  };

  if (!loaded) return null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          title: isNew ? 'Yeni Rutin' : 'Rutini Düzenle',
          headerRight: () => (
            <PressableScale onPress={save} hitSlop={10}>
              <T variant="heading" color={t.primary}>
                Kaydet
              </T>
            </PressableScale>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Rutin adı (ör. Sırt günü, Göğüs + Triceps)"
          placeholderTextColor={t.textMuted}
          style={[styles.nameInput, { color: t.text }]}
        />
        <T variant="caption" muted style={{ marginBottom: Spacing.sm }}>
          {items.length} egzersiz · {items.reduce((a, i) => a + i.target_sets, 0)} set
        </T>

        {items.map((it, idx) => {
          const rest = it.rest_seconds ?? it.default_rest ?? profileRest;
          const timeBased = isTimeBased(it.kind);
          return (
            <Animated.View key={`${it.exercise_id}-${idx}`} entering={FadeInDown} layout={LinearTransition.springify().damping(20)}>
              <Card style={{ marginTop: Spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                  <MuscleIcon muscle={it.muscle} size={40} />
                  <View style={{ flex: 1 }}>
                    <T variant="heading" numberOfLines={1}>
                      {it.name}
                    </T>
                    <T variant="caption" secondary>
                      {it.muscle} · {it.equipment}
                    </T>
                  </View>
                  <IconButton icon="chevronUp" onPress={() => move(idx, -1)} bg="transparent" color={t.textSecondary} size={14} />
                  <IconButton icon="chevronDown" onPress={() => move(idx, 1)} bg="transparent" color={t.textSecondary} size={14} />
                  <IconButton icon="trash" onPress={() => setItems((p) => p.filter((_, i) => i !== idx))} bg="transparent" color={t.danger} size={15} />
                </View>
                <View style={styles.steppers}>
                  <Stepper label="Set" value={it.target_sets} min={1} max={10} onChange={(v) => update(idx, { target_sets: v })} />
                  {!timeBased && (
                    <>
                      <Stepper label="Min tekrar" value={it.rep_min} min={1} max={it.rep_max} onChange={(v) => update(idx, { rep_min: v })} />
                      <Stepper label="Max tekrar" value={it.rep_max} min={it.rep_min} max={50} onChange={(v) => update(idx, { rep_max: v })} />
                    </>
                  )}
                </View>
                {it.kind !== 'cardio' && (
                <PressableScale onPress={() => pickRest(idx)} style={[styles.restRow, { backgroundColor: t.surfaceRaised }]}>
                  <Icon name="timer" size={14} color={t.primary} />
                  <T variant="label" style={{ flex: 1 }}>
                    Setler arası dinlenme
                  </T>
                  <T variant="label" color={t.primary} style={{ fontFamily: Font.bold }}>
                    {formatRest(rest)}
                    {it.rest_seconds == null ? ' · varsayılan' : ''}
                  </T>
                  <Icon name="chevronRight" size={12} color={t.textMuted} />
                </PressableScale>
                )}
              </Card>
            </Animated.View>
          );
        })}

        <Button title="Egzersiz ekle" icon="addCircle" kind="secondary" onPress={() => router.push('/exercise-picker')} style={{ marginTop: Spacing.lg }} />
        {!isNew && (
          <>
            <Button
              title="Bu rutinle başla"
              icon="play"
              onPress={async () => {
                await saveRoutine(db, Number(id), name.trim() || 'Rutin', items);
                beginWorkout(db, Number(id), sheet);
              }}
              style={{ marginTop: Spacing.sm }}
            />
            <Button title="Rutini sil" kind="danger" icon="trash" onPress={remove} style={{ marginTop: Spacing.xl }} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
      <T variant="overline" muted style={{ fontSize: 9 }}>
        {label}
      </T>
      <View style={[styles.stepper, { backgroundColor: t.surfaceRaised }]}>
        <PressableScale onPress={() => value > min && onChange(value - 1)} hapticOnPress={false} style={styles.stepBtn}>
          <Icon name="minus" size={12} color={t.textSecondary} />
        </PressableScale>
        <T variant="heading" style={{ minWidth: 22, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
          {value}
        </T>
        <PressableScale onPress={() => value < max && onChange(value + 1)} hapticOnPress={false} style={styles.stepBtn}>
          <Icon name="add" size={12} color={t.primary} />
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nameInput: { fontSize: 30, fontFamily: Font.heavy, letterSpacing: -0.6, paddingVertical: 6 },
  steppers: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.pill, paddingHorizontal: 2 },
  stepBtn: { width: 30, height: 34, alignItems: 'center', justifyContent: 'center' },
  restRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.md, paddingHorizontal: Spacing.md, height: 42, borderRadius: Radius.sm },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  preset: { width: '18%', minWidth: 58, height: 44, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
});
