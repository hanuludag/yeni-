import { gunEkle } from './tarih';
import { gunGirildi, type GunVeri } from './puan';

export type GunHaritasi = Record<string, GunVeri | undefined>;

/**
 * Seri: puan girilmiş üst üste gün sayısı.
 * Etkin gün henüz boşsa seri dünden sayılır (gün bitmeden sıfırlanmaz).
 * Aradaki boş gün seriyi keser.
 */
export function seriHesapla(gunler: GunHaritasi, bugun: string): number {
  let g = gunGirildi(gunler[bugun]) ? bugun : gunEkle(bugun, -1);
  let n = 0;
  while (gunGirildi(gunler[g])) {
    n++;
    g = gunEkle(g, -1);
  }
  return n;
}

/** Son n gün (bugün dahil, eskiden yeniye) dolu/boş listesi. */
export function sonGunler(gunler: GunHaritasi, bugun: string, n = 14): { tarih: string; dolu: boolean }[] {
  const s: { tarih: string; dolu: boolean }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const t = gunEkle(bugun, -i);
    s.push({ tarih: t, dolu: gunGirildi(gunler[t]) });
  }
  return s;
}

/** Özet pencerelerinin son günü: bugün girildiyse bugün, değilse dün. */
export function pencereSonu(gunler: GunHaritasi, bugun: string): string {
  return gunGirildi(gunler[bugun]) ? bugun : gunEkle(bugun, -1);
}
