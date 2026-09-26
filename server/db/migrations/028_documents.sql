-- 028: Document vault and certificate generation
-- PRD sections 14, 15

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('student', 'teacher', 'institution', 'applicant')),
  owner_id UUID NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'admission', 'identity', 'transfer', 'medical', 'certificate',
    'report_card', 'fee_receipt', 'disciplinary', 'parent_submitted', 'other'
  )),
  title TEXT NOT NULL,
  file_id UUID,
  mime_type TEXT,
  file_size INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  verification_status TEXT CHECK (verification_status IN ('pending', 'verified', 'rejected')) DEFAULT 'pending',
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  expires_at DATE,
  metadata JSONB DEFAULT '{}',
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents (owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_documents_institution ON documents (institution_id, category);
CREATE INDEX IF NOT EXISTS idx_documents_expiry ON documents (expires_at) WHERE expires_at IS NOT NULL;

-- Document versions
CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  file_id UUID,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT doc_version_unique UNIQUE (document_id, version)
);

-- Certificate templates and generated certificates
CREATE TABLE IF NOT EXISTS certificate_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'bonafide', 'transfer', 'participation', 'achievement',
    'report_card', 'fee_receipt', 'admission_letter', 'id_card'
  )),
  name TEXT NOT NULL,
  template_html TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  template_id UUID REFERENCES certificate_templates(id),
  student_id UUID REFERENCES students(id),
  type TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  verification_code TEXT UNIQUE,
  generated_by UUID REFERENCES users(id),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_certificates_student ON certificates (student_id);
CREATE INDEX IF NOT EXISTS idx_certificates_verification ON certificates (verification_code) WHERE verification_code IS NOT NULL;
