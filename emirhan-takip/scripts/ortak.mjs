// Betikler için ortak yardımcılar: Playwright yükleme, örnek (tasarımdaki) veri, sahte Supabase.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export const { chromium } = require('playwright');

import { existsSync, readFileSync } from 'node:fs';
// .env.local → process.env (yoksa ortam değişkenleri)
if (existsSync('.env.local')) {
  for (const satir of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = satir.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
export const SUPABASE = process.env.VITE_SUPABASE_URL;
export const ANAHTAR = process.env.VITE_SUPABASE_ANAHTAR;
if (!SUPABASE || !ANAHTAR) throw new Error('.env.local içinde VITE_SUPABASE_URL ve VITE_SUPABASE_ANAHTAR olmalı');

export const KRITERLER = {
  gunluk: ['Spor', 'Bakım yapma', 'PHY (programlama, hazırlanma, yazma)', 'Kitap okuma (en az 10 sayfa)', 'Görev', 'Para birikimi', 'İbadet', 'Günlük rutine uyum', 'Uyku', 'Ders', 'Start up veya yatırım', 'Zamanı kullanım', 'Odak', 'Erteleme', 'Telefon / sosyal medya süresi', 'Gün sonu değerlendirme / ertesi gün planı', 'Hareket (yürüyüş / adım)', 'Ruh hali / enerji', 'Sosyal bağ (aile / arkadaş)'].map((ad, i) => ({ id: `g${i + 1}`, ad })),
  saglik: ['Şekersiz beslenme', 'Yağlı veya abur cubursuz beslenme', 'Su içme', 'Proteinli beslenme', 'Kalori', 'Vitaminler'].map((ad, i) => ({ id: `s${i + 1}`, ad })),
};

const HAFTA = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
// Tasarım dosyasındaki örnek program (kişisel not içermez)
export const PROGRAM = {
  ogrenim: HAFTA.map((gun, i) => (i < 5 ? { gun, ne: 'Start Up', not: '' } : { gun, ne: 'Yatırım ve Finansal O Y', not: 'Yazılım tekrar' })),
  spor: HAFTA.map((gun) => ({ gun, spor: { Pazartesi: 'Fitness + Koşu', Perşembe: 'Fitness + Kürek', Cumartesi: 'Fitness + Koşu' }[gun] ?? '', detay: '' })),
  rutinler: {
    sabah: ['Kalkış', 'Sabah rutini', 'Vitamin', 'Kahvaltı', 'Ulaşım'],
    ogle: ['Öğle namazı', 'Öğle yemeği + 1 L su'],
    gece: ['Gece rutini', 'Kitap okuma ve atıştırmalık', 'Yatış'],
  },
  yemek: [
    { ogun: 'Kahvaltı', ne: '', not: '' },
    { ogun: 'Ara öğün 1', ne: '', not: '' },
    { ogun: 'Öğle', ne: '', not: '' },
    { ogun: 'Ara öğün 2', ne: '', not: '' },
    { ogun: 'Akşam ve gece', ne: 'Yemek + 1 L su', not: '' },
  ],
};

// Tasarımdaki "Günler" tablosu: gün, rapor, beslenme, ders, uyku, ekran
const TABLO = [
  [10, 10.5, 4, 2, 8, 1.5], [11, 12, 3.5, 1.5, 7.5, 2], [12, 9.75, 4.25, 2.5, 8.5, 1], [13, 11.5, 3, 3, 8, 1.5],
  [14, 13.25, 4.5, 2, 7.5, 3], [15, 8.75, 3.25, 1.5, 9, 2.5], [16, 11.5, 3.75, 2, 8, 1], [17, 15.5, 5.25, 3.5, 7.5, 0.5],
  [18, 14.25, 4, 3.5, 6.5, 0.5], [19, 12.75, 4.5, 4, 6.5, 2], [20, 7.5, 3.25, 1, 6.5, 2.5], [21, 7.25, 2.25, 1, 9, 2.5],
];
// 21 Kasım madde puanları (toplam 7,25 / 2,25, tasarımdaki Günlük ekranıyla aynı toplamlar)
const D21 = {
  hedefler: { g1: 0, g2: 0.5, g3: 0.25, g4: 0.25, g5: 0.5, g6: 1, g7: 0.5, g8: 0.25, g9: 1, g10: 0.25, g11: 0.5, g12: 0.25, g13: 0.25, g14: 0.5, g15: 0, g16: 0.25, g17: 0.25, g18: 0.5, g19: 0.25 },
  saglik: { s1: 0.25, s2: 0.25, s3: 0.25, s4: 0.25, s5: 0.25, s6: 1 },
};
export function ornekGunler() {
  return TABLO.map(([g, r, b, c, u, e]) => {
    const tarih = `2026-11-${String(g).padStart(2, '0')}`;
    const veri = { date: tarih, gunlukToplam: r, saglikToplam: b, calisma: c, uyku: u, ekran: e };
    if (g === 21) Object.assign(veri, D21);
    return { tarih, veri, updated_at: `2026-11-${String(g).padStart(2, '0')}T20:00:00+00:00` };
  });
}

/**
 * Sayfadaki Supabase isteklerini sahte veriye yönlendirir.
 * secenek.hata: 'baglanti' | 500 → istekler başarısız olur.
 */
export async function sahteSupabase(page, secenek = {}) {
  const db = {
    gunler: secenek.gunler ?? ornekGunler(),
    ayar: [
      { anahtar: 'kriterler', veri: KRITERLER, updated_at: '2026-11-01T00:00:00+00:00' },
      { anahtar: 'program', veri: PROGRAM, updated_at: '2026-11-01T00:00:00+00:00' },
    ],
    rutin: {},
    istekler: [],
    hata: secenek.hata,
  };
  let sayac = 0;
  await page.route(`${SUPABASE}/rest/v1/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    db.istekler.push(`${req.method()} ${url.pathname}${url.search}`);
    if (db.hata === 'baglanti') return route.abort('internetdisconnected');
    if (db.hata === 500) return route.fulfill({ status: 500, body: '{"message":"hata"}' });
    const tablo = url.pathname.split('/').pop();
    const json = (b, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    const yeniZaman = () => new Date(Date.UTC(2026, 10, 22, 21, 0, ++sayac)).toISOString().replace('Z', '+00:00');
    if (tablo === 'takip_gunluk') {
      const tarihF = url.searchParams.get('tarih')?.replace(/^eq\./, '');
      const updF = url.searchParams.get('updated_at')?.replace(/^eq\./, '');
      if (req.method() === 'GET') return json(tarihF ? db.gunler.filter((g) => g.tarih === tarihF) : db.gunler);
      if (req.method() === 'POST') {
        const b = JSON.parse(req.postData());
        if (db.gunler.some((g) => g.tarih === b.tarih)) return json({ code: '23505' }, 409);
        const s = { tarih: b.tarih, veri: b.veri, updated_at: yeniZaman() };
        db.gunler.push(s);
        return json([s], 201);
      }
      if (req.method() === 'PATCH') {
        const s = db.gunler.find((g) => g.tarih === tarihF && (!updF || g.updated_at === updF));
        if (!s) return json([]);
        s.veri = JSON.parse(req.postData()).veri;
        s.updated_at = yeniZaman();
        return json([s]);
      }
    }
    if (tablo === 'takip_ayar') {
      if (req.method() === 'GET') return json(db.ayar);
      if (req.method() === 'PATCH') {
        const a = url.searchParams.get('anahtar').replace(/^eq\./, '');
        const updF = url.searchParams.get('updated_at')?.replace(/^eq\./, '');
        const s = db.ayar.find((x) => x.anahtar === a && x.updated_at === updF);
        if (!s) return json([]);
        s.veri = JSON.parse(req.postData()).veri;
        s.updated_at = yeniZaman();
        return json([s]);
      }
    }
    if (tablo === 'takip_rutin_isaret') {
      const tarihF = url.searchParams.get('tarih')?.replace(/^eq\./, '');
      if (req.method() === 'GET') return json(db.rutin[tarihF] ? [{ veri: db.rutin[tarihF], updated_at: yeniZaman() }] : []);
      if (req.method() === 'POST') {
        const b = JSON.parse(req.postData());
        db.rutin[b.tarih] = b.veri;
        return route.fulfill({ status: 201, body: '' });
      }
    }
    return json({ message: 'bilinmeyen' }, 404);
  });
  return db;
}

export const ADRES = process.env.ADRES ?? 'http://localhost:4173';
