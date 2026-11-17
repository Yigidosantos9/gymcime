/**
 * Gösterim etiketleri. DB'de kas grubu / ekipman / hedef / seviye / öğün / rutin adı TÜRKÇE anahtar olarak kalır
 * (yedekler ve eski veriler bozulmasın); yalnızca ekranda geçerli dile çevrilir. Bilinmeyen (özel) değerler olduğu gibi döner.
 */
import { tOr, type Lang } from './index';

export const muscleLabel = (m: string, lang?: Lang) => tOr(`muscle.${m}`, m, lang);
export const equipmentLabel = (e: string, lang?: Lang) => tOr(`equipment.${e}`, e, lang);
export const goalLabel = (g: string) => tOr(`goal.${g}`, g);
export const levelLabel = (l: string) => tOr(`level.${l}`, l);
export const mealLabel = (m: string) => tOr(`meal.${m}`, m);
/** Tohum/şablon rutin adları ve varsayılan "Serbest Antrenman"; kullanıcının kendi adlandırdığı rutinler değişmez. */
export const routineLabel = (n: string, lang?: Lang) => tOr(`routine.${n}`, n, lang);
