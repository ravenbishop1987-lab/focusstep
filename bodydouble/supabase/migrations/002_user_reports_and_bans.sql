ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS banned_reason text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS banned_at timestamptz;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS banned_until timestamptz;

CREATE TABLE IF NOT EXISTS public.user_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text,
  reporter_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed')),
  review_notes text,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_reports_created_idx ON public.user_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS user_reports_status_idx ON public.user_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS user_reports_reported_user_idx ON public.user_reports (reported_user_id, created_at DESC);

ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_only_user_reports" ON public.user_reports;
CREATE POLICY "service_only_user_reports" ON public.user_reports USING (false);
