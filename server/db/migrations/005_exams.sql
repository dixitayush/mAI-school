-- ============================================================
-- Migration 005 — Exam Marks, Grades, Rank & Pass/Fail (Feature 3)
-- exam_type / passing_marks / results uniqueness live in schema.sql.
-- This migration only installs grade helpers and marks upserts.
-- ============================================================

CREATE OR REPLACE FUNCTION grade_for(p_pct NUMERIC) RETURNS TEXT AS $$
  SELECT CASE
    WHEN p_pct >= 90 THEN 'A+'
    WHEN p_pct >= 80 THEN 'A'
    WHEN p_pct >= 70 THEN 'B+'
    WHEN p_pct >= 60 THEN 'B'
    WHEN p_pct >= 50 THEN 'C'
    WHEN p_pct >= 40 THEN 'D'
    ELSE 'F'
  END;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION upsert_result(
  p_exam_id UUID,
  p_student_id UUID,
  p_marks INT,
  p_feedback TEXT DEFAULT NULL
) RETURNS results AS $$
DECLARE
  inst UUID;
  total INT;
  r results;
BEGIN
  SELECT c.institution_id, e.total_marks INTO inst, total
  FROM exams e JOIN classes c ON c.id = e.class_id
  WHERE e.id = p_exam_id;

  IF inst IS NULL THEN RAISE EXCEPTION 'exam not found'; END IF;

  IF NOT rls_is_mai_admin() THEN
    IF inst IS DISTINCT FROM rls_jwt_institution_id()
       OR rls_jwt_role() NOT IN ('admin', 'principal', 'teacher') THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  END IF;

  IF p_marks < 0 OR (total IS NOT NULL AND p_marks > total) THEN
    RAISE EXCEPTION 'marks % out of range (0..%)', p_marks, total;
  END IF;

  INSERT INTO results (exam_id, student_id, marks_obtained, grade, feedback)
  VALUES (
    p_exam_id, p_student_id, p_marks,
    grade_for(CASE WHEN total > 0 THEN (p_marks::numeric / total) * 100 ELSE 0 END),
    p_feedback
  )
  ON CONFLICT (exam_id, student_id)
  DO UPDATE SET
    marks_obtained = EXCLUDED.marks_obtained,
    grade = EXCLUDED.grade,
    feedback = EXCLUDED.feedback
  RETURNING * INTO r;

  PERFORM log_audit('result.upsert', 'result', r.id,
    jsonb_build_object('exam_id', p_exam_id, 'student_id', p_student_id, 'marks', p_marks));
  RETURN r;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;
COMMENT ON FUNCTION upsert_result(UUID, UUID, INT, TEXT)
  IS E'@name upsertResult\nEnter or update a student''s marks for an exam';

CREATE OR REPLACE FUNCTION exam_results(p_exam_id UUID)
RETURNS TABLE (
  student_id UUID, full_name TEXT, roll_number TEXT,
  marks_obtained INT, total_marks INT, percentage NUMERIC,
  grade TEXT, rank INT, passed BOOLEAN
) AS $$
  SELECT
    s.id, u.full_name, s.roll_number,
    r.marks_obtained, e.total_marks,
    CASE WHEN e.total_marks > 0
      THEN ROUND((r.marks_obtained::numeric / e.total_marks) * 100, 1) ELSE 0 END,
    r.grade,
    RANK() OVER (ORDER BY r.marks_obtained DESC)::int,
    r.marks_obtained >= COALESCE(e.passing_marks, CEIL(e.total_marks * 0.4))
  FROM results r
  JOIN exams e ON e.id = r.exam_id
  JOIN students s ON s.id = r.student_id
  JOIN users u ON u.id = s.user_id
  WHERE r.exam_id = p_exam_id
  ORDER BY r.marks_obtained DESC, u.full_name;
$$ LANGUAGE sql STABLE;
COMMENT ON FUNCTION exam_results(UUID) IS E'@name examResults';
