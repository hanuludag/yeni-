import { ayDonemi, butceDurumlari, ozet, paraBicim, toplamlar } from '../../lib/para/hesap';
import { aktifHesaplar, bugunPara, kurDegeri, paraBakiyeler, useParaDepo } from '../../lib/para/store';
import { Ok } from './ortak';

/** Ana ekrandaki "Para özeti" kartı; tıklayınca Para sekmesi. */
export function ParaKarti() {
  const d = useParaDepo();
  if (d.ilk === 'yukleniyor') return null;
  const hesaplar = aktifHesaplar();
  if (d.ilk === 'hata' && !hesaplar.length) return null;
  if (!hesaplar.length) {
    return (
      <a class="ana-para" href="#/para" aria-label="Para sekmesine git, ilk hesabını ekle">
        <span class="ic">
          <span style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span class="etiket-k">Para</span>
            <span>İlk hesabını ekle; harcayabileceğin para burada görünür.</span>
          </span>
          <Ok />
        </span>
      </a>
    );
  }
  const bugun = bugunPara();
  const ay = bugun.slice(0, 7);
  const kur = kurDegeri();
  const T = toplamlar(hesaplar, paraBakiyeler(), d.veri.abonelikler, d.veri.odemeler, bugun, kur);
  const o = ozet(d.veri.islemler, d.veri.hesaplar, ayDonemi(ay), kur);
  const b = butceDurumlari(d.veri.butceler, d.veri.islemler, d.veri.hesaplar, ay, kur);
  const asan = b.filter((x) => x.asildi).sort((x, y) => y.oran - x.oran);
  const yakin = b.filter((x) => x.yakin);
  let uyari: { metin: string; yakin: boolean } | null = null;
  if (asan.length) {
    uyari = { metin: `${asan[0].kategori} bütçesi aşıldı (${paraBicim(asan[0].harcanan).replace(' ₺', '')} / ${paraBicim(asan[0].limit)})${asan.length > 1 ? ` · ${asan.length - 1} bütçe daha aşıldı` : ''}`, yakin: false };
  } else if (yakin.length) {
    uyari = { metin: `${yakin.length} bütçe limite yakın`, yakin: true };
  }
  return (
    <a class="ana-para" href="#/para" aria-label="Para özeti, Para sekmesine git">
      <span class="ic">
        <span style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span class="etiket-k">Harcayabileceğim</span>
          <span class="vurgu" style={{ fontSize: '24px', fontWeight: 700 }}>{paraBicim(T.harcayabilecegim)}</span>
          <span class="etiket-k">Bu ay gider: {paraBicim(o.gider)} · Gelir: {paraBicim(o.gelir)}</span>
        </span>
        <Ok />
      </span>
      {uyari && <span class={`asim${uyari.yakin ? ' yakin' : ''}`}>{uyari.metin}</span>}
    </a>
  );
}
