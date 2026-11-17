import { getExerciseMedia, muscleTr } from '@/db/exercise-media';
import type { ExerciseKind } from '@/lib/cardio';
import { normalizeTr } from '@/lib/food-search';

export type LibraryExercise = {
  id: number;
  slug: string | null;
  name: string;
  muscle: string;
  equipment: string;
  alias: string | null;
  kind: ExerciseKind;
};

/** Tür filtresi: "Ağırlık / Vücut ağırlığı / Kardiyo / Süreli" — null = hepsi. */
export type LibraryFilter = { q?: string; muscle?: string | null; kind?: ExerciseKind | null };

/**
 * Kütüphane araması: İngilizce ad + Türkçe takma ad + kas (grup ve ikincil/birincil Türkçe kas adları) + ekipman.
 * Aksan/Türkçe karakter duyarsız; tüm sözcükler eşleşmeli. Sıra korunur.
 */
export function filterExercises<T extends LibraryExercise>(list: T[], f: LibraryFilter): T[] {
  const tokens = normalizeTr(f.q ?? '').split(' ').filter(Boolean);
  return list.filter((e) => {
    if (f.muscle && e.muscle !== f.muscle) return false;
    if (f.kind && e.kind !== f.kind) return false;
    if (tokens.length === 0) return true;
    const media = getExerciseMedia(e.slug);
    const hay = normalizeTr(
      [e.name, e.alias ?? '', e.muscle, e.equipment, ...(media ? [...media.primary, ...media.secondary].map(muscleTr) : [])].join(' '),
    );
    return tokens.every((tok) => hay.includes(tok));
  });
}
