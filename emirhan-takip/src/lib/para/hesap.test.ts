import { describe, expect, it } from 'vitest';
import {
  abonelikDurumu, ayDonemi, bakiyeler, butceDurumlari, haftaDonemi, hedefDurumu, karsilastirma, kurus, ozet,
  paraBicim, sonAylar, toplamlar, transferGiren, tutarAyristir, yilDonemi,
  type Abonelik, type AbonelikOdeme, type Hesap, type Islem,
} from './hesap';
import { etkinGun } from '../tarih';

// ---- Tasarımdaki örnek veri (Money.dc.html), Kasım 2026, kur 50,52, bugün 24 Kasım ----
const KUR = 50.52;
const BUGUN = '2026-11-24';
const h = (id: string, tur: Hesap['tur'], bal: number, para_birimi: Hesap['para_birimi'] = 'TRY', limit_tutar: number | null = null): Hesap =>
  ({ id, ad: id, tur, para_birimi, acilis_bakiyesi: bal, limit_tutar, kesim_gunu: null, sira: 0, arsiv: false });
const HESAP_SON = [
  h('nakit', 'nakit', 1370), h('ana', 'banka', 4850), h('garanti', 'kart', 2340, 'TRY', 10000),
  h('yapikredi', 'kart', 640, 'TRY', 5000), h('midas', 'birikim', 80.52, 'USD'), h('phantom', 'birikim', 25, 'USD'),
];
let n = 0;
const t = (gun: number, tur: Islem['tur'], kategori: string | null, hesap_id: string, tutar: number, ek: Partial<Islem> = {}): Islem =>
  ({ id: `t${++n}`, tarih: `2026-11-${String(gun).padStart(2, '0')}`, tur, kategori, hesap_id, hedef_hesap_id: null, tutar, giren_tutar: null, nota: null, abonelik_id: null, ...ek });
const ISLEMLER: Islem[] = [
  t(24, 'gider', 'Yemek', 'nakit', 185), t(24, 'gider', 'Ulaşım', 'ana', 40),
  t(23, 'transfer', null, 'yapikredi', 277, { hedef_hesap_id: 'midas', giren_tutar: 5.48 }),
  t(22, 'gider', 'Market', 'garanti', 320), t(22, 'gider', 'Yemek', 'nakit', 150),
  t(21, 'gelir', 'Harçlık', 'ana', 2000), t(20, 'gider', 'Abonelik', 'garanti', 100, { nota: 'Spotify' }),
  t(18, 'gider', 'Ulaşım', 'ana', 120), t(18, 'gider', 'Kişisel bakım', 'yapikredi', 250),
  t(15, 'gider', 'Eğitim', 'garanti', 380), t(12, 'gider', 'Yemek', 'nakit', 210),
  t(10, 'gider', 'Market', 'ana', 290), t(5, 'gider', 'Fatura', 'ana', 350, { nota: 'Telefon faturası' }),
  t(1, 'gelir', 'Harçlık', 'ana', 3000),
];
const a = (id: string, ad: string, tutar: number, gun: number, hesap_id: string, kategori: string): Abonelik =>
  ({ id, ad, tutar, para_birimi: 'TRY', gun, hesap_id, kategori, aktif: true });
const ABONELIKLER = [
  a('s1', 'Telefon faturası', 350, 5, 'ana', 'Fatura'), a('s2', 'Spotify', 100, 20, 'garanti', 'Abonelik'),
  a('s3', 'iCloud', 40, 26, 'garanti', 'Abonelik'), a('s4', 'İnternet paketi', 250, 30, 'ana', 'Fatura'),
];
const ODEMELER: AbonelikOdeme[] = [{ abonelik_id: 's1', ay: '2026-11', islem_id: 'x1' }, { abonelik_id: 's2', ay: '2026-11', islem_id: 'x2' }];

/** Tasarımdaki bakiyeler "son" bakiyelerdir; açılış = son − işlemlerin etkisi. */
function acilislar(): Hesap[] {
  const etki = bakiyeler(HESAP_SON.map((x) => ({ ...x, acilis_bakiyesi: 0 })), ISLEMLER);
  return HESAP_SON.map((x) => ({ ...x, acilis_bakiyesi: (kurus(x.acilis_bakiyesi) - etki.get(x.id)!) / 100 }));
}

