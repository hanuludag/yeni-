// Veritabanı yedeği: supabase/yedek/<tablo>-<zaman>.json (git dışı; kişisel notlar içerir).
import { mkdirSync, writeFileSync } from 'node:fs';
import { ANAHTAR, SUPABASE } from './ortak.mjs';

mkdirSync('supabase/yedek', { recursive: true });
const zaman = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
for (const [tablo, sira] of [
  ['takip_gunluk', 'tarih'], ['takip_ayar', 'anahtar'], ['takip_rutin_isaret', 'tarih'],
  ['para_hesap', 'created_at'], ['para_islem', 'tarih'], ['para_butce', 'kategori'],
  ['para_abonelik', 'created_at'], ['para_abonelik_odeme', 'ay'], ['para_hedef', 'created_at'],
]) {
  const r = await fetch(`${SUPABASE}/rest/v1/${tablo}?select=*&order=${sira}`, { headers: { apikey: ANAHTAR } });
  if (!r.ok) throw new Error(`${tablo}: HTTP ${r.status}`);
  const veri = await r.json();
  const yol = `supabase/yedek/${tablo}-${zaman}.json`;
  writeFileSync(yol, JSON.stringify(veri, null, 2));
  console.log(`${yol} (${veri.length} satır)`);
}
