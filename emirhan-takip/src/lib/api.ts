/**
 * Supabase REST (PostgREST) çağrıları. Ek kütüphane yok, sadece fetch.
 * Yayınlanabilir anahtar tarayıcıda olabilir; service role anahtarı asla burada olmaz.
 */
import type { GunVeri } from './puan';

// Değerler derleme sırasında .env.local veya Netlify ortam değişkenlerinden gelir (repo herkese açık olabilir).
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANAHTAR: string = import.meta.env.VITE_SUPABASE_ANAHTAR;
const REST = `${SUPABASE_URL}/rest/v1`;
const ZAMAN_ASIMI_MS = 15000;

export type HataTuru = 'baglanti' | 'sunucu' | 'cakisma';

export class ApiHata extends Error {
  constructor(public tur: HataTuru, mesaj: string, public durum?: number) {
    super(mesaj);
  }
}

export const MESAJ = {
  baglanti: 'Bağlantı yok. Girişlerin bu cihazda bekliyor.',
  sunucu: (d?: number) => `Sunucu hata verdi${d ? ` (${d})` : ''}. Girişlerin bu cihazda bekliyor, biraz sonra tekrar dene.`,
  cakisma: 'Bu kayıt başka bir cihazda değiştirilmiş.',
};

export interface Satir<T> { veri: T; updated_at: string }

async function istek<T>(yol: string, ayar: RequestInit & { prefer?: string } = {}): Promise<{ veri: T; durum: number }> {
  const kontrol = new AbortController();
  const zamanlayici = setTimeout(() => kontrol.abort(), ZAMAN_ASIMI_MS);
  const basliklar: Record<string, string> = {
    apikey: SUPABASE_ANAHTAR,
    'Content-Type': 'application/json',
  };
  if (ayar.prefer) basliklar.Prefer = ayar.prefer;
  let yanit: Response;
  try {
    yanit = await fetch(`${REST}/${yol}`, { ...ayar, headers: basliklar, signal: kontrol.signal, cache: 'no-store' });
  } catch {
    throw new ApiHata('baglanti', MESAJ.baglanti);
  } finally {
    clearTimeout(zamanlayici);
  }
  if (yanit.status === 409) throw new ApiHata('cakisma', MESAJ.cakisma, 409);
  if (!yanit.ok) throw new ApiHata('sunucu', MESAJ.sunucu(yanit.status), yanit.status);
  const metin = await yanit.text();
  return { veri: (metin ? JSON.parse(metin) : null) as T, durum: yanit.status };
}

const esit = (s: string) => `eq.${encodeURIComponent(s)}`;

// ---- Günler ----
export interface GunSatiri { tarih: string; veri: GunVeri; updated_at: string }

export async function gunleriGetir(): Promise<GunSatiri[]> {
  return (await istek<GunSatiri[]>('takip_gunluk?select=tarih,veri,updated_at&order=tarih.asc')).veri;
}

export async function gunGetir(tarih: string): Promise<GunSatiri | null> {
  const r = await istek<GunSatiri[]>(`takip_gunluk?select=tarih,veri,updated_at&tarih=${esit(tarih)}`);
  return r.veri[0] ?? null;
}

/**
 * Günü kaydet. `taban` = düzenlemeye başlarken sunucudaki updated_at (yeni gün için null).
 * Arada başka cihaz kaydettiyse ApiHata('cakisma') fırlatır; sessizce üstüne yazmaz.
 */
export async function gunKaydet(tarih: string, veri: GunVeri, taban: string | null): Promise<GunSatiri> {
  if (taban === null) {
    const r = await istek<GunSatiri[]>('takip_gunluk?select=tarih,veri,updated_at', {
      method: 'POST',
      prefer: 'return=representation',
      body: JSON.stringify({ tarih, veri }),
    });
    return r.veri[0];
  }
  const r = await istek<GunSatiri[]>(
    `takip_gunluk?tarih=${esit(tarih)}&updated_at=${esit(taban)}&select=tarih,veri,updated_at`,
    { method: 'PATCH', prefer: 'return=representation', body: JSON.stringify({ veri }) },
  );
  if (!r.veri.length) throw new ApiHata('cakisma', MESAJ.cakisma);
  return r.veri[0];
}

/** Sadece test/bakım için (test günü 2099-01-01 silinir). */
export async function gunSil(tarih: string): Promise<void> {
  await istek(`takip_gunluk?tarih=${esit(tarih)}`, { method: 'DELETE' });
}

// ---- Ayarlar ----
export interface AyarSatiri { anahtar: string; veri: unknown; updated_at: string }

export async function ayarlariGetir(): Promise<AyarSatiri[]> {
  return (await istek<AyarSatiri[]>('takip_ayar?select=anahtar,veri,updated_at&anahtar=in.(kriterler,program)')).veri;
}

export async function ayarKaydet(anahtar: string, veri: unknown, taban: string | null): Promise<AyarSatiri> {
  if (taban === null) {
    const r = await istek<AyarSatiri[]>('takip_ayar?select=anahtar,veri,updated_at', {
      method: 'POST', prefer: 'return=representation', body: JSON.stringify({ anahtar, veri }),
    });
    return r.veri[0];
  }
  const r = await istek<AyarSatiri[]>(
    `takip_ayar?anahtar=${esit(anahtar)}&updated_at=${esit(taban)}&select=anahtar,veri,updated_at`,
    { method: 'PATCH', prefer: 'return=representation', body: JSON.stringify({ veri }) },
  );
  if (!r.veri.length) throw new ApiHata('cakisma', MESAJ.cakisma);
  return r.veri[0];
}

// ---- Rutin işaretleri ----
export async function rutinIsaretGetir(tarih: string): Promise<{ veri: Record<string, string[]>; updated_at: string } | null> {
  const r = await istek<{ veri: Record<string, string[]>; updated_at: string }[]>(
    `takip_rutin_isaret?select=veri,updated_at&tarih=${esit(tarih)}`,
  );
  return r.veri[0] ?? null;
}

export async function rutinIsaretKaydet(tarih: string, veri: Record<string, string[]>): Promise<void> {
  await istek('takip_rutin_isaret?on_conflict=tarih', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: JSON.stringify({ tarih, veri }),
  });
}
