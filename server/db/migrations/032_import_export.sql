-- 032: Import/export center
-- PRD section 42

CREATE TABLE IF NOT EXISTS data_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('students', 'teachers', 'parents', 'classes', 'fees', 'marks', 'attendance')),
  file_id UUID,
  status TEXT NOT NULL CHECK (status IN ('uploaded', 'validating', 'preview', 'importing', 'completed', 'failed')) DEFAULT 'uploaded',
  total_rows INTEGER DEFAULT 0,
  imported_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]',
  uploaded_by UUID NOT NULL REFERENCES users(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS data_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('csv', 'xlsx', 'pdf')) DEFAULT 'csv',
  filters JSONB DEFAULT '{}',
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  file_id UUID,
  requested_by UUID NOT NULL REFERENCES users(id),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_imports_institution ON data_imports (institution_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_exports_institution ON data_exports (institution_id, created_at DESC);
