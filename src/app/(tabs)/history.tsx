import { router } from 'expo-router';
import { useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { formatMin } from '@/lib/cardio';
import { HomeBack } from '@/components/tab-back';
import { useSheet } from '@/components/sheet';
import { Badge, Button, Card, EmptyState, IconButton, PressableScale, ScreenHeader, T } from '@/components/ui';
import { Font, Radius, Spacing } from '@/constants/theme';
import { getWeekPlan, listWorkouts, workoutsBetween, type WorkoutListItem } from '@/db/queries';
import { useDbQuery } from '@/hooks/use-db-query';
import { useScale, useTheme } from '@/hooks/use-theme';
import { formatMinutes, startOfDay } from '@/lib/format';
import { beginWorkout } from '@/lib/start-workout';
import { calendarColorIndex, dayStatus, monthNames, monthGrid, shiftMonth, shortRoutineName, weekdayNames, weekdayShort, weekdayOf } from '@/lib/week-plan';
import { useT } from '@/components/language-provider';
import { localeData } from '@/i18n';
import { routineLabel } from '@/i18n/labels';


export default function History() {
  const { f } = useScale();
  const _ = useT();
  const t = useTheme();
  const { data } = useDbQuery((db) => listWorkouts(db, 500));

  const sections: { title: string; count: number; sets: number; data: WorkoutListItem[] }[] = [];
  for (const w of data ?? []) {
    const d = new Date(w.started_at);
    const title = `${localeData().months[d.getMonth()]} ${d.getFullYear()}`;
    let s = sections[sections.length - 1];
    if (!s || s.title !== title) {
      s = { title, count: 0, sets: 0, data: [] };
      sections.push(s);
    }
    s.data.push(w);
    s.count++;
    s.sets += w.set_count;
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.background }}>
      <SectionList
        sections={sections}
        keyExtractor={(w) => String(w.id)}
        contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 120 }}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <HomeBack />
            <ScreenHeader title={_('common.history')} subtitle={data ? _('history.workouts', { count: data.length }) : undefined} />
            <Button title={_('common.add_a_past_workout')} icon="addCircle" kind="secondary" onPress={() => router.push('/add-past-workout')} style={{ marginBottom: Spacing.md }} />
            <MonthCalendar />
            <Heatmap starts={(data ?? []).map((w) => w.started_at)} />
          </>
        }
        ListEmptyComponent={
          data ? (
            <Card>
              <EmptyState icon="history" title={_('history.history_is_empty')} text={_('history.workouts_you_finish_will_pile')} />
            </Card>
          ) : undefined
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHead}>
            <T variant="overline" secondary>
              {section.title}
            </T>
            <T variant="caption" muted>
              {_('history.workouts_sets', { count: section.count, sets: section.sets })}</T>
          </View>
        )}
        renderItem={({ item, index }) => {
          const d = new Date(item.started_at);
          return (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 35).duration(300)}>
              <PressableScale onPress={() => router.push(`/session/${item.id}`)} scaleTo={0.98}>
                <Card style={{ marginBottom: Spacing.sm }}>
                  <View style={{ flexDirection: 'row', gap: Spacing.md }}>
                    <View style={[styles.date, { backgroundColor: t.surfaceRaised, width: f(46), height: f(52) }]}>
                      <T variant="caption" secondary style={{ fontSize: 10 }}>
                        {localeData().daysShort[d.getDay()]}
                      </T>
                      <T variant="heading" style={{ lineHeight: 20 }}>
                        {d.getDate()}
                      </T>
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <T variant="heading" numberOfLines={1} style={{ flexShrink: 1 }}>
                          {routineLabel(item.name)}
                        </T>
                        {item.pr_count > 0 && <Badge label={_('history.prs', { count: item.pr_count })} icon="trophy" tint={t.gold} bg={t.goldSoft} />}
                      </View>
                      <T variant="caption" secondary numberOfLines={1}>
                        {item.exercise_names}
                      </T>
                      <View style={styles.meta}>
                        <Meta icon="clock" text={formatMinutes((item.finished_at ?? item.started_at) - item.started_at)} />
                        <Meta icon="layers" text={_('history.sets', { count: item.set_count })} />
                        {item.cardio_sec > 0 && <Meta icon="timer" text={_('common.cardio', { v: formatMin(item.cardio_sec / 60) })} />}
                        <Meta icon="barbell" text={_('history.exercises', { v: item.exercise_names ? item.exercise_names.split(' · ').length : 0 })} />
                      </View>
                    </View>
                  </View>
                </Card>
              </PressableScale>
            </Animated.View>
          );
        }}
      />
    </SafeAreaView>
  );
}

