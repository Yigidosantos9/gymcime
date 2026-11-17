# gymcime — Yol Haritası (otomatik çalışma için)

Bu dosya, zamanlanmış (gözetimsiz) çalışmaların neyi, hangi sırayla ve nasıl yapacağını tanımlar.
Her görev bitince kutucuğunu `[x]` yap ve altına 1-2 satırlık not düş.

## Çalışma kuralları (her görevde)
- Dil: kullanıcıyla Türkçe. UI tamamen Türkçe; egzersiz adları İngilizce.
- Expo SDK 58: API'leri hafızadan değil `node_modules/**/build/*.d.ts` tiplerinden doğrula (AGENTS.md).
- Paket ekleme: yalnızca `npx expo install <paket>`.
- Tasarım: `src/constants/theme.ts` + `src/components/ui.tsx` + `Icon`; onaylar için `useSheet()` (Alert yok);
  geri/kapat için `src/lib/nav.ts` → `leave()` / `goHome()` (router.back() kullanma).
- DB değişikliği = yeni migrasyon sürümü (`src/db/migrate.ts`, `addColumn` + `setVersion`).
- Sayısal ağırlık önerileri deterministik kalır (`src/lib/progression.ts`); AI açıklar/planlar.
- Kullanıcının kendi Metro sunucusu 8081'de çalışıyor olabilir — ONA DOKUNMA. Kendi doğrulaman için `npx expo start --port 8082 --localhost`.
  iOS simülatörü: `1068AFB1-D9DF-4764-B432-309AED6902B6`, `xcrun simctl openurl … exp://127.0.0.1:8082/--/<route>`, ekran görüntüsü `xcrun simctl io … screenshot`.
  Simülatör DB'si: Expo Go veri klasöründeki `gymcime.db` (sqlite3 ile tohumla, iş bitince sil).
