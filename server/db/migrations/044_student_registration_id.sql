-- Human-readable student registration id.
--
-- Students were identified on screen by their uuid (or a truncated slice of
-- it), which nobody can remember or read out over the phone. Every student now
-- carries one permanent registration id, shown everywhere a student appears:
-- rosters, search, attendance, marks entry, report cards, admit cards, fees.
--
--   <PREFIX><YY><SEQ>     e.g. DEMO260001
--
--   PREFIX  2–4 letters identifying the school, unique across the platform so
--           the id is unique platform-wide, not just within a tenant.
--   YY      two-digit year of admission.
--   SEQ     per-school, per-year counter, zero-padded to 4 digits (it simply
--           grows a digit past 9999 admissions in one year).
--
-- The uuid stays the primary key and every FK keeps using it; registration_id
-- is a display/search identifier only. It is assigned by trigger so every
-- insert path (registerStudent, register_user, imports, admissions, seeds)
-- gets one without code changes, and it never changes once assigned.

-- 1. School prefix.
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS student_id_prefix TEXT;
ALTER TABLE institutions DROP CONSTRAINT IF EXISTS institutions_student_id_prefix_format;
ALTER TABLE institutions ADD CONSTRAINT institutions_student_id_prefix_format
  CHECK (student_id_prefix IS NULL OR student_id_prefix ~ '^[A-Z]{2,4}$');
CREATE UNIQUE INDEX IF NOT EXISTS institutions_student_id_prefix_key
  ON institutions (student_id_prefix) WHERE student_id_prefix IS NOT NULL;

-- 2. Per-school, per-year counter. A row lock on it serialises concurrent
--    admissions for the same school/year without a global sequence.
CREATE TABLE IF NOT EXISTS student_registration_counters (
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  admission_year INT NOT NULL,
  last_seq INT NOT NULL DEFAULT 0,
  PRIMARY KEY (institution_id, admission_year)
);

-- 3. The id itself.
ALTER TABLE students ADD COLUMN IF NOT EXISTS registration_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS students_registration_id_key
  ON students (registration_id) WHERE registration_id IS NOT NULL;

/**
 * The institution's prefix, deriving and storing one on first use.
 * Candidates, in order: first 4 letters of the slug (if it has 3+), initials of the name,
 * first 3 letters of the slug, then first 2 slug letters + 2 generated letters.
 */
CREATE OR REPLACE FUNCTION institution_student_id_prefix(inst_id UUID) RETURNS TEXT AS $$
DECLARE
  existing TEXT;
  letters TEXT;
  initials TEXT;
  candidate TEXT;
  candidates TEXT[];
  i INT;
