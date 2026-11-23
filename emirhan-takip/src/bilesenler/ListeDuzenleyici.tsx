import { useRef } from 'preact/hooks';
import { Asagi, Sil, Yukari } from './Ikonlar';

/** Metin listesi düzenleyici: ekle, yeniden adlandır, sırala, sil. */
export function ListeDuzenleyici({ ad, ogeler, onDegis, ekleMetni = 'Adım ekle' }: {
  ad: string;
  ogeler: string[];
  onDegis: (l: string[]) => void;
  ekleMetni?: string;
}) {
  const liste = useRef<HTMLUListElement>(null);
  const odakla = (i: number) => setTimeout(() => liste.current?.querySelectorAll('input')[i]?.focus(), 0);
  return (
    <div>
      <ul class="duzen-liste" ref={liste}>
        {ogeler.map((o, i) => (
          <li key={i}>
            <label class="sr-only" for={`${ad}-${i}`}>{ad} {i + 1}</label>
            <input
              id={`${ad}-${i}`}
              class="alan"
              value={o}
              onInput={(e) => onDegis(ogeler.map((x, j) => (j === i ? (e.target as HTMLInputElement).value : x)))}
            />
            <button type="button" class="ikon-dugme" aria-label={`${o || 'Adım'} yukarı taşı`} disabled={i === 0}
              onClick={() => { const l = [...ogeler]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; onDegis(l); }}>
              <Yukari />
            </button>
            <button type="button" class="ikon-dugme" aria-label={`${o || 'Adım'} aşağı taşı`} disabled={i === ogeler.length - 1}
              onClick={() => { const l = [...ogeler]; [l[i + 1], l[i]] = [l[i], l[i + 1]]; onDegis(l); }}>
              <Asagi />
            </button>
            <button type="button" class="ikon-dugme" aria-label={`${o || 'Adım'} sil`}
              onClick={() => onDegis(ogeler.filter((_, j) => j !== i))}>
              <Sil />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" class="baglanti" onClick={() => { onDegis([...ogeler, '']); odakla(ogeler.length); }}>+ {ekleMetni}</button>
    </div>
  );
}
