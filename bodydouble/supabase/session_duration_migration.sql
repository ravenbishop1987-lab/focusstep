alter table public.queue
  add column if not exists duration_minutes integer not null default 25;
