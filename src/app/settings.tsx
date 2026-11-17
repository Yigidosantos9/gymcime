import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { ReminderSettingsSection } from '@/components/reminder-settings';
import { useSheet } from '@/components/sheet';
import { useThemeContext } from '@/components/theme-provider';
import { Button, Card, Chip, PressableScale, SectionHeader, T } from '@/components/ui';
import { Font, Radius, Spacing, type ThemePreference } from '@/constants/theme';
import { clearApiKey, getModelPref, hasApiKey, saveModelPref, setApiKey, testConnection, type ModelPref } from '@/lib/ai';
import { AiError } from '@/lib/ai-core';
import { backupCounts, importBackup, BackupError } from '@/db/backup';
import { pickBackup, shareBackup } from '@/lib/backup-io';
import { deleteAllData, getProfile, saveProfile, type Profile } from '@/db/queries';
import { useTheme } from '@/hooks/use-theme';
import { dayWarning, notRecommended, WEEK_DAYS } from '@/lib/goals';
import { ALL_PLATES, BAR_OPTIONS } from '@/lib/plates';
import { RECOVERY_OPTIONS } from '@/lib/recovery';
import { haptic } from '@/lib/haptics';
import { syncReminders } from '@/lib/reminder-io';
import { formatRest } from '@/lib/rest';
import { goHome } from '@/lib/nav';

const REST_OPTIONS = [60, 90, 120, 150, 180];
const GOALS = ['Kas kazanmak', 'Güçlenmek', 'Yağ yakmak', 'Formda kalmak'];
const THEMES: { key: ThemePreference; label: string; icon: IconName }[] = [
  { key: 'dark', label: 'Koyu', icon: 'moon' },
  { key: 'light', label: 'Açık', icon: 'sun' },
  { key: 'system', label: 'Sistem', icon: 'phone' },
];

