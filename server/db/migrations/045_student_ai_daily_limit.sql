-- Per-school daily cap on students' AI use (AI Tutor + Study Planner).
--
-- Admins choose 5–10 attempts per student per day; the count resets at
-- midnight in the school's own time zone (institutions.timezone). Attempts
-- are counted from ai_requests, so no separate counter can drift.

ALTER TABLE institution_settings
  ADD COLUMN IF NOT EXISTS student_ai_daily_limit INT NOT NULL DEFAULT 5;
ALTER TABLE institution_settings DROP CONSTRAINT IF EXISTS institution_settings_student_ai_daily_limit_check;
ALTER TABLE institution_settings ADD CONSTRAINT institution_settings_student_ai_daily_limit_check
  CHECK (student_ai_daily_limit BETWEEN 5 AND 10);

-- The per-user, per-feature count over "today" is the hot query.
CREATE INDEX IF NOT EXISTS idx_ai_requests_user_feature
  ON ai_requests (user_id, feature, created_at DESC);
