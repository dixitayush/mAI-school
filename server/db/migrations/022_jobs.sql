-- 022: Background job system
-- PRD section 46

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'dead')),
  priority INT NOT NULL DEFAULT 0,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  last_error TEXT,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_jobs_pending ON jobs (run_at, priority DESC)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_jobs_tenant ON jobs (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs (type, status);
CREATE INDEX IF NOT EXISTS idx_jobs_cleanup ON jobs (completed_at)
  WHERE status IN ('completed', 'dead');