export default function Settings() {
  const t = useTheme();
  const db = useSQLiteContext();
  const sheet = useSheet();
  const { preference, setPreference } = useThemeContext();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    getProfile(db).then(setProfile);
  }, [db]);

  if (!profile) return null;

  const update = async (patch: Partial<Profile>) => {
    const next = { ...profile, ...patch };
    setProfile(next);
    await saveProfile(db, next);
  };

  const reset = () =>
    sheet.actions({
      title: 'Tüm veriler silinsin mi?',
      message: 'Antrenmanlar, rutinler ve profilin kalıcı olarak silinir.',
      actions: [
        {
          label: 'Her şeyi sil',
          icon: 'trash',
          style: 'destructive',
          onPress: async () => {
            await deleteAllData(db);
            await clearApiKey().catch(() => {});
            await syncReminders(db); // ayarlar silindi → planlı bildirimler de kalkar
            haptic.warning();
            goHome();
            router.replace('/onboarding');
          },
        },
      ],
    });

  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 60 }}>
      <SectionHeader title="Görünüm" />
      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        {THEMES.map((th) => {
          const active = preference === th.key;
          return (
            <PressableScale
              key={th.key}
              onPress={() => setPreference(th.key)}
              style={[styles.themeBtn, { backgroundColor: active ? t.primarySoft : t.surface, borderColor: active ? t.primary : t.border }]}>
              <Icon name={th.icon} size={20} color={active ? t.primary : t.textSecondary} />
              <T variant="label" color={active ? t.primary : t.textSecondary}>
                {th.label}
              </T>
            </PressableScale>
          );
        })}
      </View>

      <SectionHeader title="Profil" />
      <Card style={{ gap: Spacing.md }}>
        <T variant="label" secondary>
          Adın
        </T>
        <TextInput
          value={profile.name}
          onChangeText={(name) => setProfile({ ...profile, name })}
          onEndEditing={() => update({})}
          style={[styles.input, { backgroundColor: t.surfaceRaised, color: t.text }]}
        />
        <T variant="label" secondary>
          Hedef
        </T>
        <View style={styles.wrap}>
          {GOALS.map((g) => (
            <Chip key={g} label={g} active={profile.goal === g} onPress={() => update({ goal: g })} />
          ))}
        </View>
        <T variant="label" secondary>
          Haftalık hedef
        </T>
        <View style={styles.wrap}>
          {WEEK_DAYS.map((d) => (
            <Chip
              key={d}
              label={`${d} gün${notRecommended(d) ? ' · önerilmez' : ''}`}
              tint={notRecommended(d) ? t.gold : undefined}
              active={profile.daysPerWeek === d}
              onPress={() => update({ daysPerWeek: d })}
            />
          ))}
        </View>
        {dayWarning(profile.daysPerWeek) && (
          <T variant="caption" color={t.gold}>
            {dayWarning(profile.daysPerWeek)}
          </T>
        )}
      </Card>

      <SectionHeader title="Mola" />
      <Card style={{ gap: Spacing.md }}>
        <T variant="label" secondary>
          Genel varsayılan dinlenme
        </T>
        <View style={styles.wrap}>
          {REST_OPTIONS.map((s) => (
            <Chip key={s} label={formatRest(s)} active={profile.restSeconds === s} onPress={() => update({ restSeconds: s })} />
          ))}
        </View>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <T variant="label">Mola bitince ses</T>
            <T variant="caption" muted>
              Telefon sessizdeyken çalmaz, sadece titrer
            </T>
          </View>
          <Switch value={profile.soundOn} onValueChange={(v) => update({ soundOn: v })} trackColor={{ true: t.primary, false: t.surfacePressed }} />
        </View>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <T variant="label">Titreşim</T>
            <T variant="caption" muted>
              Son 3 saniye ve mola bitişinde
            </T>
          </View>
          <Switch value={profile.hapticOn} onValueChange={(v) => update({ hapticOn: v })} trackColor={{ true: t.primary, false: t.surfacePressed }} />
        </View>
        <T variant="caption" muted>
          Egzersizlerin kendi varsayılanı varsa o kullanılır (ör. squat 3 dk, curl 75 sn). Egzersiz detayından veya antrenman sırasında değiştirebilirsin. Isınma setlerinde mola yarıya iner, drop setlerde mola olmaz.
        </T>
      </Card>

      <SectionHeader title="Kas toparlanması" />
      <Card style={{ gap: Spacing.md }}>
        <T variant="label" secondary>
          Bir kas grubunu tekrar çalıştırmadan önce önerilen dinlenme
        </T>
        <View style={styles.wrap}>
          {RECOVERY_OPTIONS.map((d) => (
            <Chip key={d} label={`${d} gün`} active={profile.recoveryDays === d} onPress={() => update({ recoveryDays: d })} />
          ))}
        </View>
        <T variant="caption" muted>
          Ana sayfadaki toparlanma kartı ve sıradaki antrenman önerisi buna göre çalışır. Çoğu kişi için 2 gün (48 saat) iyi bir başlangıç.
        </T>
      </Card>

      <SectionHeader title="Ağırlık önerisi" />
      <Card style={{ gap: Spacing.md }}>
        <T variant="caption" muted>
          Öneriler bu adımlara yuvarlanır. Salonundaki en küçük plaka/dambıl farkına göre seç.
        </T>
        <T variant="label">Set düzeni</T>
        <View style={styles.wrap}>
          {(
            [
              ['auto', 'Otomatik'],
              ['ramp', 'Piramit (artan)'],
              ['straight', 'Sabit'],
            ] as const
          ).map(([k, label]) => (
            <Chip key={k} label={label} active={profile.setStyle === k} onPress={() => update({ setStyle: k })} />
          ))}
        </View>
        <T variant="caption" muted>
          {profile.setStyle === 'auto'
            ? 'Geçmişinden öğrenir: setlerde ağırlığı artırıyorsan piramit, sabit tutuyorsan sabit planlar. Veri yoksa piramit.'
            : profile.setStyle === 'ramp'
              ? 'İlk set hafif (4 tekrar yedekte), orta set orta, son set en ağır ve en zor (1 tekrar yedekte).'
              : 'Tüm çalışma setleri aynı ağırlıkta, 2 tekrar yedekte.'}
        </T>
        <IncRow label="Halter" value={profile.incBarbell} options={[1.25, 2.5, 5]} onPick={(v) => update({ incBarbell: v })} />
        <IncRow label="Dambıl / Kettlebell" value={profile.incDumbbell} options={[1, 2, 2.5]} onPick={(v) => update({ incDumbbell: v })} />
        <IncRow label="Makine / Kablo" value={profile.incMachine} options={[2.5, 5, 7]} onPick={(v) => update({ incMachine: v })} />
      </Card>

      <SectionHeader title="Haftalık plan" />
      <Button title="Haftalık planı düzenle" icon="history" kind="secondary" onPress={() => router.push('/week-plan')} />

      <SectionHeader title="Plaka hesaplayıcı" />
      <Card style={{ gap: Spacing.md }}>
        <T variant="caption" muted>
          Halter egzersizlerinde ağırlık sütunu başlığındaki halter simgesine dokununca her tarafa takılacak plakalar hesaplanır.
        </T>
        <T variant="label">Bar ağırlığı</T>
        <View style={styles.wrap}>
          {BAR_OPTIONS.map((b) => (
            <Chip key={b} label={`${b} kg`} active={profile.barWeight === b} onPress={() => update({ barWeight: b })} />
          ))}
        </View>
        <T variant="label">Salondaki plakalar (her biri çift)</T>
        <View style={styles.wrap}>
          {ALL_PLATES.map((p) => {
            const on = profile.plates.includes(p);
            return (
              <Chip
                key={p}
                label={`${String(p).replace('.', ',')} kg`}
                active={on}
                onPress={() => {
                  // en az bir plaka kalsın
                  const next = on ? profile.plates.filter((x) => x !== p) : [...profile.plates, p].sort((a, b) => b - a);
                  if (next.length > 0) update({ plates: next });
                }}
              />
            );
          })}
        </View>
      </Card>

      <ReminderSettingsSection />

      <AiSettings />

      <DataSettings />

      <Button title="Tüm verileri sil" kind="danger" icon="trash" onPress={reset} style={{ marginTop: Spacing.xxl }} />
      <T variant="caption" muted style={{ textAlign: 'center', marginTop: Spacing.md }}>
        gymcime · verilerin yalnızca bu cihazda saklanır
      </T>
    </ScrollView>
  );
}

