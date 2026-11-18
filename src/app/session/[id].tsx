import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { MuscleIcon } from '@/components/body-map';
import { Icon } from '@/components/icon';
import { useSheet, type SheetAction } from '@/components/sheet';
import { Badge, Button, Card, Input, PressableScale, Stat, T } from '@/components/ui';
import { Font, Radius, Spacing } from '@/constants/theme';
import {
  addHistorySet,
  deleteHistorySet,
  deleteWorkout,
  editHistorySet,
  finalizeHistoryEdit,
  getWorkoutDetail,
  removeHistoryExercise,
  updateWorkoutMeta,
  type SetRow,
} from '@/db/queries';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { formatDayLong, formatDuration, formatMinutes, formatWeight, parseNumber } from '@/lib/format';
import { describeCardioSet, formatClock, formatKm, formatMin, isTimeBased, parseClock, parseHold, parseKm } from '@/lib/cardio';
import { haptic } from '@/lib/haptics';
import { leave } from '@/lib/nav';
import { EFFORT, effortLabel, estimate1RM } from '@/lib/progression';
import { currentLocale } from '@/i18n';
import { syncReminders } from '@/lib/reminder-io';
import { SET_TYPES } from '@/lib/rest';
import { useT } from '@/components/language-provider';
import { muscleLabel, routineLabel } from '@/i18n/labels';

