import { describe, expect, it } from 'vitest';
import { etkinGun, gunEkle, uzunTarih, goreceliEtiket, kisaTarih, ayEkle, tarihGecerli } from './tarih';
import { sayiBicim, sayiAyristir, kesirEtiket } from './sayi';
import { formdanVeri, gunToplamlari, haritaToplami, veridenForm, formlarAyni, saatHatasi, ertelemeId, type GunVeri } from './puan';
import { seriHesapla, sonGunler, pencereSonu } from './seri';
import { ayOzeti, ertelemeOzeti, ortalama, yilOzeti } from './istatistik';
import { saateGoreBolum, isaretDegistir } from './rutin';

// Veritabanındaki 19–21 Kasım 2026 madde puanları (notlar hariç)
const G19: GunVeri = { hedefler: { g1: 0.5, g2: 1, g3: 1, g4: 1, g5: 1, g6: 1, g7: 0, g8: 0.75, g9: 0.5, g10: 1, g11: 0.5, g12: 0.75, g13: 0.75, g14: 0.5, g15: 0, g16: 0.5, g17: 0.5, g18: 1, g19: 0.5 }, saglik: { s1: 1, s2: 0, s3: 1, s4: 0.75, s5: 0.75, s6: 1 } };
const G20: GunVeri = { hedefler: { g1: 0.25, g2: 1, g3: 0.5, g4: 0, g5: 1, g6: 0, g7: 0.5, g8: 0.5, g9: 0.5, g10: 0.25, g11: 0, g12: 0.5, g13: 0.5, g14: 1, g15: 0, g16: 0.5, g17: 0.25, g18: 0.25, g19: 0 }, saglik: { s1: 0, s2: 0, s3: 0.75, s4: 1, s5: 0.5, s6: 1 } };
const G21: GunVeri = { hedefler: { g1: 0, g2: 0.5, g3: 0.25, g4: 0.25, g5: 0.5, g6: 1, g7: 0.5, g8: 0.25, g9: 1, g10: 0.25, g11: 0.5, g12: 0.25, g13: 0.25, g14: 0.5, g15: 0, g16: 0.25, g17: 0.25, g18: 0.5, g19: 0.25 }, saglik: { s1: 0.25, s2: 0.25, s3: 0.25, s4: 0.25, s5: 0.25, s6: 1 } };

describe('toplamlar (elle doğrulanan değerler)', () => {
  it('19 Kasım: 12,75 / 4,5', () => {
    expect(haritaToplami(G19.hedefler)).toBe(12.75);
    expect(haritaToplami(G19.saglik)).toBe(4.5);
  });
  it('20 Kasım: 7,5 / 3,25', () => {
    expect(gunToplamlari(G20)).toEqual({ gunluk: 7.5, saglik: 3.25 });
  });
  it('21 Kasım: 7,25 / 2,25', () => {
    expect(gunToplamlari(G21)).toEqual({ gunluk: 7.25, saglik: 2.25 });
  });
  it('madde detayı olmayan eski gün: kayıtlı toplam kullanılır', () => {
    expect(gunToplamlari({ gunlukToplam: 9.75, saglikToplam: 6 })).toEqual({ gunluk: 9.75, saglik: 6 });
    expect(gunToplamlari({ saglikToplam: 2 })).toEqual({ gunluk: undefined, saglik: 2 });
  });
  it('kayan nokta hatası yok', () => {
    expect(haritaToplami({ a: 0.1, b: 0.2 })).toBe(0.3);
  });
});

describe('formdanVeri', () => {
  it('eski günün toplamı, sadece saat değişince korunur', () => {
    const taban: GunVeri = { date: '2026-06-01', uyku: 6.2, calisma: 1.5, gunlukToplam: 9.75, saglikToplam: 6 };
    const f = veridenForm(taban);
    f.uyku = '7,5';
    const v = formdanVeri('2026-06-01', f, taban);
    expect(v).toEqual({ date: '2026-06-01', uyku: 7.5, calisma: 1.5, gunlukToplam: 9.75, saglikToplam: 6 });
  });
  it('madde puanı girilince toplam yeniden hesaplanır, silinmiş maddenin puanı korunur', () => {
    const taban: GunVeri = { date: 'x', hedefler: { g1: 1, eski: 0.5 }, gunlukToplam: 1.5 };
    const f = veridenForm(taban);
    f.hedefler.g1 = 0.25;
    const v = formdanVeri('x', f, taban);
    expect(v.hedefler).toEqual({ g1: 0.25, eski: 0.5 });
    expect(v.gunlukToplam).toBe(0.75);
  });
  it('boş saat alanı silinir, not kırpılmadan saklanır, bilinmeyen alan korunur', () => {
    const taban: GunVeri = { date: 'x', ekran: 2, ozel: 'k' };
    const f = veridenForm(taban);
    f.ekran = '';
    f.not = ' merhaba ';
    const v = formdanVeri('x', f, taban);
    expect(v.ekran).toBeUndefined();
    expect(v.not).toBe(' merhaba ');
    expect(v.ozel).toBe('k');
  });
  it('formlarAyni: "7,5" ile "7.5" aynı', () => {
    const a = veridenForm({ uyku: 7.5 });
    const b = { ...a, uyku: '7.5' };
    expect(formlarAyni(a, b)).toBe(true);
    expect(formlarAyni(a, { ...a, uyku: '8' })).toBe(false);
  });
  it('saat doğrulama', () => {
    expect(saatHatasi('')).toBeNull();
    expect(saatHatasi('7,5')).toBeNull();
    expect(saatHatasi('abc')).toMatch(/Geçerli/);
    expect(saatHatasi('25')).toMatch(/24/);
  });
});

