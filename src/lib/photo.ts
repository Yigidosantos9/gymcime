import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export type MealPhoto = { uri: string; base64: string };

export class PhotoPermissionError extends Error {}

const MAX_SIDE = 1024;

/** Kameradan çek ya da galeriden seç; uzun kenarı 1024 px'e küçültüp JPEG base64 döndürür. İptalde null. */
export async function pickMealPhoto(source: 'camera' | 'library'): Promise<MealPhoto | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new PhotoPermissionError('Kamera izni verilmedi. Ayarlar uygulamasından izin verebilirsin.');
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: false };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  const ctx = ImageManipulator.ImageManipulator.manipulate(a.uri);
  ctx.resize(a.width >= a.height ? { width: Math.min(MAX_SIDE, a.width) } : { height: Math.min(MAX_SIDE, a.height) });
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!out.base64) throw new Error('Fotoğraf işlenemedi.');
  return { uri: out.uri, base64: out.base64 };
}
