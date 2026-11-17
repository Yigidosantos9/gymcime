import type AnthropicType from '@anthropic-ai/sdk';

/**
 * Anthropic SDK'sını TEMBEL yükler: modül uygulama açılışında değil, ilk AI çağrısında çalışır.
 * Böylece SDK'da bir yükleme sorunu olsa bile (ör. Metro önbelleği eski kaldığında görülen
 * "Cannot read property 'BetaToolRunner' of undefined") uygulama açılışta çökmez; hata yalnızca
 * AI özelliği kullanılınca, yakalanabilir bir hata olarak çıkar.
 */
let cached: typeof AnthropicType | null = null;

export function loadAnthropic(): typeof AnthropicType {
  if (cached) return cached;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@anthropic-ai/sdk');
  cached = (mod.default ?? mod.Anthropic ?? mod) as typeof AnthropicType;
  return cached;
}
