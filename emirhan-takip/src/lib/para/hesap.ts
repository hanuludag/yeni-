/**
 * Para hesap mantığı (saf fonksiyonlar). Tüm tutarlar içeride KURUŞ (tam sayı) olarak hesaplanır;
 * kayan nokta hatası olmasın diye. Veritabanı numeric(14,2) → kurus() ile çevrilir.
 */
import { ayGunSayisi, ayEkle, gunEkle, parcala } from '../tarih';

export type HesapTuru = 'nakit' | 'banka' | 'kart' | 'birikim';
export type Birim = 'TRY' | 'USD';
export type IslemTuru = 'gider' | 'gelir' | 'transfer';

export interface Hesap {
  id: string; ad: string; tur: HesapTuru; para_birimi: Birim;
  acilis_bakiyesi: number; limit_tutar: number | null; kesim_gunu: number | null;
  sira: number; arsiv: boolean; updated_at?: string;
}
export interface Islem {
  id: string; tarih: string; tur: IslemTuru; kategori: string | null;
  hesap_id: string; hedef_hesap_id: string | null;
  tutar: number; giren_tutar: number | null; nota: string | null;
  abonelik_id: string | null; updated_at?: string;
}
export interface Butce { kategori: string; limit_tutar: number; updated_at?: string }
export interface Abonelik {
  id: string; ad: string; tutar: number; para_birimi: Birim; gun: number;
  hesap_id: string; kategori: string; aktif: boolean; updated_at?: string;
}
export interface AbonelikOdeme { abonelik_id: string; ay: string; islem_id: string }
export interface Hedef {
  id: string; ad: string; hedef_tutar: number; para_birimi: Birim;
  bagli_hesap_id: string | null; mevcut_tutar: number | null; updated_at?: string;
}
export interface Kategoriler { gider: string[]; gelir: string[] }

export const TUR_AD: Record<HesapTuru, string> = { nakit: 'Nakit', banka: 'Banka', kart: 'Kredi kartı', birikim: 'Birikim' };
export const VARSAYILAN_KATEGORILER: Kategoriler = {
  gider: ['Yemek', 'Market', 'Ulaşım', 'Fatura', 'Abonelik', 'Eğitim', 'Kişisel bakım', 'Diğer'],
  gelir: ['Harçlık', 'Diğer gelir'],
};

/** TL/$ → kuruş/sent (tam sayı) */
export function kurus(n: number | null | undefined): number {
  if (n === null || n === undefined || !Number.isFinite(n)) return 0;
  return Math.round(n * 100 + (n >= 0 ? 1e-7 : -1e-7));
}
export const tl = (k: number) => k / 100;

/** "1.370,00 ₺", "80,52 $", "−640,00 ₺" (eksi işareti U+2212) */
export function paraBicim(k: number, birim: Birim = 'TRY'): string {
  const neg = k < 0;
  const a = Math.abs(Math.round(k));
  const tam = Math.floor(a / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const ks = String(a % 100).padStart(2, '0');
  return `${neg ? '−' : ''}${tam},${ks} ${birim === 'USD' ? '$' : '₺'}`;
}

/** Kur metni: 50,52 */
export function kurBicim(kur: number): string {
  return kur.toFixed(2).replace('.', ',');
}

/**
 * Kullanıcı tutarı → kuruş. "1.370,50", "1370,5", "1370.50", "1370" kabul.
 * Boş → null, geçersiz → NaN.
 */
export function tutarAyristir(s: string): number | null {
  let t = s.trim().replace(/\s|₺|\$/g, '');
  if (t === '') return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ''); // 1.370 → 1370
  if (!/^\d+(\.\d{0,2})?$|^\.\d{1,2}$/.test(t)) return NaN;
  return kurus(Number(t));
}

/** Kur metni (4 ondalığa kadar) → sayı */
export function kurAyristir(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : NaN;
}

// ---------- Bakiye ----------

/** Hesap bakiyeleri (kuruş). Kart için değer BORÇTUR (pozitif = borç). */
export function bakiyeler(hesaplar: Hesap[], islemler: Islem[]): Map<string, number> {
  const b = new Map<string, number>();
  const tur = new Map<string, HesapTuru>();
  for (const h of hesaplar) { b.set(h.id, kurus(h.acilis_bakiyesi)); tur.set(h.id, h.tur); }
  // Bakiyeye "para girişi" etkisi: kartta borç azalır, diğerlerinde bakiye artar.
  const gir = (id: string | null, k: number) => {
    if (!id || !b.has(id)) return;
    b.set(id, b.get(id)! + (tur.get(id) === 'kart' ? -k : k));
  };
  for (const i of islemler) {
    const t = kurus(i.tutar);
    if (i.tur === 'gider') gir(i.hesap_id, -t);
    else if (i.tur === 'gelir') gir(i.hesap_id, t);
    else { gir(i.hesap_id, -t); gir(i.hedef_hesap_id, kurus(i.giren_tutar ?? i.tutar)); }
  }
  return b;
}

