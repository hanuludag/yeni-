// Arayüz senaryoları (sahte Supabase ile; gerçek veriye dokunmaz).
// Not: Playwright'ın seçici motoru locale 'tr-TR' iken (İ/ı büyük-küçük harf) bozuluyor; bu yüzden locale verilmiyor.
// Kullanım: npm run build && npm run preview & ; npm run e2e:ui
import { ADRES, chromium, sahteSupabase } from './ortak.mjs';

const tarayici = await chromium.launch();
let gecen = 0;
const hatalar = [];

async function senaryo(ad, saat, fn, secenek = {}) {
  if (process.env.SADECE && !ad.includes(process.env.SADECE)) return;
  const ctx = await tarayici.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Istanbul' });
  const page = await ctx.newPage();
  const konsol = [];
  page.on('pageerror', (e) => konsol.push(e.message));
  await page.clock.setFixedTime(new Date(saat));
  const db = await sahteSupabase(page, secenek);
  try {
    await fn(page, db);
    if (konsol.length) throw new Error('Sayfa hatası: ' + konsol.join(' | '));
    gecen++;
    console.log('GEÇTİ  ', ad);
  } catch (e) {
    hatalar.push(ad);
    console.log('GEÇMEDİ', ad, '\n   ', e.message.split('\n')[0]);
    if (process.env.AYRINTI) {
      console.log('    sayfa:', (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 400));
      console.log('    istekler:', db.istekler.slice(-6), 'konsol:', konsol);
    }
  }
  await ctx.close();
}

const esit = (a, b, m) => { if (a !== b) throw new Error(`${m}: beklenen ${JSON.stringify(b)}, gelen ${JSON.stringify(a)}`); };
// Not: page.reload() sonrasında Playwright'ın metin seçicileri sahte saatle (clock) takılabiliyor;
// yenileme sonrası kontroller sayfanın kendi metninde yapılır.
const metinVar = (page, t) => page.waitForFunction((x) => document.body.innerText.includes(x), t, { timeout: 25000 });
const hazir = (page) => page.waitForSelector('main:not(:has(.iskelet))');
const toplam = async (page, baslik) => (await page.locator('.alt-baslik', { hasText: baslik }).locator('.bolum-ozet').innerText()).replace(/\s+/g, ' ');
const AKSAM = '2026-11-22T21:00:00+03:00';

await senaryo('05:00 öncesi: Günlük ve Ana ekran önceki günü gösterir, rutin Gece', '2026-11-23T04:30:00+03:00', async (page) => {
  await page.goto(`${ADRES}/#/gunluk`); await hazir(page);
  esit(await page.locator('h1').innerText(), '22 Kasım 2026', 'Günlük başlığı');
  await page.goto(`${ADRES}/#/`); await page.reload(); await hazir(page);
  if (!(await page.locator('.tarih-satiri').innerText()).startsWith('22 Kasım 2026, Pazar')) throw new Error('Ana ekran tarihi');
  esit(await page.locator('.parcali [aria-pressed=true]').innerText(), 'Gece', 'rutin bölümü');
});

await senaryo('05:00 sonrası: Günlük o günü gösterir, sabah 08:00 rutin Sabah', '2026-11-23T08:00:00+03:00', async (page) => {
  await page.goto(`${ADRES}/#/gunluk`); await hazir(page);
  esit(await page.locator('h1').innerText(), '23 Kasım 2026', 'Günlük başlığı');
  await page.goto(`${ADRES}/#/`); await hazir(page);
  esit(await page.locator('.parcali [aria-pressed=true]').innerText(), 'Sabah', 'rutin bölümü');
  // 23'ü boş ama 22 de boş → seri 0; 21'e kadar doluydu ama 22 boş
  esit(await page.locator('.ozet-kutu .buyuk').first().innerText().then((t) => t.replace(/\s+/g, '')), '0gün', 'seri');
});

