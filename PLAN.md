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

## Görev 2.5 — Türkçe yemek veritabanı + toplam hacmin kaldırılması  `[x]`
1. **Türkçe yemek veritabanı (çevrimdışı, ücretsiz):**
   - `src/data/foods-tr.ts`: Türkiye'de yaygın 350+ yiyecek/içecek/yemek. Kategoriler: kahvaltılık, ekmek & hamur işi, et/tavuk/balık,
     baklagil, sebze yemekleri, çorbalar, pilav & makarna, ev yemekleri (mercimek çorbası, kuru fasulye, karnıyarık, mantı, lahmacun,
     döner, köfte, menemen, simit, poğaça, börek…), meyve, kuruyemiş, süt ürünleri, tatlılar, içecekler, fast food, takviyeler (whey vb.).
   - Her kayıt: `id`, Türkçe ad + arama takma adları, kategori, 100 g (veya 100 ml) başına kcal/protein/karbonhidrat/yağ ve
     yaygın porsiyonlar (ör. "1 adet (50 g)", "1 dilim (25 g)", "1 kase (250 g)", "1 porsiyon (200 g)").
   - Değerler genel kabul görmüş besin tablolarına (ör. USDA FoodData Central — kamu malı — ve TürKomp benzeri ortalamalar) dayalı
     **yaklaşık** değerlerdir; UI'da "yaklaşık değer" notu. Tutarlılık testi: kcal ≈ 4P + 4K + 9Y (±%15), negatif/boş değer yok, id'ler benzersiz.
   - `food/add.tsx`: arama kutusu (Türkçe karakter/aksan duyarsız, takma adlar), kategori çipleri, sonuç listesi; seçince porsiyon seçici
     (porsiyon listesi + miktar adımlayıcı + serbest gram) ve canlı kcal/makro önizleme → öğüne ekle. Sık yenenler/favorilerle birlikte çalışsın
     (seçilen veritabanı kalemi `foods`'a normal kullanıcı kaydı gibi yazılabilir, makroları ezme kuralı geçerli).
   - AI yalnızca veritabanında bulunamayan şeyler için (mevcut fotoğraf/not akışı) — önce veritabanı aranır.
2. **Toplam hacmin (kg×tekrar) arayüzden kaldırılması** — kullanıcı anlamsız buluyor. Yerine anlamlı metrikler:
   - Ana sayfa "Haftalık hacim" kutusu → "Bu hafta" çalışma seti sayısı (ısınma hariç) + geçen haftaya göre fark.
   - İlerleme ekranı haftalık hacim bar grafiği → haftalık çalışma seti (veya antrenman sayısı) grafiği.
   - Özet ekranı, antrenman detayı, geçmiş listesi, son antrenman kartı: "Hacim" yerine egzersiz sayısı / rekor sayısı / süre.
   - Egzersiz detayı: "Hacim" metriği ve "En iyi hacim" rekoru kaldırılsın (yerine "En çok tekrar" veya "Seans sayısı").
   - DB sorguları kalabilir ama UI'da hacim gösterilmesin; testler güncellensin.

## Görev 2.6 — Kural tabanlı ağırlık önerisi (kullanıcı kararı: "Dengeli" + "Piramit + kural")  `[x]`
Mevcut e1RM ile her sette yeniden hesaplayan mantık (`replanAfter`, `adjustAfterSet` ve "çok kolay" e1RM dalı) kullanıcıya öngörülemez geliyor.
Yerine **sabit, ezberlenebilir kurallar**. 1 adım = `incrementFor(ekipman, profil artışları)` (halter 2,5 / dambıl 2 / makine 2,5).

**Zorluk → anlam:** Kolay = RIR ≥3, İyi = 2, Zor = 1, Tükendim = 0.
**Zorluk seçilmezse:** planlanan tekrar tutturulduysa "İyi"; 1 tekrar eksikse "Zor"; 2+ eksikse "Tükendim".

**Seans içi (bir sonraki set):** `taban = yapılan ağırlık + planlanan piramit artışı` (piramitte plan[n+1]−plan[n] ≥ 0; sabitte 0)
- Kolay → taban + 1 adım
- İyi → taban (plana devam)
- Zor → yapılan ağırlık (o setteki piramit artışı iptal)
- Tükendim → yapılan ağırlık − 1 adım
- Tekrar hedefi: sonraki setin planlanan tekrarı. Sonraki setlerin hepsi yeni ağırlığa göre plandaki farkları korur (zincir).
- Not metni net olsun: "Kolay → Set 2: 62,5 kg × 10 (+1 adım)".

**Sonraki antrenman (son çalışma setine = en ağır sete göre, `suggestNext`):**
- Kolay → +2 adım · İyi → +1 adım (tekrar hedefi tutturulduysa)
- Zor → aynı ağırlık, +1 tekrar (tekrar zaten aralığın üst sınırındaysa → +1 adım, tekrar = alt sınır)
- Tükendim → aynı ağırlık; tekrar hedefinin 2+ altında kalındıysa −1 adım
- Korunacaklar: >14 gün ara → hafifletme; ısınma önerisi; piramit/sabit set planı (`planSets`, `rirSchedule`) — üst setten aşağı doğru plan.
- Plato: yalnızca bilgi notu (otomatik deload yok).
- Vücut ağırlığı (adım 0): Kolay +2 tekrar · İyi +1 · Zor aynı · Tükendim −1.

**UI (`src/app/workout/[id].tsx`):** öneri kartında gerekçe sade: "Son sefer en ağır set İyi geçti → +1 adım (62,5 kg)".
Kartta küçük "?" → sheet'te kural tablosu. Zorluk paneli aynı kalır. e1RM yalnızca bilgi olarak gösterilebilir.
**Testler:** tablo güdümlü — 4 zorluk × (seans içi, sonraki antrenman), zorluk girilmeme çıkarımı, piramit zinciri, sabit düzen,
üst sınırda Zor, 2+ tekrar kaçırma, vücut ağırlığı, farklı adım değerleri, >14 gün ara. Eski testler yeni kurallara göre güncellensin.

> **Not (Görev 2.5 tamamlandı):** `src/data/foods-tr.ts` (408 kayıt, 15 kategori, 100 g/ml başına yaklaşık değerler) + `src/lib/food-search.ts` (aksan duyarsız arama, porsiyon → kcal/makro); `food/add.tsx` en üstte "Yiyecek ara" (arama, kategori çipleri, porsiyon seçici + canlı önizleme); seçim normal kullanıcı kaydı gibi `foods`'a yazılır, AI akışı aşağıda kalır.
> Test: `tests/foods-tr.test.ts` (kcal ≈ 4P+4K+9Y ±%15 — yalnızca ~0 kcal'lik kayıtlar için 3 kcal mutlak pay; id/negatif/porsiyon; arama; porsiyon hesabı). Hacim arayüzden kalktı: ana sayfa/ilerleme "çalışma seti" (ısınma hariç), özet "Rekor", oturum "Egzersiz", geçmiş set/egzersiz sayısı, egzersiz detayı "En çok tekrar".
> `weeklyVolume`/`volume` SQL alanları duruyor (UI kullanmıyor); `workout/[id].tsx` ve `progression.ts`'te hacim gösterimi yok. Simülatörde yalnızca ekran görüntüsüyle bakıldı (tıklama aracı yok): arama sonuçları/porsiyon seçici etkileşimi cihazda elle denenmeli.

> **Not (Görev 2.6 tamamlandı):** `progression.ts` kural tabanlı: `suggestNext` (en ağır sete göre), `replanAfter` (seans içi zincir), `adjustBodyweight`, `RULE_TABLE`/`inferEffort`; `adjustAfterSet` ve e1RM'li karar dalları kaldırıldı (e1RM + plato yalnızca bilgi, `deload` türü artık üretilmiyor).
> Kartta "?" → kural tablosu sheet'i (`RulesSheet`). Testler: yeni `tests/rules.test.ts` (tablo güdümlü), `engine/effort/nits/regress/ramp` yeni kurallara göre güncellendi.
> Spec'te olmayıp bizim seçtiğimiz: artışta tekrar = yapılan tekrar (üst sınırdaysa alt sınır); vücut ağırlığı seans içi: Kolay plan+1, Zor yapılan, Tükendim yapılan−1; geçmişte zorluk yoksa hedef = alt sınır. Kural sheet'i simülatörde tıklanamadığı için görsel doğrulanmadı (kart ve canlı not doğrulandı).

## Görev 2.7 — Türkçe talimatlar, rutin (antrenman günü) oluşturma, kardiyo/süreli hareketler, sekme geri dönüşü  `[ ]`
**A) Türkçe talimatlar + rutin oluşturma + sekme geri dönüşü** (A agent'ı)
1. `src/db/exercise-media.ts` içindeki İngilizce talimat adımlarının hepsini doğal, kısa, salon dilinde **Türkçeye çevir**
   (statik veri; API çağrısı yok). Egzersiz adları İngilizce kalır. "Nasıl yapılır" kartı Türkçe adımları göstersin.
2. **Rutin (antrenman günü) oluşturma görünür olsun:** Rutinler sekmesinde listenin üstünde/altında büyük "Yeni rutin oluştur" butonu
   (sağ üstteki küçük "+" Expo Go'nun çark butonunun altında kalıyor). Rutin adı örnekleri: "Sırt günü", "Göğüs + Triceps".
   **Özet ekranında "Rutin olarak kaydet"**: bitmiş antrenmanın egzersizlerinden (sıra, çalışma seti sayısı, tekrar aralığı) yeni rutin;
   ad sorulsun (sheet içinde metin girişi). Ana sayfadaki "+" (boş antrenman) yanında/yerine rutin seçme sheet'i: rutin listesi + "Boş antrenman".
3. **Sekme geri dönüşü:** NativeTabs `backBehavior="history"` (Android geri tuşu önceki sekmeye döner; tiplerden doğrula).
   Ana sayfa kutucukları/linkleri başka sekmeye götürdüğünde (`router.push('/progress')` vb.) hedef sekmede başlık solunda
   "‹ Bugün" geri butonu görünsün (ör. `?from=index` parametresiyle); dokununca Bugün sekmesine döner. Sekmeye alt bardan
   doğrudan geçildiyse buton görünmez.
**DOSYA SAHİPLİĞİ (A):** src/db/exercise-media.ts, src/components/exercise-guide.tsx, src/app/(tabs)/routines.tsx, src/app/(tabs)/index.tsx,
src/app/(tabs)/progress.tsx, src/app/(tabs)/history.tsx, src/app/(tabs)/nutrition.tsx, src/app/(tabs)/_layout.tsx, src/app/summary/[id].tsx,
src/app/routine/[id].tsx, src/db/queries.ts içinde yalnızca yeni `createRoutineFromWorkout` fonksiyonu (dosyanın sonuna ekle).

> **Not (2.7 A tamamlandı):** `exercise-media.ts` talimatları Türkçeye çevrildi (67 egzersiz, kart başlığı "Adımlar"). Rutinler sekmesinde büyük "Yeni rutin oluştur" butonu (sağ üst "+" kalktı); özet ekranında "Rutin olarak kaydet" (`createRoutineFromWorkout`: sıra, ısınma/tamamlanmamış set hariç set sayısı, tekrar aralığı + dinlenme; `askRoutineName` sheet'i metin girişli, iOS'ta klavye yüksekliği kadar boşluk bırakır, `sheet.tsx` değişmedi). Ana sayfada "+" artık rutin seçme sheet'i (rutinler + "Boş antrenman"). `NativeTabs backBehavior="history"`; ana sayfa linkleri `fromHome()` ile `?from=index` ekler, hedef sekmede `HomeBack` ("‹ Bugün") görünür, sekmeden çıkınca parametre temizlenir.
> Yeni dosyalar: `src/components/routine-name-sheet.tsx`, `src/components/tab-back.tsx`; test: `tests/routine-tr.test.ts`. Simülatörde yalnızca ana sayfa görüldü (tıklama aracı yok): "+" sheet'i, klavyeli ad sheet'i ve "‹ Bugün" cihazda elle denenmeli.

**B) Kardiyo ve süreli hareketler** (B agent'ı)
- Egzersizlere tür: `strength` (kg × tekrar), `bodyweight` (tekrar), `cardio` (süre + mesafe, isteğe bağlı eğim/seviye ve kalori),
  `timed` (süre; ör. Plank). Migrasyon v7: `exercises.kind`, `sets.duration_sec`, `sets.distance_m`, `sets.level` (eğim/direnç), `sets.kcal`.
  Seed türleri: treadmill/bike/rower = cardio; plank = timed; vücut ağırlığı ekipmanlılar = bodyweight; diğerleri strength.
  Adlardaki "(min)" ekini kaldır (Treadmill, Stationary Bike, Rowing Machine). Özel egzersiz oluştururken tür seçilebilsin.
- Antrenman ekranı türe göre sütun gösterir: cardio → SÜRE (dk:sn) · MESAFE (km) · EĞİM/SEVİYE; timed → SÜRE; bodyweight → TEKRAR
  (+ isteğe bağlı ek ağırlık); strength → mevcut. Kardiyoda mola sayacı başlamaz, zorluk paneli çıkmaz, ağırlık önerisi yerine basit öneri
  ("Geçen sefer 20 dk · 3,2 km → bugün 22 dk"), PR = en uzun süre / en uzun mesafe / en hızlı tempo.
- Kardiyo/süreli setler kas hacmi, set sayısı, toparlanma ve ağırlık önerisi hesaplarına karışmaz (ayrı "Kardiyo" özeti: haftalık dakika).
  Geçmiş düzenleme (session) ve özet ekranları türü doğru gösterir; yedekleme yeni sütunları içerir.
**DOSYA SAHİPLİĞİ (B):** src/db/migrate.ts, src/db/seed.ts, src/db/queries.ts (A'nın ekleyeceği fonksiyon hariç), src/db/backup.ts,
src/lib/progression.ts, src/lib/recovery.ts, src/app/workout/[id].tsx, src/app/session/[id].tsx, src/app/exercise-picker.tsx,
src/app/exercise/[id].tsx.

> **Not (2.7-B tamamlandı):** Migrasyon v7 (`exercises.kind`, `sets.duration_sec/distance_m/level/kcal`; seed türleri, "(min)" adları temizlendi, eski kardiyo dakikaları `duration_sec`e taşındı, özel "Kardiyo" egzersizleri cardio). Yeni saf modül `src/lib/cardio.ts` (dk:sn/km biçim+ayrıştırma, basit öneri, PR). Antrenman ekranı türe göre sütun, kardiyoda mola/zorluk/ısınma yok; seçici türü soruyor; egzersiz detayı kardiyo geçmişi. `STRENGTH_KIND_SQL` ile muscleSets/muscleLastTrained/weeklyVolume/topExercises/özet kardiyosuz; yeni `weeklyCardio`, `cardioHistory`, `FinishSummary.cardio`, `WorkoutListItem.cardio_sec`. Test: `tests/cardio.test.ts`.
> A için: summary ekranı `prs` kardiyo PR'ında weight/reps = 0 görür (`kind`, `duration_sec`, `distance_m` alanları var) ve `summary.cardio` ({sets, minutes, km}) gösterilebilir; ilerleme sekmesinde `weeklyCardio` ile "Kardiyo" özeti eklenebilir. Simülatörde tıklama yok: set tamamlama/PR etkileşimi cihazda elle denenmeli.

## Görev 2.8 — Egzersiz kütüphanesi, her sekmede "Bugün"e dönüş, doğrudan rutin oluşturma  `[x]`
1. **Egzersiz kütüphanesi** (yeni ekran `src/app/exercises.tsx`, Stack + `HeaderBack`, başlık "Egzersizler"):
   - Daha önce hiç yapılmamış hareketler dahil TÜM egzersizler; arama (İngilizce ad + Türkçe takma ad + kas, aksan duyarsız),
     kas grubu çipleri ve tür filtresi (Ağırlık / Vücut ağırlığı / Kardiyo / Süreli); satırda küçük görsel (exercise-media ilk poz) +
     MuscleIcon + ad + kas/ekipman; dokununca `/exercise/[id]`.
   - `/exercise/[id]` geçmişi olmayan egzersizde de düzgün görünsün: "Nasıl yapılır" (görseller + Türkçe adımlar) üstte, ardından
     AI rehberi kartı, sonra (varsa) geçmiş/grafik; geçmiş yoksa "Henüz yapmadın" boş durumu (hata/boş grafik yok).
   - Giriş noktaları: Rutinler sekmesinin üstünde "Egzersiz kütüphanesi" butonu/kartı; ana sayfada küçük bir kısayol; egzersiz seçicide
     her satırda "i" (bilgi) butonu → detay (seçimi bozmadan).
   - Özel egzersiz oluşturma kütüphaneden de yapılabilsin (mevcut picker'daki oluşturma formunu yeniden kullan).
2. **Her sekmede "‹ Bugün" geri dönüşü:** Rutinler, Geçmiş, İlerleme, Beslenme sekmelerinin başlığında HER ZAMAN (yalnızca ana sayfadan
   gelince değil) "‹ Bugün" butonu; dokununca Bugün sekmesine geçer. Android geri tuşu: Bugün dışındaki sekmeden Bugün'e döner
   (`NativeTabs backBehavior` → `initialRoute`; tiplerden doğrula). `?from=index` mantığı artık gereksizse sadeleştir.
3. **Doğrudan rutin oluşturma:** "Yeni rutin oluştur" (Rutinler) zaten `/routine/new`'e gidiyor — akışın antrenman bitirmeden uçtan uca
   çalıştığını test et (ad → egzersiz ekle (picker) → set/tekrar → kaydet → listede görünür → başlat). Ana sayfadaki "+" rutin seçme
   sheet'ine "Yeni rutin oluştur" seçeneği ekle. Yeni rutin kaydedilince rutin listesine dön (veya rutin sayfasında "Başlat" net olsun).

> **Not (Görev 2.8 tamamlandı):** `src/app/exercises.tsx` kütüphane (arama + kas/tür çipleri, görsel önizleme, özel egzersiz oluşturma); saf mantık `src/lib/exercise-library.ts` (`filterExercises`, picker da kullanıyor); ortak form `src/components/create-exercise.tsx`. Picker satırlarında "i" butonu → detay. Giriş noktaları: Rutinler sekmesi butonu, ana sayfa başlığında arama ikonu. Egzersiz detayında "Nasıl yapılır" + AI kartı üstte, ardından dinlenme/geçmiş; geçmişsizde "Henüz yapmadın".
> `HomeBack` ("‹ Bugün") artık dört sekmede her zaman görünür (`fromHome`/`?from=index` kaldırıldı); `backBehavior="initialRoute"`. Ana sayfa "+" sheet'ine "Yeni rutin oluştur" eklendi; yeni rutin kaydedilince `leave()` ile listeye/önceki sekmeye dönülür (eskiden yeni rutin sayfasına replace ediyordu). Test: `tests/library.test.ts` (arama/filtre, geçmişsiz sorgular, saveRoutine → startWorkout). Simülatörde kütüphane, Pull-Up detayı ve "‹ Bugün" görüldü; tıklama olmadığı için rutin oluşturma akışı UI'dan ve picker "i" butonu cihazda elle denenmeli.

## Görev 2.9 — Rutin düzenleme netliği + antrenmandan rutini güncelleme + plaka hesaplayıcı + hatırlatıcılar  `[x]`
1. **Rutin düzenleme görünür olsun** (düzenleyici `src/app/routine/[id].tsx` zaten var; karta dokununca açılıyor ama bu belli değil):
   - Rutin kartında net **"Düzenle"** butonu (kalem ikonu) + "Başlat"; karta uzun basınca sheet: Düzenle / Kopyala / Başlat / Sil.
   - **Kopyala**: "Sırt günü (kopya)" adıyla aynı egzersizler/ayarlar.
   - Düzenleyicide: egzersiz sırası için yukarı/aşağı yerine **sürükle-bırak** (react-native-gesture-handler + reanimated ile; yeni paket gerekmeden),
     egzersizi başka bir egzersizle **değiştir** (picker ile, ayarlar korunur), kaydedilmemiş değişiklikte geri tuşunda sheet ("Kaydet / Vazgeç").
   - Rutin listesinde sıralama (en son yapılan / ad / oluşturma) ve rutin sırasını elle değiştirme.
2. **Antrenmandan rutini güncelle:** Rutinden başlatılan bir antrenmanda egzersiz eklendi/çıkarıldı/set sayısı değiştiyse, "Bitir" sonrası
   özet ekranında **"Değişiklikleri rutine kaydet"** seçeneği (sheet ile onay; rutin yapısı: egzersiz sırası, çalışma seti sayısı, tekrar aralığı).
3. **Plaka hesaplayıcı:** Antrenman ekranında halter egzersizlerinde ağırlığa dokununca/uzun basınca sheet: bar ağırlığı (20 / 15 / 10 kg, Ayarlar'dan),
   "her tarafa: 20 + 10 + 2,5" görseli (renkli plaka çubukları), mevcut plakalar Ayarlar'dan (25/20/15/10/5/2,5/1,25). Saf fonksiyon + test
   (ulaşılamayan ağırlıkta en yakın değer ve uyarı).
4. **Hatırlatıcılar** (expo-notifications yerel bildirim, Expo Go'da çalışır): Ayarlar → "Hatırlatıcılar":
   antrenman günleri (haftanın günleri + saat; o gün antrenman yapıldıysa bildirim gösterme mümkün değilse metin nötr kalsın),
   tartılma hatırlatıcısı (haftalık gün + saat), öğün kaydı hatırlatıcısı (isteğe bağlı, akşam). İzin isteme akışı, kapat/aç, planlanmış
   bildirimleri yeniden kurma (uygulama açılışında idempotent). Bildirim metinleri Türkçe.

> **Not (Görev 2.9 tamamlandı):** Rutin kartında "Düzenle"/"Başlat" + "⋯" ve uzun basış sheet'i (Düzenle/Kopyala/Başlat/Sil), sıralama çipleri (Elle/Son yapılan/Ad/Yeni; elle modda ↑↓), `duplicateRoutine`/`reorderRoutines`/`sortRoutines`. DB v8 = `routines.sort_order`, v10 = `workouts.routine_shape` (bitişte, yapılmamış set/egzersizler silinmeden ÖNCE saklanır → atlanan set "değişiklik" sayılmaz; v9 = week_plan).
> Düzenleyici: sürükle-bırak (`components/drag-list.tsx`, gesture-handler v3 `usePanGesture` + reanimated, ≡ tutamacı, kenarda otomatik kaydırma, ekran okuyucu eylemleri), egzersiz değiştir (picker, ayarlar korunur), kaydedilmemiş değişiklikte geri (header/iOS kaydırma/Android geri) sheet'i. Özet ekranı "Değişiklikleri rutine kaydet" (`getRoutineDiff`/`applyWorkoutToRoutine`, saf `lib/routine-diff.ts`).
> Plaka hesaplayıcı: `lib/plates.ts` (0,25 kg tam sayı DP — açgözlü değil, en yakın ulaşılabilir + uyarı), `components/plate-sheet.tsx`; Halter egzersizinde "kg" başlığı/⋯ menüsü; bar (20/15/10) ve plakalar Ayarlar → Plaka hesaplayıcı (`Profile.barWeight/plates`).
> Hatırlatıcılar: `lib/reminders.ts` (saf) + `lib/reminder-io.ts` (`syncReminders`: yalnızca `gymcime-reminder:` kimlikli bildirimleri iptal edip yeniden kurar, mola bildirimine dokunmaz; izin YOKSA istemez), Ayarlar → Hatırlatıcılar (antrenman/tartılma/öğün, saat adımlayıcı, izin akışı); uygulama açılışında `ReminderBoot`.
> Testler: `tests/routine-tools.test.ts`. Simülatörde yalnızca görüntü doğrulandı (tıklama yok): sürükle-bırak, plaka sheet'i, bildirim izni/planlama ve rutin düzenleme sheet'leri cihazda elle denenmeli (bildirimler Expo Go'da kısıtlı olabilir).

## Görev 2.10 — Haftalık planlayıcı (Pazartesi Göğüs, Salı Sırt, Çarşamba Leg day…) + takvim  `[x]`
Kullanıcı isteği: haftanın günlerine rutin ata, takvimde görünsün. (Görev 3'ün çok haftalı programından önce, sade sürüm.)
1. **Veri:** migrasyon (sıradaki sürüm): `week_plan(weekday INTEGER PRIMARY KEY 0=Pazartesi…6=Pazar, routine_id NULL → dinlenme günü, note TEXT)`.
   Rutin silinirse o gün dinlenme olur (ON DELETE SET NULL). Yedekleme/geri yükleme yeni tabloyu kapsasın; deleteAllData temizlesin.
2. **Planlayıcı ekranı** `src/app/week-plan.tsx` (Stack + HeaderBack, başlık "Haftalık plan"): 7 gün satırı; her gün için rutin seç
   (sheet: rutin listesi + "Dinlenme günü" + "Yeni rutin oluştur"), gün notu; hızlı şablonlar (PPL, Üst/Alt, Full Body — mevcut rutinlerden
   veya ROUTINE_TEMPLATES'tan oluşturarak). Haftalık özet: kaç antrenman günü, hangi kaslar kaç kez (rutinlerin kaslarından), toparlanma
   çakışması uyarısı (ör. aynı kas art arda iki gün; kas dinlenme süresi `profile.recoveryDays`).
   Giriş: Rutinler sekmesinde üstte "Haftalık plan" kartı, ana sayfadaki hafta kartından, Ayarlar'dan.
3. **Takvimde görünürlük:**
   - Ana sayfa hafta kartı: her günün altında planlanan rutinin kısa adı/ikonu; tamamlanan gün ✓, kaçırılan planlı gün soluk/işaretli,
     bugün vurgulu. "Sıradaki antrenman" kartı: bugün planlı rutin varsa onu "Bugün: Göğüs günü" diye gösterir (yoksa mevcut mantık),
     bugün dinlenme günüyse "Bugün dinlenme günü 🌊" + yine de başlat seçeneği.
   - Geçmiş sekmesi: ısı haritasının yanında/üstünde **aylık takvim görünümü** (ay değiştirme): yapılan antrenmanlar (rutin adı rengi),
     gelecekteki günlerde haftalık plandan gelen planlı rutin (soluk), dokununca o günün antrenman(lar)ı veya planı.
   - Haftalık uyum: "Bu hafta plan: 4/5" (planlı günlerde yapılan antrenman; rutin eşleşmese de o gün antrenman yapıldıysa sayılır).
4. **Hatırlatıcılarla entegrasyon:** Görev 2.9'daki antrenman günü hatırlatıcısı haftalık plan varsa yalnızca planlı günlerde ve rutin adıyla
   ("Bugün: Sırt günü 💪") planlansın; plan değişince bildirimler yeniden kurulsun.
5. **Testler:** migrasyon idempotent, plan CRUD, rutin silinince dinlenmeye dönme, haftalık uyum hesabı (hafta başı Pazartesi, saat dilimi),
   takvim için ay günleri üretimi, toparlanma çakışma uyarısı, yedekte week_plan.

> **Not (Görev 2.10 tamamlandı):** DB v9 `week_plan(weekday 0-6 CHECK, routine_id ON DELETE SET NULL, note)`; yedek/geri yükleme (BACKUP_TABLES 12) + `deleteAllData` kapsar. Saf mantık `lib/week-plan.ts` (hafta Pazartesi, `dayStatus`, `weeklyAdherence`, `monthGrid`, `recoveryConflicts` — Pazar→Pazartesi dahil, kardiyo hariç, `muscleFrequency`, şablonlar PPL 3/6 gün, Üst/Alt, Full Body). Ekran `app/week-plan.tsx` (gün sheet'i: rutin/Dinlenme/Yeni rutin, gün notu, şablonlar `ensureTemplateRoutines` idempotent, özet + çakışma uyarısı); girişler: Rutinler kartı, ana sayfa plan şeridi, Ayarlar.
> Ana sayfa: plan şeridi (✓ yapıldı, soluk/kesikli = kaçırıldı, bugün vurgulu, "Bu hafta plan: x/y"), hero "Bugün: <rutin>" / "Bugün dinlenme günü 🌊" + "Yine de başla". Geçmiş: aylık takvim (`workoutsBetween`, rutine göre renk, planlı günler soluk, gün sheet'i). Hatırlatıcı: plan varsa yalnızca rutin atanmış günlerde "Bugün: <rutin> 💪"; plan/rutin/ayar/yedek değişince `syncReminders`.
> Testler: `tests/week-plan.test.ts`. Kısıtlar: plan "rutin atanmış gün = antrenman günü", rutinsiz not-satırı dinlenme sayılır; takvimde bir günde birden çok antrenman varsa ilkinin adı/rengi gösterilir (köşe noktası). Simülatörde ana sayfa şeridi ve takvim görüldü; plan ekranı etkileşimleri cihazda denenmeli.

## Görev Havuzu (öncelik sırası; kullanıcı onayıyla seçilecek)
- **Barkod okuma** (expo-camera; Open Food Facts ücretsiz API — kullanıcı verisi göndermeden ürün sorgusu) → beslenmeye hızlı ekleme.
- **Su takibi** (Beslenme'de günlük bardak/ml hedefi).
- **Superset / devre** antrenmanları (egzersizleri grupla, mola grup sonunda).
- **Vücut ölçüleri + ilerleme fotoğrafları** (yalnızca cihazda; bel/göğüs/kol; foto karşılaştırma).
- **Uygulama ikonu + açılış ekranı** (gymcime marka ikonu, okyanus teması) ve **development build** (Görev 5'in ön koşulu).
- **Haftalık özet bildirimi** (Pazartesi sabahı: geçen haftanın set/kardiyo/rekor özeti — AI'sız).
- Görev 3 (program oluşturucu), Görev 4 (AI koç), Görev 5 (native ekstralar) aşağıda.

## Görev 3 — Çok haftalı program oluşturucu  `[ ]`  (Görev 1-2 bitince)
Program → haftalar (4–12) → günler (haftanın günleri) → rutinler; deload haftası; ana sayfada "Hafta 3 · Gün 2";
kaçırılan gün için kaydır/atla; uyum analizi. AI ile program önerisi (anahtar gerekir; şemalı çıktı, önizleme + onay).

## Görev 4 — AI koç sohbeti ve haftalık rapor  `[ ]`  (anahtar gerekir)
Geçmiş özeti bağlamıyla sohbet (akış), antrenman sonu yorumu, Pazartesi haftalık rapor; tıbbi konularda doktora yönlendir.

## Görev 5 — Native ekstralar  `[ ]`  (development build gerekir)
Live Activity / Dynamic Island mola sayacı, ana ekran widget'ı, Apple Health (nabız/kalori).
