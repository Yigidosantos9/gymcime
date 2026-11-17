import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { useSheet } from '@/components/sheet';
import { Badge, Button, Card, Divider, SectionHeader, T } from '@/components/ui';
import { Font, Radius, Spacing } from '@/constants/theme';
import { getExerciseMedia, muscleName } from '@/db/exercise-media';
import type { Exercise } from '@/db/queries';
import { useTheme } from '@/hooks/use-theme';
import { generateGuide, getCachedGuide, hasApiKey, type ExerciseGuide } from '@/lib/ai';
import { AiError } from '@/lib/ai-core';
import { useSQLiteContext } from 'expo-sqlite';
import { useLanguage, useT } from '@/components/language-provider';

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

/** "Nasıl yapılır": görseller + (varsa) seçili dilde adımlar + AI rehberi (seçili dilde). */
export function ExerciseGuideCard({ exercise }: { exercise: Exercise }) {
  const _ = useT();
  const { lang } = useLanguage();
  const t = useTheme();
  const media = getExerciseMedia(exercise.slug);
  return (
    <>
      {media && (
        <>
          <SectionHeader title={_('exerciseGuide.how_to')} />
          <Card style={{ gap: Spacing.md }}>
            <PoseAnimation images={media.images} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {media.primary.map((m) => (
                <Badge key={m} label={muscleName(m)} tint={t.primary} bg={t.primarySoft} icon="target" />
              ))}
              {media.secondary.map((m) => (
                <Badge key={m} label={muscleName(m)} tint={t.textSecondary} bg={t.surfacePressed} />
              ))}
            </View>
            {media.steps[lang].length > 0 && (
              <>
                <Divider />
                <Block title={_('exerciseGuide.steps')}>
                  <Bullets items={media.steps[lang]} numbered />
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
  const _ = useT();
  const { lang } = useLanguage();
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
      const [k, cached] = await Promise.all([hasApiKey(), getCachedGuide(db, exercise.id, lang)]);
      if (!alive) return;
      setKeyOk(k);
      setGuide(cached?.guide ?? null);
    })();
    return () => {
      alive = false;
    };
  }, [db, exercise.id, lang]);

  const run = useCallback(
    async (force: boolean) => {
      setBusy(true);
      setError(null);
      try {
        setGuide(await generateGuide(db, exercise, { force }));
      } catch (e) {
        setError(e instanceof AiError ? e.userMessage : _('exerciseGuide.an_unexpected_error_occurred'));
        if (e instanceof AiError && e.kind === 'no-key') setKeyOk(false);
      } finally {
        setBusy(false);
      }
    },
    [db, exercise, _],
  );

  const regenerate = () =>
    sheet.actions({
      title: _('exerciseGuide.regenerate_the_guide'),
      message: _('exerciseGuide.a_new_ai_request_is'),
      actions: [{ label: _('exerciseGuide.regenerate'), icon: 'restart', style: 'primary', onPress: () => run(true) }],
    });

  if (keyOk === null) return null;

  return (
    <>
      <SectionHeader title={_('exerciseGuide.ai_guide')} />
      {!guide ? (
        <Card style={{ gap: Spacing.md }}>
          <View style={{ flexDirection: 'row', gap: Spacing.md, alignItems: 'center' }}>
            <View style={[styles.aiIcon, { backgroundColor: t.violetSoft }]}>
              <Icon name="sparkles" size={20} color={t.violet} />
            </View>
            <View style={{ flex: 1 }}>
              <T variant="heading">{_('exerciseGuide.execution_guide')}</T>
              <T variant="caption" secondary>{_('exerciseGuide.setup_key_angles_breathing_common')}</T>
            </View>
          </View>
          {error && (
            <T variant="label" color={t.danger}>
              {error}
            </T>
          )}
          {keyOk ? (
            <Button title={_('exerciseGuide.generate_guide')} icon="sparkles" onPress={() => run(false)} loading={busy} />
          ) : (
            <Button title={_('exerciseGuide.add_api_key')} icon="add" kind="secondary" onPress={() => router.push('/settings')} />
          )}
          {showHeader && !keyOk && (
            <T variant="caption" muted style={{ textAlign: 'center' }}>{_('exerciseGuide.you_enter_the_key_in')}</T>
          )}
        </Card>
      ) : (
        <Card style={{ gap: Spacing.lg }}>
          {guide.setup.length > 0 && (
            <Block title={_('exerciseGuide.setup')}>
              <Bullets items={guide.setup} />
            </Block>
          )}
          <Block title={_('exerciseGuide.execution')}>
            <Bullets items={guide.steps} numbered />
          </Block>
          {guide.keyAngles.length > 0 && (
            <Block title={_('exerciseGuide.key_angles')}>
              <Bullets items={guide.keyAngles} />
            </Block>
          )}
          <Block title={_('exerciseGuide.breathing')}>
            <T>{guide.breathing}</T>
          </Block>
          <Block title={_('exerciseGuide.3_common_mistakes')}>
            <View style={{ gap: 10 }}>
              {guide.mistakes.map((m, i) => (
                <View key={i} style={[styles.mistake, { backgroundColor: t.surfacePressed }]}>
                  <T variant="label" color={t.danger}>
                    {m.mistake}
                  </T>
                  <T variant="label" color={t.success}>{_('exerciseGuide.fix', { fix: m.fix })}
                  </T>
                </View>
              ))}
            </View>
          </Block>
          {guide.feel.length > 0 && (
            <Block title={_('exerciseGuide.muscles_you_should_feel')}>
              <Bullets items={guide.feel} />
            </Block>
          )}
          {guide.personalTips.length > 0 && (
            <View style={[styles.tips, { backgroundColor: t.violetSoft }]}>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <Icon name="person" size={13} color={t.violet} />
                <T variant="overline" color={t.violet}>{_('exerciseGuide.just_for_you')}</T>
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
          <Button title={_('exerciseGuide.regenerate')} icon="restart" kind="ghost" small onPress={regenerate} loading={busy} />
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
