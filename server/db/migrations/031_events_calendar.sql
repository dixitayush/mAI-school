-- 031: Events and calendar
-- PRD section 38

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'holiday', 'exam', 'meeting', 'parent_meeting', 'event',
    'deadline', 'sports', 'cultural', 'workshop', 'other'
  )),
  start_date DATE NOT NULL,
  end_date DATE,
  start_time TIME,
  end_time TIME,
  all_day BOOLEAN NOT NULL DEFAULT TRUE,
  location TEXT,
  visibility TEXT CHECK (visibility IN ('all', 'staff', 'students', 'parents', 'class')) DEFAULT 'all',
  class_id UUID REFERENCES classes(id),
  created_by UUID REFERENCES users(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_institution_date ON events (institution_id, start_date);
CREATE INDEX IF NOT EXISTS idx_events_class ON events (class_id) WHERE class_id IS NOT NULL;

-- School setup checklist tracking
CREATE TABLE IF NOT EXISTS setup_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id),
  CONSTRAINT setup_checklist_unique UNIQUE (institution_id, item)
);
