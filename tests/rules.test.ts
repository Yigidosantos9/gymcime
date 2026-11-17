// Görev 2.6 — kural tablosu güdümlü testler (seans içi + sonraki antrenman)
import { adjustBodyweight, RULE_TABLE, planSets, replanAfter, suggestNext, type Session, type SetPlan } from '@/lib/progression';
const assert = (c: any, m: string) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };
const NOW = 1_800_000_000_000, D = 86400000;
const ses = (daysAgo: number, sets: [number, number, number?][]): Session =>
  ({ started_at: NOW - daysAgo * D, sets: sets.map(([weight, reps, rir]) => ({ weight, reps, rir: rir ?? null, set_type: 'normal' })) });
const opt = { now: NOW };
const next = (sets: [number, number, number?][], eq = 'Halter', min = 8, max = 12, inc?: any) =>
  suggestNext([ses(3, sets)], min, max, eq, { ...opt, increments: inc });

assert(RULE_TABLE.length === 4, 'kural tablosu 4 zorluk');

// ── Sonraki antrenman: 4 zorluk (60 kg Halter, 10 tekrar, adım 2,5; aralık 8-12)
let s = next([[60, 10, 4]]); assert(s.weight === 65 && s.reps === 10 && s.kind === 'increase', `Kolay → +2 adım (${s.weight}×${s.reps})`);
s = next([[60, 10, 3]]); assert(s.weight === 65, 'RIR 3 de Kolay');
s = next([[60, 10, 2]]); assert(s.weight === 62.5 && s.reps === 10 && s.kind === 'increase', `İyi → +1 adım (${s.weight}×${s.reps})`);
s = next([[60, 10, 1]]); assert(s.weight === 60 && s.reps === 11 && s.kind === 'hold', `Zor → aynı ağırlık +1 tekrar (${s.weight}×${s.reps})`);
s = next([[60, 12, 1]]); assert(s.weight === 62.5 && s.reps === 8, `Zor + üst sınır → +1 adım, tekrar alt sınır (${s.weight}×${s.reps})`);
s = next([[60, 10, 0]]); assert(s.weight === 60 && s.reps === 10 && s.kind === 'hold', `Tükendim → aynı ağırlık (${s.weight}×${s.reps})`);
s = next([[60, 8, 0]]); assert(s.weight === 60 && s.reps === 8, 'Tükendim, hedefte → aynı');
s = next([[60, 7, 0]]); assert(s.weight === 60 && s.reps === 8 && s.kind === 'hold', 'Tükendim, 1 eksik → aynı ağırlık');
s = next([[60, 6, 0]]); assert(s.weight === 57.5 && s.reps === 8 && s.kind === 'decrease', `Tükendim, 2 eksik → −1 adım (${s.weight}×${s.reps})`);
s = next([[60, 3, 0]]); assert(s.weight === 57.5, 'Tükendim, çok eksik → yine −1 adım (tek adım)');

// ── Zorluk girilmedi
s = next([[60, 10]]); assert(s.weight === 62.5, 'zorluk yok, hedef tutturuldu → İyi → +1 adım');
s = next([[60, 8]]); assert(s.weight === 62.5, 'zorluk yok, alt sınırda → İyi');
s = next([[60, 7]]); assert(s.weight === 60 && s.reps === 8, 'zorluk yok, 1 eksik → Zor → aynı ağırlık +1 tekrar');
s = next([[60, 6]]); assert(s.weight === 57.5, 'zorluk yok, 2 eksik → Tükendim → −1 adım');

// ── En ağır sete göre (hafif setler karar vermez)
s = next([[50, 12, 4], [55, 10, 4], [60, 9, 1]]); assert(s.weight === 60 && s.reps === 10, `en ağır set Zor → diğerleri Kolay olsa da aynı (${s.weight}×${s.reps})`);
s = next([[60, 10, 1], [60, 10, 4]]); assert(s.weight === 65, 'eşit ağırlıkta son set belirleyici');

