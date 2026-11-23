/** Tarih yardımcıları. Günler "YYYY-MM-DD" (yerel takvim günü) olarak taşınır. */

export const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
export const AYLAR_KISA = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
/** getUTCDay sırası: 0 = Pazar */
export const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
/** Haftalık program sırası (Pazartesi başlar) */
export const HAFTA = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

/** Gün bu saatten önce açılırsa bir önceki gün sayılır. */
export const GUN_BASLANGIC_SAATI = 5;

const iki = (n: number) => String(n).padStart(2, '0');

export function isoTarih(d: Date): string {
  return `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}`;
}

export function tarihGecerli(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const { y, m, g } = parcala(iso);
  const d = new Date(Date.UTC(y, m - 1, g));
  return d.getUTCFullYear() === y && d.getUTCMonth() === m - 1 && d.getUTCDate() === g;
}

export function parcala(iso: string): { y: number; m: number; g: number } {
  const [y, m, g] = iso.split('-').map(Number);
  return { y, m, g };
}

function utc(iso: string): Date {
  const { y, m, g } = parcala(iso);
  return new Date(Date.UTC(y, m - 1, g));
}

/** Etkin gün: saat 05:00'ten önceyse dün. */
export function etkinGun(simdi: Date): string {
  const d = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate());
  if (simdi.getHours() < GUN_BASLANGIC_SAATI) d.setDate(d.getDate() - 1);
  return isoTarih(d);
}

export function gunEkle(iso: string, n: number): string {
  const d = utc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function gunFarki(a: string, b: string): number {
  return Math.round((utc(b).getTime() - utc(a).getTime()) / 86400000);
}

export function haftaGunuAdi(iso: string): string {
  return GUNLER[utc(iso).getUTCDay()];
}

/** "22 Kasım 2026" */
export function tarihMetni(iso: string): string {
  const { y, m, g } = parcala(iso);
  return `${g} ${AYLAR[m - 1]} ${y}`;
}

/** "22 Kasım 2026, Pazar" */
export function uzunTarih(iso: string): string {
  return `${tarihMetni(iso)}, ${haftaGunuAdi(iso)}`;
}

/** "21 Kas" */
export function kisaTarih(iso: string): string {
  const { m, g } = parcala(iso);
  return `${g} ${AYLAR_KISA[m - 1]}`;
}

/** "Bugün" / "Dün" / "Yarın" / "" */
export function goreceliEtiket(iso: string, bugun: string): string {
  const f = gunFarki(bugun, iso);
  if (f === 0) return 'Bugün';
  if (f === -1) return 'Dün';
  if (f === 1) return 'Yarın';
  return '';
}

export function ayGunSayisi(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** "2026-11" */
export function ayAnahtari(iso: string): string {
  return iso.slice(0, 7);
}

export function ayEkle(ay: string, n: number): string {
  const [y, m] = ay.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${iki(d.getUTCMonth() + 1)}`;
}

export function ayMetni(ay: string): string {
  const [y, m] = ay.split('-').map(Number);
  return `${AYLAR[m - 1]} ${y}`;
}

export function ayGecerli(ay: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(ay);
}
