// Para arayüz senaryoları (sahte Supabase; gerçek veriye dokunmaz).
import { ADRES, chromium, paraOrnek, sahteSupabase } from './ortak.mjs';
import { PID } from './para-ornek.mjs';

const tarayici = await chromium.launch();
let gecen = 0;
const hatalar = [];
async function senaryo(ad, fn, secenek = {}, saat = '2026-11-24T20:00:00+03:00', w = 390) {
  if (process.env.SADECE && !ad.includes(process.env.SADECE)) return;
  const ctx = await tarayici.newContext({ viewport: { width: w, height: 844 }, timezoneId: 'Europe/Istanbul' });
  const page = await ctx.newPage();
  const konsol = [];
  page.on('pageerror', (e) => konsol.push(e.message));
  await page.clock.setFixedTime(new Date(saat));
  const db = await sahteSupabase(page, secenek);
  try {
    await fn(page, db);
    if (konsol.length) throw new Error('Sayfa hatası: ' + konsol.join(' | '));
    gecen++; console.log('GEÇTİ  ', ad);
  } catch (e) {
    hatalar.push(ad); console.log('GEÇMEDİ', ad, '\n   ', e.message.split('\n')[0]);
    if (process.env.AYRINTI) console.log('    sayfa:', (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 500), '\n    istekler:', db.istekler.slice(-5));
  }
  await ctx.close();
}
const esit = (a, b, m) => { if (a !== b) throw new Error(`${m}: beklenen ${JSON.stringify(b)}, gelen ${JSON.stringify(a)}`); };
const metin = (page, t) => page.waitForFunction((x) => document.body.innerText.includes(x), t, { timeout: 8000 }).catch(() => { throw new Error(`metin yok: ${t}`); });
const yok = async (page, t) => { await page.waitForTimeout(300); if ((await page.locator('body').innerText()).includes(t)) throw new Error(`olmaması gereken metin: ${t}`); };
const bakiye = async (page, ad) => (await page.locator('a.hesap-satir', { hasText: ad }).locator('.hs-tutar').innerText());

await senaryo('Hiç hesap yok → İlk hesabını ekle → hesap oluşur, net varlık doğru', async (page, db) => {
  await page.goto(`${ADRES}/#/para`);
  await metin(page, 'Henüz hesap yok.');
  await page.getByRole('link', { name: 'İlk hesabını ekle' }).click();
  await page.getByLabel('İsim').fill('Cüzdan');
  await page.getByRole('button', { name: 'Nakit', exact: true }).click();
  await page.getByLabel('Açılış bakiyesi').fill('1.000,50');
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await metin(page, 'Net varlık');
  esit(await bakiye(page, 'Cüzdan'), '1.000,50 ₺', 'bakiye');
  esit(db.para.para_hesap.length, 1, 'db hesap');
  esit(db.para.para_hesap[0].acilis_bakiyesi, 1000.5, 'db açılış');
}, {});

await senaryo('Gider ekle → bakiye düşer; sil (satır içi onay) → bakiye geri gelir', async (page, db) => {
  await page.goto(`${ADRES}/#/para/islemler`);
  await page.getByLabel('Tutar ₺').fill('150');
  await page.getByRole('group', { name: 'Kategori' }).getByRole('button', { name: 'Yemek' }).click();
  await page.getByRole('group', { name: 'Hesap' }).getByRole('button', { name: 'Nakit' }).click();
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await page.waitForFunction(() => !document.querySelector('.tutar-alan')?.value);
  esit(db.para.para_islem.filter((i) => i.tarih === '2026-11-24').length, 3, 'db işlem');
  await page.goto(`${ADRES}/#/para`);
  esit(await bakiye(page, 'Nakit'), '1.220,00 ₺', 'eklemeden sonra');
  await page.goto(`${ADRES}/#/para/islemler`);
  await page.locator('.islem-dugme', { hasText: '150,00' }).first().click();
  await page.getByRole('button', { name: 'Sil', exact: true }).click();
  await metin(page, 'Silinsin mi?');
  await page.getByRole('button', { name: 'Evet, sil' }).click();
  await page.waitForTimeout(400);
  await page.goto(`${ADRES}/#/para`);
  esit(await bakiye(page, 'Nakit'), '1.370,00 ₺', 'silmeden sonra');
}, { para: paraOrnek() });

