import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { askRoutineName } from '@/components/routine-name-sheet';
import { useSheet } from '@/components/sheet';
import { Badge, Button, Card, IconButton, PressableScale, SectionHeader, T } from '@/components/ui';
import { Font, Radius, Spacing } from '@/constants/theme';
import {
  applyWeekAssignments,
  clearWeekPlan,
  ensureTemplateRoutines,
  getProfile,
  getWeekPlan,
  listRoutines,
  setWeekPlanNote,
  setWeekPlanRoutine,
  type RoutineSummary,
  type WeekPlanDay,
} from '@/db/queries';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';
import { syncReminders } from '@/lib/reminder-io';
import { muscleFrequency, recoveryConflicts, templateAssignments, WEEK_TEMPLATES, WEEKDAY_NAMES, WEEKDAY_SHORT, weekdayOf, type WeekTemplate } from '@/lib/week-plan';

export default function WeekPlan() {
  const t = useTheme();
  const sheet = useSheet();
  const [now] = useState(() => Date.now());
  const { data, db, reload } = useDbQuery(async (db) => {
    const [plan, routines, profile] = await Promise.all([getWeekPlan(db), listRoutines(db), getProfile(db)]);
    return { plan, routines, recoveryDays: profile?.recoveryDays ?? 2 };
  });
  if (!data) return <View style={{ flex: 1, backgroundColor: t.background }} />;
  const { plan, routines, recoveryDays } = data;
  const today = weekdayOf(now);

  const changed = async () => {
    await reload();
    syncReminders(db); // bildirimler plana göre yeniden kurulur
  };

  const trainingDays = plan.filter((d) => d.routine_id != null).length;
  const dayMuscles = plan.map((d) => d.muscles);
  const freq = muscleFrequency(dayMuscles);
  const conflicts = recoveryConflicts(dayMuscles, recoveryDays);

  const pickRoutine = (d: WeekPlanDay) =>
    sheet.custom({
      title: `${WEEKDAY_NAMES[d.weekday]} · rutin seç`,
      render: (close) => (
        <View style={{ gap: Spacing.sm }}>
          <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
            {routines.length === 0 && (
              <T secondary style={{ textAlign: 'center', paddingVertical: Spacing.sm }}>
                Henüz rutin yok. Aşağıdan oluştur ya da bir şablon uygula.
              </T>
            )}
            {routines.map((r: RoutineSummary) => {
              const on = d.routine_id === r.id;
              return (
                <PressableScale
                  key={r.id}
                  onPress={async () => {
                    await close();
                    await setWeekPlanRoutine(db, d.weekday, r.id);
                    haptic.success();
                    changed();
                  }}
                  style={[styles.pickRow, { backgroundColor: on ? t.primarySoft : t.surfacePressed }]}>
                  <Icon name="barbell" size={16} color={t.primary} />
                  <View style={{ flex: 1 }}>
                    <T variant="heading" numberOfLines={1}>
                      {r.name}
                    </T>
                    <T variant="caption" secondary numberOfLines={1}>
                      {r.exercise_count} egzersiz{r.muscles ? ` · ${r.muscles.split(',').slice(0, 3).join(', ')}` : ''}
                    </T>
                  </View>
                  {on && <Icon name="check" size={16} color={t.primary} />}
                </PressableScale>
              );
            })}
          </ScrollView>
          <PressableScale
            onPress={async () => {
              await close();
              await setWeekPlanRoutine(db, d.weekday, null);
              changed();
            }}
            style={[styles.pickRow, { backgroundColor: t.surfacePressed, justifyContent: 'center' }]}>
            <Icon name="moon" size={16} color={t.text} />
            <T variant="heading">Dinlenme günü</T>
          </PressableScale>
          <PressableScale
            onPress={async () => {
              await close();
              router.push('/routine/new');
            }}
            style={[styles.pickRow, { backgroundColor: t.primarySoft, justifyContent: 'center' }]}>
            <Icon name="add" size={16} color={t.primary} />
            <T variant="heading" color={t.primary}>
              Yeni rutin oluştur
            </T>
          </PressableScale>
        </View>
      ),
    });

  const editNote = (d: WeekPlanDay) =>
    askRoutineName(sheet, {
      title: `${WEEKDAY_NAMES[d.weekday]} notu`,
      initial: d.note ?? '',
      placeholder: 'Örn. Sabah, 45 dk',
      hint: 'Kısa bir not; boş bırakıp kaydedersen silinir.',
      allowEmpty: true,
      onSubmit: async (text) => {
        await setWeekPlanNote(db, d.weekday, text);
        changed();
      },
    });

  const applyTemplate = (tpl: WeekTemplate) =>
    sheet.actions({
      title: `${tpl.label} uygulansın mı?`,
      message: `${tpl.hint}. Mevcut gün atamaların değişir; şablon rutinleri yoksa oluşturulur (varsa aynı adlı rutin kullanılır). Gün notların korunur.`,
      actions: [
        {
          label: 'Şablonu uygula',
          icon: 'check',
          style: 'primary',
          onPress: async () => {
            const ids = await ensureTemplateRoutines(db, tpl.source);
            await applyWeekAssignments(db, templateAssignments(tpl, ids));
            haptic.success();
            changed();
          },
        },
      ],
    });

  const clearAll = () =>
    sheet.actions({
      title: 'Plan temizlensin mi?',
      message: 'Tüm günler dinlenme günü olur. Rutinlerin silinmez.',
      actions: [
        {
          label: 'Planı temizle',
          icon: 'trash',
          style: 'destructive',
          onPress: async () => {
            await clearWeekPlan(db);
            changed();
          },
        },
      ],
    });

  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeInDown.duration(300)}>
        <Card style={{ gap: Spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <T variant="num">{trainingDays}</T>
            <T variant="label" secondary>
              antrenman günü · {7 - trainingDays} dinlenme
            </T>
          </View>
          {freq.length > 0 && (
            <View style={styles.wrap}>
              {freq.map((f) => (
                <Badge key={f.muscle} label={`${f.muscle} ${f.days}×`} tint={f.days > 3 ? t.gold : t.primary} bg={f.days > 3 ? t.goldSoft : t.primarySoft} />
              ))}
            </View>
          )}
          {conflicts.length > 0 ? (
            <View style={{ gap: 4 }}>
              {conflicts.map((c, i) => (
                <View key={i} style={[styles.warn, { backgroundColor: t.goldSoft }]}>
                  <Icon name="warning" size={13} color={t.gold} />
                  <T variant="caption" color={t.gold} style={{ flex: 1, fontFamily: Font.bold }}>
                    {c.muscle}: {WEEKDAY_SHORT[c.days[0]]} ve {WEEKDAY_SHORT[c.days[1]]} {c.gap === 1 ? 'art arda' : `arası ${c.gap} gün`} (önerilen dinlenme {recoveryDays} gün)
                  </T>
                </View>
              ))}
            </View>
          ) : (
            trainingDays > 0 && (
              <T variant="caption" color={t.success}>
                Toparlanma çakışması yok.
              </T>
            )
          )}
        </Card>
      </Animated.View>

      <SectionHeader title="Günler" />
      {plan.map((d, i) => (
        <Animated.View key={d.weekday} entering={FadeInDown.delay(i * 35).duration(300)}>
          <PressableScale onPress={() => pickRoutine(d)} scaleTo={0.985} accessibilityLabel={`${WEEKDAY_NAMES[d.weekday]}, ${d.routine_name ?? 'dinlenme günü'}. Rutin seç`}>
            <Card style={[styles.dayCard, d.weekday === today && { borderColor: t.primary, borderWidth: 1.5 }]}>
              <View style={[styles.dayBadge, { backgroundColor: d.routine_id ? t.primarySoft : t.surfaceRaised }]}>
                <T variant="heading" color={d.routine_id ? t.primary : t.textMuted} style={{ fontSize: 14 }}>
                  {WEEKDAY_SHORT[d.weekday]}
                </T>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <T variant="heading" color={d.routine_id ? t.text : t.textMuted} numberOfLines={1} style={{ flexShrink: 1 }}>
                    {d.routine_name ?? 'Dinlenme günü'}
                  </T>
                  {d.weekday === today && <Badge label="Bugün" tint={t.primary} bg={t.primarySoft} />}
                </View>
                {d.routine_id != null && d.muscles.length > 0 && (
                  <T variant="caption" secondary numberOfLines={1}>
                    {d.muscles.join(' · ')}
                  </T>
                )}
                {d.note && (
                  <T variant="caption" muted numberOfLines={1}>
                    {d.note}
                  </T>
                )}
              </View>
              <IconButton icon="edit" label={`${WEEKDAY_NAMES[d.weekday]} notunu düzenle`} onPress={() => editNote(d)} bg="transparent" color={t.textSecondary} size={14} />
            </Card>
          </PressableScale>
        </Animated.View>
      ))}

      <SectionHeader title="Hızlı şablonlar" />
      <View style={{ gap: Spacing.sm }}>
        {WEEK_TEMPLATES.map((tpl) => (
          <PressableScale key={tpl.key} onPress={() => applyTemplate(tpl)} scaleTo={0.98}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
              <View style={{ flex: 1 }}>
                <T variant="heading">{tpl.label}</T>
                <T variant="caption" secondary>
                  {tpl.hint}
                </T>
              </View>
              <Icon name="chevronRight" size={14} color={t.textMuted} />
            </Card>
          </PressableScale>
        ))}
      </View>

      <Button title="Planı temizle" kind="ghost" icon="trash" onPress={clearAll} disabled={trainingDays === 0 && plan.every((d) => !d.note)} style={{ marginTop: Spacing.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  warn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: Radius.sm },
  dayCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm, paddingVertical: Spacing.md },
  dayBadge: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.md, minHeight: 54 },
});
