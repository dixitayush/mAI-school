-- 036: Staff leave and substitute management
-- PRD section 37

CREATE TABLE IF NOT EXISTS leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  days_per_year INTEGER NOT NULL DEFAULT 12,
  requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
  requires_document BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  leave_type_id UUID REFERENCES leave_types(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')) DEFAULT 'pending',
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  document_file_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_institution ON leave_requests (institution_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON leave_requests (user_id, start_date);

CREATE TABLE IF NOT EXISTS substitute_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  leave_request_id UUID REFERENCES leave_requests(id),
  original_teacher_id UUID NOT NULL REFERENCES users(id),
  substitute_teacher_id UUID NOT NULL REFERENCES users(id),
  class_id UUID REFERENCES classes(id),
  date DATE NOT NULL,
  period TEXT,
  status TEXT CHECK (status IN ('assigned', 'accepted', 'declined', 'completed')) DEFAULT 'assigned',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
