import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { useSheet } from '@/components/sheet';
import { HomeBack } from '@/components/tab-back';
import { Card, Divider, IconButton, PressableScale, Ring, ScreenHeader, SectionHeader, T } from '@/components/ui';
import { Font, Radius, Spacing } from '@/constants/theme';
import {
  addFoodLog,
  dayTotalsRange,
  deleteFoodLog,
  favoriteFoods,
  getNutritionProfile,
  hasWorkoutBetween,
  latestBodyWeight,
  listFoodLogs,
  recentFoods,
  type Food,
  type FoodLog,
} from '@/db/nutrition-queries';
import { listBodyWeights } from '@/db/queries';
import { useDbQuery } from '@/hooks/use-db-query';
import { useScale, useTheme } from '@/hooks/use-theme';
import { formatWeight } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import {
  calorieTarget,
  dayKey,
  dayKeyToTs,
  defaultMeal,
  expectedWeeklyChange,
  macrosFor,
  MEALS,
  shiftDay,
  sumMacros,
  trainingDayMacros,
  weightTrendPerWeek,
  type Macros,
} from '@/lib/nutrition';
import { displayFoodName, displayServing } from '@/lib/food-search';
import { useT } from '@/components/language-provider';
import { getLanguage, localeData, t as tt, decimalSep } from '@/i18n';
import { mealLabel } from '@/i18n/labels';