describe('sayı ve tarih biçimi', () => {
  it('Türkçe sayı', () => {
    expect(sayiBicim(12.75)).toBe('12,75');
    expect(sayiBicim(11.2333, 1)).toBe('11,2');
    expect(sayiBicim(7)).toBe('7');
    expect(sayiBicim(undefined)).toBe('–');
    expect(kesirEtiket(0.25)).toBe('¼');
  });
  it('sayı ayrıştırma', () => {
    expect(sayiAyristir('7,5')).toBe(7.5);
    expect(sayiAyristir(' 8 ')).toBe(8);
    expect(sayiAyristir('')).toBeNull();
    expect(Number.isNaN(sayiAyristir('1,2,3') as number)).toBe(true);
  });
  it('uzun tarih', () => {
    expect(uzunTarih('2026-11-22')).toBe('22 Kasım 2026, Pazar');
    expect(kisaTarih('2026-11-21')).toBe('21 Kas');
    expect(goreceliEtiket('2026-11-21', '2026-11-22')).toBe('Dün');
  });
  it('gün/ay aritmetiği, ay ve yıl sınırı', () => {
    expect(gunEkle('2026-12-01', -1)).toBe('2026-11-30');
    expect(gunEkle('2026-12-31', 1)).toBe('2027-01-01');
    expect(gunEkle('2028-03-01', -1)).toBe('2028-02-29');
    expect(ayEkle('2026-01', -1)).toBe('2025-12');
    expect(tarihGecerli('2026-02-30')).toBe(false);
  });
});

describe('05:00 kuralı', () => {
  it('04:59 → dün, 05:00 → bugün', () => {
    expect(etkinGun(new Date(2026, 10, 23, 4, 59))).toBe('2026-11-22');
    expect(etkinGun(new Date(2026, 10, 23, 5, 0))).toBe('2026-11-23');
    expect(etkinGun(new Date(2026, 10, 23, 0, 30))).toBe('2026-11-22');
  });
  it('ay başında 05:00 öncesi önceki ayın son günü', () => {
    expect(etkinGun(new Date(2026, 11, 1, 2, 0))).toBe('2026-11-30');
    expect(etkinGun(new Date(2027, 0, 1, 3, 0))).toBe('2026-12-31');
  });
  it('rutin bölümü saate göre', () => {
    expect(saateGoreBolum(new Date(2026, 0, 1, 4, 0))).toBe('gece');
    expect(saateGoreBolum(new Date(2026, 0, 1, 7, 0))).toBe('sabah');
    expect(saateGoreBolum(new Date(2026, 0, 1, 10, 59))).toBe('sabah');
    expect(saateGoreBolum(new Date(2026, 0, 1, 11, 0))).toBe('ogle');
    expect(saateGoreBolum(new Date(2026, 0, 1, 16, 59))).toBe('ogle');
    expect(saateGoreBolum(new Date(2026, 0, 1, 17, 0))).toBe('gece');
  });
});

