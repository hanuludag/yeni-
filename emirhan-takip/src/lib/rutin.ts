export type Bolum = 'sabah' | 'ogle' | 'gece';
export const BOLUMLER: { id: Bolum; ad: string }[] = [
  { id: 'sabah', ad: 'Sabah' },
  { id: 'ogle', ad: 'Öğle' },
  { id: 'gece', ad: 'Gece' },
];

/** 11:00'e kadar Sabah, 17:00'ye kadar Öğle, sonra Gece (05:00 öncesi de Gece). */
export function saateGoreBolum(simdi: Date): Bolum {
  const s = simdi.getHours();
  if (s < 5) return 'gece';
  if (s < 11) return 'sabah';
  if (s < 17) return 'ogle';
  return 'gece';
}

export type RutinIsaret = Partial<Record<Bolum, string[]>>;

export function isaretDegistir(i: RutinIsaret, b: Bolum, adim: string): RutinIsaret {
  const l = i[b] ?? [];
  return { ...i, [b]: l.includes(adim) ? l.filter((x) => x !== adim) : [...l, adim] };
}

export interface ProgramVeri {
  ogrenim: { gun: string; ne: string; not?: string }[];
  spor: { gun: string; spor: string; detay?: string }[];
  rutinler: Record<Bolum, string[]>;
  yemek: { ogun: string; ne: string; not?: string }[];
  [diger: string]: unknown;
}