function DataSettings() {
  const db = useSQLiteContext();
  const sheet = useSheet();
  const t = useTheme();
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fail = (e: unknown) => {
    haptic.warning();
    setMsg({ ok: false, text: e instanceof BackupError ? e.userMessage : `İşlem başarısız: ${e instanceof Error ? e.message : 'bilinmeyen hata'}` });
  };

  const doExport = async () => {
    if (busy) return;
    setBusy('export');
    setMsg(null);
    try {
      await shareBackup(db);
      setMsg({ ok: true, text: 'Yedek hazırlandı. Paylaşım sayfasından Dosyalar\'a kaydedebilirsin.' });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const doImport = async () => {
    if (busy) return;
    setBusy('import');
    setMsg(null);
    try {
      const backup = await pickBackup();
      if (!backup) return;
      const c = backupCounts(backup);
      const when = backup.exportedAt ? new Date(backup.exportedAt).toLocaleDateString('tr-TR', { dateStyle: 'long' }) : 'bilinmeyen tarih';
      sheet.actions({
        title: 'Yedek geri yüklensin mi?',
        message: `${when} tarihli yedek: ${c.workouts} antrenman, ${c.sets} set, ${c.routines} rutin, ${c.foodLogs} öğün kaydı, ${c.bodyWeights} kilo ölçümü. Şu anki TÜM verilerin silinip yerine bunlar yazılır; geri alınamaz.`,
        actions: [
          {
            label: 'Mevcut verinin yerine yükle',
            icon: 'restart',
            style: 'destructive',
            onPress: async () => {
              try {
                await importBackup(db, backup);
                await syncReminders(db); // içe aktarılan ayar + plana göre bildirimleri yeniden kur
                haptic.success();
                goHome();
              } catch (e) {
                fail(e);
              }
            },
          },
        ],
      });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <SectionHeader title="Veri" />
      <Card style={{ gap: Spacing.md }}>
        <T variant="caption" muted>
          Tüm antrenman, rutin, beslenme ve kilo verini tek bir JSON dosyasına yedekle; telefon değiştirirsen ya da silersen geri yükle. API anahtarı yedeğe dahil edilmez.
        </T>
        <Button title="Yedeği dışa aktar" icon="arrowUp" kind="secondary" onPress={doExport} loading={busy === 'export'} disabled={busy != null} />
        <Button title="Yedekten geri yükle" icon="restart" kind="ghost" onPress={doImport} loading={busy === 'import'} disabled={busy != null} />
        {msg && (
          <T variant="label" color={msg.ok ? t.success : t.danger}>
            {msg.text}
          </T>
        )}
      </Card>
    </>
  );
}

function AiSettings() {
  const t = useTheme();
  const db = useSQLiteContext();
  const sheet = useSheet();
  const [saved, setSaved] = useState<boolean | null>(null);
  const [draft, setDraft] = useState('');
  const [show, setShow] = useState(false);
  const [pref, setPref] = useState<ModelPref>('balanced');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    hasApiKey().then(setSaved);
    getModelPref(db).then(setPref);
  }, [db]);

  const save = async () => {
    if (draft.trim().length < 10) return;
    await setApiKey(draft);
    setDraft('');
    setShow(false);
    setSaved(true);
    setResult(null);
    haptic.success();
  };

  const remove = () =>
    sheet.actions({
      title: 'API anahtarı silinsin mi?',
      message: 'Anahtar bu telefondan silinir. Kaydedilmiş rehberler kalır.',
      actions: [
        {
          label: 'Anahtarı sil',
          icon: 'trash',
          style: 'destructive',
          onPress: async () => {
            await clearApiKey();
            setSaved(false);
            setResult(null);
          },
        },
      ],
    });

  const runTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      await testConnection();
      setResult({ ok: true, text: 'Bağlantı başarılı.' });
      haptic.success();
    } catch (e) {
      setResult({ ok: false, text: e instanceof AiError ? e.userMessage : 'Bağlantı testi başarısız.' });
    } finally {
      setTesting(false);
    }
  };

  const test = () =>
    sheet.actions({
      title: 'Bağlantı test edilsin mi?',
      message: 'Çok küçük bir istek gönderilir. Hesabından çok az (bir kuruştan az) ücret düşer.',
      actions: [{ label: 'Testi başlat', icon: 'bolt', style: 'primary', onPress: runTest }],
    });

  const pickPref = async (p: ModelPref) => {
    setPref(p);
    await saveModelPref(db, p);
  };

  if (saved === null) return null;

  return (
    <>
      <SectionHeader title="Yapay zeka" />
      <Card style={{ gap: Spacing.md }}>
        <View style={styles.toggleRow}>
          <View style={[styles.aiDot, { backgroundColor: saved ? t.success : t.textMuted }]} />
          <T variant="label" style={{ flex: 1 }}>
            {saved ? 'API anahtarı kayıtlı' : 'API anahtarı yok'}
          </T>
          {saved && <Button title="Sil" kind="danger" small onPress={remove} />}
        </View>
        <T variant="caption" muted>
          Anahtar yalnızca bu telefonun güvenli deposunda saklanır (Anthropic hesabına ait, uygulamanın koduna yazılmaz). Yapay zeka özellikleri anahtar olmadan çalışmaz; diğer her şey çalışır.
        </T>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={saved ? 'Yeni anahtar ile değiştir' : 'sk-ant-...'}
            placeholderTextColor={t.textMuted}
            secureTextEntry={!show}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            textContentType="none"
            style={[styles.input, { flex: 1, backgroundColor: t.surfaceRaised, color: t.text, fontFamily: undefined }]}
          />
          <PressableScale onPress={() => setShow((v) => !v)} style={[styles.eye, { backgroundColor: t.surfaceRaised }]}>
            <Icon name={show ? 'close' : 'search'} size={16} color={t.textSecondary} />
          </PressableScale>
        </View>
        <Button title="Anahtarı kaydet" icon="check" kind="secondary" onPress={save} disabled={draft.trim().length < 10} />
        {saved && <Button title="Bağlantıyı test et" icon="bolt" kind="ghost" onPress={test} loading={testing} />}
        {result && (
          <T variant="label" color={result.ok ? t.success : t.danger}>
            {result.text}
          </T>
        )}
        <T variant="label" secondary>
          Model
        </T>
        <View style={styles.wrap}>
          <Chip label="Dengeli (Sonnet)" active={pref === 'balanced'} onPress={() => pickPref('balanced')} />
          <Chip label="Hızlı / ucuz (Haiku)" active={pref === 'fast'} onPress={() => pickPref('fast')} />
        </View>
        <T variant="caption" muted>
          {pref === 'balanced'
            ? 'Rehber, fotoğraf ve koç gibi kalite isteyen işlerde Sonnet; kısa metin ayrıştırmada Haiku kullanılır.'
            : 'Her iş en ucuz model olan Haiku ile yapılır. Daha ucuz ve hızlı, ama rehber kalitesi biraz düşebilir.'}
        </T>
      </Card>
    </>
  );
}

function IncRow({ label, value, options, onPick }: { label: string; value: number; options: number[]; onPick: (v: number) => void }) {
  return (
    <View style={{ gap: 8 }}>
      <T variant="label">{label}</T>
      <View style={styles.wrap}>
        {options.map((o) => (
          <Chip key={o} label={`${String(o).replace('.', ',')} kg`} active={value === o} onPress={() => onPick(o)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  themeBtn: { flex: 1, height: 76, borderRadius: Radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  input: { height: 48, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, fontSize: 16, fontFamily: Font.bold },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  aiDot: { width: 10, height: 10, borderRadius: 5 },
  eye: { width: 48, height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
});
