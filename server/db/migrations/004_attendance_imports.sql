-- ============================================================
-- Migration 004 — AI Attendance Register Import (Feature 1)
-- Stores the uploaded register image + the OCR extraction so a teacher
-- can review/edit before committing to the real `attendance` table.
-- Writes happen via tenant-checked REST (routes/ai.js); these tables are
-- read via PostGraphile so the UI can list import history.
-- ============================================================

CREATE TABLE IF NOT EXISTS attendance_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  image_file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  attendance_date DATE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed', 'committed')),
  raw_extraction JSONB,
  row_count INT NOT NULL DEFAULT 0,
  committed_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE attendance_imports IS E'@omit create,update,delete';
CREATE INDEX IF NOT EXISTS attendance_imports_inst_idx
  ON attendance_imports (institution_id, created_at DESC);

CREATE TABLE IF NOT EXISTS attendance_import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES attendance_imports(id) ON DELETE CASCADE,
  matched_student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  extracted_name TEXT,
  extracted_roll TEXT,
  status TEXT,
  confidence NUMERIC,
  accepted BOOLEAN NOT NULL DEFAULT TRUE
);
COMMENT ON TABLE attendance_import_rows IS E'@omit create,update,delete';
CREATE INDEX IF NOT EXISTS attendance_import_rows_import_idx
  ON attendance_import_rows (import_id);

-- ---- RLS: tenant-scoped read (writes go through SECURITY DEFINER REST) ----
ALTER TABLE attendance_imports ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON attendance_imports TO mai_graphql;
DROP POLICY IF EXISTS mai_tenant_all ON attendance_imports;
CREATE POLICY mai_tenant_all ON attendance_imports FOR ALL TO mai_graphql
  USING (rls_is_mai_admin() OR institution_id = rls_jwt_institution_id())
  WITH CHECK (rls_is_mai_admin() OR institution_id = rls_jwt_institution_id());

ALTER TABLE attendance_import_rows ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON attendance_import_rows TO mai_graphql;
DROP POLICY IF EXISTS mai_tenant_all ON attendance_import_rows;
CREATE POLICY mai_tenant_all ON attendance_import_rows FOR ALL TO mai_graphql
  USING (
    rls_is_mai_admin() OR EXISTS (
      SELECT 1 FROM attendance_imports i
      WHERE i.id = attendance_import_rows.import_id
        AND i.institution_id = rls_jwt_institution_id()
    )
  )
  WITH CHECK (
    rls_is_mai_admin() OR EXISTS (
      SELECT 1 FROM attendance_imports i
      WHERE i.id = attendance_import_rows.import_id
        AND i.institution_id = rls_jwt_institution_id()
    )
  );
