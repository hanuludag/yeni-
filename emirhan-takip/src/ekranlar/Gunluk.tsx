import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import * as api from '../lib/api';
import { ApiHata } from '../lib/api';
import {
  ayarKaydet, bugun, gunSatiriYaz, kriterler, taslakOku, taslakSil, taslakTarihleri, taslakYaz, useDepo, yenile,
} from '../lib/store';
import {
  SAAT_ALANLARI, detayVar, formHatalari, formdanVeri, formlarAyni, haritaToplami, veridenForm, yeniKriterId,
  type Form, type Kriter, type Kriterler, type PuanHaritasi, type SaatAnahtari,
} from '../lib/puan';
import { gunEkle, gunFarki, goreceliEtiket, haftaGunuAdi, kisaTarih, tarihMetni } from '../lib/tarih';
import { sayiBicim } from '../lib/sayi';
import { git } from '../rota';
import { PuanSatiri } from '../bilesenler/PuanSatiri';
import { KaydetCubugu, type KayitDurumu } from '../bilesenler/KaydetCubugu';
import { BaglantiHatasi } from '../bilesenler/Durumlar';
import { Asagi, Sag, Sil, Sol } from '../bilesenler/Ikonlar';

type Kayit =
  | { tur: 'bos' }
  | { tur: 'kaydediliyor' }
  | { tur: 'kayitli' }
  | { tur: 'hata'; mesaj: string }
  | { tur: 'cakisma'; sunucu: api.GunSatiri | null };

const saat = (iso: string) =>
  new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

