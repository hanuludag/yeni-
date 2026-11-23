// Supabase'e basit bir okuma sorgusu (yayınlanabilir anahtarla).
// Değerler Netlify ortam değişkenlerinden (VITE_SUPABASE_URL, VITE_SUPABASE_ANAHTAR) okunur.
declare const Netlify: { env: { get(k: string): string | undefined } } | undefined;
const oku = (k: string) => (typeof Netlify !== 'undefined' ? Netlify.env.get(k) : undefined) ?? process.env[k];

export async function ping(): Promise<{ ok: boolean; durum: number; satir: number }> {
  const SUPABASE_URL = oku('VITE_SUPABASE_URL');
  const ANAHTAR = oku('VITE_SUPABASE_ANAHTAR');
  if (!SUPABASE_URL || !ANAHTAR) throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANAHTAR ortam değişkeni yok');
  const r = await fetch(`${SUPABASE_URL}/rest/v1/takip_ayar?select=anahtar&limit=1`, {
    headers: { apikey: ANAHTAR },
  });
  const veri = r.ok ? ((await r.json()) as unknown[]) : [];
  return { ok: r.ok, durum: r.status, satir: veri.length };
}
