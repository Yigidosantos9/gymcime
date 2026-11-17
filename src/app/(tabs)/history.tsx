import { router } from 'expo-router';
import { useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { formatMin } from '@/lib/cardio';
import { HomeBack } from '@/components/tab-back';
import { useSheet } from '@/components/sheet';
import { Badge, Card, EmptyState, IconButton, PressableScale, ScreenHeader, T } from '@/components/ui';
import { Font, Radius, Spacing } from '@/constants/theme';
import { getWeekPlan, listWorkouts, workoutsBetween, type WorkoutListItem } from '@/db/queries';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { formatMinutes, startOfDay } from '@/lib/format';
import { beginWorkout } from '@/lib/start-workout';
import { dayStatus, MONTH_NAMES, monthGrid, shiftMonth, shortRoutineName, WEEKDAY_NAMES, WEEKDAY_SHORT, weekdayOf } from '@/lib/week-plan';

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const DOW = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

export default function History() {
  const t = useTheme();
  const { data } = useDbQuery((db) => listWorkouts(db, 500));

  const sections: { title: string; count: number; sets: number; data: WorkoutListItem[] }[] = [];
  for (const w of data ?? []) {
    const d = new Date(w.started_at);
    const title = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
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
            <ScreenHeader title="Geçmiş" subtitle={data ? `${data.length} antrenman` : undefined} />
            <MonthCalendar />
            <Heatmap starts={(data ?? []).map((w) => w.started_at)} />
          </>
        }
        ListEmptyComponent={
          data ? (
            <Card>
              <EmptyState icon="history" title="Geçmiş boş" text="Bitirdiğin antrenmanlar burada birikecek." />
            </Card>
          ) : undefined
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHead}>
            <T variant="overline" secondary>
              {section.title}
            </T>
            <T variant="caption" muted>
              {section.count} antrenman · {section.sets} set
            </T>
          </View>
        )}
        renderItem={({ item, index }) => {
          const d = new Date(item.started_at);
          return (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 35).duration(300)}>
              <PressableScale onPress={() => router.push(`/session/${item.id}`)} scaleTo={0.98}>
                <Card style={{ marginBottom: Spacing.sm }}>
                  <View style={{ flexDirection: 'row', gap: Spacing.md }}>
                    <View style={[styles.date, { backgroundColor: t.surfaceRaised }]}>
                      <T variant="caption" secondary style={{ fontSize: 10 }}>
                        {DOW[d.getDay()]}
                      </T>
                      <T variant="heading" style={{ lineHeight: 20 }}>
                        {d.getDate()}
                      </T>
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <T variant="heading" numberOfLines={1} style={{ flexShrink: 1 }}>
                          {item.name}
                        </T>
                        {item.pr_count > 0 && <Badge label={`${item.pr_count} rekor`} icon="trophy" tint={t.gold} bg={t.goldSoft} />}
                      </View>
                      <T variant="caption" secondary numberOfLines={1}>
                        {item.exercise_names}
                      </T>
                      <View style={styles.meta}>
                        <Meta icon="clock" text={formatMinutes((item.finished_at ?? item.started_at) - item.started_at)} />
                        <Meta icon="layers" text={`${item.set_count} set`} />
                        {item.cardio_sec > 0 && <Meta icon="timer" text={`Kardiyo ${formatMin(item.cardio_sec / 60)}`} />}
                        <Meta icon="barbell" text={`${item.exercise_names ? item.exercise_names.split(' · ').length : 0} egzersiz`} />
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
  const palette = [t.primary, t.gold, t.violet, t.success, t.danger];
  const colorOf = (routineId: number | null) => (routineId == null ? t.textSecondary : palette[routineId % palette.length]);

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
    const title = `${WEEKDAY_NAMES[wd]}, ${new Date(ts).getDate()} ${MONTH_NAMES[new Date(ts).getMonth()]}`;
    const plannedLine = planned?.routine_id != null ? `Plan: ${planned.routine_name}` : hasPlan ? 'Plan: dinlenme günü' : undefined;
    sheet.actions({
      title,
      message: [plannedLine, planned?.note].filter(Boolean).join(' · ') || (ws.length === 0 ? 'Bu gün antrenman yok.' : undefined),
      cancelLabel: 'Kapat',
      actions: [
        ...ws.map((w) => ({ label: w.name, icon: 'history' as const, onPress: () => router.push(`/session/${w.id}`) })),
        ...(ts === today && ws.length === 0 && planned?.routine_id != null
          ? [{ label: `${planned.routine_name} başlat`, icon: 'play' as const, style: 'primary' as const, onPress: () => beginWorkout(db, planned.routine_id, sheet) }]
          : []),
        { label: 'Haftalık planı aç', icon: 'edit' as const, onPress: () => router.push('/week-plan') },
      ],
    });
  };

  return (
    <Card style={{ marginBottom: Spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm }}>
        <IconButton icon="chevronLeft" label="Önceki ay" onPress={() => setYm((c) => shiftMonth(c.year, c.month, -1))} bg="transparent" color={t.textSecondary} size={14} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <T variant="heading">
            {MONTH_NAMES[month]} {year}
          </T>
        </View>
        <IconButton icon="chevronRight" label="Sonraki ay" onPress={() => setYm((c) => shiftMonth(c.year, c.month, 1))} bg="transparent" color={t.textSecondary} size={14} />
      </View>
      <View style={{ flexDirection: 'row', marginBottom: 4 }}>
        {WEEKDAY_SHORT.map((d) => (
          <T key={d} variant="caption" muted style={{ flex: 1, textAlign: 'center', fontSize: 10 }}>
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
            const color = ws.length > 0 ? colorOf(ws[0].routine_id) : colorOf(planned?.routine_id ?? null);
            const label = ws.length > 0 ? shortRoutineName(ws[0].name, 5) : status === 'upcoming' || status === 'missed' ? shortRoutineName(planned?.routine_name, 5) : '';
            return (
              <PressableScale
                key={c.ts}
                onPress={() => openDay(c.ts)}
                hapticOnPress={false}
                scaleTo={0.94}
                accessibilityLabel={`${new Date(c.ts).getDate()} ${MONTH_NAMES[new Date(c.ts).getMonth()]}: ${ws.length > 0 ? ws.map((w) => w.name).join(', ') : isPlanned ? `planlı ${planned?.routine_name}` : 'boş'}`}
                style={[
                  styles.calCell,
                  { opacity: c.inMonth ? 1 : 0.35 },
                  status === 'done' && { backgroundColor: color + '33', borderColor: color },
                  status === 'upcoming' && { borderColor: color, borderStyle: 'dashed', opacity: c.inMonth ? 0.6 : 0.3 },
                  status === 'missed' && { borderColor: t.border, borderStyle: 'dashed', opacity: c.inMonth ? 0.4 : 0.2 },
                  isToday && { borderWidth: 2, borderColor: t.primary, borderStyle: 'solid' },
                ]}>
                <T variant="label" color={status === 'done' ? t.text : t.textSecondary} style={{ fontSize: 12, fontFamily: isToday ? Font.heavy : Font.medium }}>
                  {new Date(c.ts).getDate()}
                </T>
                <T variant="caption" color={status === 'done' ? color : t.textMuted} numberOfLines={1} style={{ fontSize: 8, lineHeight: 10 }}>
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
        <T variant="overline" secondary>
          Son {WEEKS} hafta
        </T>
        <T variant="caption" color={t.primary} style={{ fontFamily: Font.bold }}>
          {active} aktif gün
        </T>
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
