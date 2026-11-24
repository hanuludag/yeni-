import { useState } from 'preact/hooks';
import * as api from '../../lib/para/api';
import {
  abonelikDurumu, butceDurumlari, hedefDurumu, kurus, paraBicim, toplamlar, tutarAyristir,
  type Abonelik, type Birim, type Hedef,
} from '../../lib/para/hesap';
import {
  aktifHesaplar, bugunPara, kategoriler, kurDegeri, paraBakiyeler, useParaDepo, yazmaHatasi, yazVeYenile, yeniId,
} from '../../lib/para/store';
import { AYLAR, parcala } from '../../lib/tarih';
import { Carpi, Cip, HataKutu } from './ortak';

export function Plan() {
  const d = useParaDepo();
  const bugun = bugunPara();
  const ay = bugun.slice(0, 7);
  const hesaplar = aktifHesaplar();
  const bak = paraBakiyeler();
  const kur = kurDegeri();
  const T = toplamlar(hesaplar, bak, d.veri.abonelikler, d.veri.odemeler, bugun, kur);

  return (
    <div class="yigin-24">
      <section aria-labelledby="sp-h" class="kutu yigin" style={{ padding: '20px 16px' }}>
        <h2 id="sp-h" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ikincil)' }}>Harcayabileceğim para</h2>
        <div class="buyuk-tutar vurgu">{paraBicim(T.harcayabilecegim)}</div>
        <div style={{ fontSize: '14px', color: 'var(--ikincil)' }}>
          Günlük: <span style={{ color: 'var(--metin)', fontWeight: 600 }}>{paraBicim(T.gunluk)}</span> · ayın bitmesine {T.kalanGun} gün
        </div>
        <div style={{ borderTop: '1px solid var(--cizgi)', paddingTop: '8px' }}>
          <div class="plan-satir"><span>Nakit + Banka</span><span>{paraBicim(T.nakit + T.banka)}</span></div>
          <div class="plan-satir" style={{ color: 'var(--ikincil)' }}><span>− Yaklaşan ödemeler</span><span>{paraBicim(T.yaklasan)}</span></div>
          <div class="plan-satir" style={{ color: 'var(--ikincil)' }}><span>− Kredi kartı borcu</span><span>{paraBicim(T.kart)}</span></div>
          <div class="plan-satir vurgu" style={{ fontWeight: 700 }}><span>= Harcayabileceğim</span><span>{paraBicim(T.harcayabilecegim)}</span></div>
        </div>
        <div class="kucuk-not">Birikim hariç (dolar birikimi dahil değil). Kart borcunun tamamı bu ay ödenecek sayıldı.</div>
      </section>
      <Butceler ay={ay} />
      <Abonelikler bugun={bugun} />
      <Hedefler />
      <KategoriYonetimi />
    </div>
  );
}

