import { useEffect, useState } from 'react';
import { Keyboard, Platform, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { useSheet } from '@/components/sheet';
import { Button, T } from '@/components/ui';
import { Font, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** iOS'ta klavye ayrı pencerede panelin üstünü kapatır; yüksekliği kadar boşluk bırak (Android zaten pencereyi küçültüyor). */
export function useKeyboardSpace() {
  const insets = useSafeAreaInsets();
  const [h, setH] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const a = Keyboard.addListener('keyboardWillShow', (e) => setH(Math.max(0, e.endCoordinates.height - insets.bottom)));
    const b = Keyboard.addListener('keyboardWillHide', () => setH(0));
    return () => {
      a.remove();
      b.remove();
    };
  }, [insets.bottom]);
  return h;
}

function NameForm({ close, initial, confirmLabel, onSubmit, placeholder, hint, allowEmpty }: { close: () => void; initial: string; confirmLabel: string; onSubmit: (name: string) => void; placeholder: string; hint: string; allowEmpty: boolean }) {
  const t = useTheme();
  const space = useKeyboardSpace();
  const [name, setName] = useState(initial);
  const ok = allowEmpty || name.trim().length > 0;
  const submit = () => {
    if (!ok) return;
    Keyboard.dismiss();
    close();
    // sheet kapanırken yeni sheet/gezinme çakışmasın
    setTimeout(() => onSubmit(name.trim()), 260);
  };
  return (
    <View style={{ gap: Spacing.md, paddingBottom: space }}>
      <TextInput
        value={name}
        onChangeText={setName}
        autoFocus
        maxLength={40}
        placeholder={placeholder}
        placeholderTextColor={t.textMuted}
        returnKeyType="done"
        onSubmitEditing={submit}
        style={[styles.input, { color: t.text, backgroundColor: t.surfacePressed, borderColor: t.border }]}
      />
      <T variant="caption" muted>
        {hint}
      </T>
      <Button title={confirmLabel} icon="check" onPress={submit} disabled={!ok} />
    </View>
  );
}

/** Rutin adı soran sheet (metin girişli). Onaylanınca `onSubmit(ad)` sheet kapandıktan sonra çağrılır. */
export function askRoutineName(sheet: ReturnType<typeof useSheet>, opts: { title?: string; initial?: string; confirmLabel?: string; placeholder?: string; hint?: string; /** boş metinle de onaylanabilsin (ör. notu silmek için) */ allowEmpty?: boolean; onSubmit: (name: string) => void }) {
  sheet.custom({
    title: opts.title ?? 'Rutin adı',
    render: (close) => (
      <NameForm
        close={close}
        initial={opts.initial ?? ''}
        confirmLabel={opts.confirmLabel ?? 'Kaydet'}
        onSubmit={opts.onSubmit}
        placeholder={opts.placeholder ?? 'Sırt günü'}
        hint={opts.hint ?? 'Örnekler: Sırt günü, Göğüs + Triceps, Bacak'}
        allowEmpty={opts.allowEmpty ?? false}
      />
    ),
  });
}

const styles = StyleSheet.create({
  input: { height: 52, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.lg, fontSize: 17, fontFamily: Font.bold },
});
