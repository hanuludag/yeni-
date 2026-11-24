/**
 * USD/TRY kuru. Tarayıcıdan anahtarsız, CORS'a açık kaynaklar (24 Kasım 2026'da test edildi):
 *  1. open.er-api.com (ExchangeRate-API açık uç; günlük güncellenir, atıf ister)
 *  2. api.frankfurter.dev (yedek; merkez bankası verisi)
 *  3. cdn.jsdelivr.net @fawazahmed0/currency-api (ikinci yedek)
 */
export interface KurBilgisi { kur: number; tarih: string; kaynak: string }

export const KUR_YENILEME_MS = 15 * 60 * 1000;

interface Kaynak { ad: string; url: string; ayikla: (j: any) => number | undefined }
export const KAYNAKLAR: Kaynak[] = [
  { ad: 'ExchangeRate-API', url: 'https://open.er-api.com/v6/latest/USD', ayikla: (j) => (j?.result === 'success' ? j?.rates?.TRY : undefined) },
  { ad: 'Frankfurter', url: 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=TRY', ayikla: (j) => j?.rates?.TRY },
  { ad: 'currency-api', url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json', ayikla: (j) => j?.usd?.try },
];

const makul = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 1 && n < 10000;

/** Kaynakları sırayla dener; ilk makul değeri döndürür. Hiçbiri olmazsa null. */
export async function kurCek(f: typeof fetch = fetch, zamanAsimiMs = 8000, simdi = () => new Date()): Promise<KurBilgisi | null> {
  for (const k of KAYNAKLAR) {
    const kontrol = new AbortController();
    const z = setTimeout(() => kontrol.abort(), zamanAsimiMs);
    try {
      const r = await f(k.url, { signal: kontrol.signal, cache: 'no-store' });
      if (!r.ok) continue;
      const v = k.ayikla(await r.json());
      if (makul(v)) return { kur: Math.round(v * 10000) / 10000, tarih: simdi().toISOString(), kaynak: k.ad };
    } catch {
      /* sıradaki kaynağı dene */
    } finally {
      clearTimeout(z);
    }
  }
  return null;
}

/** Kayıtlı kur yenilenmeli mi? (15 dakikadan eski veya hiç yoksa; elle girilmişse otomatik denemeye devam) */
export function kurEskiMi(k: KurBilgisi | null, simdi: Date): boolean {
  if (!k) return true;
  const t = Date.parse(k.tarih);
  return !Number.isFinite(t) || simdi.getTime() - t >= KUR_YENILEME_MS;
}
