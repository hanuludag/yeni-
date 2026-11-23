-- Not: Supabase MCP ile uygulandı.
-- Rutin adımlarını tasarımdaki (takvimden gelen) adımlarla değiştir.
-- Öğrenim, spor ve yemek kısımları olduğu gibi kalır (sadece "rutinler" anahtarı değişir).
update public.takip_ayar
set veri = jsonb_set(
  veri,
  '{rutinler}',
  '{"sabah":["Kalkış","Sabah rutini","Vitamin","Kahvaltı","Ulaşım"],
    "ogle":["Öğle namazı","Öğle yemeği + 1 L su"],
    "gece":["Gece rutini","Kitap okuma ve atıştırmalık","Yatış"]}'::jsonb,
  true)
where anahtar = 'program';