// ── Farklı adım değerleri
s = next([[22, 10, 4]], 'Dambıl'); assert(s.weight === 26, 'dambıl Kolay +2×2');
s = next([[22, 10, 2]], 'Dambıl', 8, 12, { barbell: 2.5, dumbbell: 1, machine: 2.5 }); assert(s.weight === 23, 'özel dambıl adımı 1 → İyi +1');
s = next([[100, 10, 2]], 'Makine', 8, 12, { barbell: 2.5, dumbbell: 2, machine: 5 }); assert(s.weight === 105, 'makine adımı 5');
s = next([[100, 10, 4]], 'Makine', 8, 12, { barbell: 2.5, dumbbell: 2, machine: 5 }); assert(s.weight === 110, 'makine adımı 5 → Kolay +2 adım');
s = next([[100, 12, 1]], 'Kablo', 8, 12, { barbell: 2.5, dumbbell: 2, machine: 5 }); assert(s.weight === 105 && s.reps === 8, 'kablo = makine adımı, Zor üst sınır');

// ── Vücut ağırlığı (Kolay +2 · İyi +1 · Zor aynı · Tükendim −1)
const bw = (reps: number, rir?: number) => suggestNext([ses(3, [[0, reps, rir]])], 8, 12, 'Vücut', opt);
assert(bw(10, 4).reps === 12 && bw(10, 2).reps === 11 && bw(10, 1).reps === 10 && bw(10, 0).reps === 9, 'vücut ağırlığı 4 zorluk');
assert(bw(10, 2).weight === null, 'vücut ağırlığı: ağırlık yok');
assert(bw(10).reps === 11 && bw(7).reps === 7 && bw(5).reps === 5, 'vücut ağırlığı zorluk çıkarımı');
assert(bw(1, 0).reps === 1, 'vücut ağırlığı alt sınır 1');
assert(bw(3).reps === 3, 'barfiks 3/8 zorluk yok → çıkarımla Tükendim → gerileme yok (3)');
assert(bw(5, 0).reps === 5 && bw(8, 0).reps === 8 && bw(9, 0).reps === 8, 'açık Tükendim: −1 yalnızca sonuç repMin altına düşmüyorsa');
const bwF = suggestNext([{ started_at: NOW - 3 * D, sets: [{ weight: 0, reps: 10, rir: null, set_type: 'failure' }] }], 8, 12, 'Vücut', opt);
assert(bwF.reps === 9, 'vücut ağırlığı failure seti = açık Tükendim');
assert(adjustBodyweight(10, { reps: 6, rir: null }).reps === 6, 'seans içi çıkarımla Tükendim → gerileme yok');
assert(adjustBodyweight(10, { reps: 8, rir: 0 }).reps === 7, 'seans içi açık Tükendim → −1');
assert(adjustBodyweight(10, { reps: 10, rir: null, failure: true }).reps === 9, 'seans içi failure seti → Tükendim');

// ── >14 gün ara hâlâ hafifletir; zorluk kuralı ezilir
s = suggestNext([ses(20, [[60, 10, 4]])], 8, 12, 'Halter', opt); assert(s.kind === 'return' && s.weight === 52.5, '>14 gün → hafiflet');
s = suggestNext([ses(14, [[60, 10, 4]])], 8, 12, 'Halter', opt); assert(s.kind === 'increase', '14 gün tam → kural geçerli');

// ── Isınma önerisi korunur, plato yalnızca not
s = next([[100, 10, 2]]); assert(s.warmups.length === 3, 'ısınma önerisi korunur');
const flat = [ses(2, [[80, 8, 2]]), ses(6, [[80, 8, 2]]), ses(10, [[80, 8, 2]]), ses(14, [[80, 8, 2]])];
s = suggestNext(flat, 8, 12, 'Halter', opt); assert(s.plateau && s.kind !== 'deload' && s.weight === 82.5, 'plato: bilgi bayrağı, otomatik deload yok');

// ── Gerekçe metni
s = next([[60, 10, 2]]); assert(s.reason === 'Son sefer en ağır set İyi geçti → +1 adım (62,5 kg)', `gerekçe: ${s.reason}`);

