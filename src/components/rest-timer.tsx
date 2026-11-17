import * as Notifications from 'expo-notifications';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { PressableScale, Ring, T } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration } from '@/lib/format';
import { getProfile } from '@/db/queries';
import { haptic } from '@/lib/haptics';
import { sounds } from '@/lib/sounds';
import { useT } from '@/components/language-provider';

// Uygulama öndeyken bildirimi gösterme (sayaç zaten ekranda); yalnızca arka planda görünür.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

type RestState = { endsAt: number; total: number; next?: string } | null;

type Prefs = { soundOn: boolean; hapticOn: boolean };

type Ctx = {
  rest: RestState;
  prefs: Prefs;
  start: (seconds: number, next?: string) => void;
  /** Sıradaki set bilgisini güncelle (ör. zorluk seçilince öneri değişir) */
  updateNext: (next?: string) => void;
  adjust: (deltaSeconds: number) => void;
  stop: () => void;
};

const RestCtx = createContext<Ctx | null>(null);

let permissionAsked = false;
async function ensurePermission() {
  if (Platform.OS === 'web') return false;
  try {
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    if (permissionAsked) return false;
    permissionAsked = true;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}

export function RestTimerProvider({ children }: { children: ReactNode }) {
  const _ = useT();
  const db = useSQLiteContext();
  const [rest, setRest] = useState<RestState>(null);
  const [prefs, setPrefs] = useState<Prefs>({ soundOn: true, hapticOn: true });
  const notifId = useRef<string | null>(null);
  /** start/adjust/stop her çağrıldığında artar; async iş bittiğinde hâlâ güncel mi diye bakılır */
  const generation = useRef(0);
  /** updateNext güncel durumu kapanıştan değil ref'ten okur (bağımlılık değişip tekrar çağrılmasın) */
  const restRef = useRef<RestState>(null);
  const prefsRef = useRef<Prefs>({ soundOn: true, hapticOn: true });
  useEffect(() => {
    restRef.current = rest;
    prefsRef.current = prefs;
  }, [rest, prefs]);

  const cancelNotif = useCallback(async () => {
    const id = notifId.current;
    notifId.current = null;
    if (id) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  }, []);

  const scheduleNotif = useCallback(
    async (gen: number, endsAt: number, next?: string, soundOn = true) => {
      await cancelNotif();
      const seconds = Math.round((endsAt - Date.now()) / 1000);
      if (seconds < 3 || !(await ensurePermission())) return;
      if (gen !== generation.current) return;
      try {
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: _('restTimer.rest_over'),
            body: next ? _('restTimer.next', { next: next }) : _('restTimer.on_to_the_next_set'),
            sound: soundOn,
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
        });
        if (gen !== generation.current) {
          // bu arada mola durduruldu/değişti → eski bildirimi hemen iptal et
          await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
          return;
        }
        if (notifId.current && notifId.current !== id) {
          await Notifications.cancelScheduledNotificationAsync(notifId.current).catch(() => {});
        }
        notifId.current = id;
      } catch {
        notifId.current = null;
      }
    },
    [cancelNotif, _],
  );

  const start = useCallback(
    (seconds: number, next?: string) => {
      const gen = ++generation.current;
      if (seconds <= 0) {
        setRest(null);
        cancelNotif();
        return;
      }
      const endsAt = Date.now() + seconds * 1000;
      setRest({ endsAt, total: seconds * 1000, next });
      sounds.preload();
      // ayarları her molada tazele (Ayarlar'dan değişmiş olabilir)
      getProfile(db).then((p) => {
        if (gen !== generation.current) return;
        const nextPrefs = { soundOn: p?.soundOn ?? true, hapticOn: p?.hapticOn ?? true };
        setPrefs(nextPrefs);
        scheduleNotif(gen, endsAt, next, nextPrefs.soundOn);
      });
    },
    [cancelNotif, scheduleNotif, db],
  );

  const adjust = useCallback(
    (delta: number) => {
      if (!rest) return;
      const gen = ++generation.current;
      const endsAt = Math.max(Date.now() + 1000, rest.endsAt + delta * 1000);
      setRest({ ...rest, endsAt, total: Math.max(1000, rest.total + delta * 1000) });
      scheduleNotif(gen, endsAt, rest.next, prefs.soundOn);
    },
    [rest, scheduleNotif, prefs.soundOn],
  );

  const updateNext = useCallback(
    (next?: string) => {
      const r = restRef.current;
      if (!r || r.next === next) return;
      // metin değişti: bildirim gövdesi de güncellensin (eski bildirimi iptal edip yeniden planla)
      restRef.current = { ...r, next };
      setRest(restRef.current);
      const gen = ++generation.current;
      scheduleNotif(gen, r.endsAt, next, prefsRef.current.soundOn);
    },
    [scheduleNotif],
  );

  const stop = useCallback(() => {
    generation.current++;
    setRest(null);
    cancelNotif();
  }, [cancelNotif]);

  const value = useMemo(() => ({ rest, prefs, start, updateNext, adjust, stop }), [rest, prefs, start, updateNext, adjust, stop]);
  return <RestCtx.Provider value={value}>{children}</RestCtx.Provider>;
}

