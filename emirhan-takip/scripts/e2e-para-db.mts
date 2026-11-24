// GERÇEK veritabanı: test_ önekli hesap/işlem/abonelik/hedef yaz → oku → bakiyeleri doğrula → HEPSİNİ sil.
import '../scripts/ortak.mjs';
import { bakiyeler, toplamlar, type Hesap, type Islem } from '../src/lib/para/hesap.ts';
import { gunToplamlari } from '../src/lib/puan.ts';

const U = `${process.env.VITE_SUPABASE_URL}/rest/v1`;
const H = { apikey: process.env.VITE_SUPABASE_ANAHTAR!, 'Content-Type': 'application/json' };
const iste = async (yol: string, o: RequestInit & { prefer?: string } = {}) => {
  const r = await fetch(`${U}/${yol}`, { ...o, headers: { ...H, ...(o.prefer ? { Prefer: o.prefer } : {}) } });
  const t = await r.text();
  return { durum: r.status, veri: t ? JSON.parse(t) : null };
};
const ok = (k: unknown, m: string) => { if (!k) throw new Error('GEÇMEDİ: ' + m); console.log('GEÇTİ  ', m); };
const uuid = () => crypto.randomUUID();
const ID = { nakit: uuid(), kart: uuid(), usd: uuid() };
const ab = uuid(); const hedef = uuid();

// Önce gerçek veri sayıları
const gunOnce = (await iste('takip_gunluk?select=tarih,veri')).veri as { tarih: string; veri: any }[];
const paraOnce = (await iste('para_hesap?select=id')).veri.length;

