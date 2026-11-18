import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BodyMap, HeatLegend, MuscleIcon } from '@/components/body-map';
import { BarChart, LineChart } from '@/components/charts';
import { HomeBack } from '@/components/tab-back';
import { Icon } from '@/components/icon';
import { Badge, Card, Chip, EmptyState, IconButton, Input, PressableScale, ScreenHeader, SectionHeader, T } from '@/components/ui';
import { Font, Radius, Spacing } from '@/constants/theme';
import { addBodyWeight, weeklyCardio, getProfile, listBodyWeights, muscleLastTrained, muscleSets, restStats, topExercises, weeklyVolume } from '@/db/queries';
import { MUSCLES } from '@/db/seed';
import { useDbQuery } from '@/hooks/use-db-query';
import { useScale, useTheme } from '@/hooks/use-theme';
import { formatDate, formatDuration, formatWeight, parseNumber } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { computeRecovery, fatigueValues, restLabel } from '@/lib/recovery';
import { formatMin } from '@/lib/cardio';
import { formatRest } from '@/lib/rest';
import { useT } from '@/components/language-provider';
import { muscleLabel } from '@/i18n/labels';
import { decimalSep } from '@/i18n';

type Range = 7 | 28;

export default function Progress() {
  const { f } = useScale();
  const _ = useT();
  const t = useTheme();
  const [bw, setBw] = useState('');
  const [range, setRange] = useState<Range>(7);
  const { data, db, reload } = useDbQuery(
    async (db) => {
      const [weeks, muscles, top, bodies, rests, lastTrained, profile, cardioWeeks] = await Promise.all([
        weeklyVolume(db, 8),
        muscleSets(db, range),
        topExercises(db, 8),
        listBodyWeights(db),
        restStats(db, 28),
        muscleLastTrained(db),
        getProfile(db),
        weeklyCardio(db, 8),
      ]);
      const recoveryDays = profile?.recoveryDays ?? 2;
      return { cardioWeeks, weeks, muscles, top, bodies, rests, recovery: computeRecovery(lastTrained, recoveryDays), recoveryDays };
    },
    [range],
  );

  if (!data) return <View style={{ flex: 1, backgroundColor: t.background }} />;
  const { cardioWeeks, weeks, muscles, top, bodies, rests, recovery, recoveryDays } = data;
  const thisWeek = weeks[weeks.length - 1];
  const lastWeek = weeks[weeks.length - 2];
  const delta = lastWeek?.sets && thisWeek.sets > 0 ? Math.round(((thisWeek.sets - lastWeek.sets) / lastWeek.sets) * 100) : null;
  // haftalık ortalamaya çevir (28 gün → /4)
  const perWeek = (sets: number) => (range === 28 ? sets / 4 : sets);
  const muscleMap = new Map(muscles.map((m) => [m.muscle, perWeek(m.sets)]));
  const heatValues = Object.fromEntries([...muscleMap].map(([m, s]) => [m, Math.min(1, s / 16)]));

  const saveBw = async () => {
    const v = parseNumber(bw);
    if (!v) return;
    await addBodyWeight(db, v);
    setBw('');
    haptic.success();
    reload();
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.background }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 120 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <HomeBack />
        <ScreenHeader title={_('common.progress')} right={<IconButton icon="settings" onPress={() => router.push('/settings')} color={t.textSecondary} />} />

        {/* Haftalık çalışma seti */}
        <Animated.View entering={FadeInDown.duration(350)}>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ gap: 2 }}>
                <T variant="overline" secondary>{_('progress.working_sets_this_week')}</T>
                <T variant="numLarge" style={{ fontSize: 36, lineHeight: 42 }}>
                  {thisWeek.sets}
                </T>
                {thisWeek.sets === 0 && lastWeek?.sets ? (
                  <T variant="caption" muted>{_('progress.last_week_sets_let_s', { count: lastWeek.sets })}</T>
                ) : null}
              </View>
              {delta != null && (
                <Badge
                  label={`%${Math.abs(delta)}`}
                  icon={delta >= 0 ? 'arrowUp' : 'arrowDown'}
                  tint={delta >= 0 ? t.success : t.danger}
                  bg={delta >= 0 ? t.successSoft : t.dangerSoft}
                />
              )}
            </View>
            <View style={{ marginTop: Spacing.lg }}>
              <BarChart values={weeks.map((w) => w.sets)} labels={weeks.map((w) => formatDate(w.week))} />
            </View>
          </Card>
        </Animated.View>

        {/* Kardiyo */}
        {cardioWeeks.some((w) => w.minutes > 0) && (
          <Animated.View entering={FadeInDown.delay(40).duration(350)}>
            <SectionHeader title={_('common.cardio2')} />
            <Card>
              <View style={{ flexDirection: 'row', gap: Spacing.xl }}>
                <View>
                  <T variant="overline" secondary>{_('common.this_week')}</T>
                  <T variant="numLarge" style={{ fontSize: 30, lineHeight: 36 }}>
                    {formatMin(cardioWeeks[cardioWeeks.length - 1].minutes)}
                  </T>
                </View>
                {cardioWeeks[cardioWeeks.length - 1].km > 0 && (
                  <View>
                    <T variant="overline" secondary>{_('progress.distance')}</T>
                    <T variant="numLarge" style={{ fontSize: 30, lineHeight: 36 }}>
                      {_('progress.km', { v: String(Math.round(cardioWeeks[cardioWeeks.length - 1].km * 10) / 10).replace('.', decimalSep()) })}</T>
                  </View>
                )}
              </View>
              <View style={{ marginTop: Spacing.lg }}>
                <BarChart values={cardioWeeks.map((w) => w.minutes)} labels={cardioWeeks.map((w) => formatDate(w.week))} />
              </View>
            </Card>
          </Animated.View>
        )}

        {/* Kas haritası */}
        <Animated.View entering={FadeInDown.delay(70).duration(350)}>
          <SectionHeader title={_('progress.muscle_balance')} />
          <Card>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: Spacing.lg }}>
              <Chip label={_('progress.last_7_days')} active={range === 7} onPress={() => setRange(7)} />
              <Chip label={_('progress.last_4_weeks')} active={range === 28} onPress={() => setRange(28)} />
            </View>
            <BodyMap values={heatValues} size={210} />
            <View style={{ marginTop: Spacing.md }}>
              <HeatLegend />
            </View>
            <View style={{ marginTop: Spacing.lg, gap: 2 }}>
              {MUSCLES.filter((m) => m !== 'Kardiyo').map((m) => {
                const sets = muscleMap.get(m) ?? 0;
                const pct = Math.min(1, sets / 20);
                const inBand = sets >= 10;
                const color = inBand ? t.success : sets > 0 ? t.primary : t.textMuted;
                return (
                  <View key={m} style={styles.muscleRow}>
                    <MuscleIcon muscle={m} size={26} />
                    <T variant="label" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ width: f(62) }}>
                      {m}
                    </T>
                    <View style={[styles.track, { backgroundColor: t.surfacePressed }]}>
                      <View style={[styles.band, { backgroundColor: t.successSoft, borderColor: t.success }]} />
                      <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: 5, backgroundColor: color }} />
                    </View>
                    <T variant="label" color={color} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ width: f(30), textAlign: 'right', fontFamily: Font.bold }}>
                      {Math.round(sets)}
                    </T>
                  </View>
                );
              })}
            </View>
            <T variant="caption" muted style={{ marginTop: Spacing.sm }}>{_('progress.weekly_sets_green_band_10')}</T>
          </Card>
        </Animated.View>

        {/* Kas toparlanması */}
        <Animated.View entering={FadeInDown.delay(100).duration(350)}>
          <SectionHeader title={_('common.muscle_recovery_recommended_days', { recoveryDays: recoveryDays })} />
          <Card>
            <BodyMap values={fatigueValues(recovery, recoveryDays)} size={180} />
            <T variant="caption" muted style={{ textAlign: 'center', marginTop: Spacing.sm }}>{_('progress.colored_areas_are_still_recovering')}</T>
            <View style={{ marginTop: Spacing.md }}>
              {recovery.map((r, i) => {
                const color = r.daysRested == null ? t.textMuted : r.ready ? t.success : t.gold;
                return (
                  <View key={r.muscle} style={[styles.recRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border }]}>
                    <MuscleIcon muscle={r.muscle} size={28} />
                    <View style={{ flex: 1 }}>
                      <T variant="label">{muscleLabel(r.muscle)}</T>
                      <T variant="caption" muted>
                        {restLabel(r)}
                        {r.lastSets ? _('progress.last_time_sets', { count: r.lastSets }) : ''}
                      </T>
                    </View>
                    <Badge
                      label={r.daysRested == null ? '—' : r.ready ? _('progress.ready') : _('progress.more_days', { count: r.remaining })}
                      icon={r.ready && r.daysRested != null ? 'check' : r.daysRested == null ? undefined : 'moon'}
                      tint={color}
                      bg={r.daysRested == null ? t.surfaceRaised : r.ready ? t.successSoft : t.goldSoft}
                    />
                  </View>
                );
              })}
            </View>
          </Card>
        </Animated.View>

        {/* Dinlenme analizi */}
        <Animated.View entering={FadeInDown.delay(120).duration(350)}>
          <SectionHeader title={_('progress.rest_discipline_last_4_weeks')} />
          <Card padded={rests.length === 0}>
            {rests.length === 0 ? (
              <T secondary>{_('progress.your_actual_rest_times_will')}</T>
            ) : (
              rests.slice(0, 6).map((r, i) => {
                const diff = r.avg_taken - r.avg_target;
                const over = diff > 30;
                const under = diff < -20;
                const color = over ? t.gold : under ? t.violet : t.success;
                const ratio = Math.min(1.6, r.avg_taken / Math.max(1, r.avg_target));
                return (
                  <View key={r.exercise_id} style={[styles.restRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border }]}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <T variant="label" numberOfLines={1} style={{ flex: 1 }}>
                          {r.name}
                        </T>
                        <T variant="label" color={color} style={{ fontFamily: Font.bold }}>
                          {formatDuration(r.avg_taken * 1000)}
                        </T>
                      </View>
                      <View style={[styles.restTrack, { backgroundColor: t.surfacePressed }]}>
                        <View style={{ width: `${(ratio / 1.6) * 100}%`, height: '100%', borderRadius: 3, backgroundColor: color }} />
                        <View style={[styles.restTarget, { left: `${(1 / 1.6) * 100}%`, backgroundColor: t.text }]} />
                      </View>
                      <T variant="caption" muted>{_('progress.target', { v: formatRest(r.avg_target), v2: over ? _('progress.over_on_average', { v: formatRest(Math.round(diff)) }) : under ? _('progress.shorter_than_target') : _('progress.on_target') })}
                      </T>
                    </View>
                  </View>
                );
              })
            )}
          </Card>
        </Animated.View>

        {/* Egzersizler */}
        <Animated.View entering={FadeInDown.delay(160).duration(350)}>
          <SectionHeader title={_('progress.strength_estimated_1rm')} />
          {top.length === 0 ? (
            <Card>
              <EmptyState icon="progress" title={_('progress.collecting_data')} text={_('progress.your_strength_charts_will_appear')} />
            </Card>
          ) : (
            <Card padded={false}>
              {top.map((e, i) => (
                <PressableScale
                  key={e.id}
                  onPress={() => router.push(`/exercise/${e.id}`)}
                  scaleTo={0.98}
                  style={[styles.exRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border }]}>
                  <MuscleIcon muscle={e.muscle} size={38} />
                  <View style={{ flex: 1 }}>
                    <T variant="heading" style={{ fontSize: 15 }}>
                      {e.name}
                    </T>
                    <T variant="caption" secondary>
                      {_('progress.sessions', { count: e.sessions })}</T>
                  </View>
                  <T variant="num" style={{ fontSize: 18 }} color={t.primary}>
                    {formatWeight(Math.round(e.best1rm * 2) / 2)}
                    <T variant="caption" secondary>
                      {_('progress.kg')}</T>
                  </T>
                  <Icon name="chevronRight" size={13} color={t.textMuted} />
                </PressableScale>
              ))}
            </Card>
          )}
        </Animated.View>

        {/* Vücut ağırlığı */}
        <Animated.View entering={FadeInDown.delay(200).duration(350)}>
          <SectionHeader title={_('progress.body_weight')} />
          <Card>
            {bodies.length > 1 ? (
              <LineChart
                values={bodies.map((b) => b.weight)}
                labels={bodies.map((b) => formatDate(b.measured_at))}
                formatValue={(v) => `${formatWeight(v)} kg`}
                height={130}
              />
            ) : bodies.length === 1 ? (
              <T variant="num" color={t.primary}>
                {_('common.kg2', { v: formatWeight(bodies[0].weight) })}</T>
            ) : (
              <T secondary>{_('progress.log_your_weight_regularly_and')}</T>
            )}
            <View style={styles.bwRow}>
              <Input
                value={bw}
                onChangeText={setBw}
                placeholder={_('progress.today_s_weight')}
                placeholderTextColor={t.textMuted}
                keyboardType="decimal-pad"
                style={[styles.bwInput, { backgroundColor: t.surfaceRaised, color: t.text }]}
                onSubmitEditing={saveBw}
              />
              <PressableScale onPress={saveBw} style={[styles.bwBtn, { backgroundColor: t.primary, width: f(48), height: f(48), borderRadius: f(24) }]}>
                <Icon name="add" size={18} color={t.onPrimary} />
              </PressableScale>
            </View>
          </Card>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  muscleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
  track: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  band: { position: 'absolute', left: '50%', width: '50%', top: 0, bottom: 0, borderLeftWidth: 1 },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 8 },
  restRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg },
  restTrack: { height: 6, borderRadius: 3, overflow: 'visible' },
  restTarget: { position: 'absolute', top: -3, width: 2, height: 12, borderRadius: 1 },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  bwRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  bwInput: { flex: 1, height: 48, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, fontSize: 16, fontFamily: Font.medium },
  bwBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
