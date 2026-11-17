import * as Haptics from 'expo-haptics';
import { Platform, Vibration } from 'react-native';

const enabled = Platform.OS !== 'web';

export const haptic = {
  tap: () => enabled && Haptics.selectionAsync().catch(() => {}),
  light: () => enabled && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  medium: () => enabled && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  heavy: () => enabled && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}),
  success: () => enabled && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warning: () => enabled && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
  /**
   * Mola bitişi: telefon cebindeyken de hissedilecek uzun, belirgin titreşim.
   * Alarm sesiyle aynı uzunlukta (~3 sn): iOS'ta sistem titreşimi (~0,4 sn) beş kez; Android'de 5 × 500 ms.
   * Sessiz modda da çalışır (iOS "Sessizde titreşim" açıksa).
   */
  alarm: () => {
    if (!enabled) return;
    if (Platform.OS === 'ios') {
      // iOS: dizi = titreşimler arası bekleme süreleri, her titreşim sabit ~400 ms
      Vibration.vibrate([0, 600, 600, 600, 600]);
    } else {
      Vibration.vibrate([0, 500, 180, 500, 180, 500, 180, 500, 180, 700]);
    }
  },
};
