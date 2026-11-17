import { suggestNext, adjustAfterSet, warmupsFor, type Session } from '@/lib/progression';
const assert = (c: any, m: string) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };
const NOW = 1_800_000_000_000, D = 86400000;
const ses = (daysAgo: number, sets: [number, number, number?][], type = 'normal'): Session =>
  ({ started_at: NOW - daysAgo * D, sets: sets.map(([weight, reps, rir]) => ({ weight, reps, rir: rir ?? null, set_type: type })) });
const opt = { now: NOW };

let s = suggestNext([], 8, 12, 'Halter', opt);
assert(s.kind === 'start' && s.weight === null && s.confidence === 'low', 'veri yok → start');

s = suggestNext([ses(3, [[60, 12], [60, 12], [60, 12]])], 8, 12, 'Halter', opt);
assert(s.kind === 'increase' && s.weight === 62.5 && s.reps === 8, `üst sınır → +2.5 (${s.weight})`);
assert(s.warmups.length === 3 && s.warmups[0].weight === 25, `ısınma: ${JSON.stringify(s.warmups)}`);

s = suggestNext([ses(3, [[60, 12, 0], [60, 12, 0]])], 8, 12, 'Halter', opt);
assert(s.kind === 'hold' && s.weight === 60, 'üst sınır ama tükendi → aynı ağırlık');

s = suggestNext([ses(3, [[60, 9, 5], [60, 9, 4]])], 8, 12, 'Halter', opt);
assert(s.kind === 'hold' && s.weight === 60 && s.reps === 11, `kolay ama +2,5 kg tahmini aşıyor → aynı ağırlık +2 tekrar (${s.weight}×${s.reps})`);
s = suggestNext([ses(3, [[60, 12, 5], [60, 12, 5]])], 8, 12, 'Halter', opt);
assert(s.kind === 'increase' && s.weight! > 60 && s.weight! <= 60 * 1.07, `çok kolay + üst sınır → artış ≤%7 (${s.weight})`);
s = suggestNext([ses(3, [[100, 10, 5], [100, 10, 5]])], 8, 12, 'Halter', opt);
assert(s.kind === 'increase' && s.weight! > 100 && s.weight! <= 107, `çok kolay (100×10 @5) → e1RM'den artış ≤%7 (${s.weight}×${s.reps})`);

s = suggestNext([ses(3, [[60, 5], [60, 4]])], 8, 12, 'Halter', opt);
assert(s.kind === 'decrease' && s.weight! < 60 && s.weight! >= 52.5, `hedef altı → düşür (${s.weight})`);
assert(s.weight! % 2.5 === 0, 'adıma yuvarlı');

s = suggestNext([ses(3, [[60, 9], [60, 8]])], 8, 12, 'Halter', opt);
assert(s.kind === 'hold' && s.weight === 60 && s.reps === 9, 'aradaysa aynı ağırlık +1 tekrar');

s = suggestNext([ses(20, [[60, 10]])], 8, 12, 'Halter', opt);
assert(s.kind === 'return' && s.weight === 52.5, `20 gün ara → %10 hafif (${s.weight})`);
s = suggestNext([ses(40, [[60, 10]])], 8, 12, 'Halter', opt);
assert(s.kind === 'return' && s.weight === 50, `40 gün ara → %15 hafif (${s.weight})`);

// plato: 4 seans aynı
const flat = [ses(2, [[80, 6]]), ses(6, [[80, 6]]), ses(10, [[80, 6]]), ses(14, [[80, 6]])];
s = suggestNext(flat, 6, 10, 'Halter', opt);
assert(s.plateau && s.kind === 'deload' && s.weight === 70, `plato → deload (${s.kind} ${s.weight})`);

// ilerleyen sporcu plato değil
const prog = [ses(2, [[85, 6]]), ses(6, [[82.5, 6]]), ses(10, [[80, 6]]), ses(14, [[77.5, 6]])];
s = suggestNext(prog, 6, 10, 'Halter', opt);
assert(!s.plateau && s.confidence === 'high' && s.e1rm! > 0, 'ilerleme var → plato yok, güven yüksek');

