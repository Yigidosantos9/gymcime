import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { useSheet } from '@/components/sheet';
import { Badge, Button, Card, Chip, Divider, PressableScale, SectionHeader, T } from '@/components/ui';
import { Font, Radius, Spacing } from '@/constants/theme';
import { getNutritionProfile, latestBodyWeight, saveNutritionProfile } from '@/db/nutrition-queries';
import { addBodyWeight } from '@/db/queries';
import { useTheme } from '@/hooks/use-theme';
import { parseNumber } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { leave } from '@/lib/nav';
import {
  ACTIVITY,
  bmi,
  bmiCategory,
  bodyFatCategory,
  bmr,
  calorieTarget,
  estimateBodyFat,
  goalEta,
  leanMassKg,
  macrosFor,
  trainingDayMacros,
  type ActivityLevel,
  type Sex,
} from '@/lib/nutrition';
import { useT } from '@/components/language-provider';
import { decimalSep } from '@/i18n';

const RATES = [-0.75, -0.5, -0.25, 0, 0.25, 0.5];
const fmt = (n: number) => String(n).replace('.', decimalSep());
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmt(Math.abs(n))}`;

export default function BodyAnalysis() {
  const _ = useT();
  const t = useTheme();
  const db = useSQLiteContext();
  const sheet = useSheet();
  const [ready, setReady] = useState(false);
  const [sex, setSex] = useState<Sex>('male');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [lastWeight, setLastWeight] = useState<number | null>(null);
  const [activity, setActivity] = useState<ActivityLevel>('moderate');
  const [waist, setWaist] = useState('');
  const [neck, setNeck] = useState('');
  const [hip, setHip] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [targetBf, setTargetBf] = useState('');
  const [rate, setRate] = useState(-0.5);

  useEffect(() => {
    (async () => {
      const [p, w] = await Promise.all([getNutritionProfile(db), latestBodyWeight(db)]);
      if (p) {
        setSex(p.sex);
        setAge(String(p.age));
        setHeight(String(p.heightCm));
        setActivity(p.activity);
        setWaist(p.waistCm ? fmt(p.waistCm) : '');
        setNeck(p.neckCm ? fmt(p.neckCm) : '');
        setHip(p.hipCm ? fmt(p.hipCm) : '');
        setTargetWeight(p.targetWeightKg ? fmt(p.targetWeightKg) : '');
        setTargetBf(p.targetBodyFat ? fmt(p.targetBodyFat) : '');
        setRate(p.weeklyRateKg);
      }
      if (w) {
        setLastWeight(w.weight);
        setWeight(fmt(w.weight));
      }
      setReady(true);
    })();
  }, [db]);

  const v = {
    age: parseNumber(age),
    h: parseNumber(height),
    w: parseNumber(weight),
    waist: parseNumber(waist),
    neck: parseNumber(neck),
    hip: parseNumber(hip),
    tw: parseNumber(targetWeight),
    tbf: parseNumber(targetBf),
  };
  const valid = !!v.age && v.age >= 14 && v.age <= 100 && !!v.h && v.h >= 120 && v.h <= 230 && !!v.w && v.w >= 30 && v.w <= 300;

  const calc = useMemo(() => {
    if (!valid) return null;
    const input = { sex, age: v.age!, heightCm: v.h!, weightKg: v.w!, waistCm: v.waist, neckCm: v.neck, hipCm: v.hip };
    const bf = estimateBodyFat(input);
    const target = calorieTarget(input, activity, rate);
    const macros = macrosFor(target.kcal, input.weightKg, target.adjustment);
    return {
      bmi: bmi(input.weightKg, input.heightCm),
      bf,
      lean: leanMassKg(input.weightKg, bf.percent),
      bmr: Math.round(bmr(input)),
      target,
      macros,
      training: trainingDayMacros(macros),
      eta: goalEta({ weightKg: input.weightKg, weeklyRateKg: target.weeklyRateKg, targetWeightKg: v.tw, targetBodyFat: v.tbf, bodyFatPercent: bf.percent }),
    };
  }, [valid, sex, v.age, v.h, v.w, v.waist, v.neck, v.hip, v.tw, v.tbf, activity, rate]);

  const save = async () => {
    if (!valid) return;
    await saveNutritionProfile(db, {
      heightCm: v.h!,
      age: Math.round(v.age!),
      sex,
      activity,
      waistCm: v.waist,
      neckCm: v.neck,
      hipCm: v.hip,
      targetWeightKg: v.tw,
      targetBodyFat: v.tbf,
      weeklyRateKg: rate,
    });
    if (lastWeight == null || Math.abs(lastWeight - v.w!) > 0.04) await addBodyWeight(db, v.w!);
    haptic.success();
    leave();
  };

  const askSave = () => {
    if (calc?.target.clampedReason) {
      sheet.actions({
        title: _('body.target_moved_to_the_safe'),
        message: calc.target.clampedReason,
        actions: [{ label: _('body.got_it_save'), style: 'primary', onPress: save }],
      });
    } else save();
  };

  if (!ready) return null;

  const needNeckWaist = !calc || calc.bf.method === 'bmi';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
        <SectionHeader title={_('body.you')} />
        <Card style={{ gap: Spacing.md }}>
          <View style={styles.row}>
            <Chip label={_('body.male')} active={sex === 'male'} onPress={() => setSex('male')} />
            <Chip label={_('body.female')} active={sex === 'female'} onPress={() => setSex('female')} />
          </View>
          <View style={styles.row}>
            <Field label={_('body.age')} value={age} onChange={setAge} unit={_('body.yrs')} />
            <Field label={_('body.height')} value={height} onChange={setHeight} unit={_('body.cm')} />
            <Field label={_('body.weight')} value={weight} onChange={setWeight} unit={_('common.kg')} decimal />
          </View>
          <T variant="caption" muted>{_('body.weight_comes_from_your_latest')}</T>
        </Card>

        <SectionHeader title={_('body.activity_level')} />
        <View style={{ gap: Spacing.sm }}>
          {ACTIVITY.map((a) => {
            const active = activity === a.key;
            return (
              <PressableScale
                key={a.key}
                onPress={() => setActivity(a.key)}
                style={[styles.option, { backgroundColor: active ? t.primarySoft : t.surface, borderColor: active ? t.primary : t.border }]}>
                <View style={{ flex: 1 }}>
                  <T variant="label" color={active ? t.primary : t.text} style={{ fontFamily: Font.bold }}>
                    {a.label}
                  </T>
                  <T variant="caption" secondary>
                    {a.text}
                  </T>
                </View>
                <T variant="caption" muted>
                  ×{fmt(a.factor)}
                </T>
              </PressableScale>
            );
          })}
        </View>

        <SectionHeader title={_('body.circumferences_optional')} />
        <Card style={{ gap: Spacing.md }}>
          <View style={styles.row}>
            <Field label={_('body.waist')} value={waist} onChange={setWaist} unit={_('body.cm')} decimal />
            <Field label={_('body.neck')} value={neck} onChange={setNeck} unit={_('body.cm')} decimal />
            {sex === 'female' && <Field label={_('common.hips')} value={hip} onChange={setHip} unit={_('body.cm')} decimal />}
          </View>
          <T variant="caption" muted>{_('body.if_you_enter_waist_at', { v: sex === 'female' ? _('body.women_also_need_hips') : '' })}
          </T>
        </Card>

        <SectionHeader title={_('common.target')} />
        <Card style={{ gap: Spacing.md }}>
          <View style={styles.row}>
            <Field label={_('body.target_weight')} value={targetWeight} onChange={setTargetWeight} unit={_('common.kg')} decimal />
            <Field label={_('body.target_body_fat')} value={targetBf} onChange={setTargetBf} unit="%" decimal />
          </View>
          <T variant="label" secondary>{_('body.weekly_rate_kg_week')}</T>
          <View style={[styles.row, { flexWrap: 'wrap' }]}>
            {RATES.map((r) => (
              <Chip key={r} label={r === 0 ? _('body.maintain') : signed(r)} active={rate === r} onPress={() => setRate(r)} />
            ))}
          </View>
          <T variant="caption" muted>{_('body.either_target_weight_or_body')}</T>
        </Card>

        {calc && (
          <>
            <SectionHeader title={_('body.results_estimated')} />
            <Card style={{ gap: Spacing.md }}>
              <View style={styles.row}>
                <Result label={_('body.bmi')} value={calc.bmi.toFixed(1).replace('.', decimalSep())} sub={bmiCategory(calc.bmi)} />
                <Result label={_('body.body_fat')} value={`%${fmt(calc.bf.percent)}`} sub={bodyFatCategory(sex, calc.bf.percent)} />
                <Result label={_('body.lean_mass')} value={_('common.kg2', { v: fmt(Math.round(calc.lean * 10) / 10) })} sub="tahmini" />
              </View>
              <Badge label={_('body.method', { methodLabel: calc.bf.methodLabel })} tint={t.textSecondary} bg={t.surfacePressed} icon="info" />
              {needNeckWaist && (
                <T variant="caption" muted>{_('body.this_is_only_an_estimate')}</T>
              )}
              <Divider />
              <View style={styles.row}>
                <Result label={_('body.bmr')} value={`${calc.bmr}`} sub={_('body.kcal_resting')} />
                <Result label={_('body.tdee')} value={`${calc.target.tdee}`} sub={_('body.kcal_daily')} />
              </View>
            </Card>

            <SectionHeader title={_('body.your_daily_target')} />
            <Card style={{ gap: Spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <T variant="numLarge">{calc.macros.kcal}</T>
                <T secondary>{_('body.kcal_day')}</T>
              </View>
              <T variant="label" secondary>
                {calc.target.adjustment === 0 ? _('body.equal_to_your_expenditure_to') : _('body.kcal_vs_your_expenditure', { v: signed(calc.target.adjustment) })}
                {calc.target.weeklyRateKg !== 0 ? _('body.about_kg_week', { v: signed(calc.target.weeklyRateKg) }) : ''}
              </T>
              {calc.target.deficitBlocked && (
                <T variant="label" color={t.gold}>{_('body.a_deficit_can_t_be')}</T>
              )}
              {calc.target.clampedReason && (
                <View style={[styles.note, { backgroundColor: t.goldSoft }]}>
                  <T variant="label" color={t.gold}>
                    {calc.target.clampedReason}
                  </T>
                </View>
              )}
              <Divider />
              <View style={styles.row}>
                <Result label={_('common.protein')} value={_('body.g', { protein: calc.macros.protein })} sub={_('body.g_kg', { v: fmt(Math.round((calc.macros.protein / v.w!) * 10) / 10) })} />
                <Result label={_('common.carbs')} value={_('body.g2', { carbs: calc.macros.carbs })} />
                <Result label={_('common.fat')} value={_('body.g3', { fat: calc.macros.fat })} sub={`%${Math.round(((calc.macros.fat * 9) / calc.macros.kcal) * 100)}`} />
              </View>
              <Divider />
              <T variant="label">{_('body.training_day_kcal_g_carbs', { kcal: calc.training.kcal, carbs: calc.training.carbs })}</T>
              {calc.eta && (
                <>
                  <Divider />
                  <T variant="label">
                    {calc.eta.direction === 'hold'
                      ? _('body.your_target_weight_kg_is', { v: fmt(calc.eta.targetWeightKg) })
                      : calc.eta.weeks != null
                        ? _('body.target_kg_estimated_weeks_mo', { v: fmt(calc.eta.targetWeightKg), count: calc.eta.weeks, v2: Math.round(calc.eta.weeks / 4.345) })
                        : _('body.target_kg', { v: fmt(calc.eta.targetWeightKg) })}
                  </T>
                  {calc.eta.note && (
                    <T variant="caption" muted>
                      {calc.eta.note}
                    </T>
                  )}
                </>
              )}
              <T variant="caption" muted>{_('body.all_values_are_estimates_adjust')}</T>
            </Card>
          </>
        )}

        <Button title={_('common.save')} icon="check" onPress={askSave} disabled={!valid} style={{ marginTop: Spacing.xl }} />
        {!valid && (
          <T variant="caption" muted style={{ textAlign: 'center', marginTop: Spacing.sm }}>{_('body.age_14_100_height_120')}</T>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChange, unit, decimal }: { label: string; value: string; onChange: (v: string) => void; unit: string; decimal?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, minWidth: 80, gap: 4 }}>
      <T variant="caption" secondary>
        {label}
      </T>
      <View style={[styles.field, { backgroundColor: t.surfaceRaised }]}>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
          placeholder="–"
          placeholderTextColor={t.textMuted}
          style={[styles.fieldInput, { color: t.text }]}
        />
        <T variant="caption" muted>
          {unit}
        </T>
      </View>
    </View>
  );
}

function Result({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <T variant="caption" secondary>
        {label}
      </T>
      <T variant="num">{value}</T>
      {sub && (
        <T variant="caption" muted>
          {sub}
        </T>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.sm },
  option: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, gap: 8 },
  field: { flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: Radius.md, paddingHorizontal: Spacing.md, gap: 4 },
  fieldInput: { flex: 1, fontSize: 16, fontFamily: Font.bold, padding: 0 },
  note: { padding: Spacing.md, borderRadius: Radius.md },
});
