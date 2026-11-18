// Görev 2.13 — ölçek fonksiyonları, gün paleti (7 renk × 2 tema + WCAG AA kontrastı), font_scale ayarı, takvim renk indeksi
import { Colors, DAY_COLORS_DARK, DAY_COLORS_LIGHT, DEFAULT_FONT_SCALE, FONT_SCALES, MIN_TOUCH, parseFontScale, scaled, scaledSpace, touchSize } from '@/constants/theme';
import { getSetting, setSetting } from '@/db/queries';
import { calendarColorIndex, routineWeekdays } from '@/lib/week-plan';
import { assert, freshDb } from './helpers';

// ── göreli parlaklık / kontrast (WCAG 2.x)
const rgb = (c: string): [number, number, number] => {
  if (c.startsWith('#')) {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = c.match(/rgba?\(([^)]+)\)/)!;
  const p = m[1].split(',').map((x) => parseFloat(x));
  return [p[0], p[1], p[2]];
};
const alphaOf = (c: string) => (c.startsWith('rgba') ? parseFloat(c.match(/rgba\(([^)]+)\)/)![1].split(',')[3]) : 1);
const over = (fg: string, bg: string): [number, number, number] => {
  const a = alphaOf(fg);
  const f = rgb(fg);
  const b = rgb(bg);
  return [0, 1, 2].map((i) => f[i] * a + b[i] * (1 - a)) as [number, number, number];
};
const lum = ([r, g, b]: [number, number, number]) => {
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
};
const contrast = (a: [number, number, number], b: [number, number, number]) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

(async () => {
  // ── ölçek fonksiyonları
  assert(FONT_SCALES.normal === 1 && FONT_SCALES.large === 1.15 && FONT_SCALES.xlarge === 1.3, 'ölçekler %100/%115/%130');
  assert(DEFAULT_FONT_SCALE === 'large' && parseFontScale(null) === 'large' && parseFontScale('bozuk') === 'large', 'varsayılan Büyük');
  assert(parseFontScale('normal') === 'normal' && parseFontScale('xlarge') === 'xlarge', 'geçerli değerler okunur');
  assert(scaled(17, 1) === 17 && scaled(17, 1.15) === 20 && scaled(17, 1.3) === 22, 'scaled: 17 → 17/20/22');
  assert(scaled(34, 1.15) === 39 && scaled(10, 1.3) === 13, 'scaled yuvarlama');
  assert(scaledSpace(16, 1) === 16 && scaledSpace(16, 1.15) === 17 && scaledSpace(16, 1.3) === 18, 'boşluk yumuşak büyür');
  for (const k of [1, 1.15, 1.3]) {
    assert(touchSize(36, k) >= MIN_TOUCH && touchSize(40, k) >= MIN_TOUCH, `dokunma hedefi ≥ 44 (ölçek ${k})`);
  }
  assert(touchSize(54, 1.3) === 70, 'büyük kontrol ölçeklenir, alt sınıra takılmaz');
  assert(scaled(1, 1.3) === 1 && scaled(0, 1.3) === 0, 'küçük değerler bozulmaz');

  // ── gün paleti
  assert(DAY_COLORS_DARK.length === 7 && DAY_COLORS_LIGHT.length === 7, '7 gün rengi');
  for (const [name, pal] of [['dark', Colors.dark], ['light', Colors.light]] as const) {
    assert(pal.days.length === 7, `${name}: 7 gün`);
    const colors = pal.days.map((d) => d.color.toLowerCase());
    assert(new Set(colors).size === 7, `${name}: renkler birbirinden farklı`);
    // ikili ayırt edilebilirlik: RGB uzaklığı yeterince büyük
    let minDist = Infinity;
    for (let i = 0; i < 7; i++)
      for (let j = i + 1; j < 7; j++) {
        const a = rgb(colors[i]);
        const b = rgb(colors[j]);
        minDist = Math.min(minDist, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
      }
    assert(minDist > 60, `${name}: en yakın iki gün rengi yeterince uzak (${minDist.toFixed(0)})`);
    pal.days.forEach((d, i) => {
      for (const [bgName, bg] of [['zemin', pal.background], ['kart', pal.surface], ['yükseltilmiş', pal.surfaceRaised]] as const) {
        const cr = contrast(rgb(d.color), rgb(bg));
        assert(cr >= 4.5, `${name} gün ${i}: renk/${bgName} kontrast ${cr.toFixed(2)} ≥ 4.5`);
      }
      // soft zemin (kart üstünde) üzerinde metin
      const soft = over(d.soft, pal.surface);
      const crSoft = contrast(rgb(d.color), soft);
      assert(crSoft >= 4.5, `${name} gün ${i}: renk/soft kontrast ${crSoft.toFixed(2)} ≥ 4.5`);
      const crSoftBg = contrast(rgb(d.color), over(d.soft, pal.background));
      assert(crSoftBg >= 4.5, `${name} gün ${i}: renk/soft(zemin üstünde) ${crSoftBg.toFixed(2)} ≥ 4.5`);
      // dolu işaret (tamamlandı ✓): onPrimary simgesi gün renginde
      const crOn = contrast(rgb(pal.onPrimary), rgb(d.color));
      assert(crOn >= 4.5, `${name} gün ${i}: onPrimary/renk kontrast ${crOn.toFixed(2)} ≥ 4.5`);
    });
  }

  // ── font_scale ayarı okunur / yazılır
  const { db } = await freshDb();
  assert(parseFontScale(await getSetting(db, 'font_scale')) === 'large', 'ayar yokken Büyük');
  await setSetting(db, 'font_scale', 'xlarge');
  assert(parseFontScale(await getSetting(db, 'font_scale')) === 'xlarge', 'xlarge yazıldı/okundu');
  await setSetting(db, 'font_scale', 'normal');
  assert(parseFontScale(await getSetting(db, 'font_scale')) === 'normal', 'normal yazıldı/okundu');
  await setSetting(db, 'font_scale', 'saçma');
  assert(parseFontScale(await getSetting(db, 'font_scale')) === 'large', 'bozuk değer → varsayılan');

  // ── takvim renk indeksi: planlı rutinin atandığı gün; plan yoksa haftanın günü
  const plan = [{ routine_id: 7 }, { routine_id: null }, { routine_id: 9 }, { routine_id: null }, { routine_id: 7 }, { routine_id: null }, { routine_id: null }];
  assert(routineWeekdays(plan, 7).join() === '0,4' && routineWeekdays(plan, 9).join() === '2' && routineWeekdays(plan, 1).length === 0 && routineWeekdays(plan, null).length === 0, 'routineWeekdays');
  const sat = new Date(2026, 10, 21).getTime(); // Cumartesi (5)
  const mon = new Date(2026, 10, 16).getTime(); // Pazartesi (0)
  const fri = new Date(2026, 10, 20).getTime(); // Cuma (4)
  assert(calendarColorIndex(plan, 9, sat) === 2, 'Cumartesi yapılan rutin 9 → atandığı Çarşamba rengi');
  assert(calendarColorIndex(plan, 7, sat) === 0, 'iki güne atanmış rutin → ilk atanan gün');
  assert(calendarColorIndex(plan, 7, fri) === 4 && calendarColorIndex(plan, 7, mon) === 0, 'atandığı günde kendi gün rengi');
  assert(calendarColorIndex(plan, null, sat) === 5, 'rutinsiz antrenman → haftanın günü rengi');
  assert(calendarColorIndex(plan, 42, sat) === 5, 'plana atanmamış rutin → haftanın günü rengi');
  assert(calendarColorIndex([], 7, fri) === 4, 'plan yok → haftanın günü rengi');
})();
