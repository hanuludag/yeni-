import { useEffect, useState } from 'preact/hooks';
import { PUANLAR, puanGecerli } from '../lib/puan';
import { kesirEtiket, sayiAyristir, sayiBicim } from '../lib/sayi';

interface Props {
  id: string;
  ad: string;
  deger: number | undefined;
  onDegis: (v: number | undefined) => void;
}

/** Bir madde: 0 / ¼ / ½ / ¾ / 1 düğmeleri + elle yazılabilir sayı kutusu. */
export function PuanSatiri({ id, ad, deger, onDegis }: Props) {
  const [metin, setMetin] = useState(deger === undefined ? '' : sayiBicim(deger));
  const [odak, setOdak] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    if (!odak) {
      setMetin(deger === undefined ? '' : sayiBicim(deger));
      setHata(null);
    }
  }, [deger, odak]);

  const yaz = (t: string) => {
    setMetin(t);
    const n = sayiAyristir(t);
    if (n === null) { setHata(null); onDegis(undefined); return; }
    if (Number.isNaN(n) || !puanGecerli(n)) { setHata('0 ile 1 arası bir sayı yaz (ör. 0,6).'); return; }
    setHata(null);
    onDegis(n);
  };

  const adId = `ad-${id}`;
  const hataId = `hata-${id}`;
  return (
    <div class="puan-satiri">
      <span class="puan-ad" id={adId}>{ad}</span>
      <div>
        <div class="puan-kontrol" role="group" aria-labelledby={adId}>
          {PUANLAR.map((p) => (
            <button
              type="button"
              key={p}
              aria-pressed={deger === p}
              aria-label={`${ad}: ${sayiBicim(p)}`}
              onClick={() => onDegis(deger === p ? undefined : p)}
            >
              {kesirEtiket(p)}
            </button>
          ))}
          <label class="sr-only" for={`elle-${id}`}>{ad} puanı (elle, 0–1)</label>
          <input
            id={`elle-${id}`}
            inputMode="decimal"
            autoComplete="off"
            placeholder="–"
            value={metin}
            aria-invalid={hata ? 'true' : undefined}
            aria-describedby={hata ? hataId : undefined}
            onFocus={() => setOdak(true)}
            onBlur={() => setOdak(false)}
            onInput={(e) => yaz((e.target as HTMLInputElement).value)}
          />
        </div>
        {hata && <div class="puan-hata" id={hataId}>{hata}</div>}
      </div>
    </div>
  );
}
