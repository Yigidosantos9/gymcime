import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedRef, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

import { MuscleIcon } from '@/components/body-map';
import { DragList } from '@/components/drag-list';
import { HeaderBack } from '@/components/header-back';
import { Icon } from '@/components/icon';
import { useSheet } from '@/components/sheet';
import { Button, Card, IconButton, Input, PressableScale, T } from '@/components/ui';
import { Font, Radius, Spacing } from '@/constants/theme';
import { deleteRoutine, getExercise, getProfile, getRoutine, saveRoutine, type RoutineItem } from '@/db/queries';
import { useTheme } from '@/hooks/use-theme';
import { isTimeBased } from '@/lib/cardio';
import { haptic } from '@/lib/haptics';
import { pickerStore } from '@/lib/picker-store';
import { formatRest, REST_PRESETS } from '@/lib/rest';
import { beginWorkout } from '@/lib/start-workout';
import { leave } from '@/lib/nav';
import { syncReminders } from '@/lib/reminder-io';
import { useT } from '@/components/language-provider';
import { muscleLabel, equipmentLabel } from '@/i18n/labels';

/** Düzenleme sırasındaki kalem: kararlı bir anahtar (sürükle-bırak ve değiştirme için). */
type Draft = RoutineItem & { uid: string };
let uidCounter = 0;
const withUid = (it: RoutineItem): Draft => ({ ...it, uid: `d${++uidCounter}` });
const serialize = (name: string, items: RoutineItem[]) =>
  JSON.stringify([name.trim(), items.map((i) => [i.exercise_id, i.target_sets, i.rep_min, i.rep_max, i.rest_seconds ?? null])]);

