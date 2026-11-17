import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture, type PanGestureActiveEvent } from 'react-native-gesture-handler';
import Animated, {
  scrollTo,
  useAnimatedReaction,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withTiming,
  type AnimatedRef,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon } from '@/components/icon';
import { useTheme } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';
import { useT } from '@/components/language-provider';

/**
 * Sürükle-bırak ile sıralanan dikey liste (yeni paket gerekmez: gesture-handler + reanimated).
 * Kaydırma, ebeveyn `Animated.ScrollView`'dan gelir (`scrollRef`, `scrollY`); sürüklerken kenara yaklaşınca otomatik kayar.
 * Tutamaç (≡) uzun basılıp sürüklenir; ekran okuyucu için "yukarı/aşağı taşı" eylemleri vardır.
 */

type Shared = {
  active: SharedValue<number>;
  over: SharedValue<number>;
  finger: SharedValue<number>;
  startScroll: SharedValue<number>;
  tops: SharedValue<number[]>;
  heights: SharedValue<number[]>;
  scrollY: SharedValue<number>;
  autoDir: SharedValue<number>;
};

type Props<T> = {
  data: T[];
  keyOf: (item: T) => string;
  onReorder: (from: number, to: number) => void;
  renderItem: (item: T, index: number, handle: ReactNode) => ReactNode;
  scrollRef: AnimatedRef<Animated.ScrollView>;
  scrollY: SharedValue<number>;
  /** kaydırılabilir en büyük offset (içerik yüksekliği − görünür yükseklik); otomatik kaydırma bunu aşmaz */
  maxScrollY: SharedValue<number>;
  /** sürükleme başlayınca/bitince (ör. ScrollView'ı kilitlemek için) */
  onDragChange?: (dragging: boolean) => void;
};

const EDGE = 130;
const SPEED = 520; // px/sn

export function DragList<T>({ data, keyOf, onReorder, renderItem, scrollRef, scrollY, maxScrollY, onDragChange }: Props<T>) {
  const active = useSharedValue(-1);
  const over = useSharedValue(-1);
  const finger = useSharedValue(0);
  const startScroll = useSharedValue(0);
  const tops = useSharedValue<number[]>([]);
  const heights = useSharedValue<number[]>([]);
  const autoDir = useSharedValue(0);
  const layouts = useRef<{ y: number; h: number }[]>([]);

  const shared: Shared = { active, over, finger, startScroll, tops, heights, scrollY, autoDir };

  // sürüklenen satırın toplam kayması = parmak + (otomatik kaymayla değişen scroll)
  const drag = useAnimatedStyleValue(finger, scrollY, startScroll);

  useAnimatedReaction(
    () => drag.get(),
    (d) => {
      const a = active.get();
      if (a < 0) return;
      const tp = tops.get();
      const hs = heights.get();
      if (!tp[a] && tp[a] !== 0) return;
      const center = tp[a] + (hs[a] ?? 0) / 2 + d;
      let idx = tp.length - 1;
      for (let i = 0; i < tp.length; i++) {
        if (center < tp[i] + (hs[i] ?? 0)) {
          idx = i;
          break;
        }
      }
      if (idx !== over.get()) over.set(idx);
    },
  );

  const height = Dimensions.get('window').height;
  useFrameCallback((info) => {
    'worklet';
    const dir = autoDir.get();
    if (active.get() < 0 || dir === 0) return;
    const dt = (info.timeSincePreviousFrame ?? 16) / 1000;
    scrollTo(scrollRef, 0, Math.min(Math.max(0, maxScrollY.get()), Math.max(0, scrollY.get() + dir * SPEED * dt)), false);
  });

  const onLayoutRow = useCallback(
    (i: number, y: number, h: number) => {
      layouts.current[i] = { y, h };
      tops.set(layouts.current.slice(0, data.length).map((l) => l?.y ?? 0));
      heights.set(layouts.current.slice(0, data.length).map((l) => l?.h ?? 0));
    },
    [data.length, tops, heights],
  );

  const resetDrag = useCallback(() => {
    active.set(-1);
    over.set(-1);
    finger.set(0);
    autoDir.set(0);
  }, [active, over, finger, autoDir]);

  // Yeni sıra props'a yansıyınca (satırlar yeni yerinde) sürükleme durumunu sıfırla: bir kare sıçrama olmaz
  const order = data.map(keyOf).join('|');
  const pendingReset = useRef(false);
  useEffect(() => {
    if (pendingReset.current) {
      pendingReset.current = false;
      resetDrag();
    }
  }, [order, resetDrag]);

  const finish = useCallback(
    (from: number, to: number) => {
      onDragChange?.(false);
      if (from !== to && to >= 0) {
        haptic.success();
        pendingReset.current = true;
        onReorder(from, to);
        // sıra değişmezse (ebeveyn reddetti) yine de sıfırla
        setTimeout(() => {
          if (pendingReset.current) {
            pendingReset.current = false;
            resetDrag();
          }
        }, 400);
      } else {
        resetDrag();
      }
    },
    [onReorder, onDragChange, resetDrag],
  );
  const started = useCallback(() => {
    haptic.medium();
    onDragChange?.(true);
  }, [onDragChange]);

  return (
    <View>
      {data.map((item, i) => (
        <Row
          key={keyOf(item)}
          index={i}
          count={data.length}
          shared={shared}
          drag={drag}
          windowHeight={height}
          onLayoutRow={onLayoutRow}
          onStart={started}
          onFinish={finish}
          onMove={onReorder}>
          {(handle) => renderItem(item, i, handle)}
        </Row>
      ))}
    </View>
  );
}

