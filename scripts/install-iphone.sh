#!/bin/sh
# gymcime'yi bağlı iPhone'a Release olarak derleyip kurar (ücretsiz Apple ID / Personal Team).
# Ücretsiz imza 7 günde bir sona erer: telefonu kabloyla bağla, kilidini aç ve bu betiği yeniden çalıştır.
# Veriler silinmez (aynı uygulama kimliği üzerine kurulur).
#
# Kullanım:  sh scripts/install-iphone.sh
set -e
cd "$(dirname "$0")/.."
BUNDLE_ID="com.yigidosantos9.gymcime"

# Bağlı fiziksel iPhone'un UDID'si (simülatörler hariç)
UDID=$(xcrun devicectl list devices 2>/dev/null | grep -i "physical" | grep -Eo '[0-9A-F]{8}-[0-9A-F]{16}' | head -1)
if [ -z "$UDID" ]; then
  echo "Bağlı iPhone bulunamadı. Kabloyla bağla, kilidini aç ve tekrar dene."
  exit 1
fi
echo "iPhone: $UDID"

# ios/ klasörü yoksa (veya app.json değiştiyse) yeniden üret
if [ ! -d ios ]; then
  CI=1 npx expo prebuild --platform ios
fi

echo "Derleniyor (Release)…"
xcodebuild -workspace ios/gymcime.xcworkspace -scheme gymcime -configuration Release \
  -destination "id=$UDID" -allowProvisioningUpdates -derivedDataPath ios/build build -quiet

echo "Kuruluyor…"
xcrun devicectl device install app --device "$UDID" ios/build/Build/Products/Release-iphoneos/gymcime.app
xcrun devicectl device process launch --device "$UDID" "$BUNDLE_ID" || \
  echo "Kuruldu. İlk kurulumda iPhone'da Ayarlar → Genel → VPN ve Cihaz Yönetimi'nden geliştiriciye güven."
echo "Tamam ✓"
