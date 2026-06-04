-- ============================================================
-- Migration 012 — Performance indexes
-- The base schema declares foreign keys but no secondary indexes, so the
-- common filtered reads (students by class, results by exam, attendance by
-- student/date, exams by class) fall back to sequential scans. On a large
-- tenant these dominate page-load time (e.g. the Exams list + marks entry).
-- All idempotent (CREATE INDEX IF NOT EXISTS), safe to re-run every boot.
-- ============================================================

-- Students: filtered by class (+ section) constantly (marks, attendance, admit cards).
CREATE INDEX IF NOT EXISTS students_class_id_idx       ON students (class_id);
CREATE INDEX IF NOT EXISTS students_class_section_idx  ON students (class_id, section);
CREATE INDEX IF NOT EXISTS students_user_id_idx        ON students (user_id);

-- Users: tenant + role scoping on nearly every list.
CREATE INDEX IF NOT EXISTS users_institution_id_idx    ON users (institution_id);
CREATE INDEX IF NOT EXISTS users_institution_role_idx  ON users (institution_id, role);

-- Classes: tenant + teacher dashboards.
CREATE INDEX IF NOT EXISTS classes_institution_id_idx  ON classes (institution_id);
CREATE INDEX IF NOT EXISTS classes_teacher_id_idx      ON classes (teacher_id);

-- Exams + results: the slow path the user reported.
CREATE INDEX IF NOT EXISTS exams_class_id_idx          ON exams (class_id);
CREATE INDEX IF NOT EXISTS exams_exam_date_idx         ON exams (exam_date);
CREATE INDEX IF NOT EXISTS results_exam_id_idx         ON results (exam_id);
CREATE INDEX IF NOT EXISTS results_student_id_idx      ON results (student_id);
CREATE INDEX IF NOT EXISTS results_exam_student_idx    ON results (exam_id, student_id);

-- Attendance: per-student stats + per-class/date history.
CREATE INDEX IF NOT EXISTS attendance_student_id_idx   ON attendance (student_id);
CREATE INDEX IF NOT EXISTS attendance_date_idx         ON attendance (date);
CREATE INDEX IF NOT EXISTS attendance_student_date_idx ON attendance (student_id, date);

-- Fees: per-student summaries + eligibility fee gate.
CREATE INDEX IF NOT EXISTS fees_student_id_idx         ON fees (student_id);
CREATE INDEX IF NOT EXISTS fees_status_idx             ON fees (status);
