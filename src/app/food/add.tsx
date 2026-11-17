import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Button, Card, Chip, Divider, PressableScale, SectionHeader, T } from '@/components/ui';
import { Font, Radius, Spacing } from '@/constants/theme';
import { addFoodLog, addFoodLogs, favoriteFoods, recentFoods, toggleFavorite, type Food } from '@/db/nutrition-queries';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { estimateMeal, hasApiKey, type MealEstimate } from '@/lib/ai';
import { AiError } from '@/lib/ai-core';
import { parseNumber } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { leave } from '@/lib/nav';
import { dayKey, defaultMeal, MEALS, type Meal } from '@/lib/nutrition';
import { pickMealPhoto, type MealPhoto } from '@/lib/photo';

type Row = { name: string; kcal: string; protein: string; carbs: string; fat: string; portion: string };

const num = (s: string) => parseNumber(s) ?? 0;

export default function AddFood() {
  const t = useTheme();
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ meal?: string; day?: string }>();
  const [today] = useState(() => dayKey(Date.now()));
  const day = params.day ?? today;
  const [meal, setMeal] = useState<Meal>((MEALS as readonly string[]).includes(params.meal ?? '') ? (params.meal as Meal) : defaultMeal(new Date().getHours()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Row>({ name: '', kcal: '', protein: '', carbs: '', fat: '', portion: '' });
  const { data, reload } = useDbQuery(async (db) => ({ fav: await favoriteFoods(db), recent: await recentFoods(db), key: await hasApiKey() }));

  const set = (k: keyof Row) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const canAdd = form.name.trim().length > 0 && num(form.kcal) > 0;

  /** Çift dokunmayı engeller: kayıt sürerken ikinci çağrı yok sayılır. */
  const guarded = async (fn: () => Promise<void>) => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await fn();
      haptic.success();
      leave();
    } catch (e) {
      setSaving(false);
      haptic.warning();
      setError(`Kaydedilemedi: ${e instanceof Error && e.message ? e.message : 'bilinmeyen hata'}. Tekrar dene.`);
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
            <Chip key={m} label={m} active={meal === m} onPress={() => setMeal(m)} />
          ))}
        </View>

        <SectionHeader title="Hızlı ekle" />
        <Card style={{ gap: Spacing.md }}>
          <TextInput
            value={form.name}
            onChangeText={set('name')}
            placeholder="Yiyecek adı"
            placeholderTextColor={t.textMuted}
            style={[styles.input, { backgroundColor: t.surfaceRaised, color: t.text }]}
          />
          <View style={styles.wrap}>
            <Num label="Kalori" unit="kcal" value={form.kcal} onChange={set('kcal')} />
            <Num label="Protein" unit="g" value={form.protein} onChange={set('protein')} />
            <Num label="Karb." unit="g" value={form.carbs} onChange={set('carbs')} />
            <Num label="Yağ" unit="g" value={form.fat} onChange={set('fat')} />
          </View>
          <TextInput
            value={form.portion}
            onChangeText={set('portion')}
            placeholder="Porsiyon (ör. 1 kase, 150 g)"
            placeholderTextColor={t.textMuted}
            style={[styles.input, { backgroundColor: t.surfaceRaised, color: t.text }]}
          />
          <Button title="Ekle" icon="add" onPress={submit} disabled={!canAdd || saving} loading={saving} />
        </Card>

        {data && (data.fav.length > 0 || data.recent.length > 0) && (
          <>
            <SectionHeader title="Sık yenenler" />
            <Card padded={false}>
              {[...data.fav, ...data.recent].map((f, i, all) => (
                <View key={f.id}>
                  <View style={styles.foodRow}>
                    <PressableScale onPress={() => quick(f)} disabled={saving} style={{ flex: 1 }} scaleTo={0.99}>
                      <T variant="label" numberOfLines={1}>
                        {f.name}
                      </T>
                      <T variant="caption" secondary numberOfLines={1}>
                        {Math.round(f.kcal)} kcal · P {Math.round(f.protein)} K {Math.round(f.carbs)} Y {Math.round(f.fat)}
                        {f.serving ? ` · ${f.serving}` : ''}
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
            <T variant="caption" muted style={{ marginTop: 6 }}>
              Dokununca seçili öğüne eklenir.
            </T>
          </>
        )}

        <SectionHeader title="Fotoğraftan tahmin (AI)" />
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

function PhotoEstimate({ hasKey, saving, onSave }: { hasKey: boolean; saving: boolean; onSave: (rows: Row[]) => Promise<void> | undefined }) {
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
          <T variant="label" secondary style={{ flex: 1 }}>
            API anahtarı ekleyince yemeğin fotoğrafını çekip kalori ve makro tahmini alabilirsin. Tahmini sen düzenleyip kaydedersin.
          </T>
        </View>
        <Button title="Anahtar ekle" icon="add" kind="secondary" onPress={() => router.push('/settings')} />
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
      setError(e instanceof Error ? e.message : 'Fotoğraf alınamadı.');
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
      setError(e instanceof AiError ? e.userMessage : 'Tahmin yapılamadı.');
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
        <Button title="Kamera" icon="camera" kind="secondary" small onPress={() => pick('camera')} />
        <Button title="Galeri" icon="photo" kind="secondary" small onPress={() => pick('library')} />
      </View>
      {photo && <Image source={{ uri: photo.uri }} style={styles.preview} contentFit="cover" />}
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Not (isteğe bağlı): ör. 2 yumurta, 1 dilim ekmek"
        placeholderTextColor={t.textMuted}
        style={[styles.input, { backgroundColor: t.surfaceRaised, color: t.text }]}
      />
      <Button title="Tahmin et" icon="sparkles" onPress={run} loading={busy} disabled={!photo && !note.trim()} />
      <T variant="caption" muted>
        Fotoğraf 1024 px boyutuna küçültülür. Her tahmin küçük bir ücrete tabidir; sonuçları kaydetmeden önce düzenleyebilirsin.
      </T>
      {error && (
        <T variant="label" color={t.danger}>
          {error}
        </T>
      )}
      {est && (
        <>
          <Divider />
          {rows.length === 0 && <T secondary>Yemek bulunamadı. {est.note}</T>}
          {rows.map((r, i) => {
            const conf = est.items[i]?.confidence;
            return (
              <View key={i} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <TextInput
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
                  {conf ? ` · güven: ${conf === 'high' ? 'yüksek' : conf === 'medium' ? 'orta' : 'düşük'}` : ''}
                </T>
                <View style={styles.wrap}>
                  <Num label="kcal" unit="" value={r.kcal} onChange={(v) => upd(i, 'kcal', v)} />
                  <Num label="P" unit="g" value={r.protein} onChange={(v) => upd(i, 'protein', v)} />
                  <Num label="K" unit="g" value={r.carbs} onChange={(v) => upd(i, 'carbs', v)} />
                  <Num label="Y" unit="g" value={r.fat} onChange={(v) => upd(i, 'fat', v)} />
                </View>
              </View>
            );
          })}
          {est.note ? (
            <T variant="caption" muted>
              {est.note}
            </T>
          ) : null}
          {rows.length > 0 && <Button title={`Hepsini kaydet · ${Math.round(total)} kcal`} icon="check" onPress={() => onSave(rows)} disabled={!valid || saving} loading={saving} />}
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
      <TextInput
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
  aiIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  preview: { width: '100%', height: 200, borderRadius: Radius.md },
});
