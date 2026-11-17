import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BodyMap } from '@/components/body-map';
import { Icon, type IconName } from '@/components/icon';
import { askRoutineName } from '@/components/routine-name-sheet';
import { useSheet } from '@/components/sheet';
import { PressableScale, T } from '@/components/ui';
import { Font, Radius, Spacing } from '@/constants/theme';
import { applyWorkoutToRoutine, cardioPrDetails, createRoutineFromWorkout, getRoutineDiff, getWorkoutSummary } from '@/db/queries';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration, formatMinutes, formatWeight } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { formatKm, formatMin } from '@/lib/cardio';
import { formatRest } from '@/lib/rest';
import { goHome } from '@/lib/nav';

const CHEERS = ['Harikaydın! 🌊', 'Dalga gibi geldin! 🌊', 'Bugün de kazandın! 💪', 'Okyanus kadar güçlü! 🐋'];

export default function Summary() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useDbQuery(async (db) => {
    const s = await getWorkoutSummary(db, Number(id));
    return s ? { ...s, cardioPrs: await cardioPrDetails(db, Number(id)), routineDiff: await getRoutineDiff(db, Number(id)) } : null;
  }, [id]);
  const db = useSQLiteContext();
  const sheet = useSheet();
  const [savedRoutine, setSavedRoutine] = useState<string | null>(null);
  const [updatedRoutine, setUpdatedRoutine] = useState<string | null>(null);

  const saveAsRoutine = () => {
    if (!data) return;
    askRoutineName(sheet, {
      title: 'Rutin olarak kaydet',
      initial: data.name === 'Serbest Antrenman' ? '' : data.name,
      onSubmit: async (name) => {
        const rid = await createRoutineFromWorkout(db, data.workoutId, name);
        if (rid == null) {
          haptic.warning();
          sheet.actions({ title: 'Rutin oluşturulamadı', message: 'Bu antrenmanda tamamlanmış çalışma seti yok.', actions: [], cancelLabel: 'Tamam' });
          return;
        }
        haptic.success();
        setSavedRoutine(name);
      },
    });
  };

  const diff = data?.routineDiff?.changed ? data.routineDiff : null;
  const updateRoutine = () => {
    if (!diff || !data) return;
    sheet.actions({
      title: `"${diff.routineName}" güncellensin mi?`,
      message: `Bu antrenmandaki yapı rutine yazılır (egzersiz sırası, çalışma seti sayısı, tekrar aralığı):\n${diff.lines.join('\n')}`,
      cancelLabel: 'Şimdi değil',
      actions: [
        {
          label: 'Değişiklikleri rutine kaydet',
          icon: 'check',
          style: 'primary',
          onPress: async () => {
            const rid = await applyWorkoutToRoutine(db, data.workoutId);
            if (rid == null) {
              haptic.warning();
              return;
            }
            haptic.success();
            setUpdatedRoutine(diff.routineName);
          },
        },
      ],
    });
  };

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
            <Box icon="trophy" label="Rekor" value={String(data.prs.length)} />
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

          {data.cardio.sets > 0 && (
            <Animated.View entering={FadeInDown.delay(290)} style={[styles.panel, { backgroundColor: t.surface, borderColor: t.border }]}>
              <Icon name="flame" size={18} color={t.primary} />
              <View style={{ flex: 1 }}>
                <T variant="heading">Kardiyo {formatMin(data.cardio.minutes)}</T>
                <T variant="caption" secondary>
                  {data.cardio.km > 0 ? `${formatKm(data.cardio.km * 1000)} km · ` : ''}
                  {data.cardio.sets} set
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
              {data.prs
                .filter((p) => p.kind !== 'cardio' && p.kind !== 'timed')
                .slice(0, 5)
                .map((p, i) => (
                  <T key={i}>
                    {p.name} — {formatWeight(p.weight)} kg × {p.reps}
                  </T>
                ))}
              {data.cardioPrs.map((p, i) => (
                <T key={`c${i}`}>
                  {p.name} — {p.texts.join(' · ')}
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
          {diff && !updatedRoutine && (
            <PressableScale onPress={updateRoutine} accessibilityLabel="Değişiklikleri rutine kaydet" style={[styles.diffBtn, { backgroundColor: t.primarySoft }]}>
              <Icon name="edit" size={16} color={t.primary} />
              <View style={{ flex: 1 }}>
                <T variant="label" color={t.primary} style={{ fontFamily: Font.bold }}>
                  Değişiklikleri rutine kaydet
                </T>
                <T variant="caption" secondary numberOfLines={1}>
                  {diff.lines.join(' · ')}
                </T>
              </View>
            </PressableScale>
          )}
          {updatedRoutine && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14 }}>
              <Icon name="check" size={16} color={t.success} />
              <T variant="label" color={t.success}>
                {`“${updatedRoutine}” rutini güncellendi`}
              </T>
            </View>
          )}
          {savedRoutine ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14 }}>
              <Icon name="check" size={16} color={t.success} />
              <T variant="label" color={t.success}>
                {`“${savedRoutine}” rutini kaydedildi`}
              </T>
            </View>
          ) : (
            <PressableScale onPress={saveAsRoutine} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14 }}>
              <Icon name="routines" size={16} color={t.primary} />
              <T variant="label" color={t.primary}>
                Rutin olarak kaydet
              </T>
            </PressableScale>
          )}
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
  diffBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.md, marginBottom: Spacing.sm },
  cta: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
});
