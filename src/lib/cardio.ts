/**
 * Egzersiz türleri ve kardiyo/süreli hareket yardımcıları (saf fonksiyonlar).
 *  strength = kg × tekrar · bodyweight = tekrar (+ ek ağırlık) · cardio = süre + mesafe (+ eğim/seviye, kalori) · timed = süre
 */

export type ExerciseKind = 'strength' | 'bodyweight' | 'cardio' | 'timed';

export const EXERCISE_KINDS: { key: ExerciseKind; label: string; hint: string }[] = [
  { key: 'strength', label: 'Ağırlık', hint: 'kg × tekrar' },
  { key: 'bodyweight', label: 'Vücut ağırlığı', hint: 'tekrar (+ ek kg)' },
  { key: 'cardio', label: 'Kardiyo', hint: 'süre + mesafe' },
  { key: 'timed', label: 'Süreli', hint: 'süre (ör. plank)' },
];

export function normalizeKind(k: string | null | undefined): ExerciseKind {
  return k === 'bodyweight' || k === 'cardio' || k === 'timed' ? k : 'strength';
}

/** Süre tabanlı (tekrarsız) türler: kas/set/toparlanma/ağırlık önerisi hesaplarına girmez. */
export const isTimeBased = (k: string | null | undefined) => k === 'cardio' || k === 'timed';

// ───────────── Biçimlendirme / ayrıştırma ─────────────

