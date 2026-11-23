export type KayitDurumu = 'kayitli' | 'kaydedilmedi' | 'hata' | 'kaydediliyor' | 'yeni';

const METIN: Record<KayitDurumu, string> = {
  kayitli: 'Kayıtlı',
  kaydedilmedi: 'Kaydedilmedi',
  hata: 'Kaydedilemedi, tekrar dene',
  kaydediliyor: 'Kaydediliyor…',
  yeni: 'Henüz kayıt yok',
};

export function KaydetCubugu({ durum, onKaydet, kapali }: { durum: KayitDurumu; onKaydet: () => void; kapali?: boolean }) {
  return (
    <div class="kaydet-cubugu">
      <div class="kaydet-ic">
        <span class={`kayit-durum ${durum === 'kayitli' ? 'kayitli' : durum === 'hata' ? 'hata' : ''}`} role="status" aria-live="polite">
          <span class="isaret" aria-hidden="true" />
          {METIN[durum]}
        </span>
        <button type="button" class="dugme ana" onClick={onKaydet} disabled={kapali || durum === 'kaydediliyor'}>
          Kaydet
        </button>
      </div>
    </div>
  );
}
