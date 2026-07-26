-- ============================================================
-- Migration 010 — Online Class Scheduling (Feature 7)
-- Teachers schedule live online sessions (Zoom/Meet/custom link) for a
-- class/section on a given date+time. Reads are RLS-scoped to the tenant;
-- writes go through role-checked SECURITY DEFINER functions.
-- ============================================================

DROP TABLE IF EXISTS online_classes CASCADE;
CREATE TABLE online_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  section TEXT,
  teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  class_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  meeting_link TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'custom'
    CHECK (provider IN ('zoom', 'meet', 'custom')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE online_classes IS E'@omit create,update,delete';
CREATE INDEX online_classes_class_date_idx
  ON online_classes (class_id, class_date);

ALTER TABLE online_classes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON online_classes TO mai_graphql;
DROP POLICY IF EXISTS mai_tenant_all ON online_classes;
CREATE POLICY mai_tenant_all ON online_classes FOR ALL TO mai_graphql
  USING (rls_is_mai_admin() OR institution_id = rls_jwt_institution_id())
  WITH CHECK (rls_is_mai_admin() OR institution_id = rls_jwt_institution_id());

-- ---- Role-checked writes (teacher/admin/principal) ----
CREATE OR REPLACE FUNCTION create_online_class(
  p_class_id UUID,
  p_title TEXT,
  p_class_date DATE,
  p_meeting_link TEXT,
  p_start_time TIME DEFAULT NULL,
  p_end_time TIME DEFAULT NULL,
  p_provider TEXT DEFAULT 'custom',
  p_description TEXT DEFAULT NULL,
  p_section TEXT DEFAULT NULL
) RETURNS online_classes AS $$
DECLARE
  inst UUID;
  r online_classes;
BEGIN
  SELECT institution_id INTO inst FROM classes WHERE id = p_class_id;
  IF inst IS NULL THEN RAISE EXCEPTION 'class not found'; END IF;
  IF NOT rls_is_mai_admin() THEN
    IF inst IS DISTINCT FROM rls_jwt_institution_id()
       OR rls_jwt_role() NOT IN ('admin', 'principal', 'teacher') THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  END IF;
  INSERT INTO online_classes
    (institution_id, class_id, section, teacher_id, title, description, class_date, start_time, end_time, meeting_link, provider)
  VALUES
    (inst, p_class_id, p_section, rls_jwt_user_id(), p_title, p_description, p_class_date, p_start_time, p_end_time, p_meeting_link, p_provider)
  RETURNING * INTO r;
  PERFORM log_audit('online_class.create', 'online_class', r.id,
    jsonb_build_object('title', p_title, 'class_id', p_class_id, 'date', p_class_date));
  RETURN r;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;
COMMENT ON FUNCTION create_online_class(UUID, TEXT, DATE, TEXT, TIME, TIME, TEXT, TEXT, TEXT)
  IS E'@name createOnlineClass\nSchedule an online class';

CREATE OR REPLACE FUNCTION update_online_class(
  p_id UUID,
  p_title TEXT,
  p_class_date DATE,
  p_meeting_link TEXT,
  p_start_time TIME DEFAULT NULL,
  p_end_time TIME DEFAULT NULL,
  p_provider TEXT DEFAULT 'custom',
  p_description TEXT DEFAULT NULL,
  p_section TEXT DEFAULT NULL
) RETURNS online_classes AS $$
DECLARE
  r online_classes;
BEGIN
  UPDATE online_classes SET
    title = p_title,
    description = p_description,
    class_date = p_class_date,
    start_time = p_start_time,
    end_time = p_end_time,
    meeting_link = p_meeting_link,
    provider = p_provider,
    section = p_section
  WHERE id = p_id
    AND (rls_is_mai_admin()
         OR (institution_id = rls_jwt_institution_id()
             AND rls_jwt_role() IN ('admin', 'principal', 'teacher')))
  RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM log_audit('online_class.update', 'online_class', r.id, NULL);
  RETURN r;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;
COMMENT ON FUNCTION update_online_class(UUID, TEXT, DATE, TEXT, TIME, TIME, TEXT, TEXT, TEXT)
  IS E'@name updateOnlineClass\nUpdate an online class';

CREATE OR REPLACE FUNCTION delete_online_class(p_id UUID) RETURNS UUID AS $$
DECLARE
  deleted UUID;
BEGIN
  DELETE FROM online_classes
  WHERE id = p_id
    AND (rls_is_mai_admin()
         OR (institution_id = rls_jwt_institution_id()
             AND rls_jwt_role() IN ('admin', 'principal', 'teacher')))
  RETURNING id INTO deleted;
  IF deleted IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM log_audit('online_class.delete', 'online_class', deleted, NULL);
  RETURN deleted;
END;
$$ LANGUAGE plpgsql VOLATILE STRICT SECURITY DEFINER;
COMMENT ON FUNCTION delete_online_class(UUID) IS E'@name deleteOnlineClass\nDelete an online class';