/** parmak kayması + scroll farkı */
function useAnimatedStyleValue(finger: SharedValue<number>, scrollY: SharedValue<number>, startScroll: SharedValue<number>) {
  const out = useSharedValue(0);
  useAnimatedReaction(
    () => finger.get() + scrollY.get() - startScroll.get(),
    (v) => out.set(v),
  );
  return out;
}

function Row({
  index,
  count,
  shared,
  drag,
  windowHeight,
  onLayoutRow,
  onStart,
  onFinish,
  onMove,
  children,
}: {
  index: number;
  count: number;
  shared: Shared;
  drag: SharedValue<number>;
  windowHeight: number;
  onLayoutRow: (i: number, y: number, h: number) => void;
  onStart: () => void;
  onFinish: (from: number, to: number) => void;
  onMove: (from: number, to: number) => void;
  children: (handle: ReactNode) => ReactNode;
}) {
  const _ = useT();
  const t = useTheme();
  const { active, over, finger, startScroll, scrollY, heights, autoDir } = shared;

  const handleStart = useCallback(
    (e: PanGestureActiveEvent) => {
      'worklet';
      void e;
      active.set(index);
      over.set(index);
      finger.set(0);
      startScroll.set(scrollY.get());
      scheduleOnRN(onStart);
    },
    [active, over, finger, startScroll, scrollY, index, onStart],
  );
  const handleUpdate = useCallback(
    (e: PanGestureActiveEvent) => {
      'worklet';
      if (active.get() !== index) return;
      finger.set(e.translationY);
      autoDir.set(e.absoluteY < EDGE + 60 ? -1 : e.absoluteY > windowHeight - EDGE ? 1 : 0);
    },
    [active, finger, autoDir, index, windowHeight],
  );
  const handleEnd = useCallback(() => {
    'worklet';
    if (active.get() !== index) return;
    scheduleOnRN(onFinish, index, over.get());
  }, [active, over, index, onFinish]);

  const config = useMemo(
    () => ({
      activateAfterLongPress: 180,
      onActivate: handleStart,
      onUpdate: handleUpdate,
      onFinalize: handleEnd,
    }),
    [handleStart, handleUpdate, handleEnd],
  );
  const pan = usePanGesture(config);

  const style = useAnimatedStyle(() => {
    const a = active.get();
    if (a < 0) return { transform: [{ translateY: 0 }], zIndex: 0, opacity: 1 };
    if (a === index) return { transform: [{ translateY: drag.get() }], zIndex: 20, opacity: 0.96 };
    const o = over.get();
    const h = heights.get()[a] ?? 0;
    let ty = 0;
    if (a < o && index > a && index <= o) ty = -h;
    else if (a > o && index < a && index >= o) ty = h;
    return { transform: [{ translateY: withTiming(ty, { duration: 140 }) }], zIndex: 0, opacity: 1 };
  });

  const handle = (
    <GestureDetector gesture={pan}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={_('dragList.change_order')}
        accessibilityHint={_('dragList.swipe_up_or_down_to')}
        accessibilityActions={[
          { name: 'increment', label: _('dragList.move_down') },
          { name: 'decrement', label: _('common.move_up') },
        ]}
        onAccessibilityAction={(ev) => {
          if (ev.nativeEvent.actionName === 'increment' && index < count - 1) onMove(index, index + 1);
          if (ev.nativeEvent.actionName === 'decrement' && index > 0) onMove(index, index - 1);
        }}
        hitSlop={8}
        style={styles.handle}>
        <Icon name="grip" size={18} color={t.textMuted} />
      </View>
    </GestureDetector>
  );

  return (
    <Animated.View style={style} onLayout={(e) => onLayoutRow(index, e.nativeEvent.layout.y, e.nativeEvent.layout.height)}>
      {children(handle)}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  handle: { width: 30, height: 40, alignItems: 'center', justifyContent: 'center' },
});
