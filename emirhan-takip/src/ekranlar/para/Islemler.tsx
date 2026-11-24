import { useEffect, useState } from 'preact/hooks';
import * as api from '../../lib/para/api';
import { kurBicim, kurus, paraBicim, transferGiren, tutarAyristir, type Hesap, type Islem, type IslemTuru } from '../../lib/para/hesap';
import {
  aktifHesaplar, bugunPara, kategoriler, kurDegeri, taslakOku, taslakYaz, useParaDepo, yazmaHatasi, yazVeYenile, yeniId,
} from '../../lib/para/store';
import { AYLAR_KISA, GUNLER, ayEkle, ayMetni, gunEkle, parcala } from '../../lib/tarih';
import { Sag, Sol } from '../../bilesenler/Ikonlar';
import { Ara, Cip, CizgiSekme, HataKutu, Suzgec, birimSimge, islemGorunumu } from './ortak';

interface Form {
  tur: IslemTuru; tutar: string; giren: string; girenElle: boolean;
  kategori: string; hesap: string; kaynak: string; hedef: string; tarih: string; not: string;
}

function varsayilanForm(hesaplar: Hesap[], bugun: string, tur: IslemTuru = 'gider'): Form {
  const sira = ['nakit', 'banka', 'kart', 'birikim'];
  const s = [...hesaplar].sort((a, b) => sira.indexOf(a.tur) - sira.indexOf(b.tur));
  const k = kategoriler();
  return {
    tur, tutar: '', giren: '', girenElle: false,
    kategori: tur === 'gelir' ? k.gelir[0] ?? 'Diğer gelir' : k.gider[0] ?? 'Diğer',
    hesap: s[0]?.id ?? '', kaynak: s[0]?.id ?? '', hedef: s.find((x) => x.id !== s[0]?.id)?.id ?? '',
    tarih: bugun, not: '',
  };
}

let disKategoriFiltresi: string | null = null;
/** Özet ekranından kategoriye tıklanınca İşlemler bu kategoriyle açılır. */
export const kategoriyleAc = (k: string) => { disKategoriFiltresi = k; location.hash = '#/para/islemler'; };

