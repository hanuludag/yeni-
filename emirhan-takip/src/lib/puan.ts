import { sayiAyristir } from './sayi';

export type PuanHaritasi = Record<string, number>;

export interface GunVeri {
  date?: string;
  calisma?: number;
  uyku?: number;
  ekran?: number;
  not?: string;
  gunlukToplam?: number;
  saglikToplam?: number;
  hedefler?: PuanHaritasi;
  saglik?: PuanHaritasi;
  [diger: string]: unknown;
}

export interface Kriter { id: string; ad: string }
export interface Kriterler { gunluk: Kriter[]; saglik: Kriter[] }

export const PUANLAR = [0, 0.25, 0.5, 0.75, 1] as const;
export const EN_YUKSEK_PUAN = 1;

const sayiMi = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Kayan nokta hatası olmadan topla (0,1 + 0,2 vb.). */
export function topla(degerler: number[]): number {
  const t = degerler.reduce((a, b) => a + Math.round(b * 10000), 0);
  return t / 10000;
}

export function haritaToplami(h: PuanHaritasi | undefined): number {
  return topla(Object.values(h ?? {}).filter(sayiMi));
}

export function detayVar(h: PuanHaritasi | undefined): boolean {
  return !!h && Object.values(h).some(sayiMi);
}

/**
 * Bir günün toplamları. Madde puanı varsa onlardan hesaplanır (silinmiş maddelerin
 * puanları da dahil, eski günler değişmesin diye); yoksa kayıtlı toplam kullanılır.
 */
export function gunToplamlari(v: GunVeri | undefined): { gunluk?: number; saglik?: number } {
  if (!v) return {};
  return {
    gunluk: detayVar(v.hedefler) ? haritaToplami(v.hedefler) : sayiMi(v.gunlukToplam) ? v.gunlukToplam : undefined,
    saglik: detayVar(v.saglik) ? haritaToplami(v.saglik) : sayiMi(v.saglikToplam) ? v.saglikToplam : undefined,
  };
}

/** Puan girilmiş gün mü? (seri için) */
export function gunGirildi(v: GunVeri | undefined): boolean {
  if (!v) return false;
  const t = gunToplamlari(v);
  return t.gunluk !== undefined || t.saglik !== undefined;
}

export function puanGecerli(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= EN_YUKSEK_PUAN;
}

/** Günlük ekranındaki düzenlenebilir alanlar (sayılar metin olarak tutulur: "7," yazarken bozulmasın). */
export interface Form {
  hedefler: PuanHaritasi;
  saglik: PuanHaritasi;
  calisma: string;
  uyku: string;
  ekran: string;
  not: string;
}

const saatMetni = (n: unknown) => (sayiMi(n) ? String(n).replace('.', ',') : '');

export function veridenForm(v: GunVeri | undefined): Form {
  return {
    hedefler: { ...(v?.hedefler ?? {}) },
    saglik: { ...(v?.saglik ?? {}) },
    calisma: saatMetni(v?.calisma),
    uyku: saatMetni(v?.uyku),
    ekran: saatMetni(v?.ekran),
    not: typeof v?.not === 'string' ? v.not : '',
  };
}

export const SAAT_ALANLARI = [
  { anahtar: 'calisma', ad: 'Çalışma' },
  { anahtar: 'uyku', ad: 'Uyku' },
  { anahtar: 'ekran', ad: 'Ekran' },
] as const;

export type SaatAnahtari = (typeof SAAT_ALANLARI)[number]['anahtar'];

/** Saat alanı hatası (yoksa null). */
export function saatHatasi(metin: string): string | null {
  const n = sayiAyristir(metin);
  if (n === null) return null;
  if (Number.isNaN(n)) return 'Geçerli bir sayı yaz (ör. 7,5).';
  if (n < 0 || n > 24) return '0 ile 24 arası olmalı.';
  return null;
}

export function formHatalari(f: Form): Partial<Record<SaatAnahtari, string>> {
  const h: Partial<Record<SaatAnahtari, string>> = {};
  for (const { anahtar } of SAAT_ALANLARI) {
    const e = saatHatasi(f[anahtar]);
    if (e) h[anahtar] = e;
  }
  return h;
}

/**
 * Formu kaydedilecek veriye çevirir. Sunucudaki bilinmeyen alanlar korunur,
 * madde puanı yoksa eski kayıtlı toplam korunur.
 */
export function formdanVeri(tarih: string, f: Form, taban: GunVeri | undefined): GunVeri {
  const v: GunVeri = { ...(taban ?? {}), date: tarih };
  for (const { anahtar } of SAAT_ALANLARI) {
    const n = sayiAyristir(f[anahtar]);
    if (n === null || Number.isNaN(n)) delete v[anahtar];
    else v[anahtar] = n;
  }
  const not = f.not.trim();
  if (not) v.not = f.not; else delete v.not;

  if (detayVar(f.hedefler)) {
    v.hedefler = { ...f.hedefler };
    v.gunlukToplam = haritaToplami(f.hedefler);
  } else {
    delete v.hedefler;
    if (!sayiMi(taban?.gunlukToplam) || detayVar(taban?.hedefler)) delete v.gunlukToplam;
  }
  if (detayVar(f.saglik)) {
    v.saglik = { ...f.saglik };
    v.saglikToplam = haritaToplami(f.saglik);
  } else {
    delete v.saglik;
    if (!sayiMi(taban?.saglikToplam) || detayVar(taban?.saglik)) delete v.saglikToplam;
  }
  return v;
}

/** İki form aynı veriyi mi temsil ediyor? */
export function formlarAyni(a: Form, b: Form): boolean {
  const n = (f: Form) => {
    const sirali = (h: PuanHaritasi) => Object.keys(h).sort().map((k) => [k, h[k]]);
    const s = (t: string) => {
      const x = sayiAyristir(t);
      return x === null ? '' : Number.isNaN(x) ? `!${t}` : String(x);
    };
    return JSON.stringify([sirali(f.hedefler), sirali(f.saglik), s(f.calisma), s(f.uyku), s(f.ekran), f.not.trim()]);
  };
  return n(a) === n(b);
}

/** Erteleme maddesinin kimliği: önce adla, yoksa g14. */
export function ertelemeId(k: Kriterler | null | undefined): string {
  const m = k?.gunluk.find((x) => x.ad.trim().toLocaleLowerCase('tr') === 'erteleme');
  return m?.id ?? 'g14';
}

/** Yeni madde kimliği: silinen bir maddenin puanı yeni maddeye geçmesin diye tekil. */
export function yeniKriterId(on: 'g' | 's', mevcut: string[]): string {
  let id = '';
  do {
    id = `${on}_${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
  } while (mevcut.includes(id));
  return id;
}
