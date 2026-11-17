import { router } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { useSheet } from '@/components/sheet';
import { getActiveWorkout, startWorkout } from '@/db/queries';
import { haptic } from '@/lib/haptics';

/** Yeni antrenman başlatır; zaten devam eden varsa ona yönlendirir. */
export async function beginWorkout(db: SQLiteDatabase, routineId: number | null, sheet: ReturnType<typeof useSheet>) {
  const active = await getActiveWorkout(db);
  if (active) {
    sheet.actions({
      title: 'Devam eden antrenman var',
      message: `"${active.name}" hâlâ açık.`,
      actions: [{ label: 'Ona devam et', icon: 'play', style: 'primary', onPress: () => router.push(`/workout/${active.id}`) }],
    });
    return;
  }
  haptic.medium();
  const id = await startWorkout(db, routineId);
  router.push(`/workout/${id}`);
}