export function Islemler({ baslangic }: { baslangic?: string }) {
  const d = useParaDepo();
  const hesaplar = aktifHesaplar();
  const tumHesaplar = d.veri.hesaplar;
  const bugun = bugunPara();
  const kur = kurDegeri();
  const [f, setF] = useState<Form>(() => {
    const t = taslakOku<Form>('hizli');
    if (baslangic === 'transfer') return { ...(t ?? varsayilanForm(hesaplar, bugun)), tur: 'transfer' };
    return t ?? varsayilanForm(hesaplar, bugun);
  });
  const [duzenlenen, setDuzenlenen] = useState<Islem | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [kayit, setKayit] = useState(false);
  const [ay, setAy] = useState(bugun.slice(0, 7));
  const [aramaAcik, setAramaAcik] = useState(false);
  const [arama, setArama] = useState('');
  const [filtreAcik, setFiltreAcik] = useState(false);
  const [fTur, setFTur] = useState<'hepsi' | IslemTuru>('hepsi');
  const [fHesap, setFHesap] = useState('hepsi');
  const [fKat, setFKat] = useState<string | null>(() => { const k = disKategoriFiltresi; disKategoriFiltresi = null; return k; });
  const [secili, setSecili] = useState<string | null>(null);
  const [silSor, setSilSor] = useState(false);

  // Hesap listesi gelince boş seçimleri doldur
  useEffect(() => {
    if (!f.hesap && hesaplar.length) setF((x) => ({ ...varsayilanForm(hesaplar, bugun, x.tur), tutar: x.tutar }));
  }, [hesaplar.length]);

  const guncelle = (p: Partial<Form>) => {
    const y = { ...f, ...p };
    setF(y);
    if (!duzenlenen) taslakYaz('hizli', y);
    setHata(null);
  };
  const bul = (id: string | null) => tumHesaplar.find((h) => h.id === id);
  const kaynakH = bul(f.kaynak);
  const hedefH = bul(f.hedef);
  const ikiBirim = f.tur === 'transfer' && !!kaynakH && !!hedefH && kaynakH.para_birimi !== hedefH.para_birimi;
  const tutarK = tutarAyristir(f.tutar);
  const otoGiren = ikiBirim && tutarK && !Number.isNaN(tutarK) ? transferGiren(tutarK, kaynakH!.para_birimi, hedefH!.para_birimi, kur) : null;
  const girenGosterilen = f.girenElle ? f.giren : otoGiren !== null ? (otoGiren / 100).toFixed(2).replace('.', ',') : '';
  const katListesi = f.tur === 'gelir' ? kategoriler().gelir : kategoriler().gider;
  const secHesap = bul(f.hesap);

  const kaydet = async () => {
    if (tutarK === null) return setHata('Tutar yaz.');
    if (Number.isNaN(tutarK) || tutarK <= 0) return setHata('Geçerli bir tutar yaz (ör. 150 veya 1.250,50).');
    let satir: Partial<Islem>;
    if (f.tur === 'transfer') {
      if (!kaynakH || !hedefH) return setHata('Nereden ve nereye hesaplarını seç.');
      if (kaynakH.id === hedefH.id) return setHata('Aynı hesaba transfer olmaz.');
      let giren = tutarK;
      if (ikiBirim) {
        const g = tutarAyristir(girenGosterilen);
        if (g === null || Number.isNaN(g) || g <= 0) return setHata(kur ? 'Giren tutarı yaz.' : 'Kur alınamadı; giren tutarı elle yaz.');
        giren = g;
      }
      satir = { tur: 'transfer', kategori: null, hesap_id: kaynakH.id, hedef_hesap_id: hedefH.id, tutar: tutarK / 100, giren_tutar: giren / 100 };
    } else {
      if (!secHesap) return setHata('Hesap seç.');
      if (!f.kategori) return setHata('Kategori seç.');
      satir = { tur: f.tur, kategori: f.kategori, hesap_id: secHesap.id, hedef_hesap_id: null, tutar: tutarK / 100, giren_tutar: null };
    }
    satir = { ...satir, tarih: f.tarih, nota: f.not.trim() || null };
    setKayit(true);
    try {
      if (duzenlenen) await yazVeYenile(() => api.guncelle('para_islem', 'id', duzenlenen.id, satir, duzenlenen.updated_at));
      else await yazVeYenile(() => api.ekle('para_islem', { id: yeniId(), ...satir }));
      const yeni = { ...f, tutar: '', giren: '', girenElle: false, not: '' };
      setF(duzenlenen ? varsayilanForm(hesaplar, bugun, f.tur) : yeni);
      if (!duzenlenen) taslakYaz('hizli', yeni);
      setDuzenlenen(null);
      setAy(f.tarih.slice(0, 7));
    } catch (e) {
      setHata(yazmaHatasi(e));
    } finally {
      setKayit(false);
    }
  };

  const duzenle = (i: Islem) => {
    setDuzenlenen(i);
    setSecili(null);
    setF({
      tur: i.tur, tutar: String(i.tutar).replace('.', ','), giren: i.giren_tutar ? String(i.giren_tutar).replace('.', ',') : '',
      girenElle: i.tur === 'transfer', kategori: i.kategori ?? '', hesap: i.hesap_id, kaynak: i.hesap_id,
      hedef: i.hedef_hesap_id ?? '', tarih: i.tarih, not: i.nota ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const vazgec = () => { setDuzenlenen(null); setF(taslakOku<Form>('hizli') ?? varsayilanForm(hesaplar, bugun)); setHata(null); };

  const sil = async (i: Islem) => {
    try {
      await yazVeYenile(() => api.sil('para_islem', 'id', i.id, i.updated_at));
      setSecili(null);
      setSilSor(false);
    } catch (e) {
      setHata(yazmaHatasi(e));
    }
  };

  // ---- Liste ----
  const s = arama.trim().toLocaleLowerCase('tr-TR');
  const liste = d.veri.islemler.filter((i) => {
    if (!i.tarih.startsWith(ay)) return false;
    if (fTur !== 'hepsi' && i.tur !== fTur) return false;
    if (fHesap !== 'hepsi' && i.hesap_id !== fHesap && i.hedef_hesap_id !== fHesap) return false;
    if (fKat && i.kategori !== fKat) return false;
    if (s) {
      const g = islemGorunumu(i, bul);
      if (!`${g.kat} ${g.hesap} ${i.nota ?? ''}`.toLocaleLowerCase('tr-TR').includes(s)) return false;
    }
    return true;
  });
  const gunler = [...new Set(liste.map((i) => i.tarih))].sort().reverse();

  if (!hesaplar.length) {
    return (
      <div class="bos-durum">
        <span>İşlem eklemek için önce bir hesap ekle.</span>
        <a class="dugme ana" href="#/para/hesaplar/yeni">İlk hesabını ekle</a>
      </div>
    );
  }

  const tarihMetni = () => {
    const { m, g } = parcala(f.tarih);
    return `${f.tarih === bugun ? 'Bugün, ' : f.tarih === gunEkle(bugun, -1) ? 'Dün, ' : ''}${g} ${AYLAR_KISA[m - 1]}`;
  };

  return (
    <div class="yigin-24">
      <section class="hizli" aria-label={duzenlenen ? 'İşlemi düzenle' : 'Hızlı ekleme'}>
        {duzenlenen && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span class="etiket-k">İşlemi düzenliyorsun</span>
            <button type="button" class="metin-dugme" onClick={vazgec}>Vazgeç</button>
          </div>
        )}
        <CizgiSekme etiket="İşlem türü" deger={f.tur} secenekler={[['gider', 'Gider'], ['gelir', 'Gelir'], ['transfer', 'Transfer']]}
          onSec={(t) => guncelle({ tur: t, kategori: t === 'gelir' ? kategoriler().gelir[0] : t === 'gider' ? kategoriler().gider[0] : f.kategori, girenElle: false })} />

        {f.tur === 'transfer' && (
          <div class="yigin" style={{ gap: '8px' }}>
            <div class="etiket-k" id="tr-nereden">Nereden</div>
            <div class="cipler" role="group" aria-labelledby="tr-nereden">
              {hesaplar.map((h) => <Cip key={h.id} secili={h.id === f.kaynak} onClick={() => guncelle({ kaynak: h.id, hedef: h.id === f.hedef ? f.kaynak : f.hedef, girenElle: false })}>{h.ad}</Cip>)}
            </div>
            <div class="etiket-k" id="tr-nereye">Nereye</div>
            <div class="cipler" role="group" aria-labelledby="tr-nereye">
              {hesaplar.map((h) => <Cip key={h.id} secili={h.id === f.hedef} onClick={() => guncelle({ hedef: h.id, kaynak: h.id === f.kaynak ? f.hedef : f.kaynak, girenElle: false })}>{h.ad}</Cip>)}
            </div>
          </div>
        )}

        <div class="tutar-satir">
          <label>{f.tur === 'transfer' ? (ikiBirim ? `Çıkan ${birimSimge(kaynakH!.para_birimi)}` : 'Tutar') : `Tutar ${birimSimge(secHesap?.para_birimi ?? 'TRY')}`}
            <input class="alan tutar-alan" inputMode="decimal" placeholder="0,00" value={f.tutar}
              onInput={(e) => guncelle({ tutar: (e.target as HTMLInputElement).value })}
              onKeyDown={(e) => { if (e.key === 'Enter') void kaydet(); }} />
          </label>
          {ikiBirim && (
            <label>Giren {birimSimge(hedefH!.para_birimi)}
              <input class="alan tutar-alan giren" inputMode="decimal" placeholder="0,00" value={girenGosterilen}
                onInput={(e) => guncelle({ giren: (e.target as HTMLInputElement).value, girenElle: true })} />
            </label>
          )}
          <button type="button" class="dugme ana" disabled={kayit} onClick={kaydet}>{kayit ? '…' : 'Kaydet'}</button>
        </div>
        {ikiBirim && (
          <div class="kucuk-not">{kur ? `Kur 1 $ = ${kurBicim(kur)} ₺ · otomatik dolduruldu, değiştirebilirsin` : 'Kur alınamadı; giren tutarı elle yaz.'}</div>
        )}

        {f.tur !== 'transfer' && (f.tutar || duzenlenen) && (
          <div class="yigin" style={{ gap: '8px' }}>
            <div class="etiket-k" id="hz-kat">Kategori</div>
            <div class="cipler" role="group" aria-labelledby="hz-kat">
              {katListesi.map((c) => <Cip key={c} secili={f.kategori === c} onClick={() => guncelle({ kategori: c })}>{c}</Cip>)}
            </div>
            <div class="etiket-k" id="hz-hesap">Hesap</div>
            <div class="cipler" role="group" aria-labelledby="hz-hesap">
              {hesaplar.map((h) => <Cip key={h.id} secili={f.hesap === h.id} onClick={() => guncelle({ hesap: h.id })}>{h.ad}{h.para_birimi === 'USD' ? ' ($)' : ''}</Cip>)}
            </div>
          </div>
        )}

        {(f.tutar || duzenlenen) && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div class="tarih-adim">
              <button type="button" aria-label="Önceki gün" onClick={() => guncelle({ tarih: gunEkle(f.tarih, -1) })}>‹</button>
              <span>{tarihMetni()}</span>
              <button type="button" aria-label="Sonraki gün" disabled={f.tarih >= bugun} onClick={() => guncelle({ tarih: gunEkle(f.tarih, 1) })}>›</button>
            </div>
            <input class="alan" style={{ flex: 1, minWidth: 0 }} aria-label="Not" placeholder="Not (isteğe bağlı)" value={f.not}
              onInput={(e) => guncelle({ not: (e.target as HTMLInputElement).value })} />
          </div>
        )}
        <HataKutu mesaj={hata} />
      </section>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <button type="button" class="ikon-dugme" aria-label="Önceki ay" onClick={() => setAy(ayEkle(ay, -1))}><Sol /></button>
          <h2 style={{ fontSize: '16px', fontWeight: 600 }}>{ayMetni(ay)}</h2>
          <button type="button" class="ikon-dugme" aria-label="Sonraki ay" disabled={ay >= bugun.slice(0, 7)} onClick={() => setAy(ayEkle(ay, 1))}><Sag /></button>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button type="button" class="ikon-cerceve" aria-label="Ara" aria-pressed={aramaAcik} onClick={() => setAramaAcik(!aramaAcik)}><Ara /></button>
          <button type="button" class="ikon-cerceve" aria-label="Filtre" aria-pressed={filtreAcik || fTur !== 'hepsi' || fHesap !== 'hepsi'} onClick={() => setFiltreAcik(!filtreAcik)}><Suzgec /></button>
        </div>
      </div>

      {aramaAcik && (
        <input class="alan" aria-label="İşlem ara" placeholder="Kategori, hesap veya not ara" value={arama} onInput={(e) => setArama((e.target as HTMLInputElement).value)} />
      )}
      {filtreAcik && (
        <div class="yigin" style={{ gap: '8px' }}>
          <div class="cipler" role="group" aria-label="Tür filtresi">
            {([['hepsi', 'Tümü'], ['gider', 'Gider'], ['gelir', 'Gelir'], ['transfer', 'Transfer']] as const).map(([k, l]) => <Cip key={k} secili={fTur === k} onClick={() => setFTur(k)}>{l}</Cip>)}
          </div>
          <div class="cipler" role="group" aria-label="Hesap filtresi">
            <Cip secili={fHesap === 'hepsi'} onClick={() => setFHesap('hepsi')}>Tüm hesaplar</Cip>
            {tumHesaplar.map((h) => <Cip key={h.id} secili={fHesap === h.id} onClick={() => setFHesap(h.id)}>{h.ad}</Cip>)}
          </div>
        </div>
      )}
      {fKat && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '14px', color: 'var(--ikincil)' }}>
          <span>Kategori: <span style={{ color: 'var(--metin)' }}>{fKat}</span></span>
          <button type="button" class="baglanti" onClick={() => setFKat(null)}>Temizle</button>
        </div>
      )}

      {gunler.length === 0 && (
        <div class="bos-durum">{d.veri.islemler.length ? 'Bu ay için eşleşen işlem yok.' : 'Henüz işlem yok. Yukarıdan ilkini ekle.'}</div>
      )}

      {gunler.map((t) => {
        const satirlar = liste.filter((i) => i.tarih === t);
        const tl = (i: Islem) => (bul(i.hesap_id)?.para_birimi === 'USD' ? 0 : kurus(i.tutar));
        const gider = satirlar.filter((i) => i.tur === 'gider').reduce((a, i) => a + tl(i), 0);
        const gelir = satirlar.filter((i) => i.tur === 'gelir').reduce((a, i) => a + tl(i), 0);
        const { m, g, y } = parcala(t);
        return (
          <section key={t}>
            <div class="gun-grup-bas">
              <span class="gn">{g}</span>
              <span class="lb">{ayMetni(`${y}-${String(m).padStart(2, '0')}`)} · {GUNLER[new Date(t + 'T12:00:00').getDay()]}</span>
              <span class={`tp${!gider && gelir ? ' gelir' : ''}`}>{gider ? paraBicim(-gider) : gelir ? `+${paraBicim(gelir)}` : ''}</span>
            </div>
            {satirlar.map((i) => {
              const gr = islemGorunumu(i, bul);
              const acik = secili === i.id;
              return (
                <div key={i.id} style={{ borderTop: '1px solid var(--cizgi)' }}>
                  <button type="button" class="islem-dugme" aria-expanded={acik} onClick={() => { setSecili(acik ? null : i.id); setSilSor(false); }}>
                    <span class="is-orta">
                      <span class="is-kat">{gr.kat}</span>
                      <span class="is-hesap">{gr.hesap}</span>
                      {i.nota && <span class="is-not">{i.nota}</span>}
                    </span>
                    {gr.cip && <span class="is-cip">{gr.cip}</span>}
                    <span class={`is-tutar${gr.gelir ? ' gelir' : ''}`}>{gr.tutar}</span>
                  </button>
                  {acik && (
                    <div class="satir-eylem">
                      {silSor ? (
                        <>
                          <span class="soru">Silinsin mi?{i.abonelik_id ? ' Aboneliğin bu ayki "Ödendi" işareti de kalkar.' : ''}</span>
                          <button type="button" class="metin-dugme" onClick={() => setSilSor(false)}>Vazgeç</button>
                          <button type="button" class="dugme beyaz" onClick={() => sil(i)}>Evet, sil</button>
                        </>
                      ) : (
                        <>
                          <button type="button" class="dugme" onClick={() => duzenle(i)}>Düzenle</button>
                          <button type="button" class="dugme" onClick={() => setSilSor(true)}>Sil</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
