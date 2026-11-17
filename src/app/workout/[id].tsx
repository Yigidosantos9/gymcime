import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { FadeIn, FadeInDown, FadeOutDown, FadeOutUp, LinearTransition, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MuscleIcon } from '@/components/body-map';
import { Icon } from '@/components/icon';
import { openPlateSheet } from '@/components/plate-sheet';
import { RestTimerBar, useRestTimer } from '@/components/rest-timer';
import { useSheet } from '@/components/sheet';
import { Badge, Button, Card, IconButton, PressableScale, T } from '@/components/ui';
import { Font, Radius, Spacing } from '@/constants/theme';
import {
  addSet,
  addWarmupSets,
  setSetNote,
  setSetRir,
  deleteSet,
  discardWorkout,
  finishWorkout,
  getProfile,
  getWorkoutDetail,
  removeWorkoutExercise,
  setExerciseDefaultRest,
  setSetType,
  setWorkoutExerciseRest,
  toggleSetDone,
  updateCardioValues,
  updateSetValues,
  type SetRow as SetRowData,
  type WorkoutExerciseFull,
} from '@/db/queries';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration, formatWeight, parseNumber } from '@/lib/format';
import { formatClock, formatHold, formatKm, isTimeBased, parseClock, parseHold, parseKm } from '@/lib/cardio';
import { haptic } from '@/lib/haptics';
import { DEFAULT_PLATES } from '@/lib/plates';
import {
  adjustBodyweight,
  EFFORT,
  EFFORT_NAME,
  RULE_TABLE,
  effortLabel,
  incrementFor,
  planSets,
  replanAfter,
  type Increments,
  type SetPlan,
  type SuggestKind,
} from '@/lib/progression';
import { baseRest, formatRest, REST_PRESETS, restAfter, SET_TYPES, type SetType } from '@/lib/rest';
import type { IconName } from '@/components/icon';
import type { Palette } from '@/constants/theme';
import { leave } from '@/lib/nav';
import { useT } from '@/components/language-provider';
import { muscleLabel, routineLabel } from '@/i18n/labels';
import { t as tt } from '@/i18n';

const KIND_ICON: Record<SuggestKind, IconName> = {
  start: 'sparkles',
  increase: 'arrowUp',
  hold: 'target',
  decrease: 'arrowDown',
  deload: 'restart',
  return: 'restart',
};
const KIND_COLOR = (t: Palette): Record<SuggestKind, string> => ({
  start: t.primary,
  increase: t.success,
  hold: t.primary,
  decrease: t.danger,
  deload: t.violet,
  return: t.gold,
});

function ConfidenceDots({ level }: { level: 'low' | 'medium' | 'high' }) {
  const _ = useT();
  const t = useTheme();
  const n = level === 'high' ? 3 : level === 'medium' ? 2 : 1;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <T variant="caption" muted style={{ fontSize: 10 }}>
        {_('workout.confidence')}
      </T>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: i < n ? t.primary : t.surfacePressed }} />
      ))}
    </View>
  );
}

type Db = ReturnType<typeof useDbQuery>['db'];
type Sheet = ReturnType<typeof useSheet>;

