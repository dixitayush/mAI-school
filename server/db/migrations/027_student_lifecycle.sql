-- 027: Student lifecycle tracking
-- PRD section 13

CREATE TABLE IF NOT EXISTS student_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'admission', 'enrollment', 'class_change', 'promotion',
    'transfer', 'withdrawal', 'graduation', 'disciplinary',
    'award', 'intervention', 'document', 'note'
  )),
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  recorded_by UUID REFERENCES users(id),
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_timeline_student ON student_timeline (student_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_student_timeline_institution ON student_timeline (institution_id, event_type);

-- Student status tracking
ALTER TABLE students ADD COLUMN IF NOT EXISTS lifecycle_status TEXT
  CHECK (lifecycle_status IN ('inquiry', 'admitted', 'enrolled', 'promoted', 'transferred', 'withdrawn', 'graduated', 'alumni'))
  DEFAULT 'enrolled';
ALTER TABLE students ADD COLUMN IF NOT EXISTS admission_number TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS admission_date DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other'));
ALTER TABLE students ADD COLUMN IF NOT EXISTS blood_group TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS emergency_contact TEXT;

-- Student portfolio/achievements
CREATE TABLE IF NOT EXISTS student_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('academic', 'sports', 'arts', 'leadership', 'community', 'competition', 'other')),
  title TEXT NOT NULL,
  description TEXT,
  award_date DATE,
  certificate_file_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_achievements_student ON student_achievements (student_id);
