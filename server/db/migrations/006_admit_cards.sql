-- ============================================================
-- Migration 006 — Exam Admit Cards (Feature 4)
-- Eligibility = attendance >= threshold (reuses exam_eligibility) AND
-- (fee gate off OR pending fees <= fee_threshold). PDFs are generated
-- client-side; issuance is recorded here for audit.
-- ============================================================

CREATE TABLE IF NOT EXISTS admit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  eligibility_snapshot JSONB,
  issued_by UUID REFERENCES users(id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT admit_cards_exam_student_uniq UNIQUE (exam_id, student_id)
);
COMMENT ON TABLE admit_cards IS E'@omit create,update,delete';
CREATE INDEX IF NOT EXISTS admit_cards_inst_idx ON admit_cards (institution_id, exam_id);

ALTER TABLE admit_cards ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON admit_cards TO mai_graphql;
DROP POLICY IF EXISTS mai_tenant_all ON admit_cards;
CREATE POLICY mai_tenant_all ON admit_cards FOR ALL TO mai_graphql
  USING (rls_is_mai_admin() OR institution_id = rls_jwt_institution_id())
  WITH CHECK (rls_is_mai_admin() OR institution_id = rls_jwt_institution_id());

-- Combined admit-card eligibility for every student in an exam's class.
CREATE OR REPLACE FUNCTION admit_eligibility_for_exam(p_exam_id UUID)
RETURNS TABLE (
  student_id UUID, full_name TEXT, roll_number TEXT, photo_file_id UUID,
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
    SELECT s.id AS sid, u.full_name AS name, s.roll_number AS roll, s.photo_file_id AS photo,
           COALESCE(st.percentage, 0) AS pct,
           COALESCE((SELECT SUM(f.amount) FROM fees f
                     WHERE f.student_id = s.id AND f.status IN ('pending', 'overdue')), 0) AS pend
    FROM students s
    JOIN users u ON u.id = s.user_id
    CROSS JOIN LATERAL student_attendance_stats(s.id) st
    WHERE s.class_id = cls
  )
  SELECT
    b.sid, b.name, b.roll, b.photo,
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
$$ LANGUAGE plpgsql STABLE;
COMMENT ON FUNCTION admit_eligibility_for_exam(UUID) IS E'@name admitEligibilityForExam';
