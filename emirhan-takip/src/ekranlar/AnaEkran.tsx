import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { bugun, gunVerileri, kriterler, rutinGonder, ayarKaydet, useDepo } from '../lib/store';
import { BOLUMLER, isaretDegistir, saateGoreBolum, type Bolum, type ProgramVeri } from '../lib/rutin';
import { parcala, uzunTarih } from '../lib/tarih';
import { seriHesapla, sonGunler, pencereSonu } from '../lib/seri';
import { ertelemeOzeti, sonNGun } from '../lib/istatistik';
import { ertelemeId, gunGirildi } from '../lib/puan';
import { sayiBicim } from '../lib/sayi';
import { CizgiGrafik, Lejant } from '../bilesenler/Grafik';
import { Tik } from '../bilesenler/Ikonlar';
import { ListeDuzenleyici } from '../bilesenler/ListeDuzenleyici';
import { ApiHata } from '../lib/api';

export function AnaEkran({ ust }: { ust: ComponentChildren }) {
  const d = useDepo();
  const gun = bugun();
  const gunler = gunVerileri();
  const girildi = gunGirildi(gunler[gun]);
  const son = pencereSonu(gunler, gun);

  return (
    <main>
      {ust}
      <p class="tarih-satiri">{uzunTarih(gun)}{d.simdi.getHours() < 5 ? ' (gece, 05:00’e kadar önceki gün)' : ''}</p>

      {!girildi && (
        <div class="cagri">
          <span>Bugün henüz puanlanmadı.</span>
          <a class="dugme ana" href="#/gunluk">Günü puanla</a>
        </div>
      )}

      <RutinKarti />
      <OzetSerit gunler={gunler} gun={gun} son={son} />
      <Trend gunler={gunler} son={son} />
    </main>
  );
}

