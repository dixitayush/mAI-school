-- 019: Session management and refresh token rotation
-- PRD sections 8.1, 8.4

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  token_family UUID NOT NULL DEFAULT gen_random_uuid(),
  device_info TEXT,
  ip_address TEXT,
  user_agent TEXT,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions (user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_token_family ON user_sessions (token_family);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions (expires_at) WHERE revoked_at IS NULL;

-- Cleanup expired sessions periodically
CREATE INDEX IF NOT EXISTS idx_sessions_cleanup ON user_sessions (expires_at) WHERE revoked_at IS NULL;
