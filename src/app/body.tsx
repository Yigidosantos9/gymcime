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

const RATES = [-0.75, -0.5, -0.25, 0, 0.25, 0.5];
const fmt = (n: number) => String(n).replace('.', ',');
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmt(Math.abs(n))}`;

export default function BodyAnalysis() {
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
        title: 'Hedef güvenli sınıra çekildi',
        message: calc.target.clampedReason,
        actions: [{ label: 'Anladım, kaydet', style: 'primary', onPress: save }],
      });
    } else save();
  };

  if (!ready) return null;

  const needNeckWaist = !calc || calc.bf.method === 'bmi';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
        <SectionHeader title="Sen" />
        <Card style={{ gap: Spacing.md }}>
          <View style={styles.row}>
            <Chip label="Erkek" active={sex === 'male'} onPress={() => setSex('male')} />
            <Chip label="Kadın" active={sex === 'female'} onPress={() => setSex('female')} />
          </View>
          <View style={styles.row}>
            <Field label="Yaş" value={age} onChange={setAge} unit="yıl" />
            <Field label="Boy" value={height} onChange={setHeight} unit="cm" />
            <Field label="Kilo" value={weight} onChange={setWeight} unit="kg" decimal />
          </View>
          <T variant="caption" muted>
            Kilo, kilo takibindeki son ölçümünden gelir. Değiştirirsen yeni ölçüm olarak kaydedilir.
          </T>
        </Card>

        <SectionHeader title="Aktivite seviyesi" />
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

        <SectionHeader title="Çevre ölçüleri (isteğe bağlı)" />
        <Card style={{ gap: Spacing.md }}>
          <View style={styles.row}>
            <Field label="Bel" value={waist} onChange={setWaist} unit="cm" decimal />
            <Field label="Boyun" value={neck} onChange={setNeck} unit="cm" decimal />
            {sex === 'female' && <Field label="Kalça" value={hip} onChange={setHip} unit="cm" decimal />}
          </View>
          <T variant="caption" muted>
            Bel (göbek hizası) ve boyun ölçüsü girersen yağ oranı US Navy formülüyle, girmezsen BMI tabanlı tahminle hesaplanır.{' '}
            {sex === 'female' ? 'Kadınlarda kalça da gerekir.' : ''}
          </T>
        </Card>

        <SectionHeader title="Hedef" />
        <Card style={{ gap: Spacing.md }}>
          <View style={styles.row}>
            <Field label="Hedef kilo" value={targetWeight} onChange={setTargetWeight} unit="kg" decimal />
            <Field label="Hedef yağ" value={targetBf} onChange={setTargetBf} unit="%" decimal />
          </View>
          <T variant="label" secondary>
            Haftalık hız (kg/hafta)
          </T>
          <View style={[styles.row, { flexWrap: 'wrap' }]}>
            {RATES.map((r) => (
              <Chip key={r} label={r === 0 ? 'Koru' : signed(r)} active={rate === r} onPress={() => setRate(r)} />
            ))}
          </View>
          <T variant="caption" muted>
            Hedef kilo ve yağ oranından biri yeterli; ikisi de girilirse hedef kilo kullanılır.
          </T>
        </Card>

        {calc && (
          <>
            <SectionHeader title="Sonuçlar (tahmini)" />
            <Card style={{ gap: Spacing.md }}>
              <View style={styles.row}>
                <Result label="BMI" value={calc.bmi.toFixed(1).replace('.', ',')} sub={bmiCategory(calc.bmi)} />
                <Result label="Yağ oranı" value={`%${fmt(calc.bf.percent)}`} sub={bodyFatCategory(sex, calc.bf.percent)} />
                <Result label="Yağsız kütle" value={`${fmt(Math.round(calc.lean * 10) / 10)} kg`} sub="tahmini" />
              </View>
              <Badge label={`Yöntem: ${calc.bf.methodLabel}`} tint={t.textSecondary} bg={t.surfacePressed} icon="info" />
              {needNeckWaist && (
                <T variant="caption" muted>
                  Bu yalnızca bir tahmin; kas kütlesi yüksekse yağ oranı olduğundan yüksek çıkar. Daha iyi sonuç için bel ve boyun ölçüsü ekle.
                </T>
              )}
              <Divider />
              <View style={styles.row}>
                <Result label="BMR" value={`${calc.bmr}`} sub="kcal, dinlenirken" />
                <Result label="TDEE" value={`${calc.target.tdee}`} sub="kcal, günlük harcama" />
              </View>
            </Card>

            <SectionHeader title="Günlük hedefin" />
            <Card style={{ gap: Spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <T variant="numLarge">{calc.macros.kcal}</T>
                <T secondary>kcal / gün</T>
              </View>
              <T variant="label" secondary>
                {calc.target.adjustment === 0 ? 'Kilonu korumak için harcamana eşit.' : `Harcamana göre ${signed(calc.target.adjustment)} kcal`}
                {calc.target.weeklyRateKg !== 0 ? ` · yaklaşık ${signed(calc.target.weeklyRateKg)} kg/hafta` : ''}
              </T>
              {calc.target.deficitBlocked && (
                <T variant="label" color={t.gold}>
                  Alt sınır nedeniyle açık oluşturulamıyor.
                </T>
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
                <Result label="Protein" value={`${calc.macros.protein} g`} sub={`${fmt(Math.round((calc.macros.protein / v.w!) * 10) / 10)} g/kg`} />
                <Result label="Karb." value={`${calc.macros.carbs} g`} />
                <Result label="Yağ" value={`${calc.macros.fat} g`} sub={`%${Math.round(((calc.macros.fat * 9) / calc.macros.kcal) * 100)}`} />
              </View>
              <Divider />
              <T variant="label">
                Antrenman günü: {calc.training.kcal} kcal ({calc.training.carbs} g karbonhidrat)
              </T>
              {calc.eta && (
                <>
                  <Divider />
                  <T variant="label">
                    {calc.eta.direction === 'hold'
                      ? `Hedef kilon (${fmt(calc.eta.targetWeightKg)} kg) zaten şu anki kilon.`
                      : calc.eta.weeks != null
                        ? `Hedef ${fmt(calc.eta.targetWeightKg)} kg · tahmini süre ${calc.eta.weeks} hafta (~${Math.round(calc.eta.weeks / 4.345)} ay)`
                        : `Hedef ${fmt(calc.eta.targetWeightKg)} kg`}
                  </T>
                  {calc.eta.note && (
                    <T variant="caption" muted>
                      {calc.eta.note}
                    </T>
                  )}
                </>
              )}
              <T variant="caption" muted>
                Tüm değerler tahmindir; kilo trendine göre zamanla ayarla. Tıbbi bir durumun varsa beslenme planını doktorunla birlikte yap.
              </T>
            </Card>
          </>
        )}

        <Button title="Kaydet" icon="check" onPress={askSave} disabled={!valid} style={{ marginTop: Spacing.xl }} />
        {!valid && (
          <T variant="caption" muted style={{ textAlign: 'center', marginTop: Spacing.sm }}>
            Yaş (14-100), boy (120-230 cm) ve kilo (30-300 kg) gerekli.
          </T>
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
