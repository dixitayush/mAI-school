-- ============================================================
-- Migration 002 — Holiday Calendar (Feature 9)
-- Holidays feed working-day / attendance / eligibility math (Feature 2).
-- ============================================================

DROP TABLE IF EXISTS holidays CASCADE;
CREATE TABLE holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  type TEXT NOT NULL DEFAULT 'school'
    CHECK (type IN ('national', 'school', 'festival', 'emergency')),
  description TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT holidays_date_order CHECK (end_date >= start_date)
);
COMMENT ON TABLE holidays IS E'@omit create,update,delete';
CREATE INDEX holidays_inst_date_idx ON holidays (institution_id, start_date, end_date);

ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON holidays TO mai_graphql;
DROP POLICY IF EXISTS mai_tenant_all ON holidays;
-- Everyone in the tenant can read holidays; writes go through role-checked fns.
CREATE POLICY mai_tenant_all ON holidays FOR ALL TO mai_graphql
  USING (rls_is_mai_admin() OR institution_id = rls_jwt_institution_id())
  WITH CHECK (rls_is_mai_admin() OR institution_id = rls_jwt_institution_id());

-- ---- Role-checked CRUD (admin/principal) ----
CREATE OR REPLACE FUNCTION create_holiday(
  p_institution_id UUID,
  p_title TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_type TEXT DEFAULT 'school',
  p_description TEXT DEFAULT NULL
) RETURNS holidays AS $$
DECLARE
  r holidays;
BEGIN
  IF NOT rls_is_mai_admin() THEN
    IF rls_jwt_institution_id() IS NULL
       OR p_institution_id IS DISTINCT FROM rls_jwt_institution_id()
       OR rls_jwt_role() NOT IN ('admin', 'principal') THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  END IF;
  INSERT INTO holidays (institution_id, title, start_date, end_date, type, description, created_by)
  VALUES (p_institution_id, p_title, p_start_date, COALESCE(p_end_date, p_start_date), p_type,
          p_description, rls_jwt_user_id())
  RETURNING * INTO r;
  PERFORM log_audit('holiday.create', 'holiday', r.id,
    jsonb_build_object('title', p_title, 'start', p_start_date, 'end', p_end_date));
  RETURN r;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;
COMMENT ON FUNCTION create_holiday(UUID, TEXT, DATE, DATE, TEXT, TEXT)
  IS E'@name createHoliday\nCreate a holiday';

CREATE OR REPLACE FUNCTION update_holiday(
  p_id UUID,
  p_title TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_type TEXT DEFAULT 'school',
  p_description TEXT DEFAULT NULL
) RETURNS holidays AS $$
DECLARE
  r holidays;
BEGIN
  UPDATE holidays SET
    title = p_title,
    start_date = p_start_date,
    end_date = COALESCE(p_end_date, p_start_date),
    type = p_type,
    description = p_description
  WHERE id = p_id
    AND (rls_is_mai_admin()
         OR (institution_id = rls_jwt_institution_id() AND rls_jwt_role() IN ('admin', 'principal')))
  RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM log_audit('holiday.update', 'holiday', r.id, NULL);
  RETURN r;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;
COMMENT ON FUNCTION update_holiday(UUID, TEXT, DATE, DATE, TEXT, TEXT)
  IS E'@name updateHoliday\nUpdate a holiday';

CREATE OR REPLACE FUNCTION delete_holiday(p_id UUID) RETURNS UUID AS $$
DECLARE
  deleted UUID;
BEGIN
  DELETE FROM holidays
  WHERE id = p_id
    AND (rls_is_mai_admin()
         OR (institution_id = rls_jwt_institution_id() AND rls_jwt_role() IN ('admin', 'principal')))
  RETURNING id INTO deleted;
  IF deleted IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM log_audit('holiday.delete', 'holiday', deleted, NULL);
  RETURN deleted;
END;
$$ LANGUAGE plpgsql VOLATILE STRICT SECURITY DEFINER;
COMMENT ON FUNCTION delete_holiday(UUID) IS E'@name deleteHoliday\nDelete a holiday';
