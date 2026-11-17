/**
 * Egzersiz seçici modalından rutin düzenleyiciye seçimi taşımak için basit kanal.
 * Seçici `deliver()` çağırır, rutin ekranı odaklanınca `consume()` ile alır.
 */
let pending: number[] | null = null;

export const pickerStore = {
  deliver(ids: number[]) {
    pending = ids;
  },
  consume() {
    const ids = pending;
    pending = null;
    return ids;
  },
};
