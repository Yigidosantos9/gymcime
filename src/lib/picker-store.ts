/**
 * Egzersiz seçici modalından rutin düzenleyiciye seçimi taşımak için basit kanal.
 * Seçici `deliver()` çağırır, rutin ekranı odaklanınca `consume()` ile alır.
 */
let pending: number[] | null = null;
let existing: number[] = [];

export const pickerStore = {
  /** Seçici açılmadan önce: rutinde zaten olan egzersizler ("Rutinde var" etiketi + tekrar uyarısı için). */
  setExisting(ids: number[]) {
    existing = ids;
  },
  getExisting() {
    return existing;
  },
  deliver(ids: number[]) {
    pending = ids;
  },
  consume() {
    const ids = pending;
    pending = null;
    return ids;
  },
};