await senaryo('Toplamlar canlı güncellenir, elle sayı girişi ve doğrulama', AKSAM, async (page) => {
  await page.goto(`${ADRES}/#/gunluk/2026-11-21`); await hazir(page);
  esit(await toplam(page, 'Günlük hedefler'), '7,25 / 19', 'başlangıç günlük');
  esit(await toplam(page, 'Sağlık'), '2,25 / 6', 'başlangıç sağlık');
  await page.getByRole('button', { name: 'Spor: 1' }).click();
  esit(await toplam(page, 'Günlük hedefler'), '8,25 / 19', 'Spor 1 sonrası');
  await page.getByLabel('Spor puanı (elle, 0–1)').fill('0,6');
  esit(await toplam(page, 'Günlük hedefler'), '7,85 / 19', 'elle 0,6');
  await page.getByLabel('Spor puanı (elle, 0–1)').fill('2');
  await page.getByText('0 ile 1 arası bir sayı yaz').waitFor();
  esit(await page.locator('.kayit-durum').innerText(), 'Kaydedilmedi', 'durum');
});

await senaryo('Taslak sayfa yenilenince kaybolmaz; başka güne geçerken satır içi uyarı', AKSAM, async (page) => {
  await page.goto(`${ADRES}/#/gunluk/2026-11-21`); await hazir(page);
  await page.locator('#saat-uyku').fill('7,5');
  await page.reload(); await hazir(page);
  esit(await page.locator('#saat-uyku').inputValue(), '7,5', 'yenileme sonrası uyku');
  esit(await page.locator('.kayit-durum').innerText(), 'Kaydedilmedi', 'durum');
  await page.getByRole('button', { name: 'Önceki gün' }).click();
  await page.getByText('kaydedilmemiş değişiklik var').waitFor();
  esit(await page.locator('h1').innerText(), '21 Kasım 2026', 'uyarıdayken gün değişmedi');
  await page.getByRole('button', { name: 'Kaydet ve geç' }).click();
  await page.waitForFunction(() => location.hash === '#/gunluk/2026-11-20');
  await page.locator('h1', { hasText: '20 Kasım 2026' }).waitFor();
  await page.goto(`${ADRES}/#/gunluk/2026-11-21`);
  await page.locator('h1', { hasText: '21 Kasım 2026' }).waitFor();
  esit(await page.locator('#saat-uyku').inputValue(), '7,5', 'kaydedilen uyku');
  esit(await page.locator('.kayit-durum').innerText(), 'Kayıtlı', 'durum');
});

await senaryo('Bağlantı yokken kayıt: girdi kaybolmaz, bağlantı gelince Tekrar dene ile kaydedilir', AKSAM, async (page, db) => {
  await page.goto(`${ADRES}/#/gunluk`); await hazir(page);
  esit(await page.locator('.kayit-durum').innerText(), 'Henüz kayıt yok', 'yeni gün');
  await page.getByRole('button', { name: 'Spor: 1' }).click();
  await page.locator('#not').fill('test notu');
  db.hata = 'baglanti';
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click();
  await page.getByText('Kaydedilemedi, tekrar dene').waitFor();
  await page.getByText('Bağlantı yok. Girişlerin bu cihazda bekliyor.').first().waitFor();
  esit(await page.locator('#not').inputValue(), 'test notu', 'not duruyor');
  await page.reload();
  await page.waitForSelector('h1');
  esit(await page.locator('#not').inputValue(), 'test notu', 'yenileme sonrası not (çevrimdışı)');
  db.hata = undefined;
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click();
  await page.getByText('Kayıtlı', { exact: true }).waitFor();
  const s = db.gunler.find((g) => g.tarih === '2026-11-22');
  esit(s?.veri.not, 'test notu', 'sunucudaki not');
  esit(s?.veri.gunlukToplam, 1, 'sunucudaki toplam');
});

await senaryo('Supabase 500 dönerse: anlaşılır hata, kayıt denemesinde girdi korunur', AKSAM, async (page, db) => {
  await page.goto(`${ADRES}/#/gunluk/2026-11-21`); await hazir(page);
  await page.locator('#saat-ekran').fill('3');
  db.hata = 500;
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click();
  await page.getByText('Sunucu hata verdi (500)').first().waitFor();
  esit(await page.locator('#saat-ekran').inputValue(), '3', 'ekran duruyor');
});

await senaryo('İlk açılışta 500: hata kutusu ve Tekrar dene', AKSAM, async (page, db) => {
  await page.goto(`${ADRES}/#/aylik`);
  await page.getByText('Sunucu hata verdi (500)').waitFor();
  db.hata = undefined;
  await page.getByRole('button', { name: 'Tekrar dene' }).click();
  await page.getByText('12 gün yazıldı').waitFor();
}, { hata: 500 });

