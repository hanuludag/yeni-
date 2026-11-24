import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import type { ParaGorunum } from '../../rota';
import { paraYenile, useParaDepo } from '../../lib/para/store';
import { BaglantiHatasi, Yukleniyor } from '../../bilesenler/Durumlar';
import { Hesaplar } from './Hesaplar';
import { HesapDetay } from './HesapDetay';
import { Islemler } from './Islemler';
import { Ozet } from './Ozet';
import { Plan } from './Plan';

const SEKMELER: [Exclude<ParaGorunum, 'hesap'>, string, string][] = [
  ['hesaplar', 'Hesaplar', '#/para'],
  ['islemler', 'İşlemler', '#/para/islemler'],
  ['ozet', 'Özet', '#/para/ozet'],
  ['plan', 'Plan', '#/para/plan'],
];

export function Para({ gorunum, id }: { gorunum: ParaGorunum; id?: string }) {
  const d = useParaDepo();
  useEffect(() => { window.scrollTo(0, 0); }, [gorunum, id]);
  const aktif = gorunum === 'hesap' ? 'hesaplar' : gorunum;

  let icerik: ComponentChildren;
  if (d.ilk === 'yukleniyor') icerik = <Yukleniyor satir={5} />;
  else if (d.ilk === 'hata') icerik = <BaglantiHatasi mesaj={d.hata ?? 'Bağlantı yok.'} onTekrar={() => paraYenile(true)} />;
  else if (gorunum === 'hesap') icerik = <HesapDetay id={id!} />;
  else if (gorunum === 'islemler') icerik = <Islemler baslangic={id} />;
  else if (gorunum === 'ozet') icerik = <Ozet ay={id} />;
  else if (gorunum === 'plan') icerik = <Plan />;
  else icerik = <Hesaplar formAcik={id === 'yeni'} />;

  return (
    <main>
      {d.ilk === 'tamam' && d.hata && <BaglantiHatasi mesaj={d.hata} onTekrar={() => paraYenile(true)} />}
      <div class="para-bas">
        <h1>Para</h1>
        {gorunum === 'hesaplar' && id !== 'yeni' && d.veri.hesaplar.some((h) => !h.arsiv) && (
          <a class="baglanti" href="#/para/hesaplar/yeni">+ Hesap</a>
        )}
      </div>
      {(
        <nav class="para-sekmeler" aria-label="Para bölümleri">
          {SEKMELER.map(([k, ad, href]) => (
            <a key={k} class="cip" href={href} aria-current={aktif === k ? 'page' : undefined}>{ad}</a>
          ))}
        </nav>
      )}
      {icerik}
    </main>
  );
}
