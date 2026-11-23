/** Türkçe sayı biçimi: 12,75 — gruplama yok, gereksiz sıfır yok. */
export function sayiBicim(n: number | null | undefined, maxOndalik = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '–';
  const k = 10 ** maxOndalik;
  const yuvarlak = Math.round((n + Number.EPSILON) * k) / k;
  return String(yuvarlak).replace('.', ',').replace(/^-0$/, '0');
}

/**
 * Kullanıcının yazdığı sayıyı ayrıştırır ("7,5", "7.5", " 8 ").
 * Boş → null, geçersiz → NaN.
 */
export function sayiAyristir(metin: string): number | null {
  const t = metin.trim().replace(/\s/g, '').replace(',', '.');
  if (t === '') return null;
  if (!/^-?\d*\.?\d+$|^-?\d+\.$/.test(t)) return NaN;
  return Number(t);
}

const KESIR: Record<string, string> = { '0': '0', '0.25': '¼', '0.5': '½', '0.75': '¾', '1': '1' };
export function kesirEtiket(v: number): string {
  return KESIR[String(v)] ?? sayiBicim(v);
}
