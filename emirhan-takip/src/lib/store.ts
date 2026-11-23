/**
 * Uygulama veri deposu: sunucudan gelen veri, yoklama, yerel taslaklar.
 * Preact bileşenleri useDepo() ile abone olur.
 */
import { useEffect, useState } from 'preact/hooks';
import * as api from './api';
import { ApiHata } from './api';
import type { Form, GunVeri, Kriterler } from './puan';
import type { ProgramVeri, RutinIsaret } from './rutin';
import { etkinGun } from './tarih';

export const YOKLAMA_MS = 30_000;

export interface Durum {
  ilkYukleme: 'yukleniyor' | 'tamam' | 'hata';
  hata: string | null;
  yenileniyor: boolean;
  gunler: Record<string, api.GunSatiri>;
  kriterler: api.Satir<Kriterler> | null;
  program: api.Satir<ProgramVeri> | null;
  rutin: { tarih: string; veri: RutinIsaret; bekliyor: boolean; hata: string | null } | null;
  simdi: Date;
  surum: number;
}

let durum: Durum = {
  ilkYukleme: 'yukleniyor',
  hata: null,
  yenileniyor: false,
  gunler: {},
  kriterler: null,
  program: null,
  rutin: null,
  simdi: new Date(),
  surum: 0,
};

const dinleyiciler = new Set<() => void>();
function guncelle(p: Partial<Durum>) {
  durum = { ...durum, ...p, surum: durum.surum + 1 };
  dinleyiciler.forEach((f) => f());
}
export const durumAl = () => durum;

export function useDepo(): Durum {
  const [, setS] = useState(0);
  const cizilen = durum.surum;
  useEffect(() => {
    const f = () => setS((x) => x + 1);
    dinleyiciler.add(f);
    // Çizim ile abonelik arasında gelen değişikliği kaçırma
    if (durum.surum !== cizilen) f();
    return () => void dinleyiciler.delete(f);
  }, []);
  return durum;
}

export const bugun = () => etkinGun(durum.simdi);

export function gunVerileri(): Record<string, GunVeri> {
  const r: Record<string, GunVeri> = {};
  for (const [t, s] of Object.entries(durum.gunler)) r[t] = s.veri;
  return r;
}

const BOS_KRITER: Kriterler = { gunluk: [], saglik: [] };
export const kriterler = (): Kriterler => (durum.kriterler?.veri as Kriterler) ?? BOS_KRITER;

function hataMesaji(e: unknown): string {
  return e instanceof ApiHata ? e.message : api.MESAJ.baglanti;
}

// ---- Yenileme ----
let yenilemeSozu: Promise<void> | null = null;

/** Sunucudan yenile. `zorla`: süren bir yenileme varsa bittikten sonra bir kez daha (ör. "Tekrar dene"). */
export function yenile(zorla = false): Promise<void> {
  if (yenilemeSozu) return zorla ? yenilemeSozu.then(() => yenile()) : yenilemeSozu;
  guncelle({ yenileniyor: true, simdi: new Date() });
  yenilemeSozu = (async () => {
    try {
      const [gunler, ayarlar] = await Promise.all([api.gunleriGetir(), api.ayarlariGetir()]);
      const g: Durum['gunler'] = {};
      for (const s of gunler) g[s.tarih] = s;
      const a = (k: string) => ayarlar.find((x) => x.anahtar === k);
      const kr = a('kriterler');
      const pr = a('program');
      const yeni = {
        gunler: g,
        kriterler: kr ? { veri: kr.veri as Kriterler, updated_at: kr.updated_at } : null,
        program: pr ? { veri: pr.veri as ProgramVeri, updated_at: pr.updated_at } : null,
      };
      guncelle({ ...yeni, ilkYukleme: 'tamam', hata: null });
      depoYaz(ONBELLEK, yeni);
      await rutinYenile();
    } catch (e) {
      guncelle({ hata: hataMesaji(e), ilkYukleme: durum.ilkYukleme === 'tamam' ? 'tamam' : 'hata' });
    } finally {
      guncelle({ yenileniyor: false });
      yenilemeSozu = null;
    }
  })();
  return yenilemeSozu;
}

const ONBELLEK = 'takip:onbellek';
let baslatildi = false;
export function baslat() {
  if (baslatildi) return;
  baslatildi = true;
  // Son başarılı yüklemeyi göster (bağlantı yokken de veriler görünsün); ardından sunucudan yenile.
  const o = depoOku<Pick<Durum, 'gunler' | 'kriterler' | 'program'>>(ONBELLEK);
  if (o && o.gunler) guncelle({ ...o, ilkYukleme: 'tamam' });
  yenile();
  setInterval(() => {
    if (document.visibilityState === 'visible') yenile();
    else guncelle({ simdi: new Date() });
  }, YOKLAMA_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') yenile();
  });
  window.addEventListener('online', () => yenile());
}

