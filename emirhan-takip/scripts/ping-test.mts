import '../scripts/ortak.mjs'; // .env.local yükler
// Zamanlanmış fonksiyonun gövdesini yerelde gerçek Supabase'e karşı çalıştırır.
import fonk, { config } from '../netlify/functions/supabase-canli.mts';
import { ping } from '../netlify/lib/ping.mts';
console.log('config:', JSON.stringify(config));
console.log('ping:', JSON.stringify(await ping()));
await fonk();
console.log('GEÇTİ   zamanlanmış fonksiyon gövdesi çalıştı');