function Butceler({ ay }: { ay: string }) {
  const d = useParaDepo();
  const [form, setForm] = useState(false);
  const kat = kategoriler().gider.filter((c) => !d.veri.butceler.some((b) => b.kategori === c));
  const [secKat, setSecKat] = useState('');
  const [limit, setLimit] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [silinecek, setSilinecek] = useState<string | null>(null);
  const durumlar = butceDurumlari(d.veri.butceler, d.veri.islemler, d.veri.hesaplar, ay, kurDegeri());
  const asan = durumlar.filter((b) => b.asildi).length;
  const yakin = durumlar.filter((b) => b.yakin).length;
  const ozetMetni = [asan && `${asan} kategori aşıldı`, yakin && `${yakin} kategori limite yakın`].filter(Boolean).join(' · ') || (durumlar.length ? 'Tüm bütçeler yolunda' : '');
  const kategori = secKat && kat.includes(secKat) ? secKat : kat[0] ?? '';

  const ekle = async () => {
    const k = tutarAyristir(limit);
    if (!kategori) return setHata('Bütçesi olmayan kategori kalmadı.');
    if (k === null || Number.isNaN(k) || k <= 0) return setHata('Aylık limiti yaz (ör. 500).');
    try {
      await yazVeYenile(() => api.butceYaz({ kategori, limit_tutar: k / 100 }));
      setForm(false); setLimit(''); setHata(null);
    } catch (e) { setHata(yazmaHatasi(e)); }
  };
  const sil = async (k: string) => {
    try { await yazVeYenile(() => api.sil('para_butce', 'kategori', k)); setSilinecek(null); } catch (e) { setHata(yazmaHatasi(e)); }
  };

  return (
    <section aria-labelledby="bud-h" class="kutu" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 id="bud-h" style={{ fontSize: '16px', fontWeight: 600 }}>Kategori bütçeleri</h2>
        <button type="button" class="baglanti" aria-expanded={form} onClick={() => setForm(!form)}>+ Bütçe</button>
      </div>
      {ozetMetni && <div class="etiket-k" style={{ paddingBottom: '8px' }}>{ozetMetni}</div>}
      {form && (
        <div class="yigin" style={{ gap: '8px', padding: '12px 0', borderTop: '1px solid var(--cizgi)' }}>
          <div class="cipler" role="group" aria-label="Kategori">
            {kat.map((c) => <Cip key={c} secili={kategori === c} onClick={() => setSecKat(c)}>{c}</Cip>)}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input class="alan" style={{ flex: 1, minWidth: 0 }} inputMode="decimal" aria-label="Aylık limit" placeholder="Aylık limit ₺" value={limit} onInput={(e) => setLimit((e.target as HTMLInputElement).value)} />
            <button type="button" class="dugme ana" onClick={ekle}>Ekle</button>
          </div>
        </div>
      )}
      <HataKutu mesaj={hata} />
      {durumlar.map((b) => (
        <div class="butce-satir" key={b.kategori}>
          <div class="ust-satir">
            <span style={{ display: 'flex', alignItems: 'center' }}>
              {b.kategori}
              {b.asildi && <span class="asildi-rozet">Aşıldı</span>}
              {b.yakin && <span class="yakin-rozet">%{Math.round(b.oran * 100)}</span>}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px' }}>
              <span><span style={{ fontWeight: 600 }}>{paraBicim(b.harcanan)}</span> <span class="etiket-k">/ {paraBicim(b.limit)}</span></span>
              <button type="button" class="ikon-dugme" aria-label={`${b.kategori} bütçesini sil`} onClick={() => setSilinecek(b.kategori)}><Carpi /></button>
            </span>
          </div>
          <span class="cubuk" role="img" aria-label={`Limitin %${Math.round(b.oran * 100)}'i kullanıldı`}>
            <span style={{ width: `${Math.min(100, b.oran * 100).toFixed(1)}%`, background: b.asildi ? 'var(--kirmizi)' : b.yakin ? '#e5e5e5' : 'var(--vurgu)' }} />
          </span>
          {silinecek === b.kategori && (
            <div class="satir-eylem" style={{ paddingBottom: 0 }}>
              <span class="soru">Bütçe silinsin mi?</span>
              <button type="button" class="metin-dugme" onClick={() => setSilinecek(null)}>Vazgeç</button>
              <button type="button" class="dugme beyaz" onClick={() => sil(b.kategori)}>Evet, sil</button>
            </div>
          )}
        </div>
      ))}
      {durumlar.length === 0 && !form && <div style={{ padding: '12px 0', fontSize: '14px', color: 'var(--ikincil)', borderTop: '1px solid var(--cizgi)' }}>Henüz bütçe yok.</div>}
    </section>
  );
}

