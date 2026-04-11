-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS page_analytics_events (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  page_key        TEXT NOT NULL,
  path            TEXT,
  session_id      TEXT NOT NULL,
  user_id         UUID,
  user_email      TEXT,
  ip_hash         TEXT,
  referrer_domain TEXT,
  utm_source      TEXT,
  utm_medium      TEXT,
  utm_campaign    TEXT,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS page_analytics_events_page_idx ON page_analytics_events (page_key, created_at DESC);
CREATE INDEX IF NOT EXISTS page_analytics_events_session_idx ON page_analytics_events (session_id);

ALTER TABLE page_analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_only_page_analytics" ON page_analytics_events USING (false);
