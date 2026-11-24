import { useEffect, useState } from 'preact/hooks';
import { ayGecerli, tarihGecerli } from './lib/tarih';

export type Rota =
  | { sayfa: 'ana' }
  | { sayfa: 'gunluk'; tarih?: string }
  | { sayfa: 'aylik'; ay?: string }
  | { sayfa: 'rutinler' }
  | { sayfa: 'para'; gorunum: ParaGorunum; id?: string };

export type ParaGorunum = 'hesaplar' | 'hesap' | 'islemler' | 'ozet' | 'plan';

export function rotaCoz(hash: string): Rota {
  const p = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  switch (p[0]) {
    case 'gunluk':
      return { sayfa: 'gunluk', tarih: p[1] && tarihGecerli(p[1]) ? p[1] : undefined };
    case 'aylik':
      return { sayfa: 'aylik', ay: p[1] && ayGecerli(p[1]) ? p[1] : undefined };
    case 'rutinler':
      return { sayfa: 'rutinler' };
    case 'para': {
      const g = p[1];
      if (g === 'hesap' && p[2]) return { sayfa: 'para', gorunum: 'hesap', id: decodeURIComponent(p[2]) };
      if (g === 'islemler') return { sayfa: 'para', gorunum: 'islemler', id: p[2] ? decodeURIComponent(p[2]) : undefined };
      if (g === 'ozet' || g === 'plan') return { sayfa: 'para', gorunum: g, id: p[2] };
      return { sayfa: 'para', gorunum: 'hesaplar', id: g === 'hesaplar' && p[2] === 'yeni' ? 'yeni' : undefined };
    }
    default:
      return { sayfa: 'ana' };
  }
}

export const git = (h: string) => { location.hash = h; };

export function useRota(): Rota {
  const [r, setR] = useState(() => rotaCoz(location.hash));
  useEffect(() => {
    const f = () => setR(rotaCoz(location.hash));
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return r;
}
