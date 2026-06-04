-- ============================================================
-- Migration 001 — Foundations (cross-cutting building blocks)
-- Idempotent & additive: safe to run repeatedly.
-- Run AFTER schema.sql + rls_setup.sql (see db/init.js / db/migrate.js).
-- ============================================================

-- ---- JWT helpers (extend the ones in schema.sql) ----
CREATE OR REPLACE FUNCTION rls_jwt_role() RETURNS text AS $$
  SELECT NULLIF(btrim(COALESCE(current_setting('jwt.claims.role', true), '')), '');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION rls_jwt_user_id() RETURNS uuid AS $$
  SELECT NULLIF(btrim(COALESCE(current_setting('jwt.claims.user_id', true), '')), '')::uuid;
$$ LANGUAGE sql STABLE;

-- ============================================================
-- 1. files — binary storage in Postgres (tenant-isolated)
--    Served only via REST /api/files/:id (never over GraphQL).
-- ============================================================
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'generic',
  filename TEXT,
  mime_type TEXT NOT NULL,
  byte_size INT NOT NULL,
  data BYTEA NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE files IS E'@omit';
CREATE INDEX IF NOT EXISTS files_institution_idx ON files (institution_id);

-- ============================================================
-- 2. audit_log — critical-action trail (admin/principal read)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE audit_log IS E'@omit create,update,delete';
CREATE INDEX IF NOT EXISTS audit_log_institution_idx ON audit_log (institution_id, created_at DESC);

