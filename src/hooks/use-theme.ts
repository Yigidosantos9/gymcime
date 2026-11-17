import { useThemeContext } from '@/components/theme-provider';
import type { Palette } from '@/constants/theme';

export function useTheme(): Palette {
  return useThemeContext().theme;
}
