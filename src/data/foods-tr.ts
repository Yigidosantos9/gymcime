/**
 * Türkçe yiyecek/içecek veritabanı (çevrimdışı).
 *
 * Değerler 100 g (sıvılar için 100 ml) başına YAKLAŞIK değerlerdir; USDA FoodData Central (kamu malı)
 * ve TürKomp benzeri genel besin tablolarındaki ortalamalara dayanır. Marka, pişirme ve tarife göre değişir.
 * Tutarlılık: kcal ≈ 4·protein + 4·karbonhidrat + 9·yağ (tests/foods-tr.test.ts denetler).
 */

import { t, type MsgKey } from '@/i18n';

import { FOOD_NAMES_EN } from './foods-en';

export type FoodCategoryId =
  | 'kahvalti'
  | 'ekmek'
  | 'et'
  | 'baklagil'
  | 'sebze'
  | 'corba'
  | 'pilav'
  | 'ev'
  | 'meyve'
  | 'kuruyemis'
  | 'sut'
  | 'tatli'
  | 'icecek'
  | 'fastfood'
  | 'takviye';

const FOOD_CATEGORY_IDS: FoodCategoryId[] = ['kahvalti', 'ekmek', 'et', 'baklagil', 'sebze', 'corba', 'pilav', 'ev', 'meyve', 'kuruyemis', 'sut', 'tatli', 'icecek', 'fastfood', 'takviye'];

/** Kategori adları geçerli dilde (getter: dil değişince güncel). */
export const FOOD_CATEGORIES: { id: FoodCategoryId; readonly label: string }[] = FOOD_CATEGORY_IDS.map((id) => ({
  id,
  get label() {
    return t(`foodCat.${id}` as MsgKey);
  },
}));


export type FoodPortion = { label: string; grams: number };

export type FoodTr = {
  id: string;
  name: string;
  /** İngilizce ad (arama ve gösterim) */
  nameEn: string;
  aliases: string[];
  category: FoodCategoryId;
  /** 'g' (katı) veya 'ml' (sıvı) — değerler 100 birim başınadır */
  unit: 'g' | 'ml';
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  portions: FoodPortion[];
};

// [ad, takma adlar (|), kategori, kcal, P, K, Y, porsiyonlar ("etiket:gram;…"), 'ml' (isteğe bağlı)]
type Row = [string, string, FoodCategoryId, number, number, number, number, string, ('ml' | undefined)?];

