-- ============================================================
-- Focus Step Unified Schema Migration
-- Run in Supabase SQL Editor (Body Double project)
-- Adds Task Translator tables and extends users table
-- ============================================================

-- ── Extend users table with Task Translator fields ────────────
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referral_code   text UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referred_by     text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pro_expires_at  timestamptz;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS full_name       text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at      timestamptz DEFAULT now();

-- Auto-maintain updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_updated_at ON public.users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── user_tasks ─────────────────────────────────────────────────
-- Stores each task breakdown the user has run through the translator
CREATE TABLE IF NOT EXISTS public.user_tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  task            text NOT NULL,
  result          jsonb,
  is_favorite     boolean DEFAULT false,
  completed_at    timestamptz,
  steps_completed integer DEFAULT 0,
  total_steps     integer DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_tasks_user_idx           ON public.user_tasks (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_tasks_user_completed_idx ON public.user_tasks (user_id, completed_at);
CREATE INDEX IF NOT EXISTS user_tasks_user_fav_idx       ON public.user_tasks (user_id, is_favorite) WHERE is_favorite = true;

ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own tasks" ON public.user_tasks;
CREATE POLICY "Users can manage own tasks"
  ON public.user_tasks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── translations_cache ─────────────────────────────────────────
-- Caches AI translation responses to reduce API calls and latency
CREATE TABLE IF NOT EXISTS public.translations_cache (
  cache_key    text PRIMARY KEY,
  input_type   text NOT NULL,  -- 'translate' | 'refine' | 'help-step'
  input_data   jsonb NOT NULL,
  response     jsonb NOT NULL,
  embedding    vector,         -- for semantic similarity search (optional)
  hit_count    integer DEFAULT 1,
  last_used_at timestamptz DEFAULT now(),
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS translations_cache_type_hits_idx
  ON public.translations_cache (input_type, hit_count DESC);

ALTER TABLE public.translations_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON public.translations_cache;
CREATE POLICY "Service role full access" ON public.translations_cache FOR ALL USING (true) WITH CHECK (true);

-- ── app_settings ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON public.app_settings;
CREATE POLICY "Service role full access" ON public.app_settings FOR ALL USING (true) WITH CHECK (true);

-- ── task_shares ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_shares (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id              uuid NOT NULL,
  owner_user_id        uuid NOT NULL,
  shared_with_user_id  uuid,
  share_code           text NOT NULL,
  status               text DEFAULT 'pending'
                       CHECK (status IN ('pending', 'accepted', 'completed', 'declined')),
  created_at           timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS task_shares_canonical_idx
  ON public.task_shares (task_id, owner_user_id)
  WHERE shared_with_user_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS task_shares_recipient_idx
  ON public.task_shares (task_id, shared_with_user_id)
  WHERE shared_with_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS task_shares_code_idx  ON public.task_shares (share_code);
CREATE INDEX IF NOT EXISTS task_shares_owner_idx ON public.task_shares (owner_user_id);

ALTER TABLE public.task_shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON public.task_shares;
CREATE POLICY "Service role full access" ON public.task_shares FOR ALL USING (true) WITH CHECK (true);

-- ── task_share_clicks ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_share_clicks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_code text NOT NULL,
  ip_hash    text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_share_clicks_code_idx ON public.task_share_clicks (share_code);

ALTER TABLE public.task_share_clicks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON public.task_share_clicks;
CREATE POLICY "Service role full access" ON public.task_share_clicks FOR ALL USING (true) WITH CHECK (true);

-- ── referrals ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referrals (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_email      text NOT NULL,
  referred_email      text,
  referral_code       text NOT NULL,
  status              text DEFAULT 'clicked',
  clicked_at          timestamptz DEFAULT now(),
  signed_up_at        timestamptz,
  converted_at        timestamptz,
  purchased_plan      text,
  purchase_amount     numeric,
  reward_type         text,
  reward_value        integer,
  reward_issued_at    timestamptz,
  reward_reversed_at  timestamptz,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_only_referrals" ON public.referrals;
CREATE POLICY "service_only_referrals" ON public.referrals USING (false);

-- ── referral_events ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referral_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code  text NOT NULL,
  referrer_email text,
  referred_email text,
  event_type     text NOT NULL,
  metadata       jsonb,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE public.referral_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_only_events" ON public.referral_events;
CREATE POLICY "service_only_events" ON public.referral_events USING (false);

-- ── payments ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email               text NOT NULL,
  plan_type           text NOT NULL,
  amount              numeric NOT NULL,
  billing_type        text,
  payment_status      text DEFAULT 'succeeded',
  external_payment_id text UNIQUE,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_only_payments" ON public.payments;
CREATE POLICY "service_only_payments" ON public.payments USING (false);

-- ── referral_reward_rules ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referral_reward_rules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  referrer_plan text NOT NULL CHECK (referrer_plan IN ('free','monthly','lifetime','any')),
  trigger_plan  text NOT NULL CHECK (trigger_plan  IN ('monthly','lifetime','any')),
  recipient     text NOT NULL DEFAULT 'referrer' CHECK (recipient IN ('referrer','referred','both')),
  reward_type   text NOT NULL DEFAULT 'pro_days'  CHECK (reward_type IN ('pro_days','none')),
  reward_value  integer NOT NULL DEFAULT 0,
  auto_issue    boolean NOT NULL DEFAULT false,
  enabled       boolean NOT NULL DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

INSERT INTO public.referral_reward_rules
  (name, referrer_plan, trigger_plan, recipient, reward_type, reward_value, auto_issue, enabled)
VALUES
  ('Free referrer → any paid plan',     'free',     'any', 'referrer', 'pro_days', 14, true,  true),
  ('Pro referrer → any paid plan',      'monthly',  'any', 'referrer', 'pro_days', 30, true,  true),
  ('Lifetime referrer → any paid plan', 'lifetime', 'any', 'referrer', 'none',      0, false, true)
ON CONFLICT DO NOTHING;

ALTER TABLE public.referral_reward_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_only_rules" ON public.referral_reward_rules;
CREATE POLICY "service_only_rules" ON public.referral_reward_rules USING (false);

-- ── referral_rewards ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id             uuid REFERENCES public.referrals(id) ON DELETE CASCADE,
  rule_id                 uuid REFERENCES public.referral_reward_rules(id),
  reward_recipient_email  text NOT NULL,
  reward_recipient_type   text NOT NULL DEFAULT 'referrer'
                          CHECK (reward_recipient_type IN ('referrer','referred')),
  reward_type             text NOT NULL DEFAULT 'pro_days',
  reward_value            integer NOT NULL DEFAULT 0,
  status                  text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','ready_to_issue','issued','reversed','rejected','none')),
  issued_at               timestamptz,
  issued_by_admin_email   text,
  reversed_at             timestamptz,
  reversed_by_admin_email text,
  notes                   text,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS referral_rewards_referral_idx  ON public.referral_rewards (referral_id);
CREATE INDEX IF NOT EXISTS referral_rewards_status_idx    ON public.referral_rewards (status);
CREATE INDEX IF NOT EXISTS referral_rewards_recipient_idx ON public.referral_rewards (reward_recipient_email);

ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_only_rewards" ON public.referral_rewards;
CREATE POLICY "service_only_rewards" ON public.referral_rewards USING (false);

-- ── admin_audit_logs ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   text NOT NULL,
  admin_email text NOT NULL,
  target_email text,
  summary     text NOT NULL,
  metadata    jsonb,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_logs_created_idx
  ON public.admin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_logs_entity_idx
  ON public.admin_audit_logs (entity_type, entity_id);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_only_admin_audit" ON public.admin_audit_logs;
CREATE POLICY "service_only_admin_audit" ON public.admin_audit_logs USING (false);

-- ── page_analytics_events ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.page_analytics_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key        text NOT NULL,
  path            text,
  session_id      text NOT NULL,
  user_id         uuid,
  user_email      text,
  ip_hash         text,
  referrer_domain text,
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  user_agent      text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS page_analytics_page_idx
  ON public.page_analytics_events (page_key, created_at DESC);
CREATE INDEX IF NOT EXISTS page_analytics_session_idx
  ON public.page_analytics_events (session_id);

ALTER TABLE public.page_analytics_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_only_page_analytics" ON public.page_analytics_events;
CREATE POLICY "service_only_page_analytics" ON public.page_analytics_events USING (false);

-- ── Data migration helper ──────────────────────────────────────
-- After running this migration, run the following to merge existing
-- Task Translator customer records into the unified users table.
-- Execute only once, after both services point to this Supabase project.
--
-- INSERT INTO public.users (id, email, plan, stripe_customer_id, referral_code, referred_by, pro_expires_at, full_name, created_at)
-- SELECT
--   gen_random_uuid(),
--   c.email,
--   CASE WHEN c.is_pro = true AND c.plan = 'lifetime' THEN 'lifetime'
--        WHEN c.is_pro = true THEN 'pro'
--        ELSE 'free' END,
--   c.stripe_customer_id,
--   c.referral_code,
--   c.referred_by,
--   c.pro_expires_at,
--   c.full_name,
--   c.created_at
-- FROM old_customers_import c
-- ON CONFLICT (email) DO UPDATE SET
--   plan             = EXCLUDED.plan,
--   stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, public.users.stripe_customer_id),
--   referral_code    = COALESCE(EXCLUDED.referral_code, public.users.referral_code),
--   referred_by      = COALESCE(EXCLUDED.referred_by, public.users.referred_by),
--   pro_expires_at   = COALESCE(EXCLUDED.pro_expires_at, public.users.pro_expires_at);
