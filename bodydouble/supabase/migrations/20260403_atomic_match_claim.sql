alter table public.queue
  drop constraint if exists queue_status_check;

alter table public.queue
  add constraint queue_status_check
  check (status in ('waiting', 'matching', 'matched', 'expired'));

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

grant execute on function public.claim_match_pair(uuid) to authenticated, service_role;
