-- 025: Enhanced audit logging
-- PRD sections 9, 10

ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS severity TEXT
  CHECK (severity IS NULL OR severity IN ('info', 'warning', 'critical')) DEFAULT 'info';

CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log (entity_type, entity_id);
