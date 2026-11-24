// Kur kaynaklarını GERÇEK ağda test eder: normal, birinci kaynak düşmüş, ilk ikisi düşmüş, hepsi düşmüş.
import { kurCek, KAYNAKLAR } from '../src/lib/para/kur.ts';

const engelle = (n: number) => ((url: string, o: RequestInit) =>
  KAYNAKLAR.slice(0, n).some((k) => k.url === url) ? Promise.reject(new Error('engellendi')) : fetch(url, o)) as typeof fetch;

for (const k of KAYNAKLAR) {
  const r = await fetch(k.url, { headers: { Origin: 'https://emirhan-takip.netlify.app' } });
  const v = k.ayikla(await r.json());
  console.log(`${k.ad}: HTTP ${r.status}, CORS=${r.headers.get('access-control-allow-origin')}, USD/TRY=${v}`);
}
const s = await kurCek(fetch);
console.log('normal        →', s);
console.log('1. düştü      →', await kurCek(engelle(1)));
console.log('1-2 düştü     →', await kurCek(engelle(2)));
const yok = await kurCek(engelle(3));
console.log('hepsi düştü   →', yok);
if (!s || s.kaynak !== 'ExchangeRate-API' || yok !== null) { console.log('GEÇMEDİ'); process.exit(1); }
console.log('GEÇTİ');
