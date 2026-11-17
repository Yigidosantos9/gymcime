/**
 * Ücretsiz Apple ID (Personal Team) ile cihaza kurulum için: uzak push bildirimi yetkisini kaldırır.
 *
 * expo-notifications config plugin'i `aps-environment` entitlement'ını ekler; ücretsiz geliştirici
 * hesapları Push Notifications yetkisini desteklemediği için imzalama başarısız olur. gymcime yalnızca
 * YEREL bildirimler kullanır (mola sayacı, hatırlatıcılar) — bunlar bu yetkiye ihtiyaç duymaz.
 * Ücretli Apple Developer hesabına geçilip uzak push istenirse bu plugin app.json'dan kaldırılmalı.
 */
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withLocalNotificationsOnly(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });
};
