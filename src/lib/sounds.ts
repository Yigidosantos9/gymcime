import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

/**
 * Mola sesleri. `playsInSilentMode: false` + `mixWithOthers` → iOS'ta `.ambient` kategori:
 * sessiz anahtarı açıksa ses çalmaz (sadece titreşim kalır), çalan müziği de kesmez.
 * Not: iOS, sessiz moda uyarken `duckOthers` kombinasyonunu reddeder.
 */
let ready = false;
let done: AudioPlayer | null = null;
let tick: AudioPlayer | null = null;

function ensure() {
  if (ready || Platform.OS === 'web') return;
  ready = true;
  setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
  try {
    done = createAudioPlayer(require('@/assets/sounds/rest-done.wav'));
    tick = createAudioPlayer(require('@/assets/sounds/tick.wav'));
    done.volume = 1.0;
    tick.volume = 0.85;
  } catch {
    done = null;
    tick = null;
  }
}

function play(p: AudioPlayer | null) {
  if (!p) return;
  try {
    p.seekTo(0).catch(() => {});
    p.play();
  } catch {
    // ses çalınamadıysa sessizce geç; titreşim yine çalışır
  }
}

export const sounds = {
  preload: ensure,
  restDone() {
    ensure();
    play(done);
  },
  tick() {
    ensure();
    play(tick);
  },
};
