import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MuscleIcon } from '@/components/body-map';
import { Icon } from '@/components/icon';
import { useSheet } from '@/components/sheet';
import { HomeBack } from '@/components/tab-back';
import { Badge, Button, Card, EmptyState, PressableScale, ScreenHeader, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { listRoutines } from '@/db/queries';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { formatDayLong } from '@/lib/format';
import { beginWorkout } from '@/lib/start-workout';

export default function Routines() {
  const t = useTheme();
  const sheet = useSheet();
  const { data: routines, db } = useDbQuery(listRoutines);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.background }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <HomeBack />
        <ScreenHeader subtitle={routines ? `${routines.length} rutin` : undefined} title="Rutinler" />

        <Button title="Yeni rutin oluştur" icon="add" onPress={() => router.push('/routine/new')} style={{ marginBottom: Spacing.sm }} />
        <Button title="Egzersiz kütüphanesi" icon="search" kind="secondary" onPress={() => router.push('/exercises')} style={{ marginBottom: Spacing.lg }} />

        {routines && routines.length === 0 && (
          <Card>
            <EmptyState icon="routines" title="Henüz rutin yok" text={'Örneğin “Sırt günü” veya “Göğüs + Triceps” oluştur; ya da bitirdiğin bir antrenmanı özet ekranından rutin olarak kaydet.'} />
          </Card>
        )}

        {routines?.map((r, i) => {
          const muscles = r.muscles?.split(',') ?? [];
          return (
            <Animated.View key={r.id} entering={FadeInDown.delay(i * 50).duration(350)}>
              <PressableScale onPress={() => router.push(`/routine/${r.id}`)} scaleTo={0.98}>
                <Card style={{ marginBottom: Spacing.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <T variant="heading" style={{ fontSize: 18 }}>
                        {r.name}
                      </T>
                      <T variant="caption" secondary>
                        {r.exercise_count} egzersiz · {r.last_done ? `son ${formatDayLong(r.last_done).toLocaleLowerCase('tr-TR')}` : 'henüz yapılmadı'}
                      </T>
                    </View>
                    <PressableScale onPress={() => beginWorkout(db, r.id, sheet)} style={[styles.play, { backgroundColor: t.primary, shadowColor: t.primary }]}>
                      <Icon name="play" size={16} color={t.onPrimary} />
                    </PressableScale>
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
                </Card>
              </PressableScale>
            </Animated.View>
          );
        })}

        <Button title="Boş antrenman başlat" icon="bolt" kind="secondary" onPress={() => beginWorkout(db, null, sheet)} style={{ marginTop: Spacing.sm }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  play: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  muscles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.md, alignItems: 'center' },
});