const ROWS: Row[] = [
  // ───────── Kahvaltılık ─────────
  ['Beyaz Peynir', 'peynir|sert peynir|koyun peyniri', 'kahvalti', 264, 17, 1.5, 21, '1 dilim:30;1 kibrit kutusu:40;1 yemek kaşığı:15'],
  ['Kaşar Peyniri', 'kasar|kaşar', 'kahvalti', 350, 25, 2, 27, '1 dilim:20;2 dilim:40'],
  ['Tulum Peyniri', 'tulum', 'kahvalti', 345, 22, 2, 27, '1 dilim:30;1 porsiyon:50'],
  ['Lor Peyniri', 'lor|süzme peynir', 'kahvalti', 98, 11, 3.5, 4, '1 yemek kaşığı:25;1 porsiyon:60'],
  ['Çökelek', 'cokelek', 'kahvalti', 120, 20, 3, 3, '1 yemek kaşığı:25;1 porsiyon:60'],
  ['Otlu Peynir', 'van otlu peyniri|otlu', 'kahvalti', 300, 22, 3, 22, '1 dilim:30;1 porsiyon:50'],
  ['Labne', 'labne peynir', 'kahvalti', 170, 6, 4, 14, '1 yemek kaşığı:20;1 porsiyon:50'],
  ['Krem Peynir', 'cream cheese|philadelphia', 'kahvalti', 346, 6, 4, 34, '1 yemek kaşığı:15;1 porsiyon:30'],
  ['Haşlanmış Yumurta', 'yumurta|rafadan|katı yumurta', 'kahvalti', 155, 13, 1.1, 11, '1 adet:50;2 adet:100'],
  ['Sahanda Yumurta', 'yumurta|sahan', 'kahvalti', 196, 13.6, 0.8, 15, '1 adet:46;2 adet:92'],
  ['Omlet', 'yumurtalı omlet', 'kahvalti', 154, 10, 1, 12, '1 porsiyon (2 yumurta):120;1 porsiyon (3 yumurta):180'],
  ['Menemen', 'domatesli yumurta', 'kahvalti', 120, 6, 5, 9, '1 porsiyon:200;1 küçük tabak:150'],
  ['Sucuklu Yumurta', 'sucuk yumurta', 'kahvalti', 270, 15, 1.5, 23, '1 porsiyon:150;1 küçük tabak:100'],
  ['Yumurta Akı', 'yumurta beyazı', 'kahvalti', 52, 11, 0.7, 0.2, '1 adet:33;3 adet:99'],
  ['Yeşil Zeytin', 'zeytin', 'kahvalti', 145, 1, 3.8, 15, '1 adet:4;10 adet:40;1 küçük tabak:50'],
  ['Siyah Zeytin', 'zeytin', 'kahvalti', 115, 0.8, 6, 10.7, '1 adet:4;10 adet:40;1 küçük tabak:50'],
  ['Bal', 'süzme bal|petek bal', 'kahvalti', 304, 0.3, 82, 0, '1 çay kaşığı:7;1 yemek kaşığı:20'],
  ['Reçel', 'recel|çilek reçeli|vişne reçeli|kayısı reçeli', 'kahvalti', 250, 0.4, 65, 0.1, '1 çay kaşığı:8;1 yemek kaşığı:20'],
  ['Tereyağı', 'tereyag|tereyagi|yağ', 'kahvalti', 717, 0.9, 0.1, 81, '1 çay kaşığı:5;1 yemek kaşığı:14'],
  ['Kaymak', 'kaymak', 'kahvalti', 340, 2, 3, 35, '1 yemek kaşığı:20;1 porsiyon:40'],
  ['Tahin', 'tahin', 'kahvalti', 595, 17, 21, 54, '1 çay kaşığı:7;1 yemek kaşığı:15'],
  ['Pekmez', 'üzüm pekmezi|dut pekmezi|pekmez', 'kahvalti', 290, 1, 72, 0, '1 çay kaşığı:7;1 yemek kaşığı:20'],
  ['Tahin Pekmez', 'tahin pekmez karışımı', 'kahvalti', 450, 9, 46, 27, '1 yemek kaşığı:20;1 porsiyon:40'],
  ['Fıstık Ezmesi', 'yer fıstığı ezmesi|peanut butter', 'kahvalti', 588, 25, 20, 50, '1 çay kaşığı:6;1 yemek kaşığı:16'],
  ['Fındık Kreması', 'nutella|kakaolu fındık kreması|çikolatalı krem', 'kahvalti', 540, 6, 58, 31, '1 çay kaşığı:7;1 yemek kaşığı:18'],
  ['Zeytinyağı', 'zeytin yağı|sızma', 'kahvalti', 884, 0, 0, 100, '1 çay kaşığı:4;1 yemek kaşığı:13'],
  ['Mısır Gevreği', 'corn flakes|gevrek|kahvaltılık gevrek', 'kahvalti', 380, 7, 84, 1, '1 kase:40;1 büyük kase:60'],
  ['Yulaf Ezmesi', 'yulaf|oat|çiğ yulaf', 'kahvalti', 380, 13, 60, 7, '3 yemek kaşığı:30;1 kase:50'],
  ['Granola', 'müsli|muesli', 'kahvalti', 450, 10, 64, 18, '3 yemek kaşığı:30;1 kase:50'],
  ['Süt ile Yulaf Lapası', 'yulaf lapası|porridge', 'kahvalti', 90, 3.5, 13, 2.5, '1 kase:250;1 küçük kase:180'],
  ['Sucuk', 'sucuk', 'kahvalti', 450, 20, 2, 40, '1 dilim:10;3 dilim:30'],
  ['Salam', 'salam', 'kahvalti', 300, 13, 2, 27, '1 dilim:15;3 dilim:45'],
  ['Sosis', 'dana sosis|sosis', 'kahvalti', 250, 11, 3, 22, '1 adet:50;2 adet:100'],
  ['Pastırma', 'pastirma|çemen', 'kahvalti', 270, 34, 1, 14, '1 dilim:10;3 dilim:30'],
  ['Hindi Füme', 'hindi jambon|füme', 'kahvalti', 105, 17, 2, 3, '1 dilim:15;3 dilim:45'],
  ['Tavuk Jambon', 'jambon', 'kahvalti', 110, 18, 1.5, 3.5, '1 dilim:15;3 dilim:45'],
  ['Peynirli Tost', 'tost|kaşarlı tost', 'kahvalti', 260, 12, 26, 12, '1 adet:120;1 büyük adet:160'],
  ['Kuymak', 'mıhlama|muhlama', 'kahvalti', 280, 11, 9, 22, '1 porsiyon:200;1 küçük tabak:130'],
  ['Pişi', 'pisi|kızarmış hamur', 'kahvalti', 331, 7, 42, 15, '1 adet:50;2 adet:100'],
  ['Avokado', 'avokado', 'kahvalti', 160, 2, 8.5, 14.7, '1/2 adet:100;1 adet:200'],

  // ───────── Ekmek & hamur işi ─────────
  ['Beyaz Ekmek', 'ekmek|somun|francala', 'ekmek', 265, 8, 50, 3, '1 dilim:25;2 dilim:50;1/4 somun:60'],
  ['Tam Buğday Ekmeği', 'tam buğday|ekmek', 'ekmek', 250, 10, 45, 3.5, '1 dilim:30;2 dilim:60'],
  ['Çavdar Ekmeği', 'çavdar|siyah ekmek', 'ekmek', 259, 8.5, 48, 3.3, '1 dilim:30;2 dilim:60'],
  ['Kepekli Ekmek', 'kepek ekmeği|diyet ekmek', 'ekmek', 247, 13, 41, 3.4, '1 dilim:30;2 dilim:60'],
  ['Lavaş', 'lavas', 'ekmek', 275, 9, 56, 1, '1 adet:60;1 büyük adet:90'],
  ['Pide Ekmeği', 'ramazan pidesi|pide', 'ekmek', 270, 9, 52, 2.5, '1/4 adet:60;1 adet:240'],
  ['Bazlama', 'bazlama', 'ekmek', 270, 8, 55, 1.5, '1 adet:90'],
  ['Tost Ekmeği', 'tost ekmeği|sandviç ekmeği', 'ekmek', 270, 8, 48, 4, '1 dilim:28;2 dilim:56'],
  ['Simit', 'simit|gevrek|susamlı', 'ekmek', 330, 10, 60, 5, '1 adet:110;1 küçük adet:80'],
  ['Poğaça', 'pogaca|peynirli poğaça', 'ekmek', 358, 9, 40, 18, '1 adet:70;1 küçük adet:50'],
  ['Açma', 'acma', 'ekmek', 365, 8, 45, 17, '1 adet:80'],
  ['Su Böreği', 'börek|peynirli börek', 'ekmek', 249, 9, 24, 13, '1 dilim:120;1 porsiyon:180'],
  ['Sigara Böreği', 'börek|sigara boregi', 'ekmek', 328, 9, 28, 20, '1 adet:40;3 adet:120'],
  ['Kıymalı Börek', 'börek|kıymalı', 'ekmek', 292, 11, 26, 16, '1 dilim:120;1 porsiyon:180'],
  ['Ispanaklı Börek', 'börek|ıspanaklı', 'ekmek', 242, 7, 22, 14, '1 dilim:120;1 porsiyon:180'],
  ['Gözleme', 'gozleme|peynirli gözleme|patatesli gözleme', 'ekmek', 246, 9, 30, 10, '1 adet:150;1 büyük adet:220'],
  ['Lahmacun', 'lahmacun', 'ekmek', 227, 11, 30, 7, '1 adet:120;1 büyük adet:160'],
  ['Kıymalı Pide', 'pide|karadeniz pidesi', 'ekmek', 250, 12, 28, 10, '1 dilim:60;1 adet:300'],
  ['Kaşarlı Pide', 'pide|peynirli pide', 'ekmek', 276, 13, 29, 12, '1 dilim:60;1 adet:300'],
  ['Kruvasan', 'croissant', 'ekmek', 401, 8, 45, 21, '1 adet:60;1 büyük adet:90'],
  ['Çörek', 'corek|tahinli çörek', 'ekmek', 358, 8, 50, 14, '1 adet:70'],
  ['Kurabiye', 'tereyağlı kurabiye|un kurabiyesi', 'ekmek', 482, 6, 65, 22, '1 adet:15;3 adet:45'],
  ['Bisküvi', 'biskuvi|sade bisküvi|petibör', 'ekmek', 451, 7, 72, 15, '1 adet:8;5 adet:40'],
  ['Kraker', 'tuzlu kraker|galeta', 'ekmek', 428, 10, 70, 12, '1 adet:8;5 adet:40'],
  ['Pirinç Patlağı', 'pirinç keki|rice cake', 'ekmek', 379, 8, 80, 3, '1 adet:9;3 adet:27'],
  ['Tortilla', 'dürüm lavaşı|wrap ekmeği', 'ekmek', 295, 8, 50, 7, '1 adet:60;1 büyük adet:80'],
  ['Hamburger Ekmeği', 'burger ekmeği|sandviç ekmeği', 'ekmek', 268, 9, 50, 4, '1 adet:60'],
  ['Yufka', 'yufka', 'ekmek', 281, 9, 58, 1.5, '1 adet:60;1 yaprak:20'],
  ['Bagel', 'bagel', 'ekmek', 265, 10, 53, 1.5, '1 adet:90'],
  ['Pankek', 'pancake|krep', 'ekmek', 227, 6, 35, 7, '1 adet:60;3 adet:180'],
  ['Sade Kek', 'kek|islak kek|kek dilimi', 'ekmek', 382, 5, 50, 18, '1 dilim:60;2 dilim:120'],
  ['Muffin', 'kek|çikolatalı muffin', 'ekmek', 382, 5, 50, 18, '1 adet:80'],

  // ───────── Et, tavuk, balık ─────────
  ['Izgara Tavuk Göğsü', 'tavuk göğsü|tavuk|göğüs', 'et', 165, 31, 0, 3.6, '1 porsiyon:150;1 adet:180;100 g:100'],
  ['Haşlanmış Tavuk Göğsü', 'tavuk göğsü|haşlama tavuk', 'et', 150, 29, 0, 3.2, '1 porsiyon:150;1 adet:180'],
  ['Tavuk But (derisiz, ızgara)', 'tavuk but|but', 'et', 190, 27, 0, 9, '1 adet:100;2 adet:200'],
  ['Tavuk But (fırın, derili)', 'tavuk but|fırın tavuk', 'et', 230, 24, 0, 15, '1 adet:120;2 adet:240'],
  ['Tavuk Kanat', 'kanat|izgara kanat', 'et', 288, 27, 0, 20, '1 adet:40;4 adet:160'],
  ['Tavuk Şiş', 'tavuk şiş|tavuk kebap', 'et', 166, 27, 1, 6, '1 şiş:100;1 porsiyon:180'],
  ['Tavuk Döner', 'döner|tavuk döner', 'et', 190, 22, 3, 10, '1 porsiyon:150;1 büyük porsiyon:200'],
  ['Et Döner', 'döner|dana döner|kuzu döner', 'et', 254, 20, 3, 18, '1 porsiyon:150;1 büyük porsiyon:200'],
  ['Köfte', 'kofte|ızgara köfte|izgara köfte|köfte ekmek', 'et', 253, 19, 6, 17, '1 adet:35;4 adet:140;1 porsiyon:150'],
  ['Dana Kıyma (pişmiş)', 'kıyma|kiyma|dana kıyma', 'et', 248, 26, 0, 16, '1 porsiyon:100;1 yemek kaşığı:15'],
  ['Kuşbaşı Dana Eti (pişmiş)', 'kuşbaşı|dana eti|et', 'et', 220, 30, 0, 10, '1 porsiyon:120'],
  ['Dana Biftek (ızgara)', 'biftek|bonfile|dana eti', 'et', 243, 27, 0, 15, '1 porsiyon:150;1 adet:200'],
  ['Dana Antrikot (ızgara)', 'antrikot|dana eti|steak', 'et', 266, 26, 0, 18, '1 porsiyon:150;1 adet:250'],
  ['Kuzu Pirzola (ızgara)', 'pirzola|kuzu', 'et', 289, 25, 0, 21, '1 adet:70;3 adet:210'],
  ['Kuzu Tandır', 'tandır|kuzu incik|kuzu eti', 'et', 248, 26, 0, 16, '1 porsiyon:150;1 büyük porsiyon:220'],
  ['Kuzu Şiş', 'şiş kebap|kuzu şiş|et şiş', 'et', 225, 27, 0, 13, '1 şiş:100;1 porsiyon:180'],
  ['Adana Kebap', 'adana|kebap', 'et', 269, 18, 2, 21, '1 şiş:100;1 porsiyon:200'],
  ['Urfa Kebap', 'urfa|kebap', 'et', 264, 19, 2, 20, '1 şiş:100;1 porsiyon:200'],
  ['Kokoreç', 'kokorec', 'et', 267, 14, 1, 23, '1 porsiyon:150;1 yarım ekmek:100'],
  ['Kuzu Ciğer (kavurma)', 'ciğer|ciger|ciğer tava', 'et', 166, 25, 3, 6, '1 porsiyon:120;1 küçük porsiyon:80'],
  ['Dana Kavurma', 'kavurma|et kavurma', 'et', 298, 25, 0, 22, '1 porsiyon:100;1 yemek kaşığı:20'],
  ['Kaburga (fırın)', 'kaburga|dana kaburga', 'et', 313, 22, 0, 25, '1 porsiyon:200'],
  ['Hindi Göğsü (pişmiş)', 'hindi|hindi eti', 'et', 129, 30, 0, 1, '1 porsiyon:150'],
  ['Somon (ızgara)', 'somon|salmon|balık', 'et', 196, 22, 0, 12, '1 filet:150;1 porsiyon:120'],
  ['Levrek (ızgara)', 'levrek|balık', 'et', 123, 24, 0, 3, '1 filet:150;1 porsiyon:200'],
  ['Çipura (ızgara)', 'çipura|cipura|balık', 'et', 133, 22, 0, 5, '1 filet:150;1 porsiyon:200'],
  ['Hamsi (tava)', 'hamsi|balık', 'et', 220, 20, 8, 12, '1 adet:20;1 porsiyon:150'],
  ['Uskumru (ızgara)', 'uskumru|balık|scomber', 'et', 258, 24, 0, 18, '1 filet:120;1 porsiyon:200'],
  ['Lüfer (ızgara)', 'lufer|balık', 'et', 177, 24, 0, 9, '1 porsiyon:200'],
  ['Sardalya (konserve)', 'sardalya|balık konservesi', 'et', 199, 25, 0, 11, '1 kutu:90;1 porsiyon:100'],
  ['Ton Balığı (konserve, suda)', 'ton|ton balığı|konserve', 'et', 113, 26, 0, 1, '1 küçük kutu:80;1 kutu:120'],
  ['Karides (haşlanmış)', 'karides|deniz ürünü', 'et', 99, 24, 0.2, 0.3, '1 porsiyon:100;1 adet:10'],
  ['Midye Dolma', 'midye|dolma', 'et', 145, 7, 18, 5, '1 adet:25;6 adet:150'],
  ['Kalamar Tava', 'kalamar|calamari', 'et', 195, 15, 9, 11, '1 porsiyon:150'],

  // ───────── Baklagil ─────────
  ['Kuru Fasulye (haşlanmış, sade)', 'fasulye|kuru fasulye', 'baklagil', 127, 8.7, 22.8, 0.5, '1 kase:200;1 yemek kaşığı:20'],
  ['Nohut (haşlanmış)', 'nohut', 'baklagil', 164, 8.9, 27.4, 2.6, '1 kase:160;1 yemek kaşığı:15'],
  ['Kırmızı Mercimek (haşlanmış)', 'mercimek', 'baklagil', 116, 9, 20, 0.4, '1 kase:200;1 yemek kaşığı:15'],
  ['Yeşil Mercimek (haşlanmış)', 'mercimek|kahverengi mercimek', 'baklagil', 116, 9, 20, 0.4, '1 kase:200;1 yemek kaşığı:15'],
  ['Barbunya (haşlanmış)', 'barbunya|börülce', 'baklagil', 127, 9, 23, 0.5, '1 kase:200'],
  ['Börülce (haşlanmış)', 'borulce', 'baklagil', 116, 8, 21, 0.5, '1 kase:200'],
  ['Bakla (haşlanmış)', 'bakla|taze bakla', 'baklagil', 110, 7.6, 19.7, 0.4, '1 kase:200'],
  ['Soya Fasulyesi (haşlanmış)', 'soya|edamame', 'baklagil', 173, 16.6, 9.9, 9, '1 kase:150'],
  ['Humus', 'hummus|nohut ezmesi', 'baklagil', 178, 8, 14, 10, '1 yemek kaşığı:25;1 porsiyon:100'],
  ['Nohut (konserve)', 'nohut|hazır nohut', 'baklagil', 126, 7, 20, 2, '1 kase:160;1 kutu:240'],
  ['Leblebi', 'leblebi|sarı leblebi|kavrulmuş nohut', 'baklagil', 374, 20, 60, 6, '1 avuç:30;1 kase:60'],
  ['Falafel', 'falafel', 'baklagil', 342, 13, 32, 18, '1 adet:17;5 adet:85'],
  ['Kuru Mercimek (çiğ)', 'mercimek|kırmızı mercimek', 'baklagil', 349, 25, 60, 1, '1 yemek kaşığı:15;1 su bardağı:190'],
  ['Kuru Fasulye (çiğ)', 'fasulye|kuru fasulye', 'baklagil', 343, 22, 61, 1.2, '1 yemek kaşığı:15;1 su bardağı:180'],
  ['Kuru Nohut (çiğ)', 'nohut', 'baklagil', 374, 19, 61, 6, '1 yemek kaşığı:15;1 su bardağı:180'],

  // ───────── Sebze & salata ─────────
  ['Domates', 'domates', 'sebze', 20, 0.9, 3.9, 0.2, '1 adet:120;1 küçük adet:80'],
  ['Salatalık', 'salatalik|hıyar', 'sebze', 17, 0.7, 3.6, 0.1, '1 adet:120;1 küçük adet:80'],
  ['Yeşil Biber', 'biber|sivri biber|çarliston', 'sebze', 22, 0.9, 4.6, 0.2, '1 adet:25;1 dolmalık biber:100'],
  ['Kırmızı Biber', 'biber|kapya biber', 'sebze', 31, 1, 6, 0.3, '1 adet:120'],
  ['Patlıcan', 'patlican', 'sebze', 27, 1, 5.9, 0.2, '1 adet:250;1 küçük adet:150'],
  ['Kabak', 'kabak|sakız kabağı', 'sebze', 18, 1.2, 3.1, 0.3, '1 adet:200'],
  ['Havuç', 'havuc', 'sebze', 41, 0.9, 9.6, 0.2, '1 adet:80;1 büyük adet:120'],
  ['Marul', 'marul|yeşil salata|göbek marul', 'sebze', 17, 1.4, 2.9, 0.2, '1 kase:50;1 porsiyon:100'],
  ['Roka', 'roka', 'sebze', 28, 2.6, 3.7, 0.7, '1 avuç:20;1 porsiyon:50'],
  ['Ispanak (çiğ)', 'ispanak|ıspanak', 'sebze', 27, 2.9, 3.6, 0.4, '1 avuç:30;1 porsiyon:100'],
  ['Maydanoz', 'maydanoz', 'sebze', 40, 3, 6.3, 0.8, '1 demet:50;1 yemek kaşığı:4'],
  ['Soğan', 'sogan|kuru soğan', 'sebze', 42, 1.1, 9.3, 0.1, '1 adet:110;1 küçük adet:70'],
  ['Sarımsak', 'sarimsak', 'sebze', 162, 6.4, 33, 0.5, '1 diş:3;1 baş:40'],
  ['Brokoli (haşlanmış)', 'brokoli|broccoli', 'sebze', 38, 2.4, 7.2, 0.4, '1 porsiyon:150;1 kase:100'],
  ['Karnabahar', 'karnabahar|conopit', 'sebze', 27, 1.9, 5, 0.3, '1 porsiyon:150'],
  ['Beyaz Lahana', 'lahana|beyaz lahana', 'sebze', 27, 1.3, 5.8, 0.1, '1 kase:90;1 porsiyon:150'],
  ['Pırasa (pişmiş)', 'pirasa', 'sebze', 33, 0.8, 7.6, 0.2, '1 porsiyon:150'],
  ['Kereviz', 'kereviz|kereviz kökü', 'sebze', 42, 1.5, 9, 0.3, '1 porsiyon:150'],
  ['Taze Fasulye (haşlanmış)', 'fasulye|taze fasulye', 'sebze', 37, 1.9, 7.9, 0.3, '1 porsiyon:150'],
  ['Bezelye (haşlanmış)', 'bezelye|taze bezelye', 'sebze', 85, 5.4, 15.6, 0.2, '1 porsiyon:150;1 yemek kaşığı:15'],
  ['Haşlanmış Mısır', 'mısır|misir|haşlama mısır', 'sebze', 100, 3.4, 21, 1.5, '1 adet:150;1 kase:100'],
  ['Haşlanmış Patates', 'patates', 'sebze', 87, 1.9, 20, 0.1, '1 adet:150;1 küçük adet:100'],
  ['Fırın Patates', 'patates|fırında patates', 'sebze', 95, 2.5, 21, 0.1, '1 adet:200;1 küçük adet:130'],
  ['Patates Kızartması', 'patates|french fries|cips', 'sebze', 312, 3.4, 41, 15, '1 porsiyon:150;1 küçük porsiyon:100'],
  ['Tatlı Patates (fırın)', 'tatlı patates|sweet potato', 'sebze', 94, 2, 21, 0.2, '1 adet:150'],
  ['Mantar', 'mantar|kültür mantarı', 'sebze', 25, 3.1, 3.3, 0.3, '1 kase:70;1 porsiyon:100'],
  ['Haşlanmış Pancar', 'pancar|kırmızı pancar', 'sebze', 44, 1.7, 10, 0.2, '1 adet:100'],
  ['Turp', 'turp', 'sebze', 17, 0.7, 3.4, 0.1, '1 adet:15;1 porsiyon:50'],
  ['Balkabağı', 'bal kabağı|kabak', 'sebze', 28, 1, 6.5, 0.1, '1 porsiyon:150;1 dilim:200'],
  ['Enginar', 'enginar', 'sebze', 50, 3.3, 10.5, 0.2, '1 adet:100'],
  ['Semizotu', 'semiz otu', 'sebze', 22, 2, 3.4, 0.4, '1 porsiyon:100'],
  ['Çoban Salatası', 'coban salata|salata', 'sebze', 46, 1, 5, 2.5, '1 porsiyon:200;1 küçük tabak:120'],
  ['Mevsim Salata', 'yeşil salata|salata', 'sebze', 61, 1.2, 5, 4, '1 porsiyon:150;1 büyük tabak:250'],
  ['Gavurdağı Salatası', 'gavurdagi|ceviz salatası', 'sebze', 92, 1.5, 7, 6.5, '1 porsiyon:150'],
  ['Piyaz', 'fasulye piyazı|piyaz', 'sebze', 129, 6, 15, 5, '1 porsiyon:150'],
  ['Cacık', 'cacik|yoğurtlu salatalık', 'sebze', 55, 3, 4, 3, '1 kase:150;1 yemek kaşığı:20'],
  ['Haydari', 'haydari|süzme yoğurt mezesi', 'sebze', 131, 4, 4, 11, '1 porsiyon:80;1 yemek kaşığı:20'],
  ['Acılı Ezme', 'ezme|acılı ezme', 'sebze', 69, 1.2, 7, 4, '1 porsiyon:80;1 yemek kaşığı:20'],
  ['Közlenmiş Patlıcan Salatası', 'patlıcan salatası|patlican salata', 'sebze', 79, 1.5, 6, 5.5, '1 porsiyon:100'],
  ['Turşu (salatalık)', 'tursu|salatalık turşusu', 'sebze', 13, 0.6, 2.3, 0.2, '1 adet:40;1 porsiyon:100'],

  // ───────── Çorbalar (1 kase ≈ 250 g) ─────────
  ['Mercimek Çorbası', 'mercimek corbasi|çorba|corba', 'corba', 57, 3, 8, 1.5, '1 kase:250;1 büyük kase:350;1 kepçe:150'],
  ['Ezogelin Çorbası', 'ezogelin|çorba|corba', 'corba', 61, 2.5, 9.5, 1.5, '1 kase:250;1 büyük kase:350'],
  ['Domates Çorbası', 'domates corbasi|çorba|corba', 'corba', 50, 1.2, 8, 1.5, '1 kase:250;1 büyük kase:350'],
  ['Tavuk Suyu Çorbası', 'tavuk çorbası|şehriyeli çorba|corba', 'corba', 35, 2.5, 4, 1, '1 kase:250'],
  ['Tarhana Çorbası', 'tarhana|çorba|corba', 'corba', 60, 2.5, 9, 1.5, '1 kase:250;1 büyük kase:350'],
  ['Yayla Çorbası', 'yoğurt çorbası|çorba|corba', 'corba', 65, 2.5, 7, 3, '1 kase:250'],
  ['Düğün Çorbası', 'dugun corbasi|çorba|corba', 'corba', 85, 4, 5, 5.5, '1 kase:250'],
  ['İşkembe Çorbası', 'iskembe|çorba|corba', 'corba', 68, 5, 3, 4, '1 kase:250'],
  ['Sebze Çorbası', 'sebze corbasi|çorba|corba', 'corba', 39, 1.5, 6, 1, '1 kase:250'],
  ['Mantar Çorbası', 'kremalı mantar|çorba|corba', 'corba', 68, 2, 6, 4, '1 kase:250'],
  ['Kelle Paça Çorbası', 'paça|paca|çorba', 'corba', 77, 7, 1, 5, '1 kase:250'],
  ['Balık Çorbası', 'balik corbasi|çorba|corba', 'corba', 62, 6, 4, 2.5, '1 kase:250'],
  ['Brokoli Çorbası', 'brokoli|çorba|corba', 'corba', 46, 2, 5, 2, '1 kase:250'],
  ['Şehriye Çorbası', 'sehriye|çorba|corba', 'corba', 46, 1.2, 7, 1.5, '1 kase:250'],
  ['Toyga Çorbası', 'toyga|çorba|corba', 'corba', 62, 3, 7, 2.5, '1 kase:250'],

  // ───────── Pilav & makarna ─────────
  ['Pirinç Pilavı', 'pilav|tereyağlı pilav|sade pilav', 'pilav', 168, 3, 30, 4, '1 porsiyon:150;1 kase:200;1 yemek kaşığı:15'],
  ['Bulgur Pilavı', 'bulgur|pilav', 'pilav', 130, 4, 24, 2, '1 porsiyon:150;1 kase:200'],
  ['Domatesli Bulgur Pilavı', 'bulgur pilavı|pilav', 'pilav', 125, 3.5, 22, 2.5, '1 porsiyon:150;1 kase:200'],
  ['Şehriyeli Pilav', 'sehriyeli pilav|pilav', 'pilav', 175, 3.5, 30, 4.5, '1 porsiyon:150;1 kase:200'],
  ['Nohutlu Pilav', 'nohutlu|pilav', 'pilav', 172, 5, 30, 3.5, '1 porsiyon:180;1 kase:220'],
  ['Beyaz Pirinç (haşlanmış)', 'pirinç|pirinc|haşlanmış pirinç', 'pilav', 126, 2.7, 28, 0.3, '1 porsiyon:150;1 kase:200'],
  ['Esmer Pirinç (pişmiş)', 'esmer pirinç|kahverengi pirinç', 'pilav', 122, 2.7, 25.6, 1, '1 porsiyon:150;1 kase:200'],
  ['Makarna (haşlanmış, sade)', 'makarna|spagetti|penne', 'pilav', 155, 5.8, 31, 0.9, '1 porsiyon:200;1 kase:250'],
  ['Domates Soslu Makarna', 'makarna|napoliten', 'pilav', 136, 4.5, 25, 2, '1 porsiyon:250;1 kase:300'],
  ['Fırın Makarna', 'makarna|fırında makarna', 'pilav', 192, 8, 22, 8, '1 porsiyon:200;1 dilim:150'],
  ['Kıymalı Makarna', 'makarna|bolonez|spagetti bolonez', 'pilav', 157, 8, 20, 5, '1 porsiyon:250;1 kase:300'],
  ['Erişte (pişmiş)', 'eriste|makarna', 'pilav', 136, 4.5, 25, 2, '1 porsiyon:200'],
  ['Kuskus (pişmiş)', 'couscous|kuskus', 'pilav', 109, 3.8, 23, 0.2, '1 porsiyon:150;1 kase:200'],
  ['Bulgur (haşlanmış, sade)', 'bulgur', 'pilav', 88, 3, 18.6, 0.2, '1 porsiyon:150;1 kase:200'],
  ['Kinoa (pişmiş)', 'quinoa|kinoa', 'pilav', 119, 4.4, 21, 1.9, '1 porsiyon:150;1 kase:185'],
  ['Hazır Noodle (pişmiş)', 'noodle|çorbalı makarna', 'pilav', 140, 4, 22, 4, '1 paket:350;1 kase:250'],
  ['İç Pilav', 'ic pilav|pilav', 'pilav', 191, 4, 28, 7, '1 porsiyon:150;1 kase:200'],
  ['Hamsili Pilav', 'hamsi pilavı|pilav', 'pilav', 203, 7, 28, 7, '1 porsiyon:200'],
  ['Tavuklu Pilav', 'tavuk pilav|pilav', 'pilav', 181, 9, 25, 5, '1 porsiyon:250;1 kase:300'],
  ['Makarna Salatası', 'makarna salata|salata', 'pilav', 167, 4, 22, 7, '1 porsiyon:150;1 kase:200'],
  ['Patates Püresi', 'püre|pure', 'pilav', 112, 2, 16, 4.5, '1 porsiyon:150;1 kase:200'],
  ['Pirinç (çiğ)', 'pirinç|pirinc|kuru pirinç', 'pilav', 349, 7, 79, 0.6, '1 yemek kaşığı:15;1 su bardağı:180'],
  ['Bulgur (çiğ)', 'bulgur|kuru bulgur', 'pilav', 342, 12, 76, 1.3, '1 yemek kaşığı:15;1 su bardağı:160'],
  ['Makarna (çiğ)', 'makarna|kuru makarna', 'pilav', 358, 13, 72, 1.5, '1 porsiyon:80;1 yemek kaşığı:10'],
  ['Un', 'buğday unu|un', 'pilav', 364, 10, 76, 1, '1 yemek kaşığı:10;1 su bardağı:120'],

  // ───────── Ev yemekleri ─────────
  ['Karnıyarık', 'karniyarik|patlıcan yemeği', 'ev', 129, 6, 6, 9, '1 adet:200;1 porsiyon:250'],
  ['İmam Bayıldı', 'imambayildi|zeytinyağlı patlıcan', 'ev', 110, 1.5, 8, 8, '1 adet:150;1 porsiyon:200'],
  ['Kuru Fasulye (etli)', 'fasulye|kuru fasulye|etli kuru fasulye', 'ev', 110, 6.5, 13, 3.5, '1 porsiyon:250;1 kase:300'],
  ['Nohut Yemeği (etli)', 'nohut|etli nohut', 'ev', 128, 7, 16, 4, '1 porsiyon:250'],
  ['Taze Fasulye (zeytinyağlı)', 'fasulye|taze fasulye|zeytinyağlı', 'ev', 85, 2, 8, 5, '1 porsiyon:200'],
  ['Barbunya Pilaki', 'pilaki|barbunya|zeytinyağlı', 'ev', 96, 4, 12, 3.5, '1 porsiyon:200'],
  ['Etli Türlü', 'turlu|türlü|karışık sebze yemeği', 'ev', 93, 5, 7, 5, '1 porsiyon:250'],
  ['Musakka', 'musakka|patlıcan musakka', 'ev', 142, 6, 7, 10, '1 porsiyon:250'],
  ['Kabak Mücver', 'mucver|mücver', 'ev', 171, 6, 12, 11, '1 adet:45;3 adet:135'],
  ['Zeytinyağlı Yaprak Sarma', 'sarma|yaprak sarma|dolma', 'ev', 172, 3, 22, 8, '1 adet:20;6 adet:120;1 porsiyon:150'],
  ['Etli Yaprak Sarma', 'sarma|yaprak sarma|dolma', 'ev', 152, 6, 14, 8, '1 adet:25;5 adet:125'],
  ['Lahana Sarması', 'sarma|lahana', 'ev', 122, 5, 12, 6, '1 adet:40;3 adet:120'],
  ['Biber Dolması', 'dolma|etli biber dolması', 'ev', 126, 5, 13, 6, '1 adet:100;2 adet:200'],
  ['Domates Dolması', 'dolma', 'ev', 117, 3, 15, 5, '1 adet:100;2 adet:200'],
  ['Kabak Dolması', 'dolma', 'ev', 114, 5, 10, 6, '1 adet:80;3 adet:240'],
  ['Patlıcan Dolması', 'dolma', 'ev', 128, 5, 9, 8, '1 adet:120;2 adet:240'],
  ['Kıymalı Ispanak', 'ispanak yemeği|ıspanak', 'ev', 94, 6, 4, 6, '1 porsiyon:250'],
  ['Ispanak Yemeği (zeytinyağlı)', 'ispanak|ıspanak', 'ev', 70.5, 2.5, 5, 4.5, '1 porsiyon:200'],
  ['Kapuska', 'lahana yemeği|kapuska', 'ev', 80, 2, 8, 4.5, '1 porsiyon:200'],
  ['Pırasa Yemeği', 'pirasa|zeytinyağlı pırasa', 'ev', 74, 1.5, 8, 4, '1 porsiyon:200'],
  ['Bamya', 'bamya yemeği|etli bamya', 'ev', 72, 2, 7, 4, '1 porsiyon:200'],
  ['Patates Yemeği', 'etli patates|patates', 'ev', 95, 3, 13, 3.5, '1 porsiyon:250'],
  ['Hünkar Beğendi', 'hunkar begendi|beğendi', 'ev', 186, 9, 6, 14, '1 porsiyon:300'],
  ['Tas Kebabı', 'tas kebap|et yemeği', 'ev', 144, 12, 6, 8, '1 porsiyon:250'],
  ['Orman Kebabı', 'orman kebap|et yemeği', 'ev', 118, 9, 7, 6, '1 porsiyon:250'],
  ['Etli Güveç', 'guvec|güveç|et yemeği', 'ev', 100, 8, 7, 4.5, '1 porsiyon:300'],
  ['İskender Kebap', 'iskender|bursa kebap', 'ev', 216, 13, 14, 12, '1 porsiyon:300;1 büyük porsiyon:400'],
  ['Beyti', 'beyti sarma|beyti kebap', 'ev', 264, 15, 15, 16, '1 adet:150;1 porsiyon:250'],
  ['Çiğ Köfte', 'cig kofte|çiğ köfte|etsiz çiğ köfte', 'ev', 164.5, 3.5, 32, 2.5, '1 adet:30;5 adet:150'],
  ['Mercimek Köftesi', 'mercimek koftesi|köfte', 'ev', 172, 6, 28, 4, '1 adet:25;5 adet:125'],
  ['İçli Köfte', 'icli kofte|köfte', 'ev', 244, 10, 24, 12, '1 adet:80;2 adet:160'],
  ['Kadınbudu Köfte', 'kadinbudu|köfte', 'ev', 222, 12, 12, 14, '1 adet:50;3 adet:150'],
  ['Sulu Köfte', 'sulu kofte|köfte', 'ev', 88, 6, 7, 4, '1 porsiyon:250'],
  ['Tavuk Sote', 'tavuk|sote', 'ev', 117, 14, 4, 5, '1 porsiyon:200;1 büyük porsiyon:300'],
  ['Et Sote', 'et|sote|kuşbaşı sote', 'ev', 152, 15, 5, 8, '1 porsiyon:200'],
  ['Mantı (yoğurtlu)', 'manti|mantı', 'ev', 166, 8, 20, 6, '1 porsiyon:250;1 büyük porsiyon:350'],
  ['Kısır', 'kisir|bulgur salatası', 'ev', 151, 3, 28, 3, '1 porsiyon:150;1 yemek kaşığı:30'],
  ['Çılbır', 'cilbir|yoğurtlu yumurta', 'ev', 139, 7, 3, 11, '1 porsiyon:200'],
  ['Patlıcan Kebabı', 'patlıcan kebap|kebap', 'ev', 137, 8, 6, 9, '1 porsiyon:250'],
  ['Tepsi Kebabı', 'tepsi kebap|kebap', 'ev', 188, 12, 8, 12, '1 porsiyon:250'],
  ['Pilav Üstü Döner', 'döner|pilav üstü', 'ev', 191, 12, 20, 7, '1 porsiyon:300;1 büyük porsiyon:400'],
  ['Börülce Salatası', 'borulce|salata', 'ev', 111.5, 6, 14, 3.5, '1 porsiyon:150'],
  ['Zeytinyağlı Enginar', 'enginar|zeytinyağlı', 'ev', 91, 2.5, 9, 5, '1 adet:100;2 adet:200'],
  ['Zeytinyağlı Kereviz', 'kereviz|zeytinyağlı', 'ev', 82.5, 1.5, 9, 4.5, '1 porsiyon:200'],
  ['Papaz Yahnisi', 'papaz yahni|yahni', 'ev', 155, 6, 8, 11, '1 porsiyon:250'],

  // ───────── Meyve ─────────
  ['Elma', 'elma|apple', 'meyve', 52, 0.3, 13.8, 0.2, '1 adet:180;1 küçük adet:120'],
  ['Armut', 'armut|pear', 'meyve', 57, 0.4, 15, 0.1, '1 adet:180;1 küçük adet:120'],
  ['Muz', 'muz|banana', 'meyve', 89, 1.1, 22.8, 0.3, '1 adet:120;1 küçük adet:90'],
  ['Portakal', 'portakal|orange', 'meyve', 47, 0.9, 11.8, 0.1, '1 adet:200;1 küçük adet:150'],
  ['Mandalina', 'mandalina', 'meyve', 53, 0.8, 13.3, 0.3, '1 adet:80;3 adet:240'],
  ['Greyfurt', 'greyfurt|grapefruit', 'meyve', 42, 0.8, 10.7, 0.1, '1/2 adet:120;1 adet:250'],
  ['Çilek', 'cilek|strawberry', 'meyve', 33, 0.7, 7.7, 0.3, '1 adet:12;1 kase:150'],
  ['Kiraz', 'kiraz|cherry', 'meyve', 63, 1.1, 16, 0.2, '1 adet:8;1 avuç:80'],
  ['Vişne', 'visne', 'meyve', 50, 1, 12.2, 0.3, '1 avuç:80;1 kase:150'],
  ['Üzüm', 'uzum|grape', 'meyve', 69, 0.7, 18, 0.2, '1 salkım:150;1 avuç:80'],
  ['Karpuz', 'karpuz|watermelon', 'meyve', 31, 0.6, 7.6, 0.2, '1 dilim:300;1 kase:150'],
  ['Kavun', 'kavun|melon', 'meyve', 34, 0.8, 8.2, 0.2, '1 dilim:200;1 kase:150'],
  ['Şeftali', 'seftali|peach', 'meyve', 40, 0.9, 9.5, 0.3, '1 adet:150'],
  ['Kayısı', 'kayisi|apricot', 'meyve', 49, 1.4, 11.1, 0.4, '1 adet:35;3 adet:105'],
  ['Erik', 'erik|plum', 'meyve', 46, 0.7, 11.4, 0.3, '1 adet:60;3 adet:180'],
  ['İncir (taze)', 'incir|fig', 'meyve', 74, 0.8, 19, 0.3, '1 adet:50;3 adet:150'],
  ['Nar', 'nar|pomegranate', 'meyve', 84, 1.7, 18.7, 1.2, '1 kase:100;1 adet:250'],
  ['Kivi', 'kivi|kiwi', 'meyve', 61, 1.1, 14.7, 0.5, '1 adet:75;2 adet:150'],
  ['Ananas', 'ananas|pineapple', 'meyve', 50, 0.5, 13.1, 0.1, '1 dilim:80;1 kase:150'],
  ['Mango', 'mango', 'meyve', 60, 0.8, 15, 0.4, '1 adet:200;1 kase:150'],
  ['Yaban Mersini', 'yaban mersini|blueberry|bluberi', 'meyve', 57, 0.7, 14.5, 0.3, '1 avuç:50;1 kase:100'],
  ['Hurma (kuru)', 'hurma|medjool', 'meyve', 282, 2.5, 75, 0.4, '1 adet:8;3 adet:24;1 büyük adet:24'],
  ['Kuru Kayısı', 'kuru kayisi|kayısı kurusu', 'meyve', 241, 3.4, 63, 0.5, '1 adet:8;5 adet:40'],
  ['Kuru İncir', 'kuru incir|incir', 'meyve', 249, 3.3, 64, 0.9, '1 adet:20;3 adet:60'],
  ['Kuru Üzüm', 'kuru uzum|kuş üzümü', 'meyve', 299, 3.1, 79, 0.5, '1 avuç:30;1 yemek kaşığı:10'],
  ['Kuru Erik', 'kuru erik|erik kurusu', 'meyve', 240, 2.2, 64, 0.4, '1 adet:10;5 adet:50'],

  // ───────── Kuruyemiş ─────────
  ['Badem', 'badem|almond', 'kuruyemis', 579, 21, 22, 50, '1 avuç:30;10 adet:12;1 adet:1.2'],
  ['Ceviz', 'ceviz|walnut', 'kuruyemis', 654, 15, 14, 65, '1 avuç:30;1 adet (içi):5;3 adet (içi):15'],
  ['Fındık', 'findik|hazelnut', 'kuruyemis', 628, 15, 17, 61, '1 avuç:30;10 adet:15'],
  ['Antep Fıstığı', 'antep fistigi|fıstık', 'kuruyemis', 560, 20, 28, 45, '1 avuç:30;10 adet:10'],
  ['Kaju', 'kaju|cashew', 'kuruyemis', 553, 18, 30, 44, '1 avuç:30;10 adet:15'],
  ['Yer Fıstığı (kavrulmuş)', 'yer fıstığı|fıstık|peanut', 'kuruyemis', 585, 24, 21, 49, '1 avuç:30;10 adet:10'],
  ['Ay Çekirdeği (içi)', 'çekirdek|ay çekirdeği', 'kuruyemis', 584, 21, 20, 51, '1 avuç:30;1 yemek kaşığı:10'],
  ['Kabak Çekirdeği', 'çekirdek|kabak çekirdeği', 'kuruyemis', 559, 30, 11, 49, '1 avuç:30;1 yemek kaşığı:10'],
  ['Karışık Kuruyemiş', 'kuruyemiş|karışık çerez|çerez', 'kuruyemis', 600, 18, 22, 50, '1 avuç:30;1 kase:60'],
  ['Susam', 'susam|sesame', 'kuruyemis', 573, 18, 23, 50, '1 çay kaşığı:3;1 yemek kaşığı:9'],
  ['Chia Tohumu', 'chia', 'kuruyemis', 486, 17, 42, 31, '1 yemek kaşığı:12'],
  ['Keten Tohumu', 'keten|flax', 'kuruyemis', 534, 18, 29, 42, '1 yemek kaşığı:10'],
  ['Kestane (kavrulmuş)', 'kestane|kestane kebabı', 'kuruyemis', 245, 3.2, 53, 2.2, '1 adet:15;5 adet:75'],
  ['Hindistan Cevizi (rendelenmiş)', 'hindistan cevizi|coconut', 'kuruyemis', 660, 6.9, 24, 65, '1 yemek kaşığı:7'],

  // ───────── Süt ürünleri ─────────
  ['Süt (tam yağlı)', 'süt|sut', 'sut', 61, 3.2, 4.8, 3.3, '1 su bardağı:200;1 büyük bardak:250', 'ml'],
  ['Süt (yarım yağlı)', 'süt|sut|yarım yağlı', 'sut', 46, 3.4, 4.9, 1.5, '1 su bardağı:200;1 büyük bardak:250', 'ml'],
  ['Süt (yağsız)', 'süt|sut|light süt', 'sut', 35, 3.4, 5, 0.1, '1 su bardağı:200;1 büyük bardak:250', 'ml'],
  ['Yoğurt (tam yağlı)', 'yogurt|yoğurt', 'sut', 62, 3.5, 4.7, 3.3, '1 kase:200;1 yemek kaşığı:25;1 küçük kase:150'],
  ['Yoğurt (yarım yağlı)', 'yogurt|yoğurt', 'sut', 48, 3.8, 5, 1.5, '1 kase:200;1 yemek kaşığı:25'],
  ['Süzme Yoğurt', 'yogurt|süzme', 'sut', 97, 9, 4, 5, '1 kase:150;1 yemek kaşığı:25'],
  ['Yunan Yoğurdu (yağsız)', 'greek yogurt|yoğurt', 'sut', 58, 10, 3.6, 0.4, '1 kase:170;1 küçük kase:120'],
  ['Light Yoğurt', 'yogurt|yoğurt|diyet yoğurt', 'sut', 38.5, 4, 5, 0.3, '1 kase:200'],
  ['Ayran', 'ayran', 'sut', 37, 1.9, 2.8, 2, '1 küçük bardak:200;1 büyük şişe:300;1 şişe:250', 'ml'],
  ['Kefir', 'kefir', 'sut', 54, 3.4, 4.5, 2.5, '1 su bardağı:200;1 şişe:250', 'ml'],
  ['Mozzarella', 'mozarella|pizza peyniri', 'sut', 295, 22, 2.2, 22, '1 dilim:25;1 porsiyon:50'],
  ['Parmesan', 'parmesan|rendelenmiş peynir', 'sut', 429, 38, 4, 29, '1 yemek kaşığı:5;1 porsiyon:20'],
  ['Dil Peyniri', 'dil|çubuk peynir', 'sut', 295, 20, 2, 23, '1 adet:20;2 adet:40'],
  ['Eritme Peynir (üçgen)', 'üçgen peynir|eritme|süzme', 'sut', 248, 11, 6, 20, '1 adet:17;3 adet:51'],
  ['Hafif Beyaz Peynir', 'light peynir|beyaz peynir|diyet peynir', 'sut', 187, 20, 2, 11, '1 dilim:30;1 porsiyon:50'],
  ['Hellim', 'hellim|halloumi', 'sut', 321, 22, 2, 25, '1 dilim:30;2 dilim:60'],
  ['Krema (sıvı)', 'krema|süt kreması', 'sut', 344, 2, 3, 36, '1 yemek kaşığı:15;1 paket:200', 'ml'],
  ['Süt Tozu', 'süt tozu|sut tozu', 'sut', 499, 26, 38, 27, '1 yemek kaşığı:8;1 su bardağı:120'],
  ['Meyveli Yoğurt', 'meyveli yogurt|yoğurt', 'sut', 91, 3.2, 15, 2, '1 kase:150;1 kap:170'],
  ['Kakaolu Süt', 'çikolatalı süt|sütlü kakao', 'sut', 80, 3.3, 11, 2.5, '1 kutu:200;1 şişe:250', 'ml'],
  ['Süzme Peynir (light)', 'cottage|süzme|peynir', 'sut', 98, 11, 3.5, 4, '1 kase:100;1 yemek kaşığı:25'],
  ['Laktozsuz Süt', 'laktozsuz süt|süt', 'sut', 47, 3.3, 4.8, 1.8, '1 su bardağı:200;1 büyük bardak:250', 'ml'],

  // ───────── Tatlılar ─────────
  ['Baklava', 'baklava|fıstıklı baklava|cevizli baklava', 'tatli', 440, 6, 50, 24, '1 dilim:50;4 dilim:200'],
  ['Künefe', 'kunefe|hatay künefesi', 'tatli', 350, 7, 40, 18, '1 porsiyon:150;1 büyük porsiyon:200'],
  ['Sütlaç', 'sutlac|fırın sütlaç', 'tatli', 129, 3.5, 22, 3, '1 kase:150;1 büyük kase:200'],
  ['Kazandibi', 'kazandibi', 'tatli', 150.5, 3.5, 24, 4.5, '1 porsiyon:150'],
  ['Muhallebi', 'muhallebi', 'tatli', 116, 3.2, 19, 3, '1 kase:150'],
  ['Aşure', 'asure|noah pudding', 'tatli', 174.5, 3, 35, 2.5, '1 kase:200'],
  ['Revani', 'revani', 'tatli', 335, 4, 55, 11, '1 dilim:80;2 dilim:160'],
  ['Şekerpare', 'sekerpare', 'tatli', 384, 4, 56, 16, '1 adet:50;2 adet:100'],
  ['Lokum', 'lokum|turkish delight', 'tatli', 350, 0.5, 86, 0.5, '1 adet:15;3 adet:45'],
  ['Tulumba', 'tulumba', 'tatli', 427, 4, 60, 19, '1 adet:25;5 adet:125'],
  ['Lokma', 'lokma tatlısı', 'tatli', 382, 5, 50, 18, '1 adet:25;5 adet:125'],
  ['Profiterol', 'profiterol', 'tatli', 302, 5, 30, 18, '1 porsiyon:150'],
  ['Tiramisu', 'tiramisu', 'tatli', 277, 5, 26, 17, '1 porsiyon:120'],
  ['Cheesecake', 'cheese cake|çizkek', 'tatli', 326, 6, 26, 22, '1 dilim:120'],
  ['Trileçe', 'trilece|tres leches', 'tatli', 191, 4, 28, 7, '1 porsiyon:150'],
  ['Kemalpaşa Tatlısı', 'kemalpasa', 'tatli', 279, 4, 50, 7, '1 adet:60;2 adet:120'],
  ['İrmik Helvası', 'irmik helva|helva', 'tatli', 304, 3, 46, 12, '1 porsiyon:100;1 yemek kaşığı:25'],
  ['Tahin Helvası', 'tahin helva|helva', 'tatli', 518, 12, 50, 30, '1 dilim:30;1 porsiyon:50'],
  ['Dondurma (vanilya)', 'dondurma|ice cream', 'tatli', 209, 3.5, 24, 11, '1 top:60;2 top:120;1 külah:100'],
  ['Maraş Dondurması', 'dondurma|kahramanmaraş', 'tatli', 191, 4, 28, 7, '1 top:60;2 top:120'],
  ['Sütlü Çikolata', 'çikolata|cikolata', 'tatli', 537, 7.7, 59, 30, '1 kare:6;1 tablet:80;1 küçük tablet:30'],
  ['Bitter Çikolata (%70)', 'çikolata|bitter|dark chocolate', 'tatli', 602, 7.8, 46, 43, '1 kare:6;1 tablet:80;3 kare:18'],
  ['Gofret', 'çikolatalı gofret|gofret', 'tatli', 506, 6, 62, 26, '1 adet:35;1 küçük adet:20'],
  ['Çikolatalı Bisküvi', 'bisküvi|biskuvi|çikolatalı', 'tatli', 494, 6, 68, 22, '1 adet:15;3 adet:45'],
  ['Jelibon', 'jelibon|gummy|şekerleme', 'tatli', 340, 5, 80, 0, '1 avuç:30;10 adet:30'],
  ['Brownie', 'brownie', 'tatli', 409, 5, 50, 21, '1 dilim:60;2 dilim:120'],
  ['Yaş Pasta', 'pasta|yaş pasta|doğum günü pastası', 'tatli', 331, 4, 45, 15, '1 dilim:100;1 küçük dilim:70'],
  ['Sütlü Nuriye', 'nuriye|sütlü tatlı', 'tatli', 351, 6, 48, 15, '1 porsiyon:100;1 dilim:60'],
  ['Ekmek Kadayıfı', 'ekmek kadayifi|kaymaklı kadayıf', 'tatli', 345, 3, 45, 17, '1 porsiyon:120;1 dilim:80'],
  ['Kabak Tatlısı', 'kabak tatli|balkabağı tatlısı', 'tatli', 157, 1, 36, 1, '1 porsiyon:150;1 dilim:100'],
  ['Ayva Tatlısı', 'ayva|ayva tatli', 'tatli', 167.5, 0.5, 38, 1.5, '1 porsiyon:150'],
  ['Keşkül', 'keskul', 'tatli', 142, 4, 18, 6, '1 kase:150'],
  ['Supangle', 'sufle|çikolatalı supangle', 'tatli', 184, 4, 24, 8, '1 porsiyon:150'],
  ['Toz Şeker', 'seker|şeker', 'tatli', 400, 0, 100, 0, '1 çay kaşığı:5;1 yemek kaşığı:12;1 küp:4'],

  // ───────── İçecekler (100 ml başına) ─────────
  ['Su', 'su|içme suyu', 'icecek', 0, 0, 0, 0, '1 bardak:200;1 şişe (0,5 L):500', 'ml'],
  ['Soda', 'maden suyu|soda', 'icecek', 0, 0, 0, 0, '1 şişe:200;1 küçük şişe:200', 'ml'],
  ['Çay (şekersiz)', 'cay|siyah çay|demli', 'icecek', 1, 0, 0.3, 0, '1 ince belli bardak:100;1 büyük bardak:200', 'ml'],
  ['Şekerli Çay', 'cay|çay|1 şekerli', 'icecek', 16, 0, 4, 0, '1 ince belli bardak:100;1 büyük bardak:200', 'ml'],
  ['Türk Kahvesi (orta şekerli)', 'kahve|turk kahvesi', 'icecek', 25, 0.2, 6, 0, '1 fincan:60', 'ml'],
  ['Türk Kahvesi (şekersiz)', 'kahve|sade kahve', 'icecek', 2, 0.2, 0.3, 0, '1 fincan:60', 'ml'],
  ['Filtre Kahve', 'kahve|filtre|americano', 'icecek', 2, 0.1, 0.3, 0, '1 kupa:250;1 küçük:200', 'ml'],
  ['Latte', 'sütlü kahve|latte', 'icecek', 45, 2.8, 4.2, 1.9, '1 orta boy:300;1 büyük boy:400;1 küçük boy:240', 'ml'],
  ['Cappuccino', 'kapuçino|kapuccino', 'icecek', 41, 2.5, 4, 1.7, '1 orta boy:240;1 büyük boy:360', 'ml'],
  ['Nescafe 3\'ü 1 Arada', 'hazır kahve|3ü1 arada|3 ü 1 arada', 'icecek', 416, 5, 72, 12, '1 paket:18;1 fincan (1 paket):18'],
  ['Salep', 'salep', 'icecek', 87.5, 2.5, 16, 1.5, '1 bardak:250', 'ml'],
  ['Boza', 'boza', 'icecek', 72.5, 1, 16, 0.5, '1 bardak:250', 'ml'],
  ['Şalgam', 'salgam|şalgam suyu', 'icecek', 14, 0.5, 3, 0, '1 bardak:200', 'ml'],
  ['Taze Portakal Suyu', 'portakal suyu|meyve suyu', 'icecek', 46, 0.7, 10.4, 0.2, '1 bardak:200;1 büyük bardak:250', 'ml'],
  ['Elma Suyu', 'meyve suyu|elma suyu', 'icecek', 46.5, 0.1, 11.3, 0.1, '1 bardak:200;1 kutu:200', 'ml'],
  ['Vişne Suyu', 'meyve suyu|visne suyu', 'icecek', 54, 0.3, 13, 0.1, '1 bardak:200;1 kutu:200', 'ml'],
  ['Şeftali Nektarı', 'meyve suyu|şeftali suyu', 'icecek', 49, 0.3, 11.8, 0.1, '1 bardak:200;1 kutu:200', 'ml'],
  ['Kola', 'kola|coca cola|pepsi|gazlı içecek', 'icecek', 42, 0, 10.6, 0, '1 kutu:330;1 küçük şişe:250;1 şişe (1 L):1000', 'ml'],
  ['Gazoz', 'gazoz|meyveli gazoz|gazlı içecek', 'icecek', 40, 0, 10, 0, '1 şişe:250;1 kutu:330', 'ml'],
  ['Enerji İçeceği', 'redbull|enerji|monster', 'icecek', 45, 0.3, 11, 0, '1 kutu:250;1 büyük kutu:500', 'ml'],
  ['Buzlu Çay (şeftali)', 'ice tea|buzlu çay|soğuk çay', 'icecek', 30, 0, 7.5, 0, '1 kutu:330;1 şişe:500', 'ml'],
  ['Limonata', 'limonata', 'icecek', 40, 0, 10, 0, '1 bardak:250;1 şişe:330', 'ml'],
  ['Hindistan Cevizi Suyu', 'hindistan cevizi suyu|coconut water', 'icecek', 19.4, 0.7, 3.7, 0.2, '1 şişe:330;1 bardak:250', 'ml'],
  ['Meyveli Smoothie', 'smoothie|meyve karışımı', 'icecek', 60.5, 1, 13, 0.5, '1 bardak:250;1 büyük bardak:400', 'ml'],
  ['Sıcak Çikolata', 'sicak cikolata|hot chocolate', 'icecek', 86.5, 3, 13, 2.5, '1 kupa:250', 'ml'],
  ['Bitki Çayı', 'adaçayı|ıhlamur|bitki|papatya', 'icecek', 1, 0, 0.2, 0, '1 bardak:200', 'ml'],

  // ───────── Fast food ─────────
  ['Hamburger', 'burger|hamburger', 'fastfood', 247, 13, 24, 11, '1 adet:200;1 küçük adet:120'],
  ['Cheeseburger', 'burger|çizburger', 'fastfood', 269, 14, 24, 13, '1 adet:220'],
  ['Tavuk Burger', 'burger|tavuklu burger', 'fastfood', 238, 12, 25, 10, '1 adet:200'],
  ['Pizza (margarita)', 'pizza|margherita', 'fastfood', 266, 11, 33, 10, '1 dilim:110;3 dilim:330;1 küçük boy:300'],
  ['Pizza (karışık)', 'pizza|sucuklu pizza', 'fastfood', 276, 12, 30, 12, '1 dilim:110;3 dilim:330'],
  ['Soğan Halkası', 'onion rings|soğan', 'fastfood', 296, 4, 34, 16, '1 porsiyon:100;1 adet:15'],
  ['Tavuk Nugget', 'nugget|çıtır tavuk', 'fastfood', 290, 15, 17, 18, '1 adet:20;6 adet:120;9 adet:180'],
  ['Tavuk Tenders', 'tenders|çıtır tavuk', 'fastfood', 254, 18, 14, 14, '1 adet:40;3 adet:120'],
  ['Tavuk Dürüm', 'dürüm|durum|tavuk döner dürüm', 'fastfood', 207, 12, 24, 7, '1 adet:250;1 küçük adet:180'],
  ['Et Dürüm', 'dürüm|durum|döner dürüm', 'fastfood', 229, 13, 24, 9, '1 adet:250;1 küçük adet:180'],
  ['Tantuni', 'tantuni|mersin tantunisi', 'fastfood', 216, 14, 22, 8, '1 adet:150;1 büyük adet:220'],
  ['Tavuk Döner Ekmek Arası', 'döner|tavuk döner|ekmek arası', 'fastfood', 203, 13, 22, 7, '1 adet:200;1 yarım ekmek:140'],
  ['Et Döner Ekmek Arası', 'döner|et döner|ekmek arası', 'fastfood', 239, 13, 22, 11, '1 adet:200;1 yarım ekmek:140'],
  ['Köfte Ekmek', 'kofte ekmek|ekmek arası köfte', 'fastfood', 247, 13, 24, 11, '1 adet:220;1 yarım ekmek:150'],
  ['Balık Ekmek', 'balik ekmek|ekmek arası balık', 'fastfood', 200, 10, 22, 8, '1 adet:250'],
  ['Sosisli Sandviç', 'hot dog|sosisli', 'fastfood', 257, 10, 25, 13, '1 adet:150'],
  ['Kumpir', 'kumpir|fırın patates', 'fastfood', 133.5, 3.5, 22, 3.5, '1 adet:400;1 küçük adet:300'],
  ['Çiğ Köfte Dürüm', 'cig kofte durum|dürüm', 'fastfood', 184, 5, 32, 4, '1 adet:200;1 küçük adet:150'],
  ['Kızarmış Tavuk (panelenmiş)', 'kızartma tavuk|kfc|tavuk but', 'fastfood', 269, 19, 10, 17, '1 parça:120;2 parça:240'],
  ['Patates Cipsi', 'cips|patates cipsi|lays', 'fastfood', 536, 7, 53, 34, '1 küçük paket:30;1 paket:50;1 büyük paket:150'],
  ['Patlamış Mısır', 'popcorn|mısır', 'fastfood', 380, 12, 74, 4, '1 kase:30;1 büyük kova:80'],
  ['Mısır Cipsi', 'tortilla cips|nachos', 'fastfood', 502, 7, 60, 26, '1 avuç:30;1 paket:50'],
  ['Karışık Tost', 'tost|kaşar sucuk tost', 'fastfood', 283, 13, 24, 15, '1 adet:150;1 büyük adet:200'],
  ['Sucuklu Tost', 'tost|kaşarlı sucuklu tost', 'fastfood', 300, 14, 25, 16, '1 adet:150'],
  ['Ayvalık Tostu', 'tost|ayvalık', 'fastfood', 251, 12, 26, 11, '1 adet:180;1 büyük adet:240'],
  ['Tavuk Wrap', 'wrap|tavuklu wrap', 'fastfood', 197.5, 11, 26, 5.5, '1 adet:220'],
  ['Tavuk Şinitzel', 'schnitzel|şnitzel|pane', 'fastfood', 237, 18, 12, 13, '1 adet:120;1 porsiyon:180'],
  ['Suşi (somonlu)', 'sushi|maki', 'fastfood', 149.5, 6, 28, 1.5, '1 adet:30;6 adet:180;8 adet:240'],
  ['Ton Balıklı Sandviç', 'sandviç|ton sandviç', 'fastfood', 204, 11, 22, 8, '1 adet:180'],

  // ───────── Takviyeler ─────────
  ['Whey Protein (toz)', 'whey|protein tozu|protein', 'takviye', 398, 78, 8, 6, '1 ölçek:30;2 ölçek:60;1 yemek kaşığı:10'],
  ['Whey Protein İzolat (toz)', 'izolat|whey isolate|protein tozu', 'takviye', 373, 90, 1, 1, '1 ölçek:30;2 ölçek:60'],
  ['Kazein Protein (toz)', 'kazein|casein|protein tozu', 'takviye', 371, 80, 6, 3, '1 ölçek:35;2 ölçek:70'],
  ['Bitkisel Protein (toz)', 'pea protein|vegan protein|protein tozu', 'takviye', 395, 75, 8, 7, '1 ölçek:30;2 ölçek:60'],
  ['Protein Shake (whey + su)', 'shake|protein içeceği|whey', 'takviye', 40, 7.8, 0.8, 0.6, '1 shaker (300 ml):300;1 küçük shaker:200', 'ml'],
  ['Protein Shake (whey + süt)', 'shake|protein içeceği|whey', 'takviye', 98, 11.2, 5.1, 3.6, '1 shaker (280 ml):280;1 büyük shaker:400', 'ml'],
  ['Protein Bar', 'bar|protein barı', 'takviye', 392, 33, 38, 12, '1 adet:60;1 küçük adet:40'],
  ['Kilo Aldırıcı (gainer toz)', 'gainer|mass', 'takviye', 387, 20, 70, 3, '1 porsiyon:100;1 ölçek:50'],
  ['Enerji Jeli', 'energy gel|jel|karbonhidrat jeli', 'takviye', 260, 0, 65, 0, '1 paket:40'],
  ['Protein Puding', 'puding|protein pudding', 'takviye', 99, 10, 8, 3, '1 kap:200;1 küçük kap:150'],
  ['Yüksek Proteinli Yoğurt', 'protein yoğurt|skyr', 'takviye', 64.5, 11, 4, 0.5, '1 kap:150;1 kase:200'],
];