export default function WorkoutScreen() {
  const _ = useT();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const sheet = useSheet();
  const { id } = useLocalSearchParams<{ id: string }>();
  const workoutId = Number(id);
  const rest = useRestTimer();
  const [prToast, setPrToast] = useState<string | null>(null);
  /** Az önce tamamlanan çalışma seti: mola sırasında "nasıl geçti?" diye sorulur */
  const [askEffort, setAskEffort] = useState<{ setId: number; exName: string } | null>(null);
  /** Son set tamamlanan egzersiz: "sıradaki" önce burada aranır */
  const [currentExId, setCurrentExId] = useState<number | null>(null);

  const { data, reload, db } = useDbQuery(
    async (db) => {
      const profile = await getProfile(db);
      const increments: Increments = {
        barbell: profile?.incBarbell ?? 2.5,
        dumbbell: profile?.incDumbbell ?? 2,
        machine: profile?.incMachine ?? 2.5,
      };
      const detail = await getWorkoutDetail(db, workoutId, { goal: profile?.goal, increments, setStyle: profile?.setStyle });
      return { detail, profileRest: profile?.restSeconds ?? 90, increments, plateCfg: { bar: profile?.barWeight ?? 20, plates: profile?.plates ?? DEFAULT_PLATES } };
    },
    [workoutId],
  );

  // Sıradaki setin önerisini mola sayacına yansıt (zorluk seçilince değişir)
  const restActive = rest.rest != null;
  const { updateNext } = rest;
  useEffect(() => {
    if (!data?.detail || !restActive) return;
    updateNext(nextTarget(data.detail.exercises, data.increments, currentExId));
  }, [data, restActive, updateNext, currentExId]);

  useEffect(() => {
    if (!prToast) return;
    const tm = setTimeout(() => setPrToast(null), 2600);
    return () => clearTimeout(tm);
  }, [prToast]);

  if (!data) return <View style={{ flex: 1, backgroundColor: t.background }} />;
  if (!data.detail) {
    return (
      <View style={{ flex: 1, backgroundColor: t.background, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <T>{_('workout.workout_not_found')}</T>
        <Button title={_('workout.go_back')} kind="secondary" onPress={leave} />
      </View>
    );
  }

  const { workout, exercises } = data.detail;
  const profileRest = data.profileRest;
  const allSets = exercises.flatMap((e) => e.sets);
  const doneSets = allSets.filter((s) => s.done).length;

  /** Bir set tamamlandığında sıradaki seti bul (aynı egzersiz, yoksa sonraki egzersiz). */
  const nextLabel = (exIdx: number, setId: number) => {
    const ex = exercises[exIdx];
    const pending = ex.sets.filter((s) => !s.done && s.id !== setId);
    if (pending.length) return `${ex.name} · ${setLabel(ex.sets, pending[0])}`;
    for (let i = exIdx + 1; i < exercises.length; i++) {
      const p = exercises[i].sets.find((s) => !s.done);
      if (p) return `${exercises[i].name} · ${setLabel(exercises[i].sets, p)}`;
    }
    return undefined;
  };

  const onFinish = () => {
    const pending = allSets.length - doneSets;
    const go = async () => {
      rest.stop();
      const ok = await finishWorkout(db, workoutId);
      if (!ok) {
        haptic.warning();
        leave();
        return;
      }
      haptic.success();
      router.replace(`/summary/${workoutId}`);
    };
    if (doneSets === 0) {
      sheet.actions({
        title: _('workout.no_sets_completed'),
        message: _('workout.if_you_finish_this_workout'),
        actions: [{ label: _('workout.delete_and_exit'), icon: 'trash', style: 'destructive', onPress: go }],
      });
    } else {
      sheet.actions({
        title: _('workout.finish_workout'),
        message: pending > 0 ? _('workout.incomplete_sets_won_t_be', { count: pending }) : _('workout.great_job'),
        actions: [{ label: _('workout.finish_and_save'), icon: 'checkCircle', style: 'primary', onPress: go }],
        cancelLabel: _('common.continue'),
      });
    }
  };

  const onDiscard = () => {
    sheet.actions({
      title: _('workout.cancel_workout'),
      message: _('workout.all_records_in_this_workout'),
      actions: [
        {
          label: _('workout.cancel_and_delete'),
          icon: 'trash',
          style: 'destructive',
          onPress: async () => {
            rest.stop();
            await discardWorkout(db, workoutId);
            leave();
          },
        },
      ],
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      {/* Üst bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <IconButton icon="chevronDown" label={_('workout.minimize_workout')} onPress={leave} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <T variant="heading" numberOfLines={1}>
            {routineLabel(workout.name)}
          </T>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Elapsed since={workout.started_at} />
            <T variant="caption" muted>
              ·
            </T>
            <T variant="caption" secondary style={{ fontVariant: ['tabular-nums'] }}>
              {_('workout.sets', { doneSets: doneSets, count: allSets.length })}</T>
          </View>
        </View>
        <PressableScale onPress={onFinish} accessibilityLabel={_('workout.finish_workout2')} style={[styles.finishBtn, { backgroundColor: t.success }]}>
          <T variant="label" color={t.onPrimary} style={{ fontFamily: Font.bold }}>{_('workout.finish')}</T>
        </PressableScale>
      </View>
      <View style={{ height: 3, backgroundColor: t.surface, marginHorizontal: Spacing.lg, borderRadius: 2, overflow: 'hidden' }}>
        <Animated.View
          layout={LinearTransition}
          style={{ height: 3, width: `${allSets.length ? (doneSets / allSets.length) * 100 : 0}%`, backgroundColor: t.primary }}
        />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 170 + insets.bottom + (askEffort ? 130 : 0) }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}>
          {exercises.length === 0 && (
            <Animated.View entering={FadeIn} style={{ alignItems: 'center', paddingVertical: 48, gap: 8 }}>
              <Icon name="homeOutline" size={40} color={t.primary} />
              <T variant="heading">{_('workout.a_blank_page')}</T>
              <T secondary>{_('workout.start_by_adding_your_first')}</T>
            </Animated.View>
          )}

          {exercises.map((ex, i) => (
            <Animated.View
              key={ex.id}
              entering={FadeInDown.delay(i * 50).springify().damping(18)}
              layout={LinearTransition.springify().damping(20)}>
              <ExerciseBlock
                ex={ex}
                increments={data.increments}
                plateCfg={data.plateCfg}
                db={db}
                sheet={sheet}
                profileRest={profileRest}
                onChanged={reload}
                onSetDone={(set, isPr) => {
                  // kardiyoda mola sayacı başlamaz; kardiyo/süreli setlerde zorluk paneli çıkmaz
                  if (ex.kind !== 'cardio') {
                    const secs = restAfter(baseRest(ex.rest_seconds, ex.exercise_rest, profileRest), set.set_type);
                    rest.start(secs, nextLabel(i, set.id));
                  }
                  setCurrentExId(ex.id);
                  if (!isTimeBased(ex.kind) && (set.set_type === 'normal' || set.set_type === 'failure')) setAskEffort({ setId: set.id, exName: ex.name });
                  if (isPr) {
                    haptic.success();
                    setPrToast(ex.name);
                  } else {
                    haptic.light();
                  }
                }}
              />
            </Animated.View>
          ))}

          <Button
            title={_('common.add_exercise')}
            icon="addCircle"
            kind="secondary"
            onPress={() => router.push(`/exercise-picker?workoutId=${workoutId}`)}
            style={{ marginTop: Spacing.sm }}
          />
          <Button title={_('workout.finish_workout2')} icon="checkCircle" kind="success" onPress={onFinish} style={{ marginTop: Spacing.lg }} />
          <Button title={_('workout.cancel_workout2')} kind="ghost" onPress={onDiscard} style={{ marginTop: Spacing.sm }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {askEffort && pendingEffort(exercises, askEffort.setId) && (
        <EffortPanel
          bottom={insets.bottom + 10 + (restActive ? 92 : 0)}
          exName={askEffort.exName}
          onPick={async (rir) => {
            await setSetRir(db, askEffort.setId, rir);
            haptic.medium();
            setAskEffort(null);
            reload();
          }}
          onClose={() => setAskEffort(null)}
        />
      )}

      <RestTimerBar bottom={insets.bottom + 10} />

      {prToast && (
        <Animated.View
          entering={ZoomIn.springify().damping(14)}
          exiting={FadeOutUp}
          style={[styles.toast, { top: insets.top + 74, backgroundColor: t.surfaceRaised, borderColor: t.gold }]}>
          <T style={{ fontSize: 24 }}>🏆</T>
          <View>
            <T variant="heading" color={t.gold}>{_('workout.new_personal_record')}</T>
            <T variant="caption" secondary>
              {prToast}
            </T>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

/** Panel yalnızca set hâlâ tamamlanmış ve zorluğu girilmemişse görünür. */
function pendingEffort(exercises: WorkoutExerciseFull[], setId: number) {
  for (const ex of exercises) {
    const s = ex.sets.find((x) => x.id === setId);
    if (s) return !!s.done && s.rir == null;
  }
  return false;
}

/** Sıradaki tamamlanmamış set + önerilen kilo × tekrar (mola sayacında gösterilir). */
function nextTarget(exercises: WorkoutExerciseFull[], increments: Increments, preferExId: number | null) {
  // önce şu anki egzersiz, sonra ondan sonrakiler, en son öncekiler (atlanmış setler)
  const start = Math.max(0, exercises.findIndex((e) => e.id === preferExId));
  const ordered = [...exercises.slice(start), ...exercises.slice(0, start)];
  for (const ex of ordered) {
    if (ex.kind === 'cardio') continue; // kardiyoda mola yok
    const { rows } = planRows(ex, incrementFor(ex.equipment, increments));
    const next = rows.find((r) => !r.s.done);
    if (next && ex.kind === 'timed') {
      const d = ex.cardioSuggestion?.duration_sec;
      return `${ex.name} · ${setLabel(ex.sets, next.s)}${d ? ` · ${formatHold(d)}` : ''}`;
    }
    if (next) {
      const what = next.phWeight != null ? `${formatWeight(next.phWeight)} kg × ${next.phReps}` : tt('common.reps_n', { count: next.phReps });
      return `${ex.name} · ${setLabel(ex.sets, next.s)} · ${what}`;
    }
  }
  return undefined;
}

function EffortPanel({
  bottom,
  exName,
  onPick,
  onClose,
}: {
  bottom: number;
  exName: string;
  onPick: (rir: number) => void;
  onClose: () => void;
}) {
  const _ = useT();
  const t = useTheme();
  const colors: Record<number, [string, string]> = {
    4: [t.success, t.successSoft],
    2: [t.primary, t.primarySoft],
    1: [t.gold, t.goldSoft],
    0: [t.danger, t.dangerSoft],
  };
  return (
    <Animated.View
      entering={FadeInDown.springify().damping(17)}
      exiting={FadeOutDown.duration(160)}
      style={[styles.effortPanel, { bottom, backgroundColor: t.surfaceRaised, borderColor: t.borderStrong, shadowColor: t.shadow }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <T variant="heading" style={{ fontSize: 15 }}>{_('common.how_did_this_set_go')}</T>
          <T variant="caption" muted numberOfLines={1}>
            {_('workout.the_next_set_s_suggestion', { exName: exName })}</T>
        </View>
        <PressableScale onPress={onClose} hitSlop={12} accessibilityLabel={_('common.close')} style={styles.effortClose}>
          <Icon name="close" size={13} color={t.textMuted} />
        </PressableScale>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        {EFFORT.map((e) => (
          <PressableScale
            key={e.key}
            onPress={() => onPick(e.key)}
            scaleTo={0.92}
            style={[styles.effortBtn, { backgroundColor: colors[e.key][1], borderColor: colors[e.key][0] }]}>
            <T variant="label" color={colors[e.key][0]} style={{ fontFamily: Font.heavy }}>
              {e.label}
            </T>
          </PressableScale>
        ))}
      </View>
    </Animated.View>
  );
}

function setLabel(sets: SetRowData[], s: SetRowData) {
  if (s.set_type === 'warmup') return tt('workout.warm_up');
  const n = sets.filter((x) => x.set_type !== 'warmup' && x.position <= s.position).length;
  return tt('workout.set_n', { n });
}

function Elapsed({ since }: { since: number }) {
  const t = useTheme();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <T variant="caption" color={t.primary} style={{ fontVariant: ['tabular-nums'], fontFamily: Font.bold }}>
      {formatDuration(now - since)}
    </T>
  );
}

// ───────────────────────── Egzersiz bloğu ─────────────────────────

function ExerciseBlock({
  ex,
  increments,
  plateCfg,
  db,
  sheet,
  profileRest,
  onChanged,
  onSetDone,
}: {
  ex: WorkoutExerciseFull;
  increments: Increments;
  plateCfg: { bar: number; plates: number[] };
  db: Db;
  sheet: Sheet;
  profileRest: number;
  onChanged: () => void;
  onSetDone: (set: SetRowData, isPr: boolean) => void;
}) {
  const _ = useT();
  const t = useTheme();
  const sug = ex.suggestion;
  const sugColor = KIND_COLOR(t)[sug.kind];
  const rest = baseRest(ex.rest_seconds, ex.exercise_rest, profileRest);
  const step = incrementFor(ex.equipment, increments);
  const hasWarmup = ex.sets.some((s) => s.set_type === 'warmup');
  const anyDone = ex.sets.some((s) => s.done);

  const { rows, liveNote, plan } = planRows(ex, step);
  const timeBased = isTimeBased(ex.kind);
  const isCardio = ex.kind === 'cardio';

  /** Halter egzersizlerinde plaka hesaplayıcı: açılışta en ağır girilmiş set, yoksa önerilen ağırlık */
  const isBarbell = ex.equipment === 'Halter' && !timeBased;
  const openPlates = () => {
    const entered = ex.sets.filter((s) => s.set_type !== 'warmup' && s.weight != null).map((s) => s.weight as number);
    const initial = entered.length ? Math.max(...entered) : (sug.weight ?? 0);
    openPlateSheet(sheet, { initial, bar: plateCfg.bar, plates: plateCfg.plates, step });
  };

  const openRest = () =>
    sheet.custom({
      title: _('common.rest', { name: ex.name }),
      render: (close) => (
        <RestPicker
          current={rest}
          onPick={async (secs, always) => {
            await setWorkoutExerciseRest(db, ex.id, secs);
            if (always) await setExerciseDefaultRest(db, ex.exercise_id, secs);
            haptic.success();
            close();
            onChanged();
          }}
        />
      ),
    });

  const openMenu = () =>
    sheet.actions({
      title: ex.name,
      actions: [
        ...(timeBased
          ? isCardio
            ? []
            : [{ label: _('workout.rest', { v: formatRest(rest) }), icon: 'timer' as const, onPress: openRest }]
          : [
              {
                label: _('workout.add_warm_up_set'),
                icon: 'flame' as const,
                onPress: async () => {
                  await addSet(db, ex.id, 'warmup');
                  onChanged();
                },
              },
              { label: _('workout.rest', { v: formatRest(rest) }), icon: 'timer' as const, onPress: openRest },
            ]),
        ...(isBarbell ? [{ label: _('common.plate_calculator'), icon: 'barbell' as const, onPress: openPlates }] : []),
        { label: _('workout.see_history_and_charts'), icon: 'progress', onPress: () => router.push(`/exercise/${ex.exercise_id}`) },
        {
          label: _('workout.remove_exercise'),
          icon: 'trash',
          style: 'destructive',
          onPress: async () => {
            await removeWorkoutExercise(db, ex.id);
            onChanged();
          },
        },
      ],
    });

  return (
    <Card style={{ marginBottom: Spacing.md, paddingHorizontal: Spacing.md }}>
      <View style={styles.exHeader}>
        <MuscleIcon muscle={ex.muscle} size={40} />
        <PressableScale onPress={() => router.push(`/exercise/${ex.exercise_id}`)} style={{ flex: 1 }} scaleTo={0.98}>
          <T variant="heading" numberOfLines={1}>
            {ex.name}
          </T>
          <T variant="caption" secondary>
            {timeBased ? `${muscleLabel(ex.muscle)} · ${isCardio ? _('workout.time_distance') : _('workout.time')}` : _('workout.reps', { muscle: muscleLabel(ex.muscle), rep_min: ex.rep_min, rep_max: ex.rep_max })}
          </T>
        </PressableScale>
        {!isCardio && (
          <PressableScale onPress={openRest} accessibilityLabel={_('workout.change_rest_time')} style={[styles.restChip, { backgroundColor: t.primarySoft }]}>
            <Icon name="timer" size={12} color={t.primary} />
            <T variant="caption" color={t.primary} style={{ fontFamily: Font.bold }}>
              {formatRest(rest)}
            </T>
          </PressableScale>
        )}
        <IconButton icon="more" onPress={openMenu} bg="transparent" color={t.textSecondary} />
      </View>

      {timeBased ? (
        <View style={[styles.suggestion, { backgroundColor: t.surfaceRaised }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="target" size={13} color={t.primary} />
            <T variant="caption" color={t.primary} style={{ fontFamily: Font.bold, flex: 1 }}>
              {ex.cardioSuggestion?.reason}
            </T>
          </View>
        </View>
      ) : (
      <View style={[styles.suggestion, { backgroundColor: t.surfaceRaised }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name={KIND_ICON[sug.kind]} size={13} color={sugColor} />
          <T variant="label" color={sugColor} style={{ fontFamily: Font.heavy }}>
            {sug.weight != null ? _('workout.kg', { v: formatWeight(sug.weight), reps: sug.reps }) : _('workout.reps2', { count: sug.reps })}
          </T>
          {ex.style === 'ramp' && plan.length > 1 && sug.weight != null && (
            <T variant="caption" muted>{_('workout.heaviest_set')}</T>
          )}
          <View style={{ flex: 1 }} />
          <PressableScale
            onPress={() => sheet.custom({ title: _('workout.suggestion_rules'), render: () => <RulesSheet step={step} /> })}
            accessibilityRole="button"
            accessibilityLabel={_('workout.show_suggestion_rules')}
            hitSlop={10}
            style={[styles.helpBtn, { backgroundColor: t.surfacePressed }]}>
            <T variant="caption" color={t.textSecondary} style={{ fontFamily: Font.bold }}>
              ?
            </T>
          </PressableScale>
          <ConfidenceDots level={sug.confidence} />
        </View>
        <T variant="caption" secondary>
          {sug.reason}
        </T>
        {plan.length > 1 && plan.some((p) => p.weight != null) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Badge
              label={ex.style === 'ramp' ? _('workout.pyramid') : _('workout.straight')}
              tint={ex.style === 'ramp' ? t.accent : t.textSecondary}
              bg={ex.style === 'ramp' ? t.accentSoft : t.surfacePressed}
            />
            <T variant="caption" color={t.text} style={{ fontFamily: Font.bold }}>
              {plan.map((p) => `${p.weight != null ? formatWeight(p.weight) : '–'}×${p.reps}`).join('  →  ')}
            </T>
          </View>
        )}
        {(sug.e1rm != null || sug.plateau) && (
          <T variant="caption" muted>
            {sug.e1rm != null ? _('workout.estimated_1rm_kg', { v: formatWeight(Math.round(sug.e1rm * 2) / 2) }) : ''}
            {sug.plateau ? _('workout.plateau') : ''}
          </T>
        )}
        {liveNote && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Icon name="bolt" size={11} color={t.accent} />
            <T variant="caption" color={t.accent} style={{ fontFamily: Font.bold }}>
              {liveNote}
            </T>
          </View>
        )}
        {sug.warmups.length > 0 && !hasWarmup && !anyDone && (
          <PressableScale
            onPress={async () => {
              await addWarmupSets(db, ex.id, sug.warmups);
              haptic.success();
              onChanged();
            }}
            style={[styles.warmupBtn, { backgroundColor: t.goldSoft }]}>
            <Icon name="flame" size={12} color={t.gold} />
            <T variant="caption" color={t.gold} style={{ fontFamily: Font.bold }}>{_('workout.add_warm_up', { v: sug.warmups.map((w) => `${formatWeight(w.weight)}×${w.reps}`).join(' · ') })}
            </T>
          </PressableScale>
        )}
      </View>
      )}

      <View style={styles.headRow}>
        <T variant="overline" muted style={styles.colSet}>{_('common.sets')}</T>
        {!isCardio && (
          <T variant="overline" muted style={styles.colPrev}>{_('common.previous')}</T>
        )}
        {timeBased ? (
          <>
            <T variant="overline" muted style={styles.colInput}>
              {isCardio ? _('workout.time_min_sec') : _('common.duration')}
            </T>
            {isCardio && (
              <>
                <T variant="overline" muted style={styles.colInput}>{_('workout.distance_km')}</T>
                <T variant="overline" muted style={styles.colInput}>{_('workout.incline_lvl')}</T>
              </>
            )}
          </>
        ) : (
          <>
            {isBarbell ? (
              <PressableScale onPress={openPlates} accessibilityRole="button" accessibilityLabel={_('common.plate_calculator')} hitSlop={8} style={[styles.colInput, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 }]}>
                <T variant="overline" color={t.primary}>{_('common.kg')}</T>
                <Icon name="barbell" size={10} color={t.primary} />
              </PressableScale>
            ) : (
              <T variant="overline" muted style={styles.colInput}>
                {ex.kind === 'bodyweight' ? _('workout.kg2') : _('common.kg')}
              </T>
            )}
            <T variant="overline" muted style={styles.colInput}>{_('workout.reps3')}</T>
          </>
        )}
        <View style={styles.colCheck} />
      </View>

      {rows.map(({ s, isWarm, idx, prev, phWeight, phReps }) => (
        <SetRow
          key={s.id}
          label={isWarm ? 'I' : String(idx + 1)}
          set={s}
          kind={ex.kind}
          prevLabel={
            timeBased
              ? formatClock(ex.previousCardio[0]?.sets[idx]?.duration_sec ?? ex.previousCardio[0]?.sets.at(-1)?.duration_sec ?? null)
              : prev?.reps
                ? `${formatWeight(prev.weight)}×${prev.reps}`
                : '–'
          }
          cardioHint={ex.cardioSuggestion}
          placeholderWeight={phWeight}
          placeholderReps={phReps}
          db={db}
          sheet={sheet}
          profileRest={profileRest}
          onDone={(isPr) => onSetDone(s, isPr)}
          onChanged={onChanged}
        />
      ))}

      <PressableScale
        onPress={async () => {
          await addSet(db, ex.id);
          onChanged();
        }}
        accessibilityLabel={_('common.add_set')}
        style={[styles.addSet, { backgroundColor: t.surfaceRaised }]}>
        <Icon name="add" size={13} color={t.textSecondary} />
        <T variant="label" secondary>{_('common.add_set')}</T>
      </PressableScale>
    </Card>
  );
}

/** Elle eklenen ısınma seti için öneri: çalışma ağırlığının ~%50'si, her zaman ondan hafif. */
function warmupPlaceholder(working: number | null, equipment: string, step: number) {
  if (!working) return null;
  const s = step || 2.5;
  let w = Math.round((working * 0.5) / s) * s;
  if (equipment === 'Halter') {
    if (working <= 20) return null; // çalışma ağırlığı zaten boş bar
    w = Math.max(20, w); // boş bar
  }
  w = Math.min(w, working - s);
  return w > 0 ? w : null;
}

/**
 * Seans içi ayar: her tamamlanan çalışma setinden sonra kalan setlerin
 * yer tutucu (önerilen) ağırlığı güncellenir. Saf fonksiyon.
 */
const planCache = new WeakMap<WorkoutExerciseFull, { step: number; result: ReturnType<typeof computePlanRows> }>();

/** Aynı egzersiz verisi + adım için plan bir kez hesaplanır (ex her yüklemede yeni nesne olur → önbellek kendiliğinden tazelenir). */
function planRows(ex: WorkoutExerciseFull, step: number) {
  const hit = planCache.get(ex);
  if (hit && hit.step === step) return hit.result;
  const result = computePlanRows(ex, step);
  planCache.set(ex, { step, result });
  return result;
}

function computePlanRows(ex: WorkoutExerciseFull, step: number) {
  if (isTimeBased(ex.kind)) {
    // kardiyo/süreli: ağırlık planı yok
    let n = 0;
    const rows = ex.sets.map((s) => ({ s, isWarm: false, idx: n++, prev: undefined as undefined, phWeight: null as number | null, phReps: 0 }));
    return { rows, liveNote: null as string | null, plan: [] as SetPlan[] };
  }
  const sug = ex.suggestion;
  const prevSets = ex.previous;
  // Çalışma setleri (ısınma ve drop hariç) için set set plan: piramitte hafiften ağıra
  const workingCount = ex.sets.filter((x) => x.set_type === 'normal' || x.set_type === 'failure').length;
  const topWeight = sug.weight ?? prevSets[prevSets.length - 1]?.weight ?? null;
  const reps = ex.learnedReps.map((r) => (r == null ? null : Math.max(ex.rep_min, Math.min(ex.rep_max, r))));
  let plan: SetPlan[] = planSets({ weight: topWeight, reps: sug.reps }, workingCount, ex.style, sug.targetRir, step, reps);
  const initialPlan = plan;
  let liveNote: string | null = null;
  let k = 0; // çalışma seti sırası
  let normalIdx = 0;
  let lastDoneWeight: number | null = null;
  const rows = [];
  for (const s of ex.sets) {
    const isWarm = s.set_type === 'warmup';
    const isDrop = s.set_type === 'drop';
    const idx = isWarm ? -1 : normalIdx++;
    const prev = isWarm ? undefined : (prevSets[idx] ?? prevSets[prevSets.length - 1]);
    let phWeight: number | null;
    let phReps: number;
    if (isWarm) {
      phWeight = warmupPlaceholder(plan[0]?.weight ?? topWeight, ex.equipment, step);
      phReps = 10;
    } else if (isDrop) {
      // drop set: bir önceki setin ~%75'i, dinlenmeden
      phWeight = lastDoneWeight && step ? Math.max(step, Math.round((lastDoneWeight * 0.75) / step) * step) : null;
      phReps = plan[Math.max(0, k - 1)]?.reps ?? sug.reps;
    } else {
      phWeight = plan[k]?.weight ?? prev?.weight ?? null;
      phReps = plan[k]?.reps ?? sug.reps;
    }
    if (s.done && s.weight != null) lastDoneWeight = s.weight;
    if (!isWarm && !isDrop) {
      if (s.done) {
        const done = { weight: s.weight, reps: s.reps, rir: s.rir, failure: s.set_type === 'failure' };
        if (step === 0) {
          // vücut ağırlığı: kalan setlerin tekrarını ayarla
          const adj = adjustBodyweight(plan[k]?.reps ?? sug.reps, done);
          plan = plan.map((p, j) => (j > k ? { ...p, reps: adj.reps } : p));
          if (adj.note) liveNote = adj.note;
        } else {
          const r = replanAfter(plan, k, done, step);
          plan = r.plan;
          if (r.note) liveNote = r.note;
        }
      }
      k++;
    }
    rows.push({ s, isWarm, idx, prev, phWeight, phReps });
  }
  return { rows, liveNote, plan: initialPlan };
}

// ───────────────────────── Öneri kuralları ─────────────────────────

function RulesSheet({ step }: { step: number }) {
  const _ = useT();
  const t = useTheme();
  return (
    <View style={{ gap: Spacing.md }}>
      <T variant="caption" secondary>{_('workout.1_step_the_equipment_s', { v: step > 0 ? _('workout.for_this_exercise_kg', { v: formatWeight(step) }) : _('workout.1_rep_at_bodyweight') })}</T>
      {RULE_TABLE.map((r) => (
        <View key={r.effort} style={[styles.ruleRow, { backgroundColor: t.surfaceRaised }]}>
          <T variant="label" style={{ fontFamily: Font.heavy }}>
            {EFFORT_NAME[r.effort]} <T variant="caption" muted>· {r.meaning}</T>
          </T>
          <T variant="caption" secondary>{_('workout.within_session', { inSession: r.inSession })}
          </T>
          <T variant="caption" secondary>{_('workout.next_workout', { nextWorkout: r.nextWorkout })}
          </T>
        </View>
      ))}
      <T variant="caption" muted>{_('workout.at_bodyweight_easy_2_good')}</T>
    </View>
  );
}

// ───────────────────────── Dinlenme seçici ─────────────────────────

function RestPicker({ current, onPick }: { current: number; onPick: (secs: number, always: boolean) => void }) {
  const _ = useT();
  const t = useTheme();
  const [value, setValue] = useState(current);
  return (
    <View style={{ gap: Spacing.lg }}>
      <T variant="numLarge" style={{ textAlign: 'center' }} color={t.primary}>
        {formatRest(value)}
      </T>
      <View style={styles.presetGrid}>
        {REST_PRESETS.map((p) => (
          <PressableScale
            key={p}
            onPress={() => setValue(p)}
            style={[styles.preset, { backgroundColor: value === p ? t.primary : t.surfacePressed }]}>
            <T variant="label" color={value === p ? t.onPrimary : t.text}>
              {formatRest(p)}
            </T>
          </PressableScale>
        ))}
      </View>
      <View style={{ gap: Spacing.sm }}>
        <Button title={_('workout.for_this_workout')} kind="secondary" onPress={() => onPick(value, false)} />
        <Button title={_('workout.always_for_this_exercise')} icon="check" onPress={() => onPick(value, true)} />
      </View>
    </View>
  );
}

// ───────────────────────── Set satırı ─────────────────────────

function SetNoteEditor({ initial, onSave }: { initial: string; onSave: (text: string) => void | Promise<void> }) {
  const _ = useT();
  const t = useTheme();
  const [text, setText] = useState(initial);
  return (
    <View style={{ gap: Spacing.md }}>
      <TextInput
        value={text}
        onChangeText={setText}
        maxLength={140}
        autoFocus
        placeholder={_('workout.e_g_shoulder_twinged_slightly')}
        placeholderTextColor={t.textMuted}
        accessibilityLabel={_('workout.set_note')}
        style={[styles.input, { height: 48, paddingHorizontal: Spacing.md, fontFamily: Font.medium, fontSize: 15, textAlign: 'left', backgroundColor: t.surfaceRaised, color: t.text }]}
      />
      <Button title={_('common.save')} icon="check" onPress={() => onSave(text)} />
    </View>
  );
}

function SetRow({
  label,
  set,
  kind,
  cardioHint,
  prevLabel,
  placeholderWeight,
  placeholderReps,
  db,
  sheet,
  profileRest,
  onDone,
  onChanged,
}: {
  label: string;
  set: SetRowData;
  kind: WorkoutExerciseFull['kind'];
  cardioHint: WorkoutExerciseFull['cardioSuggestion'];
  prevLabel: string;
  placeholderWeight: number | null;
  placeholderReps: number;
  db: Db;
  sheet: Sheet;
  profileRest: number;
  onDone: (isPr: boolean) => void;
  onChanged: () => void;
}) {
  const _ = useT();
  const t = useTheme();
  const [w, setW] = useState(set.weight != null ? formatWeight(set.weight) : '');
  const [r, setR] = useState(set.reps != null ? String(set.reps) : '');
  const [dur, setDur] = useState(set.duration_sec ? formatClock(set.duration_sec) : '');
  const [dist, setDist] = useState(set.distance_m ? formatKm(set.distance_m) : '');
  const [lvl, setLvl] = useState(set.level != null ? formatWeight(set.level) : '');
  const timeBased = isTimeBased(kind);
  const isCardio = kind === 'cardio';
  const parseDur = (text: string) => (isCardio ? parseClock(text) : parseHold(text));
  const done = !!set.done;
  const type = set.set_type;
  const typeColor = type === 'warmup' ? t.gold : type === 'drop' ? t.violet : type === 'failure' ? t.danger : t.textSecondary;
  const typeBg = type === 'warmup' ? t.goldSoft : type === 'drop' ? t.violetSoft : type === 'failure' ? t.dangerSoft : t.surfaceRaised;
  const short = SET_TYPES.find((x) => x.key === type)?.short;

  const save = async () => {
    if (timeBased) {
      await updateCardioValues(db, set.id, { duration_sec: parseDur(dur), distance_m: isCardio ? parseKm(dist) : null, level: isCardio ? parseNumber(lvl) : null });
      return;
    }
    await updateSetValues(db, set.id, { weight: parseNumber(w), reps: parseNumber(r) });
  };

  const toggle = async () => {
    if (done) {
      await toggleSetDone(db, set.id, false);
      haptic.tap();
      onChanged();
      return;
    }
    if (timeBased) {
      const duration = parseDur(dur) ?? cardioHint?.duration_sec ?? null;
      if (!duration) {
        haptic.warning();
        return;
      }
      const distance = isCardio ? (parseKm(dist) ?? null) : null;
      setDur(formatClock(duration));
      await updateCardioValues(db, set.id, { duration_sec: duration, distance_m: distance, level: isCardio ? parseNumber(lvl) : null });
      const isPr = await toggleSetDone(db, set.id, true, profileRest);
      onDone(isPr);
      onChanged();
      return;
    }
    const weight = parseNumber(w) ?? placeholderWeight;
    const reps = parseNumber(r) ?? placeholderReps;
    if (!reps) {
      haptic.warning();
      return;
    }
    setW(weight != null ? formatWeight(weight) : '');
    setR(String(reps));
    await updateSetValues(db, set.id, { weight, reps });
    const isPr = await toggleSetDone(db, set.id, true, profileRest);
    onDone(isPr);
    onChanged();
  };

  const openType = () =>
    sheet.actions({
      title: _('common.set_type'),
      actions: SET_TYPES.map((st) => ({
        label: `${st.label}${st.key === type ? '  ✓' : ''}`,
        style: st.key === type ? ('primary' as const) : ('default' as const),
        onPress: async () => {
          await setSetType(db, set.id, st.key as SetType);
          onChanged();
        },
      })).concat([
        {
          label: set.note ? _('workout.edit_note') : _('workout.add_note'),
          style: 'default' as const,
          onPress: async () => openNote(),
        },
      ]),
    });

  const openNote = () =>
    sheet.custom({
      title: _('workout.set_note'),
      render: (close) => (
        <SetNoteEditor
          initial={set.note ?? ''}
          onSave={async (text) => {
            await setSetNote(db, set.id, text);
            await close();
            onChanged();
          }}
        />
      ),
    });

  const effortFg = set.rir == null ? t.textMuted : set.rir >= 3 ? t.success : set.rir === 2 ? t.primary : set.rir === 1 ? t.gold : t.danger;
  const effortBg = set.rir == null ? 'transparent' : set.rir >= 3 ? t.successSoft : set.rir === 2 ? t.primarySoft : set.rir === 1 ? t.goldSoft : t.dangerSoft;

  const openEffort = () =>
    sheet.actions({
      title: _('common.how_did_this_set_go'),
      message: _('workout.makes_suggestions_more_accurate'),
      actions: [
        ...EFFORT.map((e) => ({
          label: `${e.label} · ${e.hint}`,
          style: set.rir === e.key ? ('primary' as const) : ('default' as const),
          onPress: async () => {
            await setSetRir(db, set.id, e.key);
            onChanged();
          },
        })),
        ...(set.rir != null
          ? [
              {
                label: _('common.clear'),
                onPress: async () => {
                  await setSetRir(db, set.id, null);
                  onChanged();
                },
              },
            ]
          : []),
      ],
    });

  const remove = async () => {
    haptic.medium();
    await deleteSet(db, set.id);
    onChanged();
  };

  return (
    <ReanimatedSwipeable
      childrenContainerStyle={{ backgroundColor: t.surface }}
      friction={2}
      rightThreshold={60}
      overshootRight={false}
      renderRightActions={() => (
        <PressableScale onPress={remove} accessibilityLabel={_('common.delete_set')} style={[styles.swipeDelete, { backgroundColor: t.danger }]}>
          <Icon name="trash" size={18} color="#fff" />
        </PressableScale>
      )}>
      <Animated.View layout={LinearTransition.springify().damping(20)} style={[styles.setRow, { backgroundColor: t.surface }]}>
        {done && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: t.successSoft, borderRadius: Radius.sm }]} />}
        <PressableScale onPress={openType} accessibilityLabel={_('workout.change_set_type_set', { v: short || label })} style={styles.colSet} scaleTo={0.85}>
          <View style={[styles.setBadge, { backgroundColor: done && type === 'normal' ? t.success : typeBg }]}>
            {set.is_pr ? (
              <T style={{ fontSize: 13 }}>🏆</T>
            ) : (
              <T variant="label" color={done && type === 'normal' ? t.onPrimary : typeColor} style={{ fontFamily: Font.heavy }}>
                {short || label}
              </T>
            )}
          </View>
        </PressableScale>
        {isCardio ? null : timeBased ? (
          <T variant="label" muted style={styles.colPrev} numberOfLines={1}>
            {prevLabel}
          </T>
        ) : done && type !== 'warmup' ? (
          <PressableScale onPress={openEffort} accessibilityLabel={set.rir != null ? _('workout.difficulty_change', { v: effortLabel(set.rir) }) : _('workout.pick_difficulty')} style={styles.colPrev} scaleTo={0.9} hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}>
            <View style={[styles.effort, { backgroundColor: set.rir != null ? effortBg : 'transparent', borderColor: set.rir != null ? 'transparent' : t.borderStrong }]}>
              <T variant="caption" color={set.rir != null ? effortFg : t.textMuted} style={{ fontFamily: Font.bold, fontSize: 11 }}>
                {effortLabel(set.rir) ?? _('common.difficulty')}
              </T>
            </View>
          </PressableScale>
        ) : (
          <T variant="label" muted style={styles.colPrev} numberOfLines={1}>
            {prevLabel}
          </T>
        )}
        {timeBased ? (
          <>
            <TextInput
              value={dur}
              onChangeText={setDur}
              onEndEditing={save}
              placeholder={cardioHint?.duration_sec ? formatClock(cardioHint.duration_sec) : isCardio ? '20:00' : '0:45'}
              placeholderTextColor={t.textMuted}
              keyboardType="numbers-and-punctuation"
              selectTextOnFocus
              editable={!done}
              accessibilityLabel={_('common.duration')}
              style={[styles.input, styles.colInput, { backgroundColor: done ? 'transparent' : t.surfaceRaised, color: t.text }]}
            />
            {isCardio && (
              <>
                <TextInput
                  value={dist}
                  onChangeText={setDist}
                  onEndEditing={save}
                  placeholder={cardioHint?.distance_m ? formatKm(cardioHint.distance_m) : '–'}
                  placeholderTextColor={t.textMuted}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  editable={!done}
                  accessibilityLabel={_('workout.distance_km2')}
                  style={[styles.input, styles.colInput, { backgroundColor: done ? 'transparent' : t.surfaceRaised, color: t.text }]}
                />
                <TextInput
                  value={lvl}
                  onChangeText={setLvl}
                  onEndEditing={save}
                  placeholder="–"
                  placeholderTextColor={t.textMuted}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  editable={!done}
                  accessibilityLabel={_('workout.incline_or_level')}
                  style={[styles.input, styles.colInput, { backgroundColor: done ? 'transparent' : t.surfaceRaised, color: t.text }]}
                />
              </>
            )}
          </>
        ) : (
          <>
        <TextInput
          value={w}
          onChangeText={setW}
          onEndEditing={save}
          placeholder={placeholderWeight != null ? formatWeight(placeholderWeight) : '–'}
          placeholderTextColor={t.textMuted}
          keyboardType="decimal-pad"
          selectTextOnFocus
          editable={!done}
          style={[styles.input, styles.colInput, { backgroundColor: done ? 'transparent' : t.surfaceRaised, color: t.text }]}
        />
        <TextInput
          value={r}
          onChangeText={setR}
          onEndEditing={save}
          placeholder={String(placeholderReps)}
          placeholderTextColor={t.textMuted}
          keyboardType="number-pad"
          selectTextOnFocus
          editable={!done}
          style={[styles.input, styles.colInput, { backgroundColor: done ? 'transparent' : t.surfaceRaised, color: t.text }]}
        />
          </>
        )}
        <PressableScale onPress={toggle} accessibilityLabel={done ? _('workout.undo_set') : _('workout.complete_set')} accessibilityState={{ checked: done }} style={styles.colCheck} hapticOnPress={false} scaleTo={0.82}>
          <View style={[styles.check, { backgroundColor: done ? t.success : t.surfaceRaised, borderColor: done ? t.success : t.borderStrong }]}>
            <Icon name="check" size={17} color={done ? t.onPrimary : t.textMuted} weight="bold" />
          </View>
        </PressableScale>
      </Animated.View>
      {!!set.note && (
        <View style={[styles.restNote, { backgroundColor: t.surface }]}>
          <Icon name="edit" size={10} color={t.textMuted} />
          <T variant="caption" muted style={{ fontSize: 11 }} numberOfLines={1}>
            {set.note}
          </T>
        </View>
      )}
      {done && set.rest_taken != null && set.rest_target != null && (
        <View style={[styles.restNote, { backgroundColor: t.surface }]}>
          <Icon name="timer" size={10} color={set.rest_taken > set.rest_target + 30 ? t.gold : t.textMuted} />
          <T variant="caption" color={set.rest_taken > set.rest_target + 30 ? t.gold : t.textMuted} style={{ fontSize: 10 }}>{_('workout.you_rested_before_this_set', { v: formatDuration(set.rest_taken * 1000), v2: formatRest(set.rest_target) })}
          </T>
        </View>
      )}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  finishBtn: { paddingHorizontal: 20, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  exHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  restChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 28, borderRadius: 14 },
  helpBtn: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ruleRow: { borderRadius: Radius.md, padding: Spacing.md, gap: 2 },
  suggestion: {
    gap: 4,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radius.sm,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md, marginBottom: 2, paddingHorizontal: 4, gap: 6 },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 4, borderRadius: Radius.sm, gap: 6 },
  colSet: { width: 34, alignItems: 'center' },
  colPrev: { flex: 1.1, textAlign: 'center' },
  colInput: { flex: 1, textAlign: 'center' },
  colCheck: { width: 42, alignItems: 'center' },
  setBadge: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  input: { height: 40, borderRadius: Radius.sm, fontSize: 17, fontFamily: Font.heavy, paddingHorizontal: 4 },
  check: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  swipeDelete: { width: 64, marginLeft: 6, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  restNote: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 44, paddingBottom: 2 },
  addSet: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 38,
    borderRadius: Radius.sm,
    marginTop: Spacing.sm,
  },
  warmupBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.pill, marginTop: 6 },
  effortPanel: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  effortBtn: { flex: 1, height: 46, borderRadius: Radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  effortClose: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  effort: { alignSelf: 'center', paddingHorizontal: 8, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  preset: { width: '18%', minWidth: 58, height: 44, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
  },
});
