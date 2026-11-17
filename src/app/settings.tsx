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
import { useLanguage, useT } from '@/components/language-provider';
import { currentLocale, decimalSep } from '@/i18n';
import { goalLabel } from '@/i18n/labels';

const REST_OPTIONS = [60, 90, 120, 150, 180];
const GOALS = ['Kas kazanmak', 'Güçlenmek', 'Yağ yakmak', 'Formda kalmak']; // DB anahtarları (gösterimde goalLabel)

export default function Settings() {
  const _ = useT();
  const { preference: langPref, setPreference: setLangPref, reload: reloadLang } = useLanguage();
  const THEMES: { key: ThemePreference; label: string; icon: IconName }[] = [
    { key: 'dark', label: _('settings.dark'), icon: 'moon' },
    { key: 'light', label: _('settings.light'), icon: 'sun' },
    { key: 'system', label: _('settings.system'), icon: 'phone' },
  ];
  const t = useTheme();
  const db = useSQLiteContext();
  const sheet = useSheet();
  const { preference, setPreference, reload: reloadTheme } = useThemeContext();
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
      title: _('settings.delete_all_data'),
      message: _('settings.workouts_routines_and_your_profile'),
      actions: [
        {
          label: _('settings.delete_everything'),
          icon: 'trash',
          style: 'destructive',
          onPress: async () => {
            await deleteAllData(db);
            await Promise.all([reloadLang(), reloadTheme()]);
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
      <SectionHeader title={_('settings.appearance')} />
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

      <SectionHeader title={_('settings.language')} />
      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        {(
          [
            { key: 'tr', label: _('settings.language_tr') },
            { key: 'en', label: _('settings.language_en') },
            { key: 'system', label: _('settings.language_system') },
          ] as const
        ).map((l) => {
          const active = langPref === l.key;
          return (
            <PressableScale
              key={l.key}
              onPress={() => setLangPref(l.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.themeBtn, { backgroundColor: active ? t.primarySoft : t.surface, borderColor: active ? t.primary : t.border }]}>
              <T variant="label" color={active ? t.primary : t.textSecondary}>
                {l.label}
              </T>
            </PressableScale>
          );
        })}
      </View>
      <T variant="caption" muted style={{ marginTop: Spacing.sm }}>
        {_('settings.language_hint')}
      </T>

      <SectionHeader title={_('settings.profile')} />
      <Card style={{ gap: Spacing.md }}>
        <T variant="label" secondary>{_('common.your_name')}</T>
        <TextInput
          value={profile.name}
          onChangeText={(name) => setProfile({ ...profile, name })}
          onEndEditing={() => update({})}
          style={[styles.input, { backgroundColor: t.surfaceRaised, color: t.text }]}
        />
        <T variant="label" secondary>{_('common.target')}</T>
        <View style={styles.wrap}>
          {GOALS.map((g) => (
            <Chip key={g} label={goalLabel(g)} active={profile.goal === g} onPress={() => update({ goal: g })} />
          ))}
        </View>
        <T variant="label" secondary>{_('settings.weekly_goal')}</T>
        <View style={styles.wrap}>
          {WEEK_DAYS.map((d) => (
            <Chip
              key={d}
              label={_('settings.days', { count: d, v: notRecommended(d) ? _('settings.not_recommended') : '' })}
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

      <SectionHeader title={_('settings.rest')} />
      <Card style={{ gap: Spacing.md }}>
        <T variant="label" secondary>{_('settings.general_default_rest')}</T>
        <View style={styles.wrap}>
          {REST_OPTIONS.map((s) => (
            <Chip key={s} label={formatRest(s)} active={profile.restSeconds === s} onPress={() => update({ restSeconds: s })} />
          ))}
        </View>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <T variant="label">{_('settings.sound_when_rest_ends')}</T>
            <T variant="caption" muted>{_('settings.doesn_t_play_when_the')}</T>
          </View>
          <Switch value={profile.soundOn} onValueChange={(v) => update({ soundOn: v })} trackColor={{ true: t.primary, false: t.surfacePressed }} />
        </View>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <T variant="label">{_('settings.vibration')}</T>
            <T variant="caption" muted>{_('settings.during_the_last_3_seconds')}</T>
          </View>
          <Switch value={profile.hapticOn} onValueChange={(v) => update({ hapticOn: v })} trackColor={{ true: t.primary, false: t.surfacePressed }} />
        </View>
        <T variant="caption" muted>{_('settings.if_an_exercise_has_its')}</T>
      </Card>

      <SectionHeader title={_('settings.muscle_recovery')} />
      <Card style={{ gap: Spacing.md }}>
        <T variant="label" secondary>{_('settings.recommended_rest_before_training_a')}</T>
        <View style={styles.wrap}>
          {RECOVERY_OPTIONS.map((d) => (
            <Chip key={d} label={_('settings.days2', { count: d })} active={profile.recoveryDays === d} onPress={() => update({ recoveryDays: d })} />
          ))}
        </View>
        <T variant="caption" muted>{_('settings.the_recovery_card_on_the')}</T>
      </Card>

      <SectionHeader title={_('settings.weight_suggestions')} />
      <Card style={{ gap: Spacing.md }}>
        <T variant="caption" muted>{_('settings.suggestions_are_rounded_to_these')}</T>
        <T variant="label">{_('settings.set_layout')}</T>
        <View style={styles.wrap}>
          {(
            [
              ['auto', _('settings.style_auto')],
              ['ramp', _('settings.style_ramp')],
              ['straight', _('settings.style_straight')],
            ] as const
          ).map(([k, label]) => (
            <Chip key={k} label={label} active={profile.setStyle === k} onPress={() => update({ setStyle: k })} />
          ))}
        </View>
        <T variant="caption" muted>
          {profile.setStyle === 'auto'
            ? _('settings.learns_from_your_history_pyramid')
            : profile.setStyle === 'ramp'
              ? _('settings.first_set_light_4_reps')
              : _('settings.all_working_sets_at_the')}
        </T>
        <IncRow label={_('settings.barbell')} value={profile.incBarbell} options={[1.25, 2.5, 5]} onPick={(v) => update({ incBarbell: v })} />
        <IncRow label={_('settings.dumbbell_kettlebell')} value={profile.incDumbbell} options={[1, 2, 2.5]} onPick={(v) => update({ incDumbbell: v })} />
        <IncRow label={_('settings.machine_cable')} value={profile.incMachine} options={[2.5, 5, 7]} onPick={(v) => update({ incMachine: v })} />
      </Card>

      <SectionHeader title={_('common.weekly_plan')} />
      <Button title={_('settings.edit_weekly_plan')} icon="history" kind="secondary" onPress={() => router.push('/week-plan')} />

      <SectionHeader title={_('common.plate_calculator')} />
      <Card style={{ gap: Spacing.md }}>
        <T variant="caption" muted>{_('settings.tap_the_barbell_icon_in')}</T>
        <T variant="label">{_('settings.bar_weight')}</T>
        <View style={styles.wrap}>
          {BAR_OPTIONS.map((b) => (
            <Chip key={b} label={_('common.kg3', { b: b })} active={profile.barWeight === b} onPress={() => update({ barWeight: b })} />
          ))}
        </View>
        <T variant="label">{_('settings.plates_at_your_gym_each')}</T>
        <View style={styles.wrap}>
          {ALL_PLATES.map((p) => {
            const on = profile.plates.includes(p);
            return (
              <Chip
                key={p}
                label={_('common.kg2', { v: String(p).replace('.', decimalSep()) })}
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

      <Button title={_('settings.delete_all_data2')} kind="danger" icon="trash" onPress={reset} style={{ marginTop: Spacing.xxl }} />
      <T variant="caption" muted style={{ textAlign: 'center', marginTop: Spacing.md }}>{_('settings.gymcime_your_data_is_stored')}</T>
    </ScrollView>
  );
}

function DataSettings() {
  const _ = useT();
  const { reload: reloadLang } = useLanguage();
  const { reload: reloadTheme } = useThemeContext();
  const db = useSQLiteContext();
  const sheet = useSheet();
  const t = useTheme();
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fail = (e: unknown) => {
    haptic.warning();
    setMsg({ ok: false, text: e instanceof BackupError ? e.userMessage : _('settings.operation_failed', { v: e instanceof Error ? e.message : _('common.unknown_error') }) });
  };

  const doExport = async () => {
    if (busy) return;
    setBusy('export');
    setMsg(null);
    try {
      await shareBackup(db);
      setMsg({ ok: true, text: _('settings.backup_ready_you_can_save') });
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
      const when = backup.exportedAt ? new Date(backup.exportedAt).toLocaleDateString(currentLocale(), { dateStyle: 'long' }) : _('common.unknown_date');
      sheet.actions({
        title: _('settings.restore_backup'),
        message: _('settings.backup_from_workouts_sets_routines', { when: when, workouts: c.workouts, sets: c.sets, routines: c.routines, foodLogs: c.foodLogs, bodyWeights: c.bodyWeights }),
        actions: [
          {
            label: _('settings.replace_current_data'),
            icon: 'restart',
            style: 'destructive',
            onPress: async () => {
              try {
                await importBackup(db, backup);
                await Promise.all([reloadLang(), reloadTheme()]);
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
      <SectionHeader title={_('settings.data')} />
      <Card style={{ gap: Spacing.md }}>
        <T variant="caption" muted>{_('settings.back_up_all_your_workout')}</T>
        <Button title={_('settings.export_backup')} icon="arrowUp" kind="secondary" onPress={doExport} loading={busy === 'export'} disabled={busy != null} />
        <Button title={_('settings.restore_from_backup')} icon="restart" kind="ghost" onPress={doImport} loading={busy === 'import'} disabled={busy != null} />
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
  const _ = useT();
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
      title: _('settings.delete_api_key'),
      message: _('settings.the_key_is_removed_from'),
      actions: [
        {
          label: _('settings.delete_key'),
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
      setResult({ ok: true, text: _('settings.connection_successful') });
      haptic.success();
    } catch (e) {
      setResult({ ok: false, text: e instanceof AiError ? e.userMessage : _('settings.connection_test_failed') });
    } finally {
      setTesting(false);
    }
  };

  const test = () =>
    sheet.actions({
      title: _('settings.test_the_connection'),
      message: _('settings.a_tiny_request_is_sent'),
      actions: [{ label: _('settings.run_test'), icon: 'bolt', style: 'primary', onPress: runTest }],
    });

  const pickPref = async (p: ModelPref) => {
    setPref(p);
    await saveModelPref(db, p);
  };

  if (saved === null) return null;

  return (
    <>
      <SectionHeader title={_('settings.artificial_intelligence')} />
      <Card style={{ gap: Spacing.md }}>
        <View style={styles.toggleRow}>
          <View style={[styles.aiDot, { backgroundColor: saved ? t.success : t.textMuted }]} />
          <T variant="label" style={{ flex: 1 }}>
            {saved ? _('settings.api_key_saved') : _('settings.no_api_key')}
          </T>
          {saved && <Button title={_('common.delete')} kind="danger" small onPress={remove} />}
        </View>
        <T variant="caption" muted>{_('settings.the_key_is_stored_only')}</T>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={saved ? _('settings.replace_with_a_new_key') : 'sk-ant-...'}
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
        <Button title={_('settings.save_key')} icon="check" kind="secondary" onPress={save} disabled={draft.trim().length < 10} />
        {saved && <Button title={_('settings.test_connection')} icon="bolt" kind="ghost" onPress={test} loading={testing} />}
        {result && (
          <T variant="label" color={result.ok ? t.success : t.danger}>
            {result.text}
          </T>
        )}
        <T variant="label" secondary>{_('settings.model')}</T>
        <View style={styles.wrap}>
          <Chip label={_('settings.balanced_sonnet')} active={pref === 'balanced'} onPress={() => pickPref('balanced')} />
          <Chip label={_('settings.fast_cheap_haiku')} active={pref === 'fast'} onPress={() => pickPref('fast')} />
        </View>
        <T variant="caption" muted>
          {pref === 'balanced'
            ? _('settings.sonnet_is_used_for_quality')
            : _('settings.everything_runs_on_haiku_the')}
        </T>
      </Card>
    </>
  );
}

function IncRow({ label, value, options, onPick }: { label: string; value: number; options: number[]; onPick: (v: number) => void }) {
  const _ = useT();
  return (
    <View style={{ gap: 8 }}>
      <T variant="label">{label}</T>
      <View style={styles.wrap}>
        {options.map((o) => (
          <Chip key={o} label={_('common.kg2', { v: String(o).replace('.', decimalSep()) })} active={value === o} onPress={() => onPick(o)} />
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