const fmt = (n: number) => String(n).replace('.', decimalSep());
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmt(Math.abs(n))}`;

function dayLabel(key: string) {
  const today = dayKey(Date.now());
  if (key === today) return tt('common.today');
  if (key === shiftDay(today, -1)) return tt('nutrition.yesterday');
  if (key === shiftDay(today, 1)) return tt('nutrition.tomorrow');
  const d = new Date(dayKeyToTs(key));
  const m = localeData().months[d.getMonth()];
  return getLanguage() === 'en' ? `${m} ${d.getDate()}` : `${d.getDate()} ${m}`;
}

export default function Nutrition() {
  const { f } = useScale();
  const _ = useT();
  const t = useTheme();
  const sheet = useSheet();
  const [day, setDay] = useState(() => dayKey(Date.now()));
  const { data, db, reload } = useDbQuery(
    async (db) => {
      const ts = dayKeyToTs(day);
      const start = new Date(ts);
      start.setHours(0, 0, 0, 0);
      const [logs, profile, weight, week, training, quick, bodies] = await Promise.all([
        listFoodLogs(db, day),
        getNutritionProfile(db),
        latestBodyWeight(db),
        dayTotalsRange(db, shiftDay(day, -6), day),
        hasWorkoutBetween(db, start.getTime(), start.getTime() + 86_400_000),
        Promise.all([favoriteFoods(db), recentFoods(db, 8)]),
        listBodyWeights(db),
      ]);
      return { logs, profile, weight, week, training, quick: [...quick[0], ...quick[1]].slice(0, 8), bodies };
    },
    [day],
  );

  if (!data) return <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.background }} />;
  const { logs, profile, weight, week, training, quick, bodies } = data;

  // hedefler
  let base: { macros: Macros; tdee: number; reason: string | null; blocked: boolean } | null = null;
  if (profile && weight) {
    const input = { sex: profile.sex, age: profile.age, heightCm: profile.heightCm, weightKg: weight.weight, waistCm: profile.waistCm, neckCm: profile.neckCm, hipCm: profile.hipCm };
    const tgt = calorieTarget(input, profile.activity, profile.weeklyRateKg);
    base = { macros: macrosFor(tgt.kcal, input.weightKg, tgt.adjustment), tdee: tgt.tdee, reason: tgt.clampedReason, blocked: tgt.deficitBlocked };
  }
  const target = base ? (training ? trainingDayMacros(base.macros) : base.macros) : null;
  const eaten = sumMacros(logs);
  const remaining = target ? target.kcal - eaten.kcal : null;
  const over = remaining != null && remaining < 0;

  const quickAdd = async (f: Food) => {
    const meal = defaultMeal(new Date().getHours());
    await addFoodLog(db, { day, meal, name: f.name, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, serving: f.serving });
    haptic.success();
    reload();
  };

  const openLog = (l: FoodLog) =>
    sheet.actions({
      title: displayFoodName(l.name),
      message: _('nutrition.kcal', { v: Math.round(l.kcal), v2: l.serving ? ` · ${displayServing(l.serving)}` : '', v3: l.source === 'ai' ? _('nutrition.ai_estimate') : '' }),
      actions: [
        {
          label: _('common.delete'),
          icon: 'trash',
          style: 'destructive',
          onPress: async () => {
            await deleteFoodLog(db, l.id);
            reload();
          },
        },
      ],
    });

  // haftalık
  const logged = week.filter((d) => d.kcal > 0);
  const avg = logged.length ? Math.round(logged.reduce((a, d) => a + d.kcal, 0) / logged.length) : null;
  const trend = weightTrendPerWeek(bodies.map((b) => ({ ts: b.measured_at, kg: b.weight })));
  const expected = avg != null && base ? expectedWeeklyChange(avg, base.tdee) : null;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.background }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <HomeBack />
        <ScreenHeader
          title={_('common.nutrition')}
          subtitle={localeData().days[new Date(dayKeyToTs(day)).getDay()]}
          right={<IconButton icon="body" onPress={() => router.push('/body')} />}
        />

        <View style={styles.dayNav}>
          <IconButton icon="chevronLeft" size={14} onPress={() => setDay(shiftDay(day, -1))} />
          <PressableScale onPress={() => setDay(dayKey(Date.now()))} hapticOnPress={false} style={{ flex: 1, alignItems: 'center' }}>
            <T variant="heading">{dayLabel(day)}</T>
          </PressableScale>
          <IconButton icon="chevronRight" size={14} onPress={() => setDay(shiftDay(day, 1))} />
        </View>

        {!target && (
          <PressableScale onPress={() => router.push('/body')} style={{ marginBottom: Spacing.lg }}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }} raised>
              <View style={[styles.iconBox, { backgroundColor: t.primarySoft, width: f(44), height: f(44), borderRadius: f(22) }]}>
                <Icon name="target" size={20} color={t.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <T variant="heading">{_('nutrition.set_your_target')}</T>
                <T variant="caption" secondary>{_('nutrition.enter_your_height_age_and')}</T>
              </View>
              <Icon name="chevronRight" size={14} color={t.textMuted} />
            </Card>
          </PressableScale>
        )}

        <Animated.View entering={FadeInDown.duration(300)}>
          <Card style={{ gap: Spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.lg }}>
              <Ring progress={target ? eaten.kcal / target.kcal : 0} size={120} stroke={11} color={over ? t.danger : t.primary}>
                <T variant="num">{Math.round(eaten.kcal)}</T>
                <T variant="caption" secondary>
                  {target ? _('nutrition.kcal2', { kcal: target.kcal }) : _('common.kcal')}
                </T>
              </Ring>
              <View style={{ flex: 1, gap: 4 }}>
                {remaining != null ? (
                  <>
                    <T variant="caption" secondary>
                      {over ? _('nutrition.over_target') : _('nutrition.remaining')}
                    </T>
                    <T variant="title" color={over ? t.danger : t.text}>
                      {Math.abs(Math.round(remaining))}
                      <T variant="label" secondary>
                        {_('nutrition.kcal3')}</T>
                    </T>
                    {training && (
                      <T variant="caption" color={t.accent}>{_('nutrition.training_day_125_kcal')}</T>
                    )}
                  </>
                ) : (
                  <T secondary>{_('nutrition.complete_the_body_analysis_to')}</T>
                )}
              </View>
            </View>
            {base?.blocked && (
              <View style={[styles.warn, { backgroundColor: t.goldSoft }]}>
                <T variant="caption" color={t.gold}>{_('nutrition.a_deficit_can_t_be')}</T>
              </View>
            )}
            <View style={{ gap: 10 }}>
              <MacroBar label={_('common.protein')} value={eaten.protein} goal={target?.protein} color={t.primary} />
              <MacroBar label={_('nutrition.carbs')} value={eaten.carbs} goal={target?.carbs} color={t.accent} />
              <MacroBar label={_('common.fat')} value={eaten.fat} goal={target?.fat} color={t.gold} />
            </View>
          </Card>
        </Animated.View>

        {quick.length > 0 && (
          <>
            <SectionHeader title={_('nutrition.add_with_one_tap')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {quick.map((f) => (
                <PressableScale key={f.id} onPress={() => quickAdd(f)} style={[styles.quick, { backgroundColor: t.surface, borderColor: t.border }]}>
                  <T variant="label" numberOfLines={1} style={{ maxWidth: 150 }}>
                    {displayFoodName(f.name)}
                  </T>
                  <T variant="caption" secondary>
                    {_('nutrition.kcal4', { v: Math.round(f.kcal) })}</T>
                </PressableScale>
              ))}
            </ScrollView>
          </>
        )}

        {MEALS.map((m) => {
          const items = logs.filter((l) => l.meal === m);
          const kcal = items.reduce((a, l) => a + l.kcal, 0);
          return (
            <View key={m}>
              <SectionHeader title={`${mealLabel(m)}${items.length ? ` · ${Math.round(kcal)} kcal` : ''}`} action={_('nutrition.add_meal')} onAction={() => router.push({ pathname: '/food/add', params: { meal: m, day } })} />
              {items.length === 0 ? (
                <PressableScale onPress={() => router.push({ pathname: '/food/add', params: { meal: m, day } })}>
                  <View style={[styles.emptyMeal, { borderColor: t.border }]}>
                    <T variant="caption" muted>{_('nutrition.nothing_added_yet')}</T>
                  </View>
                </PressableScale>
              ) : (
                <Card padded={false}>
                  {items.map((l, i) => (
                    <View key={l.id}>
                      <PressableScale onPress={() => openLog(l)} scaleTo={0.99} hapticOnPress={false} style={styles.logRow}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <T variant="label" numberOfLines={1} style={{ flexShrink: 1 }}>
                              {displayFoodName(l.name)}
                            </T>
                            {l.source === 'ai' && <Icon name="sparkles" size={11} color={t.violet} />}
                          </View>
                          <T variant="caption" secondary>{_('nutrition.p_c_f', { v: Math.round(l.protein), v2: Math.round(l.carbs), v3: Math.round(l.fat), v4: l.serving ? ` · ${displayServing(l.serving)}` : '' })}
                          </T>
                        </View>
                        <T variant="label" style={{ fontFamily: Font.bold }}>
                          {Math.round(l.kcal)}
                        </T>
                      </PressableScale>
                      {i < items.length - 1 && <Divider />}
                    </View>
                  ))}
                </Card>
              )}
            </View>
          );
        })}

        <SectionHeader title={_('nutrition.weekly_view')} />
        <Card style={{ gap: Spacing.md }}>
          {avg == null ? (
            <T secondary>{_('nutrition.no_entries_in_the_last')}</T>
          ) : (
            <>
              <View style={{ flexDirection: 'row' }}>
                <Stat2 label={_('nutrition.average_intake')} value={`${avg}`} unit={_('nutrition.kcal_day')} />
                <Stat2 label={_('common.target')} value={target ? `${base!.macros.kcal}` : '–'} unit={_('common.kcal')} />
                <Stat2 label={_('nutrition.days_logged')} value={`${logged.length}/7`} />
              </View>
              <Divider />
              <View style={{ flexDirection: 'row' }}>
                <Stat2 label={_('nutrition.expected_change')} value={expected != null ? signed(expected) : '–'} unit={_('nutrition.kg_week')} />
                <Stat2 label={_('nutrition.weight_trend')} value={trend != null ? signed(trend) : '–'} unit={_('nutrition.kg_week')} />
                <Stat2 label={_('nutrition.latest_weight')} value={weight ? formatWeight(weight.weight) : '–'} unit={_('common.kg')} />
              </View>
              <T variant="caption" muted>
                {trend == null
                  ? _('nutrition.log_your_weight_regularly_for')
                  : expected != null && Math.abs(trend - expected) > 0.3
                    ? _('nutrition.the_trend_differs_from_what')
                    : _('nutrition.trend_and_intake_look_consistent')}
              </T>
            </>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function MacroBar({ label, value, goal, color }: { label: string; value: number; goal?: number; color: string }) {
  const _ = useT();
  const t = useTheme();
  const p = goal ? Math.min(1, value / goal) : 0;
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T variant="caption" secondary>
          {label}
        </T>
        <T variant="caption">
          {_('nutrition.g', { v: Math.round(value), v2: goal ? ` / ${goal}` : '' })}</T>
      </View>
      <View style={[styles.track, { backgroundColor: t.surfacePressed }]}>
        <View style={{ width: `${p * 100}%`, height: '100%', borderRadius: 3, backgroundColor: color }} />
      </View>
    </View>
  );
}

function Stat2({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <T variant="caption" secondary numberOfLines={1}>
        {label}
      </T>
      <T variant="heading">{value}</T>
      {unit && (
        <T variant="caption" muted>
          {unit}
        </T>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dayNav: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg },
  iconBox: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  quick: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth, gap: 2 },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  emptyMeal: { borderWidth: 1, borderStyle: 'dashed', borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
  warn: { padding: Spacing.md, borderRadius: Radius.md },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
});