function Abonelikler({ bugun }: { bugun: string }) {
  const d = useParaDepo();
  const hesaplar = aktifHesaplar();
  const ay = bugun.slice(0, 7);
  const [form, setForm] = useState(false);
  const [ad, setAd] = useState('');
  const [tutar, setTutar] = useState('');
  const [gun, setGun] = useState('');
  const [hesap, setHesap] = useState('');
  const [kat, setKat] = useState('Abonelik');
  const [hata, setHata] = useState<string | null>(null);
  const [isleniyor, setIsleniyor] = useState<string | null>(null);
  const [silinecek, setSilinecek] = useState<string | null>(null);
  const secHesap = hesaplar.find((h) => h.id === hesap) ?? hesaplar.find((h) => h.tur === 'banka') ?? hesaplar[0];
  const liste = d.veri.abonelikler.filter((a) => a.aktif);
  const toplam = liste.reduce((t, a) => t + (a.para_birimi === 'TRY' ? kurus(a.tutar) : 0), 0);

  const ekle = async () => {
    const k = tutarAyristir(tutar);
    const g = Number(gun);
    if (!ad.trim()) return setHata('Abonelik adını yaz.');
    if (k === null || Number.isNaN(k) || k <= 0) return setHata('Tutarı yaz.');
    if (!(Number.isInteger(g) && g >= 1 && g <= 31)) return setHata('Gün 1 ile 31 arası olmalı.');
    if (!secHesap) return setHata('Önce bir hesap ekle.');
    try {
      await yazVeYenile(() => api.ekle<Abonelik>('para_abonelik', { id: yeniId(), ad: ad.trim(), tutar: k / 100, gun: g, hesap_id: secHesap.id, para_birimi: secHesap.para_birimi, kategori: kat }));
      setForm(false); setAd(''); setTutar(''); setGun(''); setHata(null);
    } catch (e) { setHata(yazmaHatasi(e)); }
  };
  const degistir = async (a: Abonelik, odendi: boolean) => {
    setIsleniyor(a.id); setHata(null);
    try {
      if (odendi) await yazVeYenile(() => api.abonelikGeriAl(a.id, ay));
      else await yazVeYenile(() => api.abonelikOde(a.id, ay, yeniId(), bugun));
    } catch (e) { setHata(yazmaHatasi(e)); } finally { setIsleniyor(null); }
  };
  const sil = async (a: Abonelik) => {
    try { await yazVeYenile(() => api.sil('para_abonelik', 'id', a.id, a.updated_at)); setSilinecek(null); } catch (e) { setHata(yazmaHatasi(e)); }
  };

  return (
    <section aria-labelledby="sub-h" class="kutu" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <h2 id="sub-h" style={{ fontSize: '16px', fontWeight: 600 }}>Abonelikler ve yaklaşan ödemeler</h2>
        <button type="button" class="baglanti" style={{ flex: 'none' }} aria-expanded={form} onClick={() => setForm(!form)}>+ Ekle</button>
      </div>
      <div class="etiket-k" style={{ paddingBottom: '8px' }}>Aylık toplam abonelik: <span style={{ color: 'var(--metin)', fontWeight: 600 }}>{paraBicim(toplam)}</span></div>
      {form && (
        <div class="yigin" style={{ gap: '8px', padding: '12px 0', borderTop: '1px solid var(--cizgi)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr) minmax(0,1fr)', gap: '8px' }}>
            <input class="alan" aria-label="Abonelik adı" placeholder="Ad" value={ad} onInput={(e) => setAd((e.target as HTMLInputElement).value)} />
            <input class="alan" inputMode="decimal" aria-label="Tutar" placeholder={secHesap?.para_birimi === 'USD' ? '$' : '₺'} value={tutar} onInput={(e) => setTutar((e.target as HTMLInputElement).value)} />
            <input class="alan" inputMode="numeric" aria-label="Her ayın kaçı" placeholder="Gün" value={gun} onInput={(e) => setGun((e.target as HTMLInputElement).value)} />
          </div>
          <div class="etiket-k">Hesap</div>
          <div class="cipler" role="group" aria-label="Hesap">
            {hesaplar.map((h) => <Cip key={h.id} secili={secHesap?.id === h.id} onClick={() => setHesap(h.id)}>{h.ad}</Cip>)}
          </div>
          <div class="etiket-k">Kategori</div>
          <div class="cipler" role="group" aria-label="Kategori">
            {kategoriler().gider.map((c) => <Cip key={c} secili={kat === c} onClick={() => setKat(c)}>{c}</Cip>)}
          </div>
          <div class="sag-dugmeler"><button type="button" class="dugme ana" onClick={ekle}>Ekle</button></div>
        </div>
      )}
      <HataKutu mesaj={hata} />
      {liste.map((a) => {
        const s = abonelikDurumu(a, d.veri.odemeler, bugun);
        const h = d.veri.hesaplar.find((x) => x.id === a.hesap_id);
        const { m, g } = parcala(s.siradaki);
        return (
          <div key={a.id}>
            <div class={`abonelik-satir${s.yakin ? ' yakin' : ''}`}>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '15px' }}>{a.ad}</span>
                <span class="kucuk-not">Her ayın {a.gun}. günü · {h?.ad ?? '–'} · sıradaki {g} {AYLAR[m - 1]}</span>
              </span>
              <span class="ab-sag">
                <span style={{ fontSize: '15px', fontWeight: 600 }}>{paraBicim(kurus(a.tutar), a.para_birimi)}</span>
                <span class="kucuk-not" style={{ color: s.yakin ? 'var(--vurgu)' : undefined }}>
                  {s.odendi ? 'Ödendi' : s.kalanGun === 0 ? 'Bugün' : s.kalanGun !== null ? `${s.kalanGun} gün kaldı` : 'Bu ay günü geçti'}
                </span>
              </span>
              <button type="button" class="ab-dugme" aria-pressed={s.odendi} disabled={isleniyor === a.id}
                aria-label={`${a.ad} ${s.odendi ? 'ödemesini geri al' : 'ödendi olarak işaretle'}`} onClick={() => degistir(a, s.odendi)}>
                {s.odendi ? 'Geri al' : 'Ödendi'}
              </button>
              <button type="button" class="ikon-dugme" aria-label={`${a.ad} aboneliğini sil`} onClick={() => setSilinecek(a.id)}><Carpi /></button>
            </div>
            {silinecek === a.id && (
              <div class="satir-eylem">
                <span class="soru">Abonelik silinsin mi? Geçmiş işlemleri durur.</span>
                <button type="button" class="metin-dugme" onClick={() => setSilinecek(null)}>Vazgeç</button>
                <button type="button" class="dugme beyaz" onClick={() => sil(a)}>Evet, sil</button>
              </div>
            )}
          </div>
        );
      })}
      {liste.length === 0 && !form && <div style={{ padding: '12px 0', fontSize: '14px', color: 'var(--ikincil)', borderTop: '1px solid var(--cizgi)' }}>Henüz abonelik yok.</div>}
    </section>
  );
}

