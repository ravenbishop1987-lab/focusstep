-- Run in Supabase SQL Editor

-- ── Reward rules: admin-defined per referrer plan + trigger ───────────────────
CREATE TABLE IF NOT EXISTS referral_reward_rules (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name            TEXT NOT NULL,
  referrer_plan   TEXT NOT NULL CHECK (referrer_plan IN ('free','monthly','lifetime','any')),
  trigger_plan    TEXT NOT NULL CHECK (trigger_plan IN ('monthly','lifetime','any')),
  recipient       TEXT NOT NULL DEFAULT 'referrer' CHECK (recipient IN ('referrer','referred','both')),
  reward_type     TEXT NOT NULL DEFAULT 'pro_days' CHECK (reward_type IN ('pro_days','none')),
  reward_value    INTEGER NOT NULL DEFAULT 0,
  auto_issue      BOOLEAN NOT NULL DEFAULT false,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default rules
INSERT INTO referral_reward_rules (name, referrer_plan, trigger_plan, recipient, reward_type, reward_value, auto_issue, enabled)
VALUES
  ('Free referrer → any paid plan',      'free',     'any', 'referrer', 'pro_days', 14, true,  true),
  ('Pro referrer → any paid plan',       'monthly',  'any', 'referrer', 'pro_days', 30, true,  true),
  ('Lifetime referrer → any paid plan',  'lifetime', 'any', 'referrer', 'none',      0, false, true)
ON CONFLICT DO NOTHING;

-- ── Individual reward instances: one per referral ─────────────────────────────
CREATE TABLE IF NOT EXISTS referral_rewards (
  id                       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referral_id              UUID REFERENCES referrals(id) ON DELETE CASCADE,
  rule_id                  UUID REFERENCES referral_reward_rules(id),
  reward_recipient_email   TEXT NOT NULL,
  reward_recipient_type    TEXT NOT NULL DEFAULT 'referrer' CHECK (reward_recipient_type IN ('referrer','referred')),
  reward_type              TEXT NOT NULL DEFAULT 'pro_days',
  reward_value             INTEGER NOT NULL DEFAULT 0,
  status                   TEXT NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','ready_to_issue','issued','reversed','rejected','none')),
  issued_at                TIMESTAMPTZ,
  issued_by_admin_email    TEXT,
  reversed_at              TIMESTAMPTZ,
  reversed_by_admin_email  TEXT,
  notes                    TEXT,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS referral_rewards_referral_idx ON referral_rewards (referral_id);
CREATE INDEX IF NOT EXISTS referral_rewards_status_idx   ON referral_rewards (status);
CREATE INDEX IF NOT EXISTS referral_rewards_recipient_idx ON referral_rewards (reward_recipient_email);

-- RLS
ALTER TABLE referral_reward_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_rewards       ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_only_rules"   ON referral_reward_rules USING (false);
CREATE POLICY "service_only_rewards" ON referral_rewards       USING (false);
