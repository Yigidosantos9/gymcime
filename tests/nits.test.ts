import { suggestNext, adjustAfterSet } from '@/lib/progression';
const assert = (c: any, m: string) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };
const NOW = 1_800_000_000_000;
const s = suggestNext([{ started_at: NOW - 3 * 86400000, sets: [{ weight: 100, reps: 10, rir: 4, set_type: 'normal' }, { weight: 100, reps: 10, rir: 4, set_type: 'normal' }] }], 8, 12, 'Halter', { now: NOW, goal: 'Formda kalmak' });
assert(s.reason.startsWith('Kolay geldi') && s.reps === 12, `Formda kalmak: Kolay (RIR4) dalı tetiklenir (${s.kind} ${s.weight}×${s.reps})`);
const a = adjustAfterSet({ weight: 60, reps: 10 }, { weight: 60, reps: 10, rir: 4 }, 3, 2.5, { repMin: 8, repMax: 12 });
assert(a.weight === 60 && a.reps === 11 && a.note?.startsWith('Kolay'), `Formda kalmak: Kolay (hedef+1) → aynı ağırlık +1 tekrar (${a.weight}×${a.reps})`);
console.log('NIT TESTLERİ GEÇTİ');
