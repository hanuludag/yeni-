import { sayiBicim } from '../lib/sayi';
import { useGenislik } from './useGenislik';

const VURGU = '#2dd4bf';
const IKINCIL = '#a3a3a3';
const CIZGI = '#262626';
const METIN = '#f5f5f5';

export interface Seri {
  ad: string;
  degerler: (number | undefined)[];
  /** 'duz' = ana çizgi (turkuaz), 'kesik' = ikincil çizgi */
  stil?: 'duz' | 'kesik';
  etiket?: 'hepsi' | 'son' | 'yok';
  /** son noktaya beyaz nokta */
  sonNokta?: boolean;
  alan?: [number, number];
  /** Çizim alanının dikey dilimi (0 = üst, 1 = alt); iki seri üst üste binmesin diye */
  bant?: [number, number];
}

interface Ortak {
  /** x ekseni etiketleri: index → metin */
  xEtiket: { i: number; metin: string }[];
  n: number;
  yukseklik?: number;
  aciklama: string;
  /** kenar boşluğu oranı (ilk/son noktanın kenardan uzaklığı) */
  ic?: number;
}

function alanHesapla(d: (number | undefined)[], verilen?: [number, number]): [number, number] {
  if (verilen) return verilen;
  const x = d.filter((v): v is number => v !== undefined);
  if (!x.length) return [0, 1];
  let lo = Math.min(...x);
  let hi = Math.max(...x);
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const p = (hi - lo) * 0.15;
  return [lo - p, hi + p];
}

/** Çizgi grafik. Yazılmamış günler boş kalır (sıfır çizilmez); aradaki boşlukta çizgi kesilir. */
export function CizgiGrafik({ seriler, xEtiket, n, yukseklik = 150, aciklama, ic = 0.06 }: Ortak & { seriler: Seri[] }) {
  const [ref, g] = useGenislik<HTMLDivElement>();
  const ust = 30;
  const taban = yukseklik - 30;
  const solX = g * ic;
  const sagX = g * (1 - ic);
  const x = (i: number) => (n <= 1 ? (solX + sagX) / 2 : solX + ((sagX - solX) * i) / (n - 1));

  return (
    <div ref={ref}>
      <svg class="grafik" width={g} height={yukseklik} role="img" aria-label={aciklama}>
        <line x1={0} x2={g} y1={taban + 6} y2={taban + 6} stroke={CIZGI} />
        {seriler.map((s) => {
          const [lo, hi] = alanHesapla(s.degerler, s.alan);
          const [b0, b1] = s.bant ?? [0, 1];
          const y = (v: number) => ust + (b0 + (1 - (v - lo) / (hi - lo)) * (b1 - b0)) * (taban - ust);
          const renk = s.stil === 'kesik' ? IKINCIL : VURGU;
          const parcalar: string[] = [];
          let yol = '';
          s.degerler.forEach((v, i) => {
            if (v === undefined) {
              if (yol) parcalar.push(yol);
              yol = '';
              return;
            }
            yol += `${yol ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
          });
          if (yol) parcalar.push(yol);
          let son = -1;
          s.degerler.forEach((v, i) => { if (v !== undefined) son = i; });
          return (
            <g key={s.ad}>
              {parcalar.map((d) => (
                <path d={d} fill="none" stroke={renk} stroke-width={2} stroke-dasharray={s.stil === 'kesik' ? '5 4' : undefined} stroke-linejoin="round" stroke-linecap="round" />
              ))}
              {s.degerler.map((v, i) => {
                if (v === undefined) return null;
                const yalniz = s.degerler[i - 1] === undefined && s.degerler[i + 1] === undefined;
                const sonMu = i === son;
                const etiketVar = s.etiket === 'hepsi' || (s.etiket === 'son' && sonMu);
                return (
                  <g key={i}>
                    {yalniz && !(sonMu && s.sonNokta) && <circle cx={x(i)} cy={y(v)} r={2.5} fill={renk} />}
                    {sonMu && s.sonNokta && <circle cx={x(i)} cy={y(v)} r={4} fill={METIN} />}
                    {etiketVar && (
                      <text
                        x={x(i)}
                        y={y(v) - 12}
                        text-anchor="middle"
                        font-size={sonMu ? 14 : 13}
                        font-weight={sonMu ? 700 : 400}
                        fill={sonMu ? renk : IKINCIL}
                      >
                        {sayiBicim(v)}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
        {xEtiket.map((e) => (
          <text x={x(e.i)} y={yukseklik - 4} text-anchor="middle" font-size={13} fill={IKINCIL}>{e.metin}</text>
        ))}
      </svg>
    </div>
  );
}

/** Çubuk grafik (ders, ekran). Yazılmamış gün için çubuk yok. */
export function CubukGrafik({ degerler, xEtiket, n, yukseklik = 140, aciklama, ic = 0.02, enAz = 1 }: Ortak & { degerler: (number | undefined)[]; enAz?: number }) {
  const [ref, g] = useGenislik<HTMLDivElement>();
  const ust = 16;
  const taban = yukseklik - 30;
  const solX = g * ic;
  const sagX = g * (1 - ic);
  const x = (i: number) => solX + ((sagX - solX) * i) / Math.max(1, n - 1);
  const enBuyuk = Math.max(enAz, ...degerler.filter((v): v is number => v !== undefined));
  const adim = (sagX - solX) / Math.max(1, n - 1);
  const w = Math.max(3, Math.min(12, adim * 0.6));
  let son = -1;
  degerler.forEach((v, i) => { if (v !== undefined) son = i; });
  return (
    <div ref={ref}>
      <svg class="grafik" width={g} height={yukseklik} role="img" aria-label={aciklama}>
        <line x1={0} x2={g} y1={taban} y2={taban} stroke={CIZGI} />
        {degerler.map((v, i) => {
          if (v === undefined) return null;
          const h = Math.max(v > 0 ? 2 : 0, (v / enBuyuk) * (taban - ust));
          return (
            <g key={i}>
              <rect x={x(i) - w / 2} y={taban - h} width={w} height={h} fill={VURGU} rx={1} />
              {i === son && <circle cx={x(i)} cy={taban - h} r={4} fill={METIN} />}
            </g>
          );
        })}
        {xEtiket.map((e) => (
          <text x={x(e.i)} y={yukseklik - 4} text-anchor="middle" font-size={13} fill={IKINCIL}>{e.metin}</text>
        ))}
      </svg>
    </div>
  );
}

export function Lejant({ ogeler }: { ogeler: { ad: string; stil: 'duz' | 'kesik' }[] }) {
  return (
    <div class="lejant">
      {ogeler.map((o) => (
        <span key={o.ad}>
          <svg viewBox="0 0 18 6" aria-hidden="true">
            <line x1="0" x2="18" y1="3" y2="3" stroke={o.stil === 'kesik' ? IKINCIL : VURGU} stroke-width="2" stroke-dasharray={o.stil === 'kesik' ? '4 3' : undefined} />
          </svg>
          {o.ad}
        </span>
      ))}
    </div>
  );
}