/** Bir tutarın TL karşılığı (kuruş). USD için kur yoksa null. */
export function tlKarsiligi(k: number, birim: Birim, kur: number | null): number | null {
  if (birim === 'TRY') return k;
  return kur ? Math.round(k * kur) : null;
}

// ---------- Abonelik ----------

/** Ayın gerçek ödeme günü (31 → Şubat'ta 28/29). */
export function abonelikGunu(gun: number, ay: string): number {
  const [y, m] = ay.split('-').map(Number);
  return Math.min(gun, ayGunSayisi(y, m));
}

export function abonelikOdendi(a: Abonelik, odemeler: AbonelikOdeme[], ay: string): boolean {
  return odemeler.some((o) => o.abonelik_id === a.id && o.ay === ay);
}

export interface AbonelikDurumu {
  odendi: boolean;
  /** bu ay ödenecek ve henüz ödenmemiş (gün bugün veya sonrası) */
  yaklasan: boolean;
  kalanGun: number | null;
  yakin: boolean;
  siradaki: string; // ISO tarih
}

export function abonelikDurumu(a: Abonelik, odemeler: AbonelikOdeme[], bugun: string): AbonelikDurumu {
  const ay = bugun.slice(0, 7);
  const g = parcala(bugun).g;
  const odendi = abonelikOdendi(a, odemeler, ay);
  const buAyGun = abonelikGunu(a.gun, ay);
  const sonrakiAya = odendi || buAyGun < g;
  const kalanGun = sonrakiAya ? null : buAyGun - g;
  const hedefAy = sonrakiAya ? ayEkle(ay, 1) : ay;
  const siradaki = `${hedefAy}-${String(abonelikGunu(a.gun, hedefAy)).padStart(2, '0')}`;
  return { odendi, yaklasan: a.aktif && !sonrakiAya, kalanGun, yakin: kalanGun !== null && kalanGun < 3, siradaki };
}

// ---------- Toplamlar ----------

export interface Toplamlar {
  nakit: number; banka: number; kart: number;
  birikimTRY: number; birikimUSD: number;
  yaklasan: number;
  harcayabilecegim: number;
  netVarlik: number;
  /** USD tutarlar kur olmadığı için dahil edilemediyse true */
  kurEksik: boolean;
  kalanGun: number;
  gunluk: number;
}

/**
 * Net varlık = Nakit + Banka − Kart borcu + Birikim (USD × kur).
 * Harcayabileceğim = (Nakit + Banka) − bu ay kalan ödenmemiş abonelikler (gün ≥ bugün) − kart borcu. Birikim hariç.
 * Günlük = Harcayabileceğim / ayın kalan günü (bugün dahil).
 */
export function toplamlar(
  hesaplar: Hesap[], bak: Map<string, number>, abonelikler: Abonelik[], odemeler: AbonelikOdeme[],
  bugun: string, kur: number | null,
): Toplamlar {
  let nakit = 0, banka = 0, kart = 0, birikimTRY = 0, birikimUSD = 0, kurEksik = false;
  const ekle = (k: number, birim: Birim) => {
    const t = tlKarsiligi(k, birim, kur);
    if (t === null) { kurEksik = true; return 0; }
    return t;
  };
  for (const h of hesaplar) {
    if (h.arsiv) continue;
    const k = bak.get(h.id) ?? 0;
    if (h.tur === 'nakit') nakit += ekle(k, h.para_birimi);
    else if (h.tur === 'banka') banka += ekle(k, h.para_birimi);
    else if (h.tur === 'kart') kart += ekle(k, h.para_birimi);
    else if (h.para_birimi === 'USD') birikimUSD += k;
    else birikimTRY += k;
  }
  let yaklasan = 0;
  for (const a of abonelikler) {
    if (!a.aktif || !abonelikDurumu(a, odemeler, bugun).yaklasan) continue;
    yaklasan += ekle(kurus(a.tutar), a.para_birimi);
  }
  const usdTL = birikimUSD ? tlKarsiligi(birikimUSD, 'USD', kur) : 0;
  if (usdTL === null) kurEksik = true;
  const harcayabilecegim = nakit + banka - yaklasan - kart;
  const { y, m, g } = parcala(bugun);
  const kalanGun = ayGunSayisi(y, m) - g + 1;
  return {
    nakit, banka, kart, birikimTRY, birikimUSD, yaklasan, harcayabilecegim,
    netVarlik: nakit + banka - kart + birikimTRY + (usdTL ?? 0),
    kurEksik, kalanGun, gunluk: Math.round(harcayabilecegim / kalanGun),
  };
}

// ---------- Özet ----------

export interface Donem { bas: string; bit: string }

