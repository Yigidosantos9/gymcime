import { View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Rect } from 'react-native-svg';

import { T } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/components/language-provider';

/**
 * Stilize ön/arka vücut haritası. Her kas grubu 0–1 arası bir değerle boyanır.
 * Kas adları `db/seed.ts` içindeki MUSCLES ile aynıdır.
 */
export type MuscleValues = Partial<Record<string, number>>;

const BACK_MUSCLES = new Set(['Sırt', 'Triceps', 'Kalça']);

function useHeat() {
  const t = useTheme();
  return (v: number | undefined) => {
    if (!v || v <= 0) return t.surfacePressed;
    const stops = t.heat;
    const idx = Math.min(stops.length - 1, Math.max(1, Math.ceil(v * (stops.length - 1))));
    return stops[idx];
  };
}

function Figure({
  side,
  values,
  size,
  viewBox = '0 0 120 240',
  width,
}: {
  side: 'front' | 'back';
  values: MuscleValues;
  size: number;
  viewBox?: string;
  width?: number;
}) {
  const t = useTheme();
  const heat = useHeat();
  const neutral = t.surfacePressed;
  const c = (m: string) => heat(values[m]);
  const stroke = t.background;
  const sw = 1.6;
  const common = { stroke, strokeWidth: sw };

  return (
    <Svg width={width ?? size * 0.5} height={size} viewBox={viewBox}>
      {/* baş ve boyun */}
      <Circle cx={60} cy={20} r={14} fill={neutral} {...common} />
      <Rect x={53} y={32} width={14} height={12} rx={5} fill={neutral} {...common} />

      {/* omuzlar */}
      <Ellipse cx={33} cy={56} rx={13} ry={11} fill={c('Omuz')} {...common} />
      <Ellipse cx={87} cy={56} rx={13} ry={11} fill={c('Omuz')} {...common} />

      {side === 'front' ? (
        <>
          {/* göğüs */}
          <Rect x={39} y={46} width={21} height={26} rx={9} fill={c('Göğüs')} {...common} />
          <Rect x={60} y={46} width={21} height={26} rx={9} fill={c('Göğüs')} {...common} />
          {/* biceps */}
          <Rect x={19} y={66} width={13} height={30} rx={6.5} fill={c('Biceps')} {...common} />
          <Rect x={88} y={66} width={13} height={30} rx={6.5} fill={c('Biceps')} {...common} />
          {/* karın */}
          <Rect x={44} y={74} width={32} height={42} rx={9} fill={c('Karın')} {...common} />
          <G stroke={stroke} strokeWidth={1.2} opacity={0.6}>
            <Line x1={60} y1={78} x2={60} y2={112} />
            <Line x1={47} y1={88} x2={73} y2={88} />
            <Line x1={47} y1={100} x2={73} y2={100} />
          </G>
          {/* pelvis */}
          <Rect x={42} y={116} width={36} height={16} rx={8} fill={neutral} {...common} />
        </>
      ) : (
        <>
          {/* üst sırt + lat */}
          <Rect x={39} y={44} width={42} height={32} rx={11} fill={c('Sırt')} {...common} />
          <Rect x={43} y={76} width={34} height={26} rx={9} fill={c('Sırt')} {...common} />
          <Rect x={48} y={102} width={24} height={13} rx={6} fill={c('Sırt')} {...common} />
          {/* triceps */}
          <Rect x={19} y={66} width={13} height={30} rx={6.5} fill={c('Triceps')} {...common} />
          <Rect x={88} y={66} width={13} height={30} rx={6.5} fill={c('Triceps')} {...common} />
          {/* kalça */}
          <Ellipse cx={50} cy={125} rx={11} ry={12} fill={c('Kalça')} {...common} />
          <Ellipse cx={70} cy={125} rx={11} ry={12} fill={c('Kalça')} {...common} />
        </>
      )}

      {/* ön kollar */}
      <Rect x={15} y={98} width={12} height={32} rx={6} fill={neutral} {...common} />
      <Rect x={93} y={98} width={12} height={32} rx={6} fill={neutral} {...common} />

      {/* bacaklar */}
      <Rect x={41} y={136} width={18} height={52} rx={9} fill={c('Bacak')} {...common} />
      <Rect x={61} y={136} width={18} height={52} rx={9} fill={c('Bacak')} {...common} />
      <Rect x={43} y={191} width={14} height={40} rx={7} fill={c('Bacak')} {...common} />
      <Rect x={63} y={191} width={14} height={40} rx={7} fill={c('Bacak')} {...common} />
    </Svg>
  );
}

export function BodyMap({ values, size = 220, labels = true }: { values: MuscleValues; size?: number; labels?: boolean }) {
  const _ = useT();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: size * 0.08 }}>
      <View style={{ alignItems: 'center', gap: 4 }}>
        <Figure side="front" values={values} size={size} />
        {labels && (
          <T variant="caption" muted>{_('bodyMap.front')}</T>
        )}
      </View>
      <View style={{ alignItems: 'center', gap: 4 }}>
        <Figure side="back" values={values} size={size} />
        {labels && (
          <T variant="caption" muted>{_('bodyMap.back2')}</T>
        )}
      </View>
    </View>
  );
}

/** Kasın bulunduğu bölgeye yakınlaştırılmış görünüm (x y w h, kare). */
const ZOOM: Record<string, string> = {
  Göğüs: '22 30 76 76',
  Omuz: '14 30 92 92',
  Biceps: '10 40 100 100',
  Karın: '26 46 68 68',
  Sırt: '18 34 84 84',
  Triceps: '10 40 100 100',
  Kalça: '28 96 64 64',
  Bacak: '18 130 84 106',
  Kardiyo: '0 0 120 240',
};

/** Tek bir kası vurgulayan küçük ikon (egzersiz listeleri için). */
export function MuscleIcon({ muscle, size = 40 }: { muscle: string; size?: number }) {
  const t = useTheme();
  const side = BACK_MUSCLES.has(muscle) ? 'back' : 'front';
  const vb = ZOOM[muscle] ?? '0 0 120 240';
  const inner = size * 0.82;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: t.surfaceRaised,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
      <Figure side={side} values={{ [muscle]: 1 }} size={inner} width={inner} viewBox={vb} />
    </View>
  );
}

/** Kas → 0-1 yoğunluk için legend. */
export function HeatLegend() {
  const _ = useT();
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
      <T variant="caption" muted>{_('bodyMap.low')}</T>
      {t.heat.map((c) => (
        <View key={c} style={{ width: 16, height: 8, borderRadius: 4, backgroundColor: c }} />
      ))}
      <T variant="caption" muted>{_('bodyMap.high')}</T>
    </View>
  );
}