describe('tasarım örneği (elle hesaplanan değerler)', () => {
  const hesaplar = acilislar();
  const bak = bakiyeler(hesaplar, ISLEMLER);
  it('işlemlerden türetilen bakiyeler tasarımdakiyle aynı', () => {
    expect(bak.get('nakit')).toBe(137000);
    expect(bak.get('ana')).toBe(485000);
    expect(bak.get('garanti')).toBe(234000);
    expect(bak.get('yapikredi')).toBe(64000);
    expect(bak.get('midas')).toBe(8052);
    expect(bak.get('phantom')).toBe(2500);
  });
  const T = toplamlar(hesaplar, bak, ABONELIKLER, ODEMELER, BUGUN, KUR);
  it('Harcayabileceğim 2.950,00 ₺ (yaklaşan: iCloud 40 + İnternet 250)', () => {
    expect(T.yaklasan).toBe(29000);
    expect(paraBicim(T.harcayabilecegim)).toBe('2.950,00 ₺');
  });
  it('Net varlık ≈ 8.570,87 ₺', () => {
    expect(paraBicim(T.netVarlik)).toBe('8.570,87 ₺');
    expect(T.kurEksik).toBe(false);
  });
  it('Günlük: 7 gün kaldı → 421,43 ₺', () => {
    expect(T.kalanGun).toBe(7);
    expect(paraBicim(T.gunluk)).toBe('421,43 ₺');
  });
  it('Kasım: gelir 5.000, gider 2.395, kalan 2.605 (transfer hariç)', () => {
    const o = ozet(ISLEMLER, hesaplar, ayDonemi('2026-11'), KUR);
    expect([o.gelir, o.gider, o.kalan]).toEqual([500000, 239500, 260500]);
    expect(o.kategoriler[0]).toMatchObject({ ad: 'Market', tutar: 61000 });
    expect(o.kartHarcama).toBe(32000 + 10000 + 25000 + 38000);
  });
  it('bütçeler: Market aşıldı, Yemek ve Kişisel bakım yakın', () => {
    const b = butceDurumlari([{ kategori: 'Yemek', limit_tutar: 600 }, { kategori: 'Market', limit_tutar: 500 }, { kategori: 'Kişisel bakım', limit_tutar: 300 }, { kategori: 'Ulaşım', limit_tutar: 400 }], ISLEMLER, hesaplar, '2026-11', KUR);
    expect(b.map((x) => [x.kategori, x.harcanan, x.asildi, x.yakin])).toEqual([
      ['Yemek', 54500, false, true], ['Market', 61000, true, false], ['Kişisel bakım', 25000, false, true], ['Ulaşım', 16000, false, false],
    ]);
  });
  it('hedef: bağlı hesap bakiyesi / elle tutar', () => {
    expect(hedefDurumu({ id: 'h', ad: 'Dolar', hedef_tutar: 500, para_birimi: 'USD', bagli_hesap_id: 'midas', mevcut_tutar: null }, bak)).toMatchObject({ mevcut: 8052, kalan: 41948, yuzde: 16 });
    expect(hedefDurumu({ id: 'h', ad: 'Laptop', hedef_tutar: 40000, para_birimi: 'TRY', bagli_hesap_id: null, mevcut_tutar: 6500 }, bak)).toMatchObject({ mevcut: 650000, yuzde: 16 });
  });
});

describe('bakiye etkileri', () => {
  const hs = [h('banka', 'banka', 1000), h('kart', 'kart', 500), h('usd', 'birikim', 10, 'USD')];
  it('kartla harcama borcu artırır', () => {
    expect(bakiyeler(hs, [t(1, 'gider', 'Market', 'kart', 100)]).get('kart')).toBe(60000);
  });
  it('kart ödemesi (bankadan karta transfer) borcu düşürür, bankayı azaltır', () => {
    const b = bakiyeler(hs, [t(1, 'transfer', null, 'banka', 300, { hedef_hesap_id: 'kart', giren_tutar: 300 })]);
    expect(b.get('kart')).toBe(20000);
    expect(b.get('banka')).toBe(70000);
  });
  it('karta gelir (iade) borcu azaltır', () => {
    expect(bakiyeler(hs, [t(1, 'gelir', 'Diğer gelir', 'kart', 50)]).get('kart')).toBe(45000);
  });
  it('₺→$ transfer iki tutarla çalışır', () => {
    const b = bakiyeler(hs, [t(1, 'transfer', null, 'banka', 505.2, { hedef_hesap_id: 'usd', giren_tutar: 10 })]);
    expect(b.get('banka')).toBe(100000 - 50520);
    expect(b.get('usd')).toBe(2000);
    expect(transferGiren(50520, 'TRY', 'USD', 50.52)).toBe(1000);
    expect(transferGiren(1000, 'USD', 'TRY', 50.52)).toBe(50520);
    expect(transferGiren(1000, 'TRY', 'TRY', null)).toBe(1000);
    expect(transferGiren(1000, 'TRY', 'USD', null)).toBeNull();
  });
  it('işlem silmek bakiyeyi geri alır (türetme)', () => {
    const i = [t(1, 'gider', 'Yemek', 'banka', 123.45)];
    expect(bakiyeler(hs, i).get('banka')).toBe(100000 - 12345);
    expect(bakiyeler(hs, []).get('banka')).toBe(100000);
  });
  it('kuruş hatası yok (0,1 + 0,2)', () => {
    const b = bakiyeler([h('x', 'nakit', 0)], [t(1, 'gelir', 'X', 'x', 0.1), t(1, 'gelir', 'X', 'x', 0.2)]);
    expect(b.get('x')).toBe(30);
  });
});

