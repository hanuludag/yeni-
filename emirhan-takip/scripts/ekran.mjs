// 390 px ve 1200 px'te 4 sekmenin ekran görüntüsü (tasarımdaki örnek veriyle, saat 22 Kasım 2026 21:00).
// Kullanım: npm run build && npm run preview & ; npm run ekran
// GERCEK=1 ile gerçek veritabanından alır ve git dışı docs/ekran-gercek/ klasörüne yazar.
import { mkdirSync } from 'node:fs';
import { ADRES, SUPABASE, chromium, sahteSupabase } from './ortak.mjs';

// GERCEK modda yalnızca okuma: Supabase GET istekleri Node üzerinden iletilir (vekil sunucu olan ortamlarda da çalışsın).
async function gercekOku(page) {
  await page.route(`${SUPABASE}/**`, async (route) => {
    const r = route.request();
    if (r.method() !== 'GET') return route.abort();
    const y = await fetch(r.url(), { headers: { apikey: r.headers()['apikey'] } });
    route.fulfill({ status: y.status, contentType: 'application/json', body: await y.text() });
  });
}

const gercek = !!process.env.GERCEK;
const klasor = gercek ? 'docs/ekran-gercek' : 'docs/ekran';
mkdirSync(klasor, { recursive: true });

const SAYFALAR = [
  ['ana', '#/'],
  ['gunluk', '#/gunluk/2026-11-21'],
  ['aylik', '#/aylik/2026-11'],
  ['rutinler', '#/rutinler'],
];
const tarayici = await chromium.launch();
for (const [ad, w, h] of [['mobil', 390, 844], ['masaustu', 1200, 900]]) {
  const ctx = await tarayici.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
  const page = await ctx.newPage();
  if (!gercek) await page.clock.setFixedTime(new Date('2026-11-22T21:00:00+03:00'));
  if (!gercek) await sahteSupabase(page);
  else await gercekOku(page);
  for (const [s, hash] of SAYFALAR) {
    await page.goto(`${ADRES}/${gercek && s === 'gunluk' ? '#/gunluk' : hash}`);
    await page.waitForSelector('main:not(:has(.iskelet))');
    await page.evaluate(() => document.fonts.ready);
    if (s === 'aylik') await page.getByRole('button', { name: 'Günler' }).click();
    // Tam sayfa görüntüde yapışkan başlık/çubuk ortada görünmesin
    await page.addStyleTag({ content: '.ust,.kaydet-cubugu{position:static!important}' });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${klasor}/${ad}-${s}.png`, fullPage: true });
    console.log(`${klasor}/${ad}-${s}.png`);
  }
  await ctx.close();
}
await tarayici.close();