// dambıl adımı 2: 22.5 → 24.5 ile değil adımlı
s = suggestNext([ses(3, [[22, 12], [22, 12]])], 8, 12, 'Dambıl', opt);
assert(s.weight === 24, `dambıl +2 (${s.weight})`);
s = suggestNext([ses(3, [[22, 12]])], 8, 12, 'Dambıl', { ...opt, increments: { barbell: 2.5, dumbbell: 1, machine: 2.5 } });
assert(s.weight === 23, 'özel artış adımı');

// vücut ağırlığı
s = suggestNext([ses(3, [[0, 10], [0, 9]])], 8, 12, 'Vücut', opt);
assert(s.weight === null && s.reps === 10, `vücut ağırlığı tekrar (${s.reps})`);

// ısınma/drop setleri yok sayılır
const mixed: Session = { started_at: NOW - 3 * D, sets: [
  { weight: 30, reps: 10, set_type: 'warmup' }, { weight: 60, reps: 12, set_type: 'normal' }, { weight: 60, reps: 12, set_type: 'normal' }, { weight: 40, reps: 6, set_type: 'drop' } ] };
s = suggestNext([mixed], 8, 12, 'Halter', opt);
assert(s.kind === 'increase' && s.weight === 62.5, 'ısınma ve drop setleri hesaba girmez');

// sadece ısınma → start
s = suggestNext([{ started_at: NOW - D, sets: [{ weight: 30, reps: 10, set_type: 'warmup' }] }], 8, 12, 'Halter', opt);
assert(s.kind === 'start', 'sadece ısınma → start');

// hedef: formda kalmak RIR 3
s = suggestNext([ses(3, [[60, 10]])], 8, 12, 'Halter', { ...opt, goal: 'Formda kalmak' });
assert(s.targetRir === 3, 'hedefe göre RIR');

// küçük ağırlıkta adım > %7 olsa da en az bir adım
s = suggestNext([ses(3, [[10, 10, 5], [10, 10, 5]])], 8, 12, 'Dambıl', opt);
assert(s.weight === 10 && s.reps === 12, `küçük ağırlıkta adım %7'yi aşıyor → önce tekrar (${s.weight}×${s.reps})`);
s = suggestNext([ses(3, [[10, 12, 5], [10, 12, 5]])], 8, 12, 'Dambıl', opt);
assert(s.weight === 12 && s.kind === 'increase', `üst sınıra ulaşınca dambıl +2 (${s.weight})`);

// seans içi ayar
let a = adjustAfterSet({ weight: 60, reps: 10 }, { weight: 60, reps: 10, rir: 4 }, 2, 2.5);
assert(a.weight === 62.5 && a.note, 'kolay set → +adım');
a = adjustAfterSet({ weight: 60, reps: 10 }, { weight: 60, reps: 7, rir: 0 }, 2, 2.5, { repMin: 8, repMax: 12 });
assert(a.weight! < 60 && a.weight! >= 52.5 && a.reps >= 8, `tükendi + hedef altı → hafifle (${a.weight}×${a.reps})`);
a = adjustAfterSet({ weight: 60, reps: 10 }, { weight: 60, reps: 10, rir: null }, 2, 2.5);
assert(a.weight === 60 && !a.note, 'zorluk girilmediyse değişmez');
assert(warmupsFor(30, 'Halter', 2.5).length === 0 && warmupsFor(100, 'Dambıl', 2).length === 0, 'hafif/izole hareketlerde ısınma yok');

// NaN/Infinity koruması
for (const r of [suggestNext([ses(1, [[NaN as any, 5]])], 8, 12, 'Halter', opt)]) assert(r.weight === null || Number.isFinite(r.weight), 'NaN girişi patlatmıyor');
console.log('\nMOTOR TESTLERİ GEÇTİ');
