-- 029: Admissions pipeline
-- PRD section 12

CREATE TABLE IF NOT EXISTS admissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  academic_year TEXT,
  applicant_name TEXT NOT NULL,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  requested_grade TEXT,
  previous_school TEXT,
  guardian_name TEXT,
  guardian_email TEXT,
  guardian_phone TEXT,
  guardian_relationship TEXT DEFAULT 'guardian',
  address TEXT,
  status TEXT NOT NULL CHECK (status IN (
    'inquiry', 'application_started', 'documents_pending',
    'submitted', 'under_review', 'interview', 'assessment',
    'selected', 'fee_pending', 'enrolled', 'rejected', 'withdrawn'
  )) DEFAULT 'inquiry',
  notes TEXT,
  score NUMERIC,
  assigned_to UUID REFERENCES users(id),
  converted_student_id UUID REFERENCES students(id),
  metadata JSONB DEFAULT '{}',
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admissions_institution_status ON admissions (institution_id, status);
CREATE INDEX IF NOT EXISTS idx_admissions_email ON admissions (institution_id, guardian_email);

-- Admission documents
CREATE TABLE IF NOT EXISTS admission_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_id UUID,
  status TEXT CHECK (status IN ('pending', 'verified', 'rejected')) DEFAULT 'pending',
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admission status history
CREATE TABLE IF NOT EXISTS admission_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
