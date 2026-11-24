/** Para veri deposu: yükleme, 30 sn yoklama, kur yenileme, önbellek. */
import { useEffect, useState } from 'preact/hooks';
import { ApiHata, MESAJ } from '../api';
import { etkinGun } from '../tarih';
import * as api from './api';
import { bakiyeler, VARSAYILAN_KATEGORILER, type Kategoriler } from './hesap';
import { kurCek, kurEskiMi, type KurBilgisi } from './kur';

export type KurDurumu = 'yukleniyor' | 'tamam' | 'alinamadi';

export interface ParaDurum {
  ilk: 'yukleniyor' | 'tamam' | 'hata';
  hata: string | null;
  veri: api.ParaVerisi;
  kurDurum: KurDurumu;
  surum: number;
}

const BOS: api.ParaVerisi = { hesaplar: [], islemler: [], butceler: [], abonelikler: [], odemeler: [], hedefler: [], kategoriler: null, kur: null };
let durum: ParaDurum = { ilk: 'yukleniyor', hata: null, veri: BOS, kurDurum: 'yukleniyor', surum: 0 };
const dinleyiciler = new Set<() => void>();
function guncelle(p: Partial<ParaDurum>) {
  durum = { ...durum, ...p, surum: durum.surum + 1 };
  dinleyiciler.forEach((f) => f());
}
export const paraDurumu = () => durum;

export function useParaDepo(): ParaDurum {
  const [, setS] = useState(0);
  const cizilen = durum.surum;
  useEffect(() => {
    const f = () => setS((x) => x + 1);
    dinleyiciler.add(f);
    if (durum.surum !== cizilen) f();
    return () => void dinleyiciler.delete(f);
  }, []);
  return durum;
}

// ---- Türetilmiş değerler ----
export const bugunPara = () => etkinGun(new Date());
export const kategoriler = (): Kategoriler => durum.veri.kategoriler?.veri ?? VARSAYILAN_KATEGORILER;
export const kurDegeri = (): number | null => durum.veri.kur?.kur ?? null;
export function aktifHesaplar() {
  return durum.veri.hesaplar.filter((h) => !h.arsiv);
}
let bakOnbellek: { surum: number; b: Map<string, number> } | null = null;
export function paraBakiyeler(): Map<string, number> {
  if (bakOnbellek?.surum !== durum.surum) bakOnbellek = { surum: durum.surum, b: bakiyeler(durum.veri.hesaplar, durum.veri.islemler) };
  return bakOnbellek.b;
}

// ---- Önbellek ----
const ONBELLEK = 'para:onbellek';
function oku<T>(k: string): T | null {
  try { const s = localStorage.getItem(k); return s ? (JSON.parse(s) as T) : null; } catch { return null; }
}
function yaz(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* depolama kapalı */ }
}
export const taslakOku = <T>(k: string) => oku<T>(`para:taslak:${k}`);
export const taslakYaz = (k: string, v: unknown) => yaz(`para:taslak:${k}`, v);
export const taslakSil = (k: string) => { try { localStorage.removeItem(`para:taslak:${k}`); } catch { /* */ } };

const hataMesaji = (e: unknown) => (e instanceof ApiHata ? e.message : MESAJ.baglanti);

// ---- Yenileme ----
let soz: Promise<void> | null = null;
export function paraYenile(zorla = false): Promise<void> {
  if (soz) return zorla ? soz.then(() => paraYenile()) : soz;
  soz = (async () => {
    try {
      const v = await api.hepsiniGetir();
      // Kuru sunucudan gelen daha yeniyse al, yoksa eldekini koru
      const kur = enYeniKur(durum.veri.kur, v.kur);
      guncelle({ veri: { ...v, kur }, ilk: 'tamam', hata: null });
      yaz(ONBELLEK, { ...v, kur });
    } catch (e) {
      guncelle({ hata: hataMesaji(e), ilk: durum.ilk === 'tamam' ? 'tamam' : 'hata' });
    } finally {
      soz = null;
    }
  })();
  return soz;
}

function enYeniKur(a: KurBilgisi | null, b: KurBilgisi | null): KurBilgisi | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(b.tarih) >= Date.parse(a.tarih) ? b : a;
}

let kurSoz: Promise<void> | null = null;
/** Kuru en fazla 15 dakikada bir internetten çeker; başarılıysa takip_ayar'a yazar. */
export function kurYenile(zorla = false): Promise<void> {
  if (kurSoz) return kurSoz;
  if (!zorla && !kurEskiMi(durum.veri.kur, new Date())) {
    if (durum.kurDurum === 'yukleniyor') guncelle({ kurDurum: 'tamam' });
    return Promise.resolve();
  }
  guncelle({ kurDurum: durum.veri.kur ? durum.kurDurum : 'yukleniyor' });
  kurSoz = (async () => {
    const k = await kurCek();
    if (k) {
      guncelle({ veri: { ...durum.veri, kur: k }, kurDurum: 'tamam' });
      try { await api.ayarYaz('kur_usd_try', k); } catch { /* kur yine de bu cihazda kullanılır */ }
    } else {
      guncelle({ kurDurum: 'alinamadi' });
    }
    kurSoz = null;
  })();
  return kurSoz;
}

/** Elle kur (kaynak alınamadığında). */
export async function kurElle(kur: number) {
  const k: KurBilgisi = { kur, tarih: new Date().toISOString(), kaynak: 'elle' };
  guncelle({ veri: { ...durum.veri, kur: k } });
  try { await api.ayarYaz('kur_usd_try', k); } catch { /* bu cihazda kullanılır */ }
}

let baslatildi = false;
export function paraBaslat() {
  if (baslatildi) return;
  baslatildi = true;
  const o = oku<api.ParaVerisi>(ONBELLEK);
  if (o?.hesaplar) guncelle({ veri: { ...BOS, ...o }, ilk: 'tamam' });
  paraYenile().then(() => kurYenile());
  setInterval(() => { if (document.visibilityState === 'visible') paraYenile(); }, 30_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { paraYenile(); kurYenile(); }
  });
  window.addEventListener('online', () => { paraYenile(); kurYenile(); });
}

/** Yazma işlemi: hata olursa fırlatır (arayüz girdiyi korur), başarıda veriyi tazeler. */
export async function yazVeYenile<T>(f: () => Promise<T>): Promise<T> {
  try {
    const r = await f();
    await paraYenile(true);
    return r;
  } catch (e) {
    if (e instanceof ApiHata && e.tur === 'cakisma') await paraYenile(true);
    throw e;
  }
}

/** Arayüz için Türkçe hata metni. */
export function yazmaHatasi(e: unknown): string {
  if (e instanceof ApiHata) {
    if (e.tur === 'cakisma' && e.kod === '23503') return 'Bu hesaba bağlı işlem veya abonelik var; silmek yerine arşivle.';
    if (e.tur === 'cakisma' && e.kod === '23505') return 'Bu kayıt zaten var (aynı ay için ödeme bir kez işaretlenebilir).';
    if (e.tur === 'cakisma') return 'Bu kayıt başka bir cihazda değişmiş; en güncel hali yüklendi. Kontrol edip tekrar dene.';
    if (e.tur === 'baglanti') return 'Kaydedilemedi: bağlantı yok. Girdiğin bilgiler burada duruyor, tekrar dene.';
    return `Kaydedilemedi: ${e.message}`;
  }
  return 'Kaydedilemedi, tekrar dene.';
}

/** İstemci tarafı uuid (tekrar denemede çift kayıt olmasın). */
export const yeniId = () =>
  (crypto as any).randomUUID?.() ??
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
