-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action       TEXT NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    TEXT NOT NULL,
  admin_email  TEXT NOT NULL,
  target_email TEXT,
  summary      TEXT NOT NULL,
  metadata     JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_audit_logs_created_idx ON admin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_logs_entity_idx  ON admin_audit_logs (entity_type, entity_id);

ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_only_admin_audit" ON admin_audit_logs USING (false);
