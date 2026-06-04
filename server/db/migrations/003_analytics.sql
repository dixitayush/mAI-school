-- ============================================================
-- Migration 003 — Attendance Analytics & Exam Eligibility (Feature 2)
-- All functions are STABLE/invoker so RLS (role mai_graphql) enforces tenant
-- isolation automatically — a user only ever sees their own tenant's rows.
-- ============================================================

-- Working days in [start,end] excluding weekends (per settings) and holidays.
CREATE OR REPLACE FUNCTION working_days(p_institution_id UUID, p_start DATE, p_end DATE)
RETURNS INT AS $$
  SELECT COUNT(*)::int
  FROM generate_series(p_start, p_end, interval '1 day') d
  WHERE EXTRACT(DOW FROM d)::int <> ALL (
    COALESCE(
      (SELECT weekend_days FROM institution_settings WHERE institution_id = p_institution_id),
      '{0,6}'::int[]
    )
  )
  AND NOT EXISTS (
    SELECT 1 FROM holidays h
    WHERE h.institution_id = p_institution_id
      AND d::date BETWEEN h.start_date AND h.end_date
  );
$$ LANGUAGE sql STABLE;
COMMENT ON FUNCTION working_days(UUID, DATE, DATE) IS E'@name workingDays';

-- Resolve a student's institution + the effective date window (academic year or last 365d).
CREATE OR REPLACE FUNCTION student_attendance_stats(
  p_student_id UUID,
  p_start DATE DEFAULT NULL,
  p_end DATE DEFAULT NULL
) RETURNS TABLE (
  present INT, absent INT, late INT, working INT, attended INT, percentage NUMERIC
) AS $$
DECLARE
  inst UUID;
  s DATE;
  e DATE;
  wd INT;
BEGIN
  SELECT u.institution_id INTO inst
  FROM students st JOIN users u ON u.id = st.user_id
  WHERE st.id = p_student_id;

  SELECT COALESCE(p_start, academic_year_start, CURRENT_DATE - 365),
         COALESCE(p_end, academic_year_end, CURRENT_DATE)
  INTO s, e
  FROM institution_settings WHERE institution_id = inst;
  s := COALESCE(s, CURRENT_DATE - 365);
  e := COALESCE(e, CURRENT_DATE);

  wd := working_days(inst, s, e);

  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE a.status = 'present')::int,
    COUNT(*) FILTER (WHERE a.status = 'absent')::int,
    COUNT(*) FILTER (WHERE a.status = 'late')::int,
    wd,
    COUNT(*) FILTER (WHERE a.status IN ('present', 'late'))::int,
    CASE WHEN wd > 0
      THEN ROUND((COUNT(*) FILTER (WHERE a.status IN ('present', 'late'))::numeric / wd) * 100, 1)
      ELSE 0 END
  FROM attendance a
  WHERE a.student_id = p_student_id AND a.date BETWEEN s AND e;
END;
$$ LANGUAGE plpgsql STABLE;
COMMENT ON FUNCTION student_attendance_stats(UUID, DATE, DATE) IS E'@name studentAttendanceStats';

-- Monthly attendance percentage for a student (last N months).
CREATE OR REPLACE FUNCTION student_attendance_monthly(
  p_student_id UUID,
  p_months INT DEFAULT 6
) RETURNS TABLE (month TEXT, present INT, total INT, percentage NUMERIC) AS $$
  SELECT
    to_char(a.date, 'YYYY-MM') AS month,
    COUNT(*) FILTER (WHERE a.status IN ('present', 'late'))::int AS present,
    COUNT(*)::int AS total,
    CASE WHEN COUNT(*) > 0
      THEN ROUND((COUNT(*) FILTER (WHERE a.status IN ('present', 'late'))::numeric / COUNT(*)) * 100, 1)
      ELSE 0 END AS percentage
  FROM attendance a
  WHERE a.student_id = p_student_id
    AND a.date >= (date_trunc('month', CURRENT_DATE) - ((p_months - 1) || ' months')::interval)
  GROUP BY 1
  ORDER BY 1;
$$ LANGUAGE sql STABLE;
COMMENT ON FUNCTION student_attendance_monthly(UUID, INT) IS E'@name studentAttendanceMonthly';

-- Per-student summary for a class (powers low-attendance lists + class analytics).
CREATE OR REPLACE FUNCTION class_attendance_summary(
  p_class_id UUID,
  p_start DATE DEFAULT NULL,
  p_end DATE DEFAULT NULL
) RETURNS TABLE (
  student_id UUID, full_name TEXT, roll_number TEXT,
  present INT, absent INT, late INT, working INT, percentage NUMERIC
) AS $$
  SELECT s.id, u.full_name, s.roll_number,
         st.present, st.absent, st.late, st.working, st.percentage
  FROM students s
  JOIN users u ON u.id = s.user_id
  CROSS JOIN LATERAL student_attendance_stats(s.id, p_start, p_end) st
  WHERE s.class_id = p_class_id
  ORDER BY st.percentage ASC, u.full_name;
$$ LANGUAGE sql STABLE;
COMMENT ON FUNCTION class_attendance_summary(UUID, DATE, DATE) IS E'@name classAttendanceSummary';

-- Exam eligibility for a student (attendance threshold from settings).
CREATE OR REPLACE FUNCTION exam_eligibility(
  p_student_id UUID,
  p_exam_id UUID
) RETURNS TABLE (eligible BOOLEAN, percentage NUMERIC, threshold NUMERIC, reason TEXT) AS $$
DECLARE
  inst UUID;
  thr NUMERIC;
  pct NUMERIC;
BEGIN
  SELECT c.institution_id INTO inst
  FROM exams e JOIN classes c ON c.id = e.class_id
  WHERE e.id = p_exam_id;

  SELECT COALESCE(attendance_threshold, 75) INTO thr
  FROM institution_settings WHERE institution_id = inst;
  thr := COALESCE(thr, 75);

  SELECT s.percentage INTO pct FROM student_attendance_stats(p_student_id) s;
  pct := COALESCE(pct, 0);

  RETURN QUERY SELECT
    pct >= thr,
    pct,
    thr,
    CASE WHEN pct >= thr THEN 'Eligible'
         ELSE format('Attendance %s%% is below required %s%%', pct, thr) END;
END;
$$ LANGUAGE plpgsql STABLE;
COMMENT ON FUNCTION exam_eligibility(UUID, UUID) IS E'@name examEligibility';
