import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/icon';
import { PressableScale, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Ana sayfadan başka sekmeye giderken kullan: hedefte "‹ Bugün" butonu çıkar. */
export function fromHome(path: '/progress' | '/history' | '/routines' | '/nutrition') {
  router.push(`${path}?from=index` as never);
}

/**
 * Sekme ekranının başına konur. `?from=index` ile gelindiyse "‹ Bugün" gösterir; dokununca Bugün sekmesine döner.
 * Sekmeler bellekte kaldığı için parametre, ekran odaktan çıkınca temizlenir (alt bardan doğrudan geçişte buton görünmez).
 */
export function HomeBack() {
  const t = useTheme();
  const nav = useNavigation();
  const { from } = useLocalSearchParams<{ from?: string }>();
  useEffect(() => {
    const unsub = nav.addListener('blur', () => nav.setParams({ from: undefined } as never));
    return unsub;
  }, [nav]);
  if (from !== 'index') return null;
  return (
    <View style={{ flexDirection: 'row', marginBottom: Spacing.sm }}>
      <PressableScale
        onPress={() => router.navigate('/')}
        hitSlop={10}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingRight: 12 }}>
        <Icon name="chevronLeft" size={15} color={t.primary} />
        <T variant="heading" color={t.primary} style={{ fontSize: 15 }}>
          Bugün
        </T>
      </PressableScale>
    </View>
  );
}
