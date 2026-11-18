import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Button, Card, Chip, Divider, IconButton, Input, PressableScale, SectionHeader, T } from '@/components/ui';
import { Font, Radius, Spacing } from '@/constants/theme';
import { FOOD_CATEGORIES, type FoodCategoryId, type FoodTr } from '@/data/foods-tr';
import { addFoodLog, addFoodLogs, favoriteFoods, recentFoods, toggleFavorite, type Food } from '@/db/nutrition-queries';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { estimateMeal, hasApiKey, type MealEstimate } from '@/lib/ai';
import { AiError } from '@/lib/ai-core';
import { parseAmount } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { leave } from '@/lib/nav';
import { dayKey, defaultMeal, MEALS, type Meal } from '@/lib/nutrition';
import { displayFoodName, displayServing, foodName, nutritionForGrams, portionGrams, portionLabel, searchFoods, servingText } from '@/lib/food-search';
import { pickMealPhoto, type MealPhoto } from '@/lib/photo';
import { useT } from '@/components/language-provider';
import { mealLabel } from '@/i18n/labels';
import { decimalSep } from '@/i18n';

type Row = { name: string; kcal: string; protein: string; carbs: string; fat: string; portion: string };

const num = (s: string) => parseAmount(s) ?? 0;

export default function AddFood() {
  const _ = useT();
  const t = useTheme();
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ meal?: string; day?: string }>();
  const [today] = useState(() => dayKey(Date.now()));
  const day = params.day ?? today;
  const [meal, setMeal] = useState<Meal>((MEALS as readonly string[]).includes(params.meal ?? '') ? (params.meal as Meal) : defaultMeal(new Date().getHours()));
  const [saving, setSaving] = useState(false);
  const busy = useRef(false); // aynı render'daki hızlı çift dokunuşu da engeller
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Row>({ name: '', kcal: '', protein: '', carbs: '', fat: '', portion: '' });
  const { data, reload } = useDbQuery(async (db) => ({ fav: await favoriteFoods(db), recent: await recentFoods(db), key: await hasApiKey() }));

  const set = (k: keyof Row) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const canAdd = form.name.trim().length > 0 && num(form.kcal) > 0;

  /** Çift dokunmayı engeller: kayıt sürerken ikinci çağrı yok sayılır. */
  const guarded = async (fn: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      await fn();
      haptic.success();
      leave();
    } catch (e) {
      busy.current = false;
      setSaving(false);
      haptic.warning();
      setError(_('foodAdd.save_failed', { v: e instanceof Error && e.message ? e.message : _('common.unknown_error') }));
    }
  };

  const submit = () => {
    if (!canAdd) return;
    return guarded(() => addFoodLog(db, { day, meal, name: form.name, kcal: num(form.kcal), protein: num(form.protein), carbs: num(form.carbs), fat: num(form.fat), serving: form.portion.trim() || null, source: 'manual' }).then(() => {}));
  };

  const quick = (f: Food) => guarded(() => addFoodLog(db, { day, meal, name: f.name, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, serving: f.serving, source: 'manual' }).then(() => {}));

  const fav = async (f: Food) => {
    await toggleFavorite(db, f.id);
    reload();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
        {error && (
          <View style={{ backgroundColor: t.dangerSoft, borderRadius: 12, padding: Spacing.md, marginBottom: Spacing.md }} accessibilityRole="alert">
            <T variant="label" color={t.danger}>
              {error}
            </T>
          </View>
        )}
        <View style={styles.wrap}>
          {MEALS.map((m) => (
            <Chip key={m} label={mealLabel(m)} active={meal === m} onPress={() => setMeal(m)} />
          ))}
        </View>

        <SectionHeader title={_('foodAdd.search_food')} />
        <FoodSearch
          saving={saving}
          onAdd={(f, serving, n) => guarded(() => addFoodLog(db, { day, meal, name: f.name, kcal: n.kcal, protein: n.protein, carbs: n.carbs, fat: n.fat, serving, source: 'manual' }).then(() => {}))}
        />

        <SectionHeader title={_('foodAdd.quick_add')} />
        <Card style={{ gap: Spacing.md }}>
          <Input
            value={form.name}
            onChangeText={set('name')}
            placeholder={_('foodAdd.food_name')}
            placeholderTextColor={t.textMuted}
            style={[styles.input, { backgroundColor: t.surfaceRaised, color: t.text }]}
          />
          <View style={styles.wrap}>
            <Num label={_('foodAdd.calories')} unit={_('common.kcal')} value={form.kcal} onChange={set('kcal')} />
            <Num label={_('common.protein')} unit="g" value={form.protein} onChange={set('protein')} />
            <Num label={_('common.carbs')} unit="g" value={form.carbs} onChange={set('carbs')} />
            <Num label={_('common.fat')} unit="g" value={form.fat} onChange={set('fat')} />
          </View>
          <Input
            value={form.portion}
            onChangeText={set('portion')}
            placeholder={_('foodAdd.serving_e_g_1_bowl')}
            placeholderTextColor={t.textMuted}
            style={[styles.input, { backgroundColor: t.surfaceRaised, color: t.text }]}
          />
          <Button title={_('foodAdd.add')} icon="add" onPress={submit} disabled={!canAdd || saving} loading={saving} />
        </Card>

        {data && (data.fav.length > 0 || data.recent.length > 0) && (
          <>
            <SectionHeader title={_('foodAdd.frequent_foods')} />
            <Card padded={false}>
              {[...data.fav, ...data.recent].map((f, i, all) => (
                <View key={f.id}>
                  <View style={styles.foodRow}>
                    <PressableScale onPress={() => quick(f)} disabled={saving} style={{ flex: 1 }} scaleTo={0.99}>
                      <T variant="label" numberOfLines={1}>
                        {displayFoodName(f.name)}
                      </T>
                      <T variant="caption" secondary numberOfLines={1}>
                        {_('foodAdd.kcal_p_c_f', { v: Math.round(f.kcal), v2: Math.round(f.protein), v3: Math.round(f.carbs), v4: Math.round(f.fat), v5: f.serving ? ` · ${displayServing(f.serving)}` : '' })}
                      </T>
                    </PressableScale>
                    <PressableScale onPress={() => fav(f)} hitSlop={10} hapticOnPress={false}>
                      <Icon name={f.is_favorite ? 'starFill' : 'star'} size={18} color={f.is_favorite ? t.gold : t.textMuted} />
                    </PressableScale>
                  </View>
                  {i < all.length - 1 && <Divider />}
                </View>
              ))}
            </Card>
            <T variant="caption" muted style={{ marginTop: 6 }}>{_('foodAdd.tap_to_add_to_the')}</T>
          </>
        )}

        <SectionHeader title={_('foodAdd.estimate_from_photo_ai')} />
        <PhotoEstimate
          hasKey={data?.key ?? false}
          saving={saving}
          onSave={(rows) =>
            guarded(() =>
              addFoodLogs(
                db,
                rows.map((r) => ({ day, meal, name: r.name, kcal: num(r.kcal), protein: num(r.protein), carbs: num(r.carbs), fat: num(r.fat), serving: r.portion || null, source: 'ai' as const })),
              ),
            )
          }
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const fmt1 = (n: number) => String(Math.round(n * 10) / 10).replace('.', decimalSep());

/** Türkçe yemek veritabanında arama + porsiyon seçici. Veritabanında yoksa aşağıdaki hızlı ekle / AI akışı kullanılır. */
function FoodSearch({ saving, onAdd }: { saving: boolean; onAdd: (f: FoodTr, serving: string, n: { kcal: number; protein: number; carbs: number; fat: number }) => Promise<void> | undefined }) {
  const _ = useT();
  const t = useTheme();
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<FoodCategoryId | null>(null);
  const [picked, setPicked] = useState<FoodTr | null>(null);
  const [portionIdx, setPortionIdx] = useState(0); // -1 = serbest gram
  const [qty, setQty] = useState(1);
  const [gramText, setGramText] = useState('100');

  const searching = query.trim().length > 0 || cat != null;
  const results = useMemo(() => (searching ? searchFoods(query, cat, 30) : []), [query, cat, searching]);

  const pick = (f: FoodTr) => {
    setPicked(f);
    setPortionIdx(0);
    setQty(1);
    setGramText('100');
  };

  if (picked) {
    const portion = portionIdx >= 0 ? picked.portions[portionIdx] : null;
    const grams = portion ? portionGrams(portion, qty) : num(gramText);
    const n = nutritionForGrams(picked, grams);
    return (
      <Card style={{ gap: Spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <T variant="heading" numberOfLines={2}>
              {foodName(picked)}
            </T>
            <T variant="caption" secondary>{_('foodAdd.100_kcal_p_c_f', { unit: picked.unit, v: Math.round(picked.kcal), v2: fmt1(picked.protein), v3: fmt1(picked.carbs), v4: fmt1(picked.fat) })}
            </T>
          </View>
          <IconButton icon="close" label={_('foodAdd.close_selection')} onPress={() => setPicked(null)} />
        </View>
        <View style={styles.wrap}>
          {picked.portions.map((p, i) => (
            <Chip key={p.label} label={portionLabel(p.label)} active={portionIdx === i} onPress={() => setPortionIdx(i)} />
          ))}
          <Chip label={_('foodAdd.free', { unit: picked.unit })} active={portionIdx === -1} onPress={() => setPortionIdx(-1)} />
        </View>
        {portion ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.lg }}>
            <IconButton icon="minus" label={_('foodAdd.decrease_amount')} onPress={() => setQty((q) => Math.max(0.5, q - 0.5))} />
            <View style={{ minWidth: 90, alignItems: 'center' }}>
              <T variant="heading" style={{ fontSize: 22 }}>
                {fmt1(qty)}
              </T>
              <T variant="caption" muted>{_('foodAdd.serving', { v: Math.round(grams), unit: picked.unit })}
              </T>
            </View>
            <IconButton icon="add" label={_('foodAdd.increase_amount')} onPress={() => setQty((q) => Math.min(50, q + 0.5))} />
          </View>
        ) : (
          <View style={{ gap: 3 }}>
            <T variant="caption" secondary>{_('foodAdd.amount', { unit: picked.unit })}</T>
            <Input
              value={gramText}
              onChangeText={setGramText}
              keyboardType="decimal-pad"
              placeholder="100"
              placeholderTextColor={t.textMuted}
              accessibilityLabel={_('foodAdd.amount2', { unit: picked.unit })}
              style={[styles.input, { height: 42, backgroundColor: t.surfaceRaised, color: t.text }]}
            />
          </View>
        )}
        <View style={[styles.preview2, { backgroundColor: t.surfaceRaised }]}>
          <T variant="numLarge" style={{ fontSize: 30, lineHeight: 36 }}>
            {n.kcal} <T variant="label" secondary>{_('common.kcal')}</T>
          </T>
          <T variant="label" secondary>{_('foodAdd.p_g_c_g_f', { v: fmt1(n.protein), v2: fmt1(n.carbs), v3: fmt1(n.fat) })}</T>
        </View>
        <Button title={_('foodAdd.add_to_meal')} icon="add" onPress={() => onAdd(picked, servingText(picked, portion, qty, grams, 'tr'), n)} disabled={saving || grams <= 0} loading={saving} />
        <T variant="caption" muted>{_('foodAdd.values_are_approximate_they_vary')}</T>
      </Card>
    );
  }

  return (
    <Card style={{ gap: Spacing.md }}>
      <View style={[styles.searchBox, { backgroundColor: t.surfaceRaised }]}>
        <Icon name="search" size={16} color={t.textMuted} />
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder={_('foodAdd.search_bagel_meatballs_soup')}
          placeholderTextColor={t.textMuted}
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel={_('foodAdd.search_food')}
          style={{ flex: 1, color: t.text, fontSize: 15, fontFamily: Font.bold, height: 46 }}
        />
        {query.length > 0 && (
          <PressableScale onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel={_('common.clear_search')}>
            <Icon name="close" size={14} color={t.textMuted} />
          </PressableScale>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
        {FOOD_CATEGORIES.map((c) => (
          <Chip key={c.id} label={c.label} active={cat === c.id} onPress={() => setCat(cat === c.id ? null : c.id)} />
        ))}
      </ScrollView>
      {!searching ? (
        <T variant="caption" muted>{_('foodAdd.350_turkish_dishes_drinks_and')}</T>
      ) : results.length === 0 ? (
        <T variant="label" secondary>{_('foodAdd.no_results_enter_it_manually')}</T>
      ) : (
        <View>
          {results.map((f, i) => (
            <View key={f.id}>
              <PressableScale onPress={() => pick(f)} scaleTo={0.99} style={styles.resultRow} accessibilityRole="button" accessibilityLabel={_('foodAdd.select', { name: foodName(f) })}>
                <View style={{ flex: 1 }}>
                  <T variant="label" numberOfLines={1}>
                    {foodName(f)}
                  </T>
                  <T variant="caption" secondary numberOfLines={1}>{_('foodAdd.100_kcal_p_c_f2', { unit: f.unit, v: Math.round(f.kcal), v2: fmt1(f.protein), v3: fmt1(f.carbs), v4: fmt1(f.fat) })}
                  </T>
                </View>
                <Icon name="chevronRight" size={12} color={t.textMuted} />
              </PressableScale>
              {i < results.length - 1 && <Divider />}
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

function PhotoEstimate({ hasKey, saving, onSave }: { hasKey: boolean; saving: boolean; onSave: (rows: Row[]) => Promise<void> | undefined }) {
  const _ = useT();
  const t = useTheme();
  const db = useSQLiteContext();
  const [photo, setPhoto] = useState<MealPhoto | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [est, setEst] = useState<MealEstimate | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  if (!hasKey) {
    return (
      <Card style={{ gap: Spacing.md }}>
        <View style={{ flexDirection: 'row', gap: Spacing.md, alignItems: 'center' }}>
          <View style={[styles.aiIcon, { backgroundColor: t.violetSoft }]}>
            <Icon name="camera" size={20} color={t.violet} />
          </View>
          <T variant="label" secondary style={{ flex: 1 }}>{_('foodAdd.once_you_add_an_api')}</T>
        </View>
        <Button title={_('foodAdd.add_key')} icon="add" kind="secondary" onPress={() => router.push('/settings')} />
      </Card>
    );
  }

  const pick = async (src: 'camera' | 'library') => {
    setError(null);
    try {
      const p = await pickMealPhoto(src);
      if (p) {
        setPhoto(p);
        setEst(null);
        setRows([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : _('foodAdd.couldn_t_get_the_photo'));
    }
  };

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await estimateMeal(db, { imageBase64: photo?.base64, note });
      setEst(r);
      setRows(r.items.map((i) => ({ name: i.name, kcal: String(i.kcal), protein: String(i.protein), carbs: String(i.carbs), fat: String(i.fat), portion: i.portion })));
    } catch (e) {
      setError(e instanceof AiError ? e.userMessage : _('foodAdd.couldn_t_make_an_estimate'));
    } finally {
      setBusy(false);
    }
  };

  const upd = (i: number, k: keyof Row, v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const total = rows.reduce((a, r) => a + num(r.kcal), 0);
  const valid = rows.length > 0 && rows.every((r) => r.name.trim() && num(r.kcal) > 0);

  return (
    <Card style={{ gap: Spacing.md }}>
      <View style={styles.wrap}>
        <Button title={_('foodAdd.camera')} icon="camera" kind="secondary" small onPress={() => pick('camera')} />
        <Button title={_('foodAdd.gallery')} icon="photo" kind="secondary" small onPress={() => pick('library')} />
      </View>
      {photo && <Image source={{ uri: photo.uri }} style={styles.preview} contentFit="cover" />}
      <Input
        value={note}
        onChangeText={setNote}
        placeholder={_('foodAdd.note_optional_e_g_2')}
        placeholderTextColor={t.textMuted}
        style={[styles.input, { backgroundColor: t.surfaceRaised, color: t.text }]}
      />
      <Button title={_('foodAdd.estimate')} icon="sparkles" onPress={run} loading={busy} disabled={!photo && !note.trim()} />
      <T variant="caption" muted>{_('foodAdd.the_photo_is_resized_to')}</T>
      {error && (
        <T variant="label" color={t.danger}>
          {error}
        </T>
      )}
      {est && (
        <>
          <Divider />
          {rows.length === 0 && <T secondary>{_('foodAdd.no_food_found', { note: est.note })}</T>}
          {rows.map((r, i) => {
            const conf = est.items[i]?.confidence;
            return (
              <View key={i} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Input
                    value={r.name}
                    onChangeText={(v) => upd(i, 'name', v)}
                    style={[styles.input, { flex: 1, height: 42, backgroundColor: t.surfaceRaised, color: t.text }]}
                  />
                  <PressableScale onPress={() => setRows((rs) => rs.filter((_, j) => j !== i))} hitSlop={8}>
                    <Icon name="trash" size={16} color={t.danger} />
                  </PressableScale>
                </View>
                <T variant="caption" secondary>
                  {r.portion}
                  {conf ? _('foodAdd.confidence', { v: conf === 'high' ? _('foodAdd.high') : conf === 'medium' ? 'orta' : _('foodAdd.low') }) : ''}
                </T>
                <View style={styles.wrap}>
                  <Num label={_('common.kcal')} unit="" value={r.kcal} onChange={(v) => upd(i, 'kcal', v)} />
                  <Num label={_('foodAdd.p')} unit="g" value={r.protein} onChange={(v) => upd(i, 'protein', v)} />
                  <Num label={_('foodAdd.c')} unit="g" value={r.carbs} onChange={(v) => upd(i, 'carbs', v)} />
                  <Num label={_('foodAdd.f')} unit="g" value={r.fat} onChange={(v) => upd(i, 'fat', v)} />
                </View>
              </View>
            );
          })}
          {est.note ? (
            <T variant="caption" muted>
              {est.note}
            </T>
          ) : null}
          {rows.length > 0 && <Button title={_('foodAdd.save_all_kcal', { v: Math.round(total) })} icon="check" onPress={() => onSave(rows)} disabled={!valid || saving} loading={saving} />}
        </>
      )}
    </Card>
  );
}

function Num({ label, unit, value, onChange }: { label: string; unit: string; value: string; onChange: (v: string) => void }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, minWidth: 64, gap: 3 }}>
      <T variant="caption" secondary>
        {label}
        {unit ? ` (${unit})` : ''}
      </T>
      <Input
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={t.textMuted}
        style={[styles.input, { height: 42, backgroundColor: t.surfaceRaised, color: t.text, paddingHorizontal: 10 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { height: 48, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, fontSize: 15, fontFamily: Font.bold },
  foodRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.md, borderRadius: Radius.md },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: Spacing.md },
  preview2: { borderRadius: Radius.md, padding: Spacing.md, gap: 2, alignItems: 'center' },
  aiIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  preview: { width: '100%', height: 200, borderRadius: Radius.md },
});
