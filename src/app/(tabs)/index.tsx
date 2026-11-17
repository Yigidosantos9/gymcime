import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BodyMap } from '@/components/body-map';
import { Icon } from '@/components/icon';
import { useSheet } from '@/components/sheet';
import { Card, EmptyState, IconButton, PressableScale, Ring, SectionHeader, Stat, T, Tile } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import {
  getActiveWorkout,
  getHomeStats,
  getProfile,
  getRoutine,
  listRoutines,
  listWorkouts,
  muscleLastTrained,
  muscleSets,
  recentPrCount,
  weeklyVolume,
} from '@/db/queries';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { formatDayLong, formatMinutes, formatVolume } from '@/lib/format';
import { computeRecovery, restingMuscles } from '@/lib/recovery';
import { beginWorkout } from '@/lib/start-workout';

const WEEK = ['P', 'S', 'Ç', 'P', 'C', 'C', 'P'];
const DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

function hello() {
  const h = new Date().getHours();
  if (h < 6) return 'İyi geceler';
  if (h < 12) return 'Günaydın';
  if (h < 18) return 'Merhaba';
  return 'İyi akşamlar';
}

export default function Home() {
  const t = useTheme();
  const sheet = useSheet();
  const { data, db } = useDbQuery(async (db) => {
    const [profile, stats, routines, last, active, muscles, weeks, prs, lastTrained] = await Promise.all([
      getProfile(db),
      getHomeStats(db),
      listRoutines(db),
      listWorkouts(db, 1),
      getActiveWorkout(db),
      muscleSets(db, 7),
      weeklyVolume(db, 2),
      recentPrCount(db, 30),
      muscleLastTrained(db),
    ]);
    const recoveryDays = profile?.recoveryDays ?? 2;
    const recovery = computeRecovery(lastTrained, recoveryDays);
    // Sıradaki rutin: önce kasları dinlenmiş olanlar, sonra en uzun süredir yapılmayan
    const restingShare = (r: (typeof routines)[number]) => {
      const ms = r.muscles?.split(',') ?? [];
      return ms.length ? restingMuscles(ms, recovery).length / ms.length : 1;
    };
    const candidates = routines.filter((r) => r.exercise_count > 0);
    const next = candidates.length
      ? [...candidates].sort((a, b) => restingShare(a) - restingShare(b) || (a.last_done ?? 0) - (b.last_done ?? 0))[0]
      : null;
    const nextDetail = next ? await getRoutine(db, next.id) : null;
    return { profile, stats, routines, last: last[0] ?? null, active, muscles, weeks, prs, next, nextDetail, recovery, recoveryDays };
  });

  if (!data) return <View style={{ flex: 1, backgroundColor: t.background }} />;
  const { profile, stats, routines, last, active, muscles, weeks, prs, next, nextDetail, recovery, recoveryDays } = data;
  const nextResting = next ? restingMuscles(next.muscles?.split(',') ?? [], recovery) : [];

  const now = new Date();
  const todayIdx = (now.getDay() + 6) % 7;
  const target = profile?.daysPerWeek ?? 3;
  const muscleValues = Object.fromEntries(muscles.map((m) => [m.muscle, Math.min(1, m.sets / 16)]));
  const [prevWeek, thisWeek] = weeks;
  const delta = prevWeek.volume > 0 && thisWeek.volume > 0 ? Math.round(((thisWeek.volume - prevWeek.volume) / prevWeek.volume) * 100) : null;
  const totalSets = nextDetail?.items.reduce((a, i) => a + i.target_sets, 0) ?? 0;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.background }}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Başlık */}
        <Animated.View entering={FadeInDown.duration(350)} style={styles.header}>
          <View style={{ flex: 1 }}>
            <T variant="overline" secondary>
              {DAYS[now.getDay()]}, {now.getDate()} {MONTHS[now.getMonth()]}
            </T>
            <T variant="title" numberOfLines={1}>
              {hello()}, {profile?.name || 'sporcu'}
            </T>
          </View>
          <IconButton icon="settings" onPress={() => router.push('/settings')} color={t.textSecondary} />
        </Animated.View>

        {active && (
          <Animated.View entering={FadeInDown.delay(30)}>
            <PressableScale onPress={() => router.push(`/workout/${active.id}`)} style={[styles.activeBanner, { backgroundColor: t.successSoft, borderColor: t.success }]}>
              <View style={[styles.liveDot, { backgroundColor: t.success }]} />
              <View style={{ flex: 1 }}>
                <T variant="overline" color={t.success}>
                  Devam ediyor
                </T>
                <T variant="heading">{active.name}</T>
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
              {next ? 'Sıradaki antrenman' : 'Hazır mısın?'}
            </T>
            <T variant="title" color="#fff" style={{ marginTop: 2 }}>
              {next?.name ?? 'Serbest Antrenman'}
            </T>
            {nextDetail && nextDetail.items.length > 0 && (
              <>
                <View style={styles.heroMeta}>
                  <HeroMeta icon="barbell" text={`${nextDetail.items.length} egzersiz`} />
                  <HeroMeta icon="layers" text={`${totalSets} set`} />
                  <HeroMeta icon="clock" text={`~${Math.round(totalSets * 2.6)} dk`} />
                </View>
                <View style={{ gap: 4, marginTop: Spacing.md }}>
                  {nextDetail.items.slice(0, 3).map((it, i) => (
                    <T key={`${it.exercise_id}-${i}`} variant="label" color="rgba(255,255,255,0.9)" numberOfLines={1}>
                      {it.target_sets} × {it.name}
                    </T>
                  ))}
                  {nextDetail.items.length > 3 && (
                    <T variant="caption" color="rgba(255,255,255,0.6)">
                      +{nextDetail.items.length - 3} egzersiz daha
                    </T>
                  )}
                </View>
              </>
            )}
            {nextResting.length > 0 && (
              <View style={styles.heroWarn}>
                <Icon name="moon" size={12} color="#fff" />
                <T variant="caption" color="#fff" style={{ flex: 1 }}>
                  {nextResting.map((r) => `${r.muscle} ${r.remaining} gün daha`).join(' · ')} dinlenmeli (önerilen {recoveryDays} gün)
                </T>
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg }}>
              <PressableScale onPress={() => beginWorkout(db, next?.id ?? null, sheet)} style={[styles.heroBtn, { backgroundColor: '#fff', flex: 1 }]}>
                <Icon name="play" size={15} color={t.isDark ? '#083F66' : t.primaryStrong} />
                <T variant="heading" color={t.isDark ? '#083F66' : t.primaryStrong}>
                  Antrenmana başla
                </T>
              </PressableScale>
              {next && (
                <PressableScale onPress={() => beginWorkout(db, null, sheet)} style={[styles.heroBtn, { backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 18 }]}>
                  <Icon name="add" size={16} color="#fff" />
                </PressableScale>
              )}
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Bento */}
        <Animated.View entering={FadeInDown.delay(130).duration(400)} style={styles.row}>
          <Tile icon="target" label="Bu hafta" style={{ minHeight: 150 }}>
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
              {WEEK.map((d, i) => {
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
            <Tile icon="flame" label="Seri" tint={t.gold}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                <T variant="num">{stats.weekStreak}</T>
                <T variant="label" secondary>
                  hafta
                </T>
              </View>
            </Tile>
            <Tile icon="trophy" label="Rekor · 30 gün" tint={t.gold}>
              <T variant="num">{prs}</T>
            </Tile>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(180).duration(400)}>
          <Tile icon="body" label="Son 7 gün · çalışan kaslar" onPress={() => router.push('/progress')} style={{ marginTop: Spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <BodyMap values={muscleValues} size={150} labels={false} />
              </View>
              <View style={{ width: 120, gap: 6 }}>
                {muscles.length === 0 ? (
                  <T variant="caption" muted>
                    Antrenman yaptıkça kasların burada parlayacak ✨
                  </T>
                ) : (
                  muscles.slice(0, 5).map((m) => (
                    <View key={m.muscle} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <T variant="label">{m.muscle}</T>
                      <T variant="label" color={t.primary}>
                        {m.sets} set
                      </T>
                    </View>
                  ))
                )}
              </View>
            </View>
          </Tile>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <Tile icon="moon" label={`Kas toparlanması · önerilen ${recoveryDays} gün`} onPress={() => router.push('/progress')} style={{ marginTop: Spacing.md }}>
            <View style={styles.recGrid}>
              {recovery.map((r) => {
                const color = r.daysRested == null ? t.textMuted : r.ready ? t.success : t.gold;
                return (
                  <View key={r.muscle} style={[styles.recChip, { backgroundColor: r.daysRested == null ? t.surfaceRaised : r.ready ? t.successSoft : t.goldSoft }]}>
                    <View style={[styles.recDot, { backgroundColor: color }]} />
                    <View style={{ flex: 1 }}>
                      <T variant="label" numberOfLines={1}>
                        {r.muscle}
                      </T>
                      <T variant="caption" color={color} style={{ fontSize: 10 }} numberOfLines={1}>
                        {r.daysRested == null ? '—' : r.ready ? `${r.daysRested} gün · hazır` : `${r.daysRested} gün · ${r.remaining} gün daha`}
                      </T>
                    </View>
                  </View>
                );
              })}
            </View>
          </Tile>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(220).duration(400)} style={[styles.row, { marginTop: Spacing.md }]}>
          <Tile icon="chart" label="Haftalık hacim" onPress={() => router.push('/progress')}>
            <T variant="num">{formatVolume(thisWeek.volume)}</T>
            {delta != null ? (
              <T variant="caption" color={delta >= 0 ? t.success : t.danger}>
                {delta >= 0 ? '▲' : '▼'} %{Math.abs(delta)} geçen haftaya göre
              </T>
            ) : (
              <T variant="caption" muted>
                Geçen hafta {formatVolume(prevWeek.volume)}
              </T>
            )}
          </Tile>
          <Tile icon="layers" label="Toplam" onPress={() => router.push('/history')}>
            <T variant="num">{stats.total}</T>
            <T variant="caption" muted>
              antrenman
            </T>
          </Tile>
        </Animated.View>

        {/* Rutinler */}
        {routines.length > 0 && (
          <Animated.View entering={FadeInDown.delay(260).duration(400)}>
            <SectionHeader title="Rutinlerin" action="Tümü" onAction={() => router.push('/routines')} />
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
                    {r.name}
                  </T>
                  <T variant="caption" secondary numberOfLines={1}>
                    {r.exercise_count} egzersiz
                  </T>
                  <T variant="caption" muted>
                    {r.last_done ? formatDayLong(r.last_done) : 'Henüz yapılmadı'}
                  </T>
                </PressableScale>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* Son antrenman */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <SectionHeader title="Son antrenman" action={last ? 'Geçmiş' : undefined} onAction={() => router.push('/history')} />
          {last ? (
            <PressableScale onPress={() => router.push(`/session/${last.id}`)} scaleTo={0.98}>
              <Card>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <T variant="heading">{last.name}</T>
                  <T variant="caption" secondary>
                    {formatDayLong(last.started_at)}
                  </T>
                </View>
                <T variant="caption" secondary numberOfLines={1} style={{ marginTop: 4 }}>
                  {last.exercise_names}
                </T>
                <View style={{ flexDirection: 'row', marginTop: Spacing.lg }}>
                  <Stat label="Süre" value={formatMinutes((last.finished_at ?? last.started_at) - last.started_at)} />
                  <Stat label="Set" value={String(last.set_count)} />
                  <Stat label="Hacim" value={formatVolume(last.volume)} />
                </View>
              </Card>
            </PressableScale>
          ) : (
            <Card>
              <EmptyState icon="homeOutline" title="Henüz antrenman yok" text="İlk antrenmanını başlat, özeti burada görünecek." />
            </Card>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
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
  routineIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
});
