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
import { BOS_PARA } from './para-ornek.mjs';
export { paraOrnek } from './para-ornek.mjs';
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
    para: secenek.para ?? BOS_PARA(),
    kurHata: secenek.kurHata ?? false,
  };
  db.ayar.push({ anahtar: 'para_kategoriler', veri: { gider: ['Yemek', 'Market', 'Ulaşım', 'Fatura', 'Abonelik', 'Eğitim', 'Kişisel bakım', 'Diğer'], gelir: ['Harçlık', 'Diğer gelir'] }, updated_at: '2026-11-01T00:00:00+00:00' });
  if (secenek.kur) db.ayar.push({ anahtar: 'kur_usd_try', veri: secenek.kur, updated_at: '2026-11-01T00:00:00+00:00' });
  // Döviz kuru kaynakları (sahte): 50,52 ya da hata
  const kurYanit = { 'open.er-api.com': { result: 'success', rates: { TRY: 50.52 } }, 'api.frankfurter.dev': { rates: { TRY: 50.52 } }, 'cdn.jsdelivr.net': { usd: { try: 50.52 } } };
  for (const [host, govde] of Object.entries(kurYanit)) {
    await page.route(`https://${host}/**`, (route) => {
      db.istekler.push(`KUR ${host}`);
      return db.kurHata ? route.abort('internetdisconnected') : route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(govde) });
    });
  }
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
    if (tablo === 'takip_ayar' && req.method() === 'POST') {
      const b = JSON.parse(req.postData());
      const v = db.ayar.find((x) => x.anahtar === b.anahtar);
      if (v) { v.veri = b.veri; v.updated_at = yeniZaman(); } else db.ayar.push({ ...b, updated_at: yeniZaman() });
      return json([db.ayar.find((x) => x.anahtar === b.anahtar)], 201);
    }
    const P = db.para;
    if (url.pathname.endsWith('/rpc/para_abonelik_ode')) {
      const b = JSON.parse(req.postData());
      if (P.para_abonelik_odeme.some((o) => o.abonelik_id === b.p_abonelik && o.ay === b.p_ay)) return json({ code: '23505' }, 409);
      const a = P.para_abonelik.find((x) => x.id === b.p_abonelik);
      P.para_islem.unshift({ id: b.p_islem, tarih: b.p_tarih, tur: 'gider', kategori: a.kategori, hesap_id: a.hesap_id, hedef_hesap_id: null, tutar: a.tutar, giren_tutar: null, nota: a.ad, abonelik_id: a.id, updated_at: yeniZaman() });
      P.para_abonelik_odeme.push({ abonelik_id: a.id, ay: b.p_ay, islem_id: b.p_islem });
      return json(b.p_islem);
    }
    if (url.pathname.endsWith('/rpc/para_abonelik_geri_al')) {
      const b = JSON.parse(req.postData());
      const o = P.para_abonelik_odeme.find((x) => x.abonelik_id === b.p_abonelik && x.ay === b.p_ay);
      if (o) { P.para_islem = P.para_islem.filter((i) => i.id !== o.islem_id); P.para_abonelik_odeme = P.para_abonelik_odeme.filter((x) => x !== o); }
      return route.fulfill({ status: 204, body: '' });
    }
    if (tablo in P) {
      const pk = tablo === 'para_butce' ? 'kategori' : 'id';
      const f = (k) => url.searchParams.get(k)?.replace(/^eq\./, '');
      const eslesir = (r) => (!f(pk) || String(r[pk]) === f(pk)) && (!f('updated_at') || r.updated_at === f('updated_at'));
      if (req.method() === 'GET') {
        let r = P[tablo].filter(eslesir);
        if (tablo === 'para_islem') r = [...r].sort((a, b) => b.tarih.localeCompare(a.tarih));
        return json(r);
      }
      if (req.method() === 'POST') {
        const b = JSON.parse(req.postData());
        const v = P[tablo].find((r) => r[pk] === b[pk]);
        if (v && !url.searchParams.get('on_conflict')) return json({ code: '23505' }, 409);
        if (tablo === 'para_islem' && !P.para_hesap.some((h) => h.id === b.hesap_id)) return json({ code: '23503' }, 409);
        const yeni = { ...(v ?? {}), ...b, updated_at: yeniZaman() };
        if (tablo === 'para_hesap') Object.assign(yeni, { limit_tutar: yeni.limit_tutar ?? null, kesim_gunu: yeni.kesim_gunu ?? null, arsiv: yeni.arsiv ?? false, sira: yeni.sira ?? 0, para_birimi: yeni.para_birimi ?? 'TRY', acilis_bakiyesi: yeni.acilis_bakiyesi ?? 0 });
        if (tablo === 'para_islem') Object.assign(yeni, { hedef_hesap_id: yeni.hedef_hesap_id ?? null, giren_tutar: yeni.giren_tutar ?? null, nota: yeni.nota ?? null, abonelik_id: yeni.abonelik_id ?? null });
        if (tablo === 'para_abonelik') Object.assign(yeni, { aktif: yeni.aktif ?? true, para_birimi: yeni.para_birimi ?? 'TRY' });
        if (v) Object.assign(v, yeni); else P[tablo].push(yeni);
        return json([v ?? yeni], 201);
      }
      if (req.method() === 'PATCH') {
        const r = P[tablo].filter(eslesir);
        for (const x of r) Object.assign(x, JSON.parse(req.postData()), { updated_at: yeniZaman() });
        return json(r);
      }
      if (req.method() === 'DELETE') {
        const r = P[tablo].filter(eslesir);
        if (tablo === 'para_hesap' && r.some((h) => P.para_islem.some((i) => i.hesap_id === h.id || i.hedef_hesap_id === h.id))) return json({ code: '23503' }, 409);
        P[tablo] = P[tablo].filter((x) => !r.includes(x));
        if (tablo === 'para_islem') P.para_abonelik_odeme = P.para_abonelik_odeme.filter((o) => !r.some((x) => x.id === o.islem_id));
        return json(r);
      }
    }
    return json({ message: 'bilinmeyen' }, 404);
  });
  return db;
}

export const ADRES = process.env.ADRES ?? 'http://localhost:4173';
