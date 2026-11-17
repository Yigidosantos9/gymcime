import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Line, Path, Rect, Stop } from 'react-native-svg';

import { T } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';

function useWidth() {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  return { width, onLayout };
}

/** Catmull-Rom → kübik bezier: yumuşak çizgi. */
function smoothPath(pts: { x: number; y: number }[]) {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const t = 0.18;
    const c1x = p1.x + (p2.x - p0.x) * t;
    const c1y = p1.y + (p2.y - p0.y) * t;
    const c2x = p2.x - (p3.x - p1.x) * t;
    const c2y = p2.y - (p3.y - p1.y) * t;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function LineChart({
  values,
  height = 160,
  formatValue = (v) => String(Math.round(v)),
  labels,
}: {
  values: number[];
  height?: number;
  formatValue?: (v: number) => string;
  labels?: string[];
}) {
  const t = useTheme();
  const { width, onLayout } = useWidth();
  const [active, setActive] = useState<number | null>(null);

  const padX = 10;
  const padTop = 16;
  const padBottom = 10;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, max);
  const range = max - min || max * 0.1 || 1;
  const lo = min - range * 0.15;
  const hi = max + range * 0.15;
  const innerW = Math.max(1, width - padX * 2);
  const innerH = height - padTop - padBottom;

  const pts = values.map((v, i) => ({
    x: padX + (values.length === 1 ? innerW / 2 : (i / (values.length - 1)) * innerW),
    y: padTop + innerH - ((v - lo) / (hi - lo)) * innerH,
  }));
  const line = smoothPath(pts);
  const area = pts.length > 1 ? `${line} L ${pts[pts.length - 1].x} ${height} L ${pts[0].x} ${height} Z` : '';
  const sel = active ?? values.length - 1;

  return (
    <View onLayout={onLayout}>
      {values.length > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
          <T variant="num" color={t.primary}>
            {formatValue(values[sel])}
          </T>
          {labels?.[sel] && (
            <T variant="caption" secondary>
              {labels[sel]}
            </T>
          )}
        </View>
      )}
      {width > 0 && (
        <View
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(e) => pick(e.nativeEvent.locationX)}
          onResponderMove={(e) => pick(e.nativeEvent.locationX)}
          onResponderRelease={() => setActive(null)}>
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={t.primary} stopOpacity={0.28} />
                <Stop offset="1" stopColor={t.primary} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {[0.25, 0.5, 0.75].map((f) => (
              <Line
                key={f}
                x1={padX}
                x2={width - padX}
                y1={padTop + innerH * f}
                y2={padTop + innerH * f}
                stroke={t.border}
                strokeDasharray="3 5"
              />
            ))}
            {area ? <Path d={area} fill="url(#area)" /> : null}
            <Path d={line} stroke={t.primary} strokeWidth={3} fill="none" strokeLinecap="round" />
            {pts[sel] && (
              <>
                <Line x1={pts[sel].x} x2={pts[sel].x} y1={padTop} y2={height} stroke={t.primary} strokeOpacity={0.25} />
                <Circle cx={pts[sel].x} cy={pts[sel].y} r={7} fill={t.surface} stroke={t.primary} strokeWidth={3} />
              </>
            )}
          </Svg>
        </View>
      )}
    </View>
  );

  function pick(x: number) {
    if (pts.length === 0) return;
    let best = 0;
    for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i].x - x) < Math.abs(pts[best].x - x)) best = i;
    setActive(best);
  }
}

export function BarChart({
  values,
  labels,
  height = 120,
  highlightLast = true,
}: {
  values: number[];
  labels: string[];
  height?: number;
  highlightLast?: boolean;
}) {
  const t = useTheme();
  const { width, onLayout } = useWidth();
  const max = Math.max(...values, 1);
  const n = values.length;
  const gap = 8;
  const barW = n > 0 ? Math.max(4, (width - gap * (n - 1)) / n) : 0;

  return (
    <View onLayout={onLayout}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {values.map((v, i) => {
            const h = Math.max(v > 0 ? 6 : 3, (v / max) * (height - 4));
            const isLast = highlightLast && i === n - 1;
            return (
              <Rect
                key={i}
                x={i * (barW + gap)}
                y={height - h}
                width={barW}
                height={h}
                rx={Math.min(8, barW / 2)}
                fill={v === 0 ? t.surfacePressed : isLast ? t.primary : t.primarySoft}
              />
            );
          })}
        </Svg>
      )}
      <View style={{ flexDirection: 'row', gap, marginTop: 6 }}>
        {labels.map((l, i) => (
          <T key={i} variant="caption" muted style={{ width: barW, textAlign: 'center', fontSize: 10 }} numberOfLines={1}>
            {l}
          </T>
        ))}
      </View>
    </View>
  );
}