try {
  const h = await iste('para_hesap?select=*', { method: 'POST', prefer: 'return=representation', body: JSON.stringify([
    { id: ID.nakit, ad: 'test_Nakit', tur: 'nakit', para_birimi: 'TRY', acilis_bakiyesi: 1000, limit_tutar: null, kesim_gunu: null },
    { id: ID.kart, ad: 'test_Kart', tur: 'kart', para_birimi: 'TRY', acilis_bakiyesi: 500, limit_tutar: 5000, kesim_gunu: 15 },
    { id: ID.usd, ad: 'test_Dolar', tur: 'birikim', para_birimi: 'USD', acilis_bakiyesi: 10, limit_tutar: null, kesim_gunu: null },
  ]) });
  ok(h.durum === 201 && h.veri.length === 3, `test hesapları yazıldı (HTTP ${h.durum} ${h.durum !== 201 ? JSON.stringify(h.veri) : ''})`);
  // PostgREST toplu eklemede tüm satırların anahtarları aynı olmalı
  const tam = (x: object) => ({ kategori: null, hedef_hesap_id: null, giren_tutar: null, nota: null, ...x });
  const i = await iste('para_islem?select=*', { method: 'POST', prefer: 'return=representation', body: JSON.stringify(([
    { id: uuid(), tarih: '2026-11-24', tur: 'gider', kategori: 'Yemek', hesap_id: ID.nakit, tutar: 150.25, nota: 'test_' },
    { id: uuid(), tarih: '2026-11-24', tur: 'gider', kategori: 'Market', hesap_id: ID.kart, tutar: 100 },
    { id: uuid(), tarih: '2026-11-24', tur: 'transfer', hesap_id: ID.nakit, hedef_hesap_id: ID.kart, tutar: 200, giren_tutar: 200 },
    { id: uuid(), tarih: '2026-11-24', tur: 'transfer', hesap_id: ID.nakit, hedef_hesap_id: ID.usd, tutar: 505.2, giren_tutar: 10 },
  ] as object[]).map(tam)) });
  ok(i.durum === 201 && i.veri.length === 4, 'test işlemleri yazıldı');
  const kotu = await iste('para_islem', { method: 'POST', body: JSON.stringify({ tarih: '2026-11-24', tur: 'transfer', hesap_id: ID.nakit, tutar: 1 }) });
  ok(kotu.durum === 400, 'eksik transfer alanı veritabanında reddedildi (check kısıtı)');

  const hs: Hesap[] = (await iste(`para_hesap?select=*&id=in.(${Object.values(ID).join(',')})`)).veri;
  const is: Islem[] = (await iste(`para_islem?select=*&hesap_id=in.(${Object.values(ID).join(',')})`)).veri;
  const b = bakiyeler(hs, is);
  ok(b.get(ID.nakit) === 100000 - 15025 - 20000 - 50520, `nakit bakiye ${b.get(ID.nakit)! / 100} (1000 − 150,25 − 200 − 505,20)`);
  ok(b.get(ID.kart) === 50000 + 10000 - 20000, `kart borcu ${b.get(ID.kart)! / 100} (500 + 100 − 200)`);
  ok(b.get(ID.usd) === 2000, `dolar ${b.get(ID.usd)! / 100} $ (10 + 10)`);

  const a = await iste('para_abonelik?select=*', { method: 'POST', prefer: 'return=representation', body: JSON.stringify({ id: ab, ad: 'test_Abonelik', tutar: 40, gun: 26, hesap_id: ID.kart, kategori: 'Abonelik' }) });
  ok(a.durum === 201, 'test aboneliği yazıldı');
  const T1 = toplamlar(hs, b, a.veri, [], '2026-11-24', 50);
  ok(T1.yaklasan === 4000, 'abonelik yaklaşan ödemede');
  const islemId = uuid();
  const o1 = await iste('rpc/para_abonelik_ode', { method: 'POST', body: JSON.stringify({ p_abonelik: ab, p_ay: '2026-11', p_islem: islemId, p_tarih: '2026-11-24' }) });
  const o2 = await iste('rpc/para_abonelik_ode', { method: 'POST', body: JSON.stringify({ p_abonelik: ab, p_ay: '2026-11', p_islem: uuid(), p_tarih: '2026-11-24' }) });
  ok(o1.durum === 200 && o2.durum === 409, `"Ödendi" bir kez (ikinci deneme HTTP ${o2.durum})`);
  const sayi = (await iste(`para_islem?select=id&abonelik_id=eq.${ab}`)).veri.length;
  ok(sayi === 1, 'aynı ay için tek gider işlemi var (ikinci denemenin yarım kaydı geri alındı)');
  await iste('rpc/para_abonelik_geri_al', { method: 'POST', body: JSON.stringify({ p_abonelik: ab, p_ay: '2026-11' }) });
  const sonra = await iste(`para_abonelik_odeme?select=*&abonelik_id=eq.${ab}`);
  const isl = await iste(`para_islem?select=id&id=eq.${islemId}`);
  ok(sonra.veri.length === 0 && isl.veri.length === 0, 'Geri al: işaret ve işlem silindi');

  const sil = await iste(`para_hesap?id=eq.${ID.nakit}`, { method: 'DELETE' });
  ok(sil.durum === 409 && sil.veri?.code === '23503', 'işlemi olan hesap silinemez (arşivle önerilir)');

  const hd = await iste('para_hedef', { method: 'POST', body: JSON.stringify({ id: hedef, ad: 'test_Hedef', hedef_tutar: 100, para_birimi: 'USD', bagli_hesap_id: ID.usd }) });
  ok(hd.durum === 201, 'test hedefi yazıldı');

  const g1 = (await iste(`para_islem?select=updated_at&id=eq.${i.veri[0].id}`)).veri[0].updated_at;
  const p1 = await iste(`para_islem?id=eq.${i.veri[0].id}&updated_at=eq.${encodeURIComponent(g1)}&select=id`, { method: 'PATCH', prefer: 'return=representation', body: JSON.stringify({ tutar: 151 }) });
  const p2 = await iste(`para_islem?id=eq.${i.veri[0].id}&updated_at=eq.${encodeURIComponent(g1)}&select=id`, { method: 'PATCH', prefer: 'return=representation', body: JSON.stringify({ tutar: 152 }) });
  ok(p1.veri.length === 1 && p2.veri.length === 0, 'eski updated_at ile güncelleme 0 satır (çakışma yakalanır)');

  const kur = await iste('takip_ayar?select=anahtar&anahtar=eq.para_kategoriler');
  ok(kur.veri.length === 1, 'para_kategoriler ayarı var');
} finally {
  const idler = Object.values(ID).join(',');
  await iste(`para_hedef?id=eq.${hedef}`, { method: 'DELETE' });
  await iste(`para_islem?or=(hesap_id.in.(${idler}),hedef_hesap_id.in.(${idler}))`, { method: 'DELETE' });
  await iste(`para_abonelik?id=eq.${ab}`, { method: 'DELETE' });
  await iste(`para_hesap?id=in.(${idler})`, { method: 'DELETE' });
}
const kalan = await Promise.all(['para_hesap', 'para_islem', 'para_abonelik', 'para_abonelik_odeme', 'para_hedef'].map(async (t) => [t, (await iste(`${t}?select=*`)).veri] as const));
const test = kalan.flatMap(([t, v]) => (v as any[]).filter((x) => JSON.stringify(x).includes('test_')).map(() => t));
ok(test.length === 0, 'tüm test_ satırları silindi');
ok((await iste('para_hesap?select=id')).veri.length === paraOnce, `para_hesap satır sayısı başlangıçtaki gibi (${paraOnce})`);
const gunSonra = (await iste('takip_gunluk?select=tarih,veri')).veri as { tarih: string; veri: any }[];
ok(gunSonra.length === gunOnce.length && gunSonra.length === 82, `Günlük verisi yerinde (${gunSonra.length} gün)`);
const t = (d: string) => gunToplamlari(gunSonra.find((x) => x.tarih === d)!.veri);
ok(JSON.stringify([t('2026-11-19'), t('2026-11-20'), t('2026-11-21')]) === JSON.stringify([{ gunluk: 12.75, saglik: 4.5 }, { gunluk: 7.5, saglik: 3.25 }, { gunluk: 7.25, saglik: 2.25 }]), '19/20/21 Kasım toplamları 12,75/4,5 · 7,5/3,25 · 7,25/2,25');
