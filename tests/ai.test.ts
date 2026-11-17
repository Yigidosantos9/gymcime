import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { migrateDb } from '@/db/migrate';
import { getGuideRow, saveGuide, deleteGuide, deleteAllData } from '@/db/queries';
import { SEED_EXERCISES } from '@/db/seed';
import { EXERCISE_MEDIA } from '@/db/exercise-media';
import { AiError, MODELS, resolveModel, parseModelPref, toAiError, extractJson, validateGuide, parseCachedGuide, summarizeHistory, buildGuideRequest, GUIDE_SCHEMA } from '@/lib/ai-core';
const assert = (c: any, m: string) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };
const throwsKind = (fn: () => any, kind: string, m: string) => { try { fn(); } catch (e: any) { assert(e instanceof AiError && e.kind === kind && e.userMessage.length > 5, m); return; } throw new Error('FAIL (no throw): ' + m); };

const good = { setup: ['a'], steps: ['b', 'c'], keyAngles: ['45°'], breathing: 'nefes', mistakes: [{ mistake: 'x', fix: 'y' }, { mistake: 'x2', fix: 'y2' }, { mistake: 'x3', fix: 'y3' }], feel: ['göğüs'], safety: 'dikkat', personalTips: ['ipucu'] };
(async () => {
  // model seçimi
  assert(MODELS.fast === 'claude-haiku-5-5' && MODELS.smart === 'claude-sonnet-5-5', 'model sabitleri');
  assert(resolveModel('smart', 'balanced') === MODELS.smart && resolveModel('fast', 'balanced') === MODELS.fast, 'dengeli: kademeli');
  assert(resolveModel('smart', 'fast') === MODELS.fast, 'hızlı tercih: hep Haiku');
  assert(parseModelPref(null) === 'balanced' && parseModelPref('fast') === 'fast' && parseModelPref('x') === 'balanced', 'tercih ayrıştırma');
  // şema
  assert((GUIDE_SCHEMA as any).additionalProperties === false && (GUIDE_SCHEMA as any).required.length === 8, 'şema katı');
  // doğrulama
  const g = validateGuide(good);
  assert(g.mistakes.length === 3 && g.personalTips.length === 1, 'geçerli rehber');
  throwsKind(() => validateGuide({ ...good, steps: [] }), 'invalid', 'boş adımlar reddedilir');
  throwsKind(() => validateGuide({ ...good, mistakes: [{ mistake: 'x' }] }), 'invalid', 'eksik hata düzeltmesi reddedilir');
  throwsKind(() => validateGuide({ ...good, breathing: 5 }), 'invalid', 'yanlış tip reddedilir');
  throwsKind(() => validateGuide(null), 'invalid', 'null reddedilir');
  assert(validateGuide({ ...good, personalTips: ['1', '2', '3'] }).personalTips.length === 2, 'en fazla 2 kişisel ipucu');
  assert(parseCachedGuide('{bozuk') === null && parseCachedGuide(null) === null && parseCachedGuide(JSON.stringify(good)) !== null, 'önbellek ayrıştırma');
  // yanıt ayrıştırma
  assert((extractJson({ stop_reason: 'end_turn', content: [{ type: 'thinking' }, { type: 'text', text: JSON.stringify(good) }] }) as any).steps.length === 2, 'thinking bloğu atlanıp metin okunur');
  throwsKind(() => extractJson({ stop_reason: 'refusal', content: [] }), 'refusal', 'refusal');
  throwsKind(() => extractJson({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{' }] }), 'truncated', 'max_tokens');
  throwsKind(() => extractJson({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'json değil' }] }), 'invalid', 'bozuk JSON');
  throwsKind(() => extractJson({ stop_reason: 'end_turn', content: [] }), 'invalid', 'boş içerik');
  // hata dönüşümü (ağ yok, gerçek istek yok)
  const mk = (C: any, ...a: any[]) => new C(...a);
  assert(toAiError(mk(Anthropic.AuthenticationError, 401, {}, 'x', new Headers())).kind === 'auth', '401 -> auth');
  assert(toAiError(mk(Anthropic.RateLimitError, 429, {}, 'x', new Headers())).kind === 'rate', '429 -> rate');
  assert(toAiError(new Anthropic.APIConnectionError({ message: 'x' })).kind === 'network', 'bağlantı -> network');
  assert(toAiError(new AiError('no-key')).kind === 'no-key', 'AiError olduğu gibi');
  assert(toAiError(new Error('x')).kind === 'other', 'bilinmeyen -> other');
  assert(new AiError('no-key').userMessage.includes('API anahtarı'), 'anahtar yok mesajı Türkçe');
  // istek gövdesi
  const r1: any = buildGuideRequest(MODELS.smart, 'p');
  assert(r1.fallbacks === 'default' && r1.betas[0] === 'server-side-fallback-2026-07-01', 'Sonnet: fallback açık');
  assert(r1.temperature === undefined && r1.thinking === undefined && r1.tool_choice === undefined, 'yasak parametre yok');
  assert(r1.output_config.format.type === 'json_schema' && r1.system[0].cache_control.type === 'ephemeral', 'şemalı çıktı + prompt caching');
  const r2: any = buildGuideRequest(MODELS.fast, 'p');
  assert(r2.fallbacks === undefined && r2.betas === undefined && r2.output_config.effort === 'low', 'Haiku: fallback yok');
  assert(!JSON.stringify(r1).includes('sk-ant'), 'istekte anahtar yok');
  // geçmiş özeti
  assert(summarizeHistory([]) === null, 'geçmiş yok -> null');
  const NOW = 1_800_000_000_000, D = 86_400_000;
  const h = [0, 1, 2, 3].map((i) => ({ started_at: NOW - (10 - i * 3) * D, best1rm: 100, top_weight: 80, sets: '80x8, 80x8' }));
  assert(summarizeHistory(h, NOW)!.includes('plato'), 'plato algılanır');
  const up = h.map((x, i) => ({ ...x, best1rm: 100 + i * 5 }));
  assert(!summarizeHistory(up, NOW)!.includes('plato'), 'ilerleme varsa plato yok');
  // DB: migrasyon + önbellek
  const raw = new DatabaseSync(':memory:');
  const norm = (p: any[]) => (p.length === 1 && Array.isArray(p[0]) ? p[0] : p);
  const db: any = {
    execAsync: async (q: string) => raw.exec(q),
    runAsync: async (q: string, ...p: any[]) => { const r = raw.prepare(q).run(...norm(p)); return { lastInsertRowId: Number(r.lastInsertRowid) }; },
    getFirstAsync: async (q: string, ...p: any[]) => raw.prepare(q).get(...norm(p)) ?? null,
    getAllAsync: async (q: string, ...p: any[]) => raw.prepare(q).all(...norm(p)),
    withTransactionAsync: async (fn: any) => { raw.exec('BEGIN'); await fn(); raw.exec('COMMIT'); },
  };
  await migrateDb(db);
  assert((raw.prepare('PRAGMA user_version').get() as any).user_version >= 4, 'migrasyon v4+');
  await migrateDb(db);
  assert(await getGuideRow(db, 1) === null, 'önbellek boş');
  await saveGuide(db, 1, JSON.stringify(good), MODELS.smart, 111);
  await saveGuide(db, 1, JSON.stringify({ ...good, safety: 'yeni' }), MODELS.fast, 222);
  const row = await getGuideRow(db, 1);
  assert(row!.created_at === 222 && row!.model === MODELS.fast && parseCachedGuide(row!.json)!.safety === 'yeni', 'önbellek upsert');
  await deleteGuide(db, 1);
  assert(await getGuideRow(db, 1) === null, 'önbellek silme');
  await saveGuide(db, 2, JSON.stringify(good), null);
  await deleteAllData(db);
  assert(await getGuideRow(db, 2) === null, 'tüm veriyi silince rehber de gider');
  // medya haritası bütünlüğü
  const slugs = new Set(SEED_EXERCISES.map((e) => e[0]));
  assert(Object.keys(EXERCISE_MEDIA).every((s) => slugs.has(s)), 'medya slugları seed ile uyumlu');
  assert(Object.values(EXERCISE_MEDIA).every((m) => m.images.length === 2), '2 görsel var');
  const files = fs.readdirSync(process.cwd() + '/assets/exercises');
  assert(Object.keys(EXERCISE_MEDIA).every((s) => files.includes(`${s}-0.jpg`) && files.includes(`${s}-1.jpg`)), 'görsel dosyaları mevcut');
  console.log('\nGÖREV 1 TESTLERİ GEÇTİ');
})().catch((e) => { console.error(e); process.exit(1); });