await senaryo('Kartla harcama borcu artırır, bankadan kart ödemesi borcu düşürür', async (page) => {
  await page.goto(`${ADRES}/#/para/islemler`);
  await page.getByLabel('Tutar ₺').fill('60');
  await page.getByRole('group', { name: 'Hesap' }).getByRole('button', { name: 'Garanti' }).click();
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await page.waitForFunction(() => !document.querySelector('.tutar-alan')?.value);
  await page.getByRole('tab', { name: 'Transfer' }).click();
  await page.getByRole('group', { name: 'Nereden' }).getByRole('button', { name: 'Ana' }).click();
  await page.getByRole('group', { name: 'Nereye' }).getByRole('button', { name: 'Garanti' }).click();
  await page.getByLabel('Tutar', { exact: true }).fill('400');
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await page.waitForTimeout(500);
  await page.goto(`${ADRES}/#/para`);
  esit(await bakiye(page, 'Garanti'), '2.000,00 ₺', 'kart borcu 2340+60−400');
  esit(await bakiye(page, 'Ana'), '4.450,00 ₺', 'banka 4850−400');
}, { para: paraOrnek() });

await senaryo('₺→$ transferde iki tutar: kur otomatik doldurur, elle düzeltilebilir', async (page, db) => {
  await page.goto(`${ADRES}/#/para/islemler/transfer`);
  await page.getByRole('group', { name: 'Nereden' }).getByRole('button', { name: 'Ana' }).click();
  await page.getByRole('group', { name: 'Nereye' }).getByRole('button', { name: 'Midas' }).click();
  await page.getByLabel('Çıkan ₺').fill('505,20');
  esit(await page.getByLabel('Giren $').inputValue(), '10,00', 'otomatik giren');
  await page.getByLabel('Giren $').fill('9,95');
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await page.waitForTimeout(500);
  const t = db.para.para_islem.find((i) => i.tur === 'transfer' && i.tutar === 505.2);
  esit(t?.giren_tutar, 9.95, 'elle giren');
  await page.goto(`${ADRES}/#/para`);
  esit(await bakiye(page, 'Midas'), '90,47 $', 'Midas 80,52+9,95');
}, { para: paraOrnek() });

await senaryo('Abonelik "Ödendi" bir kez gider işlemi oluşturur; Geri al işlemi siler', async (page, db) => {
  await page.goto(`${ADRES}/#/para/plan`);
  const once = db.para.para_islem.length;
  await page.getByRole('button', { name: 'iCloud ödendi olarak işaretle' }).click();
  await page.getByRole('button', { name: 'iCloud ödemesini geri al' }).waitFor();
  esit(db.para.para_islem.length, once + 1, 'işlem oluştu');
  esit(db.para.para_islem[0].nota, 'iCloud', 'işlem notu');
  esit(db.para.para_abonelik_odeme.filter((o) => o.ay === '2026-11').length, 3, 'işaret');
  // Garanti ile ödendi: yaklaşan 290→250, kart borcu 2.980→3.020; harcanabilir değişmez (6.220−250−3.020)
  await metin(page, '− Yaklaşan ödemeler\n250,00 ₺').catch(async () => metin(page, '250,00 ₺'));
  await metin(page, '3.020,00 ₺');
  await page.getByRole('button', { name: 'iCloud ödemesini geri al' }).click();
  await page.getByRole('button', { name: 'iCloud ödendi olarak işaretle' }).waitFor();
  esit(db.para.para_islem.length, once, 'işlem silindi');
  await metin(page, '2.950,00 ₺');
}, { para: paraOrnek() });

await senaryo('Kur alınamadı: son bilinen gri uyarı, elle kur girilince TL karşılığı değişir', async (page) => {
  await page.goto(`${ADRES}/#/para`);
  await metin(page, 'Kur alınamadı — son bilinen: 50,40');
  await page.getByLabel('Kuru elle gir').fill('40');
  await page.getByLabel('Kuru elle gir').press('Enter');
  await metin(page, '≈ 1.000,00 ₺'); // Phantom 25 $ × 40
}, { para: paraOrnek(), kurHata: true, kur: { kur: 50.4, tarih: '2026-11-23T09:00:00Z', kaynak: 'ExchangeRate-API' } });

