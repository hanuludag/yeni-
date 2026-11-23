import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { bugun, gunVerileri, useDepo } from '../lib/store';
import { ayAnahtari, ayEkle, ayMetni, AYLAR, kisaTarih, parcala } from '../lib/tarih';
import { ayOzeti, aydakiGunler, olcuDegeri, yilOzeti, type Olcu } from '../lib/istatistik';
import { sayiBicim } from '../lib/sayi';
import { git } from '../rota';
import { CizgiGrafik, CubukGrafik } from '../bilesenler/Grafik';
import { VeriYok } from '../bilesenler/Durumlar';
import { Asagi, Sag, Sol } from '../bilesenler/Ikonlar';

const OLCU_BILGI: Record<Olcu, { ad: string; grafik: string; birim: string; tur: 'cizgi' | 'cubuk'; alan?: [number, number] }> = {
  rapor: { ad: 'Rapor', grafik: 'Rapor puanı', birim: '/ 19', tur: 'cizgi', alan: [0, 19] },
  beslenme: { ad: 'Beslenme', grafik: 'Beslenme', birim: '/ 6', tur: 'cizgi', alan: [0, 6] },
  ders: { ad: 'Ders', grafik: 'Ders saati', birim: 'sa', tur: 'cubuk' },
  uyku: { ad: 'Uyku', grafik: 'Uyku saati', birim: 'sa', tur: 'cizgi' },
  ekran: { ad: 'Ekran', grafik: 'Ekran süresi', birim: 'sa', tur: 'cubuk' },
};
const SIRA: Olcu[] = ['rapor', 'beslenme', 'ders', 'uyku', 'ekran'];

