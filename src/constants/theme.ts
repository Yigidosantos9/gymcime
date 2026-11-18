/**
 * gymcime tasarım sistemi 2.0 — "Derin Okyanus".
 * Koyu tema varsayılan; açık tema seçenek olarak duruyor.
 * Ekranlar renkleri yalnızca `useTheme()` üzerinden okur.
 */
import '@/global.css';

type Gradient = readonly [string, string, ...string[]];
type DayColor = { color: string; soft: string };

/** '#RRGGBB' → 'rgba(r, g, b, a)' */
function withAlpha(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
const dayPalette = (colors: readonly string[], alpha: number): DayColor[] => colors.map((color) => ({ color, soft: withAlpha(color, alpha) }));

/**
 * Günlere özel renkler (0 = Pazartesi … 6 = Pazar): Pzt mercan, Sal amber, Çar yeşil, Per turkuaz, Cum mavi, Cmt mor, Paz pembe.
 * Koyu temada açık tonlar, açık temada koyu tonlar; hepsi zemin/kart/`soft` üstünde WCAG AA (≥ 4.5) metin kontrastı verir (test edilir).
 */
export const DAY_COLORS_DARK = ['#FF8A7A', '#FBBF24', '#A3E635', '#2DD4BF', '#60A5FA', '#B794F6', '#F472B6'] as const;
export const DAY_COLORS_LIGHT = ['#C2301F', '#8A5806', '#41690C', '#0D6D65', '#1D4ED8', '#7C3AED', '#BE185D'] as const;

const dark = {
  isDark: true,
  // katmanlı yüzeyler: zemin → kart → yükseltilmiş → basılı
  background: '#030F17',
  surface: '#0A1B26',
  surfaceRaised: '#102633',
  surfacePressed: '#163243',
  border: 'rgba(148, 210, 240, 0.08)',
  borderStrong: 'rgba(148, 210, 240, 0.16)',

  text: '#EAF6FC',
  textSecondary: '#8AA9BA',
  textMuted: '#55717F',

  primary: '#22C3EE', // turkuaz vurgu
  primarySoft: 'rgba(34, 195, 238, 0.14)',
  primaryStrong: '#0EA5D9',
  onPrimary: '#03202C',
  accent: '#5EEAD4', // aqua
  accentSoft: 'rgba(94, 234, 212, 0.14)',

  success: '#34D399',
  successSoft: 'rgba(52, 211, 153, 0.14)',
  danger: '#FB7185',
  dangerSoft: 'rgba(251, 113, 133, 0.14)',
  gold: '#FBBF24',
  goldSoft: 'rgba(251, 191, 36, 0.14)',
  violet: '#A78BFA',
  violetSoft: 'rgba(167, 139, 250, 0.14)',

  gradient: ['#0EA5D9', '#0B6FA4', '#083F66'] as Gradient,
  glow: 'rgba(34, 195, 238, 0.35)',
  scrim: 'rgba(1, 8, 12, 0.6)',
  shadow: '#000000',
  heat: ['#12303F', '#0E5A7A', '#0B87B3', '#22C3EE', '#5EEAD4'] as Gradient,
  /** haftanın günü renkleri (0 = Pazartesi) */
  days: dayPalette(DAY_COLORS_DARK, 0.16),
};

const light: typeof dark = {
  isDark: false,
  background: '#F3F8FB',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfacePressed: '#EAF3F8',
  border: 'rgba(8, 63, 102, 0.08)',
  borderStrong: 'rgba(8, 63, 102, 0.16)',

  text: '#06202E',
  textSecondary: '#557385',
  textMuted: '#8FA8B6',

  primary: '#0A8CC2',
  primarySoft: 'rgba(10, 140, 194, 0.10)',
  primaryStrong: '#07739F',
  onPrimary: '#FFFFFF',
  accent: '#0D9488',
  accentSoft: 'rgba(13, 148, 136, 0.10)',

  success: '#059669',
  successSoft: 'rgba(5, 150, 105, 0.10)',
  danger: '#E11D48',
  dangerSoft: 'rgba(225, 29, 72, 0.08)',
  gold: '#D97706',
  goldSoft: 'rgba(217, 119, 6, 0.10)',
  violet: '#7C3AED',
  violetSoft: 'rgba(124, 58, 237, 0.08)',

  gradient: ['#18A9E0', '#0A7DB4', '#085A86'] as Gradient,
  glow: 'rgba(10, 140, 194, 0.25)',
  scrim: 'rgba(6, 32, 46, 0.35)',
  shadow: '#0B4A70',
  heat: ['#E3EEF4', '#B9DDEE', '#6EC1E4', '#1FA3D6', '#0A7DB4'] as Gradient,
  days: dayPalette(DAY_COLORS_LIGHT, 0.1),
};

export const Colors = { dark, light };
export type Palette = typeof dark;
export type ThemePreference = 'dark' | 'light' | 'system';

export const Font = {
  regular: 'PlusJakartaSans_500Medium',
  medium: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  heavy: 'PlusJakartaSans_800ExtraBold',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const Radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  pill: 999,
} as const;

// ───────────────────────── Ölçek (yazı boyutu) ─────────────────────────

export type FontScalePref = 'normal' | 'large' | 'xlarge';
/** Normal %100 · Büyük %115 (varsayılan) · Çok büyük %130 */
export const FONT_SCALES: Record<FontScalePref, number> = { normal: 1, large: 1.15, xlarge: 1.3 };
export const DEFAULT_FONT_SCALE: FontScalePref = 'large';
export const FONT_SCALE_KEYS: FontScalePref[] = ['normal', 'large', 'xlarge'];

export function parseFontScale(v: string | null | undefined): FontScalePref {
  return v === 'normal' || v === 'large' || v === 'xlarge' ? v : DEFAULT_FONT_SCALE;
}
/** Boyutu ölçekle (yazı, ikon, kontrol yüksekliği); tam sayıya yuvarlar. */
export function scaled(n: number, factor: number) {
  return Math.round(n * factor);
}
/** Boşluklar yazıdan daha yumuşak büyür (farkın yarısı). */
export function scaledSpace(n: number, factor: number) {
  return Math.round(n * (1 + (factor - 1) / 2));
}
/** Dokunma hedefi alt sınırı (pt). */
export const MIN_TOUCH = 44;
/** Kontrol yüksekliği: ölçeklenir, ama dokunma hedefi için en az `MIN_TOUCH`. */
export function touchSize(n: number, factor: number) {
  return Math.max(MIN_TOUCH, scaled(n, factor));
}
/** iOS sistem yazı boyutuyla birlikte metin en çok bu kat kadar büyür. */
export const MAX_FONT_MULTIPLIER = 1.25;
