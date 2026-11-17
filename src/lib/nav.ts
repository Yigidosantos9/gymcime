import { router } from 'expo-router';

/**
 * Ekrandan güvenle çık.
 * expo-router'da `router.back()` (GO_BACK) odaktaki gezgine gider; modal ekranlarda
 * ("fullScreenModal" antrenman, özet) bu bazen hiçbir gezgine ulaşmaz ve
 * "The action 'GO_BACK' was not handled by any navigator" hatası verir.
 * `dismiss()` (POP) yığından ekranı açıkça kaldırır; o da olmazsa ana sayfaya dön.
 */
export function leave() {
  if (router.canDismiss()) router.dismiss();
  else if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** Tüm modalları kapatıp ana sekmelere dön. */
export function goHome() {
  if (router.canDismiss()) router.dismissAll();
  else router.replace('/');
}
