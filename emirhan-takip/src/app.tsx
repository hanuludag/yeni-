import { useEffect } from 'preact/hooks';
import { useRota } from './rota';
import { useDepo, yenile } from './lib/store';
import { BaglantiHatasi, Yukleniyor } from './bilesenler/Durumlar';
import { AnaEkran } from './ekranlar/AnaEkran';
import { Gunluk } from './ekranlar/Gunluk';
import { Aylik } from './ekranlar/Aylik';
import { Rutinler } from './ekranlar/Rutinler';
import { Para } from './ekranlar/para/Para';

const SEKMELER = [
  { sayfa: 'ana', ad: 'Ana ekran', href: '#/' },
  { sayfa: 'gunluk', ad: 'Günlük', href: '#/gunluk' },
  { sayfa: 'aylik', ad: 'Aylık', href: '#/aylik' },
  { sayfa: 'rutinler', ad: 'Rutinler', href: '#/rutinler' },
  { sayfa: 'para', ad: 'Para', href: '#/para' },
] as const;

export function App() {
  const rota = useRota();
  const d = useDepo();
  const aktif = SEKMELER.find((s) => s.sayfa === rota.sayfa)!;

  useEffect(() => {
    document.title = `${aktif.ad} · Günlük Takip`;
    window.scrollTo(0, 0);
  }, [rota.sayfa]);

  let icerik;
  if (rota.sayfa === 'para') {
    // Para kendi verisini ve durumlarını yönetir (takip verisi yüklenmese de çalışır)
    icerik = <Para gorunum={rota.gorunum} id={rota.id} />;
  } else if (d.ilkYukleme === 'yukleniyor') {
    icerik = <main><Yukleniyor satir={5} /></main>;
  } else if (d.ilkYukleme === 'hata') {
    icerik = <main><BaglantiHatasi mesaj={d.hata ?? 'Bağlantı yok.'} onTekrar={() => yenile(true)} /></main>;
  } else {
    const ust = d.hata ? <BaglantiHatasi mesaj={d.hata} onTekrar={() => yenile(true)} /> : null;
    if (rota.sayfa === 'gunluk') icerik = <Gunluk tarih={rota.tarih} ust={ust} />;
    else if (rota.sayfa === 'aylik') icerik = <Aylik ay={rota.ay} ust={ust} />;
    else if (rota.sayfa === 'rutinler') icerik = <Rutinler ust={ust} />;
    else icerik = <AnaEkran ust={ust} />;
  }

  return (
    <>
      <header class="ust">
        <div class="ust-ic">
          <a class="marka" href="#/">Günlük Takip</a>
          <nav class="sekmeler bes" aria-label="Bölümler">
            {SEKMELER.map((s) => (
              <a key={s.sayfa} class="sekme" href={s.href} aria-current={s.sayfa === rota.sayfa ? 'page' : undefined}>
                {s.ad}
              </a>
            ))}
          </nav>
        </div>
      </header>
      {icerik}
    </>
  );
}
