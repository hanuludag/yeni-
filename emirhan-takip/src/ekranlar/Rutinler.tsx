import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { ayarKaydet, bugun, useDepo } from '../lib/store';
import { BOLUMLER, type ProgramVeri } from '../lib/rutin';
import { haftaGunuAdi } from '../lib/tarih';
import { ApiHata } from '../lib/api';
import { ListeDuzenleyici } from '../bilesenler/ListeDuzenleyici';
import { VeriYok } from '../bilesenler/Durumlar';

const BOS: ProgramVeri = { ogrenim: [], spor: [], rutinler: { sabah: [], ogle: [], gece: [] }, yemek: [] };

export function Rutinler({ ust }: { ust: ComponentChildren }) {
  const d = useDepo();
  const program = (d.program?.veri as ProgramVeri | undefined) ?? null;
  const [duzen, setDuzen] = useState<ProgramVeri | null>(null);
  const [durum, setDurum] = useState<{ tur: 'bos' | 'kaydediliyor' | 'hata' | 'tamam'; mesaj?: string }>({ tur: 'bos' });
  const bugunAdi = haftaGunuAdi(bugun());
  const p = duzen ?? program ?? BOS;

  const baslat = () => {
    const kaynak = program ?? BOS;
    setDuzen(JSON.parse(JSON.stringify({ ...BOS, ...kaynak, rutinler: { ...BOS.rutinler, ...(kaynak.rutinler ?? {}) } })));
    setDurum({ tur: 'bos' });
  };

  const kaydet = async () => {
    if (!duzen) return;
    setDurum({ tur: 'kaydediliyor' });
    const temiz: ProgramVeri = {
      ...duzen,
      rutinler: {
        sabah: duzen.rutinler.sabah.map((x) => x.trim()).filter(Boolean),
        ogle: duzen.rutinler.ogle.map((x) => x.trim()).filter(Boolean),
        gece: duzen.rutinler.gece.map((x) => x.trim()).filter(Boolean),
      },
    };
    try {
      await ayarKaydet('program', temiz);
      setDuzen(null);
      setDurum({ tur: 'tamam' });
    } catch (e) {
      setDurum({
        tur: 'hata',
        mesaj: e instanceof ApiHata && e.tur === 'cakisma'
          ? 'Rutinler başka bir cihazda değişmiş; en güncel hali yüklendi. Kaydet’e basarsan seninki yazılır.'
          : 'Kaydedilemedi, tekrar dene. Düzenlemen burada duruyor.',
      });
    }
  };

  const ayarla = (f: (x: ProgramVeri) => void) => {
    const k: ProgramVeri = JSON.parse(JSON.stringify(duzen));
    f(k);
    setDuzen(k);
  };

  if (!program && !duzen) {
    return <main>{ust}<VeriYok baslik="Rutin kaydı yok" alt="Düzenle ile rutinlerini ekleyebilirsin." /><div class="duzen-alt"><button type="button" class="dugme ana" onClick={baslat}>Düzenle</button></div></main>;
  }

  const gunEtiketi = (g: string) => (
    <span class="gun">{g}{g === bugunAdi && <span class="bugun">Bugün</span>}</span>
  );

  return (
    <main class={duzen ? 'kaydet-var' : ''}>
      {ust}
      <div class="bolum-bas" style={{ marginBottom: '8px' }}>
        <h1 style={{ fontSize: '26px' }}>Rutinler</h1>
        {!duzen && <button type="button" class="baglanti" onClick={baslat}>Düzenle</button>}
      </div>
      {durum.tur === 'tamam' && <p class="bilgi" role="status">Rutinler kaydedildi.</p>}

      <section class="bolum" aria-labelledby="ogrenim-b" style={{ marginTop: '24px' }}>
        <h2 id="ogrenim-b" class="alt-baslik" style={{ fontSize: '18px' }}>Öğrenim ve çalışılacaklar</h2>
        {p.ogrenim.map((r, i) => (
          <div class="program-satir" key={r.gun}>
            {gunEtiketi(r.gun)}
            {duzen ? (
              <div class="alanlar">
                <label class="sr-only" for={`og-ne-${i}`}>{r.gun} çalışılacak</label>
                <input id={`og-ne-${i}`} class="alan" value={r.ne} onInput={(e) => ayarla((x) => { x.ogrenim[i].ne = (e.target as HTMLInputElement).value; })} />
                <label class="sr-only" for={`og-not-${i}`}>{r.gun} ek (isteğe bağlı)</label>
                <input id={`og-not-${i}`} class="alan" placeholder="Ek (isteğe bağlı)" value={r.not ?? ''} onInput={(e) => ayarla((x) => { x.ogrenim[i].not = (e.target as HTMLInputElement).value; })} />
              </div>
            ) : (
              <span class={`icerik${r.ne ? '' : ' bos-deger'}`}>{[r.ne, r.not].filter(Boolean).join(' + ') || 'Boş'}</span>
            )}
          </div>
        ))}
      </section>

      <section class="bolum" aria-labelledby="spor-b">
        <h2 id="spor-b" class="alt-baslik" style={{ fontSize: '18px' }}>Spor programı</h2>
        {p.spor.map((r, i) => (
          <div class="program-satir" key={r.gun}>
            {gunEtiketi(r.gun)}
            {duzen ? (
              <div class="alanlar">
                <label class="sr-only" for={`sp-${i}`}>{r.gun} spor</label>
                <input id={`sp-${i}`} class="alan" placeholder="Boş" value={r.spor} onInput={(e) => ayarla((x) => { x.spor[i].spor = (e.target as HTMLInputElement).value; })} />
              </div>
            ) : (
              <span class={`icerik${r.spor ? '' : ' bos-deger'}`}>
                {r.spor || 'Boş'}
                {r.detay && <span class="not">{r.detay}</span>}
              </span>
            )}
          </div>
        ))}
      </section>

      <section class="bolum" aria-labelledby="rutin-b">
        <h2 id="rutin-b" class="alt-baslik" style={{ fontSize: '18px', marginBottom: '16px' }}>Rutin adımları</h2>
        <div class="rutin-sutunlar">
          {BOLUMLER.map((b) => (
            <div key={b.id}>
              <h3>{b.ad}</h3>
              {duzen ? (
                <ListeDuzenleyici ad={`${b.ad} adımı`} ogeler={duzen.rutinler[b.id]} onDegis={(l) => ayarla((x) => { x.rutinler[b.id] = l; })} />
              ) : (p.rutinler?.[b.id] ?? []).length ? (
                <ol>
                  {p.rutinler[b.id].map((a, i) => (
                    <li key={a + i}><span class="adim-no">{i + 1}</span>{a}</li>
                  ))}
                </ol>
              ) : (
                <p class="bilgi">Adım yok.</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section class="bolum" aria-labelledby="yemek-b">
        <h2 id="yemek-b" class="alt-baslik" style={{ fontSize: '18px' }}>Günlük yemek programı</h2>
        {p.yemek.map((r, i) => (
          <div class="program-satir" key={r.ogun}>
            <span class="gun">{r.ogun}</span>
            {duzen ? (
              <div class="alanlar">
                <label class="sr-only" for={`ym-ne-${i}`}>{r.ogun}</label>
                <input id={`ym-ne-${i}`} class="alan" value={r.ne} onInput={(e) => ayarla((x) => { x.yemek[i].ne = (e.target as HTMLInputElement).value; })} />
                <label class="sr-only" for={`ym-not-${i}`}>{r.ogun} notu</label>
                <input id={`ym-not-${i}`} class="alan" placeholder="Not (isteğe bağlı)" value={r.not ?? ''} onInput={(e) => ayarla((x) => { x.yemek[i].not = (e.target as HTMLInputElement).value; })} />
              </div>
            ) : (
              <span class={`icerik${r.ne ? '' : ' bos-deger'}`}>
                {r.ne || '–'}
                {r.not && <span class="not">{r.not}</span>}
              </span>
            )}
          </div>
        ))}
      </section>

      {duzen && (
        <div class="kaydet-cubugu">
          <div class="kaydet-ic">
            <span class={`kayit-durum${durum.tur === 'hata' ? ' hata' : ''}`} role="status" aria-live="polite">
              <span class="isaret" aria-hidden="true" />
              {durum.tur === 'hata' ? durum.mesaj : durum.tur === 'kaydediliyor' ? 'Kaydediliyor…' : 'Düzenleniyor'}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" class="dugme" onClick={() => { setDuzen(null); setDurum({ tur: 'bos' }); }}>Vazgeç</button>
              <button type="button" class="dugme ana" disabled={durum.tur === 'kaydediliyor'} onClick={kaydet}>Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
