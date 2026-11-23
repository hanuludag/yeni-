// Gerçek veritabanıyla uçtan uca: 2099-01-01 test günü yaz → oku → çakışma kontrolü → sil.
// Gerçek günlere dokunmaz. ADRES verilmez; doğrudan Supabase REST.
import { ANAHTAR, SUPABASE } from './ortak.mjs';

const T = process.env.TEST_TARIH ?? '2099-01-01';
const REST = `${SUPABASE}/rest/v1`;
const h = { apikey: ANAHTAR, 'Content-Type': 'application/json' };
const ok = (k, m) => { if (!k) throw new Error(m); console.log('GEÇTİ  ', m); };
const iste = async (yol, ayar = {}) => {
  const r = await fetch(`${REST}/${yol}`, { ...ayar, headers: { ...h, ...(ayar.headers ?? {}) } });
  const t = await r.text();
  return { durum: r.status, veri: t ? JSON.parse(t) : null };
};

const once = await iste('takip_gunluk?select=tarih');
const sayi = once.veri.length;
ok(once.durum === 200 && sayi > 0, `okuma (${sayi} gün)`);

try {
  const yaz = await iste('takip_gunluk?select=*', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ tarih: T, veri: { date: T, hedefler: { g1: 0.25 }, gunlukToplam: 0.25, not: 'e2e test' } }) });
  ok(yaz.durum === 201 && yaz.veri[0].tarih === T, `yazma ${T}`);
  const u1 = yaz.veri[0].updated_at;

  const tekrar = await iste('takip_gunluk', { method: 'POST', body: JSON.stringify({ tarih: T, veri: {} }) });
  ok(tekrar.durum === 409, 'aynı gün ikinci POST → 409 (sessizce üstüne yazmaz)');

  const oku = await iste(`takip_gunluk?tarih=eq.${T}&select=*`);
  ok(oku.veri[0].veri.gunlukToplam === 0.25, 'geri okuma');

  const g1 = await iste(`takip_gunluk?tarih=eq.${T}&updated_at=eq.${encodeURIComponent(u1)}&select=*`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ veri: { date: T, gunlukToplam: 1 } }) });
  ok(g1.veri.length === 1 && g1.veri[0].updated_at !== u1, 'koşullu güncelleme (updated_at tetikleyicisi yeni zaman verdi)');

  const g2 = await iste(`takip_gunluk?tarih=eq.${T}&updated_at=eq.${encodeURIComponent(u1)}&select=*`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ veri: { date: T, gunlukToplam: 9 } }) });
  ok(g2.veri.length === 0, 'eski updated_at ile güncelleme → 0 satır (çakışma algılanır)');

  const r1 = await iste('takip_rutin_isaret?on_conflict=tarih', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ tarih: T, veri: { gece: ['Yatış'] } }) });
  const r2 = await iste('takip_rutin_isaret?on_conflict=tarih', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ tarih: T, veri: { gece: [] } }) });
  const r3 = await iste(`takip_rutin_isaret?tarih=eq.${T}&select=veri`);
  ok([200, 201].includes(r1.durum) && [200, 201].includes(r2.durum) && JSON.stringify(r3.veri[0].veri) === '{"gece":[]}', 'rutin işareti upsert');
} finally {
  await iste(`takip_gunluk?tarih=eq.${T}`, { method: 'DELETE' });
  await iste(`takip_rutin_isaret?tarih=eq.${T}`, { method: 'DELETE' });
}
const son = await iste(`takip_gunluk?tarih=eq.${T}&select=tarih`);
ok(son.veri.length === 0, 'test günü silindi');
const sonra = await iste('takip_gunluk?select=tarih');
ok(sonra.veri.length === sayi, `gerçek gün sayısı değişmedi (${sayi})`);