await senaryo('İlk açılışta bağlantı yok: bağlantı hatası durumu', AKSAM, async (page) => {
  await page.goto(`${ADRES}/#/`);
  await page.getByText('Bağlantı yok.').waitFor();
}, { hata: 'baglanti' });

await senaryo('Önbellek: bir kez yüklendikten sonra bağlantı yokken veriler görünür', AKSAM, async (page, db) => {
  await page.goto(`${ADRES}/#/aylik/2026-11`); await page.getByText('12 gün yazıldı').waitFor();
  db.hata = 'baglanti';
  await page.reload();
  await metinVar(page, '12 gün yazıldı');
  await metinVar(page, 'Bağlantı yok.');
});

await senaryo('Boş ay ve veri yok durumu', AKSAM, async (page) => {
  await page.goto(`${ADRES}/#/aylik/2026-10`); await hazir(page);
  await page.getByText('Bu ay için kayıt yok').waitFor();
  esit(await page.locator('.ay-bas .alt').innerText(), '0 gün yazıldı', 'gün sayısı');
});

await senaryo('Hiç veri yok: ana ekran çökmez, seri 0, puanla düğmesi', AKSAM, async (page) => {
  await page.goto(`${ADRES}/#/`); await hazir(page);
  await page.getByRole('link', { name: 'Günü puanla' }).waitFor();
  await page.getByText('Son 7 günde kayıt yok').waitFor();
}, { gunler: [] });

await senaryo('Çakışma: başka cihaz kaydetmişse kullanıcıya gösterilir, seçim yapılır', AKSAM, async (page, db) => {
  await page.goto(`${ADRES}/#/gunluk/2026-11-21`); await hazir(page);
  await page.locator('#saat-uyku').fill('5');
  const s = db.gunler.find((g) => g.tarih === '2026-11-21');
  s.veri = { ...s.veri, uyku: 10 };
  s.updated_at = '2026-11-22T20:59:00+00:00';
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click();
  await page.getByText('başka bir cihazda').first().waitFor();
  esit(await page.locator('#saat-uyku').inputValue(), '5', 'girdi korunur');
  await page.getByRole('button', { name: 'Benimkini kaydet' }).first().click();
  await page.getByText('Kayıtlı', { exact: true }).waitFor();
  esit(s.veri.uyku, 5, 'sunucuda benimki');
});

await senaryo('Yoklama taslağı ezmez, dış değişiklik haber verilir; "Diğerini yükle"', AKSAM, async (page, db) => {
  await page.goto(`${ADRES}/#/gunluk/2026-11-21`); await hazir(page);
  await page.locator('#saat-uyku').fill('5');
  const s = db.gunler.find((g) => g.tarih === '2026-11-21');
  s.veri = { ...s.veri, uyku: 10 };
  s.updated_at = '2026-11-22T20:59:30+00:00';
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.getByText('Sen düzenlerken bu gün başka bir cihazda').waitFor();
  esit(await page.locator('#saat-uyku').inputValue(), '5', 'taslak ezilmedi');
  await page.getByRole('button', { name: 'Diğerini yükle' }).click();
  esit(await page.locator('#saat-uyku').inputValue(), '10', 'diğeri yüklendi');
});

await senaryo('Rutin işareti veritabanına gün anahtarıyla yazılır, yenileyince kalır', AKSAM, async (page, db) => {
  await page.goto(`${ADRES}/#/`); await hazir(page);
  await page.getByText('Yatış').click();
  await page.getByText('1 / 3 tamam').waitFor();
  await page.waitForFunction(() => true);
  await page.waitForTimeout(300);
  esit(JSON.stringify(db.rutin['2026-11-22']), '{"gece":["Yatış"]}', 'db işaret');
  await page.reload();
  await metinVar(page, '1 / 3 tamam');
});

await senaryo('Rutin adımı düzenle / kaydet', AKSAM, async (page, db) => {
  await page.goto(`${ADRES}/#/`); await hazir(page);
  await page.getByRole('button', { name: 'Düzenle' }).click();
  await page.getByRole('button', { name: '+ Adım ekle' }).click();
  await page.getByLabel('Gece adımı 4').fill('Diş fırçala');
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await page.getByText('0 / 4 tamam').waitFor();
  esit(db.ayar.find((a) => a.anahtar === 'program').veri.rutinler.gece.at(-1), 'Diş fırçala', 'db');
  esit(db.ayar.find((a) => a.anahtar === 'program').veri.yemek.length, 5, 'yemek korundu');
});

