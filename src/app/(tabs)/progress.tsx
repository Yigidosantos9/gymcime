import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BodyMap, HeatLegend, MuscleIcon } from '@/components/body-map';
import { BarChart, LineChart } from '@/components/charts';
import { HomeBack } from '@/components/tab-back';
import { Icon } from '@/components/icon';
import { Badge, Card, Chip, EmptyState, IconButton, PressableScale, ScreenHeader, SectionHeader, T } from '@/components/ui';
import { Font, Radius, Spacing } from '@/constants/theme';
import { addBodyWeight, weeklyCardio, getProfile, listBodyWeights, muscleLastTrained, muscleSets, restStats, topExercises, weeklyVolume } from '@/db/queries';
import { MUSCLES } from '@/db/seed';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatDuration, formatWeight, parseNumber } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { computeRecovery, fatigueValues, restLabel } from '@/lib/recovery';
import { formatMin } from '@/lib/cardio';
import { formatRest } from '@/lib/rest';

type Range = 7 | 28;

export default function Progress() {
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
        <ScreenHeader title="İlerleme" right={<IconButton icon="settings" onPress={() => router.push('/settings')} color={t.textSecondary} />} />

        {/* Haftalık çalışma seti */}
        <Animated.View entering={FadeInDown.duration(350)}>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ gap: 2 }}>
                <T variant="overline" secondary>
                  Bu hafta çalışma seti
                </T>
                <T variant="numLarge" style={{ fontSize: 36, lineHeight: 42 }}>
                  {thisWeek.sets}
                </T>
                {thisWeek.sets === 0 && lastWeek?.sets ? (
                  <T variant="caption" muted>
                    Geçen hafta {lastWeek.sets} set — hadi geçelim 🌊
                  </T>
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
            <SectionHeader title="Kardiyo" />
            <Card>
              <View style={{ flexDirection: 'row', gap: Spacing.xl }}>
                <View>
                  <T variant="overline" secondary>
                    Bu hafta
                  </T>
                  <T variant="numLarge" style={{ fontSize: 30, lineHeight: 36 }}>
                    {formatMin(cardioWeeks[cardioWeeks.length - 1].minutes)}
                  </T>
                </View>
                {cardioWeeks[cardioWeeks.length - 1].km > 0 && (
                  <View>
                    <T variant="overline" secondary>
                      Mesafe
                    </T>
                    <T variant="numLarge" style={{ fontSize: 30, lineHeight: 36 }}>
                      {String(Math.round(cardioWeeks[cardioWeeks.length - 1].km * 10) / 10).replace('.', ',')} km
                    </T>
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
          <SectionHeader title="Kas dengesi" />
          <Card>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: Spacing.lg }}>
              <Chip label="Son 7 gün" active={range === 7} onPress={() => setRange(7)} />
              <Chip label="Son 4 hafta" active={range === 28} onPress={() => setRange(28)} />
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
                    <T variant="label" style={{ width: 62 }}>
                      {m}
                    </T>
                    <View style={[styles.track, { backgroundColor: t.surfacePressed }]}>
                      <View style={[styles.band, { backgroundColor: t.successSoft, borderColor: t.success }]} />
                      <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: 5, backgroundColor: color }} />
                    </View>
                    <T variant="label" color={color} style={{ width: 30, textAlign: 'right', fontFamily: Font.bold }}>
                      {Math.round(sets)}
                    </T>
                  </View>
                );
              })}
            </View>
            <T variant="caption" muted style={{ marginTop: Spacing.sm }}>
              Haftalık set · yeşil bant 10–20 set: kas büyümesi için önerilen aralık
            </T>
          </Card>
        </Animated.View>

        {/* Kas toparlanması */}
        <Animated.View entering={FadeInDown.delay(100).duration(350)}>
          <SectionHeader title={`Kas toparlanması · önerilen ${recoveryDays} gün`} />
          <Card>
            <BodyMap values={fatigueValues(recovery, recoveryDays)} size={180} />
            <T variant="caption" muted style={{ textAlign: 'center', marginTop: Spacing.sm }}>
              Renkli bölgeler henüz dinleniyor · koyu bölgeler hazır
            </T>
            <View style={{ marginTop: Spacing.md }}>
              {recovery.map((r, i) => {
                const color = r.daysRested == null ? t.textMuted : r.ready ? t.success : t.gold;
                return (
                  <View key={r.muscle} style={[styles.recRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border }]}>
                    <MuscleIcon muscle={r.muscle} size={28} />
                    <View style={{ flex: 1 }}>
                      <T variant="label">{r.muscle}</T>
                      <T variant="caption" muted>
                        {restLabel(r)}
                        {r.lastSets ? ` · son seferde ${r.lastSets} set` : ''}
                      </T>
                    </View>
                    <Badge
                      label={r.daysRested == null ? '—' : r.ready ? 'Hazır' : `${r.remaining} gün daha`}
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
          <SectionHeader title="Mola disiplini · son 4 hafta" />
          <Card padded={rests.length === 0}>
            {rests.length === 0 ? (
              <T secondary>Setleri tamamladıkça gerçek dinlenme sürelerin burada analiz edilecek.</T>
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
                      <T variant="caption" muted>
                        Hedef {formatRest(r.avg_target)} · {over ? `ortalama ${formatRest(Math.round(diff))} fazla` : under ? 'hedeften kısa' : 'hedefte 👌'}
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
          <SectionHeader title="Güç · tahmini 1RM" />
          {top.length === 0 ? (
            <Card>
              <EmptyState icon="progress" title="Veri birikiyor" text="Birkaç antrenmandan sonra güç grafiklerin burada belirecek." />
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
                      {e.sessions} seans
                    </T>
                  </View>
                  <T variant="num" style={{ fontSize: 18 }} color={t.primary}>
                    {formatWeight(Math.round(e.best1rm * 2) / 2)}
                    <T variant="caption" secondary>
                      {' '}kg
                    </T>
                  </T>
                  <Icon name="chevronRight" size={13} color={t.textMuted} />
                </PressableScale>
              ))}
            </Card>
          )}
        </Animated.View>

        {/* Vücut ağırlığı */}
        <Animated.View entering={FadeInDown.delay(200).duration(350)}>
          <SectionHeader title="Vücut ağırlığı" />
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
                {formatWeight(bodies[0].weight)} kg
              </T>
            ) : (
              <T secondary>Ağırlığını düzenli kaydet, trendini burada gör.</T>
            )}
            <View style={styles.bwRow}>
              <TextInput
                value={bw}
                onChangeText={setBw}
                placeholder="Bugünkü kilon"
                placeholderTextColor={t.textMuted}
                keyboardType="decimal-pad"
                style={[styles.bwInput, { backgroundColor: t.surfaceRaised, color: t.text }]}
                onSubmitEditing={saveBw}
              />
              <PressableScale onPress={saveBw} style={[styles.bwBtn, { backgroundColor: t.primary }]}>
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
