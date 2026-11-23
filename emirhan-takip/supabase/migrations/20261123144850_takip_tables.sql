-- Not: Supabase MCP ile uygulandı.
-- Mevcut şema (projede önceden uygulanmış; kayıt için buraya alındı).
create table public.takip_gunluk (tarih date primary key, veri jsonb not null, updated_at timestamptz not null default now());
create table public.takip_ayar (anahtar text primary key, veri jsonb not null, updated_at timestamptz not null default now());
alter table public.takip_gunluk enable row level security;
alter table public.takip_ayar enable row level security;
create policy "link herkes okur yazar" on public.takip_gunluk for all to anon using (true) with check (true);
create policy "link herkes okur yazar" on public.takip_ayar for all to anon using (true) with check (true);
alter publication supabase_realtime add table public.takip_gunluk, public.takip_ayar;
