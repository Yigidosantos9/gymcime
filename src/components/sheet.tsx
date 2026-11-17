import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BackHandler, Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';

import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { PressableScale, T } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';

/**
 * Uygulama genelinde alttan açılan sheet. Sistem `Alert` yerine kullanılır.
 *   sheet.actions({ title, message, actions: [...] })
 *   sheet.custom({ title, render: (close) => <... /> })
 */

export type SheetAction = {
  label: string;
  icon?: IconName;
  style?: 'default' | 'destructive' | 'primary';
  onPress?: () => void | Promise<void>;
};

type SheetConfig =
  | {
      kind: 'actions';
      title?: string;
      message?: string;
      actions: SheetAction[];
      cancelLabel?: string;
    }
  | {
      kind: 'custom';
      title?: string;
      render: (close: () => void) => ReactNode;
    };

type Api = {
  actions: (c: Omit<Extract<SheetConfig, { kind: 'actions' }>, 'kind'>) => void;
  custom: (c: Omit<Extract<SheetConfig, { kind: 'custom' }>, 'kind'>) => void;
  close: () => void;
};

/** iOS: ayrı pencere katmanı. Android: Stack'in üstünde tam ekran mutlak katman (son çizilen üstte kalır). */
function OverlayHost({ children }: { children: ReactNode }) {
  if (Platform.OS === 'ios') return <FullWindowOverlay>{children}</FullWindowOverlay>;
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 1000, elevation: 1000 }]} pointerEvents="box-none">
      {children}
    </View>
  );
}

const SheetCtx = createContext<Api | null>(null);

/**
 * Sheet, RN `Modal` yerine `FullWindowOverlay` ile çizilir (iOS'ta ayrı pencere katmanı).
 * Neden: Modal olarak açılınca, antrenman gibi native modal ekranların üstüne ikinci bir
 * modal biniyordu; buton işlemi ekranı kapatmaya çalışırken sheet'in modalı henüz
 * kapanmamışsa iOS kapatmayı reddediyor ve ekran takılı kalıyordu.
 * Overlay bir modal sunumu olmadığı için bu çakışma hiç oluşmaz.
 */
const CLOSE_MS = 220;

export function useSheet() {
  const v = useContext(SheetCtx);
  if (!v) throw new Error('SheetProvider eksik');
  return v;
}

export function SheetProvider({ children }: { children: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [config, setConfig] = useState<SheetConfig | null>(null);
  const y = useSharedValue(600);
  const fade = useSharedValue(0);
  const closing = useSharedValue(0);
  /** her show() artırır; eski kapanış zamanlayıcısı yeni sheet'i temizlemesin */
  const token = useSharedValue(0);

  const show = useCallback(
    (c: SheetConfig) => {
      Keyboard.dismiss(); // iOS'ta klavye penceresi overlay'in üstünde kalır
      token.set(token.get() + 1);
      closing.set(0);
      setConfig(c);
      y.set(600);
      fade.set(0);
      requestAnimationFrame(() => {
        y.set(withSpring(0, { damping: 22, stiffness: 240, mass: 0.9 }));
        fade.set(withTiming(1, { duration: 200 }));
      });
      haptic.light();
    },
    [y, fade, closing, token],
  );

  const close = useCallback((): Promise<void> => {
    if (closing.get() === 1) return Promise.resolve();
    closing.set(1);
    y.set(withTiming(600, { duration: CLOSE_MS, easing: Easing.in(Easing.quad) }));
    fade.set(withTiming(0, { duration: CLOSE_MS }));
    const myToken = token.get();
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        // bu arada yeni bir sheet açıldıysa onu silme
        if (token.get() === myToken) setConfig(null);
        resolve();
      }, CLOSE_MS + 10);
    });
  }, [y, fade, closing, token]);

  const runAction = useCallback(
    async (a: SheetAction) => {
      // çift dokunuşta işlemi iki kez çalıştırma
      if (closing.get() === 1) return;
      await close();
      await a.onPress?.();
    },
    [closing, close],
  );

  // Android geri tuşu sheet'i kapatsın
  useEffect(() => {
    if (config === null) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [config, close]);

  const api = useMemo<Api>(
    () => ({
      actions: (c) => show({ kind: 'actions', ...c }),
      custom: (c) => show({ kind: 'custom', ...c }),
      close,
    }),
    [show, close],
  );

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: y.get() }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: fade.get() }));

  return (
    <SheetCtx.Provider value={api}>
      {children}
      {config !== null && (
        <OverlayHost>
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.scrim }, backdropStyle]}>
              <Pressable style={StyleSheet.absoluteFill} onPress={close} />
            </Animated.View>
            <View style={styles.anchor} pointerEvents="box-none">
              <Animated.View
                style={[
                  styles.panel,
                  {
                    backgroundColor: t.surfaceRaised,
                    borderColor: t.borderStrong,
                    paddingBottom: insets.bottom + Spacing.md,
                  },
                  panelStyle,
                ]}>
                <View style={[styles.grabber, { backgroundColor: t.borderStrong }]} />
                {config?.title && (
                  <T variant="heading" style={{ textAlign: 'center', marginBottom: 2 }}>
                    {config.title}
                  </T>
                )}
                {config?.kind === 'actions' && (
                  <>
                    {config.message && (
                      <T
                        secondary
                        style={{
                          textAlign: 'center',
                          marginBottom: Spacing.sm,
                        }}>
                        {config.message}
                      </T>
                    )}
                    <View style={{ gap: Spacing.sm, marginTop: Spacing.md }}>
                      {config.actions.map((a, i) => {
                        const color =
                          a.style === 'destructive' ? t.danger : a.style === 'primary' ? t.onPrimary : t.text;
                        const bg =
                          a.style === 'destructive'
                            ? t.dangerSoft
                            : a.style === 'primary'
                              ? t.primary
                              : t.surfacePressed;
                        return (
                          <PressableScale
                            key={i}
                            onPress={() => runAction(a)}
                            style={[styles.action, { backgroundColor: bg }]}>
                            {a.icon && <Icon name={a.icon} size={17} color={color} />}
                            <T variant="heading" color={color} style={{ fontSize: 16 }}>
                              {a.label}
                            </T>
                          </PressableScale>
                        );
                      })}
                      <PressableScale onPress={close} style={styles.action}>
                        <T variant="heading" color={t.textSecondary} style={{ fontSize: 16 }}>
                          {config.cancelLabel ?? 'Vazgeç'}
                        </T>
                      </PressableScale>
                    </View>
                  </>
                )}
                {config?.kind === 'custom' && <View style={{ marginTop: Spacing.md }}>{config.render(close)}</View>}
              </Animated.View>
            </View>
          </View>
        </OverlayHost>
      )}
    </SheetCtx.Provider>
  );
}

const styles = StyleSheet.create({
  anchor: { flex: 1, justifyContent: 'flex-end' },
  panel: {
    marginHorizontal: 8,
    marginBottom: 8,
    borderRadius: Radius.xl + 4,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.lg,
    paddingTop: 10,
  },
  grabber: {
    width: 38,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  action: {
    height: 54,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
