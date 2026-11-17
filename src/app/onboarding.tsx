import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BodyMap } from '@/components/body-map';
import { Icon, type IconName } from '@/components/icon';
import { PressableScale, T } from '@/components/ui';
import { Font, Radius, Spacing } from '@/constants/theme';
import { createRoutinesFromTemplate, saveProfile } from '@/db/queries';
import { useTheme } from '@/hooks/use-theme';
import { dayWarning, notRecommended, WEEK_DAYS } from '@/lib/goals';
import { haptic } from '@/lib/haptics';

const GOALS: { label: string; icon: IconName; text: string }[] = [
  { label: 'Kas kazanmak', icon: 'barbell', text: 'Hipertrofi odaklı, orta tekrar' },
  { label: 'Güçlenmek', icon: 'bolt', text: 'Ağır kilolar, düşük tekrar' },
  { label: 'Yağ yakmak', icon: 'flame', text: 'Kası koru, kondisyonu artır' },
  { label: 'Formda kalmak', icon: 'heart', text: 'Dengeli ve sürdürülebilir' },
];
const LEVELS: { label: string; text: string }[] = [
  { label: 'Yeni başlıyorum', text: '0–6 ay' },
  { label: 'Orta', text: '6 ay – 2 yıl' },
  { label: 'İleri', text: '2 yıldan fazla' },
];

