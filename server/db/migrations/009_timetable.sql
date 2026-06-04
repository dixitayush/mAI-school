-- ============================================================
-- Migration 009 — Class Timetable (Feature 6)
-- Weekly recurring periods per class/section keyed by day-of-week
-- (0=Sunday .. 6=Saturday, matching JS Date.getDay()). Reads are
-- RLS-scoped to the tenant; writes go through role-checked
-- SECURITY DEFINER functions (teacher/admin/principal). The viewer
-- derives the weekday from a picked date and overlays holidays.
-- ============================================================

CREATE TABLE IF NOT EXISTS timetable_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  section TEXT,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  period_no INT NOT NULL,
  subject TEXT NOT NULL,
  teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  start_time TIME,
  end_time TIME,
  room TEXT,
  academic_session_id UUID REFERENCES academic_sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE timetable_periods IS E'@omit create,update,delete';
CREATE INDEX IF NOT EXISTS timetable_periods_class_day_idx
  ON timetable_periods (class_id, day_of_week, period_no);

ALTER TABLE timetable_periods ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON timetable_periods TO mai_graphql;
DROP POLICY IF EXISTS mai_tenant_all ON timetable_periods;
CREATE POLICY mai_tenant_all ON timetable_periods FOR ALL TO mai_graphql
  USING (rls_is_mai_admin() OR institution_id = rls_jwt_institution_id())
  WITH CHECK (rls_is_mai_admin() OR institution_id = rls_jwt_institution_id());

-- ---- Role-checked writes (teacher/admin/principal) ----
CREATE OR REPLACE FUNCTION create_timetable_period(
  p_class_id UUID,
  p_day_of_week INT,
  p_period_no INT,
  p_subject TEXT,
  p_start_time TIME DEFAULT NULL,
  p_end_time TIME DEFAULT NULL,
  p_teacher_id UUID DEFAULT NULL,
  p_room TEXT DEFAULT NULL,
  p_section TEXT DEFAULT NULL
) RETURNS timetable_periods AS $$
DECLARE
  inst UUID;
  r timetable_periods;
BEGIN
  SELECT institution_id INTO inst FROM classes WHERE id = p_class_id;
  IF inst IS NULL THEN RAISE EXCEPTION 'class not found'; END IF;
  IF NOT rls_is_mai_admin() THEN
    IF inst IS DISTINCT FROM rls_jwt_institution_id()
       OR rls_jwt_role() NOT IN ('admin', 'principal', 'teacher') THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  END IF;
  INSERT INTO timetable_periods
    (institution_id, class_id, section, day_of_week, period_no, subject, teacher_id, start_time, end_time, room)
  VALUES
    (inst, p_class_id, p_section, p_day_of_week, p_period_no, p_subject, p_teacher_id, p_start_time, p_end_time, p_room)
  RETURNING * INTO r;
  PERFORM log_audit('timetable.create', 'timetable_period', r.id,
    jsonb_build_object('class_id', p_class_id, 'day', p_day_of_week, 'period', p_period_no));
  RETURN r;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;
COMMENT ON FUNCTION create_timetable_period(UUID, INT, INT, TEXT, TIME, TIME, UUID, TEXT, TEXT)
  IS E'@name createTimetablePeriod\nCreate a timetable period';

CREATE OR REPLACE FUNCTION update_timetable_period(
  p_id UUID,
  p_day_of_week INT,
  p_period_no INT,
  p_subject TEXT,
  p_start_time TIME DEFAULT NULL,
  p_end_time TIME DEFAULT NULL,
  p_teacher_id UUID DEFAULT NULL,
  p_room TEXT DEFAULT NULL,
  p_section TEXT DEFAULT NULL
) RETURNS timetable_periods AS $$
DECLARE
  r timetable_periods;
BEGIN
  UPDATE timetable_periods SET
    day_of_week = p_day_of_week,
    period_no = p_period_no,
    subject = p_subject,
    start_time = p_start_time,
    end_time = p_end_time,
    teacher_id = p_teacher_id,
    room = p_room,
    section = p_section
  WHERE id = p_id
    AND (rls_is_mai_admin()
         OR (institution_id = rls_jwt_institution_id()
             AND rls_jwt_role() IN ('admin', 'principal', 'teacher')))
  RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM log_audit('timetable.update', 'timetable_period', r.id, NULL);
  RETURN r;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;
COMMENT ON FUNCTION update_timetable_period(UUID, INT, INT, TEXT, TIME, TIME, UUID, TEXT, TEXT)
  IS E'@name updateTimetablePeriod\nUpdate a timetable period';

CREATE OR REPLACE FUNCTION delete_timetable_period(p_id UUID) RETURNS UUID AS $$
DECLARE
  deleted UUID;
BEGIN
  DELETE FROM timetable_periods
  WHERE id = p_id
    AND (rls_is_mai_admin()
         OR (institution_id = rls_jwt_institution_id()
             AND rls_jwt_role() IN ('admin', 'principal', 'teacher')))
  RETURNING id INTO deleted;
  IF deleted IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM log_audit('timetable.delete', 'timetable_period', deleted, NULL);
  RETURN deleted;
END;
$$ LANGUAGE plpgsql VOLATILE STRICT SECURITY DEFINER;
COMMENT ON FUNCTION delete_timetable_period(UUID) IS E'@name deleteTimetablePeriod\nDelete a timetable period';
