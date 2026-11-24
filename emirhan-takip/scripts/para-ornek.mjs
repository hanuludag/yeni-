// Tasarımdaki (Money.dc.html) örnek Para verisi — SADECE testlerde/ekran görüntülerinde kullanılır.
const T = (gun) => `2026-11-${String(gun).padStart(2, '0')}`;
const UPD = '2026-11-24T10:00:00+00:00';
const id = (s) => `00000000-0000-4000-8000-${s.padStart(12, '0')}`;
export const PID = {
  nakit: id('1'), ana: id('2'), garanti: id('3'), yapikredi: id('4'), midas: id('5'), phantom: id('6'),
};
const SON = [
  ['nakit', 'Nakit', 'nakit', 'TRY', 1370], ['ana', 'Ana', 'banka', 'TRY', 4850],
  ['garanti', 'Garanti', 'kart', 'TRY', 2340, 10000, 15], ['yapikredi', 'Yapıkredi', 'kart', 'TRY', 640, 5000, 3],
  ['midas', 'Midas', 'birikim', 'USD', 80.52], ['phantom', 'Phantom', 'birikim', 'USD', 25],
];
let n = 0;
const tx = (tarih, tur, kategori, hesap, tutar, ek = {}) => ({
  id: id(`a${++n}`), tarih, tur, kategori, hesap_id: PID[hesap], hedef_hesap_id: null, tutar, giren_tutar: null,
  nota: null, abonelik_id: null, updated_at: UPD, created_at: UPD, ...ek,
});
export function paraOrnek() {
  n = 0;
  const islemler = [
    tx(T(24), 'gider', 'Yemek', 'nakit', 185), tx(T(24), 'gider', 'Ulaşım', 'ana', 40),
    tx(T(23), 'transfer', null, 'yapikredi', 277, { hedef_hesap_id: PID.midas, giren_tutar: 5.48 }),
    tx(T(22), 'gider', 'Market', 'garanti', 320), tx(T(22), 'gider', 'Yemek', 'nakit', 150),
    tx(T(21), 'gelir', 'Harçlık', 'ana', 2000), tx(T(20), 'gider', 'Abonelik', 'garanti', 100, { nota: 'Spotify', abonelik_id: id('b2') }),
    tx(T(18), 'gider', 'Ulaşım', 'ana', 120), tx(T(18), 'gider', 'Kişisel bakım', 'yapikredi', 250),
    tx(T(15), 'gider', 'Eğitim', 'garanti', 380, { nota: 'Kitap' }), tx(T(12), 'gider', 'Yemek', 'nakit', 210),
    tx(T(10), 'gider', 'Market', 'ana', 290), tx(T(5), 'gider', 'Fatura', 'ana', 350, { nota: 'Telefon faturası', abonelik_id: id('b1') }),
    tx(T(1), 'gelir', 'Harçlık', 'ana', 3000),
    // önceki aylar (tasarımdaki PAST: gelir, gider)
    ...[[6, 4000, 3100], [7, 4500, 3800], [8, 4000, 3300], [9, 5000, 4200], [10, 5000, 2720]].flatMap(([m, g, c]) => [
      tx(`2026-${String(m).padStart(2, '0')}-01`, 'gelir', 'Harçlık', 'ana', g),
      tx(`2026-${String(m).padStart(2, '0')}-15`, 'gider', 'Diğer', 'ana', c),
    ]),
  ];
  // Açılış = tasarımdaki son bakiye − işlemlerin etkisi (bakiye türetilir)
  const etki = Object.fromEntries(SON.map(([k]) => [PID[k], 0]));
  const tur = Object.fromEntries(SON.map(([k, , t]) => [PID[k], t]));
  const gir = (h, k) => { if (h in etki) etki[h] += tur[h] === 'kart' ? -k : k; };
  for (const i of islemler) {
    const t = Math.round(i.tutar * 100);
    if (i.tur === 'gider') gir(i.hesap_id, -t);
    else if (i.tur === 'gelir') gir(i.hesap_id, t);
    else { gir(i.hesap_id, -t); gir(i.hedef_hesap_id, Math.round(i.giren_tutar * 100)); }
  }
  const hesaplar = SON.map(([k, ad, t, b, bal, lim = null, kes = null], sira) => ({
    id: PID[k], ad, tur: t, para_birimi: b, acilis_bakiyesi: (Math.round(bal * 100) - etki[PID[k]]) / 100,
    limit_tutar: lim, kesim_gunu: kes, sira, arsiv: false, updated_at: UPD, created_at: UPD,
  }));
  const ab = (s, ad, tutar, gun, hesap, kategori) => ({ id: id(s), ad, tutar, para_birimi: 'TRY', gun, hesap_id: PID[hesap], kategori, aktif: true, updated_at: UPD, created_at: UPD });
  return {
    para_hesap: hesaplar,
    para_islem: islemler,
    para_butce: [['Yemek', 600], ['Market', 500], ['Ulaşım', 400], ['Eğitim', 500], ['Kişisel bakım', 300]].map(([kategori, limit_tutar]) => ({ kategori, limit_tutar, updated_at: UPD })),
    para_abonelik: [ab('b1', 'Telefon faturası', 350, 5, 'ana', 'Fatura'), ab('b2', 'Spotify', 100, 20, 'garanti', 'Abonelik'), ab('b3', 'iCloud', 40, 26, 'garanti', 'Abonelik'), ab('b4', 'İnternet paketi', 250, 30, 'ana', 'Fatura')],
    para_abonelik_odeme: [{ abonelik_id: id('b1'), ay: '2026-11', islem_id: islemler[12].id }, { abonelik_id: id('b2'), ay: '2026-11', islem_id: islemler[6].id }],
    para_hedef: [
      { id: id('c1'), ad: 'Dolar birikimi', hedef_tutar: 500, para_birimi: 'USD', bagli_hesap_id: PID.midas, mevcut_tutar: null, updated_at: UPD },
      { id: id('c2'), ad: 'Laptop', hedef_tutar: 40000, para_birimi: 'TRY', bagli_hesap_id: null, mevcut_tutar: 6500, updated_at: UPD },
    ],
  };
}
export const BOS_PARA = () => ({ para_hesap: [], para_islem: [], para_butce: [], para_abonelik: [], para_abonelik_odeme: [], para_hedef: [] });
