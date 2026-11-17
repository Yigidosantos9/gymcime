import { formatDecimal, getLanguage, type Lang } from '@/i18n';
import { FOODS_TR, type FoodCategoryId, type FoodPortion, type FoodTr } from '@/data/foods-tr';

/** Arama için: küçük harf + Türkçe karakter/aksan sadeleştirme ("Çorbası" → "corbasi"). */
export function normalizeTr(s: string) {
  return s
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ç/g, 'c')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type Indexed = { food: FoodTr; name: string; words: string[]; aliases: string[] };
// Arama her iki dilde çalışır: Türkçe ad (ana) + İngilizce ad (takma ad gibi) birlikte indekslenir
const INDEX: Indexed[] = FOODS_TR.map((food) => {
  const name = normalizeTr(food.name);
  return { food, name, words: name.split(' '), aliases: [...food.aliases.map(normalizeTr), normalizeTr(food.nameEn)] };
});

/** Geçerli dilde yiyecek adı. */
export function foodName(food: Pick<FoodTr, 'name' | 'nameEn'>) {
  return getLanguage() === 'en' ? food.nameEn : food.name;
}

const BY_TR_NAME = new Map(FOODS_TR.map((f) => [f.name, f]));

/**
 * Kayıtlı yiyecek adını gösterim diline çevirir: veritabanından seçilmiş yiyecekler Türkçe asıl adla saklanır
 * (kayıtta hangi dil olursa olsun); kullanıcının elle yazdığı adlar olduğu gibi kalır.
 */
export function displayFoodName(stored: string) {
  const f = BY_TR_NAME.get(stored);
  return f ? foodName(f) : stored;
}

/** Kayıtlı porsiyon metnini gösterim diline çevirir (Türkçe saklanan etiketler EN'de çevrilir; elle yazılanlar da kelime bazlı). */
export function displayServing(stored: string | null | undefined) {
  return stored ? portionLabel(stored) : stored;
}

const PORTION_EN: [RegExp, string][] = [
  [/yemek kaşığı/g, 'tbsp'],
  [/çay kaşığı/g, 'tsp'],
  [/su bardağı/g, 'glass'],
  [/ince belli bardak/g, 'tea glass'],
  [/büyük bardak/g, 'large glass'],
  [/küçük bardak/g, 'small glass'],
  [/bardak/g, 'glass'],
  [/büyük porsiyon/g, 'large serving'],
  [/küçük porsiyon/g, 'small serving'],
  [/porsiyon/g, 'serving'],
  [/büyük adet/g, 'large piece'],
  [/küçük adet/g, 'small piece'],
  [/adet/g, 'piece'],
  [/büyük kase/g, 'large bowl'],
  [/küçük kase/g, 'small bowl'],
  [/kase/g, 'bowl'],
  [/büyük tabak/g, 'large plate'],
  [/küçük tabak/g, 'small plate'],
  [/küçük dilim/g, 'small slice'],
  [/dilim/g, 'slice'],
  [/avuç/g, 'handful'],
  [/büyük kutu/g, 'large can'],
  [/küçük kutu/g, 'small can'],
  [/kutu/g, 'can'],
  [/büyük şişe/g, 'large bottle'],
  [/küçük şişe/g, 'small bottle'],
  [/şişe/g, 'bottle'],
  [/ölçek/g, 'scoop'],
  [/büyük paket/g, 'large pack'],
  [/küçük paket/g, 'small pack'],
  [/paket/g, 'pack'],
  [/yarım ekmek/g, 'half loaf'],
  [/kibrit kutusu/g, 'matchbox'],
  [/büyük shaker/g, 'large shaker'],
  [/küçük shaker/g, 'small shaker'],
  [/büyük kova/g, 'large tub'],
  [/küçük kap/g, 'small tub'],
  [/kap\b/g, 'tub'],
  [/dolmalık biber/g, 'stuffing pepper'],
  [/orta boy/g, 'medium'],
  [/büyük boy/g, 'large'],
  [/küçük boy/g, 'small'],
  [/küçük tablet/g, 'small tablet'],
  [/tablet/g, 'tablet'],
  [/fincan/g, 'cup'],
  [/kupa/g, 'mug'],
  [/parça/g, 'piece'],
  [/somun/g, 'loaf'],
  [/yaprak/g, 'leaf'],
  [/demet/g, 'bunch'],
  [/salkım/g, 'bunch'],
  [/kepçe/g, 'ladle'],
  [/külah/g, 'cone'],
  [/şiş/g, 'skewer'],
  [/filet/g, 'fillet'],
  [/kare/g, 'square'],
  [/diş/g, 'clove'],
  [/baş/g, 'head'],
  [/top/g, 'scoop'],
  [/küp/g, 'cube'],
  [/yumurta/g, 'egg'],
  [/küçük/g, 'small'],
  [/büyük/g, 'large'],
];