/**
 * Aylık takvim: yapılan antrenmanlar (rutine göre renk + kısa ad), planlı ama yapılmamış günler (soluk, kesikli çerçeve),
 * kaçırılan planlı günler (daha da soluk). Gün dokununca o günün antrenmanları ya da planı.
 */
function MonthCalendar() {
  const _ = useT();
  const t = useTheme();
  const sheet = useSheet();
  const [{ year, month }, setYm] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const grid = monthGrid(year, month);
  const from = grid[0][0].ts;
  const to = new Date(grid[grid.length - 1][6].ts);
  to.setDate(to.getDate() + 1);
  const { data, db } = useDbQuery(
    async (db) => ({ workouts: await workoutsBetween(db, from, to.getTime()), plan: await getWeekPlan(db) }),
    [from],
  );
  const [now] = useState(() => Date.now());
  const today = startOfDay(now);
  const plan = data?.plan ?? [];

  const byDay = new Map<number, NonNullable<typeof data>['workouts']>();
  for (const w of data?.workouts ?? []) {
    const k = startOfDay(w.started_at);
    byDay.set(k, [...(byDay.get(k) ?? []), w]);
  }
  const hasPlan = data?.plan.some((d) => d.routine_id != null) ?? false;

  const openDay = (ts: number) => {
    const ws = byDay.get(ts) ?? [];
    const wd = weekdayOf(ts);
    const planned = data?.plan[wd];
    const title = `${weekdayNames()[wd]}, ${new Date(ts).getDate()} ${monthNames()[new Date(ts).getMonth()]}`;
    const plannedLine = planned?.routine_id != null ? _('history.plan_name', { name: routineLabel(planned.routine_name ?? '') }) : hasPlan ? _('history.plan_rest_day') : undefined;
    sheet.actions({
      title,
      message: [plannedLine, planned?.note].filter(Boolean).join(' · ') || (ws.length === 0 ? _('history.no_workout_on_this_day') : undefined),
      cancelLabel: _('common.close'),
      actions: [
        ...ws.map((w) => ({ label: routineLabel(w.name), icon: 'history' as const, onPress: () => router.push(`/session/${w.id}`) })),
        ...(ts === today && ws.length === 0 && planned?.routine_id != null
          ? [{ label: _('history.start', { routine_name: planned.routine_name }), icon: 'play' as const, style: 'primary' as const, onPress: () => beginWorkout(db, planned.routine_id, sheet) }]
          : []),
        ...(ts <= today
          ? [{ label: _('history.add_a_workout_to_this'), icon: 'addCircle' as const, onPress: () => router.push(`/add-past-workout?date=${ts}`) }]
          : []),
        { label: _('history.open_weekly_plan'), icon: 'edit' as const, onPress: () => router.push('/week-plan') },
      ],
    });
  };

  return (
    <Card style={{ marginBottom: Spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm }}>
        <IconButton icon="chevronLeft" label={_('history.previous_month')} onPress={() => setYm((c) => shiftMonth(c.year, c.month, -1))} bg="transparent" color={t.textSecondary} size={14} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <T variant="heading">
            {monthNames()[month]} {year}
          </T>
        </View>
        <IconButton icon="chevronRight" label={_('history.next_month')} onPress={() => setYm((c) => shiftMonth(c.year, c.month, 1))} bg="transparent" color={t.textSecondary} size={14} />
      </View>
      <View style={{ flexDirection: 'row', marginBottom: 4 }}>
        {weekdayShort().map((d, i) => (
          <T key={d} variant="caption" color={t.days[i].color} numberOfLines={1} style={{ flex: 1, textAlign: 'center', fontSize: 10, fontFamily: Font.bold }}>
            {d}
          </T>
        ))}
      </View>
      {grid.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row', gap: 3, marginBottom: 3 }}>
          {row.map((c) => {
            const ws = byDay.get(c.ts) ?? [];
            const planned = data?.plan[weekdayOf(c.ts)];
            const isPlanned = planned?.routine_id != null;
            const status = dayStatus(isPlanned, ws.length > 0, c.ts, now);
            const isToday = c.ts === today;
            const dc = t.days[calendarColorIndex(plan, ws.length > 0 ? ws[0].routine_id : (planned?.routine_id ?? null), c.ts)];
            const color = dc.color;
            const label = ws.length > 0 ? shortRoutineName(ws[0].name, 5) : status === 'upcoming' || status === 'missed' ? shortRoutineName(planned?.routine_name, 5) : '';
            return (
              <PressableScale
                key={c.ts}
                onPress={() => openDay(c.ts)}
                hapticOnPress={false}
                scaleTo={0.94}
                accessibilityLabel={`${new Date(c.ts).getDate()} ${monthNames()[new Date(c.ts).getMonth()]}: ${ws.length > 0 ? ws.map((w) => routineLabel(w.name)).join(', ') : isPlanned ? _('history.planned', { routine_name: planned?.routine_name }) : _('history.empty')}`}
                style={[
                  styles.calCell,
                  { opacity: c.inMonth ? 1 : 0.35 },
                  status === 'done' && { backgroundColor: dc.soft, borderColor: color },
                  status === 'upcoming' && { borderColor: color, borderStyle: 'dashed', opacity: c.inMonth ? 0.6 : 0.3 },
                  status === 'missed' && { borderColor: t.border, borderStyle: 'dashed', opacity: c.inMonth ? 0.4 : 0.2 },
                  isToday && { borderWidth: 2, borderColor: t.primary, borderStyle: 'solid' },
                ]}>
                <T variant="label" color={status === 'done' ? t.text : t.textSecondary} style={{ fontSize: 12, fontFamily: isToday ? Font.heavy : Font.medium }}>
                  {new Date(c.ts).getDate()}
                </T>
                <T variant="caption" color={status === 'done' || status === 'upcoming' ? color : t.textMuted} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ fontSize: 8, lineHeight: 10 }}>
                  {label || ' '}
                </T>
                {ws.length > 1 && <View style={[styles.multi, { backgroundColor: color }]} />}
              </PressableScale>
            );
          })}
        </View>
      ))}
    </Card>
  );
}

