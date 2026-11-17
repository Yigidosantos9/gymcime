import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { MuscleIcon } from '@/components/body-map';
import { Icon } from '@/components/icon';
import { useSheet, type SheetAction } from '@/components/sheet';
import { Badge, Button, Card, PressableScale, Stat, T } from '@/components/ui';
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
import { formatDayLong, formatDuration, formatMinutes, formatVolume, formatWeight, parseNumber } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { leave } from '@/lib/nav';
import { EFFORT, effortLabel, estimate1RM } from '@/lib/progression';
import { SET_TYPES } from '@/lib/rest';

export default function Session() {
  const t = useTheme();
  const sheet = useSheet();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, db, reload } = useDbQuery((db) => getWorkoutDetail(db, Number(id)), [id]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');

  // Geri tuşu / ekrandan çıkış: düzenleme açıksa boş setleri temizle ve başlık/notu kaydet (taslak kaybolmasın)
  const latest = useRef({ editing: false, name: '', note: '', id: 0 });
  useEffect(() => {
    latest.current = { editing, name, note, id: data?.workout.id ?? 0 };
  });
  useEffect(
    () => () => {
      const d = latest.current;
      if (d.editing && d.id) finalizeHistoryEdit(db, d.id, { name: d.name, note: d.note || null }).catch(() => {});
    },
    [db],
  );

  if (!data) return null;
  const { workout, exercises } = data;
  // ısınma setleri set sayısına ve hacme dahil değil (kas dağılımı ve özet ekranıyla tutarlı)
  const sets = exercises.flatMap((e) => e.sets).filter((s) => s.set_type !== 'warmup');
  const volume = sets.reduce((acc, s) => acc + (s.weight ?? 0) * (s.reps ?? 0), 0);
  const rests = sets.filter((s) => s.rest_taken != null);
  const avgRest = rests.length ? Math.round(rests.reduce((a, s) => a + (s.rest_taken ?? 0), 0) / rests.length) : null;

  const saveMeta = async () => {
    await updateWorkoutMeta(db, workout.id, { name, note: note || null });
    await reload();
  };

  /** Düzenlemeyi bitirir: başlık/not kaydı + boş set temizliği + PR yeniden hesabı. */
  const finishEditing = async () => {
    await finalizeHistoryEdit(db, workout.id, { name, note: note || null });
    await reload();
  };

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

  const onRemoveExercise = (weId: number, exName: string) =>
    sheet.actions({
      title: `${exName} çıkarılsın mı?`,
      message: 'Egzersizin bu antrenmandaki tüm setleri silinir. Rekorlar yeniden hesaplanır.',
      actions: [
        {
          label: 'Egzersizi çıkar',
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
              {new Date(workout.started_at).toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short' })}
            </T>
          </View>
          <Button
            title={editing ? 'Bitti' : 'Düzenle'}
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
          <TextInput
            value={name}
            onChangeText={setName}
            onEndEditing={saveMeta}
            placeholder="Antrenman adı"
            placeholderTextColor={t.textMuted}
            accessibilityLabel="Antrenman adı"
            style={[styles.titleInput, { backgroundColor: t.surfaceRaised, color: t.text }]}
          />
        ) : (
          <T variant="display">{workout.name}</T>
        )}

        <Card style={{ marginTop: Spacing.lg }}>
          <View style={{ flexDirection: 'row' }}>
            <Stat label="Süre" value={formatMinutes((workout.finished_at ?? workout.started_at) - workout.started_at)} />
            <Stat label="Set" value={String(sets.length)} />
            <Stat label="Hacim" value={formatVolume(volume)} />
            {avgRest != null && <Stat label="Ort. mola" value={formatDuration(avgRest * 1000)} />}
          </View>
          <T variant="caption" muted style={{ marginTop: 6 }}>
            Isınma setleri hariç
          </T>
        </Card>

        {editing ? (
          <TextInput
            value={note}
            onChangeText={setNote}
            onEndEditing={saveMeta}
            placeholder="Antrenman notu (isteğe bağlı)"
            placeholderTextColor={t.textMuted}
            accessibilityLabel="Antrenman notu"
            multiline
            style={[styles.noteInput, { backgroundColor: t.surfaceRaised, color: t.text }]}
          />
        ) : (
          !!workout.note && (
            <Card style={{ marginTop: Spacing.md }}>
              <T variant="label" secondary>
                Not
              </T>
              <T variant="body">{workout.note}</T>
            </Card>
          )
        )}

        {exercises.map((ex) => {
          const best = Math.max(0, ...ex.sets.filter((s) => s.set_type !== 'warmup').map((s) => estimate1RM(s.weight, s.reps)));
          let n = 0;
          return (
            <Card key={ex.id} style={{ marginTop: Spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                <PressableScale onPress={() => router.push(`/exercise/${ex.exercise_id}`)} scaleTo={0.98} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                  <MuscleIcon muscle={ex.muscle} size={40} />
                  <View style={{ flex: 1 }}>
                    <T variant="heading">{ex.name}</T>
                    <T variant="caption" secondary>
                      {ex.muscle}
                      {best > 0 ? ` · tahmini 1RM ${formatWeight(Math.round(best * 2) / 2)} kg` : ''}
                    </T>
                  </View>
                </PressableScale>
                {editing && (
                  <PressableScale onPress={() => onRemoveExercise(ex.id, ex.name)} accessibilityLabel={`${ex.name} egzersizini çıkar`} hitSlop={8} style={[styles.miniBtn, { backgroundColor: t.dangerSoft }]}>
                    <Icon name="trash" size={16} color={t.danger} />
                  </PressableScale>
                )}
              </View>
              <View style={{ marginTop: Spacing.md, gap: 4 }}>
                {ex.sets.map((s) => {
                  const warm = s.set_type === 'warmup';
                  const label = warm ? 'I' : String(++n);
                  return editing ? (
                    <EditSetRow key={s.id} set={s} label={label} db={db} sheet={sheet} onChanged={reload} />
                  ) : (
                    <ViewSetRow key={s.id} set={s} label={label} />
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
                  accessibilityLabel={`${ex.name} için set ekle`}
                  style={[styles.addSet, { backgroundColor: t.surfaceRaised }]}>
                  <Icon name="add" size={13} color={t.textSecondary} />
                  <T variant="label" secondary>
                    Set ekle
                  </T>
                </PressableScale>
              )}
            </Card>
          );
        })}

        {editing && (
          <Button title="Egzersiz ekle" icon="addCircle" kind="secondary" onPress={() => router.push(`/exercise-picker?historyWorkoutId=${workout.id}`)} style={{ marginTop: Spacing.lg }} />
        )}
        <Button title="Antrenmanı sil" kind="danger" icon="trash" onPress={onDelete} style={{ marginTop: Spacing.xl }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ViewSetRow({ set: s, label }: { set: SetRow; label: string }) {
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
  db,
  sheet,
  onChanged,
}: {
  set: SetRow;
  label: string;
  db: Parameters<typeof editHistorySet>[0];
  sheet: ReturnType<typeof useSheet>;
  onChanged: () => Promise<unknown>;
}) {
  const t = useTheme();
  const [w, setW] = useState(s.weight != null ? formatWeight(s.weight) : '');
  const [r, setR] = useState(s.reps != null ? String(s.reps) : '');
  const [note, setNote] = useState(s.note ?? '');
  const warm = s.set_type === 'warmup';
  const typeInfo = SET_TYPES.find((x) => x.key === s.set_type);

  const saveValues = async () => {
    await editHistorySet(db, s.id, { weight: parseNumber(w), reps: parseNumber(r) });
    await onChanged();
  };

  const pickType = () =>
    sheet.actions({
      title: 'Set tipi',
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
      title: 'Bu set nasıl geçti?',
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
                label: 'Temizle',
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
      title: 'Set silinsin mi?',
      message: 'Rekorlar yeniden hesaplanır.',
      actions: [
        {
          label: 'Seti sil',
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
        <PressableScale onPress={pickType} accessibilityLabel={`Set ${label} tipini değiştir`} style={[styles.typeBtn, { backgroundColor: t.surface }]}>
          <T variant="label" color={warm ? t.gold : t.textSecondary} style={{ fontFamily: Font.heavy }}>
            {s.is_pr ? '🏆' : typeInfo?.short || label}
          </T>
        </PressableScale>
        <TextInput
          value={w}
          onChangeText={setW}
          onEndEditing={saveValues}
          placeholder="kg"
          placeholderTextColor={t.textMuted}
          keyboardType="decimal-pad"
          selectTextOnFocus
          accessibilityLabel={`Set ${label} ağırlık`}
          style={[styles.input, { backgroundColor: t.surface, color: t.text }]}
        />
        <T variant="label" muted>
          ×
        </T>
        <TextInput
          value={r}
          onChangeText={setR}
          onEndEditing={saveValues}
          placeholder="tekrar"
          placeholderTextColor={t.textMuted}
          keyboardType="number-pad"
          selectTextOnFocus
          accessibilityLabel={`Set ${label} tekrar`}
          style={[styles.input, { backgroundColor: t.surface, color: t.text }]}
        />
        {!warm && (
          <PressableScale onPress={pickEffort} accessibilityLabel="Zorluğu değiştir" style={[styles.effortBtn, { backgroundColor: t.surface }]}>
            <T variant="caption" color={s.rir != null ? t.text : t.textMuted} style={{ fontFamily: Font.bold, fontSize: 11 }}>
              {effortLabel(s.rir) ?? 'Zorluk?'}
            </T>
          </PressableScale>
        )}
        <PressableScale onPress={remove} accessibilityLabel={`Set ${label} sil`} hitSlop={8} style={styles.miniBtn}>
          <Icon name="trash" size={16} color={t.danger} />
        </PressableScale>
      </View>
      <TextInput
        value={note}
        onChangeText={setNote}
        onEndEditing={async () => {
          await editHistorySet(db, s.id, { note });
          await onChanged();
        }}
        maxLength={140}
        placeholder="Set notu (isteğe bağlı)"
        placeholderTextColor={t.textMuted}
        accessibilityLabel={`Set ${label} notu`}
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
