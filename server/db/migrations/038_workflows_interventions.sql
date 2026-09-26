-- 038: Workflow automation and intervention system
-- PRD sections 18, 31, 32

-- Workflow automation
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'attendance_below', 'fee_overdue', 'new_admission', 'result_published',
    'assignment_overdue', 'document_expired', 'absent_consecutive',
    'new_teacher', 'parent_invite_pending', 'custom'
  )),
  trigger_config JSONB NOT NULL DEFAULT '{}',
  actions JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  trigger_data JSONB DEFAULT '{}',
  actions_taken JSONB DEFAULT '[]',
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'skipped')) DEFAULT 'running',
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_workflows_institution ON workflows (institution_id, is_active);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow ON workflow_executions (workflow_id, started_at DESC);

-- Intervention system
CREATE TABLE IF NOT EXISTS interventions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  concern_type TEXT NOT NULL CHECK (concern_type IN (
    'attendance', 'academic', 'behavioral', 'social_emotional',
    'fee_related', 'health', 'other'
  )),
  title TEXT NOT NULL,
  description TEXT,
  evidence JSONB DEFAULT '[]',
  action_plan TEXT,
  owner_id UUID REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'monitoring', 'resolved', 'escalated')) DEFAULT 'open',
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  review_date DATE,
  outcome TEXT,
  created_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS intervention_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id UUID NOT NULL REFERENCES interventions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Early warning signals
CREATE TABLE IF NOT EXISTS support_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL CHECK (signal_type IN (
    'attendance_drop', 'grade_drop', 'assignment_incomplete',
    'late_submissions', 'sudden_change', 'teacher_flagged'
  )),
  severity TEXT CHECK (severity IN ('low', 'medium', 'high')) DEFAULT 'medium',
  data JSONB DEFAULT '{}',
  acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  acknowledged_by UUID REFERENCES users(id),
  intervention_id UUID REFERENCES interventions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interventions_institution ON interventions (institution_id, status);
CREATE INDEX IF NOT EXISTS idx_interventions_student ON interventions (student_id);
CREATE INDEX IF NOT EXISTS idx_interventions_owner ON interventions (owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_support_signals_institution ON support_signals (institution_id, acknowledged);
CREATE INDEX IF NOT EXISTS idx_support_signals_student ON support_signals (student_id);
