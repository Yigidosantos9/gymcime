import { FOODS_TR, FOOD_CATEGORIES } from '@/data/foods-tr';
import { normalizeTr, nutritionForGrams, portionGrams, searchFoods, servingText } from '@/lib/food-search';

const assert = (c: any, m: string) => {
  if (!c) throw new Error('FAIL: ' + m);
  console.log('ok -', m);
};

(async () => {
  // ───── Veri bütünlüğü ─────
  assert(FOODS_TR.length >= 350, `en az 350 kayıt (${FOODS_TR.length})`);
  const ids = new Set(FOODS_TR.map((f) => f.id));
  assert(ids.size === FOODS_TR.length, 'id benzersiz');
  const names = new Set(FOODS_TR.map((f) => f.name));
  assert(names.size === FOODS_TR.length, 'ad benzersiz');
  const cats = new Set(FOOD_CATEGORIES.map((c) => c.id));
  assert(FOODS_TR.every((f) => cats.has(f.category)), 'her kategori tanımlı');
  assert(FOOD_CATEGORIES.every((c) => FOODS_TR.some((f) => f.category === c.id)), 'her kategoride en az bir kayıt');

  const bad: string[] = [];
  for (const f of FOODS_TR) {
    const nums = [f.kcal, f.protein, f.carbs, f.fat];
    if (!f.id || !f.name.trim()) bad.push(`${f.name}: boş id/ad`);
    if (nums.some((n) => typeof n !== 'number' || !Number.isFinite(n) || n < 0)) bad.push(`${f.name}: negatif/geçersiz değer`);
    if (f.kcal > 900 || f.protein + f.carbs + f.fat > 100.5) bad.push(`${f.name}: 100 g için imkansız değer`);
    if (!f.portions.length) bad.push(`${f.name}: porsiyon yok`);
    for (const p of f.portions) if (!p.label.trim() || !(p.grams > 0)) bad.push(`${f.name}: geçersiz porsiyon ${p.label}`);
  }
  assert(bad.length === 0, `negatif/boş değer ve porsiyon yok: ${bad.join('; ')}`);

  const multi = FOODS_TR.flatMap((f) => f.portions.map((p) => p.label)).filter((l) => (l.match(/\(/g) ?? []).length > 1);
  assert(multi.length === 0, `porsiyon etiketinde en fazla bir parantez grubu: ${multi.join('; ')}`);
  assert(FOODS_TR.find((f) => f.name === 'Omlet')!.portions[0].label === '1 porsiyon, 2 yumurta (120 g)', 'parantezli etiket birleştirildi');

  // ───── kcal ≈ 4P + 4K + 9Y (±%15; neredeyse sıfır kalorili kayıtlar için 3 kcal mutlak pay) ─────
  const off: string[] = [];
  for (const f of FOODS_TR) {
    const exp = 4 * f.protein + 4 * f.carbs + 9 * f.fat;
    const tol = Math.max(0.15 * exp, 3);
    if (Math.abs(f.kcal - exp) > tol) off.push(`${f.name} (kcal ${f.kcal}, makrodan ${exp.toFixed(0)})`);
  }
  assert(off.length === 0, `kcal makrolarla tutarlı: ${off.join('; ')}`);

  // ───── Arama ─────
  assert(normalizeTr('Çorbası ŞÖĞÜİ ıI') === 'corbasi sogui ii', 'normalizeTr Türkçe karakterleri sadeleştirir');
  const corba = searchFoods('corba').map((f) => f.name);
  assert(corba.includes('Mercimek Çorbası'), '"corba" → Mercimek Çorbası');
  assert(searchFoods('çorba').map((f) => f.name).includes('Mercimek Çorbası'), '"çorba" → Mercimek Çorbası');
  assert(searchFoods('MERCİMEK ÇORBASI')[0].name === 'Mercimek Çorbası', 'büyük harf/İ duyarsız, tam ad ilk sırada');
  assert(searchFoods('kofte')[0].name === 'Köfte', '"kofte" → Köfte (ilk sonuç)');
  assert(searchFoods('KÖFTE')[0].name === 'Köfte', '"KÖFTE" → Köfte');
  assert(searchFoods('sutlac')[0].name === 'Sütlaç', '"sutlac" → Sütlaç');
  assert(searchFoods('sucuk').some((f) => f.name === 'Sucuk'), '"sucuk" bulunur');
  assert(searchFoods('simit')[0].name === 'Simit', '"simit" → Simit');
  assert(searchFoods('ayran')[0].name === 'Ayran', '"ayran" → Ayran');
  assert(searchFoods('lahmacun')[0].name === 'Lahmacun', '"lahmacun" → Lahmacun');
  assert(searchFoods('karniyarik')[0].name === 'Karnıyarık', '"karniyarik" → Karnıyarık');
  assert(searchFoods('mantı')[0].name.startsWith('Mantı'), '"mantı" bulunur');
  assert(searchFoods('whey').some((f) => f.category === 'takviye'), '"whey" takviye bulur');
  assert(searchFoods('findik kremasi').length > 0 && searchFoods('nutella').length > 0, 'takma ad: nutella → fındık kreması');
  assert(searchFoods('zzzxqw').length === 0, 'eşleşmeyen sorgu boş');
  assert(searchFoods('mercimek corbasi')[0].name === 'Mercimek Çorbası', 'çok sözcüklü: mercimek çorbası');
  const only = searchFoods('', 'icecek', 100);
  assert(only.length > 10 && only.every((f) => f.category === 'icecek'), 'kategori filtresi');
  assert(searchFoods('corba', 'icecek').length === 0, 'kategori + sorgu kesişimi');
  assert(searchFoods('s', null, 5).length <= 5, 'limit uygulanır');

  // ───── Porsiyon → kcal/makro ─────
  const simit = FOODS_TR.find((f) => f.name === 'Simit')!;
  const p1 = simit.portions.find((p) => p.grams === 110)!;
  assert(p1.label === '1 adet (110 g)', `porsiyon etiketi: ${p1.label}`);
  const n1 = nutritionForGrams(simit, portionGrams(p1, 1));
  assert(n1.kcal === Math.round(330 * 1.1) && n1.protein === 11 && n1.carbs === 66 && n1.fat === 5.5, `1 simit: ${JSON.stringify(n1)}`);
  const n2 = nutritionForGrams(simit, portionGrams(p1, 2));
  assert(n2.kcal === 726 && n2.carbs === 132, `2 simit: ${JSON.stringify(n2)}`);
  const half = nutritionForGrams(simit, portionGrams(p1, 0.5));
  assert(half.kcal === 182 || half.kcal === 181 || half.kcal === 182, `yarım simit ~182 kcal (${half.kcal})`);
  const g100 = nutritionForGrams(simit, 100);
  assert(g100.kcal === 330 && g100.protein === 10, 'serbest gram: 100 g = tablo değeri');
  const zero = nutritionForGrams(simit, 0);
  assert(zero.kcal === 0 && zero.fat === 0, '0 gram → 0');
  assert(nutritionForGrams(simit, -5).kcal === 0, 'negatif gram → 0');
  const whey = FOODS_TR.find((f) => f.name === 'Whey Protein (toz)')!;
  const scoop = nutritionForGrams(whey, portionGrams(whey.portions[0], 1));
  assert(scoop.protein === 23.4 && scoop.kcal === 119, `1 ölçek whey: ${JSON.stringify(scoop)}`);
  const ayran = FOODS_TR.find((f) => f.name === 'Ayran')!;
  assert(ayran.unit === 'ml' && simit.unit === 'g', 'birim: ayran ml, simit g');
  assert(servingText(simit, p1, 1, 110) === '1 adet (110 g)', 'servingText 1 adet');
  assert(servingText(simit, p1, 2, 220) === '2 × 1 adet (110 g)', 'servingText 2 adet');
  assert(servingText(ayran, null, 1, 150) === '150 ml', 'servingText serbest gram/ml');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
