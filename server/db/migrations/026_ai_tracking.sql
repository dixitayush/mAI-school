-- 026: AI usage tracking and quotas
-- PRD sections 19.4, 48, 52

CREATE TABLE IF NOT EXISTS ai_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  feature TEXT NOT NULL,
  model TEXT,
  tier TEXT CHECK (tier IN ('fast', 'standard', 'reasoning')),
  input_tokens INT,
  output_tokens INT,
  latency_ms INT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'success', 'error', 'timeout')),
  estimated_cost NUMERIC(10, 6),
  prompt_version TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_requests_tenant ON ai_requests (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_requests_user ON ai_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_requests_feature ON ai_requests (feature, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ai_request_id UUID REFERENCES ai_requests(id) ON DELETE SET NULL,
  feature TEXT NOT NULL,
  model TEXT,
  source_type TEXT,
  source_ids UUID[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_generations_tenant ON ai_generations (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_generation_id UUID REFERENCES ai_generations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  rating TEXT CHECK (rating IN ('helpful', 'not_helpful', 'report')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Feature flags table
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  flag_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT feature_flags_unique UNIQUE (tenant_id, flag_name)
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_tenant ON feature_flags (tenant_id);