// ---- Gün kaydı ----
export function gunSatiriYaz(s: api.GunSatiri) {
  guncelle({ gunler: { ...durum.gunler, [s.tarih]: s } });
}

// ---- Ayar kaydı (kriterler, program) ----
export async function ayarKaydet(anahtar: 'kriterler' | 'program', veri: unknown): Promise<void> {
  const mevcut = durum[anahtar];
  try {
    const s = await api.ayarKaydet(anahtar, veri, mevcut?.updated_at ?? null);
    guncelle({ [anahtar]: { veri: s.veri, updated_at: s.updated_at } } as Partial<Durum>);
  } catch (e) {
    if (e instanceof ApiHata && e.tur === 'cakisma') await yenile();
    throw e;
  }
}

// ---- Rutin işaretleri ----
const RUTIN_BEKLEYEN = 'takip:rutin-bekleyen';

export async function rutinYenile() {
  const t = bugun();
  const r = durum.rutin;
  // Bekleyen (kaydedilemedi) işaret varsa önce onu göndermeyi dene, ezme.
  if (r && r.tarih === t && r.bekliyor) {
    await rutinGonder(r.veri);
    return;
  }
  const bekleyen = depoOku<{ tarih: string; veri: RutinIsaret }>(RUTIN_BEKLEYEN);
  if (bekleyen && bekleyen.tarih === t) {
    guncelle({ rutin: { tarih: t, veri: bekleyen.veri, bekliyor: true, hata: null } });
    await rutinGonder(bekleyen.veri);
    return;
  }
  try {
    const s = await api.rutinIsaretGetir(t);
    guncelle({ rutin: { tarih: t, veri: (s?.veri as RutinIsaret) ?? {}, bekliyor: false, hata: null } });
  } catch (e) {
    if (!durum.rutin || durum.rutin.tarih !== t) guncelle({ rutin: { tarih: t, veri: {}, bekliyor: false, hata: hataMesaji(e) } });
  }
}

let rutinZinciri: Promise<void> = Promise.resolve();

/** İşaretleri sırayla gönder (hızlı ardışık dokunuşlarda eski istek yenisini ezmesin). */
export function rutinGonder(veri: RutinIsaret): Promise<void> {
  const t = bugun();
  guncelle({ rutin: { tarih: t, veri, bekliyor: true, hata: null } });
  depoYaz(RUTIN_BEKLEYEN, { tarih: t, veri });
  rutinZinciri = rutinZinciri.then(() => rutinGonderTek(t, veri));
  return rutinZinciri;
}

async function rutinGonderTek(t: string, veri: RutinIsaret) {
  if (durum.rutin?.veri !== veri) return; // daha yeni bir işaret var; o gönderilecek
  try {
    await api.rutinIsaretKaydet(t, veri as Record<string, string[]>);
    depoSil(RUTIN_BEKLEYEN);
    if (durum.rutin?.veri === veri) guncelle({ rutin: { tarih: t, veri, bekliyor: false, hata: null } });
  } catch (e) {
    if (durum.rutin?.veri === veri) guncelle({ rutin: { tarih: t, veri, bekliyor: true, hata: 'İşaret kaydedilemedi; bağlantı gelince tekrar denenecek.' } });
    void e;
  }
}

// ---- Yerel depolama (taslaklar) ----
function depoOku<T>(k: string): T | null {
  try {
    const s = localStorage.getItem(k);
    return s ? (JSON.parse(s) as T) : null;
  } catch {
    return null;
  }
}
function depoYaz(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* depolama kapalı olabilir; bellekteki taslak yine durur */
  }
}
function depoSil(k: string) {
  try {
    localStorage.removeItem(k);
  } catch {
    /* yok say */
  }
}

export interface Taslak {
  form: Form;
  /** Düzenlemeye başlarken sunucudaki updated_at (yeni gün: null) */
  taban: string | null;
  zaman: number;
}

const TASLAK_ON = 'takip:taslak:';
const bellekTaslak: Record<string, Taslak> = {};

export function taslakOku(tarih: string): Taslak | null {
  return bellekTaslak[tarih] ?? depoOku<Taslak>(TASLAK_ON + tarih);
}
export function taslakYaz(tarih: string, t: Taslak) {
  bellekTaslak[tarih] = t;
  depoYaz(TASLAK_ON + tarih, t);
  guncelle({});
}
export function taslakSil(tarih: string) {
  delete bellekTaslak[tarih];
  depoSil(TASLAK_ON + tarih);
  guncelle({});
}
export function taslakTarihleri(): string[] {
  const s = new Set(Object.keys(bellekTaslak));
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(TASLAK_ON)) s.add(k.slice(TASLAK_ON.length));
    }
  } catch {
    /* yok say */
  }
  return [...s].sort();
}
