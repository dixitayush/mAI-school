-- ============================================================
-- Migration 008 — Foreign-key repair
-- schema.sql DROPs core tables (institutions, users, classes, students,
-- exams) with CASCADE on every boot. That CASCADE also silently drops the
-- FK constraints that earlier migration tables declared against them, and
-- because those tables are created with CREATE TABLE IF NOT EXISTS the
-- constraints are never re-added. Without the FKs PostGraphile builds no
-- forward ("belongs to") relations (e.g. Assignment.classByClassId), and
-- referential integrity is lost. Migrations run after schema.sql on every
-- boot, so re-asserting the constraints here restores both.
-- DROP IF EXISTS + ADD keeps this idempotent.
-- ============================================================

DO $$
DECLARE
  fk RECORD;
BEGIN
  FOR fk IN
    SELECT * FROM (VALUES
      ('holidays',               'holidays_institution_id_fkey',               'institution_id',     'institutions', 'CASCADE'),
      ('holidays',               'holidays_created_by_fkey',                   'created_by',         'users',        'SET NULL'),
      ('audit_log',              'audit_log_institution_id_fkey',              'institution_id',     'institutions', 'CASCADE'),
      ('audit_log',              'audit_log_actor_user_id_fkey',               'actor_user_id',      'users',        'SET NULL'),
      ('institution_settings',   'institution_settings_institution_id_fkey',   'institution_id',     'institutions', 'CASCADE'),
      ('academic_sessions',      'academic_sessions_institution_id_fkey',      'institution_id',     'institutions', 'CASCADE'),
      ('attendance_imports',     'attendance_imports_institution_id_fkey',     'institution_id',     'institutions', 'CASCADE'),
      ('attendance_imports',     'attendance_imports_class_id_fkey',           'class_id',           'classes',      'SET NULL'),
      ('attendance_imports',     'attendance_imports_uploaded_by_fkey',        'uploaded_by',        'users',        'SET NULL'),
      ('attendance_import_rows', 'attendance_import_rows_matched_student_fkey','matched_student_id', 'students',     'SET NULL'),
      ('admit_cards',            'admit_cards_institution_id_fkey',            'institution_id',     'institutions', 'CASCADE'),
      ('admit_cards',            'admit_cards_exam_id_fkey',                   'exam_id',            'exams',        'CASCADE'),
      ('admit_cards',            'admit_cards_student_id_fkey',                'student_id',         'students',     'CASCADE'),
      ('admit_cards',            'admit_cards_issued_by_fkey',                 'issued_by',          'users',        'SET NULL'),
      ('assignments',            'assignments_institution_id_fkey',            'institution_id',     'institutions', 'CASCADE'),
      ('assignments',            'assignments_class_id_fkey',                  'class_id',           'classes',      'CASCADE'),
      ('assignments',            'assignments_teacher_id_fkey',                'teacher_id',         'users',        'SET NULL'),
      ('assignment_submissions', 'assignment_submissions_student_id_fkey',     'student_id',         'students',     'CASCADE'),
      ('timetable_periods',      'timetable_periods_institution_id_fkey',      'institution_id',     'institutions', 'CASCADE'),
      ('timetable_periods',      'timetable_periods_class_id_fkey',            'class_id',           'classes',      'CASCADE'),
      ('timetable_periods',      'timetable_periods_teacher_id_fkey',          'teacher_id',         'users',        'SET NULL'),
      ('online_classes',         'online_classes_institution_id_fkey',         'institution_id',     'institutions', 'CASCADE'),
      ('online_classes',         'online_classes_class_id_fkey',               'class_id',           'classes',      'CASCADE'),
      ('online_classes',         'online_classes_teacher_id_fkey',             'teacher_id',         'users',        'SET NULL'),
      ('chat_sessions',          'chat_sessions_institution_id_fkey',          'institution_id',     'institutions', 'CASCADE'),
      ('chat_sessions',          'chat_sessions_user_id_fkey',                 'user_id',            'users',        'CASCADE')
    ) AS t(tbl, conname, col, ref, on_delete)
  LOOP
    -- Skip tables not yet created (a later migration may add them; this repair
    -- re-runs every boot and will pick them up once they exist).
    CONTINUE WHEN to_regclass(fk.tbl) IS NULL OR to_regclass(fk.ref) IS NULL;
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', fk.tbl, fk.conname);
    -- NOT VALID: register the constraint (so PostGraphile builds the forward
    -- relation and new rows are enforced) without validating pre-existing rows.
    -- The destructive boot reseeds core tables with fresh UUIDs, leaving stale
    -- rows in these tables orphaned; validating would fail in the testing env.
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(id) ON DELETE %s NOT VALID',
      fk.tbl, fk.conname, fk.col, fk.ref, fk.on_delete
    );
  END LOOP;
END $$;
