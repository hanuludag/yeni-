# PLAN — Günlük Takip

## Kaynaklar
- Tasarım: `Kişisel Günlük Takip.pdf` (Claude Design çıktısının 8 sayfalık PDF'i: 4 mobil, 3 masaüstü, 1 bileşenler). `paket/` klasörü (`.dc.html`, `canvas.json`, `eski-site/`, `veri/gunluk-yedek.json`) bu oturuma gelmedi; tasarım PDF'ten, iş mantığı veritabanındaki gerçek veriden okundu.
- Veri: Supabase `takip` projesi (82 gün, 2 ayar kaydı). Değişiklikten önce yedek: `supabase/yedek/` (git dışı).

## Teknoloji
- **Vite + Preact + TypeScript.** Preact ~4 KB; formlar, taslaklar ve çok sayıda bileşen durumu olan bir uygulamada vanilla DOM kodundan daha az hata çıkarır. Başka çalışma zamanı bağımlılığı yok (Supabase JS istemcisi yerine `fetch` ile REST: ~50 KB tasarruf).
- Grafikler elle yazılmış SVG (kütüphane yok).
- Test: Vitest (birim), Playwright (ekran görüntüsü + arayüz senaryoları), Node betiği (gerçek DB uçtan uca).
- Yayın: Netlify (statik `dist/`), haftalık zamanlanmış fonksiyon Supabase'i uyanık tutar.

## Klasör yapısı
```
src/
  main.tsx, app.tsx          giriş, yönlendirme (hash), düzen
  styles.css                 renk/ölçü değişkenleri, bileşen stilleri
  lib/                       saf mantık (birim testli)
    tarih.ts  sayi.ts  puan.ts  seri.ts  istatistik.ts  rutin.ts
    api.ts                   Supabase REST, hata çevirisi, çakışma kontrolü
    store.ts                 veri deposu, yoklama, taslaklar
  bilesenler/                PuanSatiri, KaydetCubugu, Grafik, Durumlar, ...
  ekranlar/                  AnaEkran, Gunluk, Aylik, Rutinler
netlify/functions/supabase-canli.mts   haftalık ping
supabase/migrations/        şema değişiklikleri
scripts/                    yedek, e2e-db, e2e-ui, ekran görüntüsü
docs/ekran/                 ekran görüntüleri (örnek veriyle, kişisel not yok)
```

## Veri modeli
- `takip_gunluk(tarih, veri, updated_at)` — değişmedi. `veri`: `date, calisma, uyku, ekran, not, gunlukToplam, saglikToplam, hedefler{id:puan}, saglik{id:puan}`. Eski günlerde yalnızca toplamlar var; arayüz bunu "madde detayı yok" diye gösterir ve kayıtlı toplamı korur.
- `takip_ayar` — `kriterler`, `program` (değişmedi; `program.rutinler` tasarımdaki adımlarla güncellendi, öğrenim/spor/yemek korundu).
- **Yeni:** `takip_rutin_isaret(tarih, veri{sabah:[adım],ogle:[...],gece:[...]}, updated_at)` — günlük rutin işaretleri, gün anahtarlı, cihazlar arası senkron. Ertesi gün yeni satır = sıfırlanmış işaretler.
- **Yeni:** üç tabloda `updated_at` tetikleyicisi (her yazımda sunucu saati). Çakışma kontrolü buna dayanır.

## Kararlar
- **05:00 kuralı:** Saat 05:00'ten önce "bugün" bir önceki gündür. Günlük sekmesi, Ana ekrandaki rutin işaretleri, seri ve "bugün girilmedi" düğmesi aynı etkin günü kullanır (gece 01:00'deki "Yatış" işareti o günün gecesine ait olsun diye).
- **Rutin sekmesi saate göre:** <11:00 Sabah, <17:00 Öğle, sonrası Gece (05:00 öncesi de Gece).
- **Seri:** puan girilmiş (`gunlukToplam`/`saglikToplam` ya da madde puanı olan) üst üste günler. Etkin gün henüz boşsa seri dünden sayılır (gün bitmeden sıfırlanmaz); arada boş gün varsa orada kesilir.
- **Erteleme:** "Erteleme" maddesi (id `g14`, yoksa adla bulunur) son 7 gün ortalaması, önceki 7 günle fark. Puan 1 = hiç erteleme yok; ortalama < 0,5 ise uyarı rengi + "çok erteleme" yazısı (renk tek başına anlam taşımaz).
- **Toplamlar:** bir günde madde puanı varsa toplam = o günün tüm madde puanlarının toplamı (silinmiş maddelerinki dahil, böylece eski günler değişmez). Hiç madde puanı yoksa kayıtlı toplam korunur.
- **Yeni madde kimliği** zaman damgalı (`g_lx3k9`) — silinen bir maddenin eski puanları yeni maddeye geçmez.
- **Çakışma:** Kaydederken `updated_at` eşleşmesiyle koşullu yazma (`PATCH ... &updated_at=eq.<yüklenen>`; yeni gün için `POST`, 409 = çakışma). Çakışmada satır içi uyarı: "Benimkini kaydet" / "Diğerini yükle".
- **Taslaklar:** Günlük girişleri her değişiklikte `localStorage`'a yazılır; bağlantı yoksa / kayıt başarısızsa kaybolmaz, sayfa yenilense de geri gelir.
- **Yoklama:** açılışta, sekme görünür olunca, kayıttan sonra ve 30 sn'de bir. Taslağı olan gün yoklamayla ezilmez.
- **Sekme adı:** "Program" → "Rutinler" (sekme, başlık, bağlantılar). Ana ekrandaki "Rutin" bölümü aynı.
- **Boş ay metni:** tasarımdaki "Bugün sekmesinden" yerine gerçek sekme adı: "Günlük sekmesinden bir günü puanla."
- **Elle sayı kutusu:** her puan satırında 5 düğmenin yanında (0–1, virgüllü ondalık kabul).
- **Rutinler masaüstü:** masaüstü başlık + yatay gezinme, 760 px sütun; rutin adımları 3 sütun.