/** Son 15 haftanın antrenman ısı haritası (GitHub tarzı). */
function Heatmap({ starts }: { starts: number[] }) {
  const _ = useT();
  const t = useTheme();
  const WEEKS = 15;
  const [today] = useState(() => startOfDay(Date.now()));
  const dow = (new Date(today).getDay() + 6) % 7;
  const firstDay = today - (dow + (WEEKS - 1) * 7) * 86400000;
  const counts = new Map<number, number>();
  for (const s of starts) {
    const d = startOfDay(s);
    if (d >= firstDay) counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const active = counts.size;
  return (
    <Card style={{ marginBottom: Spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.md }}>
        <T variant="overline" secondary>{_('history.last_weeks', { WEEKS: WEEKS })}</T>
        <T variant="caption" color={t.primary} style={{ fontFamily: Font.bold }}>
          {_('history.active_days', { count: active })}</T>
      </View>
      <View style={{ flexDirection: 'row', gap: 4, justifyContent: 'space-between' }}>
        {Array.from({ length: WEEKS }).map((_, w) => (
          <View key={w} style={{ gap: 4, flex: 1 }}>
            {Array.from({ length: 7 }).map((__, d) => {
              const day = firstDay + (w * 7 + d) * 86400000;
              const c = counts.get(day) ?? 0;
              const future = day > today;
              return (
                <View
                  key={d}
                  style={{
                    aspectRatio: 1,
                    borderRadius: 4,
                    backgroundColor: future ? 'transparent' : c > 0 ? t.primary : t.surfacePressed,
                    opacity: c > 1 ? 1 : c === 1 ? 0.85 : 1,
                  }}
                />
              );
            })}
          </View>
        ))}
      </View>
    </Card>
  );
}

function Meta({ icon, text }: { icon: IconName; text: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Icon name={icon} size={11} color={t.textMuted} />
      <T variant="caption" muted>
        {text}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: Spacing.lg, marginBottom: Spacing.sm },
  calCell: { flex: 1, aspectRatio: 0.95, borderRadius: 8, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center', gap: 1 },
  multi: { position: 'absolute', top: 3, right: 3, width: 5, height: 5, borderRadius: 3 },
  date: { width: 46, height: 52, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', gap: Spacing.md, marginTop: 4 },
});