describe('seri', () => {
  const d = (t: number) => ({ gunlukToplam: t });
  it('bugün boş, dün dolu: seri dünden sayılır', () => {
    const g = { '2026-11-20': d(5), '2026-11-21': d(6) };
    expect(seriHesapla(g, '2026-11-22')).toBe(2);
  });
  it('bugün dolu: bugün dahil', () => {
    const g = { '2026-11-21': d(6), '2026-11-22': d(1) };
    expect(seriHesapla(g, '2026-11-22')).toBe(2);
  });
  it('aradaki boş gün seriyi keser', () => {
    const g = { '2026-11-18': d(1), '2026-11-20': d(5), '2026-11-21': d(6) };
    expect(seriHesapla(g, '2026-11-22')).toBe(2);
  });
  it('dün de boşsa seri 0', () => {
    const g = { '2026-11-20': d(5) };
    expect(seriHesapla(g, '2026-11-22')).toBe(0);
  });
  it('ay sınırını geçer', () => {
    const g = { '2026-10-30': d(1), '2026-10-31': d(1), '2026-11-01': d(1), '2026-11-02': d(1) };
    expect(seriHesapla(g, '2026-11-02')).toBe(4);
  });
  it('05:00 kuralıyla: 23 Kasım 02:00 → etkin gün 22 Kasım', () => {
    const g = { '2026-11-21': d(1), '2026-11-22': d(1) };
    const bugun = etkinGun(new Date(2026, 10, 23, 2, 0));
    expect(seriHesapla(g, bugun)).toBe(2);
    // 05:00'ten sonra 23 Kasım boş ama seri dünden (22) devam eder
    expect(seriHesapla(g, etkinGun(new Date(2026, 10, 23, 9, 0)))).toBe(2);
  });
  it('yalnızca sağlık toplamı olan gün de sayılır', () => {
    expect(seriHesapla({ '2026-06-18': { saglikToplam: 2 } }, '2026-06-18')).toBe(1);
  });
  it('son 14 gün noktaları', () => {
    const s = sonGunler({ '2026-11-22': d(1), '2026-11-09': d(1) }, '2026-11-22');
    expect(s).toHaveLength(14);
    expect(s[0]).toEqual({ tarih: '2026-11-09', dolu: true });
    expect(s[13]).toEqual({ tarih: '2026-11-22', dolu: true });
    expect(s.filter((x) => x.dolu)).toHaveLength(2);
  });
  it('pencere sonu', () => {
    expect(pencereSonu({}, '2026-11-22')).toBe('2026-11-21');
    expect(pencereSonu({ '2026-11-22': d(1) }, '2026-11-22')).toBe('2026-11-22');
  });
});

describe('ortalamalar', () => {
  const gunler = {
    '2026-11-19': { ...G19, gunlukToplam: 12.75, calisma: 4, uyku: 6.5, ekran: 2 },
    '2026-11-20': { ...G20, calisma: 1, uyku: 6.5, ekran: 2.5 },
    '2026-11-21': { ...G21, calisma: 1, uyku: 9 },
  };
  it('yazılmamış gün ortalamaya girmez', () => {
    const o = ayOzeti(gunler, '2026-11');
    expect(o.yazilanGun).toBe(3);
    expect(o.gunSayisi).toBe(30);
    expect(o.ort.rapor).toBeCloseTo((12.75 + 7.5 + 7.25) / 3);
    expect(o.ort.ekran).toBeCloseTo(2.25); // 21'de ekran yok
    expect(o.seriler.rapor[0]).toBeUndefined();
    expect(o.seriler.rapor[18]).toBe(12.75);
  });
  it('boş ay', () => {
    const o = ayOzeti(gunler, '2026-10');
    expect(o.yazilanGun).toBe(0);
    expect(o.ort.rapor).toBeNull();
  });
  it('yıllık özet', () => {
    const y = yilOzeti(gunler, 2026);
    expect(y).toHaveLength(12);
    expect(y[10].yazilanGun).toBe(3);
    expect(y[0].ort.uyku).toBeNull();
  });
  it('ortalama boşları atlar', () => {
    expect(ortalama([1, undefined, 3, null])).toBe(2);
    expect(ortalama([])).toBeNull();
  });
  it('erteleme: son 7 gün ve önceki hafta', () => {
    const g = {
      '2026-11-21': { hedefler: { g14: 0.5 } },
      '2026-11-20': { hedefler: { g14: 0.25 } },
      '2026-11-13': { hedefler: { g14: 1 } },
    };
    const e = ertelemeOzeti(g, '2026-11-21', 'g14');
    expect(e.ort).toBe(0.375);
    expect(e.onceki).toBe(1);
    expect(e.fark).toBeCloseTo(-0.625);
    expect(ertelemeOzeti({}, '2026-11-21', 'g14')).toEqual({ ort: null, onceki: null, fark: null });
  });
  it('erteleme kimliği adla bulunur', () => {
    expect(ertelemeId({ gunluk: [{ id: 'x9', ad: 'Erteleme' }], saglik: [] })).toBe('x9');
    expect(ertelemeId(null)).toBe('g14');
  });
});

describe('rutin işaretleri', () => {
  it('aç / kapat', () => {
    let i = isaretDegistir({}, 'sabah', 'Kalkış');
    expect(i.sabah).toEqual(['Kalkış']);
    i = isaretDegistir(i, 'sabah', 'Kalkış');
    expect(i.sabah).toEqual([]);
  });
});
