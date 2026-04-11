alter table public.users
  add column if not exists google_meet_email text,
  add column if not exists google_meet_refresh_token text,
  add column if not exists google_meet_connected_at timestamptz;