/** Porsiyon etiketi geçerli dilde ("2 yemek kaşığı (30 g)" → "2 tbsp (30 g)"); ondalık ayırıcı da yerel. */
export function portionLabel(label: string, lang: Lang = getLanguage()) {
  if (lang !== 'en') return label;
  let out = label;
  for (const [rx, to] of PORTION_EN) out = out.replace(rx, to);
  return out.replace(/(\d),(\d)/g, '$1.$2');
}

/** 0 = en iyi eşleşme; null = eşleşme yok. Tüm sözcükler eşleşmeli. */
function scoreEntry(e: Indexed, tokens: string[], whole: string): number | null {
  if (e.name === whole) return 0;
  let total = 0;
  for (const tok of tokens) {
    let s: number | null = null;
    if (e.words.some((w) => w === tok)) s = 1;
    else if (e.words.some((w) => w.startsWith(tok))) s = 2;
    else if (e.name.includes(tok)) s = 3;
    else if (e.aliases.some((a) => a === tok || a.split(' ').some((w) => w.startsWith(tok)))) s = 4;
    else if (e.aliases.some((a) => a.includes(tok))) s = 5;
    if (s == null) return null;
    total = Math.max(total, s);
  }
  return total + (e.name.startsWith(tokens[0]) ? 0 : 0.5);
}

/**
 * Yiyecek ara. Boş sorguda yalnızca kategori filtresi uygulanır (ada göre sıralı).
 * Sıralama: tam ad > ad kelimesi > ad öneki > ad içinde > takma ad; eşitlikte kısa ad önce.
 */
export function searchFoods(query: string, category?: FoodCategoryId | null, limit = 40): FoodTr[] {
  const whole = normalizeTr(query);
  const pool = category ? INDEX.filter((e) => e.food.category === category) : INDEX;
  if (!whole) return pool.slice(0, limit).map((e) => e.food);
  const tokens = whole.split(' ');
  const scored: { e: Indexed; s: number }[] = [];
  for (const e of pool) {
    const s = scoreEntry(e, tokens, whole);
    if (s != null) scored.push({ e, s });
  }
  scored.sort((a, b) => a.s - b.s || a.e.name.length - b.e.name.length || a.e.name.localeCompare(b.e.name));
  return scored.slice(0, limit).map((x) => x.e.food);
}

export type Nutrition = { kcal: number; protein: number; carbs: number; fat: number };

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Verilen miktar (g/ml) için kcal (tam sayı) ve makrolar (0,1 g hassasiyet). */
export function nutritionForGrams(food: Pick<FoodTr, 'kcal' | 'protein' | 'carbs' | 'fat'>, grams: number): Nutrition {
  const k = Math.max(0, grams) / 100;
  return { kcal: Math.round(food.kcal * k), protein: round1(food.protein * k), carbs: round1(food.carbs * k), fat: round1(food.fat * k) };
}

/** Porsiyon × adet → toplam gram. */
export function portionGrams(portion: Pick<FoodPortion, 'grams'>, qty: number) {
  return Math.max(0, portion.grams * qty);
}

/** "2 × 1 adet (50 g)" gibi kayıt metni; gram modunda "150 g". */
export function servingText(food: Pick<FoodTr, 'unit'>, portion: FoodPortion | null, qty: number, grams: number, lang: Lang = getLanguage()) {
  const g = formatDecimal(Math.round(grams * 10) / 10, 1, lang);
  if (!portion) return `${g} ${food.unit}`;
  const q = formatDecimal(qty, 2, lang);
  const label = portionLabel(portion.label, lang);
  return qty === 1 ? label : `${q} × ${label}`;
}

export function foodById(id: string) {
  return FOODS_TR.find((f) => f.id === id);
}
