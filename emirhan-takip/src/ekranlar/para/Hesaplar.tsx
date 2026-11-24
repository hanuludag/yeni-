import { useState } from 'preact/hooks';
import * as api from '../../lib/para/api';
import {
  kurAyristir, kurBicim, paraBicim, tlKarsiligi, toplamlar, tutarAyristir, TUR_AD,
  type Birim, type Hesap, type HesapTuru,
} from '../../lib/para/hesap';
import {
  aktifHesaplar, bugunPara, kurDegeri, kurElle, kurYenile, paraBakiyeler, taslakOku, taslakSil, taslakYaz,
  useParaDepo, yazmaHatasi, yazVeYenile, yeniId,
} from '../../lib/para/store';
import { git } from '../../rota';
import { Cip, HataKutu, Ok, Yenile } from './ortak';

const GRUPLAR: [HesapTuru, string][] = [['nakit', 'NAKİT'], ['banka', 'BANKA'], ['kart', 'KREDİ KARTI'], ['birikim', 'BİRİKİM']];

interface FormDeger { ad: string; tur: HesapTuru; birim: Birim; bakiye: string; limit: string; kesim: string }
const BOS_FORM: FormDeger = { ad: '', tur: 'banka', birim: 'TRY', bakiye: '', limit: '', kesim: '' };

/** Yeni hesap / hesap düzenleme formu. */
export function HesapFormu({ hesap, onBitti }: { hesap?: Hesap; onBitti: () => void }) {
  const taslakAnahtari = hesap ? `hesap-${hesap.id}` : 'yeni-hesap';
  const ilk: FormDeger = hesap
    ? {
        ad: hesap.ad, tur: hesap.tur, birim: hesap.para_birimi,
        bakiye: String(hesap.acilis_bakiyesi).replace('.', ','),
        limit: hesap.limit_tutar ? String(hesap.limit_tutar).replace('.', ',') : '',
        kesim: hesap.kesim_gunu ? String(hesap.kesim_gunu) : '',
      }
    : BOS_FORM;
  const [f, setF] = useState<FormDeger>(() => taslakOku<FormDeger>(taslakAnahtari) ?? ilk);
  const [hata, setHata] = useState<string | null>(null);
  const [kayit, setKayit] = useState(false);
  const d = (p: Partial<FormDeger>) => { const y = { ...f, ...p }; setF(y); taslakYaz(taslakAnahtari, y); setHata(null); };

  const kaydet = async () => {
    const bakiye = tutarAyristir(f.bakiye);
    const limit = tutarAyristir(f.limit);
    const kesim = f.kesim.trim() ? Number(f.kesim) : null;
    if (!f.ad.trim()) return setHata('Hesap adını yaz.');
    if (Number.isNaN(bakiye as number)) return setHata('Bakiye geçerli bir tutar olmalı (ör. 1.370,00).');
    if (f.tur === 'kart' && Number.isNaN(limit as number)) return setHata('Limit geçerli bir tutar olmalı.');
    if (f.tur === 'kart' && kesim !== null && !(Number.isInteger(kesim) && kesim >= 1 && kesim <= 31)) return setHata('Kesim günü 1 ile 31 arası olmalı.');
    const satir = {
      ad: f.ad.trim(), tur: f.tur, para_birimi: f.birim,
      acilis_bakiyesi: (bakiye ?? 0) / 100,
      limit_tutar: f.tur === 'kart' && limit ? limit / 100 : null,
      kesim_gunu: f.tur === 'kart' ? kesim : null,
    };
    setKayit(true);
    try {
      if (hesap) await yazVeYenile(() => api.guncelle('para_hesap', 'id', hesap.id, satir, hesap.updated_at));
      else await yazVeYenile(() => api.ekle('para_hesap', { id: yeniId(), sira: aktifHesaplar().length, ...satir }));
      taslakSil(taslakAnahtari);
      onBitti();
    } catch (e) {
      setHata(yazmaHatasi(e));
    } finally {
      setKayit(false);
    }
  };

  return (
    <section class="kutu yigin" aria-label={hesap ? 'Hesabı düzenle' : 'Yeni hesap'}>
      <h2 style={{ fontSize: '16px', fontWeight: 600 }}>{hesap ? 'Hesabı düzenle' : 'Yeni hesap'}</h2>
      <label class="alan-etiket">İsim
        <input class="alan" value={f.ad} placeholder="örn. Ziraat" onInput={(e) => d({ ad: (e.target as HTMLInputElement).value })} />
      </label>
      <div class="etiket-k" id="hf-tur">Tür</div>
      <div class="cipler sar" role="group" aria-labelledby="hf-tur">
        {(Object.keys(TUR_AD) as HesapTuru[]).map((k) => (
          <Cip key={k} secili={f.tur === k} onClick={() => d({ tur: k, birim: k === 'birikim' && !hesap ? 'USD' : f.birim })}>{TUR_AD[k]}</Cip>
        ))}
      </div>
      <div class="etiket-k" id="hf-birim">Para birimi</div>
      <div class="cipler" role="group" aria-labelledby="hf-birim">
        <Cip secili={f.birim === 'TRY'} etiket="Türk lirası" onClick={() => d({ birim: 'TRY' })}>₺</Cip>
        <Cip secili={f.birim === 'USD'} etiket="Dolar" onClick={() => d({ birim: 'USD' })}>$</Cip>
      </div>
      <label class="alan-etiket">{f.tur === 'kart' ? (hesap ? 'Açılış borcu' : 'Güncel borç') : 'Açılış bakiyesi'}
        <input class="alan" inputMode="decimal" placeholder="0,00" value={f.bakiye} onInput={(e) => d({ bakiye: (e.target as HTMLInputElement).value })} />
      </label>
      {hesap && <p class="kucuk-not" style={{ margin: 0 }}>Bakiye işlemlerden hesaplanır; burada sadece başlangıç tutarını değiştirirsin.</p>}
      {f.tur === 'kart' && (
        <div class="iki-sutun">
          <label class="alan-etiket">Limit
            <input class="alan" inputMode="decimal" placeholder="0,00" value={f.limit} onInput={(e) => d({ limit: (e.target as HTMLInputElement).value })} />
          </label>
          <label class="alan-etiket">Hesap kesim günü
            <input class="alan" inputMode="numeric" placeholder="15" value={f.kesim} onInput={(e) => d({ kesim: (e.target as HTMLInputElement).value })} />
          </label>
        </div>
      )}
      <HataKutu mesaj={hata} />
      <div class="sag-dugmeler">
        <button type="button" class="metin-dugme" onClick={() => { taslakSil(taslakAnahtari); onBitti(); }}>Vazgeç</button>
        <button type="button" class="dugme ana" disabled={kayit} onClick={kaydet}>{kayit ? 'Kaydediliyor…' : 'Kaydet'}</button>
      </div>
    </section>
  );
}

