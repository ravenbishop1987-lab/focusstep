-- Run this in Supabase SQL Editor

-- Add referral fields to customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS referred_by TEXT REFERENCES customers(email);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS pro_expires_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Referrals table — one row per referral relationship
CREATE TABLE IF NOT EXISTS referrals (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_email      TEXT NOT NULL,
  referred_email      TEXT,
  referral_code       TEXT NOT NULL,
  status              TEXT DEFAULT 'clicked',
  clicked_at          TIMESTAMPTZ DEFAULT NOW(),
  signed_up_at        TIMESTAMPTZ,
  converted_at        TIMESTAMPTZ,
  purchased_plan      TEXT,
  purchase_amount     NUMERIC,
  reward_type         TEXT,
  reward_value        INTEGER,
  reward_issued_at    TIMESTAMPTZ,
  reward_reversed_at  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Referral events log — append-only audit trail
CREATE TABLE IF NOT EXISTS referral_events (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referral_code   TEXT NOT NULL,
  referrer_email  TEXT,
  referred_email  TEXT,
  event_type      TEXT NOT NULL,
  metadata        JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Payments table — idempotency via external_payment_id
CREATE TABLE IF NOT EXISTS payments (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email               TEXT NOT NULL,
  plan_type           TEXT NOT NULL,
  amount              NUMERIC NOT NULL,
  billing_type        TEXT,
  payment_status      TEXT DEFAULT 'succeeded',
  external_payment_id TEXT UNIQUE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Row level security
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Only service role can write (backend handles all writes)
CREATE POLICY "service_only_referrals" ON referrals USING (false);
CREATE POLICY "service_only_events" ON referral_events USING (false);
CREATE POLICY "service_only_payments" ON payments USING (false);
