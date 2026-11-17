import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BodyMap } from '@/components/body-map';
import { Icon } from '@/components/icon';
import { useSheet } from '@/components/sheet';
import { Card, EmptyState, IconButton, PressableScale, Ring, SectionHeader, Stat, T, Tile } from '@/components/ui';
import { Font, Radius, Spacing } from '@/constants/theme';
import {
  getActiveWorkout,
  getHomeStats,
  getProfile,
  getRoutine,
  getWeekPlan,
  listRoutines,
  listWorkouts,
  muscleLastTrained,
  muscleSets,
  recentPrCount,
  weeklyVolume,
} from '@/db/queries';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { formatDayLong, formatMinutes } from '@/lib/format';
import { computeRecovery, restingMuscles } from '@/lib/recovery';
import { beginWorkout } from '@/lib/start-workout';
import { dayStatus, shortRoutineName, weekDayTs, weekdayLetters, weekdayNames, weeklyAdherence, type DayStatus } from '@/lib/week-plan';
import { useT } from '@/components/language-provider';
import { muscleLabel, routineLabel } from '@/i18n/labels';
import { getLanguage, localeData, t as tt } from '@/i18n';


function hello() {
  const h = new Date().getHours();
  if (h < 6) return tt('home.good_night');
  if (h < 12) return tt('home.good_morning');
  if (h < 18) return tt('home.hello');
  return tt('home.good_evening');
}

