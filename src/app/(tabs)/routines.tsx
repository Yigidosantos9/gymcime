import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MuscleIcon } from '@/components/body-map';
import { Icon } from '@/components/icon';
import { useSheet } from '@/components/sheet';
import { HomeBack } from '@/components/tab-back';
import { Badge, Button, Card, Chip, EmptyState, IconButton, PressableScale, ScreenHeader, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { deleteRoutine, duplicateRoutine, getSetting, getWeekPlan, listRoutines, reorderRoutines, setSetting, sortRoutines, type RoutineSort, type RoutineSummary } from '@/db/queries';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { formatDayLong } from '@/lib/format';
import { syncReminders } from '@/lib/reminder-io';
import { beginWorkout } from '@/lib/start-workout';
import { weekdayShort } from '@/lib/week-plan';
import { currentLocale } from '@/i18n';
import { useT } from '@/components/language-provider';
import { routineLabel } from '@/i18n/labels';

export default function Routines() {
  const _ = useT();
  const SORTS: { key: RoutineSort; label: string }[] = [
    { key: 'manual', label: _('routines.manual') },
    { key: 'recent', label: _('routines.last_done') },
    { key: 'name', label: _('routines.name') },
    { key: 'created', label: _('routines.new') },
  ];
  const t = useTheme();
  const sheet = useSheet();
  const { data, db, reload } = useDbQuery(async (db) => {
    const [routines, sort, plan] = await Promise.all([listRoutines(db), getSetting(db, 'routine_sort'), getWeekPlan(db)]);
    return { routines, sort: (SORTS.some((s) => s.key === sort) ? sort : 'manual') as RoutineSort, plan };
  });
  const [sortOverride, setSortOverride] = useState<RoutineSort | null>(null);
  const sort = sortOverride ?? data?.sort ?? 'manual';
  const routines = data ? sortRoutines(data.routines, sort) : undefined;
  const planned = data?.plan.filter((d) => d.routine_name) ?? [];

  const pickSort = (k: RoutineSort) => {
    setSortOverride(k);
    setSetting(db, 'routine_sort', k);
  };

  /** Elle sıralama: bir adım yukarı/aşağı. */
  const move = async (r: RoutineSummary, dir: -1 | 1) => {
    if (!routines) return;
    const ids = routines.map((x) => x.id);
    const i = ids.indexOf(r.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await reorderRoutines(db, ids);
    await reload();
  };

  const confirmDelete = (r: RoutineSummary) =>
    sheet.actions({
      title: _('routines.delete', { name: routineLabel(r.name) }),
      message: _('routines.your_past_workouts_are_kept'),
      actions: [
        {
          label: _('common.delete_routine'),
          icon: 'trash',
          style: 'destructive',
          onPress: async () => {
            await deleteRoutine(db, r.id);
            syncReminders(db);
            await reload();
          },
        },
      ],
    });

  const openMenu = (r: RoutineSummary) =>
    sheet.actions({
      title: routineLabel(r.name),
      actions: [
        { label: _('common.edit'), icon: 'edit', onPress: () => router.push(`/routine/${r.id}`) },
        {
          label: _('routines.duplicate'),
          icon: 'copy',
          onPress: async () => {
            await duplicateRoutine(db, r.id);
            await reload();
          },
        },
        { label: _('routines.start'), icon: 'play', style: 'primary', onPress: () => beginWorkout(db, r.id, sheet) },
        { label: _('common.delete'), icon: 'trash', style: 'destructive', onPress: () => confirmDelete(r) },
      ],
    });

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.background }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <HomeBack />
        <ScreenHeader subtitle={routines ? _('routines.routines', { count: routines.length }) : undefined} title={_('common.routines')} />

        <Button title={_('common.create_a_new_routine')} icon="add" onPress={() => router.push('/routine/new')} style={{ marginBottom: Spacing.sm }} />
        <Button title={_('common.exercise_library')} icon="search" kind="secondary" onPress={() => router.push('/exercises')} style={{ marginBottom: Spacing.sm }} />

        <PressableScale onPress={() => router.push('/week-plan')} scaleTo={0.98} accessibilityLabel={_('common.weekly_plan')}>
          <Card style={{ marginBottom: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
            <View style={[styles.planIcon, { backgroundColor: t.primarySoft }]}>
              <Icon name="history" size={18} color={t.primary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="heading">{_('common.weekly_plan')}</T>
              <T variant="caption" secondary numberOfLines={2}>
                {planned.length > 0 ? planned.map((d) => `${weekdayShort()[d.weekday]} ${routineLabel(d.routine_name ?? '')}`).join(' · ') : _('routines.assign_routines_to_days_monday')}
              </T>
            </View>
            <Icon name="chevronRight" size={14} color={t.textMuted} />
          </Card>
        </PressableScale>

        {routines && routines.length > 1 && (
          <View style={styles.sortRow}>
            <T variant="overline" secondary>{_('routines.reorder')}</T>
            {SORTS.map((s) => (
              <Chip key={s.key} label={s.label} active={sort === s.key} onPress={() => pickSort(s.key)} />
            ))}
          </View>
        )}

        {routines && routines.length === 0 && (
          <Card>
            <EmptyState icon="routines" title={_('routines.no_routines_yet')} text={_('routines.create_e_g_back_day')} />
          </Card>
        )}

        {routines?.map((r, i) => {
          const muscles = r.muscles?.split(',') ?? [];
          return (
            <Animated.View key={r.id} entering={FadeInDown.delay(i * 50).duration(350)}>
              <PressableScale onPress={() => router.push(`/routine/${r.id}`)} onLongPress={() => openMenu(r)} delayLongPress={350} scaleTo={0.98}>
                <Card style={{ marginBottom: Spacing.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <T variant="heading" style={{ fontSize: 18 }}>
                        {routineLabel(r.name)}
                      </T>
                      <T variant="caption" secondary>
                        {_('common.exercises', { count: r.exercise_count, v: r.last_done ? _('routines.last', { v: formatDayLong(r.last_done).toLocaleLowerCase(currentLocale()) }) : _('common.not_done_yet') })}
                      </T>
                    </View>
                    {sort === 'manual' && routines.length > 1 && (
                      <>
                        <IconButton icon="chevronUp" label={_('routines.move_routine_up')} onPress={() => move(r, -1)} bg="transparent" color={t.textSecondary} size={14} />
                        <IconButton icon="chevronDown" label={_('routines.move_routine_down')} onPress={() => move(r, 1)} bg="transparent" color={t.textSecondary} size={14} />
                      </>
                    )}
                  </View>
                  {muscles.length > 0 && (
                    <View style={styles.muscles}>
                      {muscles.slice(0, 4).map((m) => (
                        <View key={m} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <MuscleIcon muscle={m} size={26} />
                          <T variant="caption" secondary>
                            {m}
                          </T>
                        </View>
                      ))}
                      {muscles.length > 4 && <Badge label={`+${muscles.length - 4}`} tint={t.textSecondary} bg={t.surfaceRaised} />}
                    </View>
                  )}
                  <View style={styles.actions}>
                    <Button title={_('common.edit')} icon="edit" kind="secondary" small onPress={() => router.push(`/routine/${r.id}`)} style={{ flex: 1 }} />
                    <Button title={_('routines.start')} icon="play" small onPress={() => beginWorkout(db, r.id, sheet)} style={{ flex: 1 }} />
                    <IconButton icon="more" label={_('routines.routine_options')} onPress={() => openMenu(r)} />
                  </View>
                </Card>
              </PressableScale>
            </Animated.View>
          );
        })}

        <Button title={_('routines.start_empty_workout')} icon="bolt" kind="secondary" onPress={() => beginWorkout(db, null, sheet)} style={{ marginTop: Spacing.sm }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  planIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sortRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md },
  muscles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.md, alignItems: 'center' },
});
