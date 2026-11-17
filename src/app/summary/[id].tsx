import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BodyMap } from '@/components/body-map';
import { Icon, type IconName } from '@/components/icon';
import { PressableScale, T } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { getWorkoutSummary } from '@/db/queries';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration, formatMinutes, formatVolume, formatWeight } from '@/lib/format';
import { formatRest } from '@/lib/rest';
import { goHome } from '@/lib/nav';

const CHEERS = ['Harikaydın! 🌊', 'Dalga gibi geldin! 🌊', 'Bugün de kazandın! 💪', 'Okyanus kadar güçlü! 🐋'];

export default function Summary() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useDbQuery((db) => getWorkoutSummary(db, Number(id)), [id]);

  if (!data) return <View style={{ flex: 1, backgroundColor: t.background }} />;

  const cheer = CHEERS[data.workoutNumber % CHEERS.length];
  const maxSets = Math.max(1, ...data.muscles.map((m) => m.sets));
  const heat = Object.fromEntries(data.muscles.map((m) => [m.muscle, m.sets / maxSets]));

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <LinearGradient colors={[t.primarySoft, 'transparent']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: Spacing.xl, gap: Spacing.lg }}>
          <Animated.View entering={ZoomIn.springify().damping(12)} style={[styles.badge, { backgroundColor: t.goldSoft, borderColor: t.gold }]}>
            <Icon name="trophy" size={40} color={t.gold} />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(120)}>
            <T variant="display" style={{ textAlign: 'center' }}>
              {cheer}
            </T>
            <T secondary style={{ textAlign: 'center', marginTop: 6 }}>
              {data.workoutNumber}. antrenmanın · {data.name}
            </T>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200)} style={styles.statsRow}>
            <Box icon="clock" label="Süre" value={formatMinutes(data.durationMs)} />
            <Box icon="layers" label="Set" value={String(data.setCount)} />
            <Box icon="barbell" label="Hacim" value={formatVolume(data.volume)} />
          </Animated.View>

          {data.restAvgTaken != null && data.restAvgTarget != null && (
            <Animated.View entering={FadeInDown.delay(260)} style={[styles.panel, { backgroundColor: t.surface, borderColor: t.border }]}>
              <Icon name="timer" size={18} color={t.primary} />
              <View style={{ flex: 1 }}>
                <T variant="heading">Ortalama mola {formatDuration(data.restAvgTaken * 1000)}</T>
                <T variant="caption" secondary>
                  Hedefin {formatRest(data.restAvgTarget)}
                  {data.restAvgTaken > data.restAvgTarget + 30 ? ' · biraz uzun tuttun, bir sonrakinde sıkılaştır' : ' · disiplinliydin 👌'}
                </T>
              </View>
            </Animated.View>
          )}

          {data.muscles.length > 0 && (
            <Animated.View entering={FadeInDown.delay(320)} style={[styles.panelCol, { backgroundColor: t.surface, borderColor: t.border }]}>
              <T variant="overline" secondary>
                Bugün çalışan kaslar
              </T>
              <BodyMap values={heat} size={170} labels={false} />
            </Animated.View>
          )}

          {data.prs.length > 0 && (
            <Animated.View entering={FadeInDown.delay(380)} style={[styles.panelCol, { backgroundColor: t.goldSoft, borderColor: t.gold }]}>
              <T variant="heading" color={t.gold}>
                🏆 {data.prs.length} yeni kişisel rekor
              </T>
              {data.prs.slice(0, 5).map((p, i) => (
                <T key={i}>
                  {p.name} — {formatWeight(p.weight)} kg × {p.reps}
                </T>
              ))}
            </Animated.View>
          )}
        </ScrollView>

        <View style={{ padding: Spacing.xl, paddingTop: 0 }}>
          <PressableScale onPress={goHome} style={[styles.cta, { backgroundColor: t.primary }]}>
            <T variant="heading" color={t.onPrimary}>
              Harika, devam!
            </T>
          </PressableScale>
          <PressableScale onPress={() => {
              // Modalın yerine açmak yerine önce kapat, sonra normal sayfa olarak aç (geri tuşu olsun)
              goHome();
              router.push(`/session/${data.workoutId}`);
            }} style={{ alignItems: 'center', padding: 14 }}>
            <T variant="label" secondary>
              Detayları gör
            </T>
          </PressableScale>
        </View>
      </SafeAreaView>
    </View>
  );
}

function Box({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={[styles.box, { backgroundColor: t.surface, borderColor: t.border }]}>
      <Icon name={icon} size={16} color={t.primary} />
      <T variant="num" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {value}
      </T>
      <T variant="caption" secondary>
        {label}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'center',
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    marginTop: Spacing.xl,
  },
  statsRow: { flexDirection: 'row', gap: Spacing.md },
  box: { flex: 1, borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center', gap: 4, borderWidth: StyleSheet.hairlineWidth },
  panel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth },
  panelCol: { gap: Spacing.sm, padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth },
  cta: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
});