export function KurSatiri() {
  const d = useParaDepo();
  const k = d.veri.kur;
  const [elle, setElle] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const saat = k ? new Date(k.tarih).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '';
  const elleKaydet = () => {
    const n = kurAyristir(elle);
    if (n === null) return;
    if (Number.isNaN(n)) { setHata('Kur geçerli bir sayı olmalı (ör. 50,52).'); return; }
    setHata(null);
    void kurElle(n);
    setElle('');
  };
  const elleAlan = (
    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>Elle
      <input class="alan" inputMode="decimal" aria-label="Kuru elle gir" value={elle} placeholder={k ? kurBicim(k.kur) : '50,00'}
        onInput={(e) => setElle((e.target as HTMLInputElement).value)} onChange={elleKaydet}
        onKeyDown={(e) => { if (e.key === 'Enter') elleKaydet(); }} />
    </label>
  );
  if (d.kurDurum === 'alinamadi' || !k) {
    return (
      <div class="kur-satir" role="status">
        <span>{k ? `Kur alınamadı — son bilinen: ${kurBicim(k.kur)} ₺ (${new Date(k.tarih).toLocaleDateString('tr-TR')})` : d.kurDurum === 'yukleniyor' ? 'Kur alınıyor…' : 'Kur alınamadı. TL karşılıkları gizlendi.'}</span>
        {d.kurDurum !== 'yukleniyor' && elleAlan}
        {hata && <span class="hata-metin" style={{ width: '100%' }}>{hata}</span>}
      </div>
    );
  }
  return (
    <div class="kur-satir">
      <span>
        Kur: 1 $ = {kurBicim(k.kur)} ₺ · {k.kaynak === 'elle' ? 'elle girildi' : 'otomatik'} · {saat} güncellendi
        {k.kaynak === 'ExchangeRate-API' && <> · <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener">ExchangeRate-API</a></>}
      </span>
      <button type="button" class="ikon-dugme" aria-label="Kuru yenile" onClick={() => kurYenile(true)}><Yenile /></button>
    </div>
  );
}

export function Hesaplar({ formAcik }: { formAcik: boolean }) {
  const d = useParaDepo();
  const hesaplar = aktifHesaplar();
  const bak = paraBakiyeler();
  const kur = kurDegeri();
  const T = toplamlar(hesaplar, bak, d.veri.abonelikler, d.veri.odemeler, bugunPara(), kur);
  const formuKapat = () => git('#/para');

  return (
    <div class="yigin-24">
      {formAcik && <HesapFormu onBitti={formuKapat} />}
      {hesaplar.length === 0 && !formAcik && (
        <div class="bos-durum buyuk">
          <span>Henüz hesap yok.</span>
          <a class="dugme ana" href="#/para/hesaplar/yeni" style={{ minHeight: '48px', padding: '0 24px' }}>İlk hesabını ekle</a>
        </div>
      )}
      {hesaplar.length > 0 && (
        <>
          <section class="kutu" aria-label="Net varlık" style={{ padding: '20px 16px' }}>
            <div class="etiket-k">Net varlık</div>
            <div class="buyuk-tutar" style={{ marginTop: '4px' }}>{paraBicim(T.netVarlik)}</div>
            <div style={{ fontSize: '14px', color: 'var(--ikincil)', marginTop: '6px' }}>
              Harcayabileceğim: <span class="vurgu" style={{ fontWeight: 600 }}>{paraBicim(T.harcayabilecegim)}</span>
            </div>
            <div class="kucuk-not" style={{ marginTop: '8px' }}>
              Kredi kartı borcu düşüldü, birikim TL karşılığıyla dahil.
              {T.kurEksik && ' Kur olmadığı için dolar tutarları dahil edilmedi.'}
            </div>
          </section>

          {GRUPLAR.map(([tur, baslik]) => {
            const liste = hesaplar.filter((h) => h.tur === tur);
            if (!liste.length) return null;
            const tl = liste.map((h) => tlKarsiligi(bak.get(h.id) ?? 0, h.para_birimi, kur));
            const toplamTL = tl.every((x) => x !== null) ? tl.reduce<number>((a, b) => a + (b ?? 0), 0) : null;
            const toplam = toplamTL === null ? '–' : tur === 'kart' ? `Borç ${paraBicim(toplamTL)}` : paraBicim(toplamTL);
            return (
              <section key={tur} aria-labelledby={`g-${tur}`}>
                <div class="grup-bas"><h2 id={`g-${tur}`}>{baslik}</h2><span>{toplam}</span></div>
                {tur === 'birikim' && <KurSatiri />}
                {liste.map((h) => {
                  const b = bak.get(h.id) ?? 0;
                  const tlk = h.para_birimi === 'USD' ? tlKarsiligi(b, 'USD', kur) : null;
                  const doluluk = h.tur === 'kart' && h.limit_tutar ? Math.min(100, Math.max(0, (b / Math.round(h.limit_tutar * 100)) * 100)) : null;
                  return (
                    <a key={h.id} class="hesap-satir" href={`#/para/hesap/${h.id}`}>
                      <span class="hs-sol">
                        <span class="hs-ad">{h.ad}</span>
                        {h.tur === 'kart' && <span class="kucuk-not">Borç{h.limit_tutar ? ` · limit ${paraBicim(Math.round(h.limit_tutar * 100))}` : ''}</span>}
                        {doluluk !== null && <span class="cubuk ince" role="img" aria-label={`Limitin %${Math.round(doluluk)} dolu`}><span style={{ width: `${doluluk.toFixed(1)}%` }} /></span>}
                      </span>
                      <span class="hs-sag">
                        <span class={`hs-tutar${h.para_birimi === 'USD' && h.tur === 'birikim' ? ' usd' : ''}${h.tur === 'kart' ? ' borc' : ''}`}>{paraBicim(b, h.para_birimi)}</span>
                        {h.para_birimi === 'USD' && tlk !== null && <span class="kucuk-not">≈ {paraBicim(tlk)}</span>}
                      </span>
                      <Ok />
                    </a>
                  );
                })}
              </section>
            );
          })}
          {d.veri.hesaplar.some((h) => h.arsiv) && (
            <p class="kucuk-not">Arşivlenmiş {d.veri.hesaplar.filter((h) => h.arsiv).length} hesap gizli (işlemleri duruyor).</p>
          )}
        </>
      )}
    </div>
  );
}
