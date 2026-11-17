/**
 * AI istemcisi (React Native). API anahtarı yalnızca `expo-secure-store`'da tutulur;
 * koda, loga ya da DB'ye yazılmaz. Anahtar yoksa tüm çağrılar AiError('no-key') verir.
 */
import * as SecureStore from 'expo-secure-store';

import { loadAnthropic } from '@/lib/anthropic-sdk';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getLanguage } from '@/i18n';
import { deleteGuide, exerciseHistory, getGuideRow, getSetting, saveGuide, setSetting, type Exercise } from '@/db/queries';

import {
  AiError,
  buildGuideRequest,
  buildMealRequest,
  mealTier,
  validateMealEstimate,
  type MealEstimate,
  type MealEstimateInput,
  extractJson,
  guideUserPrompt,
  parseCachedGuide,
  parseModelPref,
  resolveModel,
  summarizeHistory,
  toAiError,
  validateGuide,
  MODELS,
  type ExerciseGuide,
  type ModelPref,
  type ModelTier,
} from './ai-core';

export { AiError, MODELS };
export type { ExerciseGuide, MealEstimate, ModelPref };

const KEY_NAME = 'gymcime_anthropic_key';
const PREF_KEY = 'ai_model_pref';

// ───────────────────────── Anahtar ─────────────────────────

export async function getApiKey(): Promise<string | null> {
  try {
    const v = await SecureStore.getItemAsync(KEY_NAME);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

export async function hasApiKey() {
  return (await getApiKey()) !== null;
}

export async function setApiKey(key: string) {
  await SecureStore.setItemAsync(KEY_NAME, key.trim());
}

export async function clearApiKey() {
  await SecureStore.deleteItemAsync(KEY_NAME);
}

// ───────────────────────── Model tercihi ─────────────────────────

export async function getModelPref(db: SQLiteDatabase): Promise<ModelPref> {
  return parseModelPref(await getSetting(db, PREF_KEY));
}

export async function saveModelPref(db: SQLiteDatabase, pref: ModelPref) {
  await setSetting(db, PREF_KEY, pref);
}

// ───────────────────────── İstemci ─────────────────────────

async function makeClient() {
  const apiKey = await getApiKey();
  if (!apiKey) throw new AiError('no-key');
  // Anahtar kullanıcının kendi cihazında, kendi hesabına ait; bu yüzden tarayıcı/RN kullanımına izin veriyoruz.
  // Akışsız (non-streaming) istekler RN'nin yerleşik fetch'i ile çalışır.
  const Anthropic = loadAnthropic();
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, timeout: 90_000, maxRetries: 1 });
}

/**
 * Bağlantı testi: en ucuz modelle minik bir istek (ücretli). Yalnızca kullanıcı butona basınca çağrılır.
 */
export async function testConnection(): Promise<void> {
  try {
    const client = await makeClient();
    const res = await client.messages.create({
      model: MODELS.fast,
      max_tokens: 16,
      messages: [{ role: 'user', content: 'Reply with just "ok".' }],
    });
    if (res.stop_reason === 'refusal') throw new AiError('refusal');
  } catch (e) {
    throw toAiError(e);
  }
}

// ───────────────────────── Egzersiz rehberi ─────────────────────────

export async function getCachedGuide(db: SQLiteDatabase, exerciseId: number, lang = getLanguage()): Promise<{ guide: ExerciseGuide; createdAt: number } | null> {
  const row = await getGuideRow(db, exerciseId, lang);
  const guide = parseCachedGuide(row?.json);
  return row && guide ? { guide, createdAt: row.created_at } : null;
}

/**
 * Rehberi üretir ve önbelleğe yazar. `force` yoksa önbellek varsa API'ye hiç gitmez.
 * Egzersiz başına bir kez üretilir; "yeniden oluştur" force ile çağırır.
 */
export async function generateGuide(db: SQLiteDatabase, exercise: Exercise, opts: { force?: boolean; tier?: ModelTier } = {}): Promise<ExerciseGuide> {
  const lang = getLanguage(); // rehber seçili dilde istenir ve dile göre ayrı önbelleğe yazılır
  if (!opts.force) {
    const cached = await getCachedGuide(db, exercise.id, lang);
    if (cached) return cached.guide;
  }
  try {
    const client = await makeClient();
    const pref = await getModelPref(db);
    const model = resolveModel(opts.tier ?? 'smart', pref);
    const history = summarizeHistory(await exerciseHistory(db, exercise.id), Date.now(), lang);
    const prompt = guideUserPrompt({ name: exercise.name, muscle: exercise.muscle, equipment: exercise.equipment, history }, lang);
    const res = await client.beta.messages.create(buildGuideRequest(model, prompt, lang));
    const guide = validateGuide(extractJson(res));
    await saveGuide(db, exercise.id, JSON.stringify(guide), model, Date.now(), lang);
    return guide;
  } catch (e) {
    throw toAiError(e);
  }
}

export async function resetGuide(db: SQLiteDatabase, exerciseId: number) {
  await deleteGuide(db, exerciseId, getLanguage());
}

// ───────────────────────── Yemek tahmini ─────────────────────────

/** Fotoğraf (1024 px JPEG, base64) ve/veya nottan kalori/makro tahmini. Ücretlidir; yalnızca kullanıcı isteyince çağrılır. */
export async function estimateMeal(db: SQLiteDatabase, input: MealEstimateInput): Promise<MealEstimate> {
  try {
    if (!input.imageBase64 && !input.note?.trim()) throw new AiError('invalid');
    const client = await makeClient();
    const pref = await getModelPref(db);
    const model = resolveModel(mealTier(input), pref);
    const res = await client.beta.messages.create(buildMealRequest(model, input, getLanguage()));
    return validateMealEstimate(extractJson(res));
  } catch (e) {
    throw toAiError(e);
  }
}
