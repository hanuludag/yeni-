// Haftalık zamanlanmış fonksiyon: Supabase ücretsiz planda 7 gün hareketsiz kalan projeyi durdurur.
// Haftada bir basit bir okuma sorgusu atarak projeyi uyanık tutar.
// Pazartesi 06:17 UTC = 09:17 Türkiye saati (UTC+3, yaz saati uygulaması yok).
import { ping } from '../lib/ping.mts';

export default async () => {
  const s = await ping();
  console.log(`Supabase ping: HTTP ${s.durum}, ${s.satir} satır`);
  if (!s.ok) throw new Error(`Supabase ping başarısız: HTTP ${s.durum}`);
};

export const config = {
  schedule: '17 6 * * 1',
};
