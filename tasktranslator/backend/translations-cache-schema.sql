-- Run this in your Supabase SQL editor if the backend reports that
-- public.translations_cache is missing.

create table if not exists translations_cache (
  cache_key text primary key,
  input_type text not null,
  input_data jsonb,
  response jsonb not null,
  hit_count integer default 1,
  created_at timestamptz default now(),
  last_used_at timestamptz default now()
);

create index if not exists translations_cache_input_type_idx on translations_cache (input_type);
create index if not exists translations_cache_last_used_idx on translations_cache (last_used_at desc);

alter table translations_cache enable row level security;
create policy "Service role full access" on translations_cache for all using (true) with check (true);