export function ayDonemi(ay: string): Donem {
  const [y, m] = ay.split('-').map(Number);
  return { bas: `${ay}-01`, bit: `${ay}-${String(ayGunSayisi(y, m)).padStart(2, '0')}` };
}
export const haftaDonemi = (bugun: string): Donem => ({ bas: gunEkle(bugun, -6), bit: bugun });
export const yilDonemi = (yil: number): Donem => ({ bas: `${yil}-01-01`, bit: `${yil}-12-31` });

export interface Ozet {
  gelir: number; gider: number; kalan: number;
  kartHarcama: number; odenen: number;
  kategoriler: { ad: string; tutar: number; oran: number }[];
  islemSayisi: number;
  kurEksik: boolean;
}

/** Gelir/gider (TL). Transferler gelir/gider sayılmaz. */
export function ozet(islemler: Islem[], hesaplar: Hesap[], d: Donem, kur: number | null): Ozet {
  const h = new Map(hesaplar.map((x) => [x.id, x]));
  let gelir = 0, gider = 0, kartHarcama = 0, sayi = 0, kurEksik = false;
  const kat = new Map<string, number>();
  for (const i of islemler) {
    if (i.tarih < d.bas || i.tarih > d.bit) continue;
    sayi++;
    if (i.tur === 'transfer') continue;
    const hs = h.get(i.hesap_id);
    const t = tlKarsiligi(kurus(i.tutar), hs?.para_birimi ?? 'TRY', kur);
    if (t === null) { kurEksik = true; continue; }
    if (i.tur === 'gelir') gelir += t;
    else {
      gider += t;
      if (hs?.tur === 'kart') kartHarcama += t;
      const ad = i.kategori ?? 'Diğer';
      kat.set(ad, (kat.get(ad) ?? 0) + t);
    }
  }
  const kategoriler = [...kat.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'tr'))
    .map(([ad, tutar]) => ({ ad, tutar, oran: gider ? tutar / gider : 0 }));
  return { gelir, gider, kalan: gelir - gider, kartHarcama, odenen: gider - kartHarcama, kategoriler, islemSayisi: sayi, kurEksik };
}

/** Son 6 ay (eskiden yeniye) gelir/gider. */
export function sonAylar(islemler: Islem[], hesaplar: Hesap[], ay: string, kur: number | null, n = 6) {
  return Array.from({ length: n }, (_, i) => {
    const a = ayEkle(ay, i - (n - 1));
    const o = ozet(islemler, hesaplar, ayDonemi(a), kur);
    return { ay: a, gelir: o.gelir, gider: o.gider };
  });
}

/** "Geçen aya göre gider %12 az" */
export function karsilastirma(buAy: number, gecenAy: number): string {
  if (!gecenAy) return buAy ? 'Geçen ay gider kaydı yok' : '';
  const f = (buAy - gecenAy) / gecenAy;
  const y = Math.round(Math.abs(f) * 100);
  if (y === 0) return 'Geçen ayla aynı gider';
  return `Geçen aya göre gider %${y} ${f < 0 ? 'az' : 'fazla'}`;
}

// ---------- Bütçe ----------

export interface ButceDurumu { kategori: string; harcanan: number; limit: number; oran: number; asildi: boolean; yakin: boolean }

export function butceDurumlari(butceler: Butce[], islemler: Islem[], hesaplar: Hesap[], ay: string, kur: number | null): ButceDurumu[] {
  const o = ozet(islemler, hesaplar, ayDonemi(ay), kur);
  return butceler.map((b) => {
    const harcanan = o.kategoriler.find((k) => k.ad === b.kategori)?.tutar ?? 0;
    const limit = kurus(b.limit_tutar);
    const oran = limit ? harcanan / limit : 0;
    return { kategori: b.kategori, harcanan, limit, oran, asildi: oran >= 1, yakin: oran >= 0.8 && oran < 1 };
  });
}

// ---------- Hedef ----------

export function hedefDurumu(h: Hedef, bak: Map<string, number>) {
  const mevcut = h.bagli_hesap_id ? (bak.get(h.bagli_hesap_id) ?? 0) : kurus(h.mevcut_tutar ?? 0);
  const hedef = kurus(h.hedef_tutar);
  const oran = hedef ? mevcut / hedef : 0;
  return { mevcut, hedef, kalan: Math.max(0, hedef - mevcut), oran, yuzde: Math.round(oran * 100) };
}

// ---------- Transfer ----------

/** İki para birimi arası otomatik tutar: TRY→USD tutar/kur, USD→TRY tutar×kur. */
export function transferGiren(tutarK: number, kaynak: Birim, hedef: Birim, kur: number | null): number | null {
  if (kaynak === hedef) return tutarK;
  if (!kur) return null;
  return kaynak === 'TRY' ? Math.round(tutarK / kur) : Math.round(tutarK * kur);
}
