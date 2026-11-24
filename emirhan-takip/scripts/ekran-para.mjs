// Para: 6 görünümün 390 ve 1200 px ekran görüntüsü + durumlar (tasarım örnek verisiyle, 24 Kasım 2026 20:00).
import { mkdirSync } from 'node:fs';
import { ADRES, chromium, paraOrnek, sahteSupabase } from './ortak.mjs';
import { PID } from './para-ornek.mjs';

mkdirSync('docs/ekran', { recursive: true });
const hazir = (page) => page.waitForFunction(() => document.querySelector('main') && !document.querySelector('.iskelet'));
const GORUNUMLER = [
  ['para-hesaplar', '#/para'],
  ['para-detay', `#/para/hesap/${PID.ana}`],
  ['para-islemler', '#/para/islemler', async (p) => { await p.getByLabel('Tutar ₺').fill('150'); }],
  ['para-transfer', '#/para/islemler/transfer', async (p) => {
    const nereden = p.getByRole('group', { name: 'Nereden' });
    await nereden.getByRole('button', { name: 'Yapıkredi' }).click();
    await p.getByRole('group', { name: 'Nereye' }).getByRole('button', { name: 'Midas' }).click();
    await p.getByLabel('Çıkan ₺').fill('277');
  }],
  ['para-ozet', '#/para/ozet/2026-11'],
  ['para-plan', '#/para/plan'],
  ['ana-para-karti', '#/'],
];
const tarayici = await chromium.launch();
for (const [ad, w, h] of [['mobil', 390, 844], ['masaustu', 1200, 900]]) {
  const ctx = await tarayici.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, timezoneId: 'Europe/Istanbul' });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date('2026-11-24T20:00:00+03:00'));
  await sahteSupabase(page, { para: paraOrnek() });
  for (const [s, hash, hazirla] of GORUNUMLER) {
    await page.goto(`${ADRES}/${hash}`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await hazir(page);
    await page.waitForTimeout(400);
    if (hazirla) await hazirla(page);
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: '.ust,.hizli,.hizli-alt{position:static!important}' });
    await page.waitForTimeout(200);
    await page.screenshot({ path: `docs/ekran/${ad}-${s}.png`, fullPage: true });
    console.log(`docs/ekran/${ad}-${s}.png`);
  }
  await ctx.close();
}
// Durumlar (mobil): kur alınamadı, hiç hesap yok
for (const [s, secenek] of [['kur-alinamadi', { para: paraOrnek(), kurHata: true, kur: { kur: 50.4, tarih: '2026-11-23T09:00:00Z', kaynak: 'ExchangeRate-API' } }], ['hesap-yok', {}]]) {
  const ctx = await tarayici.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: 'Europe/Istanbul' });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date('2026-11-24T20:00:00+03:00'));
  await sahteSupabase(page, secenek);
  await page.goto(`${ADRES}/#/para`);
  await hazir(page);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `docs/ekran/mobil-para-${s}.png`, fullPage: true });
  console.log(`docs/ekran/mobil-para-${s}.png`);
  await ctx.close();
}
await tarayici.close();
