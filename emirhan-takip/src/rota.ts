import { useEffect, useState } from 'preact/hooks';
import { ayGecerli, tarihGecerli } from './lib/tarih';

export type Rota =
  | { sayfa: 'ana' }
  | { sayfa: 'gunluk'; tarih?: string }
  | { sayfa: 'aylik'; ay?: string }
  | { sayfa: 'rutinler' };

export function rotaCoz(hash: string): Rota {
  const p = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  switch (p[0]) {
    case 'gunluk':
      return { sayfa: 'gunluk', tarih: p[1] && tarihGecerli(p[1]) ? p[1] : undefined };
    case 'aylik':
      return { sayfa: 'aylik', ay: p[1] && ayGecerli(p[1]) ? p[1] : undefined };
    case 'rutinler':
      return { sayfa: 'rutinler' };
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
