import type { SQLiteDatabase } from 'expo-sqlite';

import { applyDataMigrations, DB_VERSION } from './migrate';

/**
 * Yedekleme: tüm tablolar sürümlü JSON'a. API anahtarı DB'de değil SecureStore'da olduğu için zaten dışarıdadır;
 * `settings` tablosunda anahtar benzeri bir kayıt olsa bile (savunma amaçlı) yedeğe alınmaz.
 */

export const BACKUP_APP = 'gymcime';
export const BACKUP_FORMAT = 1;

/** Bağımlılık sırası: üstteki tablolar altlardan önce yazılır (silerken tersi). */
export const BACKUP_TABLES = [
  'settings',
  'exercises',
  'routines',
  'routine_exercises',
  'week_plan',
  'workouts',
  'workout_exercises',
  'sets',
  'body_weights',
  'exercise_guides',
  'foods',
  'food_logs',
] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

export type BackupFile = {
  app: typeof BACKUP_APP;
  format: number;
  /** yedeğin alındığı veritabanı şema sürümü */
  schemaVersion: number;
  exportedAt: number;
  tables: Record<BackupTable, Record<string, unknown>[]>;
};

export class BackupError extends Error {
  /** kullanıcıya gösterilecek Türkçe mesaj */
  userMessage: string;
  constructor(userMessage: string) {
    super(userMessage);
    this.name = 'BackupError';
    this.userMessage = userMessage;
  }
}

const SECRET_KEY = /api|secret|token|anahtar|password/i;

export async function exportBackup(db: SQLiteDatabase, now = Date.now()): Promise<BackupFile> {
  const tables = {} as BackupFile['tables'];
  for (const t of BACKUP_TABLES) {
    let rows = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${t}`);
    if (t === 'settings') rows = rows.filter((r) => !SECRET_KEY.test(String(r.key)));
    tables[t] = rows;
  }
  const v = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return { app: BACKUP_APP, format: BACKUP_FORMAT, schemaVersion: v?.user_version ?? DB_VERSION, exportedAt: now, tables };
}

/** Dosya içeriğini doğrular. Uygun değilse `BackupError` (Türkçe mesajlı) fırlatır. */
export function parseBackup(text: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError('Bu dosya geçerli bir gymcime yedeği değil (JSON okunamadı).');
  }
  const b = data as Partial<BackupFile> | null;
  if (!b || typeof b !== 'object' || b.app !== BACKUP_APP || typeof b.tables !== 'object' || b.tables === null) {
    throw new BackupError('Bu dosya bir gymcime yedeği değil.');
  }
  if (b.format !== BACKUP_FORMAT) {
    throw new BackupError('Yedek dosyasının biçimi desteklenmiyor. Uygulamayı güncellemen gerekebilir.');
  }
  if (typeof b.schemaVersion !== 'number' || !Number.isInteger(b.schemaVersion) || b.schemaVersion < 1) {
    throw new BackupError('Yedeğin sürüm bilgisi geçersiz.');
  }
  if (b.schemaVersion > DB_VERSION) {
    throw new BackupError(`Bu yedek daha yeni bir uygulama sürümünden (şema ${b.schemaVersion}). Bu uygulama en fazla ${DB_VERSION} sürümünü okuyabilir; uygulamayı güncelle.`);
  }
  for (const t of BACKUP_TABLES) {
    const rows = (b.tables as Record<string, unknown>)[t];
    // eski sürümlerde bulunmayan tablolar (ör. foods v5) boş sayılır
    if (rows === undefined) continue;
    if (!Array.isArray(rows) || rows.some((r) => typeof r !== 'object' || r === null || Array.isArray(r))) {
      throw new BackupError(`Yedekteki "${t}" tablosu bozuk.`);
    }
  }
  const tables = {} as BackupFile['tables'];
  for (const t of BACKUP_TABLES) tables[t] = ((b.tables as Record<string, unknown>)[t] as Record<string, unknown>[] | undefined) ?? [];
  return { app: BACKUP_APP, format: BACKUP_FORMAT, schemaVersion: b.schemaVersion, exportedAt: Number(b.exportedAt) || 0, tables };
}

export type BackupCounts = { workouts: number; sets: number; exercises: number; foodLogs: number; bodyWeights: number; routines: number };

export function backupCounts(b: BackupFile): BackupCounts {
  return {
    workouts: b.tables.workouts.length,
    sets: b.tables.sets.length,
    exercises: b.tables.exercises.length,
    foodLogs: b.tables.food_logs.length,
    bodyWeights: b.tables.body_weights.length,
    routines: b.tables.routines.length,
  };
}

/**
 * Yedeği içe aktarır: TEK transaction'da mevcut veriyi siler ve yedeğin satırlarını yazar.
 * Hata olursa hiçbir şey değişmez. Sütun adları yedekten değil gerçek tablo şemasından doğrulanır.
 */
export async function importBackup(db: SQLiteDatabase, backup: BackupFile) {
  // Özel (exclusive) transaction: ayrı bağlantıda çalışır, başka sorgular araya giremez.
  // Tüm işlem `txn` üzerinden yapılmalı.
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const t of [...BACKUP_TABLES].reverse()) await txn.runAsync(`DELETE FROM ${t}`);
    for (const t of BACKUP_TABLES) {
      const cols = (await txn.getAllAsync<{ name: string }>(`PRAGMA table_info(${t})`)).map((c) => c.name);
      for (const row of backup.tables[t]) {
        const keys = Object.keys(row).filter((k) => cols.includes(k));
        if (keys.length === 0) continue;
        const vals = keys.map((k) => {
          const v = row[k];
          if (v === null || typeof v === 'number' || typeof v === 'string') return v;
          throw new BackupError(`Yedekteki "${t}.${k}" değeri geçersiz.`);
        });
        await txn.runAsync(`INSERT INTO ${t} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`, ...vals);
      }
    }
    // eski şemalı yedeğin verisine sonraki migrasyonların veri adımları uygulanır
    await applyDataMigrations(txn, backup.schemaVersion);
  });
}

export function backupFileName(now = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `gymcime-yedek-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}