export function useRestTimer() {
  const v = useContext(RestCtx);
  if (!v) throw new Error('RestTimerProvider missing');
  return v;
}

/** Antrenman ekranının altında yüzen dinlenme sayacı. */
export function RestTimerBar({ bottom }: { bottom: number }) {
  const _ = useT();
  const t = useTheme();
  const { rest, prefs, adjust, stop } = useRestTimer();
  const [now, setNow] = useState(() => Date.now());
  const lastTick = useRef<number | null>(null);
  const endsAt = rest?.endsAt ?? null;

  useEffect(() => {
    if (endsAt == null) return;
    lastTick.current = null; // yeni mola (veya ±15) → geri sayım tıkları baştan
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);
      const leftSec = Math.ceil((endsAt - n) / 1000);
      // son 3 saniye: tık + hafif titreşim (saniyede bir)
      if (leftSec >= 1 && leftSec <= 3 && lastTick.current !== leftSec) {
        lastTick.current = leftSec;
        if (prefs.soundOn) sounds.tick();
        if (prefs.hapticOn) haptic.heavy();
      }
      if (n >= endsAt) {
        // Uygulama arka plandayken süre dolduysa bildirim zaten çaldı → geç kalmış ding çalma
        const late = n - endsAt > 1500;
        if (!late && prefs.soundOn) sounds.restDone();
        if (!late && prefs.hapticOn) haptic.alarm();
        stop();
      }
    }, 200);
    return () => clearInterval(id);
  }, [endsAt, stop, prefs]);

  if (!rest) return null;
  const left = Math.max(0, rest.endsAt - now);
  const progress = 1 - left / rest.total;
  const almost = left <= 10000;

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(17)}
      exiting={FadeOutDown.duration(180)}
      style={[styles.wrap, { bottom, backgroundColor: t.surfaceRaised, borderColor: t.borderStrong, shadowColor: t.shadow }]}>
      <Ring progress={progress} size={58} stroke={5} color={almost ? t.accent : t.primary}>
        <Icon name="timer" size={18} color={almost ? t.accent : t.primary} />
      </Ring>
      <View style={{ flex: 1 }}>
        <T variant="overline" secondary>{_('restTimer.rest')}</T>
        <T variant="num" style={{ fontSize: 28, lineHeight: 32 }} color={almost ? t.accent : t.text}>
          {formatDuration(left)}
        </T>
        {rest.next && (
          <T variant="caption" muted numberOfLines={1}>{_('restTimer.next', { next: rest.next })}
          </T>
        )}
      </View>
      <PressableScale onPress={() => adjust(-15)} style={[styles.adj, { backgroundColor: t.surfacePressed }]}>
        <T variant="label">−15</T>
      </PressableScale>
      <PressableScale onPress={() => adjust(15)} style={[styles.adj, { backgroundColor: t.surfacePressed }]}>
        <T variant="label">+15</T>
      </PressableScale>
      <PressableScale onPress={stop} style={[styles.adj, { backgroundColor: t.primary }]}>
        <Icon name="skip" size={15} color={t.onPrimary} />
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  adj: { height: 42, minWidth: 46, borderRadius: 21, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
});