function RutinKarti() {
  const d = useDepo();
  const program = d.program?.veri as ProgramVeri | undefined;
  const [bolum, setBolum] = useState<Bolum>(() => saateGoreBolum(new Date()));
  const [duzen, setDuzen] = useState<string[] | null>(null);
  const [kayit, setKayit] = useState<{ durum: 'bos' | 'kaydediliyor' | 'hata'; mesaj?: string }>({ durum: 'bos' });

  // Saat ilerledikçe (yoklama "simdi"yi günceller) otomatik bölüme geç; kullanıcı elle seçtiyse o saat dilimi bitene kadar dokunma.
  const otomatik = saateGoreBolum(d.simdi);
  const [sonOtomatik, setSonOtomatik] = useState(otomatik);
  useEffect(() => {
    if (otomatik !== sonOtomatik) { setSonOtomatik(otomatik); if (!duzen) setBolum(otomatik); }
  }, [otomatik]);

  const adimlar = program?.rutinler?.[bolum] ?? [];
  const isaret = d.rutin?.veri ?? {};
  const isaretli = (isaret[bolum] ?? []).filter((a) => adimlar.includes(a));

  const kaydet = async () => {
    if (!program || !duzen) return;
    const temiz = duzen.map((x) => x.trim()).filter(Boolean);
    setKayit({ durum: 'kaydediliyor' });
    try {
      await ayarKaydet('program', { ...program, rutinler: { ...program.rutinler, [bolum]: temiz } });
      setDuzen(null);
      setKayit({ durum: 'bos' });
    } catch (e) {
      setKayit({
        durum: 'hata',
        mesaj: e instanceof ApiHata && e.tur === 'cakisma'
          ? 'Rutinler başka bir cihazda değişmiş; en güncel hali yüklendi. Değişikliğini tekrar kaydetmek için Kaydet’e bas.'
          : 'Kaydedilemedi, tekrar dene. Düzenlemen burada duruyor.',
      });
    }
  };

  const ad = BOLUMLER.find((b) => b.id === bolum)!.ad;
  return (
    <section class="bolum" aria-labelledby="rutin-baslik">
      <div class="bolum-bas">
        <h2 id="rutin-baslik">Rutin</h2>
        {!duzen && program && <button type="button" class="baglanti" onClick={() => setDuzen([...adimlar])}>Düzenle</button>}
      </div>
      <div class="parcali" role="group" aria-label="Rutin bölümü">
        {BOLUMLER.map((b) => (
          <button type="button" key={b.id} aria-pressed={b.id === bolum} disabled={!!duzen && b.id !== bolum} onClick={() => setBolum(b.id)}>
            {b.ad}
          </button>
        ))}
      </div>

      {duzen ? (
        <div style={{ marginTop: '16px' }}>
          <ListeDuzenleyici ad={`${ad} adımı`} ogeler={duzen} onDegis={setDuzen} />
          {kayit.durum === 'hata' && <p class="hata-metin" role="alert">{kayit.mesaj}</p>}
          <div class="duzen-alt">
            <button type="button" class="dugme" onClick={() => { setDuzen(null); setKayit({ durum: 'bos' }); }}>Vazgeç</button>
            <button type="button" class="dugme ana" disabled={kayit.durum === 'kaydediliyor'} onClick={kaydet}>
              {kayit.durum === 'kaydediliyor' ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div class="liste-bas">
            <span>{bolum === otomatik ? 'Şu anki rutin' : `${ad} rutini`}</span>
            <span>{isaretli.length} / {adimlar.length} tamam</span>
          </div>
          {adimlar.length === 0 ? (
            <p class="bilgi">Bu bölümde adım yok. Düzenle ile ekleyebilirsin.</p>
          ) : (
            <ul class="rutin-liste">
              {adimlar.map((a, i) => (
                <li key={a + i}>
                  <label class="rutin-adim">
                    <input
                      type="checkbox"
                      checked={isaretli.includes(a)}
                      onChange={() => rutinGonder(isaretDegistir(isaret, bolum, a))}
                    />
                    <span class="daire" aria-hidden="true"><Tik /></span>
                    <span class="adim-ad">{a}</span>
                    <span class="adim-no" aria-hidden="true">{i + 1}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {d.rutin?.hata && <p class="hata-metin" role="status">{d.rutin.hata}</p>}
        </>
      )}
    </section>
  );
}

function OzetSerit({ gunler, gun, son }: { gunler: ReturnType<typeof gunVerileri>; gun: string; son: string }) {
  const seri = seriHesapla(gunler, gun);
  const noktalar = sonGunler(gunler, gun, 14);
  const e = ertelemeOzeti(gunler, son, ertelemeId(kriterler()));
  const dusuk = e.ort !== null && e.ort < 0.5;
  return (
    <div class="ozet-serit">
      <div class="ozet-kutu">
        <div class="etiket">Seri</div>
        <div class="buyuk">{seri}<small>gün</small></div>
        <div class="alt">üst üste kayıt</div>
        <div class="noktalar" role="img" aria-label={`Son 14 günün ${noktalar.filter((n) => n.dolu).length} gününde kayıt var`}>
          {noktalar.map((n) => <span key={n.tarih} class={`nokta${n.dolu ? ' dolu' : ''}`} title={`${parcala(n.tarih).g}: ${n.dolu ? 'kayıt var' : 'boş'}`} />)}
        </div>
      </div>
      <div class="ozet-kutu">
        <div class="etiket">Erteleme puanı</div>
        <div class={`buyuk${dusuk ? ' uyari' : ''}`}>{sayiBicim(e.ort)}<small>/ 1</small></div>
        <div class={`alt${dusuk ? ' uyari' : ''}`}>
          {e.ort === null
            ? 'son 7 günde puan yok'
            : e.fark === null
              ? dusuk ? 'çok erteleme' : 'son 7 gün ortalaması'
              : `${e.fark > 0.004 ? '↑' : e.fark < -0.004 ? '↓' : '→'} ${sayiBicim(Math.abs(e.fark))} geçen haftaya göre${dusuk ? ' · çok erteleme' : ''}`}
        </div>
      </div>
    </div>
  );
}

function Trend({ gunler, son }: { gunler: ReturnType<typeof gunVerileri>; son: string }) {
  const rapor = sonNGun(gunler, son, 7, 'rapor');
  const besl = sonNGun(gunler, son, 7, 'beslenme');
  const bos = rapor.every((r) => r.deger === undefined) && besl.every((r) => r.deger === undefined);
  return (
    <section class="bolum" aria-labelledby="trend-baslik">
      <div class="bolum-bas">
        <h2 id="trend-baslik" style={{ fontSize: '18px' }}>Son 7 gün</h2>
        <Lejant ogeler={[{ ad: 'rapor puanı / 19', stil: 'duz' }, { ad: 'beslenme / 6', stil: 'kesik' }]} />
      </div>
      {bos ? (
        <p class="bilgi">Son 7 günde kayıt yok.</p>
      ) : (
        <CizgiGrafik
          n={7}
          yukseklik={250}
          aciklama={`Son 7 gün rapor puanı: ${rapor.map((r) => `${parcala(r.tarih).g}: ${sayiBicim(r.deger)}`).join(', ')}. Beslenme: ${besl.map((r) => sayiBicim(r.deger)).join(', ')}.`}
          xEtiket={rapor.map((r, i) => ({ i, metin: String(parcala(r.tarih).g) }))}
          seriler={[
            { ad: 'rapor', degerler: rapor.map((r) => r.deger), etiket: 'hepsi', bant: [0, 0.58] },
            { ad: 'beslenme', degerler: besl.map((r) => r.deger), stil: 'kesik', etiket: 'son', bant: [0.78, 1] },
          ]}
        />
      )}
    </section>
  );
}