export function Gunluk({ tarih: istenen, ust }: { tarih?: string; ust: ComponentChildren }) {
  const d = useDepo();
  const bugunT = bugun();
  const tarih = istenen ?? bugunT;
  const satir = d.gunler[tarih];
  const taslak = taslakOku(tarih);
  const sunucuForm = veridenForm(satir?.veri);
  const form = taslak?.form ?? sunucuForm;
  const taban = taslak ? taslak.taban : satir?.updated_at ?? null;
  const kirli = !!taslak;
  const k = kriterler();

  const [kayit, setKayit] = useState<Kayit>({ tur: 'bos' });
  const [gecis, setGecis] = useState<string | null>(null);
  const [hatalar, setHatalar] = useState<Partial<Record<SaatAnahtari, string>>>({});

  // Gün değişince geçici durumları sıfırla
  useEffect(() => { setKayit({ tur: 'bos' }); setGecis(null); setHatalar({}); }, [tarih]);

  const formYaz = (f: Form) => {
    const tabanSimdi = taslak ? taslak.taban : satir?.updated_at ?? null;
    if (formlarAyni(f, sunucuForm) && tabanSimdi === (satir?.updated_at ?? null)) taslakSil(tarih);
    else taslakYaz(tarih, { form: f, taban: tabanSimdi, zaman: Date.now() });
    if (kayit.tur === 'kayitli' || kayit.tur === 'hata') setKayit({ tur: 'bos' });
  };

  const puanYaz = (alan: 'hedefler' | 'saglik', id: string, v: number | undefined) => {
    const h: PuanHaritasi = { ...form[alan] };
    if (v === undefined) delete h[id];
    else h[id] = v;
    formYaz({ ...form, [alan]: h });
  };

  const kaydet = async (zorlaTaban?: string | null): Promise<boolean> => {
    const h = formHatalari(form);
    setHatalar(h);
    if (Object.keys(h).length) {
      setKayit({ tur: 'hata', mesaj: 'Saat alanlarında hata var; düzeltip tekrar kaydet.' });
      return false;
    }
    setKayit({ tur: 'kaydediliyor' });
    const kullanTaban = zorlaTaban !== undefined ? zorlaTaban : taban;
    try {
      const veri = formdanVeri(tarih, form, satir?.veri);
      const s = await api.gunKaydet(tarih, veri, kullanTaban);
      gunSatiriYaz(s);
      taslakSil(tarih);
      setKayit({ tur: 'kayitli' });
      void yenile(true);
      return true;
    } catch (e) {
      if (e instanceof ApiHata && e.tur === 'cakisma') {
        let sunucu: api.GunSatiri | null = null;
        try {
          sunucu = await api.gunGetir(tarih);
          if (sunucu) gunSatiriYaz(sunucu);
        } catch { /* bağlantı yoksa yine de çakışmayı göster */ }
        setKayit({ tur: 'cakisma', sunucu });
      } else {
        setKayit({ tur: 'hata', mesaj: e instanceof ApiHata ? e.message : api.MESAJ.baglanti });
      }
      return false;
    }
  };

  const gitTarih = (t: string) => {
    if (t === tarih) return;
    if (kirli) { setGecis(t); return; }
    git(`#/gunluk/${t}`);
  };

  // Taslağın tabanı sunucudakinden farklıysa (başka cihaz kaydetti) önceden haber ver
  const disaridanDegisti = kirli && satir && taslak!.taban !== satir.updated_at && kayit.tur !== 'cakisma';
  const digerTaslaklar = taslakTarihleri().filter((t) => t !== tarih);

  const toplamG = detayVar(form.hedefler) ? haritaToplami(form.hedefler) : satir?.veri.gunlukToplam;
  const toplamS = detayVar(form.saglik) ? haritaToplami(form.saglik) : satir?.veri.saglikToplam;
  const eskiToplamVar = satir && !detayVar(satir.veri.hedefler) && !detayVar(satir.veri.saglik)
    && (typeof satir.veri.gunlukToplam === 'number' || typeof satir.veri.saglikToplam === 'number');
  const silinmis = (alan: 'hedefler' | 'saglik', liste: Kriter[]) =>
    haritaToplami(Object.fromEntries(Object.entries(form[alan]).filter(([id]) => !liste.some((x) => x.id === id))));
  const silinmisG = silinmis('hedefler', k.gunluk);
  const silinmisS = silinmis('saglik', k.saglik);

  const durum: KayitDurumu =
    kayit.tur === 'kaydediliyor' ? 'kaydediliyor'
      : kayit.tur === 'hata' || kayit.tur === 'cakisma' ? 'hata'
        : kirli ? 'kaydedilmedi'
          : satir ? 'kayitli' : 'yeni';

  const goreceli = goreceliEtiket(tarih, bugunT);
  const ileriKapali = gunFarki(bugunT, tarih) >= 0;

  return (
    <main class="kaydet-var">
      {ust}
      <div class="gun-bas">
        <button type="button" class="ikon-dugme" aria-label="Önceki gün" onClick={() => gitTarih(gunEkle(tarih, -1))}><Sol /></button>
        <div class="orta">
          <h1>{tarihMetni(tarih)}</h1>
          <div class="alt">{haftaGunuAdi(tarih)}{goreceli ? ` · ${goreceli}` : ''}</div>
          {tarih !== bugunT && <button type="button" class="baglanti" onClick={() => gitTarih(bugunT)}>Bugüne git</button>}
        </div>
        <button type="button" class="ikon-dugme" aria-label="Sonraki gün" disabled={ileriKapali} onClick={() => gitTarih(gunEkle(tarih, 1))}><Sag /></button>
      </div>

      {gecis && (
        <div class="uyari-kutu" role="alert">
          <p>{kisaTarih(tarih)} için kaydedilmemiş değişiklik var.</p>
          <div class="eylemler">
            <button type="button" class="dugme ana" onClick={async () => { const t = gecis; if (await kaydet()) git(`#/gunluk/${t}`); }}>Kaydet ve geç</button>
            <button type="button" class="dugme" onClick={() => git(`#/gunluk/${gecis}`)}>Kaydetmeden geç</button>
            <button type="button" class="dugme" onClick={() => setGecis(null)}>Vazgeç</button>
          </div>
          <p class="bilgi" style={{ margin: '10px 0 0' }}>Kaydetmeden geçersen değişikliklerin bu cihazda taslak olarak kalır.</p>
        </div>
      )}

      {kayit.tur === 'cakisma' && (
        <div class="uyari-kutu" role="alert">
          <p>
            {kayit.sunucu
              ? `Bu gün başka bir cihazda ${saat(kayit.sunucu.updated_at)}’te kaydedilmiş. Hangisi kalsın?`
              : 'Bu gün başka bir cihazda değiştirilmiş veya silinmiş. Hangisi kalsın?'}
          </p>
          <div class="eylemler">
            <button type="button" class="dugme ana" onClick={() => kaydet(kayit.sunucu?.updated_at ?? null)}>Benimkini kaydet</button>
            <button type="button" class="dugme" onClick={() => { taslakSil(tarih); setKayit({ tur: 'bos' }); }}>Diğerini yükle</button>
          </div>
        </div>
      )}

      {disaridanDegisti && (
        <div class="uyari-kutu" role="status">
          <p>Sen düzenlerken bu gün başka bir cihazda {saat(satir!.updated_at)}’te kaydedildi.</p>
          <div class="eylemler">
            <button type="button" class="dugme" onClick={() => taslakSil(tarih)}>Diğerini yükle</button>
            <button type="button" class="dugme ana" onClick={() => kaydet(satir!.updated_at)}>Benimkini kaydet</button>
          </div>
        </div>
      )}

      {kayit.tur === 'hata' && <BaglantiHatasi mesaj={kayit.mesaj} onTekrar={() => void kaydet()} />}

      {digerTaslaklar.length > 0 && (
        <p class="bilgi" style={{ margin: '0 0 16px' }}>
          Kaydedilmemiş taslak:{' '}
          {digerTaslaklar.map((t, i) => (
            <span key={t}>{i > 0 && ', '}<a class="baglanti" style={{ minHeight: 'auto' }} href={`#/gunluk/${t}`}>{kisaTarih(t)}</a></span>
          ))}
        </p>
      )}

      {eskiToplamVar && !detayVar(form.hedefler) && !detayVar(form.saglik) && (
        <p class="bilgi" style={{ margin: '0 0 16px' }}>
          Bu gün için madde detayı yok; kayıtlı toplamlar gösteriliyor. Madde puanlarsan o bölümün toplamı maddelerden hesaplanır.
        </p>
      )}

      <section class="bolum" aria-labelledby="hedef-baslik">
        <div class="alt-baslik">
          <h2 id="hedef-baslik">Günlük hedefler</h2>
          <span class="bolum-ozet"><b>{sayiBicim(toplamG)}</b> / {k.gunluk.length}</span>
        </div>
        {k.gunluk.map((m) => (
          <PuanSatiri key={m.id} id={m.id} ad={m.ad} deger={form.hedefler[m.id]} onDegis={(v) => puanYaz('hedefler', m.id, v)} />
        ))}
        {silinmisG > 0 && <p class="bilgi">Silinmiş maddelerden {sayiBicim(silinmisG)} puan bu günün toplamında duruyor.</p>}
      </section>

      <section class="bolum" aria-labelledby="saglik-baslik">
        <div class="alt-baslik">
          <h2 id="saglik-baslik">Sağlık</h2>
          <span class="bolum-ozet"><b>{sayiBicim(toplamS)}</b> / {k.saglik.length}</span>
        </div>
        {k.saglik.map((m) => (
          <PuanSatiri key={m.id} id={m.id} ad={m.ad} deger={form.saglik[m.id]} onDegis={(v) => puanYaz('saglik', m.id, v)} />
        ))}
        {silinmisS > 0 && <p class="bilgi">Silinmiş maddelerden {sayiBicim(silinmisS)} puan bu günün toplamında duruyor.</p>}
      </section>

      <section class="bolum" aria-labelledby="saat-baslik">
        <h2 id="saat-baslik" style={{ fontSize: '20px', marginBottom: '14px' }}>Saatler</h2>
        <div class="saatler">
          {SAAT_ALANLARI.map(({ anahtar, ad }) => (
            <div key={anahtar}>
              <label for={`saat-${anahtar}`}>{ad}</label>
              <input
                id={`saat-${anahtar}`}
                class="alan"
                inputMode="decimal"
                autoComplete="off"
                value={form[anahtar]}
                aria-invalid={hatalar[anahtar] ? 'true' : undefined}
                aria-describedby={hatalar[anahtar] ? `saat-${anahtar}-hata` : undefined}
                onInput={(e) => {
                  formYaz({ ...form, [anahtar]: (e.target as HTMLInputElement).value });
                  if (hatalar[anahtar]) setHatalar({ ...hatalar, [anahtar]: undefined });
                }}
              />
              {hatalar[anahtar] && <div class="alan-hata" id={`saat-${anahtar}-hata`}>{hatalar[anahtar]}</div>}
            </div>
          ))}
        </div>
      </section>

      <section class="bolum">
        <label for="not" style={{ display: 'block', fontSize: '20px', fontWeight: 700, marginBottom: '14px' }}>Not</label>
        <textarea id="not" class="alan" placeholder="Günün kısa notu" value={form.not}
          onInput={(e) => formYaz({ ...form, not: (e.target as HTMLTextAreaElement).value })} />
      </section>

      <MaddeDuzenle />

      <KaydetCubugu durum={durum} onKaydet={() => void kaydet()} kapali={!kirli && kayit.tur !== 'hata'} />
    </main>
  );
}

