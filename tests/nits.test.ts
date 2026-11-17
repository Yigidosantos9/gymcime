import { suggestNext, adjustBodyweight } from '@/lib/progression';
const assert = (c: any, m: string) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };
const NOW = 1_800_000_000_000;
const s = suggestNext([{ started_at: NOW - 3 * 86400000, sets: [{ weight: 100, reps: 10, rir: 4, set_type: 'normal' }, { weight: 100, reps: 10, rir: 4, set_type: 'normal' }] }], 8, 12, 'Halter', { now: NOW, goal: 'Formda kalmak' });
assert(s.reason.includes('Kolay') && s.weight === 105 && s.reps === 10, `Formda kalmak: Kolay (RIR4) kuralı aynı (${s.kind} ${s.weight}×${s.reps})`);
const a = adjustBodyweight(10, { reps: 10, rir: 3 });
assert(a.reps === 11, 'RIR 3 = Kolay (vücut ağırlığı)');
console.log('NIT TESTLERİ GEÇTİ');