/** Türkçe karakterleri sadeleştirip slug üretir: "Mercimek Çorbası" → "mercimek-corbasi". */
function slugify(s: string) {
  return s
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ç/g, 'c')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parsePortions(spec: string, unit: 'g' | 'ml'): FoodPortion[] {
  return spec.split(';').map((p) => {
    const i = p.lastIndexOf(':');
    const label = p.slice(0, i).trim();
    const grams = Number(p.slice(i + 1));
    // etikette zaten miktar belirtilmişse ("1 shaker (300 ml)", "100 g") tekrar yazma
    const hasAmount = /\d\s*(g|ml|L)\b/.test(label);
    if (hasAmount) return { label, grams };
    // etikette zaten parantez varsa tek parantez grubu kalsın: "1 porsiyon (2 yumurta)" → "1 porsiyon, 2 yumurta (120 g)"
    const m = label.match(/^(.*?)\s*\(([^)]*)\)$/);
    const base = m ? `${m[1]}, ${m[2]}` : label;
    return { label: `${base} (${grams} ${unit})`.replace('.', ','), grams };
  });
}

export const FOODS_TR: FoodTr[] = ROWS.map(([name, aliases, category, kcal, protein, carbs, fat, portions, ml]) => {
  const unit = ml === 'ml' ? 'ml' : 'g';
  return {
    id: slugify(name),
    name,
    nameEn: FOOD_NAMES_EN[slugify(name)] ?? name,
    aliases: aliases.split('|').filter(Boolean),
    category,
    unit,
    kcal,
    protein,
    carbs,
    fat,
    portions: parsePortions(portions, unit),
  };
});
