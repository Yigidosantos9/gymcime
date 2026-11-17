import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Icon, type IconName } from '@/components/icon';
import { Font, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';

export type { IconName };

// ───────────────────────── Metin ─────────────────────────

type Variant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption' | 'overline' | 'num' | 'numLarge';

const variantStyle: Record<Variant, TextStyle> = {
  display: { fontSize: 34, fontFamily: Font.heavy, letterSpacing: -0.8, lineHeight: 40 },
  title: { fontSize: 26, fontFamily: Font.heavy, letterSpacing: -0.5, lineHeight: 32 },
  heading: { fontSize: 17, fontFamily: Font.bold, letterSpacing: -0.2 },
  body: { fontSize: 15, fontFamily: Font.regular, lineHeight: 21 },
  label: { fontSize: 13, fontFamily: Font.medium },
  caption: { fontSize: 12, fontFamily: Font.regular },
  overline: { fontSize: 11, fontFamily: Font.bold, letterSpacing: 1.1, textTransform: 'uppercase' },
  num: { fontSize: 22, fontFamily: Font.heavy, letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  numLarge: { fontSize: 44, fontFamily: Font.heavy, letterSpacing: -1.5, fontVariant: ['tabular-nums'], lineHeight: 50 },
};

export function T({
  variant = 'body',
  color,
  muted,
  secondary,
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: string; muted?: boolean; secondary?: boolean }) {
  const t = useTheme();
  const c = color ?? (muted ? t.textMuted : secondary ? t.textSecondary : t.text);
  return <Text {...rest} style={[variantStyle[variant], { color: c }, style]} />;
}

// ───────────────────────── Basınca küçülen Pressable ─────────────────────────

const APressable = Animated.createAnimatedComponent(Pressable);

export function PressableScale({
  style,
  scaleTo = 0.97,
  hapticOnPress = true,
  onPress,
  children,
  ...rest
}: PressableProps & { style?: StyleProp<ViewStyle>; scaleTo?: number; hapticOnPress?: boolean; children?: ReactNode }) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <APressable
      {...rest}
      onPressIn={(e) => {
        scale.set(withSpring(scaleTo, { damping: 18, stiffness: 420 }));
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, { damping: 14, stiffness: 300 }));
        rest.onPressOut?.(e);
      }}
      onPress={(e) => {
        if (hapticOnPress) haptic.tap();
        onPress?.(e);
      }}
      style={[style, animated]}>
      {children}
    </APressable>
  );
}

// ───────────────────────── Buton ─────────────────────────

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

export function Button({
  title,
  icon,
  kind = 'primary',
  onPress,
  disabled,
  loading,
  style,
  small,
}: {
  title: string;
  icon?: IconName;
  kind?: ButtonKind;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const t = useTheme();
  const bg = {
    primary: t.primary,
    success: t.success,
    secondary: t.primarySoft,
    danger: t.dangerSoft,
    ghost: 'transparent',
  }[kind];
  const fg = {
    primary: t.onPrimary,
    success: t.onPrimary,
    secondary: t.primary,
    danger: t.danger,
    ghost: t.textSecondary,
  }[kind];
  const solid = kind === 'primary' || kind === 'success';
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.btn,
        small && styles.btnSmall,
        { backgroundColor: bg },
        solid && { shadowColor: kind === 'success' ? t.success : t.primary, shadowOpacity: t.isDark ? 0.35 : 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
        disabled && { opacity: 0.4 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Icon name={icon} size={small ? 14 : 17} color={fg} weight="bold" />}
          <T variant={small ? 'label' : 'heading'} color={fg} style={small ? undefined : { fontSize: 16 }}>
            {title}
          </T>
        </>
      )}
    </PressableScale>
  );
}

// ───────────────────────── Yüzeyler ─────────────────────────

export function Card({
  children,
  style,
  padded = true,
  raised,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  raised?: boolean;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: raised ? t.surfaceRaised : t.surface,
          borderColor: t.border,
          shadowColor: t.shadow,
          shadowOpacity: t.isDark ? 0 : 0.05,
        },
        padded && { padding: Spacing.lg },
        style,
      ]}>
      {children}
    </View>
  );
}

