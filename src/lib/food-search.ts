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
const INDEX: Indexed[] = FOODS_TR.map((food) => {
  const name = normalizeTr(food.name);
  return { food, name, words: name.split(' '), aliases: food.aliases.map(normalizeTr) };
});

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
export function servingText(food: Pick<FoodTr, 'unit'>, portion: FoodPortion | null, qty: number, grams: number) {
  const g = `${Math.round(grams * 10) / 10}`.replace('.', ',');
  if (!portion) return `${g} ${food.unit}`;
  const q = `${qty}`.replace('.', ',');
  return qty === 1 ? portion.label : `${q} × ${portion.label}`;
}

export function foodById(id: string) {
  return FOODS_TR.find((f) => f.id === id);
}
