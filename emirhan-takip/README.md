# Günlük Takip

Kişisel günlük puanlama ve rutin takibi. Vite + Preact + TypeScript, statik site (Netlify), veri Supabase'te.

- Canlı: https://emirhan-takip.netlify.app
- Plan ve kararlar: [PLAN.md](PLAN.md)

## Çalıştırma

```bash
npm install
npm run dev          # http://localhost:5173
```

## Testler

```bash
npm test             # birim testler (toplam, seri, 05:00 kuralı, ortalamalar)
npm run build        # tip kontrolü + üretim derlemesi (dist/)
npm run preview      # derlenmiş siteyi http://localhost:4173 adresinde açar
npm run e2e:ui       # (preview açıkken) arayüz senaryoları, sahte veriyle
npm run ekran        # (preview açıkken) 390/1200 px ekran görüntüleri → docs/ekran/
npm run e2e:db       # gerçek veritabanı: 2099-01-01 test günü yaz/oku/sil
```

`e2e:ui` ve `ekran` Playwright kullanır (`npx playwright install chromium` gerekebilir).
Canlı adreste test için: `ADRES=https://emirhan-takip.netlify.app npm run e2e:ui` (sahte veriyle çalışır, gerçek veriye yazmaz).

## Yayınlama

Netlify sitesi: `emirhan-takip` (site id `b6a1ec0b-66c7-4f22-aa21-542a169be858`). Ayarlar `netlify.toml` içinde
(build: `npm run build`, publish: `dist`, fonksiyonlar: `netlify/functions`).

```bash
npx netlify-cli login
npx netlify-cli link --id b6a1ec0b-66c7-4f22-aa21-542a169be858
npx netlify-cli deploy --prod --build
```

Supabase adresi ve **yayınlanabilir** anahtar repoda değil (repo herkese açık olabilir): yerelde `.env.local`,
Netlify'da ortam değişkeni `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANAHTAR` (derleme + fonksiyonlar). Gizli (service role)
anahtar hiçbir yere konmaz; `vite.config.ts` böyle bir anahtarla derlemeyi reddeder.

`netlify/functions/supabase-canli.mts` her pazartesi 09:17 (TR) Supabase'e küçük bir sorgu atar; ücretsiz planda
7 gün hareketsiz kalan proje durmasın diye.

## Veri nerede?

Supabase projesi `takip` (eu-central-1), `public` şema. Bağlantı bilgisi `.env.local` dosyasında (git dışı; örnek: `.env.example`):

| Tablo | İçerik |
|---|---|
| `takip_gunluk` | bir satır = bir gün; `veri` içinde madde puanları, toplamlar, saatler, not |
| `takip_ayar` | `kriterler` (maddeler) ve `program` (öğrenim, spor, rutin adımları, yemek) |
| `takip_rutin_isaret` | günlük rutin işaretleri (gün anahtarlı, her gün sıfırdan) |

Şema değişiklikleri `supabase/migrations/` içinde. Erişim: RLS açık, `anon` rolü okur/yazar (linki bilen herkes; bilinçli seçim).

Tarayıcı, son başarılı yüklemeyi ve kaydedilmemiş günlük taslaklarını `localStorage`'da tutar (bağlantı yokken girdi kaybolmaz).

## Para bölümü

Ayrıntılar: [PLAN-PARA.md](PLAN-PARA.md).

| Tablo | İçerik |
|---|---|
| `para_hesap` | hesaplar (nakit, banka, kart, birikim; ₺/$), açılış bakiyesi, limit, kesim günü, arşiv |
| `para_islem` | gider, gelir, transfer (iki para birimi için `tutar` + `giren_tutar`) |
| `para_butce` | kategori başına aylık limit |
| `para_abonelik`, `para_abonelik_odeme` | abonelikler ve ay ay "Ödendi" işaretleri (RPC: `para_abonelik_ode`, `para_abonelik_geri_al`) |
| `para_hedef` | birikim hedefleri |

Bakiyeler veritabanında tutulmaz: açılış bakiyesi + işlemlerden hesaplanır. Kategoriler `takip_ayar.para_kategoriler`,
son dolar kuru `takip_ayar.kur_usd_try` içinde.

Dolar kuru tarayıcıdan anahtarsız alınır: önce `open.er-api.com` (ExchangeRate-API), olmazsa Frankfurter, o da olmazsa
jsDelivr'deki currency-api. En fazla 15 dakikada bir yenilenir; alınamazsa son bilinen kur gösterilir ve elle girilebilir.

```bash
npm run e2e:para     # (preview açıkken) Para arayüz senaryoları, sahte veriyle
npm run ekran:para   # (preview açıkken) Para ekran görüntüleri → docs/ekran/
npm run e2e:para-db  # gerçek veritabanı: test_ satırları yaz/oku/sil
npm run kur:test     # kur kaynaklarını gerçek ağda dene
```

## Yedek

```bash
npm run yedek        # supabase/yedek/<tablo>-<zaman>.json
```

`supabase/yedek/` git'e girmez (kişisel notlar içerir). Geri yüklemek için JSON'daki satırları Supabase SQL
düzenleyicisinden veya REST ile (`POST /rest/v1/takip_gunluk`, `Prefer: resolution=merge-duplicates`) yazabilirsin.
