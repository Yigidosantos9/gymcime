import { useFocusEffect } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useState } from 'react';

/**
 * Ekran her odaklandığında sorguyu yeniden çalıştırır.
 * `reload()` ile elle tazelenebilir (ör. bir set güncellendikten sonra).
 * `deps`, sorgunun bağlı olduğu değerlerdir (ör. route parametresi).
 */
export function useDbQuery<T>(fn: (db: SQLiteDatabase) => Promise<T>, deps: unknown[] = []) {
  const db = useSQLiteContext();
  const [data, setData] = useState<T | undefined>(undefined);

  const key = JSON.stringify(deps);

  const reload = useCallback(async () => {
    const result = await fn(db);
    setData(result);
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