export default function Session() {
  const _ = useT();
  const t = useTheme();
  const sheet = useSheet();
  const { id, edit, fresh } = useLocalSearchParams<{ id: string; edit?: string; fresh?: string }>();
  const { data, db, reload } = useDbQuery((db) => getWorkoutDetail(db, Number(id)), [id]);
  const [editing, setEditing] = useState(edit === '1');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const isFresh = fresh === '1'; // "Geçmişe antrenman ekle" ile yeni oluşturuldu: hiç set girilmezse antrenman atılır
  const seeded = useRef(false);

  // Geri tuşu / ekrandan çıkış: düzenleme açıksa boş setleri temizle ve başlık/notu kaydet (taslak kaybolmasın)
  const latest = useRef({ editing: false, name: '', note: '', id: 0, fresh: false });
  useEffect(() => {
    latest.current = { editing, name, note, id: data?.workout.id ?? 0, fresh: isFresh };
  });
  useEffect(
    () => () => {
      const d = latest.current;
      if (d.editing && d.id) {
        finalizeHistoryEdit(db, d.id, { name: d.name, note: d.note || null }, { dropIfEmpty: d.fresh })
          .then(() => syncReminders(db))
          .catch(() => {});
      }
    },
    [db],
  );
  // düzenleme modu doğrudan açıldıysa (yeni geçmiş antrenman) taslakları kayıtlı değerlerden doldur
  useEffect(() => {
    if (editing && data && !seeded.current) {
      seeded.current = true;
      setName(data.workout.name);
      setNote(data.workout.note ?? '');
    }
  }, [editing, data]);

  if (!data) return null;
  const { workout, exercises } = data;
  // ısınma setleri set sayısına dahil değil (kas dağılımı ve özet ekranıyla tutarlı)
  // kardiyo/süreli setler set sayısına girmez; ayrı "Kardiyo" süresi olarak gösterilir
  const sets = exercises.filter((e) => !isTimeBased(e.kind)).flatMap((e) => e.sets).filter((s) => s.set_type !== 'warmup');
  const cardioSec = exercises.filter((e) => e.kind === 'cardio').flatMap((e) => e.sets).reduce((a, s) => a + (s.done ? (s.duration_sec ?? 0) : 0), 0);
  const rests = sets.filter((s) => s.rest_taken != null);
  const avgRest = rests.length ? Math.round(rests.reduce((a, s) => a + (s.rest_taken ?? 0), 0) / rests.length) : null;

  const saveMeta = async () => {
    await updateWorkoutMeta(db, workout.id, { name, note: note || null });
    await reload();
  };

  /** Düzenlemeyi bitirir: başlık/not kaydı + boş set temizliği + PR yeniden hesabı. */
  const finishEditing = async () => {
    const r = await finalizeHistoryEdit(db, workout.id, { name, note: note || null }, { dropIfEmpty: isFresh });
    syncReminders(db);
    if (r.deleted) {
      latest.current.editing = false;
      leave();
      return;
    }
    await reload();
  };

  const onDelete = () =>
    sheet.actions({
      title: _('session.delete_workout'),
      message: _('session.this_can_t_be_undone'),
      actions: [
        {
          label: _('common.delete'),
          icon: 'trash',
          style: 'destructive',
          onPress: async () => {
            await deleteWorkout(db, workout.id);
            leave();
          },
        },
      ],
    });

  const onRemoveExercise = (weId: number, exName: string) =>
    sheet.actions({
      title: _('session.remove', { exName: exName }),
      message: _('session.all_of_this_exercise_s'),
      actions: [
        {
          label: _('session.remove_exercise'),
          icon: 'trash',
          style: 'destructive',
          onPress: async () => {
            await removeHistoryExercise(db, weId);
            await reload();
          },
        },
      ],
    });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
        <Stack.Screen options={{ title: formatDayLong(workout.started_at) }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
          <View style={{ flex: 1 }}>
            <T variant="overline" secondary>
              {new Date(workout.started_at).toLocaleString(currentLocale(), { dateStyle: 'long', timeStyle: 'short' })}
            </T>
          </View>
          <Button
            title={editing ? _('session.done') : _('common.edit')}
            icon={editing ? 'check' : 'edit'}
            kind={editing ? 'primary' : 'secondary'}
            small
            onPress={async () => {
              if (editing) await finishEditing();
              else {
                // düzenleme başlarken taslaklar kayıtlı değerlerden doldurulur
                setName(workout.name);
                setNote(workout.note ?? '');
              }
              setEditing(!editing);
            }}
          />
        </View>
        {editing ? (
          <Input
            value={name}
            onChangeText={setName}
            onEndEditing={saveMeta}
            placeholder={_('session.workout_name')}
            placeholderTextColor={t.textMuted}
            accessibilityLabel={_('session.workout_name')}
            style={[styles.titleInput, { backgroundColor: t.surfaceRaised, color: t.text }]}
          />
        ) : (
          <T variant="display">{routineLabel(workout.name)}</T>
        )}

        <Card style={{ marginTop: Spacing.lg }}>
          <View style={{ flexDirection: 'row' }}>
            <Stat label={_('common.duration')} value={formatMinutes((workout.finished_at ?? workout.started_at) - workout.started_at)} />
            <Stat label={_('common.sets')} value={String(sets.length)} />
            <Stat label={_('session.exercises')} value={String(exercises.length)} />
            {cardioSec > 0 && <Stat label={_('common.cardio2')} value={formatMin(cardioSec / 60)} />}
            {avgRest != null && <Stat label={_('session.avg_rest')} value={formatDuration(avgRest * 1000)} />}
          </View>
          <T variant="caption" muted style={{ marginTop: 6 }}>{_('session.warm_up_sets_excluded')}</T>
        </Card>

        {editing ? (
          <Input
            value={note}
            onChangeText={setNote}
            onEndEditing={saveMeta}
            placeholder={_('session.workout_note_optional')}
            placeholderTextColor={t.textMuted}
            accessibilityLabel={_('session.workout_note')}
            multiline
            style={[styles.noteInput, { backgroundColor: t.surfaceRaised, color: t.text }]}
          />
        ) : (
          !!workout.note && (
            <Card style={{ marginTop: Spacing.md }}>
              <T variant="label" secondary>{_('session.note')}</T>
              <T variant="body">{workout.note}</T>
            </Card>
          )
        )}

        {exercises.map((ex) => {
          const best = isTimeBased(ex.kind) ? 0 : Math.max(0, ...ex.sets.filter((s) => s.set_type !== 'warmup').map((s) => estimate1RM(s.weight, s.reps)));
          let n = 0;
          return (
            <Card key={ex.id} style={{ marginTop: Spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                <PressableScale onPress={() => router.push(`/exercise/${ex.exercise_id}`)} scaleTo={0.98} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                  <MuscleIcon muscle={ex.muscle} size={40} />
                  <View style={{ flex: 1 }}>
                    <T variant="heading">{ex.name}</T>
                    <T variant="caption" secondary>
                      {muscleLabel(ex.muscle)}
                      {best > 0 ? _('session.estimated_1rm_kg', { v: formatWeight(Math.round(best * 2) / 2) }) : ''}
                    </T>
                  </View>
                </PressableScale>
                {editing && (
                  <PressableScale onPress={() => onRemoveExercise(ex.id, ex.name)} accessibilityLabel={_('session.remove2', { name: ex.name })} hitSlop={8} style={[styles.miniBtn, { backgroundColor: t.dangerSoft }]}>
                    <Icon name="trash" size={16} color={t.danger} />
                  </PressableScale>
                )}
              </View>
              <View style={{ marginTop: Spacing.md, gap: 4 }}>
                {ex.sets.map((s) => {
                  const warm = s.set_type === 'warmup';
                  const label = warm ? 'I' : String(++n);
                  return editing ? (
                    <EditSetRow key={s.id} set={s} label={label} kind={ex.kind} db={db} sheet={sheet} onChanged={reload} />
                  ) : (
                    <ViewSetRow key={s.id} set={s} label={label} kind={ex.kind} />
                  );
                })}
              </View>
              {editing && (
                <PressableScale
                  onPress={async () => {
                    await addHistorySet(db, ex.id);
                    haptic.tap();
                    await reload();
                  }}
                  accessibilityLabel={_('session.add_a_set_for', { name: ex.name })}
                  style={[styles.addSet, { backgroundColor: t.surfaceRaised }]}>
                  <Icon name="add" size={13} color={t.textSecondary} />
                  <T variant="label" secondary>{_('common.add_set')}</T>
                </PressableScale>
              )}
            </Card>
          );
        })}

        {editing && (
          <Button title={_('common.add_exercise')} icon="addCircle" kind="secondary" onPress={() => router.push(`/exercise-picker?historyWorkoutId=${workout.id}`)} style={{ marginTop: Spacing.lg }} />
        )}
        <Button title={_('session.delete_workout2')} kind="danger" icon="trash" onPress={onDelete} style={{ marginTop: Spacing.xl }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ViewSetRow({ set: s, label, kind }: { set: SetRow; label: string; kind: string }) {
  const _ = useT();
  const t = useTheme();
  const warm = s.set_type === 'warmup';
  const typeInfo = SET_TYPES.find((x) => x.key === s.set_type);
  return (
    <View>
      <View style={[styles.setRow, { backgroundColor: t.surfaceRaised }]}>
        <T variant="label" color={warm ? t.gold : t.textSecondary} style={{ width: 24, fontFamily: Font.heavy }}>
          {label}
        </T>
        <T variant="body" style={{ flex: 1, fontFamily: Font.bold }}>
          {isTimeBased(kind)
            ? describeCardioSet(s, kind as 'cardio' | 'timed')
            : kind === 'bodyweight'
              ? _('session.reps', { v: s.weight ? `+${formatWeight(s.weight)} kg × ` : '', v2: s.reps ?? 0 })
              : `${s.weight ? `${formatWeight(s.weight)} kg` : _('common.bodyweight')} × ${s.reps ?? 0}`}
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
      {!!s.note && (
        <T variant="caption" muted style={{ paddingLeft: 36, paddingTop: 2 }}>
          {s.note}
        </T>
      )}
    </View>
  );
}

function EditSetRow({
  set: s,
  label,
  kind,
  db,
  sheet,
  onChanged,
}: {
  set: SetRow;
  label: string;
  kind: string;
  db: Parameters<typeof editHistorySet>[0];
  sheet: ReturnType<typeof useSheet>;
  onChanged: () => Promise<unknown>;
}) {
  const _ = useT();
  const t = useTheme();
  const [w, setW] = useState(s.weight != null ? formatWeight(s.weight) : '');
  const [r, setR] = useState(s.reps != null ? String(s.reps) : '');
  const [note, setNote] = useState(s.note ?? '');
  const isCardio = kind === 'cardio';
  const timeBased = isTimeBased(kind);
  const [dur, setDur] = useState(s.duration_sec ? formatClock(s.duration_sec) : '');
  const [dist, setDist] = useState(s.distance_m ? formatKm(s.distance_m) : '');
  const [lvl, setLvl] = useState(s.level != null ? formatWeight(s.level) : '');
  const warm = s.set_type === 'warmup';
  const typeInfo = SET_TYPES.find((x) => x.key === s.set_type);

  const saveValues = async () => {
    if (timeBased) {
      await editHistorySet(db, s.id, {
        duration_sec: isCardio ? parseClock(dur) : parseHold(dur),
        distance_m: isCardio ? parseKm(dist) : null,
        level: isCardio ? parseNumber(lvl) : null,
      });
    } else {
      await editHistorySet(db, s.id, { weight: parseNumber(w), reps: parseNumber(r) });
    }
    await onChanged();
  };

  const pickType = () =>
    sheet.actions({
      title: _('common.set_type'),
      actions: SET_TYPES.map<SheetAction>((x) => ({
        label: x.label,
        style: x.key === s.set_type ? 'primary' : 'default',
        onPress: async () => {
          await editHistorySet(db, s.id, { set_type: x.key });
          await onChanged();
        },
      })),
    });

  const pickEffort = () =>
    sheet.actions({
      title: _('common.how_did_this_set_go'),
      actions: [
        ...EFFORT.map<SheetAction>((e) => ({
          label: `${e.label} · ${e.hint}`,
          style: s.rir === e.key ? 'primary' : 'default',
          onPress: async () => {
            await editHistorySet(db, s.id, { rir: e.key });
            await onChanged();
          },
        })),
        ...(s.rir != null
          ? [
              {
                label: _('common.clear'),
                onPress: async () => {
                  await editHistorySet(db, s.id, { rir: null });
                  await onChanged();
                },
              } satisfies SheetAction,
            ]
          : []),
      ],
    });

  const remove = () =>
    sheet.actions({
      title: _('session.delete_set'),
      message: _('session.records_are_recalculated'),
      actions: [
        {
          label: _('common.delete_set'),
          icon: 'trash',
          style: 'destructive',
          onPress: async () => {
            await deleteHistorySet(db, s.id);
            await onChanged();
          },
        },
      ],
    });

  return (
    <View style={[styles.editRow, { backgroundColor: t.surfaceRaised }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <PressableScale onPress={pickType} accessibilityLabel={_('session.change_type_of_set', { label: label })} style={[styles.typeBtn, { backgroundColor: t.surface }]}>
          <T variant="label" color={warm ? t.gold : t.textSecondary} style={{ fontFamily: Font.heavy }}>
            {s.is_pr ? '🏆' : typeInfo?.short || label}
          </T>
        </PressableScale>
        {timeBased ? (
          <>
            <Input
              value={dur}
              onChangeText={setDur}
              onEndEditing={saveValues}
              placeholder={isCardio ? _('session.min_sec') : _('session.sec')}
              placeholderTextColor={t.textMuted}
              keyboardType="numbers-and-punctuation"
              selectTextOnFocus
              accessibilityLabel={_('session.set_duration', { label: label })}
              style={[styles.input, { backgroundColor: t.surface, color: t.text }]}
            />
            {isCardio && (
              <>
                <Input
                  value={dist}
                  onChangeText={setDist}
                  onEndEditing={saveValues}
                  placeholder="km"
                  placeholderTextColor={t.textMuted}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  accessibilityLabel={_('session.set_distance', { label: label })}
                  style={[styles.input, { backgroundColor: t.surface, color: t.text }]}
                />
                <Input
                  value={lvl}
                  onChangeText={setLvl}
                  onEndEditing={saveValues}
                  placeholder={_('session.incline')}
                  placeholderTextColor={t.textMuted}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  accessibilityLabel={_('session.set_incline_or_level', { label: label })}
                  style={[styles.input, { backgroundColor: t.surface, color: t.text }]}
                />
              </>
            )}
          </>
        ) : (
          <>
        <Input
          value={w}
          onChangeText={setW}
          onEndEditing={saveValues}
          placeholder={_('common.kg')}
          placeholderTextColor={t.textMuted}
          keyboardType="decimal-pad"
          selectTextOnFocus
          accessibilityLabel={_('session.set_weight', { label: label })}
          style={[styles.input, { backgroundColor: t.surface, color: t.text }]}
        />
        <T variant="label" muted>
          ×
        </T>
        <Input
          value={r}
          onChangeText={setR}
          onEndEditing={saveValues}
          placeholder="tekrar"
          placeholderTextColor={t.textMuted}
          keyboardType="number-pad"
          selectTextOnFocus
          accessibilityLabel={_('session.set_reps', { label: label })}
          style={[styles.input, { backgroundColor: t.surface, color: t.text }]}
        />
          </>
        )}
        {!warm && !timeBased && (
          <PressableScale onPress={pickEffort} accessibilityLabel={_('session.change_difficulty')} style={[styles.effortBtn, { backgroundColor: t.surface }]}>
            <T variant="caption" color={s.rir != null ? t.text : t.textMuted} style={{ fontFamily: Font.bold, fontSize: 11 }}>
              {effortLabel(s.rir) ?? _('common.difficulty')}
            </T>
          </PressableScale>
        )}
        <PressableScale onPress={remove} accessibilityLabel={_('session.delete_set2', { label: label })} hitSlop={8} style={styles.miniBtn}>
          <Icon name="trash" size={16} color={t.danger} />
        </PressableScale>
      </View>
      <Input
        value={note}
        onChangeText={setNote}
        onEndEditing={async () => {
          await editHistorySet(db, s.id, { note });
          await onChanged();
        }}
        maxLength={140}
        placeholder={_('session.set_note_optional')}
        placeholderTextColor={t.textMuted}
        accessibilityLabel={_('session.set_note', { label: label })}
        style={[styles.noteSmall, { backgroundColor: t.surface, color: t.text }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  setRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
  editRow: { padding: 8, borderRadius: 10, gap: 6 },
  typeBtn: { width: 32, height: 40, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, height: 40, borderRadius: Radius.sm, fontSize: 16, fontFamily: Font.heavy, textAlign: 'center', paddingHorizontal: 4 },
  effortBtn: { height: 40, paddingHorizontal: 8, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  miniBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  noteSmall: { height: 34, borderRadius: Radius.sm, fontSize: 13, fontFamily: Font.medium, paddingHorizontal: 10 },
  titleInput: { height: 52, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, fontSize: 22, fontFamily: Font.heavy, marginTop: 4 },
  noteInput: { minHeight: 70, borderRadius: Radius.md, padding: Spacing.md, fontSize: 15, fontFamily: Font.medium, marginTop: Spacing.md, textAlignVertical: 'top' },
  addSet: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: 38, borderRadius: Radius.sm, marginTop: Spacing.sm },
});
