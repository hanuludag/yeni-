import type { ComponentChildren } from 'preact';
import { paraBicim, type Birim, type Islem, type Hesap } from '../../lib/para/hesap';

export function Cip({ secili, onClick, children, etiket }: { secili: boolean; onClick: () => void; children: ComponentChildren; etiket?: string }) {
  return <button type="button" class="cip" aria-pressed={secili} aria-label={etiket} onClick={onClick}>{children}</button>;
}

export function CizgiSekme<T extends string>({ secenekler, deger, onSec, etiket, sola }: { secenekler: [T, string][]; deger: T; onSec: (d: T) => void; etiket: string; sola?: boolean }) {
  return (
    <div class={`cizgi-sekmeler${sola ? ' sola' : ''}`} role="tablist" aria-label={etiket}>
      {secenekler.map(([k, ad]) => (
        <button key={k} type="button" role="tab" aria-selected={deger === k} onClick={() => onSec(k)}>{ad}</button>
      ))}
    </div>
  );
}

export const Ok = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>;
export const GeriOk = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>;
export const Yenile = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>;
export const Ara = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>;
export const Suzgec = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>;
export const Carpi = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>;

export function HataKutu({ mesaj }: { mesaj: string | null }) {
  if (!mesaj) return null;
  return <div class="hata-kutu" role="alert">{mesaj}</div>;
}

export const birimSimge = (b: Birim) => (b === 'USD' ? '$' : '₺');

/** İşlemin listede görünen etiketleri (tasarımdaki txLabel/txAmount). */
export function islemGorunumu(i: Islem, hesapBul: (id: string | null) => Hesap | undefined) {
  const kaynak = hesapBul(i.hesap_id);
  const hedef = hesapBul(i.hedef_hesap_id);
  const k = (n: number) => Math.round(n * 100);
  if (i.tur === 'transfer') {
    const farkli = kaynak && hedef && kaynak.para_birimi !== hedef.para_birimi;
    return {
      kat: 'TRANSFER',
      hesap: `${hedef?.ad ?? '–'} ← ${kaynak?.ad ?? '–'}`,
      tutar: paraBicim(k(i.giren_tutar ?? i.tutar), hedef?.para_birimi ?? 'TRY'),
      cip: farkli ? paraBicim(k(i.tutar), kaynak!.para_birimi) : '',
      gelir: false,
    };
  }
  return {
    kat: (i.kategori ?? '').toLocaleUpperCase('tr-TR'),
    hesap: kaynak?.ad ?? '–',
    tutar: (i.tur === 'gelir' ? '+' : '') + paraBicim(k(i.tutar), kaynak?.para_birimi ?? 'TRY'),
    cip: '',
    gelir: i.tur === 'gelir',
  };
}
