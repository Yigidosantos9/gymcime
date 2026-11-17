import { replanAfter, effortFromRir, inferEffort, adjustBodyweight, effortLabel, type SetPlan } from '@/lib/progression';
const assert = (c: any, m: string) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };
// Zorluk → anlam
assert(effortFromRir(4) === 'easy' && effortFromRir(3) === 'easy' && effortFromRir(2) === 'good' && effortFromRir(1) === 'hard' && effortFromRir(0) === 'fail', 'RIR → zorluk eşlemesi');
assert(effortLabel(3) === 'Kolay' && effortLabel(2) === 'İyi' && effortLabel(1) === 'Zor' && effortLabel(0) === 'Tükendim', 'etiketler');
// Zorluk girilmedi → çıkarım
assert(inferEffort(10, 10) === 'good' && inferEffort(12, 10) === 'good', 'hedef tutturuldu → İyi');
assert(inferEffort(9, 10) === 'hard', '1 eksik → Zor');
assert(inferEffort(8, 10) === 'fail' && inferEffort(3, 10) === 'fail', '2+ eksik → Tükendim');
// Vücut ağırlığı seans içi
assert(adjustBodyweight(10, { reps: 10, rir: null }).note === null, 'zorluk yok, hedef tamam → plan');
assert(adjustBodyweight(10, { reps: 9, rir: null }).reps === 9, 'zorluk yok, 1 eksik → Zor → yapılan');
console.log('ZORLUK TESTLERİ GEÇTİ');