/** 1230 → "20:30"; 3725 → "1:02:05". */
export function formatClock(sec: number | null | undefined) {
  if (sec == null || !Number.isFinite(sec)) return '–';
  const t = Math.max(0, Math.round(sec));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** "20:30" → 1230; "20" → 1200 (dakika); "1:02:05" → 3725; "20,5" → 1230. Geçersiz/0 → null. */
export function parseClock(text: string): number | null {
  const s = text.trim().replace(',', '.');
  if (!s) return null;
  if (s.includes(':')) {
    const parts = s.split(':');
    if (parts.length > 3 || parts.some((p) => !/^\d+$/.test(p.trim()))) return null;
    const n = parts.map((p) => Number(p));
    const sec = n.length === 3 ? n[0] * 3600 + n[1] * 60 + n[2] : n[0] * 60 + n[1];
    if (n.length >= 2 && n[n.length - 1] >= 60) return null;
    return sec > 0 ? sec : null;
  }
  if (!/^\d*\.?\d+$/.test(s)) return null;
  const sec = Math.round(Number(s) * 60);
  return sec > 0 ? sec : null;
}

/** Süreli hareket için "45 sn" / "1:30". */
export function formatHold(sec: number | null | undefined) {
  if (sec == null) return '–';
  return sec < 60 ? `${Math.round(sec)} sn` : formatClock(sec);
}

/** Metre → "3,2" (km). */
export function formatKm(m: number | null | undefined) {
  if (m == null || !Number.isFinite(m)) return '–';
  const km = Math.round(m / 10) / 100; // 2 basamak
  return String(km).replace('.', ',');
}

/** "3,2" → 3200 (metre). Geçersiz/0 → null. */
export function parseKm(text: string): number | null {
  const s = text.trim().replace(',', '.');
  if (!/^\d*\.?\d+$/.test(s)) return null;
  const m = Math.round(Number(s) * 1000);
  return m > 0 ? m : null;
}

/** Tempo: sn/km. */
export function paceOf(durationSec: number | null | undefined, distanceM: number | null | undefined) {
  if (!durationSec || !distanceM || durationSec <= 0 || distanceM <= 0) return null;
  return durationSec / (distanceM / 1000);
}

export function formatPace(secPerKm: number | null) {
  return secPerKm == null ? '–' : `${formatClock(secPerKm)} /km`;
}

/** Dakika → "1 sa 05 dk" / "42 dk". */
export function formatMin(totalMin: number) {
  const m = Math.round(totalMin);
  if (m < 60) return `${m} dk`;
  return `${Math.floor(m / 60)} sa ${String(m % 60).padStart(2, '0')} dk`;
}

// ───────────── Öneri ve rekor ─────────────

export type CardioSet = { duration_sec: number | null; distance_m: number | null };
export type CardioSession = { started_at: number; sets: CardioSet[] };

export type CardioSuggestion = {
  duration_sec: number | null;
  distance_m: number | null;
  reason: string;
};

/**
 * Basit öneri: geçen seansın en uzun setine göre süre +%10 (kardiyoda en az +1 dk, tam dakikaya yuvarlı).
 * Süreli harekette +5 sn (≥60 sn ise +10 sn). Mesafe aynı tempoyla orantılanır.
 */
export function suggestCardio(history: CardioSession[], kind: 'cardio' | 'timed'): CardioSuggestion {
  const last = history.find((h) => h.sets.some((s) => (s.duration_sec ?? 0) > 0));
  if (!last) {
    return kind === 'timed'
      ? { duration_sec: null, distance_m: null, reason: 'İlk kez: rahat tutabildiğin kadar dene.' }
      : { duration_sec: null, distance_m: null, reason: 'İlk kez: rahat bir tempoda başla, süreyi gir.' };
  }
  const best = last.sets.reduce((a, s) => ((s.duration_sec ?? 0) > (a.duration_sec ?? 0) ? s : a));
  const dur = best.duration_sec!;
  if (kind === 'timed') {
    const next = dur + (dur >= 60 ? 10 : 5);
    return { duration_sec: next, distance_m: null, reason: `Geçen sefer ${formatHold(dur)} → bugün ${formatHold(next)}` };
  }
  const nextMin = Math.round(dur / 60) + Math.max(1, Math.round((dur / 60) * 0.1));
  const next = nextMin * 60;
  const dist = best.distance_m && best.distance_m > 0 ? Math.round((best.distance_m * next) / dur / 100) * 100 : null;
  const prevTxt = `${formatMin(dur / 60)}${best.distance_m ? ` · ${formatKm(best.distance_m)} km` : ''}`;
  return {
    duration_sec: next,
    distance_m: dist,
    reason: `Geçen sefer ${prevTxt} → bugün ${formatMin(nextMin)}${dist ? ` · ${formatKm(dist)} km` : ''}`,
  };
}

export type CardioBests = { duration: number; distance: number; pace: number | null };

export const EMPTY_BESTS: CardioBests = { duration: 0, distance: 0, pace: null };

export function updateBests(b: CardioBests, s: CardioSet): CardioBests {
  const p = paceOf(s.duration_sec, s.distance_m);
  return {
    duration: Math.max(b.duration, s.duration_sec ?? 0),
    distance: Math.max(b.distance, s.distance_m ?? 0),
    pace: p != null && (b.pace == null || p < b.pace) ? p : b.pace,
  };
}

/**
 * Bir set önceki rekorları aşıyor mu? En uzun süre / en uzun mesafe / en hızlı tempo (kronolojik).
 * İlk kayıt rekor sayılmaz (karşılaştıracak geçmiş yok). Süreli harekette yalnızca süre.
 */
export function isCardioPr(prev: CardioBests, s: CardioSet, kind: 'cardio' | 'timed' = 'cardio') {
  if (prev.duration > 0 && (s.duration_sec ?? 0) > prev.duration) return true;
  if (kind === 'timed') return false;
  if (prev.distance > 0 && (s.distance_m ?? 0) > prev.distance) return true;
  const p = paceOf(s.duration_sec, s.distance_m);
  return prev.pace != null && p != null && p < prev.pace - 0.01;
}

/** Bir antrenmandaki kardiyo/süreli setleri "20:00 · 3,2 km · eğim 2" gibi özetler. */
export function describeCardioSet(
  s: { duration_sec: number | null; distance_m: number | null; level: number | null; kcal?: number | null },
  kind: 'cardio' | 'timed' = 'cardio',
) {
  const parts: string[] = [kind === 'timed' ? formatHold(s.duration_sec) : formatClock(s.duration_sec)];
  if (s.distance_m) parts.push(`${formatKm(s.distance_m)} km`);
  if (s.level) parts.push(`seviye ${String(s.level).replace('.', ',')}`);
  if (s.kcal) parts.push(`${Math.round(s.kcal)} kcal`);
  return parts.join(' · ');
}

/** Süreli hareket girişi: "45" → 45 sn, "1:30" → 90 sn. Geçersiz/0 → null. */
export function parseHold(text: string): number | null {
  const s = text.trim();
  if (!s) return null;
  if (s.includes(':')) return parseClock(s);
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? n : null;
}

/** Rekor kıran bir seti metne çevirir: ["En uzun süre 25:00", "En uzun mesafe 4,2 km", "En hızlı tempo 5:40 /km"]. */
export function cardioPrTexts(prev: CardioBests, s: CardioSet, kind: 'cardio' | 'timed' = 'cardio'): string[] {
  const out: string[] = [];
  if (prev.duration > 0 && (s.duration_sec ?? 0) > prev.duration) {
    out.push(`En uzun süre ${kind === 'timed' ? formatHold(s.duration_sec) : formatClock(s.duration_sec)}`);
  }
  if (kind === 'timed') return out;
  if (prev.distance > 0 && (s.distance_m ?? 0) > prev.distance) out.push(`En uzun mesafe ${formatKm(s.distance_m)} km`);
  const p = paceOf(s.duration_sec, s.distance_m);
  if (prev.pace != null && p != null && p < prev.pace - 0.01) out.push(`En hızlı tempo ${formatPace(p)}`);
  return out;
}