export function Aylik({ ay: istenen, ust }: { ay?: string; ust: ComponentChildren }) {
  useDepo();
  const buAy = ayAnahtari(bugun());
  const ay = istenen ?? buAy;
  const gunler = gunVerileri();
  const o = ayOzeti(gunler, ay);
  const [gunlerAcik, setGunlerAcik] = useState(false);
  const yil = Number(ay.slice(0, 4));
  const yillik = yilOzeti(gunler, yil);
  const yazilanlar = aydakiGunler(gunler, ay).reverse();

  const tikler = [1, 5, 10, 15, 20, 25, 30].filter((g) => g <= o.gunSayisi).map((g) => ({ i: g - 1, metin: String(g) }));
  const sonDeger = (s: (number | undefined)[]) => [...s].reverse().find((v) => v !== undefined);

  return (
    <main>
      {ust}
      <div class="ay-bas">
        <button type="button" class="ikon-dugme" aria-label="Önceki ay" onClick={() => git(`#/aylik/${ayEkle(ay, -1)}`)}><Sol /></button>
        <div class="orta">
          <h1>{ayMetni(ay)}</h1>
          <div class="alt">{o.yazilanGun} gün yazıldı</div>
        </div>
        <button type="button" class="ikon-dugme" aria-label="Sonraki ay" disabled={ay >= buAy} onClick={() => git(`#/aylik/${ayEkle(ay, 1)}`)}><Sag /></button>
      </div>

      {o.yazilanGun === 0 ? (
        <div style={{ marginTop: '24px' }}>
          <VeriYok baslik="Bu ay için kayıt yok" alt="Günlük sekmesinden bir günü puanla." />
        </div>
      ) : (
        <>
          <div class="ort-kutular" aria-label="Ay ortalamaları">
            {SIRA.map((k) => (
              <div key={k}>
                <div class="etiket">{OLCU_BILGI[k].ad}</div>
                <div class="deger">{sayiBicim(o.ort[k], 1)}<small>{OLCU_BILGI[k].birim}</small></div>
              </div>
            ))}
          </div>

          {SIRA.map((k) => {
            const b = OLCU_BILGI[k];
            const s = o.seriler[k];
            const son = sonDeger(s);
            const aciklama = `${b.grafik}, ${ayMetni(ay)}: ${s.map((v, i) => (v === undefined ? null : `${i + 1}: ${sayiBicim(v)}`)).filter(Boolean).join(', ') || 'kayıt yok'}`;
            return (
              <section class="grafik-kart" key={k} aria-labelledby={`g-${k}`}>
                <div class="bolum-bas">
                  <h2 id={`g-${k}`}>{b.grafik}</h2>
                  <span class="ince">son {sayiBicim(son)} · ort. {sayiBicim(o.ort[k], 1)}</span>
                </div>
                {b.tur === 'cizgi' ? (
                  <CizgiGrafik n={o.gunSayisi} yukseklik={140} ic={0.02} aciklama={aciklama} xEtiket={tikler}
                    seriler={[{ ad: k, degerler: s, etiket: 'yok', sonNokta: true, alan: b.alan }]} />
                ) : (
                  <CubukGrafik n={o.gunSayisi} aciklama={aciklama} xEtiket={tikler} degerler={s} />
                )}
              </section>
            );
          })}

          <div class="katlanir" style={{ marginTop: '28px' }}>
            <button type="button" class="koyu" aria-expanded={gunlerAcik} aria-controls="gunler-tablo" onClick={() => setGunlerAcik(!gunlerAcik)}>
              Günler <Asagi />
            </button>
            {gunlerAcik && (
              <div class="tablo-kap" id="gunler-tablo">
                <table class="gunler-tablo">
                  <caption class="sr-only">{ayMetni(ay)} günleri; satıra dokununca gün Günlük’te açılır</caption>
                  <thead>
                    <tr><th scope="col">Gün</th><th scope="col">Rapor</th><th scope="col">Besl.</th><th scope="col">Ders</th><th scope="col">Uyku</th><th scope="col">Ekran</th><th scope="col" class="sadece-genis" style={{ textAlign: 'left' }}>Not</th></tr>
                  </thead>
                  <tbody>
                    {yazilanlar.map((t) => {
                      const v = gunler[t];
                      const not = typeof v.not === 'string' ? v.not.trim() : '';
                      return (
                        <tr key={t} onClick={() => git(`#/gunluk/${t}`)}>
                          <td><a href={`#/gunluk/${t}`} aria-label={`${kisaTarih(t)} gününü aç`}>{kisaTarih(t)}</a></td>
                          {SIRA.map((k) => {
                            const x = olcuDegeri(v, k);
                            return <td key={k} class={x === undefined ? 'bos' : ''}>{sayiBicim(x)}</td>;
                          })}
                          <td class="sadece-genis not-hucre" title={not || undefined}>{not || '–'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <section class="bolum" aria-labelledby="yil-baslik">
        <h2 id="yil-baslik" style={{ fontSize: '20px', marginBottom: '8px' }}>{yil} yıllık özet</h2>
        <div class="tablo-kap">
          <table>
            <caption class="sr-only">{yil} aylık ortalamalar</caption>
            <thead>
              <tr><th scope="col">Ay</th><th scope="col">Ders</th><th scope="col">Uyku</th><th scope="col">Besl.</th><th scope="col">Rapor</th><th scope="col">Ekran</th></tr>
            </thead>
            <tbody>
              {yillik.map((r) => {
                const m = parcala(`${r.ay}-01`).m;
                return (
                  <tr key={r.ay} class={r.ay === ay ? 'vurgulu' : ''}>
                    <td>{r.yazilanGun ? <a class="ay-link" href={`#/aylik/${r.ay}`}>{AYLAR[m - 1]}</a> : AYLAR[m - 1]}</td>
                    {(['ders', 'uyku', 'beslenme', 'rapor', 'ekran'] as Olcu[]).map((k) => (
                      <td key={k} class={r.ort[k] === null ? 'bos' : ''}>{sayiBicim(r.ort[k], 1)}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