function Hedefler() {
  const d = useParaDepo();
  const bak = paraBakiyeler();
  const birikimler = aktifHesaplar().filter((h) => h.tur === 'birikim');
  const [form, setForm] = useState(false);
  const [ad, setAd] = useState('');
  const [hedef, setHedef] = useState('');
  const [birim, setBirim] = useState<Birim>('TRY');
  const [bagli, setBagli] = useState<string>('elle');
  const [mevcut, setMevcut] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [duzen, setDuzen] = useState<{ id: string; deger: string } | null>(null);
  const [silinecek, setSilinecek] = useState<string | null>(null);

  const ekle = async () => {
    const k = tutarAyristir(hedef);
    const m = tutarAyristir(mevcut);
    if (!ad.trim()) return setHata('Hedefin adını yaz.');
    if (k === null || Number.isNaN(k) || k <= 0) return setHata('Hedef tutarı yaz.');
    if (bagli === 'elle' && Number.isNaN(m as number)) return setHata('Mevcut tutar geçerli değil.');
    const h = birikimler.find((x) => x.id === bagli);
    try {
      await yazVeYenile(() => api.ekle<Hedef>('para_hedef', {
        id: yeniId(), ad: ad.trim(), hedef_tutar: k / 100, para_birimi: h ? h.para_birimi : birim,
        bagli_hesap_id: h ? h.id : null, mevcut_tutar: h ? null : (m ?? 0) / 100,
      }));
      setForm(false); setAd(''); setHedef(''); setMevcut(''); setBagli('elle'); setHata(null);
    } catch (e) { setHata(yazmaHatasi(e)); }
  };
  const mevcutKaydet = async (h: Hedef) => {
    const m = tutarAyristir(duzen?.deger ?? '');
    if (m === null || Number.isNaN(m)) return setHata('Mevcut tutar geçerli değil.');
    try { await yazVeYenile(() => api.guncelle('para_hedef', 'id', h.id, { mevcut_tutar: m / 100 }, h.updated_at)); setDuzen(null); setHata(null); } catch (e) { setHata(yazmaHatasi(e)); }
  };
  const sil = async (h: Hedef) => {
    try { await yazVeYenile(() => api.sil('para_hedef', 'id', h.id, h.updated_at)); setSilinecek(null); } catch (e) { setHata(yazmaHatasi(e)); }
  };

  return (
    <section aria-labelledby="goal-h" class="kutu" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h2 id="goal-h" style={{ fontSize: '16px', fontWeight: 600 }}>Birikim hedefi</h2>
        <button type="button" class="baglanti" aria-expanded={form} onClick={() => setForm(!form)}>+ Hedef</button>
      </div>
      {form && (
        <div class="yigin" style={{ gap: '8px', padding: '12px 0', borderTop: '1px solid var(--cizgi)' }}>
          <div class="iki-sutun">
            <input class="alan" aria-label="Hedef adı" placeholder="örn. Laptop" value={ad} onInput={(e) => setAd((e.target as HTMLInputElement).value)} />
            <input class="alan" inputMode="decimal" aria-label="Hedef tutar" placeholder="Hedef tutar" value={hedef} onInput={(e) => setHedef((e.target as HTMLInputElement).value)} />
          </div>
          <div class="etiket-k">Tutar nereden gelsin?</div>
          <div class="cipler sar" role="group" aria-label="Bağlı hesap">
            <Cip secili={bagli === 'elle'} onClick={() => setBagli('elle')}>Elle girerim</Cip>
            {birikimler.map((h) => <Cip key={h.id} secili={bagli === h.id} onClick={() => setBagli(h.id)}>{h.ad} hesabı</Cip>)}
          </div>
          {bagli === 'elle' && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <div class="cipler" role="group" aria-label="Para birimi">
                <Cip secili={birim === 'TRY'} etiket="Türk lirası" onClick={() => setBirim('TRY')}>₺</Cip>
                <Cip secili={birim === 'USD'} etiket="Dolar" onClick={() => setBirim('USD')}>$</Cip>
              </div>
              <input class="alan" style={{ flex: 1, minWidth: 0 }} inputMode="decimal" aria-label="Mevcut tutar" placeholder="Şu an biriken" value={mevcut} onInput={(e) => setMevcut((e.target as HTMLInputElement).value)} />
            </div>
          )}
          <div class="sag-dugmeler"><button type="button" class="dugme ana" onClick={ekle}>Ekle</button></div>
        </div>
      )}
      <HataKutu mesaj={hata} />
      {d.veri.hedefler.map((h) => {
        const s = hedefDurumu(h, bak);
        const bh = d.veri.hesaplar.find((x) => x.id === h.bagli_hesap_id);
        return (
          <div class="hedef-satir" key={h.id}>
            <div class="ust-satir">
              <span>{h.ad}</span>
              <span style={{ fontSize: '14px' }}><span style={{ fontWeight: 600 }}>{paraBicim(s.mevcut, h.para_birimi)}</span> <span class="etiket-k">/ {paraBicim(s.hedef, h.para_birimi)}</span></span>
            </div>
            <span class="cubuk" role="img" aria-label={`Hedefin %${s.yuzde}'i`}><span style={{ width: `${Math.min(100, s.oran * 100).toFixed(1)}%` }} /></span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }} class="kucuk-not">
              <span>{bh ? `${bh.ad} hesabına bağlı` : 'Elle güncellenir'}</span>
              <span>kalan {paraBicim(s.kalan, h.para_birimi)} · %{s.yuzde}</span>
            </div>
            <div class="sag-dugmeler" style={{ justifyContent: 'flex-start' }}>
              {!bh && <button type="button" class="metin-dugme" style={{ paddingLeft: 0 }} onClick={() => setDuzen({ id: h.id, deger: String(h.mevcut_tutar ?? 0).replace('.', ',') })}>Tutarı güncelle</button>}
              <button type="button" class="metin-dugme" onClick={() => setSilinecek(h.id)}>Sil</button>
            </div>
            {duzen?.id === h.id && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input class="alan" style={{ flex: 1 }} inputMode="decimal" aria-label={`${h.ad} mevcut tutar`} value={duzen.deger} onInput={(e) => setDuzen({ id: h.id, deger: (e.target as HTMLInputElement).value })} />
                <button type="button" class="metin-dugme" onClick={() => setDuzen(null)}>Vazgeç</button>
                <button type="button" class="dugme ana" onClick={() => mevcutKaydet(h)}>Kaydet</button>
              </div>
            )}
            {silinecek === h.id && (
              <div class="satir-eylem" style={{ paddingBottom: 0 }}>
                <span class="soru">Hedef silinsin mi?</span>
                <button type="button" class="metin-dugme" onClick={() => setSilinecek(null)}>Vazgeç</button>
                <button type="button" class="dugme beyaz" onClick={() => sil(h)}>Evet, sil</button>
              </div>
            )}
          </div>
        );
      })}
      {d.veri.hedefler.length === 0 && !form && <div style={{ padding: '12px 0', fontSize: '14px', color: 'var(--ikincil)', borderTop: '1px solid var(--cizgi)' }}>Henüz hedef yok.</div>}
    </section>
  );
}

