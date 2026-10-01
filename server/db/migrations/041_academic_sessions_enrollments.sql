-- Academic sessions + per-session enrollment history.
--
-- academic_sessions existed but was empty and unreferenced, and students carried
-- a single class_id/section, so a school had no way to express "this student was
-- in class 6 last year and class 7 now". student_enrollments records one row per
-- student per session, which makes historical rosters, promotions and
-- session-filtered reporting possible.
--
-- students.class_id / students.section stay as the denormalised "current"
-- pointer that existing screens read; enrollments are the source of truth for
-- any session other than the current one.

-- 1. Every institution needs a current session. Indian schools run April–March,
--    so derive the session the current date falls into.
INSERT INTO academic_sessions (institution_id, name, start_date, end_date, is_current)
SELECT i.id,
       CASE WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 4
            THEN EXTRACT(YEAR FROM CURRENT_DATE)::int || '-' || (EXTRACT(YEAR FROM CURRENT_DATE)::int + 1)
            ELSE (EXTRACT(YEAR FROM CURRENT_DATE)::int - 1) || '-' || EXTRACT(YEAR FROM CURRENT_DATE)::int
       END,
       CASE WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 4
            THEN make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 4, 1)
            ELSE make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int - 1, 4, 1)
       END,
       CASE WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 4
            THEN make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int + 1, 3, 31)
            ELSE make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 3, 31)
       END,
       TRUE
  FROM institutions i
 WHERE NOT EXISTS (SELECT 1 FROM academic_sessions s WHERE s.institution_id = i.id);

-- Exactly one current session per institution.
CREATE UNIQUE INDEX IF NOT EXISTS academic_sessions_one_current
  ON academic_sessions (institution_id) WHERE is_current;

CREATE INDEX IF NOT EXISTS academic_sessions_institution_idx
  ON academic_sessions (institution_id, start_date DESC);

-- 2. Enrollment history.
CREATE TABLE IF NOT EXISTS student_enrollments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  session_id  UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  class_id    UUID REFERENCES classes(id) ON DELETE SET NULL,
  section     TEXT,
  roll_number TEXT,
  -- active: current placement. promoted/retained: how the year ended.
  -- transferred/left: student is no longer on this roster.
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'promoted', 'retained', 'transferred', 'left')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, session_id)
);

CREATE INDEX IF NOT EXISTS student_enrollments_session_class_idx
  ON student_enrollments (session_id, class_id, section);
CREATE INDEX IF NOT EXISTS student_enrollments_student_idx
  ON student_enrollments (student_id);

-- 3. Backfill the current placement of every existing student.
INSERT INTO student_enrollments (student_id, session_id, class_id, section, roll_number, status)
SELECT s.id, cur.id, s.class_id, s.section, s.roll_number, 'active'
  FROM students s
  JOIN users u ON u.id = s.user_id
  JOIN academic_sessions cur
    ON cur.institution_id = u.institution_id AND cur.is_current
 ON CONFLICT (student_id, session_id) DO NOTHING;

-- 4. Indexes behind the roster filters/search. A 500–1000 student roster is
--    filtered by class/section and searched by name, roll or admission number.
CREATE INDEX IF NOT EXISTS students_class_section_idx ON students (class_id, section);
CREATE INDEX IF NOT EXISTS students_roll_idx ON students (roll_number);
CREATE INDEX IF NOT EXISTS students_admission_number_idx ON students (admission_number);
CREATE INDEX IF NOT EXISTS users_institution_name_idx ON users (institution_id, full_name);
