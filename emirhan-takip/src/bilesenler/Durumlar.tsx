export function BaglantiHatasi({ mesaj, onTekrar }: { mesaj: string; onTekrar?: () => void }) {
  return (
    <div class="baglanti-hatasi" role="alert">
      <p>{mesaj}</p>
      {onTekrar && <button type="button" class="baglanti" onClick={onTekrar}>Tekrar dene</button>}
    </div>
  );
}

export function Yukleniyor({ satir = 4 }: { satir?: number }) {
  return (
    <div class="iskelet" role="status" aria-live="polite">
      <span class="sr-only">Yükleniyor…</span>
      {Array.from({ length: satir }, (_, i) => <div key={i} />)}
    </div>
  );
}

export function VeriYok({ baslik, alt }: { baslik: string; alt?: string }) {
  return (
    <div class="veri-yok">
      <b>{baslik}</b>
      {alt && <span>{alt}</span>}
    </div>
  );
}
