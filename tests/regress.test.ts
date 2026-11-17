import { DB_VERSION } from '@/db/migrate';
import { DatabaseSync } from 'node:sqlite';
import { suggestNext, type Session } from '@/lib/progression';
import { migrateDb } from '@/db/migrate';
const assert = (c: any, m: string) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };
const NOW = 1_800_000_000_000, D = 86400000;
const ses = (daysAgo: number, sets: any[]): Session => ({ started_at: NOW - daysAgo * D, sets });
(async () => {
  // Bulgu 6: 100×6 @RIR4, aralık 6-12 → 102,5×9 gibi tahmini aşan öneri olmamalı
  let s = suggestNext([ses(3, [{ weight: 100, reps: 6, rir: 4, set_type: 'normal' }])], 6, 12, 'Halter', { now: NOW });
  const reqReps = (s.reps ?? 0) + 2; // hedef RIR 2
  const e1 = 100 * (1 + 10 / 30);
  assert(s.weight! * (1 + reqReps / 30) <= e1 + 0.01, `öneri tahmini aşmıyor (${s.weight}×${s.reps}, ${s.kind})`);
  // küçük dambılda adım %7'yi aşıyorsa ağırlık değil tekrar artar
  s = suggestNext([ses(3, [{ weight: 10, reps: 9, rir: 5, set_type: 'normal' }, { weight: 10, reps: 9, rir: 5, set_type: 'normal' }])], 8, 12, 'Dambıl', { now: NOW });
  assert(s.weight === 10 && s.reps === 11 && s.kind === 'hold', `küçük ağırlık: tekrar artar (${s.weight}×${s.reps})`);
  // Bulgu 7: bir set RIR4, diğeri tükeniş (RIR yok) → "kolay" artışı olmamalı
  s = suggestNext([ses(3, [{ weight: 60, reps: 9, rir: 4, set_type: 'normal' }, { weight: 60, reps: 9, rir: null, set_type: 'failure' }])], 8, 12, 'Halter', { now: NOW });
  assert(s.kind !== 'increase', `tükeniş setinden sonra artış yok (${s.kind} ${s.weight})`);
  // Bulgu 9: vücut ağırlığı
  s = suggestNext([ses(3, [{ weight: 0, reps: 3, set_type: 'normal' }])], 8, 12, 'Vücut', { now: NOW });
  assert(s.kind === 'hold' && s.reps === 4, `barfiks 3/8 → hold 4 (${s.kind} ${s.reps})`);
  s = suggestNext([ses(30, [{ weight: 0, reps: 10, set_type: 'normal' }])], 8, 12, 'Vücut', { now: NOW });
  assert(s.kind === 'return' && s.reps === 9, `vücut ağırlığı uzun ara → return (${s.reps})`);
  // Bulgu 10: yarıda kalan migrasyon tekrar çalışabilmeli
  const raw = new DatabaseSync(':memory:');
  const norm = (p: any[]) => (p.length === 1 && Array.isArray(p[0]) ? p[0] : p);
  const db: any = {
    execAsync: async (q: string) => raw.exec(q),
    runAsync: async (q: string, ...p: any[]) => { const r = raw.prepare(q).run(...norm(p)); return { lastInsertRowId: Number(r.lastInsertRowid) }; },
    getFirstAsync: async (q: string, ...p: any[]) => raw.prepare(q).get(...norm(p)) ?? null,
    getAllAsync: async (q: string, ...p: any[]) => raw.prepare(q).all(...norm(p)),
    withTransactionAsync: async (fn: any) => { raw.exec('BEGIN'); await fn(); raw.exec('COMMIT'); },
  };
  await migrateDb(db);
  raw.exec('PRAGMA user_version = 2'); // v3 sütunları var ama sürüm geri kalmış (çökme simülasyonu)
  await migrateDb(db);
  assert((raw.prepare('PRAGMA user_version').get() as any).user_version === DB_VERSION, 'yarıda kalan v3 tekrar çalıştı, hata yok');
  console.log('\nREGRESYON TESTLERİ GEÇTİ');
})().catch((e) => { console.error(e); process.exit(1); });
