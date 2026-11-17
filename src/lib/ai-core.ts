/**
 * AI katmanının saf (Expo/RN bağımsız) mantığı: model seçimi, hata dönüşümü,
 * istek kurma, yanıt ayrıştırma ve şema doğrulama. Node testleri bunu doğrudan çalıştırır.
 * API anahtarı burada ASLA tutulmaz; anahtarı `ai.ts` SecureStore'dan okur.
 */
import { t, type Lang, type MsgKey } from '@/i18n';

import { loadAnthropic } from './anthropic-sdk';

// ───────────────────────── Modeller ─────────────────────────

/** Kullanıcı kararı (kademeli): basit/hızlı işler Haiku, kalite isteyen işler Sonnet. Opus kullanılmaz. */
export const MODELS = {
  fast: 'claude-haiku-5-5',
  smart: 'claude-sonnet-5-5',
} as const;

export type ModelTier = keyof typeof MODELS;
/** Ayarlar'daki seçenek: 'fast' = her şey Haiku (ucuz), 'balanced' = işe göre kademeli (varsayılan). */
export type ModelPref = 'fast' | 'balanced';
export const DEFAULT_MODEL_PREF: ModelPref = 'balanced';

export function resolveModel(task: ModelTier, pref: ModelPref): string {
  return pref === 'fast' ? MODELS.fast : MODELS[task];
}

export function parseModelPref(v: string | null | undefined): ModelPref {
  return v === 'fast' ? 'fast' : 'balanced';
}

// ───────────────────────── Hatalar ─────────────────────────

export type AiErrorKind = 'no-key' | 'auth' | 'network' | 'rate' | 'refusal' | 'truncated' | 'invalid' | 'other';

/** Kullanıcıya gösterilen hata metni (oluşturulduğu andaki dilde). */
const message = (kind: AiErrorKind) => t(`ai.err.${kind}` as MsgKey);

export class AiError extends Error {
  readonly kind: AiErrorKind;
  /** Kullanıcıya gösterilecek (geçerli dilde) mesaj */
  readonly userMessage: string;
  constructor(kind: AiErrorKind, detail?: string) {
    super(detail ?? message(kind));
    this.name = 'AiError';
    this.kind = kind;
    this.userMessage = message(kind);
  }
}

/** SDK/ağ hatasını AiError'a çevirir (zaten AiError ise olduğu gibi döner). */
export function toAiError(err: unknown): AiError {
  if (err instanceof AiError) return err;
  const Anthropic = loadAnthropic();
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) return new AiError('auth');
  if (err instanceof Anthropic.RateLimitError) return new AiError('rate');
  if (err instanceof Anthropic.APIConnectionError) return new AiError('network'); // zaman aşımı dahil
  if (err instanceof Anthropic.APIError) {
    if (err.status === 529 || (err.status != null && err.status >= 500)) return new AiError('other', t('ai.err.service', { status: err.status }));
    return new AiError('other', t('ai.err.api', { status: err.status ?? '?' }));
  }
  return new AiError('other', err instanceof Error ? err.message : undefined);
}

// ───────────────────────── Yanıt ayrıştırma ─────────────────────────

type MinimalResponse = {
  stop_reason: string | null;
  content: { type: string; text?: string }[];
};

/**
 * stop_reason kontrolü (refusal / max_tokens) + ilk metin bloğunu JSON olarak ayrıştırır.
 * Yapılandırılmış çıktı (output_config.format) şemaya uygun JSON metni döndürür.
 */
export function extractJson(res: MinimalResponse): unknown {
  if (res.stop_reason === 'refusal') throw new AiError('refusal');
  if (res.stop_reason === 'max_tokens') throw new AiError('truncated');
  const block = res.content.find((b) => b.type === 'text' && typeof b.text === 'string');
  if (!block?.text) throw new AiError('invalid');
  try {
    return JSON.parse(block.text);
  } catch {
    throw new AiError('invalid');
  }
}

// ───────────────────────── Egzersiz rehberi ─────────────────────────

export type ExerciseGuide = {
  setup: string[];
  steps: string[];
  keyAngles: string[];
  breathing: string;
  mistakes: { mistake: string; fix: string }[];
  feel: string[];
  safety: string;
  personalTips: string[];
};

const STR = { type: 'string' } as const;
const STR_LIST = { type: 'array', items: STR } as const;