await senaryo('Kur hiç yok: çökmez, TL karşılığı gizlenir, net varlıkta not', async (page) => {
  await page.goto(`${ADRES}/#/para`);
  await metin(page, 'Kur alınamadı. TL karşılıkları gizlendi.');
  await metin(page, 'Kur olmadığı için dolar tutarları dahil edilmedi');
  await yok(page, '≈');
}, { para: paraOrnek(), kurHata: true });

await senaryo('Bağlantı yokken kayıt: Türkçe hata, girdi kaybolmaz; bağlantı gelince kaydedilir', async (page, db) => {
  await page.goto(`${ADRES}/#/para/islemler`);
  await page.getByLabel('Tutar ₺').fill('75');
  await page.getByLabel('Not').fill('kahve');
  db.hata = 'baglanti';
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await metin(page, 'Kaydedilemedi: bağlantı yok');
  esit(await page.getByLabel('Tutar ₺').inputValue(), '75', 'tutar duruyor');
  await page.reload();
  await page.getByLabel('Tutar ₺').waitFor();
  esit(await page.getByLabel('Tutar ₺').inputValue(), '75', 'yenileme sonrası tutar (taslak)');
  db.hata = undefined;
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await page.waitForFunction(() => !document.querySelector('.tutar-alan')?.value);
  if (!db.para.para_islem.some((i) => i.nota === 'kahve')) throw new Error('kaydedilmedi');
}, { para: paraOrnek() });

await senaryo('Supabase 500: anlaşılır hata, form korunur', async (page, db) => {
  await page.goto(`${ADRES}/#/para/hesaplar/yeni`);
  await page.getByLabel('İsim').fill('Ziraat');
  db.hata = 500;
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await metin(page, 'Sunucu hata verdi (500)');
  esit(await page.getByLabel('İsim').inputValue(), 'Ziraat', 'isim duruyor');
}, { para: paraOrnek() });

await senaryo('Çakışma: başka cihaz işlemi değiştirdiyse düzenleme sessizce ezilmez', async (page, db) => {
  await page.goto(`${ADRES}/#/para/islemler`);
  await page.locator('.islem-dugme', { hasText: '185,00' }).click();
  await page.getByRole('button', { name: 'Düzenle' }).click();
  await page.getByLabel('Tutar ₺').fill('190');
  const t = db.para.para_islem.find((i) => i.tutar === 185);
  t.tutar = 200; t.updated_at = '2026-11-24T19:00:00+00:00';
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await metin(page, 'başka bir cihazda değişmiş');
  esit(t.tutar, 200, 'diğer cihazın değeri ezilmedi');
  esit(await page.getByLabel('Tutar ₺').inputValue(), '190', 'girdi duruyor');
}, { para: paraOrnek() });

await senaryo('Bütçe ekle / Market aşıldı; boş bütçe ve abonelik durumları', async (page) => {
  await page.goto(`${ADRES}/#/para/plan`);
  await metin(page, 'Henüz bütçe yok.');
  await metin(page, 'Henüz abonelik yok.');
  await page.getByRole('button', { name: '+ Bütçe' }).click();
  await page.getByRole('group', { name: 'Kategori' }).getByRole('button', { name: 'Market' }).click();
  await page.getByLabel('Aylık limit').fill('500');
  await page.locator('section', { has: page.locator('#bud-h') }).getByRole('button', { name: 'Ekle', exact: true }).click();
  await metin(page, 'Aşıldı');
  await metin(page, '1 kategori aşıldı');
}, { para: { ...paraOrnek(), para_butce: [], para_abonelik: [], para_abonelik_odeme: [] } });

await senaryo('Ana ekran Para özeti: Harcayabileceğim, gelir/gider, bütçe uyarısı, Para sekmesine gider', async (page) => {
  await page.goto(`${ADRES}/#/`);
  const kart = page.getByRole('link', { name: 'Para özeti, Para sekmesine git' });
  await kart.waitFor();
  const t = (await kart.innerText()).replace(/\s+/g, ' ');
  for (const x of ['2.950,00 ₺', 'Bu ay gider: 2.395,00 ₺ · Gelir: 5.000,00 ₺', 'Market bütçesi aşıldı (610,00 / 500,00 ₺)']) if (!t.includes(x)) throw new Error(`kartta yok: ${x} | ${t}`);
  await kart.click();
  await page.waitForFunction(() => location.hash === '#/para');
}, { para: paraOrnek() });