export default function Home() {
  const _ = useT();
  const t = useTheme();
  const sheet = useSheet();
  const { data, db } = useDbQuery(async (db) => {
    const [profile, stats, routines, last, active, muscles, weeks, prs, lastTrained, plan] = await Promise.all([
      getProfile(db),
      getHomeStats(db),
      listRoutines(db),
      listWorkouts(db, 1),
      getActiveWorkout(db),
      muscleSets(db, 7),
      weeklyVolume(db, 2),
      recentPrCount(db, 30),
      muscleLastTrained(db),
      getWeekPlan(db),
    ]);
    const recoveryDays = profile?.recoveryDays ?? 2;
    const recovery = computeRecovery(lastTrained, recoveryDays);
    // Sıradaki rutin: önce kasları dinlenmiş olanlar, sonra en uzun süredir yapılmayan
    const restingShare = (r: (typeof routines)[number]) => {
      const ms = r.muscles?.split(',') ?? [];
      return ms.length ? restingMuscles(ms, recovery).length / ms.length : 1;
    };
    const candidates = routines.filter((r) => r.exercise_count > 0);
    const suggested = candidates.length
      ? [...candidates].sort((a, b) => restingShare(a) - restingShare(b) || (a.last_done ?? 0) - (b.last_done ?? 0))[0]
      : null;
    // Haftalık plan: bugün rutin atanmışsa o; plan var ama bugün boşsa dinlenme günü (önerilen rutin "yine de" için kalır)
    const todayPlan = plan[(new Date().getDay() + 6) % 7];
    const hasPlan = plan.some((d) => d.routine_id != null);
    const plannedToday = todayPlan.routine_id != null ? (routines.find((r) => r.id === todayPlan.routine_id) ?? null) : null;
    const restDay = hasPlan && todayPlan.routine_id == null;
    const next = plannedToday ?? suggested;
    const nextDetail = next ? await getRoutine(db, next.id) : null;
    return { profile, stats, routines, last: last[0] ?? null, active, muscles, weeks, prs, next, suggested, plannedToday, restDay, nextDetail, recovery, recoveryDays, plan, hasPlan };
  });

  if (!data) return <View style={{ flex: 1, backgroundColor: t.background }} />;
  const { profile, stats, routines, last, active, muscles, weeks, prs, next, suggested, plannedToday, restDay, nextDetail, recovery, recoveryDays, plan, hasPlan } = data;
  const nextResting = next ? restingMuscles(next.muscles?.split(',') ?? [], recovery) : [];

  const now = new Date();
  const todayIdx = (now.getDay() + 6) % 7;
  const target = profile?.daysPerWeek ?? 3;
  const muscleValues = Object.fromEntries(muscles.map((m) => [m.muscle, Math.min(1, m.sets / 16)]));
  const [prevWeek, thisWeek] = weeks;
  const delta = prevWeek.sets > 0 && thisWeek.sets > 0 ? Math.round(((thisWeek.sets - prevWeek.sets) / prevWeek.sets) * 100) : null;
  const totalSets = nextDetail?.items.reduce((a, i) => a + i.target_sets, 0) ?? 0;

  /** "+" : rutin listesi + "Boş antrenman" */
  const pickRoutine = () =>
    sheet.custom({
      title: _('home.pick_a_workout'),
      render: (close) => (
        <View style={{ gap: Spacing.sm }}>
          <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
            {routines.length === 0 && (
              <T secondary style={{ textAlign: 'center', paddingVertical: Spacing.sm }}>{_('home.no_routines_yet_you_can')}</T>
            )}
            {routines.map((r) => (
              <PressableScale
                key={r.id}
                onPress={async () => {
                  await close();
                  beginWorkout(db, r.id, sheet);
                }}
                style={[styles.pickRow, { backgroundColor: t.surfacePressed }]}>
                <View style={[styles.routineIcon, { backgroundColor: t.primarySoft, marginBottom: 0 }]}>
                  <Icon name="barbell" size={16} color={t.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <T variant="heading" numberOfLines={1}>
                    {routineLabel(r.name)}
                  </T>
                  <T variant="caption" secondary numberOfLines={1}>
                    {_('common.exercises', { count: r.exercise_count, v: r.last_done ? formatDayLong(r.last_done) : _('common.not_done_yet') })}
                  </T>
                </View>
                <Icon name="play" size={14} color={t.primary} />
              </PressableScale>
            ))}
          </ScrollView>
          <PressableScale
            onPress={async () => {
              await close();
              router.push('/routine/new');
            }}
            style={[styles.pickRow, { backgroundColor: t.surfacePressed, justifyContent: 'center' }]}>
            <Icon name="add" size={16} color={t.text} />
            <T variant="heading">{_('common.create_a_new_routine')}</T>
          </PressableScale>
          <PressableScale
            onPress={async () => {
              await close();
              beginWorkout(db, null, sheet);
            }}
            style={[styles.pickRow, { backgroundColor: t.primarySoft, justifyContent: 'center' }]}>
            <Icon name="bolt" size={16} color={t.primary} />
            <T variant="heading" color={t.primary}>{_('common.empty_workout')}</T>
          </PressableScale>
        </View>
      ),
    });

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.background }}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Başlık */}
        <Animated.View entering={FadeInDown.duration(350)} style={styles.header}>
          <View style={{ flex: 1 }}>
            <T variant="overline" secondary>
              {localeData().days[now.getDay()]}, {getLanguage() === 'en' ? `${localeData().months[now.getMonth()]} ${now.getDate()}` : `${now.getDate()} ${localeData().months[now.getMonth()]}`}
            </T>
            <T variant="title" numberOfLines={1}>
              {hello()}, {profile?.name || _('home.athlete')}
            </T>
          </View>
          <IconButton icon="search" label={_('common.exercise_library')} onPress={() => router.push('/exercises')} color={t.textSecondary} />
          <IconButton icon="settings" onPress={() => router.push('/settings')} color={t.textSecondary} />
        </Animated.View>

        {active && (
          <Animated.View entering={FadeInDown.delay(30)}>
            <PressableScale onPress={() => router.push(`/workout/${active.id}`)} style={[styles.activeBanner, { backgroundColor: t.successSoft, borderColor: t.success }]}>
              <View style={[styles.liveDot, { backgroundColor: t.success }]} />
              <View style={{ flex: 1 }}>
                <T variant="overline" color={t.success}>{_('home.in_progress')}</T>
                <T variant="heading">{routineLabel(active.name)}</T>
              </View>
              <Icon name="chevronRight" size={16} color={t.success} />
            </PressableScale>
          </Animated.View>
        )}

        {/* Sıradaki antrenman */}
        <Animated.View entering={FadeInDown.delay(70).duration(400)}>
          <LinearGradient colors={t.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={[styles.wave, { width: 260, height: 260, top: -120, right: -90 }]} />
            <View style={[styles.wave, { width: 160, height: 160, bottom: -80, left: -40, opacity: 0.06 }]} />
            <T variant="overline" color="rgba(255,255,255,0.75)">
              {restDay ? _('common.weekly_plan') : plannedToday ? (stats.daysDone.has(todayIdx) ? _('home.today_done') : _('common.today')) : next ? _('home.next_workout') : _('home.ready')}
            </T>
            <T variant="title" color="#fff" style={{ marginTop: 2 }}>
              {restDay ? _('home.rest_day_today') : plannedToday ? _('home.today', { name: routineLabel(plannedToday.name) }) : (next ? routineLabel(next.name) : _('home.free_workout'))}
            </T>
            {restDay && (
              <T variant="label" color="rgba(255,255,255,0.85)" style={{ marginTop: 6 }}>{_('home.your_muscles_are_recovering_you', { v: suggested ? _('home.suggestion', { name: suggested.name }) : '' })}</T>
            )}
            {!restDay && nextDetail && nextDetail.items.length > 0 && (
              <>
                <View style={styles.heroMeta}>
                  <HeroMeta icon="barbell" text={_('common.exercises2', { count: nextDetail.items.length })} />
                  <HeroMeta icon="layers" text={_('home.sets', { count: totalSets })} />
                  <HeroMeta icon="clock" text={_('home.min', { v: Math.round(totalSets * 2.6) })} />
                </View>
                <View style={{ gap: 4, marginTop: Spacing.md }}>
                  {nextDetail.items.slice(0, 3).map((it, i) => (
                    <T key={`${it.exercise_id}-${i}`} variant="label" color="rgba(255,255,255,0.9)" numberOfLines={1}>
                      {it.target_sets} × {it.name}
                    </T>
                  ))}
                  {nextDetail.items.length > 3 && (
                    <T variant="caption" color="rgba(255,255,255,0.6)">{_('home.more_exercises', { v: nextDetail.items.length - 3 })}</T>
                  )}
                </View>
              </>
            )}
            {!restDay && nextResting.length > 0 && (
              <View style={styles.heroWarn}>
                <Icon name="moon" size={12} color="#fff" />
                <T variant="caption" color="#fff" style={{ flex: 1 }}>
                  {_('home.should_rest_recommended_days', { v: nextResting.map((r) => _('home.more_days', { muscle: muscleLabel(r.muscle), count: r.remaining })).join(' · '), recoveryDays: recoveryDays })}</T>
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg }}>
              <PressableScale
                onPress={() => beginWorkout(db, (restDay ? suggested : next)?.id ?? null, sheet)}
                style={[styles.heroBtn, { backgroundColor: '#fff', flex: 1 }]}>
                <Icon name="play" size={15} color={t.isDark ? '#083F66' : t.primaryStrong} />
                <T variant="heading" color={t.isDark ? '#083F66' : t.primaryStrong}>
                  {restDay ? _('home.start_anyway') : _('home.start_workout')}
                </T>
              </PressableScale>
              <PressableScale
                onPress={() => pickRoutine()}
                accessibilityLabel={_('home.pick_a_routine_or_start')}
                style={[styles.heroBtn, { backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 18 }]}>
                <Icon name="add" size={16} color="#fff" />
              </PressableScale>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Bento */}
        <Animated.View entering={FadeInDown.delay(130).duration(400)} style={styles.row}>
          <Tile icon="target" label={_('common.this_week')} style={{ minHeight: 150 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
              <Ring progress={stats.weekCount / target} size={62} stroke={7}>
                <T variant="heading">
                  {stats.weekCount}
                  <T variant="caption" secondary>
                    /{target}
                  </T>
                </T>
              </Ring>
            </View>
            <View style={styles.weekDots}>
              {weekdayLetters().map((d, i) => {
                const done = stats.daysDone.has(i);
                const today = i === todayIdx;
                return (
                  <View key={i} style={{ alignItems: 'center', gap: 3 }}>
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: done ? t.primary : t.surfacePressed },
                        today && !done && { borderWidth: 1.5, borderColor: t.primary },
                      ]}
                    />
                    <T variant="caption" color={today ? t.primary : t.textMuted} style={{ fontSize: 9 }}>
                      {d}
                    </T>
                  </View>
                );
              })}
            </View>
          </Tile>
          <View style={{ flex: 1, gap: Spacing.md }}>
            <Tile icon="flame" label={_('home.streak')} tint={t.gold}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                <T variant="num">{stats.weekStreak}</T>
                <T variant="label" secondary>{_('home.wk')}</T>
              </View>
            </Tile>
            <Tile icon="trophy" label={_('home.prs_30_days')} tint={t.gold}>
              <T variant="num">{prs}</T>
            </Tile>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(400)} style={{ marginTop: Spacing.md }}>
          <PlanStrip plan={plan} hasPlan={hasPlan} daysDone={stats.daysDone} todayIdx={todayIdx} now={now.getTime()} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(180).duration(400)}>
          <Tile icon="body" label={_('home.last_7_days_muscles_worked')} onPress={() => router.navigate('/progress')} style={{ marginTop: Spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <BodyMap values={muscleValues} size={150} labels={false} />
              </View>
              <View style={{ width: 120, gap: 6 }}>
                {muscles.length === 0 ? (
                  <T variant="caption" muted>{_('home.your_muscles_will_light_up')}</T>
                ) : (
                  muscles.slice(0, 5).map((m) => (
                    <View key={m.muscle} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <T variant="label">{muscleLabel(m.muscle)}</T>
                      <T variant="label" color={t.primary}>
                        {_('home.sets2', { count: m.sets })}</T>
                    </View>
                  ))
                )}
              </View>
            </View>
          </Tile>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <Tile icon="moon" label={_('common.muscle_recovery_recommended_days', { recoveryDays: recoveryDays })} onPress={() => router.navigate('/progress')} style={{ marginTop: Spacing.md }}>
            <View style={styles.recGrid}>
              {recovery.map((r) => {
                const color = r.daysRested == null ? t.textMuted : r.ready ? t.success : t.gold;
                return (
                  <View key={r.muscle} style={[styles.recChip, { backgroundColor: r.daysRested == null ? t.surfaceRaised : r.ready ? t.successSoft : t.goldSoft }]}>
                    <View style={[styles.recDot, { backgroundColor: color }]} />
                    <View style={{ flex: 1 }}>
                      <T variant="label" numberOfLines={1}>
                        {muscleLabel(r.muscle)}
                      </T>
                      <T variant="caption" color={color} style={{ fontSize: 10 }} numberOfLines={1}>
                        {r.daysRested == null ? '—' : r.ready ? _('home.days_ready', { daysRested: r.daysRested }) : _('home.days_more_days', { daysRested: r.daysRested, remaining: r.remaining })}
                      </T>
                    </View>
                  </View>
                );
              })}
            </View>
          </Tile>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(220).duration(400)} style={[styles.row, { marginTop: Spacing.md }]}>
          <Tile icon="chart" label={_('common.this_week')} onPress={() => router.navigate('/progress')}>
            <T variant="num">{_('home.sets2', { count: thisWeek.sets })}</T>
            {delta != null ? (
              <T variant="caption" color={delta >= 0 ? t.success : t.danger}>
                {_('home.vs_last_week', { v: delta >= 0 ? '▲' : '▼', v2: Math.abs(delta) })}</T>
            ) : (
              <T variant="caption" muted>{_('home.last_week_sets', { count: prevWeek.sets })}</T>
            )}
          </Tile>
          <Tile icon="layers" label={_('home.total')} onPress={() => router.navigate('/history')}>
            <T variant="num">{stats.total}</T>
            <T variant="caption" muted>{_('home.workouts')}</T>
          </Tile>
        </Animated.View>

        {/* Rutinler */}
        {routines.length > 0 && (
          <Animated.View entering={FadeInDown.delay(260).duration(400)}>
            <SectionHeader title={_('home.your_routines')} action={_('common.all')} onAction={() => router.navigate('/routines')} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: Spacing.md, paddingHorizontal: Spacing.lg }}
              style={{ marginHorizontal: -Spacing.lg }}>
              {routines.map((r) => (
                <PressableScale key={r.id} onPress={() => beginWorkout(db, r.id, sheet)} style={[styles.routineCard, { backgroundColor: t.surface, borderColor: t.border }]}>
                  <View style={[styles.routineIcon, { backgroundColor: t.primarySoft }]}>
                    <Icon name="barbell" size={16} color={t.primary} />
                  </View>
                  <T variant="heading" numberOfLines={1}>
                    {routineLabel(r.name)}
                  </T>
                  <T variant="caption" secondary numberOfLines={1}>
                    {_('home.exercises', { count: r.exercise_count })}</T>
                  <T variant="caption" muted>
                    {r.last_done ? formatDayLong(r.last_done) : _('home.not_done_yet')}
                  </T>
                </PressableScale>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* Son antrenman */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <SectionHeader title={_('home.last_workout')} action={last ? _('common.history') : undefined} onAction={() => router.navigate('/history')} />
          {last ? (
            <PressableScale onPress={() => router.push(`/session/${last.id}`)} scaleTo={0.98}>
              <Card>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <T variant="heading">{routineLabel(last.name)}</T>
                  <T variant="caption" secondary>
                    {formatDayLong(last.started_at)}
                  </T>
                </View>
                <T variant="caption" secondary numberOfLines={1} style={{ marginTop: 4 }}>
                  {last.exercise_names}
                </T>
                <View style={{ flexDirection: 'row', marginTop: Spacing.lg }}>
                  <Stat label={_('common.duration')} value={formatMinutes((last.finished_at ?? last.started_at) - last.started_at)} />
                  <Stat label={_('common.sets')} value={String(last.set_count)} />
                  <Stat label={_('common.prs')} value={String(last.pr_count)} />
                </View>
              </Card>
            </PressableScale>
          ) : (
            <Card>
              <EmptyState icon="homeOutline" title={_('home.no_workouts_yet')} text={_('home.start_your_first_workout_and')} />
            </Card>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Haftalık plan şeridi: her gün için durum (✓ yapıldı, soluk = kaçırıldı), altında rutinin kısa adı. */
function PlanStrip({ plan, hasPlan, daysDone, todayIdx, now }: { plan: Awaited<ReturnType<typeof getWeekPlan>>; hasPlan: boolean; daysDone: Set<number>; todayIdx: number; now: number }) {
  const _ = useT();
  const t = useTheme();
  const adherence = weeklyAdherence(
    plan.map((d) => d.routine_id != null),
    daysDone,
  );
  return (
    <Tile icon="history" label={hasPlan ? _('home.this_week_s_plan', { done: adherence.done, planned: adherence.planned }) : _('common.weekly_plan')} onPress={() => router.push('/week-plan')}>
      {!hasPlan ? (
        <T variant="caption" secondary>{_('home.assign_routines_to_days_monday')}</T>
      ) : (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {plan.map((d, i) => {
            const planned = d.routine_id != null;
            const status: DayStatus = dayStatus(planned, daysDone.has(i), weekDayTs(now, i), now);
            const isToday = i === todayIdx;
            return (
              <View key={i} style={{ alignItems: 'center', gap: 4, flex: 1 }} accessible accessibilityLabel={`${weekdayNames()[i]}: ${d.routine_name ? routineLabel(d.routine_name) : _('common.rest_lower')}${status === 'done' ? _('home.done') : status === 'missed' ? _('home.missed') : ''}`}>
                <T variant="caption" color={isToday ? t.primary : t.textMuted} style={{ fontSize: 10, fontFamily: isToday ? Font.heavy : Font.regular }}>
                  {weekdayLetters()[i]}
                </T>
                <View
                  style={[
                    styles.planDot,
                    status === 'done' && { backgroundColor: t.primary, borderColor: t.primary },
                    status === 'upcoming' && { borderColor: t.primary },
                    status === 'missed' && { borderColor: t.gold, opacity: 0.55, borderStyle: 'dashed' },
                    status === 'rest' && { borderColor: t.border, backgroundColor: t.surfacePressed },
                    isToday && { borderWidth: 2.5 },
                  ]}>
                  {status === 'done' && <Icon name="check" size={13} color={t.onPrimary} weight="bold" />}
                  {status === 'missed' && <Icon name="close" size={11} color={t.gold} weight="bold" />}
                </View>
                <T variant="caption" color={planned ? (status === 'missed' ? t.textMuted : t.textSecondary) : t.textMuted} numberOfLines={1} style={{ fontSize: 9 }}>
                  {planned ? shortRoutineName(d.routine_name, 6) : '–'}
                </T>
              </View>
            );
          })}
        </View>
      )}
    </Tile>
  );
}

function HeroMeta({ icon, text }: { icon: 'barbell' | 'layers' | 'clock'; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Icon name={icon} size={12} color="rgba(255,255,255,0.8)" />
      <T variant="label" color="rgba(255,255,255,0.85)">
        {text}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.lg, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  liveDot: { width: 10, height: 10, borderRadius: 5 },
  hero: { borderRadius: Radius.xl, padding: Spacing.xl, overflow: 'hidden' },
  wave: { position: 'absolute', borderRadius: 999, backgroundColor: '#fff', opacity: 0.1 },
  heroMeta: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.sm },
  heroBtn: { height: 52, borderRadius: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  row: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  weekDots: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm },
  dot: { width: 12, height: 12, borderRadius: 6 },
  planDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  heroWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  recGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  recChip: { width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 7, borderRadius: Radius.sm },
  recDot: { width: 8, height: 8, borderRadius: 4 },
  routineCard: { width: 150, padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, gap: 3 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.md, minHeight: 54 },
  routineIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
});