BEGIN
  SELECT student_id_prefix INTO existing FROM institutions WHERE id = inst_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'institution % not found', inst_id;
  END IF;
  IF existing IS NOT NULL THEN
    RETURN existing;
  END IF;

  SELECT upper(regexp_replace(slug, '[^a-zA-Z]', '', 'g')),
         upper(string_agg(left(w, 1), '' ORDER BY ord))
    INTO letters, initials
    FROM institutions,
         LATERAL regexp_split_to_table(
           regexp_replace(replace(name, '''', ''), '[^a-zA-Z ]', ' ', 'g'), '\s+')
           WITH ORDINALITY AS t(w, ord)
   WHERE id = inst_id AND w <> ''
   GROUP BY slug;

  letters := COALESCE(NULLIF(letters, ''), 'SCH');
  IF length(letters) < 2 THEN
    letters := letters || 'X';
  END IF;
  -- A slug too short to say anything (e.g. "x") loses to the name's initials.
  candidates := ARRAY[
    CASE WHEN length(letters) >= 3 THEN left(letters, 4) END,
    left(initials, 4),
    left(letters, 3)
  ];

  FOREACH candidate IN ARRAY candidates LOOP
    IF candidate ~ '^[A-Z]{2,4}$'
       AND NOT EXISTS (SELECT 1 FROM institutions WHERE student_id_prefix = candidate) THEN
      UPDATE institutions SET student_id_prefix = candidate WHERE id = inst_id;
      RETURN candidate;
    END IF;
  END LOOP;

  FOR i IN 0..675 LOOP
    candidate := left(letters, 2) || chr(65 + i / 26) || chr(65 + i % 26);
    IF NOT EXISTS (SELECT 1 FROM institutions WHERE student_id_prefix = candidate) THEN
      UPDATE institutions SET student_id_prefix = candidate WHERE id = inst_id;
      RETURN candidate;
    END IF;
  END LOOP;

  RAISE EXCEPTION 'could not allocate a student id prefix for institution %', inst_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/** Allocate the next registration id for a school and admission year. */
CREATE OR REPLACE FUNCTION next_student_registration_id(inst_id UUID, adm_year INT)
RETURNS TEXT AS $$
DECLARE
  prefix TEXT;
  seq INT;
  candidate TEXT;
BEGIN
  prefix := institution_student_id_prefix(inst_id);

  -- Loops only if a counter has fallen behind ids already issued (e.g. a
  -- counters table recreated on a database that kept its students).
  LOOP
    INSERT INTO student_registration_counters AS c (institution_id, admission_year, last_seq)
    VALUES (inst_id, adm_year, 1)
    ON CONFLICT (institution_id, admission_year)
      DO UPDATE SET last_seq = c.last_seq + 1
    RETURNING last_seq INTO seq;

    candidate := prefix || lpad((adm_year % 100)::text, 2, '0') || lpad(seq::text, 4, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM students WHERE registration_id = candidate);
  END LOOP;
  RETURN candidate;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION students_assign_registration_id() RETURNS trigger AS $$
DECLARE
  inst_id UUID;
BEGIN
  -- Assigned once and permanent: printed report cards and admit cards carry it.
  IF TG_OP = 'UPDATE' AND OLD.registration_id IS NOT NULL THEN
    NEW.registration_id := OLD.registration_id;
    RETURN NEW;
  END IF;
  IF NEW.registration_id IS NOT NULL OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT institution_id INTO inst_id FROM users WHERE id = NEW.user_id;
  IF inst_id IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.registration_id := next_student_registration_id(
    inst_id,
    EXTRACT(YEAR FROM COALESCE(NEW.admission_date, NEW.enrollment_date, CURRENT_DATE))::int
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS students_registration_id ON students;
CREATE TRIGGER students_registration_id
  BEFORE INSERT OR UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION students_assign_registration_id();

-- 4. Backfill existing students, oldest admission first, so numbering follows
--    the order students actually joined.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT s.id, u.institution_id,
           EXTRACT(YEAR FROM COALESCE(s.admission_date, s.enrollment_date, u.created_at::date, CURRENT_DATE))::int AS yr
      FROM students s
      JOIN users u ON u.id = s.user_id
     WHERE s.registration_id IS NULL AND u.institution_id IS NOT NULL
     ORDER BY COALESCE(s.admission_date, s.enrollment_date, u.created_at::date), u.created_at, u.full_name
  LOOP
    UPDATE students
       SET registration_id = next_student_registration_id(r.institution_id, r.yr)
     WHERE id = r.id;
  END LOOP;
END $$;

-- Prefixes for schools with no students yet, so the id format is visible in
-- settings before the first admission.
SELECT institution_student_id_prefix(id) FROM institutions WHERE student_id_prefix IS NULL;

-- 5. Roster-shaped functions behind GraphQL screens also return the id.
--    Adding an output column changes the return type, so drop and recreate.

DROP FUNCTION IF EXISTS class_attendance_summary(UUID, DATE, DATE);
CREATE FUNCTION class_attendance_summary(
  p_class_id UUID,
  p_start DATE DEFAULT NULL,
  p_end DATE DEFAULT NULL
) RETURNS TABLE (
  student_id UUID, registration_id TEXT, full_name TEXT, roll_number TEXT,
  present INT, absent INT, late INT, working INT, percentage NUMERIC
) AS $$
  SELECT s.id, s.registration_id, u.full_name, s.roll_number,
         st.present, st.absent, st.late, st.working, st.percentage
  FROM students s
  JOIN users u ON u.id = s.user_id
  CROSS JOIN LATERAL student_attendance_stats(s.id, p_start, p_end) st
  WHERE s.class_id = p_class_id
  ORDER BY st.percentage ASC, u.full_name;
$$ LANGUAGE sql STABLE;
COMMENT ON FUNCTION class_attendance_summary(UUID, DATE, DATE) IS E'@name classAttendanceSummary';

DROP FUNCTION IF EXISTS exam_results(UUID);
CREATE FUNCTION exam_results(p_exam_id UUID)
RETURNS TABLE (
  student_id UUID, registration_id TEXT, full_name TEXT, roll_number TEXT,
  marks_obtained INT, total_marks INT, percentage NUMERIC,
  grade TEXT, rank INT, passed BOOLEAN
) AS $$
  SELECT
    s.id, s.registration_id, u.full_name, s.roll_number,
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

DROP FUNCTION IF EXISTS admit_eligibility_for_exam(UUID);
CREATE FUNCTION admit_eligibility_for_exam(p_exam_id UUID)
RETURNS TABLE (
  student_id UUID, registration_id TEXT, full_name TEXT, roll_number TEXT, photo_file_id UUID,
  attendance_pct NUMERIC, threshold NUMERIC, attendance_ok BOOLEAN,
  pending_fees NUMERIC, fee_gate BOOLEAN, fee_threshold NUMERIC, fee_ok BOOLEAN,
  eligible BOOLEAN, reason TEXT
) AS $$
DECLARE
  inst UUID;
  cls UUID;
  thr NUMERIC;
  fgate BOOLEAN;
  fthr NUMERIC;
BEGIN
  SELECT c.institution_id, e.class_id INTO inst, cls
  FROM exams e JOIN classes c ON c.id = e.class_id
  WHERE e.id = p_exam_id;

  SELECT COALESCE(s.attendance_threshold, 75),
         COALESCE(s.fee_block_enabled, false),
         COALESCE(s.fee_threshold, 0)
  INTO thr, fgate, fthr
  FROM institution_settings s WHERE s.institution_id = inst;
  thr := COALESCE(thr, 75);
  fgate := COALESCE(fgate, false);
  fthr := COALESCE(fthr, 0);

  RETURN QUERY
  WITH base AS (
    SELECT s.id AS sid, s.registration_id AS reg, u.full_name AS name, s.roll_number AS roll,
           s.photo_file_id AS photo,
           COALESCE(st.percentage, 0) AS pct,
           COALESCE((SELECT SUM(f.amount - COALESCE(f.discount_amount, 0) - COALESCE(f.paid_amount, 0))
                       FROM fees f
                      WHERE f.student_id = s.id
                        AND f.status NOT IN ('paid', 'waived', 'cancelled')), 0) AS pend
    FROM students s
    JOIN users u ON u.id = s.user_id
    CROSS JOIN LATERAL student_attendance_stats(s.id) st
    WHERE s.class_id = cls
  )
  SELECT
    b.sid, b.reg, b.name, b.roll, b.photo,
    b.pct, thr, (b.pct >= thr),
    b.pend, fgate, fthr, (NOT fgate OR b.pend <= fthr),
    (b.pct >= thr) AND (NOT fgate OR b.pend <= fthr),
    CASE
      WHEN (b.pct >= thr) AND (NOT fgate OR b.pend <= fthr) THEN 'Eligible'
      ELSE NULLIF(trim(both ' ;' FROM
        CASE WHEN b.pct < thr
             THEN format('Attendance %s%% below %s%%; ', b.pct, thr) ELSE '' END ||
        CASE WHEN fgate AND b.pend > fthr
             THEN format('Pending fees %s above limit %s', b.pend, fthr) ELSE '' END
      ), '')
    END
  FROM base b
  ORDER BY b.name;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
COMMENT ON FUNCTION admit_eligibility_for_exam(UUID) IS E'@name admitEligibilityForExam';
