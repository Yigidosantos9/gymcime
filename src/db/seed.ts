export type Muscle = 'Göğüs' | 'Sırt' | 'Omuz' | 'Biceps' | 'Triceps' | 'Bacak' | 'Kalça' | 'Karın' | 'Kardiyo';
export type Equipment = 'Halter' | 'Dambıl' | 'Makine' | 'Kablo' | 'Vücut' | 'Kettlebell' | 'Diğer';

export const MUSCLES: Muscle[] = ['Göğüs', 'Sırt', 'Omuz', 'Biceps', 'Triceps', 'Bacak', 'Kalça', 'Karın', 'Kardiyo'];
export const EQUIPMENT: Equipment[] = ['Halter', 'Dambıl', 'Makine', 'Kablo', 'Vücut', 'Kettlebell', 'Diğer'];

/**
 * [slug, İngilizce ad, Türkçe takma ad (arama için), kas grubu, ekipman].
 * slug, hazır rutinlerin ve migrasyonların egzersizleri bulması için.
 */
export const SEED_EXERCISES: [string, string, string, Muscle, Equipment][] = [
  // Göğüs
  ['bench', 'Bench Press', 'Bench Press', 'Göğüs', 'Halter'],
  ['incline-bench', 'Incline Bench Press', 'Eğimli Bench Press', 'Göğüs', 'Halter'],
  ['db-bench', 'Dumbbell Bench Press', 'Dambıl Bench Press', 'Göğüs', 'Dambıl'],
  ['incline-db', 'Incline Dumbbell Press', 'Eğimli Dambıl Press', 'Göğüs', 'Dambıl'],
  ['db-fly', 'Dumbbell Fly', 'Dambıl Fly', 'Göğüs', 'Dambıl'],
  ['cable-fly', 'Cable Crossover', 'Kablo Crossover', 'Göğüs', 'Kablo'],
  ['chest-press', 'Machine Chest Press', 'Makinede Göğüs Press', 'Göğüs', 'Makine'],
  ['pec-deck', 'Pec Deck', 'Pec Deck', 'Göğüs', 'Makine'],
  ['pushup', 'Push-Up', 'Şınav', 'Göğüs', 'Vücut'],
  ['dips', 'Dips', 'Dips', 'Göğüs', 'Vücut'],
  // Sırt
  ['deadlift', 'Deadlift', 'Deadlift', 'Sırt', 'Halter'],
  ['bb-row', 'Barbell Row', 'Barbell Row', 'Sırt', 'Halter'],
  ['db-row', 'One-Arm Dumbbell Row', 'Tek Kol Dambıl Row', 'Sırt', 'Dambıl'],
  ['pullup', 'Pull-Up', 'Barfiks', 'Sırt', 'Vücut'],
  ['chinup', 'Chin-Up', 'Chin-up', 'Sırt', 'Vücut'],
  ['lat-pulldown', 'Lat Pulldown', 'Lat Pulldown', 'Sırt', 'Kablo'],
  ['seated-row', 'Seated Cable Row', 'Seated Cable Row', 'Sırt', 'Kablo'],
  ['tbar-row', 'T-Bar Row', 'T-Bar Row', 'Sırt', 'Makine'],
  ['machine-row', 'Machine Row', 'Makinede Row', 'Sırt', 'Makine'],
  ['straight-pulldown', 'Straight-Arm Pulldown', 'Straight Arm Pulldown', 'Sırt', 'Kablo'],
  ['back-ext', 'Back Extension', 'Hiperekstansiyon', 'Sırt', 'Vücut'],
  // Omuz
  ['ohp', 'Overhead Press', 'Overhead Press', 'Omuz', 'Halter'],
  ['db-shoulder', 'Dumbbell Shoulder Press', 'Dambıl Omuz Press', 'Omuz', 'Dambıl'],
  ['lateral', 'Lateral Raise', 'Yana Açış', 'Omuz', 'Dambıl'],
  ['cable-lateral', 'Cable Lateral Raise', 'Kablo Yana Açış', 'Omuz', 'Kablo'],
  ['front-raise', 'Front Raise', 'Öne Kaldırış', 'Omuz', 'Dambıl'],
  ['rear-delt', 'Reverse Dumbbell Fly', 'Reverse Fly', 'Omuz', 'Dambıl'],
  ['face-pull', 'Face Pull', 'Face Pull', 'Omuz', 'Kablo'],
  ['shrug', 'Dumbbell Shrug', 'Shrug', 'Omuz', 'Dambıl'],
  ['shoulder-press-m', 'Machine Shoulder Press', 'Makinede Omuz Press', 'Omuz', 'Makine'],
  // Biceps
  ['bb-curl', 'Barbell Curl', 'Barbell Curl', 'Biceps', 'Halter'],
  ['db-curl', 'Dumbbell Curl', 'Dambıl Curl', 'Biceps', 'Dambıl'],
  ['hammer', 'Hammer Curl', 'Hammer Curl', 'Biceps', 'Dambıl'],
  ['incline-curl', 'Incline Dumbbell Curl', 'Eğimli Dambıl Curl', 'Biceps', 'Dambıl'],
  ['preacher', 'Preacher Curl', 'Preacher Curl', 'Biceps', 'Makine'],
  ['cable-curl', 'Cable Curl', 'Kablo Curl', 'Biceps', 'Kablo'],
  // Triceps
  ['pushdown', 'Triceps Pushdown', 'Triceps Pushdown', 'Triceps', 'Kablo'],
  ['rope-pushdown', 'Rope Pushdown', 'Halatla Pushdown', 'Triceps', 'Kablo'],
  ['skullcrusher', 'Skull Crusher', 'Skull Crusher', 'Triceps', 'Halter'],
  ['oh-ext', 'Overhead Triceps Extension', 'Baş Üstü Triceps Uzatma', 'Triceps', 'Dambıl'],
  ['cgbp', 'Close-Grip Bench Press', 'Dar Tutuş Bench Press', 'Triceps', 'Halter'],
  ['kickback', 'Triceps Kickback', 'Triceps Kickback', 'Triceps', 'Dambıl'],
  // Bacak
  ['squat', 'Squat', 'Squat', 'Bacak', 'Halter'],
  ['front-squat', 'Front Squat', 'Front Squat', 'Bacak', 'Halter'],
  ['leg-press', 'Leg Press', 'Leg Press', 'Bacak', 'Makine'],
  ['hack-squat', 'Hack Squat', 'Hack Squat', 'Bacak', 'Makine'],
  ['leg-ext', 'Leg Extension', 'Leg Extension', 'Bacak', 'Makine'],
  ['leg-curl', 'Leg Curl', 'Leg Curl', 'Bacak', 'Makine'],
  ['rdl', 'Romanian Deadlift', 'Romanian Deadlift', 'Bacak', 'Halter'],
  ['bulgarian', 'Bulgarian Split Squat', 'Bulgarian Split Squat', 'Bacak', 'Dambıl'],
  ['lunge', 'Dumbbell Lunge', 'Lunge', 'Bacak', 'Dambıl'],
  ['goblet', 'Goblet Squat', 'Goblet Squat', 'Bacak', 'Dambıl'],
  ['calf-raise', 'Calf Raise', 'Calf Raise', 'Bacak', 'Makine'],
  // Kalça
  ['hip-thrust', 'Hip Thrust', 'Hip Thrust', 'Kalça', 'Halter'],
  ['glute-bridge', 'Glute Bridge', 'Glute Bridge', 'Kalça', 'Vücut'],
  ['abductor', 'Hip Abduction Machine', 'Abductor Makinesi', 'Kalça', 'Makine'],
  ['cable-kickback', 'Cable Glute Kickback', 'Kablo Kickback', 'Kalça', 'Kablo'],
  ['kb-swing', 'Kettlebell Swing', 'Kettlebell Swing', 'Kalça', 'Kettlebell'],
  // Karın
  ['plank', 'Plank', 'Plank', 'Karın', 'Vücut'],
  ['crunch', 'Crunch', 'Crunch', 'Karın', 'Vücut'],
  ['leg-raise', 'Hanging Leg Raise', 'Asılı Bacak Kaldırma', 'Karın', 'Vücut'],
  ['cable-crunch', 'Cable Crunch', 'Kablo Crunch', 'Karın', 'Kablo'],
  ['ab-wheel', 'Ab Wheel Rollout', 'Ab Wheel', 'Karın', 'Diğer'],
  ['russian-twist', 'Russian Twist', 'Russian Twist', 'Karın', 'Vücut'],
  // Kardiyo
  ['treadmill', 'Treadmill', 'Koşu Bandı', 'Kardiyo', 'Makine'],
  ['bike', 'Stationary Bike', 'Bisiklet', 'Kardiyo', 'Makine'],
  ['rower', 'Rowing Machine', 'Kürek Makinesi', 'Kardiyo', 'Makine'],
];

