-- 021: Guardian and student-guardian link tables
-- PRD sections 5.6, 11

CREATE TABLE IF NOT EXISTS guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  relationship TEXT CHECK (relationship IN ('father', 'mother', 'guardian', 'other')) DEFAULT 'guardian',
  occupation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT guardians_user_unique UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS student_guardian (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  guardian_id UUID NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT student_guardian_unique UNIQUE (student_id, guardian_id)
);

CREATE INDEX IF NOT EXISTS idx_guardians_institution ON guardians (institution_id);
CREATE INDEX IF NOT EXISTS idx_guardians_user ON guardians (user_id);
CREATE INDEX IF NOT EXISTS idx_student_guardian_student ON student_guardian (student_id);
CREATE INDEX IF NOT EXISTS idx_student_guardian_guardian ON student_guardian (guardian_id);

-- Notification preferences per user
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  push_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notification_pref_unique UNIQUE (user_id, category)
);

-- Parent digest preferences
ALTER TABLE guardians ADD COLUMN IF NOT EXISTS weekly_digest_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE guardians ADD COLUMN IF NOT EXISTS digest_day TEXT CHECK (digest_day IN ('monday', 'friday', 'sunday')) DEFAULT 'friday';