/** output_config.format.schema — yapılandırılmış çıktı */
export const GUIDE_SCHEMA = {
  type: 'object',
  properties: {
    setup: STR_LIST,
    steps: STR_LIST,
    keyAngles: STR_LIST,
    breathing: STR,
    mistakes: {
      type: 'array',
      items: {
        type: 'object',
        properties: { mistake: STR, fix: STR },
        required: ['mistake', 'fix'],
        additionalProperties: false,
      },
    },
    feel: STR_LIST,
    safety: STR,
    personalTips: STR_LIST,
  },
  required: ['setup', 'steps', 'keyAngles', 'breathing', 'mistakes', 'feel', 'safety', 'personalTips'],
  additionalProperties: false,
} as const;

const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isStrList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

/** Gelen JSON'u (önbellekten ya da API'den) doğrular; geçersizse AiError('invalid') fırlatır. */
export function validateGuide(raw: unknown): ExerciseGuide {
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== 'object') throw new AiError('invalid');
  const mistakes = o.mistakes;
  if (
    !isStrList(o.setup) ||
    !isStrList(o.steps) ||
    o.steps.length === 0 ||
    !isStrList(o.keyAngles) ||
    !isStr(o.breathing) ||
    !Array.isArray(mistakes) ||
    !mistakes.every((m) => m && isStr((m as any).mistake) && isStr((m as any).fix)) ||
    !isStrList(o.feel) ||
    !isStr(o.safety) ||
    !isStrList(o.personalTips)
  ) {
    throw new AiError('invalid');
  }
  return {
    setup: o.setup.map((s) => s.trim()).filter(Boolean),
    steps: o.steps.map((s) => s.trim()).filter(Boolean),
    keyAngles: o.keyAngles.map((s) => s.trim()).filter(Boolean),
    breathing: o.breathing.trim(),
    mistakes: (mistakes as { mistake: string; fix: string }[]).slice(0, 3).map((m) => ({ mistake: m.mistake.trim(), fix: m.fix.trim() })),
    feel: o.feel.map((s) => s.trim()).filter(Boolean),
    safety: o.safety.trim(),
    personalTips: o.personalTips.map((s) => s.trim()).filter(Boolean).slice(0, 2),
  };
}

/** Önbellekteki JSON metnini güvenle çözer; bozuksa null (yeniden üretilebilir). */
export function parseCachedGuide(json: string | null | undefined): ExerciseGuide | null {
  if (!json) return null;
  try {
    return validateGuide(JSON.parse(json));
  } catch {
    return null;
  }
}

export type GuideHistorySession = { started_at: number; best1rm: number; top_weight: number; sets: string };

/** Kişisel ipucu için kısa, deterministik geçmiş özeti (yoksa null). */
export function summarizeHistory(history: GuideHistorySession[], now = Date.now(), lang: Lang = 'tr'): string | null {
  if (history.length === 0) return null;
  const last = history.slice(-6);
  const lines = last.map((h) => {
    const days = Math.max(0, Math.round((now - h.started_at) / 86_400_000));
    return lang === 'en' ? `- ${days} days ago: ${h.sets} (estimated 1RM ${Math.round(h.best1rm * 2) / 2} kg)` : `- ${days} gün önce: ${h.sets} (tahmini 1RM ${Math.round(h.best1rm * 2) / 2} kg)`;
  });
  const recent = last.slice(-4);
  const plateau = recent.length >= 4 && Math.max(...recent.slice(1).map((s) => s.best1rm)) <= recent[0].best1rm * 1.005;
  return lang === 'en'
    ? `The user's latest sessions for this exercise (sets: kg x reps):\n${lines.join('\n')}${plateau ? '\nNote: estimated 1RM has not progressed over the last 4 sessions (plateau).' : ''}`
    : `Kullanıcının bu egzersizdeki son seansları (set: kg x tekrar):\n${lines.join('\n')}${plateau ? '\nNot: son 4 seansta tahmini 1RM ilerlemedi (plato).' : ''}`;
}