-- SECURITY DEFINER audit writer for GraphQL/definer contexts (uses JWT claims).
-- REST routes insert directly with explicit institution_id (see lib/audit.js).
CREATE OR REPLACE FUNCTION log_audit(
  p_action TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
) RETURNS void AS $$
  INSERT INTO audit_log (institution_id, actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (rls_jwt_institution_id(), rls_jwt_user_id(), p_action, p_entity_type, p_entity_id, p_metadata);
$$ LANGUAGE sql VOLATILE SECURITY DEFINER;
COMMENT ON FUNCTION log_audit(TEXT, TEXT, UUID, JSONB) IS E'@omit';

-- ============================================================
-- 3. institution_settings — per-tenant configuration
-- ============================================================
CREATE TABLE IF NOT EXISTS institution_settings (
  institution_id UUID PRIMARY KEY REFERENCES institutions(id) ON DELETE CASCADE,
  attendance_threshold NUMERIC NOT NULL DEFAULT 75,
  fee_block_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  fee_threshold NUMERIC NOT NULL DEFAULT 0,
  academic_year_start DATE,
  academic_year_end DATE,
  weekend_days INT[] NOT NULL DEFAULT '{0,6}', -- dow: 0=Sun .. 6=Sat
  principal_signature_file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  extra JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Writes only via upsert fn (role-checked); GraphQL exposes read + the fn.
COMMENT ON TABLE institution_settings IS E'@omit create,update,delete';

CREATE OR REPLACE FUNCTION upsert_institution_settings(
  p_institution_id UUID,
  p_attendance_threshold NUMERIC DEFAULT NULL,
  p_fee_block_enabled BOOLEAN DEFAULT NULL,
  p_fee_threshold NUMERIC DEFAULT NULL,
  p_academic_year_start DATE DEFAULT NULL,
  p_academic_year_end DATE DEFAULT NULL
) RETURNS institution_settings AS $$
DECLARE
  r institution_settings;
BEGIN
  IF NOT rls_is_mai_admin() THEN
    IF rls_jwt_institution_id() IS NULL
       OR p_institution_id IS DISTINCT FROM rls_jwt_institution_id()
       OR rls_jwt_role() NOT IN ('admin', 'principal') THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  END IF;
  INSERT INTO institution_settings (
    institution_id, attendance_threshold, fee_block_enabled, fee_threshold,
    academic_year_start, academic_year_end
  )
  VALUES (
    p_institution_id,
    COALESCE(p_attendance_threshold, 75),
    COALESCE(p_fee_block_enabled, TRUE),
    COALESCE(p_fee_threshold, 0),
    p_academic_year_start, p_academic_year_end
  )
  ON CONFLICT (institution_id) DO UPDATE SET
    attendance_threshold = COALESCE(p_attendance_threshold, institution_settings.attendance_threshold),
    fee_block_enabled    = COALESCE(p_fee_block_enabled, institution_settings.fee_block_enabled),
    fee_threshold        = COALESCE(p_fee_threshold, institution_settings.fee_threshold),
    academic_year_start  = COALESCE(p_academic_year_start, institution_settings.academic_year_start),
    academic_year_end    = COALESCE(p_academic_year_end, institution_settings.academic_year_end),
    updated_at = NOW()
  RETURNING * INTO r;
  RETURN r;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;
COMMENT ON FUNCTION upsert_institution_settings(UUID, NUMERIC, BOOLEAN, NUMERIC, DATE, DATE)
  IS E'@name upsertInstitutionSettings\nCreate or update institution settings';

-- ============================================================
-- 4. academic_sessions — academic years/terms per tenant
-- ============================================================
CREATE TABLE IF NOT EXISTS academic_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE academic_sessions IS E'@omit create,update,delete';

CREATE OR REPLACE FUNCTION upsert_academic_session(
  p_institution_id UUID,
  p_name TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_is_current BOOLEAN DEFAULT FALSE,
  p_id UUID DEFAULT NULL
) RETURNS academic_sessions AS $$
DECLARE
  r academic_sessions;
BEGIN
  IF NOT rls_is_mai_admin() THEN
    IF rls_jwt_institution_id() IS NULL
       OR p_institution_id IS DISTINCT FROM rls_jwt_institution_id()
       OR rls_jwt_role() NOT IN ('admin', 'principal') THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  END IF;
  IF p_is_current THEN
    UPDATE academic_sessions SET is_current = FALSE WHERE institution_id = p_institution_id;
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO academic_sessions (institution_id, name, start_date, end_date, is_current)
    VALUES (p_institution_id, p_name, p_start_date, p_end_date, p_is_current)
    RETURNING * INTO r;
  ELSE
    UPDATE academic_sessions
    SET name = p_name, start_date = p_start_date, end_date = p_end_date, is_current = p_is_current
    WHERE id = p_id AND institution_id = p_institution_id
    RETURNING * INTO r;
    IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  END IF;
  RETURN r;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;
COMMENT ON FUNCTION upsert_academic_session(UUID, TEXT, DATE, DATE, BOOLEAN, UUID)
  IS E'@name upsertAcademicSession\nCreate or update an academic session';

-- ============================================================
-- 5. students — roll number, section, photo
-- ============================================================
ALTER TABLE students ADD COLUMN IF NOT EXISTS roll_number TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS section TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS photo_file_id UUID REFERENCES files(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS students_roll_per_class
  ON students (class_id, roll_number)
  WHERE roll_number IS NOT NULL;

-- ============================================================
-- RLS + grants for new tenant tables
-- ============================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['files', 'audit_log', 'institution_settings', 'academic_sessions']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO mai_graphql', t);
    EXECUTE format('DROP POLICY IF EXISTS mai_tenant_all ON public.%I', t);
  END LOOP;
END $$;

-- files: tenant-scoped (mutated only via REST as table owner; policy still set for safety)
CREATE POLICY mai_tenant_all ON files FOR ALL TO mai_graphql
  USING (rls_is_mai_admin() OR institution_id = rls_jwt_institution_id())
  WITH CHECK (rls_is_mai_admin() OR institution_id = rls_jwt_institution_id());

-- audit_log: read for admin/principal of the tenant only
CREATE POLICY mai_tenant_all ON audit_log FOR ALL TO mai_graphql
  USING (
    rls_is_mai_admin()
    OR (institution_id = rls_jwt_institution_id() AND rls_jwt_role() IN ('admin', 'principal'))
  )
  WITH CHECK (
    rls_is_mai_admin()
    OR (institution_id = rls_jwt_institution_id() AND rls_jwt_role() IN ('admin', 'principal'))
  );

-- institution_settings: any tenant member may read; writes via fn only
CREATE POLICY mai_tenant_all ON institution_settings FOR ALL TO mai_graphql
  USING (rls_is_mai_admin() OR institution_id = rls_jwt_institution_id())
  WITH CHECK (rls_is_mai_admin() OR institution_id = rls_jwt_institution_id());

CREATE POLICY mai_tenant_all ON academic_sessions FOR ALL TO mai_graphql
  USING (rls_is_mai_admin() OR institution_id = rls_jwt_institution_id())
  WITH CHECK (rls_is_mai_admin() OR institution_id = rls_jwt_institution_id());

-- ============================================================
-- Seed: default settings row for every existing institution
-- ============================================================
INSERT INTO institution_settings (institution_id)
SELECT id FROM institutions
ON CONFLICT (institution_id) DO NOTHING;