/** Bento kutucuğu: üstte küçük ikon + etiket, altında içerik. */
export function Tile({
  icon,
  label,
  tint,
  children,
  style,
  onPress,
}: {
  icon?: IconName;
  label: string;
  tint?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const t = useTheme();
  const color = tint ?? t.primary;
  const body = (
    <Card style={[{ gap: Spacing.sm, flex: 1 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icon && <Icon name={icon} size={13} color={color} weight="bold" />}
        <T variant="overline" color={t.textSecondary} numberOfLines={1}>
          {label}
        </T>
      </View>
      {children}
    </Card>
  );
  if (!onPress) return <View style={{ flex: 1 }}>{body}</View>;
  return (
    <PressableScale onPress={onPress} style={{ flex: 1 }} scaleTo={0.97}>
      {body}
    </PressableScale>
  );
}

// ───────────────────────── Küçük parçalar ─────────────────────────

export function Chip({
  label,
  active,
  onPress,
  icon,
  tint,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: IconName;
  tint?: string;
}) {
  const t = useTheme();
  const c = tint ?? t.primary;
  return (
    <PressableScale
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? c : t.surfaceRaised,
          borderColor: active ? c : t.border,
        },
      ]}>
      {icon && <Icon name={icon} size={13} color={active ? t.onPrimary : c} weight="bold" />}
      <T variant="label" color={active ? t.onPrimary : t.textSecondary}>
        {label}
      </T>
    </PressableScale>
  );
}

export function Badge({ label, tint, bg, icon }: { label: string; tint: string; bg: string; icon?: IconName }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {icon && <Icon name={icon} size={11} color={tint} weight="bold" />}
      <T variant="caption" color={tint} style={{ fontFamily: Font.bold }}>
        {label}
      </T>
    </View>
  );
}

export function IconButton({
  icon,
  onPress,
  color,
  bg,
  size = 18,
  style,
}: {
  icon: IconName;
  onPress?: () => void;
  color?: string;
  bg?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      hitSlop={8}
      style={[styles.iconBtn, { backgroundColor: bg ?? t.surfaceRaised, borderColor: t.border }, style]}>
      <Icon name={icon} size={size} color={color ?? t.text} />
    </PressableScale>
  );
}

export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={styles.screenHeader}>
      <View style={{ flex: 1 }}>
        {subtitle && (
          <T variant="overline" secondary>
            {subtitle}
          </T>
        )}
        <T variant="display">{title}</T>
      </View>
      {right}
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const t = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <T variant="overline" secondary>
        {title}
      </T>
      {action && (
        <Pressable onPress={onAction} hitSlop={10}>
          <T variant="label" color={t.primary}>
            {action}
          </T>
        </Pressable>
      )}
    </View>
  );
}

export function EmptyState({ icon, title, text, children }: { icon: IconName; title: string; text?: string; children?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: t.primarySoft }]}>
        <Icon name={icon} size={30} color={t.primary} />
      </View>
      <T variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </T>
      {text && (
        <T secondary style={{ textAlign: 'center', maxWidth: 280 }}>
          {text}
        </T>
      )}
      {children}
    </View>
  );
}

export function Stat({ value, label, unit }: { value: string; label: string; unit?: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
        <T variant="num">{value}</T>
        {unit && (
          <T variant="label" secondary>
            {unit}
          </T>
        )}
      </View>
      <T variant="caption" secondary>
        {label}
      </T>
    </View>
  );
}

/** İlerleme halkası (0-1). */
export function Ring({
  progress,
  size = 64,
  stroke = 7,
  color,
  track,
  children,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
}) {
  const t = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track ?? t.surfacePressed} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color ?? t.primary}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - p)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: t.borderStrong }, style]} />;
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: Radius.md,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: Spacing.lg,
  },
  btnSmall: { minHeight: 36, paddingHorizontal: Spacing.md, borderRadius: Radius.sm },
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 34,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.md,
    paddingTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xxl,
    marginBottom: Spacing.md,
  },
  empty: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.xl },
  emptyIcon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
});
