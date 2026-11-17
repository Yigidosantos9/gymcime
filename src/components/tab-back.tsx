import { router } from 'expo-router';
import { View } from 'react-native';

import { Icon } from '@/components/icon';
import { PressableScale, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Bugün dışındaki her sekmenin başına konur: "‹ Bugün" → Bugün sekmesine geçer. */
export function HomeBack() {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', marginBottom: Spacing.sm }}>
      <PressableScale
        onPress={() => router.navigate('/')}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Bugün sekmesine dön"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingRight: 12 }}>
        <Icon name="chevronLeft" size={15} color={t.primary} />
        <T variant="heading" color={t.primary} style={{ fontSize: 15 }}>
          Bugün
        </T>
      </PressableScale>
    </View>
  );
}