describe('abonelik', () => {
  const s = a('s', 'Netflix', 100, 31, 'ana', 'Abonelik');
  it('ödenince bu ay yaklaşan değil, sıradaki gelecek ay', () => {
    const d = abonelikDurumu(s, [{ abonelik_id: 's', ay: '2026-11', islem_id: 'i' }], '2026-11-24');
    expect(d).toMatchObject({ odendi: true, yaklasan: false, siradaki: '2026-12-31' });
  });
  it('31 günlü abonelik Kasım’da 30’una, Şubat’ta 28’ine düşer', () => {
    expect(abonelikDurumu(s, [], '2026-11-24')).toMatchObject({ kalanGun: 6, siradaki: '2026-11-30', yaklasan: true });
    expect(abonelikDurumu(s, [], '2027-02-27')).toMatchObject({ kalanGun: 1, yakin: true, siradaki: '2027-02-28' });
  });
  it('ödeme işareti her ay sıfırlanır (önceki ayın işareti bu ayı etkilemez)', () => {
    expect(abonelikDurumu(s, [{ abonelik_id: 's', ay: '2026-10', islem_id: 'i' }], '2026-11-24').odendi).toBe(false);
  });
  it('günü geçmiş ve ödenmemiş: bu ay yaklaşan sayılmaz; yılbaşında sıradaki Ocak', () => {
    const k = a('k', 'X', 10, 5, 'ana', 'Fatura');
    expect(abonelikDurumu(k, [], '2026-12-24')).toMatchObject({ yaklasan: false, siradaki: '2027-01-05' });
  });
  it('bugün ödenecekse kalan 0 ve yakın', () => {
    expect(abonelikDurumu(a('b', 'X', 10, 24, 'ana', 'F'), [], '2026-11-24')).toMatchObject({ kalanGun: 0, yakin: true, yaklasan: true });
  });
});

describe('kur yokken', () => {
  it('çökmez; USD dahil edilmez, kurEksik işaretlenir', () => {
    const hs = [h('n', 'nakit', 100), h('u', 'birikim', 50, 'USD')];
    const T = toplamlar(hs, bakiyeler(hs, []), [], [], '2026-11-24', null);
    expect(T.netVarlik).toBe(10000);
    expect(T.harcayabilecegim).toBe(10000);
    expect(T.kurEksik).toBe(true);
  });
  it('arşivlenen hesap toplamlara girmez', () => {
    const hs = [h('n', 'nakit', 100), { ...h('e', 'banka', 999), arsiv: true }];
    expect(toplamlar(hs, bakiyeler(hs, []), [], [], '2026-11-24', 50).netVarlik).toBe(10000);
  });
});

describe('dönemler, ay/yıl sınırı, 05:00 kuralı', () => {
  const hs = [h('n', 'nakit', 0)];
  const i = [t(1, 'gider', 'Y', 'n', 10, { tarih: '2026-12-31' }), t(1, 'gider', 'Y', 'n', 20, { tarih: '2027-01-01' }), t(1, 'gelir', 'H', 'n', 5, { tarih: '2026-11-30' })];
  it('ay ve yıl sınırı', () => {
    expect(ozet(i, hs, ayDonemi('2026-12'), 1).gider).toBe(1000);
    expect(ozet(i, hs, ayDonemi('2027-01'), 1).gider).toBe(2000);
    expect(ozet(i, hs, yilDonemi(2026), 1)).toMatchObject({ gider: 1000, gelir: 500 });
    expect(haftaDonemi('2027-01-02')).toEqual({ bas: '2026-12-27', bit: '2027-01-02' });
    expect(sonAylar(i, hs, '2027-01', 1).map((x) => x.ay)).toEqual(['2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01']);
  });
  it('işlem tarihi 05:00 kuralı: 1 Ocak 03:00 → 31 Aralık', () => {
    expect(etkinGun(new Date(2027, 0, 1, 3, 0))).toBe('2026-12-31');
  });
  it('karşılaştırma cümlesi', () => {
    expect(karsilastirma(239500, 272000)).toBe('Geçen aya göre gider %12 az');
    expect(karsilastirma(100, 0)).toBe('Geçen ay gider kaydı yok');
  });
});

describe('biçim ve ayrıştırma', () => {
  it('para biçimi', () => {
    expect(paraBicim(137000)).toBe('1.370,00 ₺');
    expect(paraBicim(8052, 'USD')).toBe('80,52 $');
    expect(paraBicim(-64000)).toBe('−640,00 ₺');
    expect(paraBicim(123456789)).toBe('1.234.567,89 ₺');
    expect(paraBicim(0)).toBe('0,00 ₺');
  });
  it('tutar ayrıştırma', () => {
    expect(tutarAyristir('1.370,50')).toBe(137050);
    expect(tutarAyristir('1370,5')).toBe(137050);
    expect(tutarAyristir('1370.50')).toBe(137050);
    expect(tutarAyristir('1.370')).toBe(137000);
    expect(tutarAyristir('150')).toBe(15000);
    expect(tutarAyristir('')).toBeNull();
    expect(Number.isNaN(tutarAyristir('abc') as number)).toBe(true);
    expect(Number.isNaN(tutarAyristir('1,234,5') as number)).toBe(true);
  });
});
