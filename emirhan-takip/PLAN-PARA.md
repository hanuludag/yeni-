# PLAN — Para bölümü

## Kaynaklar
- Tasarım: `tasarim-para/Money.dc.html` (6 görünüm + tüm hesap mantığı), `DMoney*.dc.html` (masaüstü kabukları), `Main.dc.html` (ana ekran "Para özeti" kartı), `canvas.json` notları. PDF çıktısıyla karşılaştırıldı.
- Mevcut site: Vite + Preact + TypeScript (bkz. `PLAN.md`). Para aynı yapıya eklendi; mevcut 4 sekmenin koduna dokunulan tek yer sekme listesi ve ana ekrana eklenen kart.

## Veri modeli (migration `20261124064108_para.sql`)
Öneri şeması küçük eklerle uygulandı:
- `para_hesap`, `para_islem`, `para_butce`, `para_abonelik`, `para_abonelik_odeme`, `para_hedef` (+ hepsinde `updated_at` tetikleyicisi, RLS açık, `anon` tam erişim: mevcut tablolarla aynı bilinçli seçim).
- **Bakiye tutulmaz**: `acilis_bakiyesi` + işlemlerden türetilir. Silme/düzenleme kendiliğinden doğru geri alır.
- `para_islem` check kısıtı: transferde `hedef_hesap_id` + `giren_tutar` zorunlu, gider/gelirde `kategori` zorunlu; tutar > 0.
- Hesap silme `restrict`: işlemi olan hesap silinemez → arayüz **Arşivle** sunar (toplamlardan çıkar, işlemler kalır).
- Abonelik "Ödendi": `para_abonelik_ode` RPC'si gider işlemi + ay işaretini **tek işlemde** yazar; `(abonelik_id, ay)` PK'si aynı ay ikinci kez işaretlenmeyi engeller (HTTP 409). "Geri al" = `para_abonelik_geri_al` → işlem silinir, işaret cascade ile kalkar. İşlem listeden silinirse işaret de kalkar.
- Kategoriler `takip_ayar.para_kategoriler` (varsayılanlar migration'da; örnek hesap/işlem verisi **yazılmadı**). Kur `takip_ayar.kur_usd_try = {kur, tarih, kaynak}`.
- İstemci kimlikleri (`crypto.randomUUID`): bağlantı kopup tekrar denenirse çift kayıt oluşmaz.

## Hesap mantığı (`src/lib/para/hesap.ts`, saf ve testli)
- Tüm tutarlar **kuruş (tam sayı)**; biçim `1.370,00 ₺`, `80,52 $`, eksi `−`.
- Etki: gider → bakiye azalır / kart borcu artar; gelir → tersi; transfer → kaynaktan `tutar` çıkar, hedefe `giren_tutar` girer (hedef kartsa borç azalır).
- Net varlık = Nakit + Banka − Kart borcu + Birikim (USD × kur). Harcayabileceğim = Nakit + Banka − bu ay ödenmemiş ve günü bugün/sonra olan abonelikler − kart borcu (birikim hariç). Günlük = / ayın kalan günü (bugün dahil).
- Özet: transferler gelir/gider sayılmaz; "Ödenen" = gider − kartla yapılan gider (tasarımdaki formül).
- Bütçe: %80 "yakın", %100 "Aşıldı" (#f87171). Abonelik: ayın günü o ayın son gününe kırpılır (31 → Şubat 28/29); 3 günden az kalan vurgulanır.
- Birikim hedefi: tek birikim hesabına bağlı (o hesabın bakiyesi) ya da elle girilen tutar. (Tasarımda "Midas + Phantom" toplamı vardı; şema tek hesap bağladığı için hedef tek hesaba bağlanır.)
- Dolar tutarı olan gelir/giderler özet ve bütçede kurla TL'ye çevrilir; kur yoksa dışarıda bırakılır ve not gösterilir. Kur hiç yoksa TL karşılıkları gizlenir, hata verilmez.

## Dolar kuru (24 Kasım 2026'da gerçek ağda test edildi)
| Sıra | Kaynak | Uç | CORS | USD/TRY |
|---|---|---|---|---|
| 1 | ExchangeRate-API açık uç | `open.er-api.com/v6/latest/USD` | `*` | 50,6215 |
| 2 | Frankfurter | `api.frankfurter.dev/v1/latest?base=USD&symbols=TRY` | `*` | 50,59 |
| 3 | fawazahmed0 currency-api | `cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json` | `*` | 50,5947 |

- Birincisi günlük güncellenir ve atıf ister → kur satırında "ExchangeRate-API" bağlantısı var. Hepsi anahtarsız.
- Açılışta, sekme görünür olunca ve "Kuru yenile" ile; en fazla 15 dakikada bir. Başarılı kur `takip_ayar`a yazılır (cihazlar paylaşır).
- Alınamazsa: "Kur alınamadı — son bilinen: X" + elle kur alanı. Elle girilen kur `kaynak: 'elle'` olarak saklanır.

## Ekranlar (`src/ekranlar/para/`)
`Para.tsx` (başlık + Hesaplar · İşlemler · Özet · Plan), `Hesaplar.tsx` (hesap formu, net varlık, gruplar, kur satırı), `HesapDetay.tsx` (bu ay gelen/giden, işlemler, hızlı ekle, düzenle/arşivle), `Islemler.tsx` (hızlı ekleme: gider/gelir/transfer, tarih 05:00 kuralı, ay geçişi, arama, filtre, satır içi düzenle/sil), `Ozet.tsx` (aylık/haftalık/yıllık, nakit akışı, kategori dağılımı → İşlemler süzgeci, son 6 ay), `Plan.tsx` (harcayabileceğim, bütçeler, abonelikler, hedefler, kategori yönetimi), `AnaKart.tsx` (ana ekran kartı).
- Adresler: `#/para`, `#/para/hesaplar/yeni`, `#/para/hesap/<id>`, `#/para/islemler`, `#/para/islemler/transfer`, `#/para/ozet/<YYYY-MM>`, `#/para/plan`. Yenileyince aynı görünüm açılır.
- Mobilde 5 eşit sekme (13 px, tasarımdaki gibi); masaüstünde başlık + yatay gezinme, içerik 760 px.
- Transferde aynı hesap iki tarafta seçilirse taraflar yer değiştirir (tasarımda seçenek gizleniyordu; daha az tıklama).
- Alert/confirm yok; silme ve arşivleme satır içi onaylı.

## Eşzamanlılık ve hata
- Güncelleme/silme `updated_at` koşullu; arada başka cihaz değiştirdiyse "başka bir cihazda değişmiş; en güncel hali yüklendi" uyarısı, girdi formda kalır.
- 30 sn yoklama; form durumu ayrı tutulduğu için yazılan yarım giriş bozulmaz. Hızlı ekleme ve hesap formu taslakları `localStorage`'da (sayfa yenilense de kalır).
- Son başarılı Para verisi önbellekte; bağlantı yokken görüntülenir.

## Testler
- Birim: `src/lib/para/hesap.test.ts` (tasarım örneğiyle 2.950,00 / 8.570,87 / 5.000–2.395–2.605 ve kenar durumları), `kur.test.ts`.
- Kur gerçek ağ: `npm run kur:test`.
- Arayüz (sahte Supabase, tasarım örnek verisi): `npm run e2e:para`, ekran görüntüleri `npm run ekran:para`.
- Gerçek DB: `npm run e2e:para-db` (`test_` önekli satırlar yazılır ve silinir).