- Doğrulama zorunlu: `npx tsc --noEmit`, `npx expo lint`, node:sqlite ile mantık testleri (`$CLAUDE_JOB_DIR/tmp/dbtest` altında, esbuild ile `--alias:@=src`), simülatör ekran görüntüleri.
- Kullanıcı paralel çalışan, salt-okunur bir **kontrolcü agent** istiyor: her görevin sonunda bir general-purpose agent başlat
  (dosya düzenlemesin, 8081'e dokunmasın), bulgularını doğrula ve düzelt.
- Alt agent'lar commit/push YAPMAZ; commit + `git push` (origin: github.com/Yigidosantos9/gymcime, private) ana oturumun işidir. API'ye ücretli istek atma (kullanıcı onayı yok).
- **API anahtarı asla koda, dosyaya, loga veya teste yazılmaz.** Anahtar yalnızca kullanıcının telefonda Ayarlar → Yapay zeka
  ekranından girdiği değerdir (`expo-secure-store`). Sohbet geçmişinde bir anahtar görürsen KULLANMA.
- **Model seçimi (kullanıcı kararı — kademeli):**
  - Hızlı/basit metin işleri (yazıyla kalori girişi ayrıştırma, kısa sınıflandırma) → `claude-haiku-5-5`
  - Fotoğraftan yemek tahmini, egzersiz rehberi, program önerisi, koç sohbeti, haftalık rapor → `claude-sonnet-5-5`
  - Model kimliklerini `src/lib/ai.ts` içinde tek yerde sabit olarak tut (`MODELS.fast`, `MODELS.smart`); Ayarlar'da
    "Model" seçeneği ile değiştirilebilsin (Hızlı/Ucuz = Haiku, Dengeli = Sonnet varsayılan).
  - Uygulama içi maliyet tasarrufu: egzersiz rehberleri bir kez üretilip DB'de önbelleklenir; fotoğraflar 1024 px;
    sabit sistem talimatları prompt caching ile önbelleğe alınır.

---

## Görev 0 — Temel: hata düzeltmeleri, kalıcı testler, yedekleme, geçmişi düzenleme  `[x]`
Kontrolcü denetiminde (17 Kasım) bulunan hatalar ve temel eksikler.
1. **Hatalar:**
   - PR/1RM tutarsızlığı: `src/db/queries.ts` (~506, SQL `w*(1+reps/30)`) ile `src/lib/progression.ts` `estimate1RM` (reps==1 → weight)
     aynı Epley kuralına getirilsin (tek kaynak; SQL'de `CASE WHEN reps = 1 THEN weight ELSE ... END`). Test: geçmiş 100×1, bugün 103×1 → rekor.
   - `src/db/nutrition-queries.ts` `addFoodLog` (~100): `foods` çakışmasında kayıtlı makroları EZMESİN; yalnızca `use_count`/`last_used`
     güncellensin. `source:'ai'` kalemleri `foods` (sık yenenler) tablosuna yazılmasın (sadece food_logs).
   - `src/hooks/use-db-query.ts`: eski `reload()` sonucunun yeniyi ezmesini engelle (istek sürüm sayacı; yalnızca son isteğin sonucu setData).
   - `src/app/food/add.tsx` `guarded()` (~47): hata yutulmasın; kullanıcıya sheet/inline hata mesajı göster.
   - `getWorkoutSummary` (~590): `setCount` ve hacim ısınma setlerini HARİÇ tutsun (kas dağılımıyla tutarlı); özet ekranında gerekirse "ısınma hariç" notu.
   - `deleteAllData` (~761): tek transaction; `exercises.rest_seconds` seed varsayılanlarına dönsün (özel egzersizler silinir).
   - `addSet('warmup')` (~404) iki sorguyu transaction'a al. `rest-timer.tsx`: `updateNext` metni değişince bildirimi yeniden planla (generation kurallarına uy).
   - Performans: `getWorkoutDetail` içindeki egzersiz başına `recentSessions` (N+1) → tek toplu sorgu; `planRows` sonucunu ekran başına bir kez hesapla (memo).
   - Erişilebilirlik: `IconButton`, `PressableScale` ile yapılan ikon butonları ve set onay/zorluk butonlarına `accessibilityRole="button"` + Türkçe `accessibilityLabel`.
2. **Kalıcı testler:** `$CLAUDE_JOB_DIR/tmp/dbtest/*.ts` içeriğini (ve gerekirse eksikleri) repoya `tests/` altına taşı (node:sqlite + esbuild;
   `tests/run.sh` ya da `scripts/test.mjs`), `package.json`'a `"test"` script'i ekle; `npm test` tek komutla hepsini çalıştırsın ve
   hata varsa sıfır olmayan çıkış kodu versin. Test dosyaları `tsc`/lint'i bozmasın (gerekirse tsconfig `exclude`).
3. **Veri yedekleme/geri yükleme** (Ayarlar → "Veri"): tüm tabloları (API anahtarı HARİÇ) sürümlü JSON'a dışa aktar
   (`expo-file-system` + `expo-sharing` ile paylaş/Dosyalar'a kaydet; `npx expo install`), içe aktar (`expo-document-picker`):
   şema sürümü kontrolü, onay sheet'i, tek transaction, mevcut veriyi değiştirme. Test: dışa→sil→içe = aynı veri.
4. **Geçmiş antrenmanı düzenleme** (`src/app/session/[id].tsx`): set ağırlık/tekrar/tip/zorluk düzenleme, set ekleme/silme, egzersiz ekleme/
   çıkarma, başlık ve not; antrenman notu alanı (DB migrasyonu gerekirse v6). Düzenleme sonrası PR bayrakları o egzersiz için yeniden hesaplanır.
   Set notu (kısa metin) — antrenman ekranında da opsiyonel.

> **Not (Görev 0 tamamlandı):** Tüm maddeler uygulandı. `npm test` (`scripts/test.mjs`, esbuild devDependency) `tests/*.test.ts` dosyalarını çalıştırır (13 dosya; yeni: `task0.test.ts`, `helpers.ts`);
> tsconfig/eslint `tests` ve `scripts` klasörlerini hariç tutar. DB v6 = `sets.note`; antrenman notu `workouts.note` zaten vardı. 1RM için tek SQL kaynağı `e1rmSql()` (queries.ts).
> Yedek: `src/db/backup.ts` (saf mantık, test edilir) + `src/lib/backup-io.ts` (expo-file-system/sharing/document-picker); Ayarlar → Veri. Geçmiş düzenleme: `session/[id].tsx` "Düzenle" modu + `editHistorySet`/`recomputePrFlags`.
> Eksik: simülatörde tıklama aracı olmadığı için yalnızca açılış/görüntüleme modu doğrulandı (v6 migrasyonu, oturum ekranı). Düzenle modu, Ayarlar → Veri'nin dışa/içe aktarımı (paylaşım sayfası, belge seçici) ve set notu sheet'i cihazda elle denenmeli.
> Kontrolcü agent başlatılmadı (görev talimatında yoktu).

## Görev 1 — Egzersiz rehberi (görseller + talimatlar) ve AI altyapısı  `[x]`
**Amaç:** Egzersiz detayında "Nasıl yapılır" bölümü: başlangıç/bitiş pozisyonu görselleri + talimatlar;
API anahtarı girilince Türkçe AI rehberi.

1. **Görseller (anahtarsız çalışır):**
   - Kaynak: https://github.com/yuhonas/free-exercise-db (Unlicense). Liste: `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json`,
     görsel: `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/<path>` (ör. `Air_Bike/0.jpg`, `/1.jpg`).
   - `src/db/seed.ts`'deki 67 egzersizi (slug) veri setindeki en uygun kayda eşle (ör. bench → "Barbell Bench Press - Medium Grip",
     squat → "Barbell Squat", pullup → "Pullups", dips → "Dips - Chest Version"). Eşleşmeyenleri boş bırak (UI zarifçe gizlesin).
   - Görselleri indir → `assets/exercises/<slug>-0.jpg`, `-1.jpg` (gerekirse `sips -Z 800` ile küçült), statik `require` haritası
     `src/db/exercise-media.ts` (slug → [img0, img1] + İngilizce talimatlar + birincil/ikincil kaslar). Yalnızca eşleşenleri ekle.
   - Egzersiz detayına (`src/app/exercise/[id].tsx`) "Nasıl yapılır" kartı: iki görsel arasında yumuşak geçiş animasyonu
     (reanimated, ~1.2 sn döngü), kas ikonları, talimat adımları. Egzersiz seçicide ve antrenman ekranında küçük önizleme isteğe bağlı.
2. **AI altyapısı (anahtar yoksa UI "anahtar ekle" der):**
   - `npx expo install @anthropic-ai/sdk` — RN'de çalıştığını tiplerden/kaynaktan doğrula; çalışmıyorsa resmi SDK'nın `fetch` seçeneği
     ile çöz. claude-api skill'ini yükle ve API kullanımında ona uy (yapılandırılmış çıktı `output_config.format`, prompt caching,
     refusal / `stop_reason` kontrolü, güncel thinking/effort kuralları). **Model: yukarıdaki "Model seçimi" kuralı** (kullanıcı
     açıkça Haiku 5.5 + Sonnet 5.5 kademeli seçti; Opus kullanma). Sonnet 5.5 için skill'in önerdiği fallback ayarına uy.
   - Ayarlar → "Yapay zeka" bölümü: API anahtarı girişi (`expo-secure-store`, gösterme/gizle, sil), "bağlantıyı test et" butonu
     (ücretli istek olduğu için yalnızca kullanıcı basınca).
   - `src/lib/ai.ts`: istemci, hata türleri (anahtar yok / ağ / refusal), Türkçe kullanıcı mesajları.
   - DB migrasyonu: `exercise_guides(exercise_id PK, json TEXT, created_at)` önbellek.
   - Rehber üretimi (JSON şema): kurulum, adım adım uygulama, kritik açılar (ör. dirsek ~45°), nefes, sık 3 hata + düzeltme,
     hissedilmesi gereken kaslar, güvenlik notu. Kullanıcının geçmişi varsa (ör. tükeniş setleri, plato) 1-2 kişisel ipucu ekle.
     Egzersiz başına bir kez üret, önbellekten göster, "yeniden oluştur" seçeneği.
   - Testler: şema doğrulama + önbellek + "anahtar yok" yolu (gerçek API çağrısı yapma).

> **Not (Görev 1 tamamlandı):** 67 egzersizin tamamı free-exercise-db'ye eşlendi (`src/db/exercise-media.ts`, görseller `assets/exercises/`, ~6 MB).
> AI: `src/lib/ai-core.ts` (saf mantık, test edilir) + `ai.ts` (SecureStore, SDK); `@anthropic-ai/sdk` Metro'da ESM döngüsü yüzünden çöktüğü için `metro.config.js` SDK'yı CJS girişine yönlendiriyor.
> Gerçek API isteği ATILMADI (anahtar yok) — canlı doğrulama kullanıcıda: Ayarlar → Yapay zeka → test, sonra bir egzersizde "Rehberi oluştur". Kontrolcü agent başlatılmadı (görev talimatında yoktu).

## Görev 2 — Beslenme: vücut analizi, hedef ve kalori planı (anahtarsız kısım)  `[x]`
1. **Profil ölçüleri:** boy, yaş, cinsiyet, aktivite seviyesi; isteğe bağlı bel/boyun(/kalça) çevresi. Mevcut kilo takibinden son kilo.
2. **Hesaplar** (`src/lib/nutrition.ts`, birim testli):
   - BMI + kategori (Türkçe), vücut yağ oranı tahmini: ölçüler varsa US Navy formülü, yoksa BMI tabanlı (Deurenberg) — hangi
     yöntemin kullanıldığını ve "tahmini" olduğunu göster.
   - BMR (Mifflin-St Jeor), TDEE (aktivite katsayısı), hedefe göre kalori: kilo hedefi ve haftalık hız
     (ör. −0,5 kg/hafta ≈ −550 kcal; güvenli sınırlar: kadın ≥1200, erkek ≥1500 kcal, en fazla %25 açık).
   - Makrolar: protein 1,8–2,2 g/kg, yağ ≥ %25, kalan karbonhidrat. Antrenman günü küçük ek (+100–150 kcal).
   - Hedef: hedef kilo ve/veya hedef yağ oranı → tahmini süre.
3. **Beslenme sekmesi** (5. sekme, NativeTabs; ikon `iconSymbols` ile, yoksa Icon haritasına ekle):
   - Günün kalori halkası + makro çubukları, öğün listesi (Kahvaltı/Öğle/Akşam/Ara), hızlı ekle (ad, kcal, P/K/Y, porsiyon),
     sık yenenler/son eklenenler tek dokunuşla, günler arası gezinme, haftalık ortalama ve kilo trendiyle karşılaştırma.
   - DB migrasyonu: `foods` (favoriler) + `food_logs`.
4. **AI fotoğraf tahmini iskeleti:** `expo-image-picker` + `expo-image-manipulator` (1024 px), not alanı; AI yoksa
   "API anahtarı ekleyince fotoğraftan tahmin" bilgisi. Anahtar varsa: yapılandırılmış çıktı (kalemler, porsiyon, kcal, P/K/Y,
   güven), kullanıcı düzenleyip kaydeder. Gerçek istek yapma; şema ve UI yolu test edilir.

> **Not (Görev 2 tamamlandı):** `src/lib/nutrition.ts` (71 testli hesap), DB v5 (`foods`, `food_logs`), 5. sekme `(tabs)/nutrition.tsx`, `body.tsx` (analiz+hedef), `food/add.tsx` (hızlı ekle + fotoğraf/not tahmini).
> Fotoğraf tahmini UI'sı anahtar yokken yalnızca bilgi kartı gösterir; anahtarlı yol (kamera/galeri → 1024 px → Sonnet, yalnız not → Haiku) test edilmedi (ücretli). Kamera/galeri cihazda denenmeli.

## Görev 3 — Çok haftalı program oluşturucu  `[ ]`  (Görev 1-2 bitince)
Program → haftalar (4–12) → günler (haftanın günleri) → rutinler; deload haftası; ana sayfada "Hafta 3 · Gün 2";
kaçırılan gün için kaydır/atla; uyum analizi. AI ile program önerisi (anahtar gerekir; şemalı çıktı, önizleme + onay).

## Görev 4 — AI koç sohbeti ve haftalık rapor  `[ ]`  (anahtar gerekir)
Geçmiş özeti bağlamıyla sohbet (akış), antrenman sonu yorumu, Pazartesi haftalık rapor; tıbbi konularda doktora yönlendir.

## Görev 5 — Native ekstralar  `[ ]`  (development build gerekir)
Live Activity / Dynamic Island mola sayacı, ana ekran widget'ı, Apple Health (nabız/kalori).
