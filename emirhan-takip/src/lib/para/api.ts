/** Para tabloları için Supabase REST çağrıları. Çakışma: updated_at koşullu yazma. */
import { ApiHata, MESAJ, istek } from '../api';
import type { Abonelik, AbonelikOdeme, Butce, Hedef, Hesap, Islem, Kategoriler } from './hesap';
import type { KurBilgisi } from './kur';

const esit = (s: string) => `eq.${encodeURIComponent(s)}`;
const temsil = 'return=representation';

export interface ParaVerisi {
  hesaplar: Hesap[]; islemler: Islem[]; butceler: Butce[]; abonelikler: Abonelik[];
  odemeler: AbonelikOdeme[]; hedefler: Hedef[];
  kategoriler: { veri: Kategoriler; updated_at: string } | null;
  kur: KurBilgisi | null;
}

const sayilar = <T>(r: T): T => {
  // PostgREST numeric'i sayı döndürür; yine de metin gelirse sayıya çevir.
  for (const k of ['acilis_bakiyesi', 'limit_tutar', 'tutar', 'giren_tutar', 'hedef_tutar', 'mevcut_tutar'] as const) {
    const v = (r as any)[k];
    if (typeof v === 'string') (r as any)[k] = Number(v);
  }
  return r;
};
const liste = async <T>(yol: string) => (await istek<T[]>(yol)).veri.map(sayilar);

export async function hepsiniGetir(): Promise<ParaVerisi> {
  const [hesaplar, islemler, butceler, abonelikler, odemeler, hedefler, ayar] = await Promise.all([
    liste<Hesap>('para_hesap?select=*&order=sira.asc,created_at.asc'),
    liste<Islem>('para_islem?select=*&order=tarih.desc,created_at.desc'),
    liste<Butce>('para_butce?select=*&order=kategori.asc'),
    liste<Abonelik>('para_abonelik?select=*&order=gun.asc,created_at.asc'),
    liste<AbonelikOdeme>('para_abonelik_odeme?select=abonelik_id,ay,islem_id'),
    liste<Hedef>('para_hedef?select=*&order=created_at.asc'),
    istek<{ anahtar: string; veri: any; updated_at: string }[]>('takip_ayar?select=anahtar,veri,updated_at&anahtar=in.(para_kategoriler,kur_usd_try)'),
  ]);
  const a = (k: string) => ayar.veri.find((x) => x.anahtar === k);
  const kt = a('para_kategoriler');
  const kr = a('kur_usd_try');
  return {
    hesaplar, islemler, butceler, abonelikler, odemeler, hedefler,
    kategoriler: kt ? { veri: kt.veri, updated_at: kt.updated_at } : null,
    kur: kr?.veri?.kur ? (kr.veri as KurBilgisi) : null,
  };
}

/** Yeni satır (istemci uuid'siyle; tekrar denemede çift kayıt olmaz). 409 = zaten var. */
export async function ekle<T>(tablo: string, satir: object): Promise<T> {
  try {
    return sayilar((await istek<T[]>(`${tablo}?select=*`, { method: 'POST', prefer: temsil, body: JSON.stringify(satir) })).veri[0]);
  } catch (e) {
    // Aynı id ile önceki deneme sunucuya ulaşmışsa: o satırı döndür
    const id = (satir as any).id;
    if (e instanceof ApiHata && e.tur === 'cakisma' && id) {
      const r = await istek<T[]>(`${tablo}?select=*&id=${esit(id)}`);
      if (r.veri[0]) return sayilar(r.veri[0]);
    }
    throw e;
  }
}

/** updated_at eşleşirse güncelle; değilse ApiHata('cakisma'). */
export async function guncelle<T>(tablo: string, anahtar: string, deger: string, degisiklik: object, taban: string | undefined): Promise<T> {
  const kosul = taban ? `&updated_at=${esit(taban)}` : '';
  const r = await istek<T[]>(`${tablo}?${anahtar}=${esit(deger)}${kosul}&select=*`, { method: 'PATCH', prefer: temsil, body: JSON.stringify(degisiklik) });
  if (!r.veri.length) throw new ApiHata('cakisma', MESAJ.cakisma);
  return sayilar(r.veri[0]);
}

/** Silme; taban verilirse ve satır arada değiştiyse ApiHata('cakisma'). Zaten yoksa sessizce geçer. */
export async function sil(tablo: string, anahtar: string, deger: string, taban?: string): Promise<void> {
  const kosul = taban ? `&updated_at=${esit(taban)}` : '';
  const r = await istek<unknown[]>(`${tablo}?${anahtar}=${esit(deger)}${kosul}&select=${anahtar}`, { method: 'DELETE', prefer: temsil });
  if (taban && !r.veri.length) {
    const var_ = await istek<unknown[]>(`${tablo}?${anahtar}=${esit(deger)}&select=${anahtar}`);
    if (var_.veri.length) throw new ApiHata('cakisma', MESAJ.cakisma);
  }
}

export async function butceYaz(b: { kategori: string; limit_tutar: number }): Promise<Butce> {
  const r = await istek<Butce[]>('para_butce?on_conflict=kategori&select=*', { method: 'POST', prefer: `resolution=merge-duplicates,${temsil}`, body: JSON.stringify(b) });
  return sayilar(r.veri[0]);
}

export async function abonelikOde(abonelikId: string, ay: string, islemId: string, tarih: string): Promise<void> {
  await istek('rpc/para_abonelik_ode', { method: 'POST', body: JSON.stringify({ p_abonelik: abonelikId, p_ay: ay, p_islem: islemId, p_tarih: tarih }) });
}
export async function abonelikGeriAl(abonelikId: string, ay: string): Promise<void> {
  await istek('rpc/para_abonelik_geri_al', { method: 'POST', body: JSON.stringify({ p_abonelik: abonelikId, p_ay: ay }) });
}

/** Ayar yaz (son yazan kazanır; kur gibi paylaşılan bilgiler için). */
export async function ayarYaz(anahtar: string, veri: unknown): Promise<string> {
  const r = await istek<{ updated_at: string }[]>('takip_ayar?on_conflict=anahtar&select=updated_at', { method: 'POST', prefer: `resolution=merge-duplicates,${temsil}`, body: JSON.stringify({ anahtar, veri }) });
  return r.veri[0]?.updated_at;
}
