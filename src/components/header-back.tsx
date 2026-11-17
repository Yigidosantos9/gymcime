import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { leave } from '@/lib/nav';
import { useT } from '@/components/language-provider';

/** Her sunumda (kart veya modal) çalışan geri butonu. */
/** `onPress` verilirse (ör. kaydedilmemiş değişiklik kontrolü) `leave` yerine o çalışır. */
export function HeaderBack({ onPress }: { onPress?: () => void } = {}) {
  const _ = useT();
  const t = useTheme();
  return (
    <PressableScale
      onPress={onPress ?? leave}
      accessibilityRole="button"
      accessibilityLabel={_('headerBack.back')}
      hitSlop={12}
      style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surfaceRaised }}>
      <Icon name="chevronLeft" size={16} color={t.text} />
    </PressableScale>
  );
}