function KategoriYonetimi() {
  const d = useParaDepo();
  const [acik, setAcik] = useState(false);
  const [yeni, setYeni] = useState<{ gider: string; gelir: string }>({ gider: '', gelir: '' });
  const [hata, setHata] = useState<string | null>(null);
  const k = kategoriler();
  const kaydet = async (veri: typeof k) => {
    try {
      const mevcut = d.veri.kategoriler;
      if (mevcut) await yazVeYenile(() => api.guncelle('takip_ayar', 'anahtar', 'para_kategoriler', { veri }, mevcut.updated_at));
      else await yazVeYenile(() => api.ayarYaz('para_kategoriler', veri));
      setHata(null);
    } catch (e) { setHata(yazmaHatasi(e)); }
  };
  const ekle = (t: 'gider' | 'gelir') => {
    const ad = yeni[t].trim();
    if (!ad) return;
    if (k[t].some((x) => x.toLocaleLowerCase('tr') === ad.toLocaleLowerCase('tr'))) return setHata('Bu kategori zaten var.');
    void kaydet({ ...k, [t]: [...k[t], ad] });
    setYeni({ ...yeni, [t]: '' });
  };
  return (
    <div class="katlanir" style={{ marginTop: 0 }}>
      <button type="button" aria-expanded={acik} onClick={() => setAcik(!acik)}>
        Kategorileri düzenle
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {acik && (
        <div class="yigin" style={{ paddingBottom: '16px' }}>
          <p class="kucuk-not" style={{ margin: 0 }}>Kategoriyi silmek eski işlemleri değiştirmez.</p>
          {(['gider', 'gelir'] as const).map((t) => (
            <div key={t} class="yigin" style={{ gap: '8px' }}>
              <div class="etiket-k">{t === 'gider' ? 'Gider kategorileri' : 'Gelir kategorileri'}</div>
              <div class="cipler sar">
                {k[t].map((c) => (
                  <span key={c} class="cip" style={{ paddingRight: 0, cursor: 'default' }}>
                    {c}
                    <button type="button" class="ikon-dugme" aria-label={`${c} kategorisini sil`}
                      onClick={() => void kaydet({ ...k, [t]: k[t].filter((x) => x !== c) })}><Carpi /></button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input class="alan" style={{ flex: 1 }} aria-label={`Yeni ${t} kategorisi`} placeholder="Yeni kategori" value={yeni[t]}
                  onInput={(e) => setYeni({ ...yeni, [t]: (e.target as HTMLInputElement).value })} onKeyDown={(e) => { if (e.key === 'Enter') ekle(t); }} />
                <button type="button" class="dugme" onClick={() => ekle(t)}>Ekle</button>
              </div>
            </div>
          ))}
          <HataKutu mesaj={hata} />
        </div>
      )}
    </div>
  );
}
