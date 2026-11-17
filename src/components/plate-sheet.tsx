import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '@/components/icon';
import { useKeyboardSpace } from '@/components/routine-name-sheet';
import type { useSheet } from '@/components/sheet';
import { Chip, PressableScale, T } from '@/components/ui';
import { Font, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatWeight, parseNumber } from '@/lib/format';
import { BAR_OPTIONS, calcPlates, describePerSide, PLATE_COLORS } from '@/lib/plates';
import { useT } from '@/components/language-provider';
import { t as tt } from '@/i18n';

/** Plakanın çizim yüksekliği (büyük plaka daha uzun). */
const plateHeight = (p: number) => 34 + Math.min(p, 25) * 2.2;
const plateWidth = (p: number) => (p >= 10 ? 14 : p >= 2.5 ? 10 : 7);

function PlateForm({ initial, bar: bar0, plates, step }: { initial: number; bar: number; plates: number[]; step: number }) {
  const _ = useT();
  const t = useTheme();
  const space = useKeyboardSpace();
  const [text, setText] = useState(initial > 0 ? formatWeight(initial) : '');
  const [bar, setBar] = useState(bar0);
  const target = parseNumber(text) ?? 0;
  const res = useMemo(() => calcPlates(target, bar, plates), [target, bar, plates]);
  const bump = (d: number) => setText(formatWeight(Math.max(0, Math.round((target + d) * 100) / 100)));

  return (
    <View style={{ gap: Spacing.md, paddingBottom: space }}>
      <View style={styles.row}>
        <PressableScale onPress={() => bump(-step)} accessibilityRole="button" accessibilityLabel={_('plateSheet.decrease_weight')} style={[styles.step, { backgroundColor: t.surfacePressed }]}>
          <Icon name="minus" size={16} color={t.text} />
        </PressableScale>
        <TextInput
          value={text}
          onChangeText={setText}
          keyboardType="decimal-pad"
          selectTextOnFocus
          accessibilityLabel={_('plateSheet.target_weight_kg')}
          placeholder="0"
          placeholderTextColor={t.textMuted}
          style={[styles.input, { color: t.text, backgroundColor: t.surfacePressed }]}
        />
        <T secondary>{_('common.kg')}</T>
        <PressableScale onPress={() => bump(step)} accessibilityRole="button" accessibilityLabel={_('plateSheet.increase_weight')} style={[styles.step, { backgroundColor: t.surfacePressed }]}>
          <Icon name="add" size={16} color={t.primary} />
        </PressableScale>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <T variant="label" secondary>{_('plateSheet.bar')}</T>
        {BAR_OPTIONS.map((b) => (
          <Chip key={b} label={_('common.kg3', { b: b })} active={bar === b} onPress={() => setBar(b)} />
        ))}
      </View>

      {/* Bar + bir taraftaki plakalar */}
      <View style={[styles.stage, { backgroundColor: t.surfaceRaised }]}>
        <View style={[styles.barShaft, { backgroundColor: t.borderStrong }]} />
        <View style={[styles.collar, { backgroundColor: t.textMuted }]} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 2 }}>
          {res.perSide.map((p, i) => (
            <View
              key={i}
              style={{
                width: plateWidth(p),
                height: plateHeight(p),
                borderRadius: 3,
                backgroundColor: PLATE_COLORS[p] ?? t.primary,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: t.borderStrong,
              }}
            />
          ))}
        </View>
        <View style={[styles.sleeve, { backgroundColor: t.borderStrong }]} />
      </View>

      <View style={{ alignItems: 'center', gap: 2 }}>
        <T variant="caption" secondary>{_('plateSheet.per_side')}</T>
        <T variant="heading" style={{ fontSize: 20 }}>
          {describePerSide(res.perSide)}
        </T>
        <T variant="caption" muted>{_('plateSheet.total_kg_bar_2', { v: formatWeight(res.achieved), v2: formatWeight(bar), v3: formatWeight(Math.round((res.achieved - bar) * 50) / 100) })}</T>
      </View>
      {res.warning && (
        <View style={[styles.warn, { backgroundColor: t.goldSoft }]}>
          <Icon name="warning" size={14} color={t.gold} />
          <T variant="caption" color={t.gold} style={{ flex: 1, fontFamily: Font.bold }}>
            {res.warning}
          </T>
        </View>
      )}
    </View>
  );
}

/** Halter için plaka hesaplayıcı sheet'i. `initial` = açılışta hedef ağırlık, `step` = ± adımı. */
export function openPlateSheet(sheet: ReturnType<typeof useSheet>, opts: { initial: number; bar: number; plates: number[]; step: number }) {
  sheet.custom({
    title: tt('common.plate_calculator'),
    render: () => <PlateForm initial={opts.initial} bar={opts.bar} plates={opts.plates} step={opts.step > 0 ? opts.step : 2.5} />,
  });
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  step: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  input: { minWidth: 110, height: 52, borderRadius: Radius.md, textAlign: 'center', fontSize: 26, fontFamily: Font.heavy },
  stage: { height: 120, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: Spacing.lg, overflow: 'hidden' },
  barShaft: { width: 40, height: 8, borderRadius: 2 },
  collar: { width: 8, height: 46, borderRadius: 2 },
  warn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: Spacing.md, borderRadius: Radius.sm },
  sleeve: { height: 8, flex: 1, borderRadius: 2, marginLeft: 2 },
});
