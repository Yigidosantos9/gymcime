import { SymbolView, type AndroidSymbol, type SFSymbol, type SymbolWeight } from 'expo-symbols';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

/**
 * Anlamsal ikon adları → iOS'ta SF Symbol, Android'de Material Symbol.
 * Yeni ikon eklerken iki platformun karşılığını birlikte yaz.
 */
const ICONS = {
  home: ['drop.fill', 'water_drop'],
  homeOutline: ['drop', 'water_drop'],
  routines: ['list.bullet.rectangle.portrait.fill', 'list'],
  history: ['calendar', 'calendar_month'],
  progress: ['chart.line.uptrend.xyaxis', 'trending_up'],
  settings: ['gearshape.fill', 'settings'],
  add: ['plus', 'add'],
  addCircle: ['plus.circle.fill', 'add'],
  check: ['checkmark', 'check'],
  checkCircle: ['checkmark.circle.fill', 'check_circle'],
  close: ['xmark', 'close'],
  trash: ['trash', 'delete'],
  more: ['ellipsis', 'more_horiz'],
  chevronRight: ['chevron.right', 'chevron_right'],
  chevronLeft: ['chevron.left', 'chevron_left'],
  chevronDown: ['chevron.down', 'expand_more'],
  chevronUp: ['chevron.up', 'keyboard_arrow_down'],
  play: ['play.fill', 'play_arrow'],
  skip: ['forward.end.fill', 'skip_next'],
  bolt: ['bolt.fill', 'bolt'],
  flame: ['flame.fill', 'local_fire_department'],
  trophy: ['trophy.fill', 'emoji_events'],
  search: ['magnifyingglass', 'search'],
  timer: ['timer', 'timer'],
  clock: ['clock', 'schedule'],
  sparkles: ['sparkles', 'auto_awesome'],
  minus: ['minus', 'remove'],
  barbell: ['dumbbell.fill', 'fitness_center'],
  layers: ['square.stack.3d.up.fill', 'layers'],
  scale: ['scalemass.fill', 'scale'],
  arrowUp: ['arrow.up', 'arrow_upward'],
  arrowDown: ['arrow.down', 'arrow_downward'],
  arrowRight: ['arrow.right', 'arrow_forward'],
  swap: ['arrow.up.arrow.down', 'swap_vert'],
  body: ['figure.strengthtraining.traditional', 'sports_gymnastics'],
  chart: ['chart.bar.fill', 'bar_chart'],
  edit: ['pencil', 'edit'],
  info: ['info.circle', 'info'],
  warning: ['exclamationmark.triangle.fill', 'warning'],
  moon: ['moon.fill', 'bedtime'],
  sun: ['sun.max.fill', 'self_improvement'],
  phone: ['iphone', 'settings'],
  person: ['person.fill', 'person'],
  flag: ['flag.fill', 'flag'],
  restart: ['arrow.counterclockwise', 'restart_alt'],
  chat: ['bubble.left.and.bubble.right.fill', 'chat'],
  brain: ['brain.head.profile', 'psychology'],
  heart: ['heart.fill', 'favorite'],
  target: ['scope', 'flag'],
  nutrition: ['fork.knife', 'restaurant'],
  camera: ['camera.fill', 'photo_camera'],
  photo: ['photo.fill', 'image'],
  star: ['star', 'star'],
  starFill: ['star.fill', 'star'],
  calendarDay: ['calendar.day.timeline.left', 'calendar_today'],
} as const satisfies Record<string, readonly [SFSymbol, AndroidSymbol]>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 20,
  color,
  weight = 'semibold',
  style,
}: {
  name: IconName;
  size?: number;
  color: ColorValue;
  weight?: SymbolWeight;
  style?: StyleProp<ViewStyle>;
}) {
  const [ios, android] = ICONS[name];
  return (
    <SymbolView
      name={{ ios, android, web: android }}
      size={size}
      tintColor={color}
      weight={weight}
      style={[{ width: size, height: size }, style]}
    />
  );
}

export function iconSymbols(name: IconName) {
  const [ios, android] = ICONS[name];
  return { sf: ios, md: android };
}