export const GUIDE_SYSTEM = `Sen deneyimli bir kuvvet antrenörüsün. Kullanıcı bir egzersiz adı verir; Türkçe, net ve güvenli bir uygulama rehberi üretirsin.
Kurallar:
- Tüm metin Türkçe olsun; egzersiz adı İngilizce kalabilir. Kısa, somut cümleler kur.
- setup: kurulum adımları (ekipman ayarı, duruş, tutuş). steps: adım adım uygulama (sırayla).
- keyAngles: kritik açılar ve pozisyonlar, mümkünse sayısal (ör. "dirsekler gövdeden yaklaşık 45°").
- breathing: tek cümlelik nefes düzeni. mistakes: tam 3 sık hata ve her birinin düzeltmesi.
- feel: çalışırken hissedilmesi gereken kaslar. safety: tek cümlelik güvenlik notu; ağrı için doktora/uzmana yönlendirme gerekirse belirt.
- personalTips: yalnızca kullanıcı geçmişi verildiyse 1-2 kişisel ipucu (ör. plato, tükeniş setleri, ağırlık artışı); geçmiş yoksa boş dizi döndür.
- Ağırlık/set sayısı gibi sayısal öneriler verme; bunlar uygulamada ayrı hesaplanır.
- Tıbbi tanı koyma.`;

export const GUIDE_SYSTEM_EN = `You are an experienced strength coach. The user gives an exercise name; you produce a clear, safe execution guide in English.
Rules:
- All text in English. Short, concrete sentences.
- setup: setup steps (equipment adjustment, stance, grip). steps: step-by-step execution (in order).
- keyAngles: key angles and positions, numeric where possible (e.g. "elbows about 45° from the torso").
- breathing: a one-sentence breathing pattern. mistakes: exactly 3 common mistakes, each with its fix.
- feel: the muscles that should be felt working. safety: a one-sentence safety note; refer to a doctor/professional for pain if needed.
- personalTips: only if the user's history is provided, 1-2 personal tips (e.g. plateau, failure sets, weight increase); return an empty array if there is no history.
- Do not give numeric recommendations such as weight/set counts; the app calculates those separately.
- Do not diagnose medical conditions.`;

/** Seçili dilde rehber sistem talimatı (sabit metin → prompt cache). */
export const guideSystem = (lang: Lang) => (lang === 'en' ? GUIDE_SYSTEM_EN : GUIDE_SYSTEM);

export function guideUserPrompt(input: { name: string; muscle: string; equipment: string; history: string | null }, lang: Lang = 'tr') {
  if (lang === 'en') {
    return [`Exercise: ${input.name}`, `Muscle group: ${input.muscle}`, `Equipment: ${input.equipment}`, input.history ?? 'The user has no history for this exercise.'].join('\n');
  }
  return [
    `Egzersiz: ${input.name}`,
    `Kas grubu: ${input.muscle}`,
    `Ekipman: ${input.equipment}`,
    input.history ?? 'Kullanıcının bu egzersiz için geçmişi yok.',
  ].join('\n');
}

export const GUIDE_MAX_TOKENS = 4000;

/**
 * Rehber isteğinin gövdesi (SDK'ya verilecek). Sonnet için sunucu tarafı fallback ("default") açılır;
 * Haiku 5.5 fallback desteklemediği için o modelde eklenmez. Sıcaklık/top_p gibi örnekleme parametreleri
 * bu modellerde 400 verdiği için hiç gönderilmez.
 */
export function buildGuideRequest(model: string, prompt: string, lang: Lang = 'tr') {
  const smart = model === MODELS.smart;
  return {
    model,
    max_tokens: GUIDE_MAX_TOKENS,
    system: [{ type: 'text' as const, text: guideSystem(lang), cache_control: { type: 'ephemeral' as const } }],
    messages: [{ role: 'user' as const, content: prompt }],
    output_config: {
      effort: smart ? ('medium' as const) : ('low' as const),
      format: { type: 'json_schema' as const, schema: GUIDE_SCHEMA as unknown as { [key: string]: unknown } },
    },
    ...(smart ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
  };
}

// ───────────────────────── Yemek tahmini (fotoğraf / not) ─────────────────────────

export type MealConfidence = 'low' | 'medium' | 'high';

export type MealItem = {
  name: string;
  portion: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: MealConfidence;
};

export type MealEstimate = { items: MealItem[]; note: string };

const NUM = { type: 'number' } as const;

export const MEAL_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: STR,
          portion: STR,
          kcal: NUM,
          protein: NUM,
          carbs: NUM,
          fat: NUM,
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['name', 'portion', 'kcal', 'protein', 'carbs', 'fat', 'confidence'],
        additionalProperties: false,
      },
    },
    note: STR,
  },
  required: ['items', 'note'],
  additionalProperties: false,
} as const;