/** Seed egzersizinin türü: kardiyo makineleri = cardio, plank = timed, "Vücut" ekipmanı = bodyweight, kalanı strength. */
export function seedKind(slug: string, equipment: string): 'strength' | 'bodyweight' | 'cardio' | 'timed' {
  if (['treadmill', 'bike', 'rower'].includes(slug)) return 'cardio';
  if (slug === 'plank') return 'timed';
  return equipment === 'Vücut' ? 'bodyweight' : 'strength';
}

type Template = { name: string; items: [slug: string, sets: number, repMin: number, repMax: number][] };

export const ROUTINE_TEMPLATES: Record<'full' | 'upperlower' | 'ppl', Template[]> = {
  full: [
    {
      name: 'Full Body A',
      items: [['squat', 3, 6, 10], ['bench', 3, 6, 10], ['bb-row', 3, 8, 12], ['lateral', 3, 12, 15], ['plank', 3, 30, 60]],
    },
    {
      name: 'Full Body B',
      items: [['rdl', 3, 8, 10], ['ohp', 3, 6, 10], ['lat-pulldown', 3, 8, 12], ['leg-press', 3, 10, 15], ['db-curl', 2, 10, 15]],
    },
  ],
  upperlower: [
    {
      name: 'Üst Vücut',
      items: [['bench', 4, 6, 10], ['bb-row', 4, 8, 12], ['db-shoulder', 3, 8, 12], ['lat-pulldown', 3, 10, 12], ['db-curl', 2, 10, 15], ['pushdown', 2, 10, 15]],
    },
    {
      name: 'Alt Vücut',
      items: [['squat', 4, 6, 10], ['rdl', 3, 8, 10], ['leg-press', 3, 10, 15], ['leg-curl', 3, 10, 15], ['calf-raise', 3, 12, 20]],
    },
  ],
  ppl: [
    {
      name: 'Push',
      items: [['bench', 4, 6, 10], ['incline-db', 3, 8, 12], ['db-shoulder', 3, 8, 12], ['lateral', 3, 12, 20], ['rope-pushdown', 3, 10, 15]],
    },
    {
      name: 'Pull',
      items: [['deadlift', 3, 5, 8], ['pullup', 3, 6, 12], ['seated-row', 3, 8, 12], ['face-pull', 3, 12, 20], ['hammer', 3, 10, 15]],
    },
    {
      name: 'Legs',
      items: [['squat', 4, 6, 10], ['rdl', 3, 8, 10], ['leg-press', 3, 10, 15], ['leg-curl', 3, 10, 15], ['calf-raise', 4, 12, 20]],
    },
  ],
};
