import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { useSheet } from '@/components/sheet';
import { Badge, Button, Card, Divider, SectionHeader, T } from '@/components/ui';
import { Font, Radius, Spacing } from '@/constants/theme';
import { getExerciseMedia, muscleTr } from '@/db/exercise-media';
import type { Exercise } from '@/db/queries';
import { useTheme } from '@/hooks/use-theme';
import { generateGuide, getCachedGuide, hasApiKey, type ExerciseGuide } from '@/lib/ai';
import { AiError } from '@/lib/ai-core';
import { useSQLiteContext } from 'expo-sqlite';

/** İki poz arasında yumuşak geçiş (~1,2 sn döngü). */
function PoseAnimation({ images }: { images: [number, number] }) {
  const t = useTheme();
  const o = useSharedValue(0);
  useEffect(() => {
    const ease = Easing.inOut(Easing.quad);
    o.set(
      withRepeat(
        withSequence(withDelay(250, withTiming(1, { duration: 350, easing: ease })), withDelay(250, withTiming(0, { duration: 350, easing: ease }))),
        -1,
      ),
    );
  }, [o]);
  const top = useAnimatedStyle(() => ({ opacity: o.get() }));
  return (
    <View style={[styles.frame, { backgroundColor: '#FFFFFF', borderColor: t.border }]}>
      <Image source={images[0]} style={StyleSheet.absoluteFill} contentFit="contain" />
      <Animated.View style={[StyleSheet.absoluteFill, top]}>
        <Image source={images[1]} style={StyleSheet.absoluteFill} contentFit="contain" />
      </Animated.View>
    </View>
  );
}

function Bullets({ items, numbered }: { items: string[]; numbered?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {items.map((s, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
          {numbered ? (
            <View style={[styles.num, { backgroundColor: t.primarySoft }]}>
              <T variant="caption" color={t.primary} style={{ fontFamily: Font.heavy }}>
                {i + 1}
              </T>
            </View>
          ) : (
            <View style={[styles.dot, { backgroundColor: t.primary }]} />
          )}
          <T style={{ flex: 1 }}>{s}</T>
        </View>
      ))}
    </View>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <T variant="overline" secondary>
        {title}
      </T>
      {children}
    </View>
  );
}

/** "Nasıl yapılır": görseller + (varsa) İngilizce talimatlar + AI Türkçe rehberi. */
export function ExerciseGuideCard({ exercise }: { exercise: Exercise }) {
  const t = useTheme();
  const media = getExerciseMedia(exercise.slug);
  return (
    <>
      {media && (
        <>
          <SectionHeader title="Nasıl yapılır" />
          <Card style={{ gap: Spacing.md }}>
            <PoseAnimation images={media.images} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {media.primary.map((m) => (
                <Badge key={m} label={muscleTr(m)} tint={t.primary} bg={t.primarySoft} icon="target" />
              ))}
              {media.secondary.map((m) => (
                <Badge key={m} label={muscleTr(m)} tint={t.textSecondary} bg={t.surfacePressed} />
              ))}
            </View>
            {media.instructions.length > 0 && (
              <>
                <Divider />
                <Block title="Adımlar (İngilizce)">
                  <Bullets items={media.instructions} numbered />
                </Block>
              </>
            )}
          </Card>
        </>
      )}
      <AiGuide exercise={exercise} showHeader={!media} />
    </>
  );
}

