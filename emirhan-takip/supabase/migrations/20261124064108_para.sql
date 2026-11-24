-- Not: Supabase MCP ile uygulandı.
-- Para bölümü: hesaplar, işlemler, bütçeler, abonelikler, hedefler.
-- Bakiye tutulmaz; açılış bakiyesi + işlemlerden türetilir (cihazlar arası tutarsızlık olmasın).
-- Erişim mevcut tablolarla aynı: RLS açık, anon rolü okur/yazar (bilinçli seçim).

create table public.para_hesap (
  id uuid primary key default gen_random_uuid(),
  ad text not null check (length(trim(ad)) > 0),
  tur text not null check (tur in ('nakit','banka','kart','birikim')),
  para_birimi text not null default 'TRY' check (para_birimi in ('TRY','USD')),
  acilis_bakiyesi numeric(14,2) not null default 0,
  limit_tutar numeric(14,2) check (limit_tutar is null or limit_tutar >= 0),
  kesim_gunu int check (kesim_gunu is null or kesim_gunu between 1 and 31),
  sira int not null default 0,
  arsiv boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.para_islem (
  id uuid primary key default gen_random_uuid(),
  tarih date not null,
  tur text not null check (tur in ('gider','gelir','transfer')),
  kategori text,
  hesap_id uuid not null references public.para_hesap(id) on delete restrict,
  hedef_hesap_id uuid references public.para_hesap(id) on delete restrict,
  tutar numeric(14,2) not null check (tutar > 0),
  giren_tutar numeric(14,2) check (giren_tutar is null or giren_tutar > 0),
  nota text,
  abonelik_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint para_islem_transfer_alanlari check (
    (tur = 'transfer' and hedef_hesap_id is not null and giren_tutar is not null and hedef_hesap_id <> hesap_id)
    or (tur <> 'transfer' and hedef_hesap_id is null and kategori is not null)
  )
);
create index para_islem_tarih_idx on public.para_islem (tarih);
create index para_islem_hesap_idx on public.para_islem (hesap_id);
create index para_islem_hedef_idx on public.para_islem (hedef_hesap_id);

create table public.para_butce (
  kategori text primary key,
  limit_tutar numeric(14,2) not null check (limit_tutar > 0),
  updated_at timestamptz not null default now()
);

create table public.para_abonelik (
  id uuid primary key default gen_random_uuid(),
  ad text not null check (length(trim(ad)) > 0),
  tutar numeric(14,2) not null check (tutar > 0),
  para_birimi text not null default 'TRY' check (para_birimi in ('TRY','USD')),
  gun int not null check (gun between 1 and 31),
  hesap_id uuid not null references public.para_hesap(id) on delete restrict,
  kategori text not null default 'Abonelik',
  aktif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.para_islem
  add constraint para_islem_abonelik_fk foreign key (abonelik_id) references public.para_abonelik(id) on delete set null;

-- Bir abonelik bir ayda en fazla bir kez ödenir (PK). İşlem silinirse işaret de kalkar (cascade).
create table public.para_abonelik_odeme (
  abonelik_id uuid not null references public.para_abonelik(id) on delete cascade,
  ay text not null check (ay ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  islem_id uuid not null unique references public.para_islem(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (abonelik_id, ay)
);

create table public.para_hedef (
  id uuid primary key default gen_random_uuid(),
  ad text not null check (length(trim(ad)) > 0),
  hedef_tutar numeric(14,2) not null check (hedef_tutar > 0),
  para_birimi text not null default 'TRY' check (para_birimi in ('TRY','USD')),
  bagli_hesap_id uuid references public.para_hesap(id) on delete set null,
  mevcut_tutar numeric(14,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at tetikleyicileri (mevcut fonksiyon)
create trigger para_hesap_updated_at before insert or update on public.para_hesap for each row execute function public.takip_set_updated_at();
create trigger para_islem_updated_at before insert or update on public.para_islem for each row execute function public.takip_set_updated_at();
create trigger para_butce_updated_at before insert or update on public.para_butce for each row execute function public.takip_set_updated_at();
create trigger para_abonelik_updated_at before insert or update on public.para_abonelik for each row execute function public.takip_set_updated_at();
create trigger para_hedef_updated_at before insert or update on public.para_hedef for each row execute function public.takip_set_updated_at();

-- RLS + anon erişimi
do $$
declare t text;
begin
  foreach t in array array['para_hesap','para_islem','para_butce','para_abonelik','para_abonelik_odeme','para_hedef'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "link herkes okur yazar" on public.%I for all to anon using (true) with check (true)', t);
  end loop;
end $$;

-- Abonelik "Ödendi": gider işlemi + ay işareti tek işlemde (aynı ay ikinci kez → 23505 / HTTP 409).
create or replace function public.para_abonelik_ode(p_abonelik uuid, p_ay text, p_islem uuid, p_tarih date)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare a public.para_abonelik%rowtype;
begin
  select * into a from public.para_abonelik where id = p_abonelik;
  if not found then raise exception 'abonelik bulunamadı' using errcode = 'P0002'; end if;
  insert into public.para_islem (id, tarih, tur, kategori, hesap_id, tutar, nota, abonelik_id)
    values (p_islem, p_tarih, 'gider', a.kategori, a.hesap_id, a.tutar, a.ad, a.id);
  insert into public.para_abonelik_odeme (abonelik_id, ay, islem_id) values (a.id, p_ay, p_islem);
  return p_islem;
end;
$$;

-- Geri al: o aya bağlı işlemi sil (işaret cascade ile kalkar).
create or replace function public.para_abonelik_geri_al(p_abonelik uuid, p_ay text)
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from public.para_islem
  where id = (select islem_id from public.para_abonelik_odeme where abonelik_id = p_abonelik and ay = p_ay);
$$;

grant execute on function public.para_abonelik_ode(uuid, text, uuid, date) to anon;
grant execute on function public.para_abonelik_geri_al(uuid, text) to anon;

-- Varsayılan kategoriler (örnek hesap/işlem verisi YAZILMAZ). Varsa dokunma.
insert into public.takip_ayar (anahtar, veri) values
  ('para_kategoriler', '{"gider":["Yemek","Market","Ulaşım","Fatura","Abonelik","Eğitim","Kişisel bakım","Diğer"],"gelir":["Harçlık","Diğer gelir"]}'::jsonb)
on conflict (anahtar) do nothing;
