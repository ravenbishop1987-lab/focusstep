-- Friends & friend sessions migration
-- Run this in the Supabase SQL editor after schema.sql

create table if not exists public.friends (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.users(id) on delete cascade,
  friend_id  uuid not null references public.users(id) on delete cascade,
  status     text not null default 'pending'
               check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  -- prevent duplicate rows in either direction
  constraint friends_unique unique (user_id, friend_id),
  constraint friends_no_self  check (user_id <> friend_id)
);

alter table public.friends enable row level security;

-- Sender can see their own outgoing requests
drop policy if exists "Users can see own friend rows" on public.friends;
create policy "Users can see own friend rows"
  on public.friends for select
  using (auth.uid() = user_id or auth.uid() = friend_id);

-- Anyone authed can send a friend request (insert)
drop policy if exists "Users can send friend requests" on public.friends;
create policy "Users can send friend requests"
  on public.friends for insert
  with check (auth.uid() = user_id);

-- Only the recipient can accept/decline; sender can delete (cancel)
drop policy if exists "Recipient can respond to requests" on public.friends;
create policy "Recipient can respond to requests"
  on public.friends for update
  using (auth.uid() = friend_id or auth.uid() = user_id);

drop policy if exists "Users can remove friendships" on public.friends;
create policy "Users can remove friendships"
  on public.friends for delete
  using (auth.uid() = user_id or auth.uid() = friend_id);

create index if not exists friends_user_idx   on public.friends(user_id,   status);
create index if not exists friends_friend_idx on public.friends(friend_id, status);
