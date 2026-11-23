-- Not: Supabase MCP ile uygulandı.
-- 1) updated_at her güncellemede sunucu saatine çekilsin (çakışma kontrolü buna dayanıyor).
create or replace function public.takip_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger takip_gunluk_updated_at before insert or update on public.takip_gunluk
  for each row execute function public.takip_set_updated_at();
create trigger takip_ayar_updated_at before insert or update on public.takip_ayar
  for each row execute function public.takip_set_updated_at();

-- 2) Günlük rutin işaretleri: bir satır = bir gün. veri = {"sabah":["Kalkış",...],"ogle":[...],"gece":[...]}
create table public.takip_rutin_isaret (
  tarih date primary key,
  veri jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.takip_rutin_isaret enable row level security;
create policy "link herkes okur yazar" on public.takip_rutin_isaret for all to anon using (true) with check (true);
create trigger takip_rutin_isaret_updated_at before insert or update on public.takip_rutin_isaret
  for each row execute function public.takip_set_updated_at();