await senaryo('Madde ekle → payda 20; eski gün toplamı değişmez', AKSAM, async (page, db) => {
  await page.goto(`${ADRES}/#/gunluk/2026-11-15`); await hazir(page);
  esit(await toplam(page, 'Günlük hedefler'), '8,75 / 19', 'eski gün toplamı');
  await page.getByRole('button', { name: 'Maddeleri düzenle' }).click();
  await page.getByRole('button', { name: '+ Madde ekle' }).first().click();
  await page.getByLabel('Günlük hedefler maddesi 20').fill('Yeni madde');
  await page.locator('#madde-duzenle').getByRole('button', { name: 'Kaydet' }).click();
  await page.getByText('Maddeler kaydedildi.').waitFor();
  esit(await toplam(page, 'Günlük hedefler'), '8,75 / 20', 'eski gün toplamı aynı, payda 20');
  const k = db.ayar.find((a) => a.anahtar === 'kriterler').veri;
  esit(k.gunluk.length, 20, 'db madde sayısı');
  if (!/^g_/.test(k.gunluk[19].id)) throw new Error('yeni kimlik tekil değil: ' + k.gunluk[19].id);
});

await senaryo('Sekme yenilenince aynı kalır; satıra dokununca gün Günlük’te açılır', AKSAM, async (page) => {
  await page.goto(`${ADRES}/#/aylik/2026-11`); await hazir(page);
  await page.reload(); await hazir(page);
  esit(await page.locator('.sekme[aria-current=page]').innerText(), 'Aylık', 'aktif sekme');
  await page.getByRole('button', { name: 'Günler' }).click();
  await page.locator('tr', { hasText: '19 Kas' }).locator('td').nth(2).click();
  await page.waitForFunction(() => location.hash === '#/gunluk/2026-11-19');
  await page.locator('h1', { hasText: '19 Kasım 2026' }).waitFor();
});

await senaryo('Klavye: sekmeyle puan düğmesine odaklanılır, odak halkası görünür', AKSAM, async (page) => {
  await page.goto(`${ADRES}/#/gunluk/2026-11-21`); await hazir(page);
  await page.getByRole('button', { name: 'Spor: 0', exact: true }).focus();
  await page.keyboard.press('Tab');
  const stil = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle + ' ' + document.activeElement.getAttribute('aria-label'));
  esit(stil, 'solid Spor: 0,25', 'odak');
  await page.keyboard.press('Enter');
  esit(await page.getByRole('button', { name: 'Spor: 0,25' }).getAttribute('aria-pressed'), 'true', 'Enter ile seçilir');
  await page.keyboard.press('Enter');
  esit(await page.getByRole('button', { name: 'Spor: 0,25' }).getAttribute('aria-pressed'), 'false', 'tekrar basınca seçim kalkar');
});

await senaryo('Dokunma hedefleri en az 44 px (390 px)', AKSAM, async (page) => {
  for (const h of ['#/', '#/gunluk/2026-11-21', '#/aylik/2026-11', '#/rutinler']) {
    await page.goto(`${ADRES}/${h}`); await hazir(page);
    const kucuk = await page.evaluate(() => [...document.querySelectorAll('button, a, input, textarea, label.rutin-adim')]
      .filter((e) => e.offsetParent !== null && !e.closest('.sr-only') && !e.closest('p.bilgi') && !e.closest('label.rutin-adim input'))
      .map((e) => [e.textContent.trim().slice(0, 20) || e.getAttribute('aria-label'), Math.round(e.getBoundingClientRect().width), Math.round(e.getBoundingClientRect().height)])
      .filter(([, w, hh]) => hh < 44 || w < 44));
    // "Bugüne git" (36 px yükseklik) tasarımdaki gibi metin bağlantısı; başlıkla birlikte 44 px alan kaplar.
    const gercek = kucuk.filter(([t]) => t !== 'Bugüne git');
    if (gercek.length) throw new Error(`${h}: ${JSON.stringify(gercek)}`);
  }
});

await tarayici.close();
console.log(`\n${gecen} geçti, ${hatalar.length} geçmedi`);
process.exit(hatalar.length ? 1 : 0);
