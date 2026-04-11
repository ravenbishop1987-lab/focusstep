-- Body Double schema
-- Run this in the Supabase SQL editor.

create extension if not exists "uuid-ossp";

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text,
  timezone text default 'UTC',
  adhd_type text check (adhd_type in ('Inattentive', 'Hyperactive', 'Combined', 'Not sure')),
  availability jsonb default '[]'::jsonb,
  focus_types text[] default '{}'::text[],
  plan text not null default 'free' check (plan in ('free', 'pro', 'lifetime')),
  stripe_customer_id text,
  google_meet_email text,
  google_meet_refresh_token text,
  google_meet_connected_at timestamptz,
  streak integer not null default 0,
  total_minutes integer not null default 0,
  onboarding_done boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key default uuid_generate_v4(),
  room_id text not null,
  user1_id uuid references public.users(id) on delete set null,
  user2_id uuid references public.users(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_minutes integer,
  user1_goal text,
  user2_goal text,
  status text not null default 'active' check (status in ('active', 'completed'))
);

create table if not exists public.queue (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  goal text,
  duration_minutes integer not null default 25,
  joined_at timestamptz not null default now(),
  status text not null default 'waiting' check (status in ('waiting', 'matching', 'matched', 'expired')),
  room_id text,
  room_url text,
  partner_id uuid references public.users(id) on delete set null,
  matched_at timestamptz
);

create table if not exists public.scheduled_slots (
  id uuid primary key default uuid_generate_v4(),
  host_id uuid not null references public.users(id) on delete cascade,
  guest_id uuid references public.users(id) on delete set null,
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 25,
  status text not null default 'open' check (status in ('open', 'claimed', 'completed')),
  goal text,
  room_id text,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.queue enable row level security;
alter table public.scheduled_slots enable row level security;

drop policy if exists "Users can view own profile" on public.users;
create policy "Users can view own profile"
  on public.users for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.users;
create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.users;
create policy "Users can insert own profile"
  on public.users for insert
  with check (auth.uid() = id);

drop policy if exists "Session participants can view their sessions" on public.sessions;
create policy "Session participants can view their sessions"
  on public.sessions for select
  using (auth.uid() = user1_id or auth.uid() = user2_id);

drop policy if exists "Users can read own queue entry" on public.queue;
create policy "Users can read own queue entry"
  on public.queue for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own queue entry" on public.queue;
create policy "Users can insert own queue entry"
  on public.queue for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own queue entry" on public.queue;
create policy "Users can update own queue entry"
  on public.queue for update
  using (auth.uid() = user_id);

drop policy if exists "Authenticated users can view slots" on public.scheduled_slots;
create policy "Authenticated users can view slots"
  on public.scheduled_slots for select
  using (auth.uid() is not null);

drop policy if exists "Hosts can insert slots" on public.scheduled_slots;
create policy "Hosts can insert slots"
  on public.scheduled_slots for insert
  with check (auth.uid() = host_id);

drop policy if exists "Hosts can update own slots" on public.scheduled_slots;
create policy "Hosts can update own slots"
  on public.scheduled_slots for update
  using (auth.uid() = host_id or auth.uid() = guest_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do update
  set email = excluded.email;

  return new;
end;
$$;

create or replace function public.claim_match_pair(p_user_id uuid)
returns table (
  current_queue_id uuid,
  partner_queue_id uuid,
  partner_user_id uuid,
  status text,
  room_id text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_entry public.queue%rowtype;
  partner_entry public.queue%rowtype;
begin
  select *
  into current_entry
  from public.queue
  where user_id = p_user_id
    and public.queue.status in ('waiting', 'matching', 'matched')
  order by joined_at desc
  limit 1
  for update;

  if current_entry.id is null then
    return query
    select null::uuid, null::uuid, null::uuid, 'idle'::text, null::text;
    return;
  end if;

  if current_entry.status = 'matched' then
    return query
    select current_entry.id, null::uuid, current_entry.partner_id, 'matched'::text, current_entry.room_id;
    return;
  end if;

  if current_entry.status = 'matching' then
    return query
    select current_entry.id, null::uuid, current_entry.partner_id, 'matching'::text, current_entry.room_id;
    return;
  end if;

  select q.*
  into partner_entry
  from public.queue q
  where q.id in (
    select q2.id
    from public.queue q2
    left join public.users u on u.id = q2.user_id
    where q2.status = 'waiting'
      and q2.user_id <> p_user_id
    order by
      case when coalesce(u.plan, 'free') in ('pro', 'lifetime') then 0 else 1 end,
      q2.joined_at asc
    limit 1
  )
  for update skip locked;

  if partner_entry.id is null then
    return query
    select current_entry.id, null::uuid, null::uuid, 'waiting'::text, null::text;
    return;
  end if;

  update public.queue
  set
    status = 'matching',
    partner_id = partner_entry.user_id,
    matched_at = now()
  where id = current_entry.id;

  update public.queue
  set
    status = 'matching',
    partner_id = p_user_id,
    matched_at = now()
  where id = partner_entry.id;

  return query
  select current_entry.id, partner_entry.id, partner_entry.user_id, 'matching'::text, null::text;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create index if not exists queue_status_joined_idx on public.queue(status, joined_at);
create index if not exists queue_user_status_idx on public.queue(user_id, status);
create index if not exists sessions_room_idx on public.sessions(room_id);
create index if not exists sessions_user1_idx on public.sessions(user1_id);
create index if not exists sessions_user2_idx on public.sessions(user2_id);
create index if not exists scheduled_slots_lookup_idx on public.scheduled_slots(status, scheduled_at);
