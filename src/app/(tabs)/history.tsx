import { router } from 'expo-router';
import { useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { formatMin } from '@/lib/cardio';
import { HomeBack } from '@/components/tab-back';
import { Badge, Card, EmptyState, PressableScale, ScreenHeader, T } from '@/components/ui';
import { Font, Radius, Spacing } from '@/constants/theme';
import { listWorkouts, type WorkoutListItem } from '@/db/queries';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { formatMinutes, startOfDay } from '@/lib/format';

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
  date: { width: 46, height: 52, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', gap: Spacing.md, marginTop: 4 },
});