function MaddeDuzenle() {
  const d = useDepo();
  const [acik, setAcik] = useState(false);
  const [taslak, setTaslak] = useState<Kriterler | null>(null);
  const [durum, setDurum] = useState<{ tur: 'bos' | 'kaydediliyor' | 'hata' | 'tamam'; mesaj?: string }>({ tur: 'bos' });
  const mevcut = (d.kriterler?.veri as Kriterler) ?? { gunluk: [], saglik: [] };
  const k = taslak ?? mevcut;

  const degis = (alan: 'gunluk' | 'saglik', l: Kriter[]) => { setTaslak({ ...k, [alan]: l }); setDurum({ tur: 'bos' }); };

  const kaydet = async () => {
    if ([...k.gunluk, ...k.saglik].some((m) => !m.ad.trim())) {
      setDurum({ tur: 'hata', mesaj: 'Boş madde adı olamaz; adını yaz ya da maddeyi sil.' });
      return;
    }
    setDurum({ tur: 'kaydediliyor' });
    try {
      const temiz = (l: Kriter[]) => l.map((m) => ({ id: m.id, ad: m.ad.trim() }));
      await ayarKaydet('kriterler', { ...mevcut, gunluk: temiz(k.gunluk), saglik: temiz(k.saglik) });
      setTaslak(null);
      setDurum({ tur: 'tamam' });
    } catch (e) {
      setDurum({
        tur: 'hata',
        mesaj: e instanceof ApiHata && e.tur === 'cakisma'
          ? 'Maddeler başka bir cihazda değişmiş; en güncel hali yüklendi. Kaydet’e basarsan seninki yazılır.'
          : 'Kaydedilemedi, tekrar dene. Düzenlemen burada duruyor.',
      });
    }
  };

  const grup = (alan: 'gunluk' | 'saglik', baslik: string) => {
    const l = k[alan];
    const tum = [...k.gunluk, ...k.saglik].map((m) => m.id);
    return (
      <div style={{ marginTop: '12px' }}>
        <h3 style={{ fontSize: '16px', marginBottom: '6px' }}>{baslik}</h3>
        <ul class="duzen-liste">
          {l.map((m, i) => (
            <li key={m.id}>
              <label class="sr-only" for={`kr-${m.id}`}>{baslik} maddesi {i + 1}</label>
              <input id={`kr-${m.id}`} class="alan" value={m.ad}
                onInput={(e) => degis(alan, l.map((x) => (x.id === m.id ? { ...x, ad: (e.target as HTMLInputElement).value } : x)))} />
              <button type="button" class="ikon-dugme" aria-label={`${m.ad || 'Madde'} sil`} onClick={() => degis(alan, l.filter((x) => x.id !== m.id))}><Sil /></button>
            </li>
          ))}
        </ul>
        <button type="button" class="baglanti" onClick={() => degis(alan, [...l, { id: yeniKriterId(alan === 'gunluk' ? 'g' : 's', tum), ad: '' }])}>+ Madde ekle</button>
      </div>
    );
  };

  return (
    <div class="katlanir">
      <button type="button" aria-expanded={acik} aria-controls="madde-duzenle" onClick={() => setAcik(!acik)}>
        Maddeleri düzenle <Asagi />
      </button>
      {acik && (
        <div id="madde-duzenle" style={{ paddingBottom: '16px' }}>
          <p class="bilgi" style={{ marginTop: 0 }}>Eski günlerin kayıtlı toplamları değişmez; silinen maddenin eski puanları o günlerde kalır.</p>
          {grup('gunluk', 'Günlük hedefler')}
          {grup('saglik', 'Sağlık')}
          {durum.tur === 'hata' && <p class="hata-metin" role="alert">{durum.mesaj}</p>}
          {durum.tur === 'tamam' && <p class="bilgi" role="status">Maddeler kaydedildi.</p>}
          <div class="duzen-alt">
            <button type="button" class="dugme" disabled={!taslak} onClick={() => { setTaslak(null); setDurum({ tur: 'bos' }); }}>Vazgeç</button>
            <button type="button" class="dugme ana" disabled={!taslak || durum.tur === 'kaydediliyor'} onClick={kaydet}>
              {durum.tur === 'kaydediliyor' ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
