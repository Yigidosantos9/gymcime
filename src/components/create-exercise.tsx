import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button, Chip, T } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { createExercise } from '@/db/queries';
import { EQUIPMENT, MUSCLES } from '@/db/seed';
import { useTheme } from '@/hooks/use-theme';
import { EXERCISE_KINDS, type ExerciseKind } from '@/lib/cardio';
import { useSQLiteContext } from 'expo-sqlite';
import { useT } from '@/components/language-provider';
import { equipmentLabel, muscleLabel } from '@/i18n/labels';

/** Özel egzersiz oluşturma formu (egzersiz seçici ve kütüphane ortak kullanır). */
export function CreateExerciseForm({ name, submitLabel, onCreated }: { name: string; submitLabel: string; onCreated: (id: number) => void | Promise<void> }) {
  const _ = useT();
  const t = useTheme();
  const db = useSQLiteContext();
  const [muscle, setMuscle] = useState<string>(MUSCLES[0]);
  const [equip, setEquip] = useState<string>(EQUIPMENT[0]);
  const [kind, setKind] = useState<ExerciseKind>('strength');

  const create = async () => {
    if (!name.trim()) return;
    const id = await createExercise(db, name, muscle, equip, kind);
    await onCreated(id);
  };

  return (
    <Animated.View entering={FadeInDown} style={[styles.box, { backgroundColor: t.surfaceRaised, borderColor: t.border }]}>
      <T variant="heading">{_('createExercise.new_exercise', { v: name.trim() })}</T>
      <T variant="overline" secondary>{_('createExercise.type')}</T>
      <View style={styles.wrap}>
        {EXERCISE_KINDS.map((k) => (
          <Chip
            key={k.key}
            label={k.label}
            active={kind === k.key}
            onPress={() => {
              setKind(k.key);
              if (k.key === 'cardio') setMuscle('Kardiyo');
              else if (muscle === 'Kardiyo') setMuscle(k.key === 'timed' ? 'Karın' : MUSCLES[0]);
              if (k.key === 'bodyweight') setEquip('Vücut');
            }}
          />
        ))}
      </View>
      <T variant="caption" muted>
        {EXERCISE_KINDS.find((k) => k.key === kind)?.hint}
      </T>
      <T variant="overline" secondary>{_('createExercise.muscle_group')}</T>
      <View style={styles.wrap}>
        {MUSCLES.map((m) => (
          <Chip key={m} label={muscleLabel(m)} active={muscle === m} onPress={() => setMuscle(m)} />
        ))}
      </View>
      <T variant="overline" secondary>{_('createExercise.equipment')}</T>
      <View style={styles.wrap}>
        {EQUIPMENT.map((m) => (
          <Chip key={m} label={equipmentLabel(m)} active={equip === m} onPress={() => setEquip(m)} />
        ))}
      </View>
      <Button title={submitLabel} icon="check" onPress={create} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, gap: Spacing.md, marginTop: Spacing.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
