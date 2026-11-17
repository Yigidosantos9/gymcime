import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';

import { backupFileName, BackupError, exportBackup, parseBackup, type BackupFile } from '@/db/backup';

/** Yedeği JSON dosyasına yazıp paylaşım sayfasını açar (Dosyalar'a kaydet / AirDrop / vb.). */
export async function shareBackup(db: SQLiteDatabase) {
  const backup = await exportBackup(db);
  const file = new File(Paths.cache, backupFileName());
  if (file.exists) file.delete();
  file.create();
  await file.write(JSON.stringify(backup));
  if (!(await Sharing.isAvailableAsync())) throw new BackupError('Bu cihazda paylaşım kullanılamıyor.');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'gymcime yedeği' });
}

/** Belge seçiciyle yedek seçtirir ve doğrular. İptal edilirse `null`. */
export async function pickBackup(): Promise<BackupFile | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.[0]) return null;
  const text = await new File(res.assets[0].uri).text();
  return parseBackup(text);
}
