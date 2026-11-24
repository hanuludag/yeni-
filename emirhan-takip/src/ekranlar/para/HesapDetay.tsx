import { useState } from 'preact/hooks';
import * as api from '../../lib/para/api';
import { kurus, paraBicim, tlKarsiligi, tutarAyristir, TUR_AD, type Islem } from '../../lib/para/hesap';
import {
  bugunPara, kurDegeri, paraBakiyeler, taslakOku, taslakSil, taslakYaz, useParaDepo, yazmaHatasi, yazVeYenile, yeniId,
} from '../../lib/para/store';
import { AYLAR, GUNLER, ayMetni, parcala } from '../../lib/tarih';
import { git } from '../../rota';
import { HesapFormu } from './Hesaplar';
import { CizgiSekme, GeriOk, HataKutu, islemGorunumu } from './ortak';

export function HesapDetay({ id }: { id: string }) {
  const d = useParaDepo();
  const h = d.veri.hesaplar.find((x) => x.id === id);
  const [duzen, setDuzen] = useState(false);
  const [arsivSor, setArsivSor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const taslak = taslakOku<{ tur: 'gider' | 'gelir'; tutar: string }>(`detay-${id}`);
  const [tur, setTur] = useState<'gider' | 'gelir'>(taslak?.tur ?? 'gider');
  const [tutar, setTutar] = useState(taslak?.tutar ?? '');
  const [kayit, setKayit] = useState(false);

  if (!h) {
    return (
      <div class="bos-durum">
        <span>Hesap bulunamadı (silinmiş olabilir).</span>
        <a class="baglanti" href="#/para">Hesaplara dön</a>
      </div>
    );
  }
  const bak = paraBakiyeler().get(h.id) ?? 0;
  const kur = kurDegeri();
  const tlk = h.para_birimi === 'USD' ? tlKarsiligi(bak, 'USD', kur) : null;
  const bugun = bugunPara();
  const ay = bugun.slice(0, 7);
  const benim = d.veri.islemler.filter((i) => i.hesap_id === h.id || i.hedef_hesap_id === h.id);
  let gelen = 0, giden = 0;
  for (const i of benim) {
    if (!i.tarih.startsWith(ay)) continue;
    if (i.tur === 'gelir') gelen += kurus(i.tutar);
    else if (i.tur === 'gider') giden += kurus(i.tutar);
    else if (i.hedef_hesap_id === h.id) gelen += kurus(i.giren_tutar ?? i.tutar);
    else giden += kurus(i.tutar);
  }
  const hesapBul = (x: string | null) => d.veri.hesaplar.find((y) => y.id === x);

  const yaz = (t: string, tr = tur) => { setTutar(t); taslakYaz(`detay-${id}`, { tur: tr, tutar: t }); setHata(null); };
  const kaydet = async () => {
    const k = tutarAyristir(tutar);
    if (k === null) return;
    if (Number.isNaN(k) || k <= 0) return setHata('Geçerli bir tutar yaz (ör. 150 veya 1.250,50).');
    setKayit(true);
    const islem: Partial<Islem> = { id: yeniId(), tarih: bugun, tur, kategori: tur === 'gider' ? 'Diğer' : 'Diğer gelir', hesap_id: h.id, tutar: k / 100 };
    try {
      await yazVeYenile(() => api.ekle('para_islem', islem));
      setTutar('');
      taslakSil(`detay-${id}`);
    } catch (e) {
      setHata(yazmaHatasi(e));
    } finally {
      setKayit(false);
    }
  };
  const arsivle = async () => {
    try {
      await yazVeYenile(() => api.guncelle('para_hesap', 'id', h.id, { arsiv: true }, h.updated_at));
      git('#/para');
    } catch (e) {
      setHata(yazmaHatasi(e));
    }
  };

  return (
    <div class="yigin-24">
      <a class="geri" href="#/para"><GeriOk />Hesaplar</a>
      {duzen ? (
        <HesapFormu hesap={h} onBitti={() => setDuzen(false)} />
      ) : (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div class="etiket-k">{TUR_AD[h.tur]}{h.tur === 'kart' ? ' · borç' : ''}{h.arsiv ? ' · arşivde' : ''}</div>
          <h2 style={{ fontSize: '24px' }}>{h.ad}</h2>
          <div style={{ fontSize: '30px', fontWeight: 700, marginTop: '8px', color: h.tur === 'kart' ? 'var(--ikincil)' : 'var(--metin)' }}>{paraBicim(bak, h.para_birimi)}</div>
          {tlk !== null && <div class="etiket-k">≈ {paraBicim(tlk)}</div>}
          {h.tur === 'kart' && h.limit_tutar ? <div class="etiket-k">Limit {paraBicim(kurus(h.limit_tutar))}{h.kesim_gunu ? ` · kesim günü ${h.kesim_gunu}` : ''}</div> : null}
        </section>
      )}

      <section aria-label="Bu ay" class="yigin" style={{ gap: '8px' }}>
        <div class="etiket-k">{ayMetni(ay)}</div>
        <div class="uc-sutun">
          <div><div class="kucuk-not">Gelen</div><div class="d vurgu">{paraBicim(gelen, h.para_birimi)}</div></div>
          <div><div class="kucuk-not">Giden</div><div class="d">{paraBicim(giden, h.para_birimi)}</div></div>
          <div><div class="kucuk-not">= Bakiye</div><div class="d">{paraBicim(bak, h.para_birimi)}</div></div>
        </div>
      </section>

      <section aria-labelledby="det-islem">
        <h3 id="det-islem" style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>İşlemler</h3>
        {benim.length === 0 && <div class="islem-satir kucuk-not" style={{ fontSize: '14px' }}>Bu hesapta henüz işlem yok.</div>}
        {benim.slice(0, 60).map((i) => {
          const g = islemGorunumu(i, hesapBul);
          const gelenMi = i.tur === 'gelir' || (i.tur === 'transfer' && i.hedef_hesap_id === h.id);
          const tutarK = i.tur === 'transfer' ? (gelenMi ? kurus(i.giren_tutar ?? i.tutar) : kurus(i.tutar)) : kurus(i.tutar);
          const { m, g: gun } = parcala(i.tarih);
          return (
            <div class="islem-satir" key={i.id}>
              <span class="gun" title={`${gun} ${AYLAR[m - 1]}`}>{gun}</span>
              <span class="is-orta">
                <span class="is-kat">{g.kat}</span>
                <span class="kucuk-not">{i.tur === 'transfer' ? g.hesap : i.nota || `${AYLAR[m - 1]} · ${GUNLER[new Date(i.tarih + 'T12:00:00').getDay()]}`}</span>
              </span>
              <span class={`is-tutar${gelenMi ? ' gelir' : ''}`}>{gelenMi ? '+' : ''}{paraBicim(tutarK, h.para_birimi)}</span>
            </div>
          );
        })}
      </section>

      {!duzen && (
        <div class="yigin" style={{ gap: '8px' }}>
          <div class="sag-dugmeler" style={{ justifyContent: 'flex-start' }}>
            <button type="button" class="dugme" onClick={() => setDuzen(true)}>Hesabı düzenle</button>
            {!h.arsiv && !arsivSor && <button type="button" class="dugme" onClick={() => setArsivSor(true)}>Arşivle</button>}
          </div>
          {arsivSor && (
            <div class="satir-eylem" style={{ justifyContent: 'flex-start' }}>
              <span class="soru">Arşivlensin mi? Listeden ve toplamlardan kalkar, işlemleri durur.</span>
              <button type="button" class="metin-dugme" onClick={() => setArsivSor(false)}>Vazgeç</button>
              <button type="button" class="dugme beyaz" onClick={arsivle}>Evet, arşivle</button>
            </div>
          )}
        </div>
      )}

      {!h.arsiv && (
        <section class="hizli-alt" aria-label="Hızlı ekle">
          <CizgiSekme sola etiket="İşlem türü" deger={tur} onSec={(t) => { setTur(t); yaz(tutar, t); }} secenekler={[['gider', 'Gider'], ['gelir', 'Gelir']]} />
          <div style={{ display: 'flex', gap: '8px' }}>
            <input class="alan tutar-alan" style={{ flex: 1, fontSize: '18px' }} inputMode="decimal" aria-label="Tutar"
              placeholder={`Tutar ${h.para_birimi === 'USD' ? '$' : '₺'}`} value={tutar}
              onInput={(e) => yaz((e.target as HTMLInputElement).value)} onKeyDown={(e) => { if (e.key === 'Enter') void kaydet(); }} />
            <button type="button" class="dugme ana" style={{ minHeight: '48px' }} disabled={kayit} onClick={kaydet}>{kayit ? '…' : 'Kaydet'}</button>
          </div>
          <HataKutu mesaj={hata} />
        </section>
      )}
    </div>
  );
}
