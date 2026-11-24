import { useState } from 'preact/hooks';
import { ayDonemi, haftaDonemi, karsilastirma, ozet, paraBicim, sonAylar, yilDonemi } from '../../lib/para/hesap';
import { bugunPara, kurDegeri, useParaDepo } from '../../lib/para/store';
import { AYLAR, AYLAR_KISA, ayEkle, ayGecerli, ayMetni, kisaTarih } from '../../lib/tarih';
import { git } from '../../rota';
import { Sag, Sol } from '../../bilesenler/Ikonlar';
import { kategoriyleAc } from './Islemler';
import { CizgiSekme } from './ortak';

type DonemTuru = 'aylik' | 'haftalik' | 'yillik';

export function Ozet({ ay: istenen }: { ay?: string }) {
  const d = useParaDepo();
  const bugun = bugunPara();
  const ay = istenen && ayGecerli(istenen) ? istenen : bugun.slice(0, 7);
  const [tur, setTur] = useState<DonemTuru>('aylik');
  const kur = kurDegeri();
  const { islemler, hesaplar } = d.veri;
  const yil = Number(ay.slice(0, 4));

  const donem = tur === 'haftalik' ? haftaDonemi(bugun) : tur === 'yillik' ? yilDonemi(yil) : ayDonemi(ay);
  const o = ozet(islemler, hesaplar, donem, kur);
  const gecen = ozet(islemler, hesaplar, ayDonemi(ayEkle(ay, -1)), kur);
  const alti = sonAylar(islemler, hesaplar, ay, kur);
  const enBuyuk = Math.max(1, ...alti.flatMap((x) => [x.gelir, x.gider]));
  const cubukEn = Math.max(o.gelir, o.gider) || 1;
  const yilAylari = new Set(islemler.filter((i) => i.tarih.startsWith(`${yil}-`)).map((i) => Number(i.tarih.slice(5, 7))));
  const yilNotu = yilAylari.size
    ? `${yil} · ${AYLAR[Math.min(...yilAylari) - 1]}–${AYLAR[Math.max(...yilAylari) - 1]} kayıtlı`
    : `${yil} · kayıt yok`;
  const not = tur === 'yillik' ? yilNotu : tur === 'haftalik' ? `${kisaTarih(donem.bas)} – ${kisaTarih(donem.bit)}` : `1–${donem.bit.slice(8).replace(/^0/, '')} ${AYLAR[Number(ay.slice(5)) - 1]}`;
  const bos = o.islemSayisi === 0;

  return (
    <div class="yigin-24" style={{ gap: '32px' }}>
      <div class="yigin">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button type="button" class="ikon-dugme" aria-label="Önceki ay" onClick={() => git(`#/para/ozet/${ayEkle(ay, -1)}`)}><Sol /></button>
          <h2 style={{ fontSize: '18px' }}>{tur === 'yillik' ? String(yil) : ayMetni(ay)}</h2>
          <button type="button" class="ikon-dugme" aria-label="Sonraki ay" disabled={ay >= bugun.slice(0, 7)} onClick={() => git(`#/para/ozet/${ayEkle(ay, 1)}`)}><Sag /></button>
        </div>
        <div style={{ borderBottom: '1px solid var(--cizgi)' }}>
          <CizgiSekme etiket="Dönem" deger={tur} onSec={setTur} secenekler={[['aylik', 'Aylık'], ['haftalik', 'Haftalık'], ['yillik', 'Yıllık']]} />
        </div>
        <div class="kucuk-not">{not}</div>
      </div>

      {bos ? (
        <div class="bos-durum" style={{ padding: '48px 0' }}>Bu dönem için kayıt yok.</div>
      ) : (
        <>
          <section aria-label="Gelir gider kalan" class="yigin">
            <div class="ozet-ucu">
              <div><div class="etiket-k">Gelir</div><div class="d vurgu">{paraBicim(o.gelir)}</div></div>
              <div><div class="etiket-k">Gider</div><div class="d">{paraBicim(o.gider)}</div></div>
              <div><div class="etiket-k">Kalan</div><div class="d">{paraBicim(o.kalan)}</div></div>
            </div>
            <div class="yigin" style={{ gap: '6px' }} aria-hidden="true">
              <div class="oran-cubuk" style={{ background: 'var(--vurgu)', width: `${((o.gelir / cubukEn) * 100).toFixed(1)}%` }} />
              <div class="oran-cubuk" style={{ background: 'var(--ikincil)', width: `${((o.gider / cubukEn) * 100).toFixed(1)}%` }} />
            </div>
            <div class="etiket-k">
              {tur === 'aylik' ? karsilastirma(o.gider, gecen.gider) : tur === 'haftalik' ? `Son 7 gün (${kisaTarih(donem.bas)} – ${kisaTarih(donem.bit)})` : 'Kayıtlı aylar toplamı'}
            </div>
            {o.kurEksik && <div class="kucuk-not">Dolar hesaplarındaki gelir/gider kur alınamadığı için dahil edilmedi.</div>}
          </section>

          <section aria-labelledby="cf-h" class="yigin" style={{ gap: '8px' }}>
            <h3 id="cf-h" style={{ fontSize: '16px', fontWeight: 600 }}>Nakit akışı</h3>
            <div class="iki-sutun" style={{ gap: '16px', padding: '12px 0', borderTop: '1px solid var(--cizgi)', borderBottom: '1px solid var(--cizgi)' }}>
              <div><div class="etiket-k">Alınan</div><div class="vurgu" style={{ fontSize: '20px', fontWeight: 700, marginTop: '2px' }}>{paraBicim(o.gelir)}</div></div>
              <div><div class="etiket-k">Ödenen</div><div style={{ fontSize: '20px', fontWeight: 700, marginTop: '2px' }}>{tur === 'yillik' ? '–' : paraBicim(o.odenen)}</div></div>
            </div>
            <div class="kucuk-not">Ödenen: nakit ve bankadan çıkanlar, kredi kartı ödemesi hariç. Kartla yapılan harcamalar ({paraBicim(o.kartHarcama)}) kart ödenince buraya girer.</div>
          </section>

          {o.kategoriler.length > 0 && (
            <section aria-labelledby="cat-h">
              <h3 id="cat-h" style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Kategori dağılımı</h3>
              {o.kategoriler.map((k) => (
                <button key={k.ad} type="button" class="kat-satir" onClick={() => kategoriyleAc(k.ad)} aria-label={`${k.ad}: ${paraBicim(k.tutar)}, giderin yüzde ${Math.round(k.oran * 100)}'i. İşlemleri göster`}>
                  <span class="ust">
                    <span>{k.ad}</span>
                    <span><span style={{ fontWeight: 600 }}>{paraBicim(k.tutar)}</span> <span class="etiket-k" style={{ marginLeft: '6px' }}>%{Math.round(k.oran * 100)}</span></span>
                  </span>
                  <span class="cubuk" style={{ width: '100%' }}><span style={{ background: 'var(--ikincil)', width: `${(k.oran * 100).toFixed(1)}%` }} /></span>
                </button>
              ))}
            </section>
          )}
        </>
      )}

      <section aria-labelledby="six-h" class="yigin" style={{ gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h3 id="six-h" style={{ fontSize: '16px', fontWeight: 600 }}>Son 6 ay</h3>
          <span class="kucuk-not" style={{ display: 'flex', gap: '12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span class="kare" style={{ background: 'var(--vurgu)' }} />Gelir</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span class="kare" style={{ background: 'var(--sinir)' }} />Gider</span>
          </span>
        </div>
        <div class="alti-ay" role="img" aria-label={`Son 6 ay gelir ve gider: ${alti.map((x) => `${AYLAR[Number(x.ay.slice(5)) - 1]} gelir ${paraBicim(x.gelir)}, gider ${paraBicim(x.gider)}`).join('; ')}`}>
          {alti.map((x) => (
            <div key={x.ay}>
              <span style={{ background: 'var(--vurgu)', height: `${((x.gelir / enBuyuk) * 100).toFixed(1)}%` }} />
              <span style={{ background: 'var(--sinir)', height: `${((x.gider / enBuyuk) * 100).toFixed(1)}%` }} />
            </div>
          ))}
        </div>
        <div class="alti-etiket">
          {alti.map((x) => <span key={x.ay} class={x.ay === ay ? 'bu' : ''}>{AYLAR_KISA[Number(x.ay.slice(5)) - 1]}</span>)}
        </div>
      </section>
    </div>
  );
}