## Ekranlar
1. Ana ekran — tarih, Rutin (Sabah/Öğle/Gece, işaret, düzenle), Seri (+14 nokta), Erteleme, Son 7 gün (rapor + beslenme), "Günü puanla" düğmesi.
2. Günlük — tarih okları, Bugüne git, 19 + 6 madde, saatler, not, maddeleri düzenle, sabit kaydet çubuğu.
3. Aylık — ay seçici, N gün yazıldı, 5 ortalama, 5 grafik, Günler tablosu (katlanır), yıllık özet.
4. Rutinler — öğrenim, spor, rutin adımları, yemek; düzenle/vazgeç/kaydet.

## Test planı
- Birim (Vitest): tarih (05:00, biçimler), sayı biçimi/ayrıştırma, toplamlar (19/20/21 Kasım), seri (bugün boş/dün dolu, aradaki boş gün, ay sınırı, 05:00), ortalamalar, erteleme.
- Playwright: 390 ve 1200 px'te 4 sekme (örnek veri, `docs/ekran/`), saat taklidi ile 05:00 öncesi, offline/HTTP 500/boş ay durumları, taslağın kaybolmaması, çakışma.
- Gerçek DB: `2099-01-01` yaz → oku → sil.
- Canlı: sayfa, giriş ekranı yok, veri görünüyor, kayıt (2099 test günü) çalışıyor.

## Yayın
1. `npm run build` → `dist/`.
2. Netlify site `b6a1ec0b-...` (`emirhan-takip`), `netlify.toml` (build + publish + functions).
3. Ziyaretçi erişimi: takım girişi (SSO) koruması kapatılır.
4. Canlı test.
