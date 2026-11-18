import { useThemeContext } from '@/components/theme-provider';
import { scaled, scaledSpace, touchSize, type Palette } from '@/constants/theme';

export function useTheme(): Palette {
  return useThemeContext().theme;
}

/** Yazı/boyut ölçeği: `scale` çarpan, `f(n)` yazı/ikon/kontrol boyutu, `s(n)` boşluk, `touch(n)` ≥ 44 pt kontrol yüksekliği. */
export function useScale() {
  const { scale } = useThemeContext();
  return {
    scale,
    f: (n: number) => scaled(n, scale),
    s: (n: number) => scaledSpace(n, scale),
    touch: (n: number) => touchSize(n, scale),
  };
}
