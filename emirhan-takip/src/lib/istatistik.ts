import { ayGunSayisi, gunEkle } from './tarih';
import { gunToplamlari, topla, type GunVeri } from './puan';
import type { GunHaritasi } from './seri';

export type Olcu = 'rapor' | 'beslenme' | 'ders' | 'uyku' | 'ekran';
export const OLCULER: Olcu[] = ['rapor', 'beslenme', 'ders', 'uyku', 'ekran'];

const sayi = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

export function olcuDegeri(v: GunVeri | undefined, o: Olcu): number | undefined {
  if (!v) return undefined;
  switch (o) {
    case 'rapor': return gunToplamlari(v).gunluk;
    case 'beslenme': return gunToplamlari(v).saglik;
    case 'ders': return sayi(v.calisma);
    case 'uyku': return sayi(v.uyku);
    case 'ekran': return sayi(v.ekran);
  }
}

/** Boş değerleri atlayarak ortalama; hiç değer yoksa null. */
export function ortalama(d: (number | undefined | null)[]): number | null {
  const x = d.filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
  if (!x.length) return null;
  return topla(x) / x.length;
}

export function aydakiGunler(gunler: GunHaritasi, ay: string): string[] {
  return Object.keys(gunler).filter((t) => t.startsWith(ay + '-') && gunler[t]).sort();
}

export interface AyOzeti {
  ay: string;
  gunSayisi: number;
  yazilanGun: number;
  ort: Record<Olcu, number | null>;
  /** index 0 = ayın 1'i; yazılmamış gün undefined */
  seriler: Record<Olcu, (number | undefined)[]>;
}

export function ayOzeti(gunler: GunHaritasi, ay: string): AyOzeti {
  const [y, m] = ay.split('-').map(Number);
  const n = ayGunSayisi(y, m);
  const seriler = {} as AyOzeti['seriler'];
  const ort = {} as AyOzeti['ort'];
  for (const o of OLCULER) {
    seriler[o] = Array.from({ length: n }, (_, i) => olcuDegeri(gunler[`${ay}-${String(i + 1).padStart(2, '0')}`], o));
    ort[o] = ortalama(seriler[o]);
  }
  return { ay, gunSayisi: n, yazilanGun: aydakiGunler(gunler, ay).length, ort, seriler };
}

export function yilOzeti(gunler: GunHaritasi, yil: number): { ay: string; ort: Record<Olcu, number | null>; yazilanGun: number }[] {
  return Array.from({ length: 12 }, (_, i) => {
    const o = ayOzeti(gunler, `${yil}-${String(i + 1).padStart(2, '0')}`);
    return { ay: o.ay, ort: o.ort, yazilanGun: o.yazilanGun };
  });
}

/** Erteleme maddesinin son 7 gün ortalaması ve önceki 7 günle farkı. */
export function ertelemeOzeti(gunler: GunHaritasi, son: string, id: string) {
  const pencere = (bitis: string) =>
    Array.from({ length: 7 }, (_, i) => sayi(gunler[gunEkle(bitis, -i)]?.hedefler?.[id]));
  const ort = ortalama(pencere(son));
  const onceki = ortalama(pencere(gunEkle(son, -7)));
  const fark = ort !== null && onceki !== null ? ort - onceki : null;
  return { ort, onceki, fark };
}

/** Son n günün değerleri (eskiden yeniye). */
export function sonNGun(gunler: GunHaritasi, son: string, n: number, o: Olcu) {
  return Array.from({ length: n }, (_, i) => {
    const t = gunEkle(son, i - (n - 1));
    return { tarih: t, deger: olcuDegeri(gunler[t], o) };
  });
}
