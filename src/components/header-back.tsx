import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { leave } from '@/lib/nav';

/** Her sunumda (kart veya modal) çalışan geri butonu. */
export function HeaderBack() {
  const t = useTheme();
  return (
    <PressableScale
      onPress={leave}
      hitSlop={12}
      style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surfaceRaised }}>
      <Icon name="chevronLeft" size={16} color={t.text} />
    </PressableScale>
  );
}
