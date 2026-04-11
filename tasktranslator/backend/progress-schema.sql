-- Run in Supabase SQL Editor

-- Add completion tracking to user_tasks
ALTER TABLE user_tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE user_tasks ADD COLUMN IF NOT EXISTS steps_completed INTEGER DEFAULT 0;
ALTER TABLE user_tasks ADD COLUMN IF NOT EXISTS total_steps INTEGER DEFAULT 0;

-- Index for fast progress queries
CREATE INDEX IF NOT EXISTS user_tasks_user_completed_idx ON user_tasks (user_id, completed_at);
CREATE INDEX IF NOT EXISTS user_tasks_user_steps_idx ON user_tasks (user_id, created_at);
