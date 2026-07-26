-- ============================================================
-- Migration 007 — Assignment Management (Feature 5)
-- Teachers create assignments for a class/section (optional file attachment
-- via the shared `files` table); students submit (optional file) and get
-- graded. Writes go through role/tenant-checked SECURITY DEFINER functions;
-- reads are RLS-scoped (students see only their own submissions).
-- ============================================================

DROP TABLE IF EXISTS assignment_submissions CASCADE;
DROP TABLE IF EXISTS assignments CASCADE;
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  section TEXT,
  teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE assignments IS E'@omit create,update,delete';
CREATE INDEX assignments_class_idx ON assignments (class_id, due_date);

CREATE TABLE assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  comment TEXT,
  file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  grade TEXT,
  remarks TEXT,
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'late', 'graded')),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT assignment_submissions_uniq UNIQUE (assignment_id, student_id)
);
COMMENT ON TABLE assignment_submissions IS E'@omit create,update,delete';
CREATE INDEX assignment_submissions_a_idx ON assignment_submissions (assignment_id);

-- ---- RLS ----
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON assignments TO mai_graphql;
DROP POLICY IF EXISTS mai_tenant_all ON assignments;
CREATE POLICY mai_tenant_all ON assignments FOR ALL TO mai_graphql
  USING (rls_is_mai_admin() OR institution_id = rls_jwt_institution_id())
  WITH CHECK (rls_is_mai_admin() OR institution_id = rls_jwt_institution_id());

ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON assignment_submissions TO mai_graphql;
DROP POLICY IF EXISTS mai_tenant_all ON assignment_submissions;
-- Staff see all tenant submissions; a student sees only their own.
CREATE POLICY mai_tenant_all ON assignment_submissions FOR ALL TO mai_graphql
  USING (
    rls_is_mai_admin() OR EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = assignment_submissions.assignment_id
        AND a.institution_id = rls_jwt_institution_id()
        AND (
          rls_jwt_role() IN ('admin', 'principal', 'teacher')
          OR EXISTS (
            SELECT 1 FROM students s
            WHERE s.id = assignment_submissions.student_id
              AND s.user_id = rls_jwt_user_id()
          )
        )
    )
  )
  WITH CHECK (
    rls_is_mai_admin() OR EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = assignment_submissions.assignment_id
        AND a.institution_id = rls_jwt_institution_id()
    )
  );

-- ---- Role/tenant-checked writes ----
CREATE OR REPLACE FUNCTION create_assignment(
  p_class_id UUID,
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_due_date DATE DEFAULT NULL,
  p_section TEXT DEFAULT NULL,
  p_file_id UUID DEFAULT NULL
) RETURNS assignments AS $$
DECLARE
  inst UUID;
  r assignments;
BEGIN
  SELECT institution_id INTO inst FROM classes WHERE id = p_class_id;
  IF inst IS NULL THEN RAISE EXCEPTION 'class not found'; END IF;
  IF NOT rls_is_mai_admin() THEN
    IF inst IS DISTINCT FROM rls_jwt_institution_id()
       OR rls_jwt_role() NOT IN ('admin', 'principal', 'teacher') THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  END IF;
  INSERT INTO assignments (institution_id, class_id, section, teacher_id, title, description, file_id, due_date)
  VALUES (inst, p_class_id, p_section, rls_jwt_user_id(), p_title, p_description, p_file_id, p_due_date)
  RETURNING * INTO r;
  PERFORM log_audit('assignment.create', 'assignment', r.id,
    jsonb_build_object('title', p_title, 'class_id', p_class_id));
  RETURN r;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;
COMMENT ON FUNCTION create_assignment(UUID, TEXT, TEXT, DATE, TEXT, UUID)
  IS E'@name createAssignment\nCreate an assignment';

CREATE OR REPLACE FUNCTION submit_assignment(
  p_assignment_id UUID,
  p_comment TEXT DEFAULT NULL,
  p_file_id UUID DEFAULT NULL
) RETURNS assignment_submissions AS $$
DECLARE
  sid UUID;
  due DATE;
  st TEXT;
  r assignment_submissions;
BEGIN
  -- Resolve the calling student (parents use student credentials).
  SELECT s.id INTO sid FROM students s WHERE s.user_id = rls_jwt_user_id();
  IF sid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT a.due_date INTO due FROM assignments a
  WHERE a.id = p_assignment_id AND a.institution_id = rls_jwt_institution_id();
  IF NOT FOUND THEN RAISE EXCEPTION 'assignment not found'; END IF;

  st := CASE WHEN due IS NOT NULL AND CURRENT_DATE > due THEN 'late' ELSE 'submitted' END;

  INSERT INTO assignment_submissions (assignment_id, student_id, comment, file_id, status)
  VALUES (p_assignment_id, sid, p_comment, p_file_id, st)
  ON CONFLICT (assignment_id, student_id)
  DO UPDATE SET comment = EXCLUDED.comment, file_id = EXCLUDED.file_id,
                status = EXCLUDED.status, submitted_at = NOW()
  RETURNING * INTO r;
  RETURN r;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;
COMMENT ON FUNCTION submit_assignment(UUID, TEXT, UUID)
  IS E'@name submitAssignment\nSubmit an assignment';

CREATE OR REPLACE FUNCTION grade_submission(
  p_submission_id UUID,
  p_grade TEXT,
  p_remarks TEXT DEFAULT NULL
) RETURNS assignment_submissions AS $$
DECLARE
  r assignment_submissions;
BEGIN
  UPDATE assignment_submissions sub
  SET grade = p_grade, remarks = p_remarks, status = 'graded'
  WHERE sub.id = p_submission_id
    AND EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = sub.assignment_id
        AND (rls_is_mai_admin()
             OR (a.institution_id = rls_jwt_institution_id()
                 AND rls_jwt_role() IN ('admin', 'principal', 'teacher')))
    )
  RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM log_audit('assignment.grade', 'assignment_submission', r.id,
    jsonb_build_object('grade', p_grade));
  RETURN r;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;
COMMENT ON FUNCTION grade_submission(UUID, TEXT, TEXT)
  IS E'@name gradeSubmission\nGrade a submission';