function AiGuide({ exercise, showHeader }: { exercise: Exercise; showHeader: boolean }) {
  const t = useTheme();
  const db = useSQLiteContext();
  const sheet = useSheet();
  const [keyOk, setKeyOk] = useState<boolean | null>(null);
  const [guide, setGuide] = useState<ExerciseGuide | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [k, cached] = await Promise.all([hasApiKey(), getCachedGuide(db, exercise.id)]);
      if (!alive) return;
      setKeyOk(k);
      setGuide(cached?.guide ?? null);
    })();
    return () => {
      alive = false;
    };
  }, [db, exercise.id]);

  const run = useCallback(
    async (force: boolean) => {
      setBusy(true);
      setError(null);
      try {
        setGuide(await generateGuide(db, exercise, { force }));
      } catch (e) {
        setError(e instanceof AiError ? e.userMessage : 'Beklenmeyen bir hata oluştu.');
        if (e instanceof AiError && e.kind === 'no-key') setKeyOk(false);
      } finally {
        setBusy(false);
      }
    },
    [db, exercise],
  );

  const regenerate = () =>
    sheet.actions({
      title: 'Rehber yeniden oluşturulsun mu?',
      message: 'Yeni bir yapay zeka isteği gönderilir (ücretli) ve mevcut rehberin yerini alır.',
      actions: [{ label: 'Yeniden oluştur', icon: 'restart', style: 'primary', onPress: () => run(true) }],
    });

  if (keyOk === null) return null;

  return (
    <>
      <SectionHeader title="Yapay zeka rehberi" />
      {!guide ? (
        <Card style={{ gap: Spacing.md }}>
          <View style={{ flexDirection: 'row', gap: Spacing.md, alignItems: 'center' }}>
            <View style={[styles.aiIcon, { backgroundColor: t.violetSoft }]}>
              <Icon name="sparkles" size={20} color={t.violet} />
            </View>
            <View style={{ flex: 1 }}>
              <T variant="heading">Türkçe uygulama rehberi</T>
              <T variant="caption" secondary>
                Kurulum, kritik açılar, nefes, sık hatalar ve kişisel ipuçları. Bir kez üretilir, sonra cihazda saklanır.
              </T>
            </View>
          </View>
          {error && (
            <T variant="label" color={t.danger}>
              {error}
            </T>
          )}
          {keyOk ? (
            <Button title="Rehberi oluştur" icon="sparkles" onPress={() => run(false)} loading={busy} />
          ) : (
            <Button title="API anahtarı ekle" icon="add" kind="secondary" onPress={() => router.push('/settings')} />
          )}
          {showHeader && !keyOk && (
            <T variant="caption" muted style={{ textAlign: 'center' }}>
              Anahtarı Ayarlar → Yapay zeka bölümünden girersin.
            </T>
          )}
        </Card>
      ) : (
        <Card style={{ gap: Spacing.lg }}>
          {guide.setup.length > 0 && (
            <Block title="Kurulum">
              <Bullets items={guide.setup} />
            </Block>
          )}
          <Block title="Uygulama">
            <Bullets items={guide.steps} numbered />
          </Block>
          {guide.keyAngles.length > 0 && (
            <Block title="Kritik açılar">
              <Bullets items={guide.keyAngles} />
            </Block>
          )}
          <Block title="Nefes">
            <T>{guide.breathing}</T>
          </Block>
          <Block title="Sık yapılan 3 hata">
            <View style={{ gap: 10 }}>
              {guide.mistakes.map((m, i) => (
                <View key={i} style={[styles.mistake, { backgroundColor: t.surfacePressed }]}>
                  <T variant="label" color={t.danger}>
                    {m.mistake}
                  </T>
                  <T variant="label" color={t.success}>
                    Düzeltme: {m.fix}
                  </T>
                </View>
              ))}
            </View>
          </Block>
          {guide.feel.length > 0 && (
            <Block title="Hissetmen gereken kaslar">
              <Bullets items={guide.feel} />
            </Block>
          )}
          {guide.personalTips.length > 0 && (
            <View style={[styles.tips, { backgroundColor: t.violetSoft }]}>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <Icon name="person" size={13} color={t.violet} />
                <T variant="overline" color={t.violet}>
                  Sana özel
                </T>
              </View>
              <Bullets items={guide.personalTips} />
            </View>
          )}
          <View style={[styles.safety, { backgroundColor: t.goldSoft }]}>
            <Icon name="warning" size={15} color={t.gold} />
            <T variant="label" style={{ flex: 1 }}>
              {guide.safety}
            </T>
          </View>
          {error && (
            <T variant="label" color={t.danger}>
              {error}
            </T>
          )}
          <Button title="Yeniden oluştur" icon="restart" kind="ghost" small onPress={regenerate} loading={busy} />
        </Card>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: 1.35, borderRadius: Radius.md, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  num: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  aiIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  mistake: { padding: Spacing.md, borderRadius: Radius.md, gap: 4 },
  tips: { padding: Spacing.md, borderRadius: Radius.md, gap: 8 },
  safety: { flexDirection: 'row', gap: 8, padding: Spacing.md, borderRadius: Radius.md, alignItems: 'center' },
});