export const MEAL_SYSTEM_EN = `You are a nutrition expert. You identify the foods in the meal photo and/or note the user sends and estimate portions.
Rules:
- Make each distinct food its own item (e.g. rice, chicken, salad). Names in English.
- portion: the portion you estimate visually (e.g. "1 plate ≈ 200 g", "2 slices"). If the user's note gives a portion, rely on it.
- kcal, protein, carbs, fat: TOTAL values for that portion (kcal and grams). Keep kcal consistent with the macros (protein 4, carbs 4, fat 9 kcal/g).
- confidence: "low" if the portion or food is uncertain, "medium" if reasonable, "high" if clear.
- note: one sentence about the uncertainty of the estimate or hidden items such as sauce/oil.
- If there is no food in the photo, return an empty items array and say so in the note. This is an estimate; do not give medical advice.`;

export const MEAL_SYSTEM = `Sen bir beslenme uzmanısın. Kullanıcının gönderdiği yemek fotoğrafındaki ve/veya notundaki yiyecekleri tanır, porsiyonları tahmin edersin.
Kurallar:
- Her ayrı yiyeceği ayrı kalem yap (ör. pilav, tavuk, salata). Adlar Türkçe olsun.
- portion: görsel olarak tahmin ettiğin porsiyon (ör. "1 tabak ≈ 200 g", "2 dilim"). Kullanıcı notunda porsiyon verdiyse onu esas al.
- kcal, protein, carbs, fat: o porsiyon için TOPLAM değerler (kcal ve gram). Makrolarla kcal tutarlı olsun (protein 4, karbonhidrat 4, yağ 9 kcal/g).
- confidence: porsiyon veya yiyecek belirsizse "low", makul ise "medium", net ise "high".
- note: tahminin belirsizliği veya sos/yağ gibi görünmeyen kalemler hakkında tek cümle.
- Fotoğrafta yemek yoksa items boş dizi olsun ve note'ta bunu söyle. Bu bir tahmindir; tıbbi tavsiye verme.`;

const CONF = new Set(['low', 'medium', 'high']);
const isNum = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;

/** Tahmini doğrular; sayılar makul aralıkta değilse AiError('invalid'). */
export function validateMealEstimate(raw: unknown): MealEstimate {
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== 'object' || !Array.isArray(o.items) || typeof o.note !== 'string' || o.items.length > 12) throw new AiError('invalid');
  const items: MealItem[] = o.items.map((it) => {
    const x = it as Record<string, unknown>;
    if (!x || !isStr(x.name) || typeof x.portion !== 'string' || !isNum(x.kcal, 5000) || !isNum(x.protein, 500) || !isNum(x.carbs, 800) || !isNum(x.fat, 400) || typeof x.confidence !== 'string' || !CONF.has(x.confidence)) {
      throw new AiError('invalid');
    }
    return {
      name: x.name.trim(),
      portion: x.portion.trim(),
      kcal: Math.round(x.kcal),
      protein: Math.round(x.protein * 10) / 10,
      carbs: Math.round(x.carbs * 10) / 10,
      fat: Math.round(x.fat * 10) / 10,
      confidence: x.confidence as MealConfidence,
    };
  });
  return { items, note: o.note.trim() };
}

export type MealEstimateInput = { imageBase64?: string | null; note?: string | null };

/** Fotoğraf varsa Sonnet (kademeli kural), yalnızca metin varsa Haiku. */
export function mealTier(input: MealEstimateInput): ModelTier {
  return input.imageBase64 ? 'smart' : 'fast';
}

export const MEAL_MAX_TOKENS = 2000;

export function buildMealRequest(model: string, input: MealEstimateInput, lang: Lang = 'tr') {
  const smart = model === MODELS.smart;
  const content: ({ type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg'; data: string } } | { type: 'text'; text: string })[] = [];
  if (input.imageBase64) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: input.imageBase64 } });
  const note = input.note?.trim();
  content.push({
    type: 'text',
    text: lang === 'en' ? (note ? `User note: ${note}` : 'Estimate the calories and macros of this meal.') : note ? `Kullanıcı notu: ${note}` : 'Bu yemeğin kalori ve makro tahminini yap.',
  });
  return {
    model,
    max_tokens: MEAL_MAX_TOKENS,
    system: [{ type: 'text' as const, text: lang === 'en' ? MEAL_SYSTEM_EN : MEAL_SYSTEM, cache_control: { type: 'ephemeral' as const } }],
    messages: [{ role: 'user' as const, content }],
    output_config: {
      effort: smart ? ('medium' as const) : ('low' as const),
      format: { type: 'json_schema' as const, schema: MEAL_SCHEMA as unknown as { [key: string]: unknown } },
    },
    ...(smart ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
  };
}
