import { useFocusEffect } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';

import { createRequestGate } from '@/lib/request-gate';

/**
 * Ekran her odaklandığında sorguyu yeniden çalıştırır.
 * `reload()` ile elle tazelenebilir (ör. bir set güncellendikten sonra).
 * `deps`, sorgunun bağlı olduğu değerlerdir (ör. route parametresi).
 */
export function useDbQuery<T>(fn: (db: SQLiteDatabase) => Promise<T>, deps: unknown[] = []) {
  const db = useSQLiteContext();
  const [data, setData] = useState<T | undefined>(undefined);

  const key = JSON.stringify(deps);
  /** Yavaş dönen eski bir reload(), daha yeni olanın sonucunu ezmesin. */
  const gate = useRef(createRequestGate());

  const reload = useCallback(async () => {
    const token = gate.current.begin();
    const result = await fn(db);
    if (gate.current.isLatest(token)) setData(result);
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, key]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { data, reload, db };
}