export default function Onboarding() {
  const t = useTheme();
  const db = useSQLiteContext();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState(GOALS[0].label);
  const [level, setLevel] = useState(LEVELS[1].label);
  const [days, setDays] = useState(4);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const next = () => {
    haptic.light();
    setStep((s) => s + 1);
  };

  const finish = async () => {
    setSaving(true);
    await saveProfile(db, {
      name: name.trim(),
      goal,
      experience: level,
      daysPerWeek: days,
      restSeconds: 90,
      soundOn: true,
      hapticOn: true,
      incBarbell: 2.5,
      incDumbbell: 2,
      incMachine: 2.5,
      setStyle: 'auto',
      recoveryDays: 2,
      barWeight: 20,
      plates: [25, 20, 15, 10, 5, 2.5, 1.25],
    });
    await createRoutinesFromTemplate(db, days <= 3 ? 'full' : days === 4 ? 'upperlower' : 'ppl');
    haptic.success();
    router.replace('/');
  };

  const program = days <= 3 ? 'Full Body A/B' : days === 4 ? 'Üst / Alt Vücut' : 'Push / Pull / Legs';
  const disabled = (step === 0 && !name.trim()) || saving;

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <LinearGradient colors={[t.glow, 'transparent']} style={styles.glow} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.dots}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.dot, { backgroundColor: i <= step ? t.primary : t.surfacePressed, flex: i === step ? 2 : 1 }]} />
            ))}
          </View>

          <Animated.View key={step} entering={FadeInRight.springify().damping(18)} exiting={FadeOutLeft.duration(140)} style={styles.body}>
            {step === 0 && (
              <>
                <View style={{ alignItems: 'center', marginBottom: Spacing.lg }}>
                  <BodyMap values={{ Göğüs: 1, Omuz: 0.75, Karın: 0.5, Bacak: 0.9, Sırt: 0.8, Kalça: 0.6, Biceps: 0.4, Triceps: 0.4 }} size={170} labels={false} />
                </View>
                <T variant="display">
                  gymcime&apos;ye{'\n'}hoş geldin 🌊
                </T>
                <T secondary style={{ fontSize: 16, lineHeight: 23 }}>
                  Antrenmanlarını kaydet, gelişimini gör, her seansta bir adım ileri git.
                </T>
                <T variant="overline" secondary style={{ marginTop: Spacing.lg }}>
                  Sana nasıl seslenelim?
                </T>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Adın"
                  placeholderTextColor={t.textMuted}
                  style={[styles.input, { backgroundColor: t.surface, borderColor: t.borderStrong, color: t.text }]}
                  returnKeyType="next"
                  onSubmitEditing={() => name.trim() && next()}
                />
              </>
            )}

            {step === 1 && (
              <>
                <T variant="title">Hedefin ne{name ? `, ${name.trim()}` : ''}?</T>
                <View style={{ gap: Spacing.md, marginTop: Spacing.lg }}>
                  {GOALS.map((g) => (
                    <Option key={g.label} active={goal === g.label} onPress={() => setGoal(g.label)} icon={g.icon} title={g.label} text={g.text} />
                  ))}
                </View>
              </>
            )}

            {step === 2 && (
              <>
                <T variant="title">Ne kadar süredir antrenman yapıyorsun?</T>
                <View style={{ gap: Spacing.md, marginTop: Spacing.lg }}>
                  {LEVELS.map((l) => (
                    <Option key={l.label} active={level === l.label} onPress={() => setLevel(l.label)} title={l.label} text={l.text} />
                  ))}
                </View>
              </>
            )}

            {step === 3 && (
              <>
                <T variant="title">Haftada kaç gün gidebilirsin?</T>
                <View style={styles.daysRow}>
                  {WEEK_DAYS.map((d) => (
                    <View key={d} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                      <PressableScale
                        onPress={() => setDays(d)}
                        style={[
                          styles.dayBtn,
                          {
                            backgroundColor: days === d ? (notRecommended(d) ? t.gold : t.primary) : t.surface,
                            borderColor: days === d ? (notRecommended(d) ? t.gold : t.primary) : t.border,
                            opacity: notRecommended(d) && days !== d ? 0.6 : 1,
                          },
                        ]}>
                        <T variant="heading" color={days === d ? t.onPrimary : t.text} style={{ fontSize: 20 }}>
                          {d}
                        </T>
                      </PressableScale>
                      <T variant="caption" muted style={{ fontSize: 9, height: 12 }}>
                        {notRecommended(d) ? 'önerilmez' : ''}
                      </T>
                    </View>
                  ))}
                </View>
                {dayWarning(days) && (
                  <View style={[styles.programBox, { backgroundColor: t.goldSoft, borderColor: t.gold, marginTop: Spacing.md }]}>
                    <Icon name="warning" size={16} color={t.gold} />
                    <T style={{ flex: 1 }}>{dayWarning(days)}</T>
                  </View>
                )}
                <View style={[styles.programBox, { backgroundColor: t.primarySoft, borderColor: t.primary }]}>
                  <Icon name="sparkles" size={18} color={t.primary} />
                  <T style={{ flex: 1 }}>
                    Senin için <T style={{ fontFamily: Font.heavy }}>{program}</T> programı hazırlayacağım. İstediğin zaman düzenleyebilirsin.
                  </T>
                </View>
              </>
            )}
          </Animated.View>

          <View style={styles.footer}>
            {step > 0 && (
              <PressableScale onPress={() => setStep((s) => s - 1)} style={[styles.back, { backgroundColor: t.surface, borderColor: t.border }]}>
                <Icon name="chevronLeft" size={18} color={t.text} />
              </PressableScale>
            )}
            <PressableScale onPress={step < 3 ? next : finish} disabled={disabled} style={[styles.cta, { backgroundColor: t.primary, opacity: disabled ? 0.4 : 1 }]}>
              <T variant="heading" color={t.onPrimary}>
                {step < 3 ? 'Devam' : 'Başlayalım'}
              </T>
              <Icon name="arrowRight" size={16} color={t.onPrimary} />
            </PressableScale>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function Option({ active, onPress, title, text, icon }: { active: boolean; onPress: () => void; title: string; text: string; icon?: IconName }) {
  const t = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      style={[styles.option, { backgroundColor: active ? t.primarySoft : t.surface, borderColor: active ? t.primary : t.border }]}>
      {icon && (
        <View style={[styles.optIcon, { backgroundColor: active ? t.primary : t.surfaceRaised }]}>
          <Icon name={icon} size={18} color={active ? t.onPrimary : t.primary} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <T variant="heading">{title}</T>
        <T variant="caption" secondary>
          {text}
        </T>
      </View>
      <View style={[styles.radio, { borderColor: active ? t.primary : t.borderStrong }]}>
        {active && <View style={[styles.radioDot, { backgroundColor: t.primary }]} />}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 420 },
  dots: { flexDirection: 'row', gap: 6, paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  dot: { height: 5, borderRadius: 3 },
  body: { flex: 1, paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl, gap: Spacing.md },
  input: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    height: 56,
    fontSize: 18,
    fontFamily: Font.bold,
  },
  option: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1 },
  optIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  daysRow: { flexDirection: 'row', gap: 6, marginTop: Spacing.lg },
  dayBtn: { alignSelf: 'stretch', aspectRatio: 0.8, borderRadius: Radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  programBox: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1, marginTop: Spacing.lg },
  footer: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.xl },
  back: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cta: { flex: 1, height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
