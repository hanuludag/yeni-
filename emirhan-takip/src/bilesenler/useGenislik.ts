import { useEffect, useRef, useState } from 'preact/hooks';

/** Bir öğenin piksel genişliğini izler (grafikler gerçek ölçüde çizilsin, yazılar bozulmasın). */
export function useGenislik<T extends HTMLElement>(varsayilan = 358) {
  const ref = useRef<T>(null);
  const [g, setG] = useState(varsayilan);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const olc = () => setG(Math.max(200, Math.round(el.getBoundingClientRect().width)));
    olc();
    const ro = new ResizeObserver(olc);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, g] as const;
}
