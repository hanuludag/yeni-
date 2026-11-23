const ortak = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' } as const;
export const Sol = () => <svg {...ortak}><path d="M15 6l-6 6 6 6" /></svg>;
export const Sag = () => <svg {...ortak}><path d="M9 6l6 6-6 6" /></svg>;
export const Asagi = () => <svg {...ortak}><path d="M6 9l6 6 6-6" /></svg>;
export const Yukari = () => <svg {...ortak}><path d="M6 15l6-6 6 6" /></svg>;
export const Tik = () => <svg {...ortak} stroke-width={3}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
export const Sil = () => <svg {...ortak}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>;
