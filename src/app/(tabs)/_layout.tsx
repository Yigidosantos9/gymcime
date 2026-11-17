import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { iconSymbols } from '@/components/icon';
import { Font } from '@/constants/theme';
import { getProfile } from '@/db/queries';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/components/language-provider';

export default function TabsLayout() {
  const _ = useT();
  const t = useTheme();
  const { data: profile } = useDbQuery(getProfile);

  useEffect(() => {
    if (profile !== undefined) SplashScreen.hideAsync().catch(() => {});
  }, [profile]);

  if (profile === undefined) return null;
  if (profile === null) return <Redirect href="/onboarding" />;

  const home = iconSymbols('home');
  const routines = iconSymbols('routines');
  const history = iconSymbols('history');
  const progress = iconSymbols('progress');
  const nutrition = iconSymbols('nutrition');

  return (
    <NativeTabs
      tintColor={t.primary}
      iconColor={{ default: t.textMuted, selected: t.primary }}
      labelStyle={{ default: { color: t.textMuted, fontFamily: Font.medium }, selected: { color: t.primary, fontFamily: Font.bold } }}
      backgroundColor={t.isDark ? undefined : t.surface}
      blurEffect={t.isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
      indicatorColor={t.primarySoft}
      rippleColor={t.primarySoft}
      minimizeBehavior="onScrollDown"
      backBehavior="initialRoute">
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{_('common.today')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={home.sf} md={home.md} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="routines">
        <NativeTabs.Trigger.Label>{_('common.routines')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={routines.sf} md={routines.md} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Label>{_('common.history')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={history.sf} md={history.md} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="progress">
        <NativeTabs.Trigger.Label>{_('common.progress')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={progress.sf} md={progress.md} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="nutrition">
        <NativeTabs.Trigger.Label>{_('common.nutrition')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={nutrition.sf} md={nutrition.md} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
