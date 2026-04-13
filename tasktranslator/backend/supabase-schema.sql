-- Run this in your Supabase SQL editor
-- Dashboard → SQL Editor → New query → paste and run

create table if not exists customers (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  is_pro boolean default false,
  plan text check (plan in ('free', 'plus', 'unlimited', 'monthly', 'lifetime')) default 'free',
  stripe_customer_id text,
  stripe_session_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for fast email lookups on every /translate request
create index if not exists customers_email_idx on customers (email);

-- Row level security: only the service role can read/write
-- (the backend uses the service role key, so this is safe)
alter table customers enable row level security;

create policy "Service role full access"
  on customers
  for all
  using (true)
  with check (true);

-- ── App Settings ────────────────────────────────────────────────────────────
-- Simple key/value storage for operational toggles such as referral kill switches.

create table if not exists app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter table app_settings enable row level security;

create policy "Service role full access"
  on app_settings
  for all
  using (true)
  with check (true);

-- ── Task Sharing ─────────────────────────────────────────────────────────────
-- One share record per task (the canonical link). When a recipient signs up
-- after clicking the link, shared_with_user_id is filled in. Additional
-- recipients get their own row (same share_code, different recipient).

create table if not exists task_shares (
  id uuid default gen_random_uuid() primary key,
  task_id uuid not null,
  owner_user_id uuid not null,
  shared_with_user_id uuid,
  share_code text not null,
  status text check (status in ('pending', 'accepted', 'completed', 'declined')) default 'pending',
  created_at timestamptz default now()
);

-- One canonical share-code row per task (where no recipient is attached yet)
create unique index if not exists task_shares_canonical_idx
  on task_shares (task_id, owner_user_id)
  where shared_with_user_id is null;

-- Prevent the same recipient from being attached twice to the same task
create unique index if not exists task_shares_recipient_idx
  on task_shares (task_id, shared_with_user_id)
  where shared_with_user_id is not null;

create index if not exists task_shares_code_idx on task_shares (share_code);
create index if not exists task_shares_owner_idx on task_shares (owner_user_id);

alter table task_shares enable row level security;
create policy "Service role full access" on task_shares for all using (true) with check (true);

-- Lightweight click tracking — no PII, just hashed IPs
create table if not exists task_share_clicks (
  id uuid default gen_random_uuid() primary key,
  share_code text not null,
  ip_hash text,
  created_at timestamptz default now()
);

create index if not exists task_share_clicks_code_idx on task_share_clicks (share_code);

alter table task_share_clicks enable row level security;
create policy "Service role full access" on task_share_clicks for all using (true) with check (true);

-- Cache for normalized translator/help responses so repeated requests can skip AI calls
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