// ── Seans içi: piramit 50→55→60 (adım 2,5)
const plan: SetPlan[] = [{ weight: 50, reps: 10, rir: 4 }, { weight: 55, reps: 10, rir: 2 }, { weight: 60, reps: 8, rir: 1 }];
const run = (idx: number, w: number, reps: number, rir: number | null, p = plan) => replanAfter(p, idx, { weight: w, reps, rir }, 2.5);
let r = run(0, 50, 10, 4);
assert(r.plan[1].weight === 57.5 && r.plan[1].reps === 10, `Kolay → taban(55)+1 adım = 57,5 (${r.plan[1].weight})`);
assert(r.plan[2].weight === 62.5 && r.plan[2].reps === 8, `zincir: sonraki set farkı korur (+5) → 62,5 (${r.plan[2].weight})`);
assert(r.note === 'Kolay → Set 2: 57,5 kg × 10 (+1 adım)', `not: ${r.note}`);
r = run(0, 50, 10, 2); assert(r.plan[1].weight === 55 && r.plan[2].weight === 60 && r.note === null, 'İyi → plana devam, not yok');
r = run(0, 50, 10, 1); assert(r.plan[1].weight === 50 && r.plan[2].weight === 55 && r.note === 'Zor → Set 2: 50 kg × 10 (piramit artışı iptal)', `Zor → aynı ağırlık, zincir kayar (${r.plan[1].weight}/${r.plan[2].weight}; ${r.note})`);
r = run(0, 50, 10, 0); assert(r.plan[1].weight === 47.5 && r.plan[2].weight === 52.5 && r.note?.startsWith('Tükendim') && r.note.endsWith('(−1 adım)'), `Tükendim → −1 adım (${r.plan[1].weight}/${r.plan[2].weight})`);
// zorluk girilmedi
r = run(0, 50, 10, null); assert(r.note === null && r.plan[1].weight === 55, 'zorluk yok + hedef tamam → İyi → plan');
r = run(0, 50, 9, null); assert(r.plan[1].weight === 50 && r.note?.startsWith('Zor (tahmini)'), `zorluk yok + 1 eksik → Zor (${r.note})`);
r = run(0, 50, 7, null); assert(r.plan[1].weight === 47.5 && r.note?.startsWith('Tükendim (tahmini)'), `zorluk yok + 2 eksik → Tükendim (${r.note})`);
// kullanıcı plandan farklı ağırlık seçti: taban = yapılan + artış
r = run(0, 52.5, 10, 2); assert(r.plan[1].weight === 57.5 && r.plan[2].weight === 62.5, 'İyi, farklı ağırlık → yapılan + piramit artışı');
// son set → değişiklik yok
r = run(2, 60, 8, 4); assert(r.plan === plan && r.note === null, 'son set → sonraki yok');
// sabit düzen: artış 0
const flatPlan = planSets({ weight: 60, reps: 10 }, 3, 'straight', 2, 2.5);
r = run(0, 60, 10, 4, flatPlan); assert(r.plan[1].weight === 62.5 && r.plan[2].weight === 62.5, 'sabit + Kolay → +1 adım, hepsi aynı');
r = run(0, 60, 10, 1, flatPlan); assert(r.plan[1].weight === 60 && r.note === null, 'sabit + Zor → aynı (not yok)');
r = run(0, 60, 10, 0, flatPlan); assert(r.plan[1].weight === 57.5 && r.plan[2].weight === 57.5 && r.note?.endsWith('(−1 adım)'), 'sabit + Tükendim → −1 adım');
// zincir: iki set sonra kümülatif
let p2 = run(0, 50, 10, 4).plan; // 50,57.5,62.5
r = run(1, 57.5, 10, 0, p2); assert(r.plan[2].weight === 55, `2. set (57,5) Tükendim → 3. set yapılan −1 adım = 55 (${r.plan[2].weight})`);
// farklı adım
r = replanAfter(plan, 0, { weight: 50, reps: 10, rir: 4 }, 5); assert(r.plan[1].weight === 60, 'adım 5 → Kolay: 55+5');
// minimum adım altına inmez
r = replanAfter([{ weight: 2.5, reps: 10, rir: 2 }, { weight: 2.5, reps: 10, rir: 2 }], 0, { weight: 2.5, reps: 10, rir: 0 }, 2.5); assert(r.plan[1].weight === 2.5, 'ağırlık adımın altına inmez');
// failure seti + zorluk yok → Tükendim (seans içi, tekrar planı tutturmuş olsa bile)
r = replanAfter(plan, 0, { weight: 50, reps: 10, rir: null, failure: true }, 2.5); assert(r.plan[1].weight === 47.5 && r.note?.startsWith('Tükendim → '), `failure seti seans içi Tükendim (${r.note})`);
// vücut ağırlığı → plan değişmez
const bwPlan = planSets({ weight: null, reps: 10 }, 3, 'ramp', 2, 0);
r = replanAfter(bwPlan, 0, { weight: null, reps: 10, rir: 4 }, 0); assert(r.plan === bwPlan, 'vücut ağırlığı: replan dokunmaz');
console.log('\nKURAL TESTLERİ GEÇTİ');
