/**
 * Egzersiz rehberi görselleri ve talimatları.
 * Kaynak: free-exercise-db (https://github.com/yuhonas/free-exercise-db, Unlicense / kamu malı).
 * Bu dosya scripte üretildi; slug -> [başlangıç, bitiş] görselleri + Türkçe talimatlar (İngilizce kaynaktan çevrildi).
 */
export type ExerciseMedia = {
  images: [number, number];
  instructions: string[];
  primary: string[];
  secondary: string[];
};

export const EXERCISE_MEDIA: Record<string, ExerciseMedia> = {
  "bench": {
    images: [require('../../assets/exercises/bench-0.jpg'), require('../../assets/exercises/bench-1.jpg')],
    instructions: ["Düz bankta sırtüstü uzan. Kolların orta genişlikte (dirsekler 90 derece olacak şekilde) tut, barı raftan al ve kollarını kilitleyerek göğsünün üstünde tut.","Nefes alarak barı yavaşça göğsünün ortasına indir.","Kısa bir duraksamadan sonra nefes vererek barı göğüs kaslarınla yukarı it. Üstte göğsünü sık, bir saniye bekle. İpucu: inişi çıkıştan yaklaşık iki kat yavaş yap.","İstediğin tekrar sayısını tamamla.","Bitirince barı rafa geri koy."],
    primary: ["chest"],
    secondary: ["shoulders","triceps"],
  },
  "incline-bench": {
    images: [require('../../assets/exercises/incline-bench-0.jpg'), require('../../assets/exercises/incline-bench-1.jpg')],
    instructions: ["Eğimli bankta sırtüstü uzan. Orta genişlikte tutuşla barı raftan al ve kollarını kilitleyerek üstünde tut.","Nefes alarak barı yavaşça üst göğsüne indir.","Kısa bir duraksamadan sonra nefes vererek barı göğüs kaslarınla yukarı it. Üstte göğsünü sık, bir saniye bekle. İpucu: iniş, çıkıştan en az iki kat yavaş olsun.","İstediğin tekrar sayısını tamamla.","Bitirince barı rafa geri koy."],
    primary: ["chest"],
    secondary: ["shoulders","triceps"],
  },
  "db-bench": {
    images: [require('../../assets/exercises/db-bench-0.jpg'), require('../../assets/exercises/db-bench-1.jpg')],
    instructions: ["Düz bankta otur, dambılları uyluklarının üstüne koy ve sırtüstü uzan.","Uyluklarından destek alarak dambılları tek tek kaldır ve omuz genişliğinde önünde tut. Avuç içleri ileri baksın, dambıllar göğsünün iki yanında, dirsekler yaklaşık 90 derece olsun. Bu başlangıç pozisyonu.","Nefes vererek dambılları göğsünle yukarı it. Üstte kollarını kilitle, göğsünü sık, bir saniye bekle.","Yavaşça başlangıca in. İniş çıkıştan yaklaşık iki kat yavaş olsun.","İstediğin tekrar sayısını tamamla."],
    primary: ["chest"],
    secondary: ["shoulders","triceps"],
  },
  "incline-db": {
    images: [require('../../assets/exercises/incline-db-0.jpg'), require('../../assets/exercises/incline-db-1.jpg')],
    instructions: ["Eğimli bankta otur, dambılları uyluklarına koy ve geriye yaslan.","Uyluklarından destek alarak dambılları tek tek omuz hizasına kaldır. Bileklerini çevir, avuç içleri ileri baksın. Bu başlangıç pozisyonu.","Nefes vererek dambılları göğsünle yukarı it. Dambıllar üzerinde tam kontrolü kaybetme.","Üstte kolları kilitle, bir saniye bekle, sonra ağırlığı yavaşça indir. İniş çıkıştan yaklaşık iki kat yavaş olsun.","İstediğin tekrar sayısını tamamla.","Bitirince dambılları önce uyluklarına, sonra yere bırak. Bu en güvenli yoldur."],
    primary: ["chest"],
    secondary: ["shoulders","triceps"],
  },
  "db-fly": {
    images: [require('../../assets/exercises/db-fly-0.jpg'), require('../../assets/exercises/db-fly-1.jpg')],
    instructions: ["Düz bankta sırtüstü uzan, dambılları uyluklarına koy. Avuç içleri birbirine baksın.","Dambılları tek tek kaldırıp omuz genişliğinde önünde tut, kolları kilitlemeden hemen önce dur. Bu başlangıç pozisyonu.","Dirseklerini hafif bükük tutarak kollarını iki yana geniş bir yay çizerek aç, göğsünde gerilme hissedene kadar in. Nefes al. İpucu: hareket yalnızca omuz ekleminden olsun, dirsek açısı sabit kalsın.","Göğüs kaslarını sıkarak, nefes vererek aynı yayı izleyip başlangıca dön.","Üstte bir saniye bekle ve tekrarlara devam et."],
    primary: ["chest"],
    secondary: [],
  },
  "cable-fly": {
    images: [require('../../assets/exercises/cable-fly-0.jpg'), require('../../assets/exercises/cable-fly-1.jpg')],
    instructions: ["Makaraları yukarı konuma getir, direnci seç ve iki elinle birer kolu tut.","İki makaranın ortasındaki hayali çizginin önüne bir adım at, kollarını önünde birleştir. Gövden belden hafifçe öne eğik olsun. Bu başlangıç pozisyonu.","Dirsekleri hafif bükük tutarak kollarını iki yana geniş bir yay çizerek aç, göğsünde gerilme hisset. Nefes al. İpucu: kollar ve gövde sabit kalsın, hareket yalnızca omuzdan olsun.","Nefes vererek aynı yayı izleyip başlangıca dön.","Bir saniye bekle ve tekrarlara devam et."],
    primary: ["chest"],
    secondary: ["shoulders"],
  },
  "chest-press": {
    images: [require('../../assets/exercises/chest-press-0.jpg'), require('../../assets/exercises/chest-press-1.jpg')],
    instructions: ["Göğüs press makinesine otur ve ağırlığı seç.","Varsa pedala basarak kolları öne getir, kolları tamamen uzatıp tutamakları kavra.","Avuç içleri aşağı bakacak şekilde tut, dirsekler omuz hizasında, üst kollar yere paralel olsun. Bu başlangıç pozisyonu.","Nefes alarak tutamakları kendine doğru getir.","Nefes vererek göğsünü sıkıp tutamakları ileri it. Bir saniye bekle, sonra başlangıca dön.","İstediğin tekrar sayısını tamamla.","Bitirince pedala tekrar basıp tutamakları yavaşça yerine bırak."],
    primary: ["chest"],
    secondary: ["shoulders","triceps"],
  },
  "pec-deck": {
    images: [require('../../assets/exercises/pec-deck-0.jpg'), require('../../assets/exercises/pec-deck-1.jpg')],
    instructions: ["Makineye otur, sırtın pede tamamen yaslansın.","Tutamakları kavra. İpucu: üst kolların yere paralel olması için makineyi ayarla. Bu başlangıç pozisyonu.","Nefes vererek tutamakları yavaşça ortada birleştir, göğsünü sık ve bir saniye bekle.","Nefes alarak göğüs kasların tamamen gerilene kadar yavaşça başlangıca dön.","İstediğin tekrar sayısını tamamla."],
    primary: ["chest"],
    secondary: [],
  },
  "pushup": {
    images: [require('../../assets/exercises/pushup-0.jpg'), require('../../assets/exercises/pushup-1.jpg')],
    instructions: ["Yüzüstü yere uzan, ellerini omuzlardan biraz geniş aç ve kollarını uzatıp gövdeni kaldır.","Nefes alarak göğsün yere neredeyse değene kadar in.","Nefes vererek göğsünü sıkıp başlangıç pozisyonuna it.","Üstte kısa bir duraksamadan sonra tekrarlara devam et. Vücudun baştan ayağa düz kalsın."],
    primary: ["chest"],
    secondary: ["shoulders","triceps"],
  },
  "dips": {
    images: [require('../../assets/exercises/dips-0.jpg'), require('../../assets/exercises/dips-1.jpg')],
    instructions: ["Paralel bara ihtiyacın var. Kolların kilitli halde bara tutunup vücudunu havada tut.","Nefes alarak gövden yaklaşık 30 derece öne eğik, dirsekler hafif açık şekilde yavaşça in. Göğsünde hafif bir gerilme hissedene kadar devam et.","Nefes vererek göğsünle kendini başlangıca it. İpucu: üstte göğsünü bir saniye sık.","İstediğin tekrar sayısını tamamla."],
    primary: ["chest"],
    secondary: ["shoulders","triceps"],
  },
  "deadlift": {
    images: [require('../../assets/exercises/deadlift-0.jpg'), require('../../assets/exercises/deadlift-1.jpg')],
    instructions: ["Yüklü barın önünde dur.","Sırtını mümkün olduğunca düz tutarak dizlerini bük, öne eğil ve barı omuz genişliğinde, avuç içleri aşağı bakacak şekilde kavra. Bu başlangıç pozisyonu. İpucu: tutuş zorlanırsa bir elini ters çevir veya kayış kullan.","Nefes vererek bacaklarınla iterek gövdeni dikleştir. Üstte göğsünü dışarı ver ve kürek kemiklerini geriye sık; dimdik dur.","Dizlerini bükerken gövdeni sırt düz kalacak şekilde öne eğerek barı indir. Plakalar yere değince başlangıçtasın.","Programdaki tekrar sayısını tamamla."],
    primary: ["lower back"],
    secondary: ["calves","forearms","glutes","hamstrings","lats","middle back","quadriceps","traps"],
  },
  "bb-row": {
    images: [require('../../assets/exercises/bb-row-0.jpg'), require('../../assets/exercises/bb-row-1.jpg')],
    instructions: ["Barı avuç içleri aşağı bakacak şekilde tut, dizlerini hafif bük ve sırtını düz tutarak belden öne eğil; gövden neredeyse yere paralel olsun. Başın yukarıda kalsın. Bar önünde, kollar sarkık dursun. Bu başlangıç pozisyonu.","Gövdeni sabit tutarak nefes ver ve barı karnına doğru çek. Dirsekler vücuda yakın kalsın. Üstte sırt kaslarını sık ve kısaca bekle.","Nefes alarak barı yavaşça başlangıca indir.","İstediğin tekrar sayısını tamamla."],
    primary: ["middle back"],
    secondary: ["biceps","lats","shoulders"],
  },
  "db-row": {
    images: [require('../../assets/exercises/db-row-0.jpg'), require('../../assets/exercises/db-row-1.jpg')],
    instructions: ["Düz bir bank seç, yanına dambılları koy.","Sağ dizini bankın ucuna koy, gövdeni belden yere paralel olacak kadar öne eğ ve sağ elini bankın diğer ucuna dayayarak dengelen.","Sol elinle yerdeki dambılı al. Avuç içi gövdene baksın, belin düz kalsın. Bu başlangıç pozisyonu.","Nefes vererek dambılı düz yukarı, göğsünün yan tarafına çek. Üst kol vücuda yakın, gövde sabit olsun. Üstte sırt kaslarını sık. Çekmeyi kollarla değil sırtınla yap.","Nefes alarak dambılı düz aşağı, başlangıca indir.","İstediğin tekrar sayısını tamamla.","Taraf değiştirip diğer kolla tekrarla."],
    primary: ["middle back"],
    secondary: ["biceps","lats","shoulders"],
  },
  "pullup": {
    images: [require('../../assets/exercises/pullup-0.jpg'), require('../../assets/exercises/pullup-1.jpg')],
    instructions: ["Barı, avuç içleri ileri bakacak şekilde seçtiğin genişlikte kavra. Geniş tutuş omuzdan geniş, orta tutuş omuz genişliğinde, dar tutuş omuzdan dardır.","Kollar uzanmış halde gövdeni yaklaşık 30 derece geriye yatır, belini hafif kavisle ve göğsünü dışarı ver. Bu başlangıç pozisyonu.","Omuzlarını ve üst kollarını aşağı-geriye çekerek bar üst göğsüne değene kadar yüksel. Nefes ver. İpucu: üstte sırt kaslarını sık; gövde sabit kalsın, ön kollar yalnızca barı tutsun.","Üstte bir saniye bekle, nefes alarak kollar tamamen uzanıp kanat kasların gerilene kadar yavaşça in.","İstediğin tekrar sayısını tamamla."],
    primary: ["lats"],
    secondary: ["biceps","middle back"],
  },
  "chinup": {
    images: [require('../../assets/exercises/chinup-0.jpg'), require('../../assets/exercises/chinup-1.jpg')],
    instructions: ["Barı avuç içleri sana bakacak şekilde, omuz genişliğinden dar bir tutuşla kavra.","Kollar uzanmış halde gövdeni mümkün olduğunca dik tut, belini hafif kavisle ve göğsünü dışarı ver. Bu başlangıç pozisyonu. İpucu: dik gövde pazı kasını daha çok çalıştırır, sırtı daha az.","Nefes vererek başın bar hizasına gelene kadar yüksel. Hareketi pazı kaslarınla yap, dirsekler vücuda yakın kalsın.","Üstte pazını bir saniye sık, sonra nefes alarak kollar tamamen uzanana kadar yavaşça in.","İstediğin tekrar sayısını tamamla."],
    primary: ["lats"],
    secondary: ["biceps","forearms","middle back"],
  },
  "lat-pulldown": {
    images: [require('../../assets/exercises/lat-pulldown-0.jpg'), require('../../assets/exercises/lat-pulldown-1.jpg')],
    instructions: ["Üst makaraya geniş bar takılı makineye otur. Dizlik pedini boyuna göre ayarla; vücudunun yukarı kalkmasını engeller.","Barı avuç içleri ileri bakacak şekilde seçtiğin genişlikte kavra (geniş: omuzdan geniş, orta: omuz genişliği, dar: omuzdan dar).","Kollar uzanmış halde gövdeni yaklaşık 30 derece geriye yatır, belini hafif kavisle ve göğsünü dışarı ver. Bu başlangıç pozisyonu.","Nefes vererek omuzlarını ve üst kollarını aşağı-geriye çekip barı üst göğsüne indir. İpucu: sırt kaslarını sık; gövde sabit kalsın, ön kollar yalnızca barı tutsun.","Bir saniye bekleyip kürek kemiklerini sık, sonra nefes alarak barı kollar tamamen uzanıp kanatlar gerilene kadar yavaşça yukarı bırak.","İstediğin tekrar sayısını tamamla."],
    primary: ["lats"],
    secondary: ["biceps","middle back","shoulders"],
  },
  "seated-row": {
    images: [require('../../assets/exercises/seated-row-0.jpg'), require('../../assets/exercises/seated-row-1.jpg')],
    instructions: ["V tutamaklı alt makara kürek makinesine otur, ayaklarını platforma koy; dizler hafif bükük, kilitli olmasın.","Sırtının doğal duruşunu koruyarak öne uzan ve tutamakları kavra.","Kollar uzanmış halde, gövdeni bacaklarınla 90 derece olana kadar geriye çek. Sırtın hafif kavisli, göğsün dışarıda olsun; kanatlarında güzel bir gerilme hissetmelisin. Bu başlangıç pozisyonu.","Gövdeni sabit tutup kolları vücuda yakın tutarak tutamakları karnına dokunana kadar çek. Nefes ver ve sırt kaslarını sert sık. Bir saniye bekle.","Nefes alarak yavaşça başlangıca dön.","İstediğin tekrar sayısını tamamla."],
    primary: ["middle back"],
    secondary: ["biceps","lats","shoulders"],
  },
  "tbar-row": {
    images: [require('../../assets/exercises/tbar-row-0.jpg'), require('../../assets/exercises/tbar-row-1.jpg')],
    instructions: ["Barın bir ucunu köşeye veya landmine aparatına sabitle, ucuna uygun ağırlığı tak.","Barın üstünde dur, çift tutamağı barın yakasının yanına geçir. Kalça ve bacaklarınla ayağa kalk.","Ayaklar geniş, kalça geride, göğüs yukarıda dur; kollar uzanmış olsun. Bu başlangıç pozisyonu.","Kürek kemiklerini geri çekip dirsekleri bükerek ağırlığı üst karnına çek. Ağırlığı sallayarak kaldırma.","Kısa bir duraksamadan sonra başlangıca dön."],
    primary: ["middle back"],
    secondary: ["biceps","lats"],
  },
  "machine-row": {
    images: [require('../../assets/exercises/machine-row-0.jpg'), require('../../assets/exercises/machine-row-1.jpg')],
    instructions: ["Ağırlığı pimle seç, koltuğu tutamaklar göğüs hizasında olacak şekilde ayarla. Tutamakları nötr veya avuç içi aşağı tutuşla kavra. Bu başlangıç pozisyonu.","Kürek kemiklerini geri çekip dirsekleri bükerek tutamakları gövdene doğru çek.","Hareketin sonunda dur, sonra tutamakları yavaşça başlangıca bırak. Tekrarlarda ağırlığı tamamen dinlendirme; kaslarda gerilim kalsın."],
    primary: ["lats"],
    secondary: ["biceps","middle back"],
  },
  "straight-pulldown": {
    images: [require('../../assets/exercises/straight-pulldown-0.jpg'), require('../../assets/exercises/straight-pulldown-1.jpg')],
    instructions: ["Üst makaradaki geniş barı, omuzdan geniş ve avuç içleri aşağı bakacak şekilde kavra. İki adım kadar geriye çekil.","Gövdeni belden yaklaşık 30 derece öne eğ, kollar önünde tamamen uzanmış ve dirsekler hafif bükük olsun. Kollar tam uzanmıyorsa biraz daha geri çekil. Kanat kaslarını sık; hazırsın.","Kolları düz tutarak, kanat kaslarını kasıp barı uyluklarının yanına kadar indir. Nefes ver.","Kolları düz tutarak nefes alıp başlangıca dön.","İstediğin tekrar sayısını tamamla."],
    primary: ["lats"],
    secondary: [],
  },
  "back-ext": {
    images: [require('../../assets/exercises/back-ext-0.jpg'), require('../../assets/exercises/back-ext-1.jpg')],
    instructions: ["Hiperekstansiyon bankına yüzüstü uzan, ayak bileklerini pedlerin altına sağlam yerleştir.","Üst pedi uyluklarının üst kısmı geniş pede yaslanacak, belden rahatça eğilebilecek şekilde ayarla.","Vücudun düz halde kollarını göğsünde çapraz yap veya başının arkasına koy. Bu başlangıç pozisyonu. İpucu: ekstra yük için göğsünün önünde plaka tutabilirsin.","Sırtını düz tutarak belden yavaşça öne eğil, nefes al. Arka bacağında gerilme hissedene ve sırt yuvarlanmadan gidebildiğin yere kadar in. Asla sırtını yuvarlama.","Nefes alarak gövdeni yavaşça başlangıca kaldır. Düz çizgiyi geçip belini aşırı kavislendirme; gövdeyi sallama.","İstediğin tekrar sayısını tamamla."],
    primary: ["lower back"],
    secondary: ["glutes","hamstrings"],
  },
  "ohp": {
    images: [require('../../assets/exercises/ohp-0.jpg'), require('../../assets/exercises/ohp-1.jpg')],
    instructions: ["Barı göğüs hizasında bir squat rafına yerleştir, ağırlığı yükle ve omuzdan geniş, avuç içleri ileri bakacak şekilde kavra.","Dizlerini hafif bükerek barı köprücük kemiğine yasla, göğsünün üstünde kaldır. Bir adım geri çekil ve ayaklarını omuz genişliğinde aç.","Barı kollarını kilitleyerek başının üstüne kaldır; başlangıçta omuz hizasında ve başın hafif önünde tut.","Nefes alarak barı yavaşça köprücük kemiğine indir.","Nefes vererek barı tekrar yukarı it.","İstediğin tekrar sayısını tamamla."],
    primary: ["shoulders"],
    secondary: ["triceps"],
  },
  "db-shoulder": {
    images: [require('../../assets/exercises/db-shoulder-0.jpg'), require('../../assets/exercises/db-shoulder-1.jpg')],
    instructions: ["Sırt destekli bir bankta otur, dambılları uyluklarının üstüne dik şekilde koy.","Uyluklarından destek alarak dambılları tek tek omuz hizasına kaldır.","Bileklerini çevir, avuç içleri ileri baksın. Bu başlangıç pozisyonu.","Nefes vererek dambılları üstte birbirine değene kadar yukarı it.","Üstte kısaca bekle, sonra nefes alarak yavaşça başlangıca indir.","İstediğin tekrar sayısını tamamla."],
    primary: ["shoulders"],
    secondary: ["triceps"],
  },
  "lateral": {
    images: [require('../../assets/exercises/lateral-0.jpg'), require('../../assets/exercises/lateral-1.jpg')],
    instructions: ["Dambılları al, dimdik dur; dambıllar yanlarında kollar uzanmış, avuç içleri sana baksın. Bu başlangıç pozisyonu.","Gövdeni sallamadan dambılları dirsekler hafif bükük şekilde yanlara kaldır; eller hafif öne eğik, sanki bardağa su döküyormuş gibi. Kollar yere paralel olunca dur. Nefes ver ve bir saniye bekle.","Nefes alarak dambılları yavaşça başlangıca indir.","İstediğin tekrar sayısını tamamla."],
    primary: ["shoulders"],
    secondary: [],
  },
  "cable-lateral": {
    images: [require('../../assets/exercises/cable-lateral-0.jpg'), require('../../assets/exercises/cable-lateral-1.jpg')],
    instructions: ["Alt makaranın sağ yanında dur. Sol elinle vücudunun önünden geçip makaradaki tek tutamağı avuç içi aşağı bakacak şekilde kavra. Sağ elinle makineden tutunup dengelen.","Sırtın dik, ayakların omuz genişliğinde olsun. Bu başlangıç pozisyonu.","Nefes vererek sol kolunu vücudunun önünden omuz hizasına kadar yana kaldır.","Üstte bir saniye kasılmayı hisset, sonra nefes alarak tutamağı yavaşça başlangıca bırak.","İstediğin tekrar sayısını tamamla.","Kol değiştirip aynısını yap."],
    primary: ["shoulders"],
    secondary: ["forearms"],
  },
  "front-raise": {
    images: [require('../../assets/exercises/front-raise-0.jpg'), require('../../assets/exercises/front-raise-1.jpg')],
    instructions: ["Dambılları al, dimdik dur; dambıllar uyluklarının önünde, kollar uzanmış ve avuç içleri uyluklarına baksın. Bu başlangıç pozisyonu.","Gövdeni sallamadan sol dambılı dirseği hafif bükük, avuç içi hep aşağı bakacak şekilde öne kaldır; kol yere hafif paralelin üstüne gelince dur. Nefes ver ve bir saniye bekle.","Dambılı yavaşça indirirken aynı anda sağ dambılı kaldır.","İstediğin tekrar sayısı tamamlanana kadar kolları sırayla değiştir."],
    primary: ["shoulders"],
    secondary: [],
  },
  "rear-delt": {
    images: [require('../../assets/exercises/rear-delt-0.jpg'), require('../../assets/exercises/rear-delt-1.jpg')],
    instructions: ["Eğimli bankta göğsün ve karnın bankta olacak şekilde yüzüstü yat. Dambıllar ellerinde, avuç içleri birbirine baksın.","Kolları bankın eğimine dik olacak şekilde aşağı uzat. Ayak parmak uçlarınla yere bas, bacaklar sabit kalsın. Bu başlangıç pozisyonu.","Dirsekleri hafif bükük tutarak dambılları nefes vererek yanlara doğru yay çizerek kaldır. İpucu: en iyi sonuç için kürek kemiklerini birbirine sık.","Kollar yere paralel olana kadar kaldır.","Kasılmayı hisset, sonra nefes alarak dambılları yavaşça başlangıca indir.","İstediğin tekrar sayısını tamamla."],
    primary: ["shoulders"],
    secondary: [],
  },
  "face-pull": {
    images: [require('../../assets/exercises/face-pull-0.jpg'), require('../../assets/exercises/face-pull-1.jpg')],
    instructions: ["Yüksek makaraya halat veya çift tutamak tak. Makaraya dönük dur.","Ağırlığı doğrudan yüzüne doğru çek ve çekerken ellerini iki yana aç. Üst kolların yere paralel kalsın.","Üstte kürek kemiklerini sık, sonra kontrollü şekilde başlangıca dön."],
    primary: ["shoulders"],
    secondary: ["middle back"],
  },
  "shrug": {
    images: [require('../../assets/exercises/shrug-0.jpg'), require('../../assets/exercises/shrug-1.jpg')],
    instructions: ["Her elinde bir dambıl, avuç içleri gövdene bakacak şekilde kollar yanlarda uzanmış halde dimdik dur.","Nefes vererek omuzlarını olabildiğince yukarı kaldır ve üstte bir saniye bekle. İpucu: kollar hep düz kalsın; pazı kullanma, yalnızca omuzlar hareket etsin.","Dambılları yavaşça başlangıca indir.","İstediğin tekrar sayısını tamamla."],
    primary: ["traps"],
    secondary: [],
  },
  "shoulder-press-m": {
    images: [require('../../assets/exercises/shoulder-press-m-0.jpg'), require('../../assets/exercises/shoulder-press-m-1.jpg')],
    instructions: ["Omuz press makinesine otur ve ağırlığı seç.","Tutamakları yanlarından kavra; dirsekler bükük ve gövdenle aynı hizada olsun. Bu başlangıç pozisyonu.","Nefes vererek kolları tamamen uzatana kadar tutamakları yukarı it. Üstte kasılmayı bir saniye tut.","Nefes alarak tutamakları yavaşça başlangıca indir.","İstediğin tekrar sayısını tamamla."],
    primary: ["shoulders"],
    secondary: ["triceps"],
  },
  "bb-curl": {
    images: [require('../../assets/exercises/bb-curl-0.jpg'), require('../../assets/exercises/bb-curl-1.jpg')],
    instructions: ["Gövdeni dik tut ve barı omuz genişliğinde, avuç içleri ileri bakacak şekilde tut. Dirsekler gövdene yakın olsun. Bu başlangıç pozisyonu.","Üst kolları sabit tutarak nefes ver ve pazı kasını sıkarak barı yukarı kıvır. İpucu: yalnızca ön kollar hareket etsin.","Pazılar tam kasılıp bar omuz hizasına gelene kadar devam et; bir saniye bekle ve pazıyı sert sık.","Nefes alarak barı yavaşça başlangıca indir.","İstediğin tekrar sayısını tamamla."],
    primary: ["biceps"],
    secondary: ["forearms"],
  },
  "db-curl": {
    images: [require('../../assets/exercises/db-curl-0.jpg'), require('../../assets/exercises/db-curl-1.jpg')],
    instructions: ["Her elinde bir dambıl, kollar yanlarda uzanmış halde dimdik dur. Dirsekler gövdene yakın, avuç içleri ileri baksın. Bu başlangıç pozisyonu.","Üst kolları sabit tutarak nefes ver ve pazılarını sıkarak dambılları kıvır. Pazılar tam kasılıp dambıllar omuz hizasına gelene kadar kaldır, kısaca bekle ve sık.","Nefes alarak dambılları yavaşça başlangıca indir.","İstediğin tekrar sayısını tamamla."],
    primary: ["biceps"],
    secondary: ["forearms"],
  },
  "hammer": {
    images: [require('../../assets/exercises/hammer-0.jpg'), require('../../assets/exercises/hammer-1.jpg')],
    instructions: ["Gövdeni dik tut, her elinde bir dambıl kollar uzanmış halde dur. Dirsekler gövdene yakın olsun.","Avuç içleri gövdene baksın. Bu başlangıç pozisyonu.","Üst kolu sabit tutarak nefes ver ve dambılı pazını sıkarak yukarı kıvır. Dambıl omuz hizasına gelince kısaca bekle ve sık. İpucu: dirsek sabit kalsın, yalnızca ön kol hareket etsin.","Kısa duraksamadan sonra nefes alarak dambılları yavaşça başlangıca indir.","İstediğin tekrar sayısını tamamla."],
    primary: ["biceps"],
    secondary: [],
  },
  "incline-curl": {
    images: [require('../../assets/exercises/incline-curl-0.jpg'), require('../../assets/exercises/incline-curl-1.jpg')],
    instructions: ["Eğimli bankta geriye yaslan, her elinde bir dambıl kollar sarkık halde tut. Dirsekler gövdene yakın, avuç içleri ileri baksın. Bu başlangıç pozisyonu.","Üst kolu sabit tutarak nefes ver ve dambılları pazını sıkarak kıvır; yalnızca ön kollar hareket etsin. Pazılar tam kasılıp dambıllar omuz hizasına gelince bir saniye bekle.","Nefes alarak dambılları yavaşça başlangıca indir.","İstediğin tekrar sayısını tamamla."],
    primary: ["biceps"],
    secondary: [],
  },
  "preacher": {
    images: [require('../../assets/exercises/preacher-0.jpg'), require('../../assets/exercises/preacher-1.jpg')],
    instructions: ["Preacher bankı ve EZ bar gerekir. EZ barı iç tutamaklardan kavra (barı birinin vermesi veya bankın ön desteğinden alman iyi olur). Avuç içleri ileri bakar, barın şekli yüzünden hafif içe dönük olur.","Üst kollarını ve göğsünü banka yasla, EZ barı omuz hizasında tut. Bu başlangıç pozisyonu.","Nefes alarak barı kol tamamen uzanıp pazı tam gerilene kadar yavaşça indir.","Nefes vererek pazınla barı omuz hizasına kadar kıvır. Pazıyı sert sık ve bir saniye bekle.","İstediğin tekrar sayısını tamamla."],
    primary: ["biceps"],
    secondary: [],
  },
  "cable-curl": {
    images: [require('../../assets/exercises/cable-curl-0.jpg'), require('../../assets/exercises/cable-curl-1.jpg')],
    instructions: ["Alt makaraya bağlı bar ile dimdik dur. Barı omuz genişliğinde, avuç içleri yukarı bakacak şekilde kavra; dirsekler gövdene yakın olsun. Bu başlangıç pozisyonu.","Üst kolları sabit tutarak nefes ver ve pazını sıkarak barı kıvır; yalnızca ön kollar hareket etsin. Pazı tam kasılıp bar omuz hizasına gelince bir saniye bekle.","Nefes alarak barı yavaşça başlangıca bırak.","İstediğin tekrar sayısını tamamla."],
    primary: ["biceps"],
    secondary: [],
  },
  "pushdown": {
    images: [require('../../assets/exercises/pushdown-0.jpg'), require('../../assets/exercises/pushdown-1.jpg')],
    instructions: ["Üst makaraya düz veya açılı bar tak ve omuz genişliğinde, avuç içleri aşağı bakacak şekilde kavra.","Gövdeni dik, hafif öne eğik tut; üst kollarını vücuduna yapıştır ve yere dik tut. Ön kollar makaraya doğru yukarı baksın. Bu başlangıç pozisyonu.","Arka kollarını (triceps) kullanarak barı uyluklarının önüne kadar indir; kollar tamamen uzansın. Üst kollar hep sabit kalsın, yalnızca ön kollar hareket etsin. Nefes ver.","Alt noktada bir saniye bekle, sonra nefes alarak barı yavaşça başlangıca çıkar.","İstediğin tekrar sayısını tamamla."],
    primary: ["triceps"],
    secondary: [],
  },
  "rope-pushdown": {
    images: [require('../../assets/exercises/rope-pushdown-0.jpg'), require('../../assets/exercises/rope-pushdown-1.jpg')],
    instructions: ["Üst makaraya halat tak ve avuç içleri birbirine bakacak şekilde (nötr tutuş) kavra.","Gövdeni dik, hafif öne eğik tut; üst kollarını vücuduna yapıştır ve yere dik tut. Ön kollar makaraya doğru yukarı baksın. Bu başlangıç pozisyonu.","Triceps ile halatı aşağı çek; halatın iki ucunu uyluklarının yanına getir. Hareketin sonunda kollar tamamen uzanmış olsun. Üst kollar sabit kalsın, yalnızca ön kollar hareket etsin. Nefes ver.","Alt noktada bir saniye bekle, sonra nefes alarak halatı yavaşça başlangıca çıkar.","İstediğin tekrar sayısını tamamla."],
    primary: ["triceps"],
    secondary: [],
  },
  "skullcrusher": {
    images: [require('../../assets/exercises/skullcrusher-0.jpg'), require('../../assets/exercises/skullcrusher-1.jpg')],
    instructions: ["Bankta uzan ve EZ barı dar tutuşla, dirsekler içeride olacak şekilde kaldır. Kollar yere dik olsun. Bu başlangıç pozisyonu.","Üst kolları sabit tutarak dirsekleri bükerek barı indir. Nefes al. Bar alnının tam üstüne gelince dur.","Nefes vererek dirsekleri açıp barı başlangıca geri kaldır.","Tekrarla."],
    primary: ["triceps"],
    secondary: ["forearms"],
  },
  "oh-ext": {
    images: [require('../../assets/exercises/oh-ext-0.jpg'), require('../../assets/exercises/oh-ext-1.jpg')],
    instructions: ["Ayakların omuz genişliğinde dur. Dambılı iki elinle tut ve kollar tamamen uzanana kadar başının üstüne kaldır.","Dambıl avuçlarında dursun, başparmakların dambılı sarsın, avuç içleri tavana baksın. Bu başlangıç pozisyonu.","Üst kolları başına yakın, dirsekleri içeride ve yere dik tutarak dambılı başının arkasına yarım daire çizerek, ön kolların pazılarına değene kadar indir. İpucu: yalnızca ön kollar hareket etsin. Nefes al.","Triceps ile dambılı yukarı kaldırarak başlangıca dön. Nefes ver.","İstediğin tekrar sayısını tamamla."],
    primary: ["triceps"],
    secondary: [],
  },
  "cgbp": {
    images: [require('../../assets/exercises/cgbp-0.jpg'), require('../../assets/exercises/cgbp-1.jpg')],
    instructions: ["Düz bankta sırtüstü uzan. Dar tutuşla (yaklaşık omuz genişliğinde) barı raftan al ve kollarını kilitleyerek üstünde tut. Bu başlangıç pozisyonu.","Nefes alarak barı yavaşça göğsünün ortasına indir. İpucu: normal bench press'ten farklı olarak dirsekler hep gövdene yakın kalsın; böylece triceps daha çok çalışır.","Bir saniye bekle, sonra nefes vererek barı triceps gücüyle yukarı it. Üstte kollarını kilitle, bir saniye bekle. İniş çıkıştan en az iki kat yavaş olsun.","İstediğin tekrar sayısını tamamla.","Bitirince barı rafa geri koy."],
    primary: ["triceps"],
    secondary: ["chest","shoulders"],
  },
  "kickback": {
    images: [require('../../assets/exercises/kickback-0.jpg'), require('../../assets/exercises/kickback-1.jpg')],
    instructions: ["Her elinde bir dambıl, avuç içleri gövdene bakacak şekilde dur. Dizlerini hafif bük ve belden öne eğil; gövden neredeyse yere paralel, sırtın düz, başın yukarıda olsun. Üst kollar gövdeye yakın ve yere paralel, ön kollar yere bakıyor, dirsek 90 derece. Bu başlangıç pozisyonu.","Üst kolları sabit tutarak nefes ver ve triceps ile kol tamamen uzanana kadar dambılları arkaya kaldır. Ön kolu hareket ettirmeye odaklan.","Üstte kısa bir duraksamadan sonra nefes alarak dambılları yavaşça başlangıca indir.","İstediğin tekrar sayısını tamamla."],
    primary: ["triceps"],
    secondary: [],
  },
  "squat": {
    images: [require('../../assets/exercises/squat-0.jpg'), require('../../assets/exercises/squat-1.jpg')],
    instructions: ["Güvenlik için squat rafında yap. Barı omuz hizasının hemen altına ayarla, yükle, altına gir ve barı ensenin biraz altında, omuzlarının arkasına yerleştir.","Barı iki elinle yanlardan tutup önce bacaklarınla iterek ve gövdeni dikleştirerek raftan kaldır.","Rafdan bir adım uzaklaş, ayaklarını omuz genişliğinde aç, parmak uçları hafif dışarı baksın. Başın hep yukarıda, sırtın düz olsun. Bu başlangıç pozisyonu.","Nefes alarak dizlerini ve kalçanı bükerek yavaşça çömel; duruşun dik, başın yukarıda kalsın. Uyluk ile baldır arasındaki açı 90 dereceden biraz az olana kadar in. İpucu: dizlerin ayak parmak uçlarını fazla geçmesin; geçerse dizine gereksiz yük bindirirsin.","Nefes vererek topuklarınla yere basıp bacaklarını açarak başlangıca kalk.","İstediğin tekrar sayısını tamamla."],
    primary: ["quadriceps"],
    secondary: ["calves","glutes","hamstrings","lower back"],
  },
  "front-squat": {
    images: [require('../../assets/exercises/front-squat-0.jpg'), require('../../assets/exercises/front-squat-1.jpg')],
    instructions: ["Güvenlik için squat rafında yap. Barı boyuna uygun yüksekliğe ayarla ve yükle. Kollarını barın altına sok, dirsekleri yüksek tut ve barı ön omuzlarına yasla; kollarını çaprazlayıp barı kavra.","Önce bacaklarınla iterek ve gövdeni dikleştirerek barı raftan kaldır.","Rafdan bir adım uzaklaş, ayaklarını omuz genişliğinde aç, parmak uçları hafif dışarı baksın. Başın yukarıda, sırtın düz olsun; aşağı bakmak dengeni bozar. Bu başlangıç pozisyonu.","Nefes alarak dizlerini bükerek yavaşça çömel; duruşun dik, başın yukarıda kalsın. Uyluklar yere paralelin altına inene kadar (açı 90 dereceden biraz az) devam et. İpucu: dizlerin ayak parmak uçlarını fazla geçmesin.","Nefes vererek ayağının ortasıyla yere basıp bacaklarını açarak başlangıca kalk.","İstediğin tekrar sayısını tamamla."],
    primary: ["quadriceps"],
    secondary: ["calves","glutes","hamstrings"],
  },
  "leg-press": {
    images: [require('../../assets/exercises/leg-press-0.jpg'), require('../../assets/exercises/leg-press-1.jpg')],
    instructions: ["Leg press makinesine otur, ayaklarını platforma omuz genişliğinde yerleştir.","Güvenlik kollarını indir ve platformu bacakların tamamen uzanana kadar it. Dizlerini kilitleme. Gövde ile bacaklar 90 derece açı yapsın. Bu başlangıç pozisyonu.","Nefes alarak platformu üst ve alt bacağın 90 derece açı yapana kadar yavaşça indir.","Nefes vererek esas olarak topuklarınla ve ön bacak kaslarınla iterek başlangıca dön.","İstediğin tekrar sayısını tamamla; işin bitince güvenlik pimlerini mutlaka kilitle. Yüklü platformun üstüne düşmesini istemezsin."],
    primary: ["quadriceps"],
    secondary: ["calves","glutes","hamstrings"],
  },
  "hack-squat": {
    images: [require('../../assets/exercises/hack-squat-0.jpg'), require('../../assets/exercises/hack-squat-1.jpg')],
    instructions: ["Sırtını makinenin sırt pedine yasla ve omuzlarını omuz pedlerinin altına yerleştir.","Ayaklarını platforma omuz genişliğinde, parmak uçları hafif dışarı bakacak şekilde koy. İpucu: başın hep yukarıda, sırtın pede yaslı olsun.","Ellerini yan tutamaklara koy ve güvenlik kollarını aç (çoğu makinede tutamakları öne bakar konumdan çapraza çevirerek).","Dizlerini kilitlemeden bacaklarını uzat. Bu başlangıç pozisyonu.","Nefes alarak dizlerini bükerek yavaşça in; baş yukarıda, sırt pede yaslı kalsın. Uyluk ile baldır arasındaki açı 90 dereceden biraz az olana kadar devam et. İpucu: dizlerin ayak parmak uçlarını fazla geçmesin.","Nefes vererek esas olarak topuklarınla iterek başlangıca dön.","İstediğin tekrar sayısını tamamla."],
    primary: ["quadriceps"],
    secondary: ["calves","glutes","hamstrings"],
  },
  "leg-ext": {
    images: [require('../../assets/exercises/leg-ext-0.jpg'), require('../../assets/exercises/leg-ext-1.jpg')],
    instructions: ["Leg extension makinesinde ağırlığı seç ve bacaklarını pedin altına, ayak uçların ileri bakacak şekilde yerleştir; elinle yan tutamakları kavra. Bu başlangıç pozisyonu. İpucu: ped ayak bileğinin hemen üstüne gelmeli, diz açısı 90 derece olmalı.","Ön bacak kaslarınla nefes vererek bacaklarını sonuna kadar uzat. Vücudun koltukta sabit kalsın. Üstte bir saniye bekle.","Nefes alarak ağırlığı yavaşça indir; 90 dereceyi geçme.","İstediğin tekrar sayısını tamamla."],
    primary: ["quadriceps"],
    secondary: [],
  },
  "leg-curl": {
    images: [require('../../assets/exercises/leg-curl-0.jpg'), require('../../assets/exercises/leg-curl-1.jpg')],
    instructions: ["Makine kolunu boyuna göre ayarla ve leg curl makinesine yüzüstü uzan; ped bacaklarının arkasında, baldırlarının biraz altında olsun. İpucu: mümkünse açılı makineyi tercih et; arka bacağı daha iyi çalıştırır.","Gövdeni bankta düz tut, bacaklarını tamamen uzat ve yan tutamakları kavra. Ayak uçların düz bakmalı. Bu başlangıç pozisyonu.","Nefes vererek üst bacaklarını pedden kaldırmadan bacaklarını olabildiğince kıvır. Tam kasılınca bir saniye bekle.","Nefes alarak başlangıca dön ve tekrarlara devam et."],
    primary: ["hamstrings"],
    secondary: [],
  },
  "rdl": {
    images: [require('../../assets/exercises/rdl-0.jpg'), require('../../assets/exercises/rdl-1.jpg')],
    instructions: ["Barı önünde yere koy ve omuzdan biraz geniş, avuç içleri aşağı bakacak şekilde kavra. İpucu: ağırlığa göre bilek bandı ve daha rahat hareket için yükseltilmiş platform gerekebilir.","Dizlerini hafif bük, kaval kemiklerin dik, kalçan geride, sırtın düz olsun. Bu başlangıç pozisyonu.","Sırtın ve kolların hep düz kalsın; nefes vererek kalçanla barı kaldır. İpucu: hareket hızlı değil, sabit ve kontrollü olsun.","Tamamen dikleşince kalçanı geriye iterek barı indir; dizlerin yalnızca hafif bükülsün (squat gibi çömelme). İpucu: başlangıçta derin nefes al, göğsün yukarıda kalsın, inerken nefesini tut, hareketin sonunda ver.","İstediğin tekrar sayısını tamamla."],
    primary: ["hamstrings"],
    secondary: ["calves","glutes","lower back"],
  },
  "bulgarian": {
    images: [require('../../assets/exercises/bulgarian-0.jpg'), require('../../assets/exercises/bulgarian-1.jpg')],
    instructions: ["Bir ayağın önde, arka ayağın bir banka yükseltilmiş şekilde dur.","Her elinde bir dambıl, kollar yanlarda sarkık. Bu başlangıç pozisyonu.","Dizini ve kalçanı bükerek aşağı in. Duruşun dik kalsın; ön dizin ayağınla aynı hizada olsun.","En altta topuğundan iterek diz ve kalçanı açıp başlangıca dön."],
    primary: ["quadriceps"],
    secondary: ["glutes","hamstrings"],
  },
  "lunge": {
    images: [require('../../assets/exercises/lunge-0.jpg'), require('../../assets/exercises/lunge-1.jpg')],
    instructions: ["Gövdeni dik tut, iki elinde birer dambıl yanlarında dur. Bu başlangıç pozisyonu.","Sağ ayağınla yaklaşık 60 cm öne adım at ve gövdeni dik tutup dengeni koruyarak çömel. Nefes al. Ön dizin ayak parmak uçlarını fazla geçmesin; ön kaval kemiğin yere dik kalsın.","Esas olarak topuğunla iterek nefes verip başlangıca dön.","İstediğin tekrar sayısını tamamla, sonra sol bacakla yap."],
    primary: ["quadriceps"],
    secondary: ["calves","glutes","hamstrings"],
  },
  "goblet": {
    images: [require('../../assets/exercises/goblet-0.jpg'), require('../../assets/exercises/goblet-1.jpg')],
    instructions: ["Hafif bir kettlebell'i kulplarından tutarak göğsüne yakın şekilde dur. Bu başlangıç pozisyonu.","Bacaklarının arasına doğru, arka bacakların baldırına değene kadar çömel. Göğsün ve başın yukarıda, sırtın düz olsun.","En altta dur ve dirseklerinle dizlerini dışarı it. Sonra başlangıca dön ve 10-20 tekrar yap."],
    primary: ["quadriceps"],
    secondary: ["calves","glutes","hamstrings","shoulders"],
  },
  "calf-raise": {
    images: [require('../../assets/exercises/calf-raise-0.jpg'), require('../../assets/exercises/calf-raise-1.jpg')],
    instructions: ["Baldır makinesinin pedli kolunu boyuna göre ayarla.","Omuzlarını pedlerin altına yerleştir, ayak uçların ileri baksın. Ayak tabanının ön kısmı blokta, topuklar boşta olsun. Kalçanı ve dizlerini açarak kolu yukarı kaldırıp gövdeni dikleştir. Dizlerin hafif bükük, asla kilitli olmasın. Bu başlangıç pozisyonu.","Nefes vererek ayak bileklerini uzatıp topuklarını olabildiğince yukarı kaldır ve baldırını sık. Diz sabit kalsın, hiç bükülmesin. Aşağı inmeden önce bir saniye bekle.","Nefes alarak topuklarını indirip baldırların gerilene kadar yavaşça başlangıca dön.","İstediğin tekrar sayısını tamamla."],
    primary: ["calves"],
    secondary: [],
  },
  "hip-thrust": {
    images: [require('../../assets/exercises/hip-thrust-0.jpg'), require('../../assets/exercises/hip-thrust-1.jpg')],
    instructions: ["Yere otur, arkanda bir bank olsun. Bacaklarının üstüne yüklü bir bar koy. Kalın bar veya bar pedi kullanmak rahatsızlığı çok azaltır.","Barı kalçanın tam üstüne getir ve kürek kemiklerin bankın üst kenarına gelecek şekilde geriye yaslan.","Ayaklarından iterek kalçanı bardan yukarı doğru dikey şekilde aç. Ağırlığı kürek kemiklerin ve ayakların taşır. Olabildiğince yukarı çık, sonra hareketi tersine çevirip başlangıca dön."],
    primary: ["glutes"],
    secondary: ["calves","hamstrings"],
  },
  "glute-bridge": {
    images: [require('../../assets/exercises/glute-bridge-0.jpg'), require('../../assets/exercises/glute-bridge-1.jpg')],
    instructions: ["Sırtüstü yere uzan, kollar yanlarında, dizlerin bükük ve ayakların omuz genişliğinde olsun. Bu başlangıç pozisyonu.","Esas olarak topuklarınla iterek sırtını düz tutup kalçanı yerden kaldır. Nefes ver ve üstte bir saniye bekle.","Nefes alarak yavaşça başlangıca dön."],
    primary: ["glutes"],
    secondary: ["hamstrings"],
  },
  "abductor": {
    images: [require('../../assets/exercises/abductor-0.jpg'), require('../../assets/exercises/abductor-1.jpg')],
    instructions: ["Abduktör makinesine otur ve rahat edeceğin bir ağırlık seç. Bacaklar yerleşince iki yandaki tutamakları kavra. Üst vücudun (bel üstü) sabit kalmalı. Bu başlangıç pozisyonu.","Nefes vererek bacaklarınla pedleri yavaşça iki yana aç.","Bir saniye kasılmayı hisset, sonra nefes alarak bacaklarını başlangıca getir. Not: sakatlanmamak için üst vücudunu sabit tut.","İstediğin tekrar sayısını tamamla."],
    primary: ["abductors"],
    secondary: ["glutes"],
  },
  "cable-kickback": {
    images: [require('../../assets/exercises/cable-kickback-0.jpg'), require('../../assets/exercises/cable-kickback-1.jpg')],
    instructions: ["Alt makaraya deri ayak bileği kelepçesini tak ve ayak bileğine tak.","Ağırlık kulesine yaklaşık 60 cm uzaklıkta dön ve destek için çerçeveyi tut.","Diz ve kalçanı hafif bükük, karnını sıkı tut; kalçanı kasarak çalışan bacağı yavaşça yarım daire çizerek rahatça gidebildiğin kadar arkaya doğru tekmele. Nefes ver. İpucu: en arkada kalçanı bir saniye sık.","Kablonun çekişine direnerek bacağını yavaşça başlangıca getir.","İstediğin tekrar sayısını tamamla.","Bacak değiştirip diğer tarafla tekrarla."],
    primary: ["glutes"],
    secondary: ["hamstrings"],
  },
  "kb-swing": {
    images: [require('../../assets/exercises/kb-swing-0.jpg'), require('../../assets/exercises/kb-swing-1.jpg')],
    instructions: ["Ayaklar omuz genişliğinde dur, kettlebell ayaklarının biraz önünde yerde olsun. Kalçanı geriye iterek eğil ve kettlebell'i iki elinle kavra; sırtın düz olsun.","Kettlebell'i bacaklarının arasından geriye doğru savur, sonra kalçanı güçlüce öne iterek ayağa kalk. Kollar yalnızca tutar; güç kalçadan gelir.","Kettlebell göğüs hizasına gelince kalçanı ve kalça kaslarını sık, kolların rahat kalsın.","Kettlebell'in aşağı inmesine izin ver, kalçanı geriye bükerek bir sonraki tekrara geç. Sırtını yuvarlama."],
    primary: ["hamstrings"],
    secondary: ["calves","glutes","lower back","shoulders"],
  },
  "plank": {
    images: [require('../../assets/exercises/plank-0.jpg'), require('../../assets/exercises/plank-1.jpg')],
    instructions: ["Yüzüstü yere uzan; ağırlığını ayak parmaklarına ve ön kollarına ver. Dirsekler 90 derece bükülü ve tam omuzlarının altında olsun.","Vücudunu baştan ayağa düz tut ve bu pozisyonda olabildiğince uzun kal. Zorlaştırmak için bir kolunu veya bacağını kaldırabilirsin."],
    primary: ["abdominals"],
    secondary: [],
  },
  "crunch": {
    images: [require('../../assets/exercises/crunch-0.jpg'), require('../../assets/exercises/crunch-1.jpg')],
    instructions: ["Sırtüstü uzan, ayakların yerde veya dizlerin 90 derece bükülü şekilde bankta olsun. Ayakları bankta tutuyorsan 8-10 cm arayla koy ve parmak uçlarını içe çevirip birbirine değdir.","Ellerini başının iki yanına hafifçe koy, dirsekler dışarıda kalsın. İpucu: parmaklarını başının arkasında kilitleme.","Belini yere bastırarak karın kaslarını daha iyi izole et ve omuzlarını yerden kaldırmaya başla.","Belini olabildiğince yere bastırmaya devam ederek karnını kasarak nefes ver. Omuzların yerden yalnızca yaklaşık 10 cm kalksın, belin yerde kalsın. Üstte karnını sert sık ve bir saniye bekle. İpucu: yavaş ve kontrollü git, ivmeyle hile yapma.","Bir saniye sıktıktan sonra nefes alarak yavaşça başlangıca in.","İstediğin tekrar sayısını tamamla."],
    primary: ["abdominals"],
    secondary: [],
  },
  "leg-raise": {
    images: [require('../../assets/exercises/leg-raise-0.jpg'), require('../../assets/exercises/leg-raise-1.jpg')],
    instructions: ["Barfiks barına kollar yukarıda uzanmış halde, geniş veya orta tutuşla asıl. Bacaklar düz aşağıda, leğen kemiğin hafif geriye yuvarlak olsun. Bu başlangıç pozisyonu.","Bacaklarını gövdenle 90 derece açı yapana kadar kaldır. Nefes ver ve bir saniye kadar bekle.","Nefes alarak yavaşça başlangıca in.","İstediğin tekrar sayısını tamamla."],
    primary: ["abdominals"],
    secondary: [],
  },
  "cable-crunch": {
    images: [require('../../assets/exercises/cable-crunch-0.jpg'), require('../../assets/exercises/cable-crunch-1.jpg')],
    instructions: ["Halat takılı yüksek makaranın altında diz çök.","Halatı kavra ve ellerin yüzünün yanına gelene kadar aşağı çek.","Kalçanı hafif bük ve ağırlığın belini hafifçe geriye germesine izin ver. Bu başlangıç pozisyonu.","Kalçan sabitken karnını kasarak belden bük; dirseklerin uyluklarının ortasına doğru gitsin. Nefes ver ve bir saniye bekle.","Nefes alarak yavaşça başlangıca dön. İpucu: hareket boyunca karında sürekli gerilim kalsın; işi bel yapacak kadar ağır seçme.","İstediğin tekrar sayısını tamamla."],
    primary: ["abdominals"],
    secondary: [],
  },
  "ab-wheel": {
    images: [require('../../assets/exercises/ab-wheel-0.jpg'), require('../../assets/exercises/ab-wheel-1.jpg')],
    instructions: ["Karın tekerleğini iki elinle tut ve yere diz çök.","Tekerleği önünde yere koy; dört ayak üstünde (diz çökmüş şınav pozisyonunda) olacaksın. Bu başlangıç pozisyonu.","Tekerleği yavaşça düz ileri yuvarla, vücudunu düz bir çizgi halinde uzat. İpucu: vücudun yere değmeden gidebildiğin kadar uzağa git. Nefes al.","Uzanmış pozisyonda kısaca bekle, sonra nefes vererek kendini başlangıca geri çek. İpucu: yavaş git ve karnını hep sıkı tut."],
    primary: ["abdominals"],
    secondary: ["shoulders"],
  },
  "russian-twist": {
    images: [require('../../assets/exercises/russian-twist-0.jpg'), require('../../assets/exercises/russian-twist-1.jpg')],
    instructions: ["Yere uzan, ayaklarını sabit bir şeyin altına sıkıştır veya birine tutturt. Dizlerin bükük olsun.","Üst vücudunu uyluklarınla hayali bir V şekli oluşturacak kadar kaldır. Kollar önünde, gövdene dik uzanmış ve eller kenetli olsun. Bu başlangıç pozisyonu.","Nefes vererek gövdeni sağa, kolların yere paralel olana kadar döndür.","Bir saniye kasılmayı tut ve başlangıca dön. Sonra aynı hareketi sol tarafa yap.","İstediğin tekrar sayısını tamamla."],
    primary: ["abdominals"],
    secondary: ["lower back"],
  },
  "treadmill": {
    images: [require('../../assets/exercises/treadmill-0.jpg'), require('../../assets/exercises/treadmill-1.jpg')],
    instructions: ["Koşu bandına çık ve menüden istediğin seçeneği seç. Çoğu bantta manuel mod vardır; istersen hazır bir program da seçebilirsin. Yaş ve kilonu girersen yakılan kaloriyi tahmin eder. Eğimi değiştirerek yoğunluğu ayarlayabilirsin.","Koşu bandı kolaylık ve kardiyo faydası sağlar, dışarıdaki koşuya göre eklemlere genellikle daha az yük bindirir. Koşarken dik duruşunu koru; tutamaklara yalnızca gerektiğinde (inerken veya nabız ölçerken) tutun."],
    primary: ["quadriceps"],
    secondary: ["calves","glutes","hamstrings"],
  },
  "bike": {
    images: [require('../../assets/exercises/bike-0.jpg'), require('../../assets/exercises/bike-1.jpg')],
    instructions: ["Bisiklete otur ve sele yüksekliğini boyuna göre ayarla.","Menüden istediğin seçeneği seç; açmak için pedal çevirmen gerekebilir. Manuel modu kullanabilir veya hazır program seçebilirsin. Yaş ve kilonu girersen yakılan kaloriyi tahmin eder. Direnç seviyesini antrenman boyunca değiştirebilirsin. Tutamaklarla nabzını izleyip uygun yoğunlukta kalabilirsin."],
    primary: ["quadriceps"],
    secondary: ["calves","glutes","hamstrings"],
  },
  "rower": {
    images: [require('../../assets/exercises/rower-0.jpg'), require('../../assets/exercises/rower-1.jpg')],
    instructions: ["Kürek makinesine otur. Topukların ayak pedallarının tabanına rahatça otursun, kayışları sabitle. Varsa kullanmak istediğin programı seç. Dik otur ve kalçadan öne eğil.","Hareketin üç aşaması var. Birinci aşamada öne gelirsin: dizler bükük ve göğsüne yakın, üst vücut hafif önde ama duruş dik. Sonra ayaklarınla pedallara basarak bacaklarını uzat ve ellerini üst karnına çekerek omuzlarını geriye sık. Sırtını yormamak için ağırlıklı olarak bacak ve kalça kaslarını kullan.","Geri dönüş aşamasında kollarını uzat, dizlerini bük ve vücudunu tekrar öne getirip ilk aşamaya geç."],
    primary: ["quadriceps"],
    secondary: ["biceps","calves","glutes","hamstrings","lower back","middle back"],
  },
};

export function getExerciseMedia(slug: string | null | undefined): ExerciseMedia | null {
  return (slug && EXERCISE_MEDIA[slug]) || null;
}

/** Veri setindeki kas adları -> Türkçe. */
const MUSCLE_TR: Record<string, string> = {
  abdominals: 'Karın', abductors: 'Kalça dış', adductors: 'İç bacak', biceps: 'Biceps', calves: 'Baldır', chest: 'Göğüs',
  forearms: 'Ön kol', glutes: 'Kalça', hamstrings: 'Arka bacak', lats: 'Kanat', 'lower back': 'Alt sırt', 'middle back': 'Orta sırt',
  neck: 'Boyun', quadriceps: 'Ön bacak', shoulders: 'Omuz', traps: 'Trapez', triceps: 'Triceps',
};

export function muscleTr(name: string) {
  return MUSCLE_TR[name] ?? name;
}