export default function RoutineEditor() {
  const _ = useT();
  const t = useTheme();
  const db = useSQLiteContext();
  const sheet = useSheet();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const [name, setName] = useState('');
  const [items, setItems] = useState<Draft[]>([]);
  /** yüklenen/kaydedilen halin özeti; farklıysa kaydedilmemiş değişiklik var */
  const [snap, setSnap] = useState<string | null>(isNew ? serialize('', []) : null);
  const [dragging, setDragging] = useState(false);
  /** egzersiz değiştirme: hangi kalem için seçici açıldı */
  const replaceUid = useRef<string | null>(null);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const maxScrollY = useSharedValue(0);
  const contentH = useRef(0);
  const viewH = useRef(0);
  const updateMax = () => maxScrollY.set(Math.max(0, contentH.current - viewH.current));
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });
  const [loaded, setLoaded] = useState(isNew);
  const [profileRest, setProfileRest] = useState(90);

  useEffect(() => {
    getProfile(db).then((p) => p && setProfileRest(p.restSeconds));
    if (isNew) return;
    getRoutine(db, Number(id)).then((r) => {
      if (r) {
        setName(r.name);
        setItems(r.items.map(withUid));
        setSnap(serialize(r.name, r.items));
      } else {
        setSnap(serialize('', []));
      }
      setLoaded(true);
    });
  }, [db, id, isNew]);

  useFocusEffect(
    useCallback(() => {
      const ids = pickerStore.consume();
      if (!ids) {
        replaceUid.current = null; // seçici iptal edildi
        return;
      }
      (async () => {
        const added: Draft[] = [];
        for (const exId of ids) {
          const e = await getExercise(db, exId);
          if (e) {
            added.push(withUid({
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
            }));
          }
        }
        const target = replaceUid.current;
        replaceUid.current = null;
        if (target && added.length > 0) {
          // değiştir: ilk seçilen, eski egzersizin yerine geçer (set/tekrar/dinlenme ayarları korunur); fazlası sona eklenir
          const [first, ...rest] = added;
          setItems((prev) =>
            prev.map((it) =>
              it.uid === target
                ? { ...it, exercise_id: first.exercise_id, name: first.name, muscle: first.muscle, equipment: first.equipment, default_rest: first.default_rest, kind: first.kind, id: undefined }
                : it,
            ).concat(rest),
          );
        } else {
          setItems((prev) => [...prev, ...added]);
        }
      })();
    }, [db]),
  );

  const update = (idx: number, patch: Partial<RoutineItem>) => {
    haptic.tap();
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const reorder = useCallback((from: number, to: number) => {
    setItems((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(from, 1);
      copy.splice(to, 0, moved);
      return copy;
    });
  }, []);

  const dirty = loaded && snap != null && serialize(name, items) !== snap;

  const save = async () => {
    if (!name.trim()) {
      haptic.warning();
      sheet.actions({ title: _('routine.name_your_routine'), message: _('routine.for_example_push_day_or'), actions: [] , cancelLabel: _('common.ok') });
      return;
    }
    await saveRoutine(db, isNew ? null : Number(id), name.trim(), items);
    setSnap(serialize(name, items));
    syncReminders(db); // bildirimlerdeki rutin adı güncel kalsın
    haptic.success();
    leave();
  };

  /** Geri: kaydedilmemiş değişiklik varsa sheet sor. */
  const guardedLeave = () => {
    if (!dirty) {
      leave();
      return;
    }
    sheet.actions({
      title: _('routine.unsaved_changes'),
      message: _('routine.if_you_leave_your_changes'),
      cancelLabel: _('routine.keep_editing'),
      actions: [
        { label: _('common.save'), icon: 'check', style: 'primary', onPress: save },
        { label: _('routine.discard_changes'), icon: 'close', style: 'destructive', onPress: leave },
      ],
    });
  };

  // Android geri tuşu
  useFocusEffect(
    useCallback(() => {
      if (!dirty) return;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        guardedLeave();
        return true;
      });
      return () => sub.remove();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dirty, name, items]),
  );

  const remove = () =>
    sheet.actions({
      title: _('routine.delete_routine'),
      message: _('routine.your_past_workouts_are_kept'),
      actions: [
        {
          label: _('common.delete_routine'),
          icon: 'trash',
          style: 'destructive',
          onPress: async () => {
            await deleteRoutine(db, Number(id));
            syncReminders(db);
            leave();
          },
        },
      ],
    });

  const pickRest = (idx: number) => {
    const it = items[idx];
    const def = it.default_rest ?? profileRest;
    sheet.custom({
      title: _('common.rest', { name: it.name }),
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
            title={_('routine.use_default', { v: formatRest(def) })}
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
          title: isNew ? _('routine.new_routine') : _('routine.edit_routine'),
          gestureEnabled: !dirty,
          headerLeft: () => <HeaderBack onPress={guardedLeave} />,
          headerRight: () => (
            <PressableScale onPress={save} hitSlop={10} accessibilityRole="button" accessibilityLabel={_('routine.save_routine')}>
              <T variant="heading" color={t.primary}>{_('common.save')}</T>
            </PressableScale>
          ),
        }}
      />
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        onContentSizeChange={(_, h) => {
          contentH.current = h;
          updateMax();
        }}
        onLayout={(e) => {
          viewH.current = e.nativeEvent.layout.height;
          updateMax();
        }}
        scrollEventThrottle={16}
        scrollEnabled={!dragging}
        contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled">
        <Input
          value={name}
          onChangeText={setName}
          placeholder={_('routine.routine_name_e_g_back')}
          placeholderTextColor={t.textMuted}
          style={[styles.nameInput, { color: t.text }]}
        />
        <T variant="caption" muted style={{ marginBottom: Spacing.sm }}>
          {_('routine.exercises_sets', { count: items.length, v: items.reduce((a, i) => a + i.target_sets, 0), v2: items.length > 1 ? _('routine.hold_the_handle_and_drag') : '' })}
        </T>

        <DragList
          data={items}
          keyOf={(it) => it.uid}
          onReorder={reorder}
          scrollRef={scrollRef}
          scrollY={scrollY}
          maxScrollY={maxScrollY}
          onDragChange={setDragging}
          renderItem={(it, idx, handle) => {
            const rest = it.rest_seconds ?? it.default_rest ?? profileRest;
            const timeBased = isTimeBased(it.kind);
            return (
              <View style={{ paddingTop: Spacing.md }}>
                <Card>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                    {items.length > 1 && handle}
                    <MuscleIcon muscle={it.muscle} size={40} />
                    <View style={{ flex: 1 }}>
                      <T variant="heading" numberOfLines={1}>
                        {it.name}
                      </T>
                      <T variant="caption" secondary>
                        {muscleLabel(it.muscle)} · {equipmentLabel(it.equipment)}
                      </T>
                    </View>
                    <IconButton
                      icon="swap"
                      label={_('routine.swap_this_exercise_for_another')}
                      onPress={() => {
                        replaceUid.current = it.uid;
                        pickerStore.setExisting(items.map((i) => i.exercise_id));
                        router.push('/exercise-picker');
                      }}
                      bg="transparent"
                      color={t.primary}
                      size={15}
                    />
                    <IconButton icon="trash" onPress={() => setItems((p) => p.filter((_, i) => i !== idx))} bg="transparent" color={t.danger} size={15} />
                  </View>
                  <View style={styles.steppers}>
                    <Stepper label={_('common.sets')} value={it.target_sets} min={1} max={10} onChange={(v) => update(idx, { target_sets: v })} />
                    {!timeBased && (
                      <>
                        <Stepper label={_('routine.min_reps')} value={it.rep_min} min={1} max={it.rep_max} onChange={(v) => update(idx, { rep_min: v })} />
                        <Stepper label={_('routine.max_reps')} value={it.rep_max} min={it.rep_min} max={50} onChange={(v) => update(idx, { rep_max: v })} />
                      </>
                    )}
                  </View>
                  {it.kind !== 'cardio' && (
                    <PressableScale onPress={() => pickRest(idx)} style={[styles.restRow, { backgroundColor: t.surfaceRaised }]}>
                      <Icon name="timer" size={14} color={t.primary} />
                      <T variant="label" style={{ flex: 1 }}>{_('routine.rest_between_sets')}</T>
                      <T variant="label" color={t.primary} style={{ fontFamily: Font.bold }}>
                        {formatRest(rest)}
                        {it.rest_seconds == null ? _('routine.default') : ''}
                      </T>
                      <Icon name="chevronRight" size={12} color={t.textMuted} />
                    </PressableScale>
                  )}
                </Card>
              </View>
            );
          }}
        />

        <Button title={_('common.add_exercise')} icon="addCircle" kind="secondary" onPress={() => { pickerStore.setExisting(items.map((i) => i.exercise_id)); router.push('/exercise-picker'); }} style={{ marginTop: Spacing.lg }} />
        {!isNew && (
          <>
            <Button
              title={_('routine.start_with_this_routine')}
              icon="play"
              onPress={async () => {
                await saveRoutine(db, Number(id), name.trim() || 'Rutin', items);
                setSnap(serialize(name || 'Rutin', items));
                beginWorkout(db, Number(id), sheet);
              }}
              style={{ marginTop: Spacing.sm }}
            />
            <Button title={_('common.delete_routine')} kind="danger" icon="trash" onPress={remove} style={{ marginTop: Spacing.xl }} />
          </>
        )}
      </Animated.ScrollView>
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
