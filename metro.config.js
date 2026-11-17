const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

/**
 * @anthropic-ai/sdk'nin ESM (.mjs) derlemesi Metro'da döngüsel import yüzünden
 * "Cannot read property 'BetaToolRunner' of undefined" ile çöküyor. CommonJS derlemesi
 * (tembel getter'lar) döngüyü sorunsuz çözdüğü için paketi doğrudan CJS girişine yönlendiriyoruz.
 */
const sdkCjs = path.join(__dirname, 'node_modules/@anthropic-ai/sdk/index.js');
const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@anthropic-ai/sdk') return { type: 'sourceFile', filePath: sdkCjs };
  return (upstream ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
