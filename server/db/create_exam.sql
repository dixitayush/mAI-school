-- Custom mutation to create exam (Workaround for missing auto-gen mutation)
CREATE OR REPLACE FUNCTION create_exam(
  class_id UUID,
  title TEXT,
  subject TEXT,
  exam_date DATE,
  total_marks INT,
  description TEXT DEFAULT NULL
) RETURNS exams AS $$
  INSERT INTO exams (class_id, title, subject, exam_date, total_marks, description)
  VALUES (class_id, title, subject, exam_date, total_marks, description)
  RETURNING *;
$$ LANGUAGE SQL VOLATILE STRICT SECURITY DEFINER;

COMMENT ON FUNCTION create_exam(UUID, TEXT, TEXT, DATE, INT, TEXT) IS E'@name createExam\nCreate a new exam';