await senaryo('Özet: kategoriye dokununca İşlemler o kategoriyle süzülür; boş dönem', async (page) => {
  await page.goto(`${ADRES}/#/para/ozet/2026-11`);
  await metin(page, 'Geçen aya göre gider %12 az');
  await page.locator('.kat-satir', { hasText: 'Market' }).click();
  await metin(page, 'Kategori: Market');
  esit(await page.locator('.islem-dugme').count(), 2, 'Market işlemleri');
  await page.goto(`${ADRES}/#/para/ozet/2026-01`);
  await metin(page, 'Bu dönem için kayıt yok.');
}, { para: paraOrnek() });

await senaryo('05:00 kuralı: 25 Kasım 02:00’de yeni işlem tarihi 24 Kasım', async (page, db) => {
  await page.goto(`${ADRES}/#/para/islemler`);
  await page.getByLabel('Tutar ₺').fill('10');
  await metin(page, 'Bugün, 24 Kas');
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await page.waitForTimeout(400);
  esit(db.para.para_islem.find((i) => i.tutar === 10)?.tarih, '2026-11-24', 'kayıt tarihi');
}, { para: paraOrnek() }, '2026-11-25T02:00:00+03:00');

await senaryo('Hesap detayı: hızlı gelir ekleme, arşivle (satır içi onay)', async (page, db) => {
  await page.goto(`${ADRES}/#/para/hesap/${PID.nakit}`);
  await page.getByRole('tab', { name: 'Gelir' }).click();
  await page.getByLabel('Tutar', { exact: true }).fill('30');
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await metin(page, '1.400,00 ₺');
  await page.getByRole('button', { name: 'Arşivle' }).click();
  await page.getByRole('button', { name: 'Evet, arşivle' }).click();
  await page.waitForFunction(() => location.hash === '#/para');
  esit(db.para.para_hesap.find((h) => h.id === PID.nakit).arsiv, true, 'arşiv');
  await yok(page, '1.400,00');
}, { para: paraOrnek() });

for (const w of [390, 1200]) {
  await senaryo(`Dokunma hedefleri ≥44 px ve ikon düğmelerde etiket (${w} px)`, async (page) => {
    for (const h of ['#/para', `#/para/hesap/${PID.ana}`, '#/para/islemler', '#/para/ozet/2026-11', '#/para/plan', '#/']) {
      await page.goto(`${ADRES}/${h}`);
      await page.waitForFunction(() => document.querySelector('main') && !document.querySelector('.iskelet'));
      await page.waitForTimeout(300);
      if (h === '#/para/islemler') await page.getByLabel('Tutar ₺').fill('5');
      const sorun = await page.evaluate(() => [...document.querySelectorAll('main button, main a, main input, main textarea, nav a')]
        .filter((e) => e.offsetParent !== null && !e.closest('.sr-only') && !e.closest('.kur-satir a') && !e.closest('p') && !e.closest('label.rutin-adim')) // rutin kutusunun dokunma alanı etiketin tamamı (60 px)
        .map((e) => { const r = e.getBoundingClientRect(); return [e.textContent.trim().slice(0, 18) || e.getAttribute('aria-label') || e.tagName, Math.round(r.width), Math.round(r.height), !!(e.textContent.trim() || e.getAttribute('aria-label') || e.labels?.length || e.getAttribute('placeholder'))]; })
        .filter(([t, wd, ht, et]) => ht < 44 || wd < 44 || !et)
        .filter(([t]) => t !== 'Bugüne git'));
      if (sorun.length) throw new Error(`${h}: ${JSON.stringify(sorun.slice(0, 6))}`);
    }
  }, { para: paraOrnek() }, undefined, w);
}

await tarayici.close();
console.log(`\n${gecen} geçti, ${hatalar.length} geçmedi`);
process.exit(hatalar.length ? 1 : 0);
